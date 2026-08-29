"""
Industrial KUKA dark theme styling and Qt Style Sheets (QSS) for PySide6 GUI.
"""

KUKA_ORANGE = "#ff5500"
KUKA_ORANGE_HOVER = "#ff6e26"
KUKA_ORANGE_ACTIVE = "#d94800"

BG_DARK = "#0b0f19"
BG_PANEL = "#131b2e"
BG_CARD = "#1a243b"
BG_INPUT = "#0d1322"

BORDER_COLOR = "#2a3754"
BORDER_FOCUS = "#ff5500"

TEXT_PRIMARY = "#f8fafc"
TEXT_SECONDARY = "#94a3b8"
TEXT_MUTED = "#64748b"

COLOR_SUCCESS = "#22c55e"
COLOR_DANGER = "#ef4444"
COLOR_WARNING = "#f59e0b"
COLOR_INFO = "#38bdf8"

MAIN_STYLESHEET = f"""
QMainWindow {{
    background-color: {BG_DARK};
    color: {TEXT_PRIMARY};
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}}

QWidget {{
    color: {TEXT_PRIMARY};
    font-size: 13px;
}}

QToolTip {{
    background-color: {BG_CARD};
    color: {TEXT_PRIMARY};
    border: 1px solid {BORDER_COLOR};
    padding: 4px 8px;
    border-radius: 4px;
}}

/* Panels and Group Boxes */
QGroupBox {{
    background-color: {BG_PANEL};
    border: 1px solid {BORDER_COLOR};
    border-radius: 8px;
    margin-top: 18px;
    padding: 16px 12px 12px 12px;
    font-weight: 700;
    font-size: 13px;
    letter-spacing: 0.5px;
    color: {TEXT_PRIMARY};
}}

QGroupBox::title {{
    subcontrol-origin: margin;
    subcontrol-position: top left;
    left: 14px;
    top: 2px;
    padding: 0 8px;
    background-color: {BG_PANEL};
    color: {KUKA_ORANGE};
    border-radius: 3px;
}}

/* Sliders */
QSlider::groove:horizontal {{
    border: 1px solid {BORDER_COLOR};
    height: 8px;
    background: {BG_INPUT};
    border-radius: 4px;
}}

QSlider::sub-page:horizontal {{
    background: qlineargradient(x1:0, y1:0, x2:1, y2:0, stop:0 {KUKA_ORANGE_ACTIVE}, stop:1 {KUKA_ORANGE});
    border-radius: 4px;
}}

QSlider::handle:horizontal {{
    background: #ffffff;
    border: 2px solid {KUKA_ORANGE};
    width: 18px;
    height: 18px;
    margin-top: -6px;
    margin-bottom: -6px;
    border-radius: 9px;
}}

QSlider::handle:horizontal:hover {{
    background: #fff3ed;
    border: 2px solid {KUKA_ORANGE_HOVER};
    transform: scale(1.1);
}}

/* SpinBoxes */
QDoubleSpinBox {{
    background-color: {BG_INPUT};
    border: 1px solid {BORDER_COLOR};
    border-radius: 6px;
    padding: 5px 8px;
    font-family: "SF Mono", "Menlo", "Consolas", monospace;
    font-size: 13px;
    font-weight: 600;
    color: #38bdf8;
    selection-background-color: {KUKA_ORANGE};
}}

QDoubleSpinBox:focus {{
    border: 1px solid {BORDER_FOCUS};
    background-color: #101827;
}}

QDoubleSpinBox::up-button, QDoubleSpinBox::down-button {{
    background-color: {BG_CARD};
    border: none;
    width: 18px;
    border-radius: 3px;
}}

QDoubleSpinBox::up-button:hover, QDoubleSpinBox::down-button:hover {{
    background-color: {BORDER_COLOR};
}}

/* Buttons */
QPushButton {{
    background-color: {BG_CARD};
    color: {TEXT_PRIMARY};
    border: 1px solid {BORDER_COLOR};
    border-radius: 6px;
    padding: 8px 16px;
    font-weight: 600;
    font-size: 12px;
    letter-spacing: 0.5px;
}}

QPushButton:hover {{
    background-color: #243252;
    border-color: #3b4e75;
}}

QPushButton:pressed {{
    background-color: #1a253d;
}}

QPushButton:disabled {{
    background-color: #161e2e;
    color: {TEXT_MUTED};
    border-color: #1e293b;
}}

/* Primary Send Button */
QPushButton#btnSendPrimary {{
    background-color: {KUKA_ORANGE};
    color: #ffffff;
    border: 1px solid #ff772e;
    font-size: 13px;
    font-weight: 700;
    padding: 10px 20px;
    border-radius: 6px;
}}

QPushButton#btnSendPrimary:hover {{
    background-color: {KUKA_ORANGE_HOVER};
    border-color: #ffa16b;
}}

QPushButton#btnSendPrimary:pressed {{
    background-color: {KUKA_ORANGE_ACTIVE};
}}

/* Action Connect Button */
QPushButton#btnConnect {{
    background-color: #065f46;
    color: #a7f3d0;
    border: 1px solid #059669;
}}

QPushButton#btnConnect:hover {{
    background-color: #047857;
}}

QPushButton#btnDisconnect {{
    background-color: #7f1d1d;
    color: #fecaca;
    border: 1px solid #dc2626;
}}

QPushButton#btnDisconnect:hover {{
    background-color: #991b1b;
}}

/* Stream Toggle Button */
QPushButton#btnStreamActive {{
    background-color: #9a3412;
    color: #ffedd5;
    border: 1px solid #ea580c;
    font-weight: 700;
}}

/* Scroll Areas */
QScrollArea {{
    border: none;
    background-color: transparent;
}}
"""
