"""
Notification Manager and Distribution Service.
Implements PRD Sections 12, 15, 31, 32, 63.
Strictly adheres to:
- No emojis in titles, messages, or payloads.
- Verified closed-loop notifications based on actual state.
- Deduplication via {command_id}:{event_type}.
- WebSocket broadcasting and persistent storage.
"""

from datetime import datetime, timezone
import json
import logging
from typing import Any, Dict, List, Optional
from database.models import NotificationRecord
from database.session import SessionLocal

logger = logging.getLogger("KUKA.NotificationService")


class NotificationService:
    """Manages creation, deduplication, persistence, and broadcasting of system notifications."""

    def __init__(self):
        self.ws_broadcaster = None
        self._seq: int = 1
        self._dedup_cache: set = set()

    def set_ws_broadcaster(self, broadcaster):
        """Bind WebSocket broadcast function."""
        self.ws_broadcaster = broadcaster

    def _next_event_id(self) -> str:
        import uuid
        return f"EVT-{uuid.uuid4().hex[:10].upper()}"

    async def emit_notification(
        self,
        event_type: str,
        severity: str,
        title: str,
        message: str,
        robot_id: str = "KUKA-01",
        command_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        force: bool = False
    ) -> Optional[Dict[str, Any]]:
        """
        Create, persist, and broadcast a notification with deduplication.
        Returns the notification dict if emitted, or None if dropped as duplicate.
        """
        # Deduplication check
        if command_id and not force:
            dedup_key = f"{command_id}:{event_type}"
            if dedup_key in self._dedup_cache:
                logger.debug("Silently dropping duplicate event: %s", dedup_key)
                return None
            self._dedup_cache.add(dedup_key)

        event_id = self._next_event_id()
        now_dt = datetime.now(timezone.utc)
        now_iso = now_dt.isoformat()

        # Build payload
        notif_dict = {
            "id": event_id,
            "event_id": event_id,
            "type": "notification",
            "event": event_type,
            "robot_id": robot_id,
            "command_id": command_id,
            "severity": severity.upper(),  # INFO, SUCCESS, WARNING, ERROR, CRITICAL
            "title": title,
            "message": message,
            "timestamp": now_iso,
            "read": False,
            "read_at": None,
            "payload": metadata or {},
        }

        # 1. Persist to database
        try:
            with SessionLocal() as db:
                record = NotificationRecord(
                    event_id=event_id,
                    robot_id=robot_id,
                    command_id=command_id,
                    user_id="operator-1",
                    type=event_type,
                    severity=severity.upper(),
                    title=title,
                    message=message,
                    created_at=now_dt,
                    read_at=None,
                    metadata_json=json.dumps(metadata or {}),
                )
                db.add(record)
                db.commit()
                notif_dict["db_id"] = record.id
        except Exception as err:
            logger.error("Failed to persist notification %s: %s", event_id, err)

        # 2. Broadcast via WebSocket to client website and 3D digital twin
        if self.ws_broadcaster:
            try:
                await self.ws_broadcaster(notif_dict)
            except Exception as err:
                logger.warning("Error broadcasting notification via WebSocket: %s", err)

        logger.info(
            "[%s] [%s] %s - Command: %s - %s",
            severity.upper(), event_type, title, command_id or "N/A", message
        )
        return notif_dict

    def get_notifications(
        self,
        limit: int = 50,
        offset: int = 0,
        unread_only: bool = False,
        severity: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Retrieve notifications from database with optional filters."""
        with SessionLocal() as db:
            query = db.query(NotificationRecord)
            if unread_only:
                query = query.filter(NotificationRecord.read_at == None)
            if severity:
                query = query.filter(NotificationRecord.severity == severity.upper())

            records = (
                query.order_by(NotificationRecord.created_at.desc())
                .offset(offset)
                .limit(limit)
                .all()
            )
            return [r.to_dict() for r in records]

    def mark_as_read(self, notification_id: str) -> bool:
        """Mark a notification as read by event_id or numeric id."""
        with SessionLocal() as db:
            if notification_id.isdigit():
                rec = db.query(NotificationRecord).filter(NotificationRecord.id == int(notification_id)).first()
            else:
                rec = db.query(NotificationRecord).filter(NotificationRecord.event_id == notification_id).first()

            if rec and not rec.read_at:
                rec.read_at = datetime.now(timezone.utc)
                db.commit()
                return True
        return False

    def mark_all_as_read(self) -> int:
        """Mark all unread notifications as read."""
        with SessionLocal() as db:
            now = datetime.now(timezone.utc)
            updated = (
                db.query(NotificationRecord)
                .filter(NotificationRecord.read_at == None)
                .update({NotificationRecord.read_at: now})
            )
            db.commit()
            return updated

    def get_unread_count(self) -> int:
        """Return count of unread notifications."""
        with SessionLocal() as db:
            return db.query(NotificationRecord).filter(NotificationRecord.read_at == None).count()


notification_service = NotificationService()
