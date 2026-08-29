"""
SQLAlchemy ORM models for KUKA Robot Controller.
Implements schema defined in PRD Sections 31, 39, 40, 41, 42, 43.
"""

from datetime import datetime, timezone
import json
from typing import Any, Dict, Optional
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey, Index
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Robot(Base):
    """Registered industrial robot units."""
    __tablename__ = "robots"

    id = Column(String(50), primary_key=True)  # e.g. "KUKA-01"
    name = Column(String(100), nullable=False, default="KUKA KR C5")
    model = Column(String(100), default="KR CYBERTECH nano")
    status = Column(String(50), default="connected")  # connected, disconnected, error
    mode = Column(String(20), default="LIVE")  # LIVE, SIMULATION
    ip_address = Column(String(50), default="127.0.0.1")
    port = Column(Integer, default=59152)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    commands = relationship("RobotCommand", back_populates="robot", cascade="all, delete-orphan")
    notifications = relationship("NotificationRecord", back_populates="robot", cascade="all, delete-orphan")
    states = relationship("RobotStateRecord", back_populates="robot", cascade="all, delete-orphan")


class RobotCommand(Base):
    """
    Lifecycle tracking for commands submitted to robots.
    Matches PRD Section 40.
    """
    __tablename__ = "robot_commands"

    id = Column(Integer, primary_key=True, autoincrement=True)
    command_id = Column(String(50), unique=True, nullable=False, index=True)  # CMD-YYYYMMDD-XXXXXX
    robot_id = Column(String(50), ForeignKey("robots.id"), nullable=False, index=True)
    user_id = Column(String(50), default="operator-1")
    command_type = Column(String(50), default="MOVE_JOINT")
    mode = Column(String(20), default="LIVE")  # LIVE, SIMULATION
    target_joints = Column(Text, nullable=False)  # JSON string: {"a1": 30.0, ...}
    actual_joints = Column(Text, nullable=True)   # JSON string: final reached positions
    status = Column(String(50), nullable=False, default="QUEUED", index=True)
    # Status values: QUEUED, VALIDATING, VALIDATED, SENT_TO_ROBOT, MOVING, TARGET_REACHED, COMPLETED, FAILED, TIMEOUT, STOPPED, REJECTED
    error_code = Column(String(50), nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utcnow, index=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    failed_at = Column(DateTime, nullable=True)

    robot = relationship("Robot", back_populates="commands")
    events = relationship("CommandEvent", back_populates="command", cascade="all, delete-orphan")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "command_id": self.command_id,
            "robot_id": self.robot_id,
            "user_id": self.user_id,
            "command_type": self.command_type,
            "mode": self.mode,
            "target_joints": json.loads(self.target_joints) if self.target_joints else {},
            "actual_joints": json.loads(self.actual_joints) if self.actual_joints else None,
            "status": self.status,
            "error_code": self.error_code,
            "error_message": self.error_message,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "failed_at": self.failed_at.isoformat() if self.failed_at else None,
            "duration": (
                round((self.completed_at - self.started_at).total_seconds(), 2)
                if (self.completed_at and self.started_at)
                else None
            ),
        }


class CommandEvent(Base):
    """
    Immutable audit trail for each step in a command lifecycle.
    Matches PRD Section 41.
    """
    __tablename__ = "command_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    event_id = Column(String(50), unique=True, nullable=False, index=True)
    command_id = Column(String(50), ForeignKey("robot_commands.command_id"), nullable=False, index=True)
    robot_id = Column(String(50), nullable=True)
    event_type = Column(String(50), nullable=False)
    timestamp = Column(DateTime, default=utcnow, index=True)
    payload = Column(Text, nullable=True)  # JSON string

    command = relationship("RobotCommand", back_populates="events")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "event_id": self.event_id,
            "command_id": self.command_id,
            "robot_id": self.robot_id,
            "event_type": self.event_type,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "payload": json.loads(self.payload) if self.payload else {},
        }


class RobotStateRecord(Base):
    """
    Periodic/edge snapshots of actual robot kinematics and status.
    Matches PRD Section 42.
    """
    __tablename__ = "robot_states"

    id = Column(Integer, primary_key=True, autoincrement=True)
    robot_id = Column(String(50), ForeignKey("robots.id"), nullable=False, index=True)
    timestamp = Column(DateTime, default=utcnow, index=True)
    status = Column(String(50), default="IDLE")  # IDLE, MOVING, ERROR
    motion_state = Column(String(50), default="READY")  # READY, MOVING, MOTION_COMPLETE, STOPPED
    a1 = Column(Float, nullable=False)
    a2 = Column(Float, nullable=False)
    a3 = Column(Float, nullable=False)
    a4 = Column(Float, nullable=False)
    a5 = Column(Float, nullable=False)
    a6 = Column(Float, nullable=False)

    robot = relationship("Robot", back_populates="states")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "robot_id": self.robot_id,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "status": self.status,
            "motion_state": self.motion_state,
            "joints": {
                "a1": round(self.a1, 2),
                "a2": round(self.a2, 2),
                "a3": round(self.a3, 2),
                "a4": round(self.a4, 2),
                "a5": round(self.a5, 2),
                "a6": round(self.a6, 2),
            },
        }


class NotificationRecord(Base):
    """
    System notifications for operators and digital twin simulator.
    Matches PRD Section 31.
    """
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, autoincrement=True)
    event_id = Column(String(50), unique=True, nullable=False, index=True)
    robot_id = Column(String(50), ForeignKey("robots.id"), nullable=False, index=True)
    command_id = Column(String(50), nullable=True, index=True)
    user_id = Column(String(50), default="operator-1")
    type = Column(String(50), nullable=False)  # COMMAND_COMPLETED, ROBOT_MOVING, etc.
    severity = Column(String(20), nullable=False, default="INFO")  # INFO, SUCCESS, WARNING, ERROR, CRITICAL
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    created_at = Column(DateTime, default=utcnow, index=True)
    read_at = Column(DateTime, nullable=True, index=True)
    metadata_json = Column(Text, nullable=True)

    robot = relationship("Robot", back_populates="notifications")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "event_id": self.event_id,
            "robot_id": self.robot_id,
            "command_id": self.command_id,
            "user_id": self.user_id,
            "type": self.type,
            "severity": self.severity,
            "title": self.title,
            "message": self.message,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "read": self.read_at is not None,
            "read_at": self.read_at.isoformat() if self.read_at else None,
            "metadata": json.loads(self.metadata_json) if self.metadata_json else {},
        }


class AuditLog(Base):
    """
    Compliance and security audit logs.
    Matches PRD Section 43.
    """
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(50), default="operator-1", index=True)
    action = Column(String(100), nullable=False, index=True)
    resource_type = Column(String(50), nullable=False)
    resource_id = Column(String(100), nullable=True)
    details = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=utcnow, index=True)
    ip_address = Column(String(50), default="127.0.0.1")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "user_id": self.user_id,
            "action": self.action,
            "resource_type": self.resource_type,
            "resource_id": self.resource_id,
            "details": json.loads(self.details) if self.details else {},
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "ip_address": self.ip_address,
        }
