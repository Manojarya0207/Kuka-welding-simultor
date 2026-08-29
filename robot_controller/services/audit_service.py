"""
Audit Logging Service.
Implements PRD Section 43 for compliance, security, and accountability.
"""

from datetime import datetime, timezone
import json
import logging
from typing import Any, Dict, Optional
from database.models import AuditLog
from database.session import SessionLocal

logger = logging.getLogger("KUKA.AuditService")


class AuditService:
    """Records audit logs into persistent storage."""

    @staticmethod
    def log_action(
        action: str,
        resource_type: str,
        resource_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        user_id: str = "operator-1",
        ip_address: str = "127.0.0.1"
    ):
        try:
            with SessionLocal() as db:
                audit = AuditLog(
                    user_id=user_id,
                    action=action,
                    resource_type=resource_type,
                    resource_id=resource_id,
                    details=json.dumps(details or {}),
                    timestamp=datetime.now(timezone.utc),
                    ip_address=ip_address,
                )
                db.add(audit)
                db.commit()
            logger.info("[AUDIT] Action: %s | Resource: %s/%s | User: %s", action, resource_type, resource_id, user_id)
        except Exception as err:
            logger.error("Failed to write audit log: %s", err)


audit_service = AuditService()
