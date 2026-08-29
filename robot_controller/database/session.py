"""
Database engine and session management for KUKA robot controller.
Uses SQLite for persistent storage without requiring external daemons.
"""

import os
from contextlib import contextmanager
from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

from database.models import Base, Robot

DB_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(DB_DIR, "kuka_robot.db")
DATABASE_URL = f"sqlite:///{DB_PATH}"

# Connect args needed for SQLite concurrency with threads
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db():
    """Create all tables and seed default KUKA-01 robot."""
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        robot = db.query(Robot).filter(Robot.id == "KUKA-01").first()
        if not robot:
            robot = Robot(
                id="KUKA-01",
                name="KUKA KR C5",
                model="KR CYBERTECH nano",
                status="connected",
                mode="LIVE",
                ip_address="127.0.0.1",
                port=59152,
            )
            db.add(robot)
            db.commit()


def get_db() -> Generator[Session, None, None]:
    """FastAPI Dependency for database sessions."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def db_session() -> Generator[Session, None, None]:
    """Context manager for services outside request handlers."""
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
