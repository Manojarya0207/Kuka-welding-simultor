"""
Unit tests for command validator, command service, and notifications.
"""

import asyncio
import unittest
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.session import init_db
from safety.validator import validator
from services.command_service import command_service
from services.notification_service import notification_service


class TestCommandSystem(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        init_db()

    def test_preflight_validation_limits(self):
        """Axis within and outside hardware limits"""
        # Axis 1 limit is [-185, 185]
        valid_joints = {"a1": 30.0, "a2": -20.0, "a3": 40.0, "a4": 10.0, "a5": 60.0, "a6": -90.0}
        ok, err = validator.validate_command(valid_joints, "connected", "LIVE")
        self.assertTrue(ok)
        self.assertEqual(err, "")

        # Axis 1 exceeding limit (200 deg)
        invalid_joints = {"a1": 200.0}
        ok_bad, err_bad = validator.validate_command(invalid_joints, "connected", "LIVE")
        self.assertFalse(ok_bad)
        self.assertIn("outside limits", err_bad)

    def test_notification_deduplication(self):
        """Notification deduplication cache"""
        async def run_notif():
            n1 = await notification_service.emit_notification(
                "COMMAND_COMPLETED", "SUCCESS", "Done", "Completed successfully",
                "KUKA-01", "CMD-DEDUP-001"
            )
            self.assertIsNotNone(n1)

            # Second emission of same event for same command must return None (dropped)
            n2 = await notification_service.emit_notification(
                "COMMAND_COMPLETED", "SUCCESS", "Done", "Completed successfully",
                "KUKA-01", "CMD-DEDUP-001"
            )
            self.assertIsNone(n2)

        asyncio.run(run_notif())


if __name__ == "__main__":
    unittest.main()
