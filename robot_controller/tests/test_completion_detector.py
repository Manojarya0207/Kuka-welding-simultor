"""
Unit tests for CompletionDetector per PRD Section 25, 26, 74.
Tests:
- Tolerance check within ±0.05°
- Failure when exceeding tolerance
- Motion state requirements (IDLE / MOTION_COMPLETE / READY)
- Event deduplication ({command_id}:{event_type})
"""

import unittest
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from robot.completion_detector import CompletionDetector


class TestCompletionDetector(unittest.TestCase):

    def setUp(self):
        self.detector = CompletionDetector()

    def test_target_reached_within_tolerance(self):
        """PRD Section 4: Target 30.00, Actual 29.98, Tolerance 0.05 -> PASS"""
        target = {"a1": 30.00, "a2": -20.00, "a3": 40.00, "a4": 10.00, "a5": 60.00, "a6": -90.00}
        actual = {"a1": 29.98, "a2": -20.01, "a3": 40.00, "a4": 10.00, "a5": 60.01, "a6": -90.00}
        reached, errors, max_err = self.detector.check_target_reached(target, actual, "IDLE")

        self.assertTrue(reached)
        self.assertLessEqual(max_err, 0.05)

    def test_target_not_reached_out_of_tolerance(self):
        """Out of tolerance should fail"""
        target = {"a1": 30.00}
        actual = {"a1": 29.90}  # Error is 0.10 > 0.05
        reached, errors, max_err = self.detector.check_target_reached(target, actual, "IDLE")

        self.assertFalse(reached)
        self.assertGreater(max_err, 0.05)

    def test_motion_state_requirement(self):
        """If robot is MOVING, target is not yet reached even if coordinates match temporarily"""
        target = {"a1": 30.00}
        actual = {"a1": 30.00}
        reached, _, _ = self.detector.check_target_reached(target, actual, "MOVING")
        self.assertFalse(reached)

        reached_idle, _, _ = self.detector.check_target_reached(target, actual, "IDLE")
        self.assertTrue(reached_idle)

    def test_event_deduplication(self):
        """PRD Section 15: Event deduplication drops duplicate completion events"""
        cmd_id = "CMD-TEST-001"
        event_type = "COMMAND_COMPLETED"

        # First attempt should succeed
        first = self.detector.mark_event_processed(cmd_id, event_type)
        self.assertTrue(first)

        # Second attempt with same key must be dropped
        second = self.detector.mark_event_processed(cmd_id, event_type)
        self.assertFalse(second)


if __name__ == "__main__":
    unittest.main()
