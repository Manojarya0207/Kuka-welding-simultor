"""
Main Window for KUKA Robot Controller desktop interface (PySide6).
Industrial standard KUKA HMI with 6-axis joint control, real-time telemetry streaming, and status monitoring.
"""

import logging
import math
import random
import time
from typing import Dict

from PySide6.QtCore import Qt, QTimer, QThread, Signal, Slot
from PySide6.QtGui import QFont, QColor
from PySide6.QtWidgets import (
    QMainWindow, QWidget, QVBoxLayout, QHBoxLayout, QLabel,
    QPushButton, QGroupBox, QFrame, QScrollArea, QSizePolicy, QMessageBox
)

from config import (
    JOINT_LIMITS, DEFAULT_JOINTS, FASTAPI_URL, STREAM_INTERVAL
)
from models import JointState
from api_client import RobotApiClient
from gui.styles import (
    MAIN_STYLESHEET, KUKA_ORANGE, COLOR_SUCCESS, COLOR_DANGER,
    COLOR_WARNING, COLOR_INFO, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED
)
from gui.joint_panel import JointAxisRow

logger = logging.getLogger("KUKA.GUI")


class MainWindow(QMainWindow):
    """KUKA Industrial Robot Control Panel Main Window."""

    def __init__(self, api_client: RobotApiClient = None):
        super().__init__()
        self.api_client = api_client or RobotApiClient()
        self.is_connected = False
        self.is_streaming = False
        self.stream_packets_count = 0
        self.stream_phase = 0.0

        self.joint_rows: Dict[str, JointAxisRow] = {}
        self.last_sent_joints: Dict[str, float] = dict(DEFAULT_JOINTS)

        # Stream Simulation Timer
        self.stream_timer = QTimer(self)
        self.stream_timer.setInterval(int(STREAM_INTERVAL * 1000))
        self.stream_timer.timeout.connect(self._on_stream_tick)

        # Connection Polling Timer
        self.poll_timer = QTimer(self)
        self.poll_timer.setInterval(3000)
        self.poll_timer.timeout.connect(self._check_server_connection)

        self._init_window()
        self._build_ui()
        self._check_server_connection()
        self.poll_timer.start()

    def _init_window(self):
        self.setWindowTitle("KUKA Industrial Robot Controller")
        self.setMinimumSize(860, 820)
        self.setStyleSheet(MAIN_STYLESHEET)

    def _build_ui(self):
        central = QWidget()
        self.setCentralWidget(central)
        root_layout = QVBoxLayout(central)
        root_layout.setContentsMargins(20, 16, 20, 20)
        root_layout.setSpacing(14)

        # ======================================================================
        # 1. TOP INDUSTRIAL HEADER
        # ======================================================================
        header_frame = QFrame()
        header_frame.setStyleSheet("""
            QFrame {
                background-color: #ffffff;
                border: 1px solid #e2e8f0;
                border-radius: 8px;
                padding: 10px 16px;
            }
        """)
        header_layout = QHBoxLayout(header_frame)
        header_layout.setContentsMargins(8, 6, 8, 6)

        # Brand Icon + Title
        brand_box = QHBoxLayout()
        brand_box.setSpacing(12)

        lbl_kuka_icon = QLabel("K")
        lbl_kuka_icon.setFixedSize(36, 36)
        lbl_kuka_icon.setStyleSheet(f"""
            QLabel {{
                background-color: {KUKA_ORANGE};
                color: #ffffff;
                font-family: "Arial Black", sans-serif;
                font-size: 22px;
                font-weight: 900;
                border-radius: 6px;
                qproperty-alignment: AlignCenter;
            }}
        """)
        brand_box.addWidget(lbl_kuka_icon)

        title_vbox = QVBoxLayout()
        title_vbox.setSpacing(2)
        lbl_main_title = QLabel("KUKA ROBOT CONTROLLER")
        lbl_main_title.setStyleSheet("""
            QLabel {
                color: #0f172a;
                font-size: 17px;
                font-weight: 800;
                letter-spacing: 1.5px;
            }
        """)
        lbl_sub_title = QLabel("6-AXIS CYBER-PHYSICAL INTERFACE | CLIENT APPLICATION SIMULATOR")
        lbl_sub_title.setStyleSheet(f"color: {TEXT_MUTED}; font-size: 11px; font-weight: 600; letter-spacing: 0.5px;")
        title_vbox.addWidget(lbl_main_title)
        title_vbox.addWidget(lbl_sub_title)
        brand_box.addLayout(title_vbox)

        header_layout.addLayout(brand_box)
        header_layout.addStretch(1)

        # Top Connection Actions
        self.btn_connect = QPushButton("CONNECT")
        self.btn_connect.setObjectName("btnConnect")
        self.btn_connect.setFixedWidth(110)
        self.btn_connect.clicked.connect(self._on_connect_clicked)
        header_layout.addWidget(self.btn_connect)

        self.btn_disconnect = QPushButton("DISCONNECT")
        self.btn_disconnect.setObjectName("btnDisconnect")
        self.btn_disconnect.setFixedWidth(110)
        self.btn_disconnect.setEnabled(False)
        self.btn_disconnect.clicked.connect(self._on_disconnect_clicked)
        header_layout.addWidget(self.btn_disconnect)

        root_layout.addWidget(header_frame)

        # ======================================================================
        # 2. STATUS & TELEMETRY STRIP
        # ======================================================================
        status_bar = QHBoxLayout()
        status_bar.setSpacing(12)

        # Connection Status LED
        self.conn_frame = QFrame()
        self.conn_frame.setStyleSheet("""
            QFrame {
                background-color: #ffffff;
                border: 1px solid #e2e8f0;
                border-radius: 6px;
                padding: 6px 12px;
            }
        """)
        conn_lay = QHBoxLayout(self.conn_frame)
        conn_lay.setContentsMargins(6, 4, 6, 4)
        self.lbl_conn_title = QLabel("Connection Status:")
        self.lbl_conn_title.setStyleSheet(f"color: {TEXT_SECONDARY}; font-weight: 600; font-size: 12px;")
        self.lbl_conn_status = QLabel("[DISCONNECTED]")
        self.lbl_conn_status.setStyleSheet(f"color: {COLOR_DANGER}; font-weight: 800; font-size: 12px;")
        conn_lay.addWidget(self.lbl_conn_title)
        conn_lay.addWidget(self.lbl_conn_status)
        status_bar.addWidget(self.conn_frame)

        # Simulator Status LED
        self.sim_frame = QFrame()
        self.sim_frame.setStyleSheet("""
            QFrame {
                background-color: #ffffff;
                border: 1px solid #e2e8f0;
                border-radius: 6px;
                padding: 6px 12px;
            }
        """)
        sim_lay = QHBoxLayout(self.sim_frame)
        sim_lay.setContentsMargins(6, 4, 6, 4)
        self.lbl_sim_title = QLabel("Simulator Status:")
        self.lbl_sim_title.setStyleSheet(f"color: {TEXT_SECONDARY}; font-weight: 600; font-size: 12px;")
        self.lbl_sim_status = QLabel("[WAITING FOR DATA]")
        self.lbl_sim_status.setStyleSheet(f"color: {COLOR_WARNING}; font-weight: 800; font-size: 12px;")
        sim_lay.addWidget(self.lbl_sim_title)
        sim_lay.addWidget(self.lbl_sim_status)
        status_bar.addWidget(self.sim_frame)

        # Streaming Status & Packet Counter
        self.stream_frame = QFrame()
        self.stream_frame.setStyleSheet("""
            QFrame {
                background-color: #ffffff;
                border: 1px solid #e2e8f0;
                border-radius: 6px;
                padding: 6px 12px;
            }
        """)
        stream_lay = QHBoxLayout(self.stream_frame)
        stream_lay.setContentsMargins(6, 4, 6, 4)
        self.lbl_stream_indicator = QLabel("STREAM IDLE")
        self.lbl_stream_indicator.setStyleSheet(f"color: {TEXT_MUTED}; font-weight: 700; font-size: 12px;")
        self.lbl_packet_counter = QLabel("Packets Sent: 0")
        self.lbl_packet_counter.setStyleSheet("color: #0284c7; font-family: monospace; font-weight: 700;")
        stream_lay.addWidget(self.lbl_stream_indicator)
        stream_lay.addWidget(self.lbl_packet_counter)
        status_bar.addWidget(self.stream_frame)

        root_layout.addLayout(status_bar)

        # ======================================================================
        # 3. ERROR MESSAGE BANNER
        # ======================================================================
        self.error_banner = QFrame()
        self.error_banner.setVisible(False)
        self.error_banner.setStyleSheet("""
            QFrame {
                background-color: #fef2f2;
                border: 1px solid #fecaca;
                border-radius: 6px;
                padding: 8px 12px;
            }
        """)
        err_lay = QHBoxLayout(self.error_banner)
        err_lay.setContentsMargins(6, 4, 6, 4)
        self.lbl_error_msg = QLabel("")
        self.lbl_error_msg.setStyleSheet("color: #b91c1c; font-weight: 700; font-size: 12px;")
        err_lay.addWidget(self.lbl_error_msg)
        btn_dismiss = QPushButton("[X]")
        btn_dismiss.setFixedSize(24, 24)
        btn_dismiss.setStyleSheet("background: transparent; color: #dc2626; font-weight: bold; border: none;")
        btn_dismiss.clicked.connect(lambda: self.error_banner.setVisible(False))
        err_lay.addWidget(btn_dismiss)
        root_layout.addWidget(self.error_banner)

        # ======================================================================
        # 4. SIX-AXIS JOINT CONTROLS SECTION
        # ======================================================================
        joints_group = QGroupBox("6-AXIS JOINT POSITION CONTROLLER")
        joints_layout = QVBoxLayout(joints_group)
        joints_layout.setContentsMargins(12, 16, 12, 12)
        joints_layout.setSpacing(6)

        axes = [
            ("a1", "A1", JOINT_LIMITS["a1"][0], JOINT_LIMITS["a1"][1], DEFAULT_JOINTS["a1"]),
            ("a2", "A2", JOINT_LIMITS["a2"][0], JOINT_LIMITS["a2"][1], DEFAULT_JOINTS["a2"]),
            ("a3", "A3", JOINT_LIMITS["a3"][0], JOINT_LIMITS["a3"][1], DEFAULT_JOINTS["a3"]),
            ("a4", "A4", JOINT_LIMITS["a4"][0], JOINT_LIMITS["a4"][1], DEFAULT_JOINTS["a4"]),
            ("a5", "A5", JOINT_LIMITS["a5"][0], JOINT_LIMITS["a5"][1], DEFAULT_JOINTS["a5"]),
            ("a6", "A6", JOINT_LIMITS["a6"][0], JOINT_LIMITS["a6"][1], DEFAULT_JOINTS["a6"]),
        ]

        for ax_id, ax_lbl, min_val, max_val, def_val in axes:
            row = JointAxisRow(ax_id, ax_lbl, min_val, max_val, def_val, self)
            row.valueChanged.connect(self._on_joint_changed)
            self.joint_rows[ax_id] = row
            joints_layout.addWidget(row)

        root_layout.addWidget(joints_group)

        # ======================================================================
        # 5. ACTION BUTTONS & STREAMING CONTROLS
        # ======================================================================
        btn_strip = QHBoxLayout()
        btn_strip.setSpacing(10)

        # Send to Simulator (Primary Call-to-Action)
        self.btn_send = QPushButton("SEND TO SIMULATOR")
        self.btn_send.setObjectName("btnSendPrimary")
        self.btn_send.setMinimumHeight(42)
        self.btn_send.clicked.connect(self._on_send_clicked)
        btn_strip.addWidget(self.btn_send, stretch=2)

        # Random Test
        self.btn_random = QPushButton("RANDOM TEST")
        self.btn_random.setMinimumHeight(42)
        self.btn_random.clicked.connect(self._on_random_test_clicked)
        btn_strip.addWidget(self.btn_random, stretch=1)

        # Reset
        self.btn_reset = QPushButton("RESET")
        self.btn_reset.setMinimumHeight(42)
        self.btn_reset.clicked.connect(self._on_reset_clicked)
        btn_strip.addWidget(self.btn_reset, stretch=1)

        # Start / Stop Stream
        self.btn_stream = QPushButton("START STREAM")
        self.btn_stream.setMinimumHeight(42)
        self.btn_stream.setStyleSheet("background-color: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; font-weight: 700;")
        self.btn_stream.clicked.connect(self._toggle_stream)
        btn_strip.addWidget(self.btn_stream, stretch=1)

        root_layout.addLayout(btn_strip)

        # ======================================================================
        # 6. LAST SENT DATA READOUT PANEL
        # ======================================================================
        last_data_group = QGroupBox("LAST TRANSMITTED DATA READOUT")
        last_data_layout = QHBoxLayout(last_data_group)
        last_data_layout.setContentsMargins(12, 14, 12, 12)
        last_data_layout.setSpacing(8)

        self.last_sent_labels: Dict[str, QLabel] = {}
        for ax_id, ax_lbl, _, _, _ in axes:
            card = QFrame()
            card.setStyleSheet("""
                QFrame {
                    background-color: #ffffff;
                    border: 1px solid #e2e8f0;
                    border-radius: 6px;
                    padding: 6px;
                }
            """)
            card_lay = QVBoxLayout(card)
            card_lay.setContentsMargins(4, 4, 4, 4)
            card_lay.setSpacing(2)

            lbl_ax = QLabel(ax_lbl)
            lbl_ax.setStyleSheet(f"color: {KUKA_ORANGE}; font-weight: 800; font-size: 11px; qproperty-alignment: AlignCenter;")
            card_lay.addWidget(lbl_ax)

            lbl_val = QLabel(f"{DEFAULT_JOINTS[ax_id]:.1f}°")
            lbl_val.setStyleSheet("color: #0284c7; font-family: monospace; font-weight: 700; font-size: 13px; qproperty-alignment: AlignCenter;")
            card_lay.addWidget(lbl_val)

            self.last_sent_labels[ax_id] = lbl_val
            last_data_layout.addWidget(card)

        root_layout.addWidget(last_data_group)

    # ==========================================================================
    # LOGIC & EVENT HANDLERS
    # ==========================================================================
    def get_current_joint_dict(self) -> Dict[str, float]:
        """Collect current values from all 6 joint rows."""
        return {ax_id: row.get_value() for ax_id, row in self.joint_rows.items()}

    def _show_error(self, message: str):
        """Display non-blocking error banner."""
        self.lbl_error_msg.setText(f"ERROR: {message}")
        self.error_banner.setVisible(True)
        logger.error("GUI Error: %s", message)

    def _clear_error(self):
        self.error_banner.setVisible(False)

    def _check_server_connection(self):
        """Poll FastAPI backend health."""
        ok, msg = self.api_client.check_health()
        if ok:
            if not self.is_connected:
                self.is_connected = True
                self._update_connection_ui(True)
        else:
            if self.is_connected:
                self.is_connected = False
                self._update_connection_ui(False)

    def _update_connection_ui(self, connected: bool):
        self.is_connected = connected
        if connected:
            self.lbl_conn_status.setText("[CONNECTED]")
            self.lbl_conn_status.setStyleSheet(f"color: {COLOR_SUCCESS}; font-weight: 800; font-size: 12px;")
            self.btn_connect.setEnabled(False)
            self.btn_disconnect.setEnabled(True)
            self._clear_error()
        else:
            self.lbl_conn_status.setText("[DISCONNECTED]")
            self.lbl_conn_status.setStyleSheet(f"color: {COLOR_DANGER}; font-weight: 800; font-size: 12px;")
            self.btn_connect.setEnabled(True)
            self.btn_disconnect.setEnabled(False)

    def _on_connect_clicked(self):
        ok, msg = self.api_client.check_health()
        if ok:
            self._update_connection_ui(True)
            logger.info("Connected to FastAPI backend.")
        else:
            self._update_connection_ui(False)
            self._show_error(f"Unable to connect to simulator ({msg}). Ensure FastAPI is running.")

    def _on_disconnect_clicked(self):
        self._update_connection_ui(False)
        if self.is_streaming:
            self._toggle_stream()
        logger.info("Disconnected from FastAPI backend.")

    def _on_joint_changed(self, axis_id: str, value: float):
        # Simulator status set to pending send
        if self.lbl_sim_status.text() != "[WAITING FOR DATA]" and not self.is_streaming:
            self.lbl_sim_status.setText("[WAITING FOR DATA]")
            self.lbl_sim_status.setStyleSheet(f"color: {COLOR_WARNING}; font-weight: 800; font-size: 12px;")

    def _on_send_clicked(self):
        """Send current values of all 6 axes to FastAPI."""
        joints = self.get_current_joint_dict()
        self._transmit_joints(joints)

    def _transmit_joints(self, joints: Dict[str, float]) -> bool:
        """Internal helper to transmit joints through API client."""
        success, resp, msg = self.api_client.send_joints(joints)
        if success:
            self._clear_error()
            self.last_sent_joints = dict(joints)
            for ax_id, val in joints.items():
                if ax_id in self.last_sent_labels:
                    self.last_sent_labels[ax_id].setText(f"{val:.1f}°")

            self.lbl_sim_status.setText("[DATA SENT]")
            self.lbl_sim_status.setStyleSheet(f"color: {COLOR_SUCCESS}; font-weight: 800; font-size: 12px;")
            return True
        else:
            self.lbl_sim_status.setText("[TRANSMISSION FAILED]")
            self.lbl_sim_status.setStyleSheet(f"color: {COLOR_DANGER}; font-weight: 800; font-size: 12px;")
            self._show_error(msg)
            return False

    def _on_reset_clicked(self):
        """Reset all joint positions to default calibration values."""
        for ax_id, def_val in DEFAULT_JOINTS.items():
            if ax_id in self.joint_rows:
                self.joint_rows[ax_id].set_value(def_val)

        self.lbl_sim_status.setText("[WAITING FOR DATA]")
        self.lbl_sim_status.setStyleSheet(f"color: {COLOR_WARNING}; font-weight: 800; font-size: 12px;")
        logger.info("Reset joint positions to defaults.")

    def _on_random_test_clicked(self):
        """Generate valid random angles within configured limits without immediately transmitting."""
        for ax_id, row in self.joint_rows.items():
            min_lim, max_lim = JOINT_LIMITS[ax_id]
            # Select realistic working sub-range
            span = max_lim - min_lim
            rand_val = min_lim + span * random.random()
            row.set_value(round(rand_val, 1))

        self.lbl_sim_status.setText("[WAITING FOR DATA]")
        self.lbl_sim_status.setStyleSheet(f"color: {COLOR_WARNING}; font-weight: 800; font-size: 12px;")
        logger.info("Generated random test angles.")

    def _toggle_stream(self):
        """Toggle real-time testing data streaming mode."""
        if not self.is_streaming:
            self.is_streaming = True
            self.btn_stream.setText("STOP STREAM")
            self.btn_stream.setStyleSheet("background-color: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; font-weight: 700;")
            self.lbl_stream_indicator.setText("[STREAMING]")
            self.lbl_stream_indicator.setStyleSheet(f"color: {COLOR_SUCCESS}; font-weight: 800; font-size: 12px;")
            self.stream_timer.start()
            logger.info("Started real-time data stream simulation.")
        else:
            self.is_streaming = False
            self.btn_stream.setText("START STREAM")
            self.btn_stream.setStyleSheet("background-color: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; font-weight: 700;")
            self.lbl_stream_indicator.setText("STREAM IDLE")
            self.lbl_stream_indicator.setStyleSheet(f"color: {TEXT_MUTED}; font-weight: 700; font-size: 12px;")
            self.stream_timer.stop()
            logger.info("Stopped real-time data stream simulation.")

    def _on_stream_tick(self):
        """Simulate realistic changing KUKA joint positions during stream mode."""
        if not self.is_streaming:
            return

        self.stream_phase += 0.08
        t = self.stream_phase

        # Generate continuous sinusoidal trajectory around nominal working pose
        stream_pose = {
            "a1": round(25.0 * math.sin(t * 0.7), 1),
            "a2": round(-30.6 + 18.0 * math.sin(t * 0.9), 1),
            "a3": round(29.4 + 22.0 * math.cos(t * 0.8), 1),
            "a4": round(35.0 * math.sin(t * 1.1), 1),
            "a5": round(43.8 + 20.0 * math.sin(t * 0.6), 1),
            "a6": round(-112.5 + 40.0 * math.cos(t * 1.3), 1),
        }

        # Clamp safely within configured JOINT_LIMITS
        clamped_pose = {}
        for ax, val in stream_pose.items():
            min_l, max_l = JOINT_LIMITS[ax]
            clamped_pose[ax] = max(min_l, min(max_l, val))

        # Update GUI Controls
        for ax, val in clamped_pose.items():
            if ax in self.joint_rows:
                self.joint_rows[ax].set_value(val)

        # Transmit via FastAPI
        if self._transmit_joints(clamped_pose):
            self.stream_packets_count += 1
            self.lbl_packet_counter.setText(f"Packets Sent: {self.stream_packets_count}")
