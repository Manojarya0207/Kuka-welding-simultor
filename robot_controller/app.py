"""
Entry point for KUKA Industrial Robot Controller desktop application (PySide6).
"""

import logging
import os
import sys

# Ensure root robot_controller directory is in sys.path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from PySide6.QtWidgets import QApplication
from PySide6.QtCore import Qt

from gui.main_window import MainWindow
from api_client import RobotApiClient

# Configure industrial standard logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [%(name)s] %(message)s",
    datefmt="%H:%M:%S"
)
logger = logging.getLogger("KUKA.App")


def main():
    logger.info("Initializing KUKA Industrial Robot Controller GUI...")

    # High DPI scaling attributes for crisp display on macOS retina and 4K screens
    QApplication.setHighDpiScaleFactorRoundingPolicy(
        Qt.HighDpiScaleFactorRoundingPolicy.PassThrough
    )

    app = QApplication(sys.argv)
    app.setApplicationName("KUKA Robot Controller")
    app.setOrganizationName("KUKA Robotics")

    client = RobotApiClient()
    window = MainWindow(api_client=client)
    window.show()

    logger.info("KUKA Robot Controller GUI running.")
    sys.exit(app.exec())


if __name__ == "__main__":
    main()
