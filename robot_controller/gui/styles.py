"""
Industrial KUKA Light / White Theme Styling and Qt Style Sheets (QSS) for PySide6 GUI.
"""

KUKA_ORANGE = "#ea580c"
KUKA_ORANGE_HOVER = "#c2410c"
KUKA_ORANGE_ACTIVE = "#9a3412"

BG_DARK = "#f8fafc"       # Soft off-white main window background
BG_PANEL = "#ffffff"      # Pure white group boxes and panels
BG_CARD = "#ffffff"       # Pure white cards
BG_INPUT = "#ffffff"      # Clean white input fields

BORDER_COLOR = "#e2e8f0"  # Subtle slate border
BORDER_FOCUS = "#ea580c"  # Focus border

TEXT_PRIMARY = "#0f172a"   # Deep high-contrast dark slate
TEXT_SECONDARY = "#334155" # Medium slate
TEXT_MUTED = "#64748b"     # Muted slate

COLOR_SUCCESS = "#059669"
COLOR_DANGER = "#dc2626"
COLOR_WARNING = "#d97706"
COLOR_INFO = "#0284c7"

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
    background-color: #ffffff;
    color: {TEXT_PRIMARY};
    border: 1px solid {BORDER_COLOR};
    padding: 6px 10px;
    border-radius: 6px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.08);
}}

/* Panels and Group Boxes */
QGroupBox {{
    background-color: {BG_PANEL};
    border: 1px solid {BORDER_COLOR};
    border-radius: 10px;
    margin-top: 20px;
    padding: 20px 14px 14px 14px;
    font-weight: 800;
    font-size: 13px;
    letter-spacing: 0.5px;
    color: {TEXT_PRIMARY};
}}

QGroupBox::title {{
    subcontrol-origin: margin;
    subcontrol-position: top left;
    left: 16px;
    top: 4px;
    padding: 2px 10px;
    background-color: #ffffff;
    color: {KUKA_ORANGE};
    border: 1px solid {BORDER_COLOR};
    border-radius: 4px;
}}

/* Sliders */
QSlider::groove:horizontal {{
    border: none;
    height: 6px;
    background: #e2e8f0;
    border-radius: 3px;
}}

QSlider::sub-page:horizontal {{
    background: {KUKA_ORANGE};
    border-radius: 3px;
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
    background: #fff7ed;
    border: 2px solid {KUKA_ORANGE_HOVER};
}}

/* SpinBoxes */
QDoubleSpinBox {{
    background-color: #ffffff;
    border: 1px solid {BORDER_COLOR};
    border-radius: 6px;
    padding: 5px 8px;
    font-family: "JetBrains Mono", "SF Mono", "Menlo", "Consolas", monospace;
    font-size: 13px;
    font-weight: 700;
    color: #0284c7;
    selection-background-color: {KUKA_ORANGE};
}}

QDoubleSpinBox:focus {{
    border: 1px solid {BORDER_FOCUS};
    background-color: #ffffff;
}}

QDoubleSpinBox::up-button, QDoubleSpinBox::down-button {{
    background-color: #f1f5f9;
    border: none;
    width: 18px;
    border-radius: 2px;
}}

QDoubleSpinBox::up-button:hover, QDoubleSpinBox::down-button:hover {{
    background-color: #e2e8f0;
}}

/* Buttons */
QPushButton {{
    background-color: #ffffff;
    color: {TEXT_PRIMARY};
    border: 1px solid {BORDER_COLOR};
    border-radius: 6px;
    padding: 8px 16px;
    font-weight: 700;
    font-size: 12px;
    letter-spacing: 0.5px;
}}

QPushButton:hover {{
    background-color: #f8fafc;
    border-color: #cbd5e1;
}}

QPushButton:pressed {{
    background-color: #f1f5f9;
}}

QPushButton:disabled {{
    background-color: #f8fafc;
    color: {TEXT_MUTED};
    border-color: #e2e8f0;
}}

/* Primary Send Button */
QPushButton#btnSendPrimary {{
    background-color: {KUKA_ORANGE};
    color: #ffffff;
    border: none;
    font-size: 13px;
    font-weight: 800;
    padding: 10px 20px;
    border-radius: 6px;
}}

QPushButton#btnSendPrimary:hover {{
    background-color: {KUKA_ORANGE_HOVER};
}}

QPushButton#btnSendPrimary:pressed {{
    background-color: {KUKA_ORANGE_ACTIVE};
}}

/* Action Connect Button */
QPushButton#btnConnect {{
    background-color: #ecfdf5;
    color: #065f46;
    border: 1px solid #a7f3d0;
}}

QPushButton#btnConnect:hover {{
    background-color: #d1fae5;
}}

QPushButton#btnDisconnect {{
    background-color: #fef2f2;
    color: #991b1b;
    border: 1px solid #fecaca;
}}

QPushButton#btnDisconnect:hover {{
    background-color: #fee2e2;
}}

/* Stream Toggle Button */
QPushButton#btnStreamActive {{
    background-color: #eff6ff;
    color: #1d4ed8;
    border: 1px solid #bfdbfe;
    font-weight: 700;
}}

/* Scroll Areas */
QScrollArea {{
    border: none;
    background-color: transparent;
}}
"""
