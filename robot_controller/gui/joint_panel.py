"""
Reusable 6-Axis Joint Panel Row Widget for PySide6 KUKA GUI.
Synchronizes QSlider and QDoubleSpinBox with configurable limits and 0.1° resolution.
"""

from PySide6.QtCore import Qt, Signal
from PySide6.QtWidgets import (
    QWidget, QHBoxLayout, QVBoxLayout, QLabel, QSlider, QDoubleSpinBox, QFrame
)


class JointAxisRow(QFrame):
    """
    A single axis control row displaying:
    - Axis ID badge (A1 - A6)
    - Min Limit label
    - Synchronized Horizontal Slider
    - Max Limit label
    - Precise QDoubleSpinBox numeric input
    - Formatted current angle readout
    """

    valueChanged = Signal(str, float)  # axis_id, new_value

    def __init__(
        self,
        axis_id: str,
        label: str,
        min_val: float,
        max_val: float,
        default_val: float,
        parent=None
    ):
        super().__init__(parent)
        self.axis_id = axis_id.lower()
        self.display_label = label
        self.min_val = float(min_val)
        self.max_val = float(max_val)
        self.multiplier = 10  # 10 steps per degree = 0.1 degree resolution
        self._updating = False

        self.setObjectName("jointRowFrame")
        self.setStyleSheet("""
            QFrame#jointRowFrame {
                background-color: #151e33;
                border: 1px solid #25334d;
                border-radius: 8px;
                padding: 6px 12px;
                margin-bottom: 6px;
            }
            QFrame#jointRowFrame:hover {
                border-color: #3b4e75;
                background-color: #18233b;
            }
        """)

        self._init_ui(default_val)

    def _init_ui(self, default_val: float):
        layout = QHBoxLayout(self)
        layout.setContentsMargins(8, 6, 8, 6)
        layout.setSpacing(12)

        # 1. Axis Label Badge
        self.lbl_axis = QLabel(self.display_label)
        self.lbl_axis.setFixedWidth(42)
        self.lbl_axis.setStyleSheet("""
            QLabel {
                color: #ff5500;
                font-family: "SF Mono", "Menlo", "Consolas", monospace;
                font-size: 15px;
                font-weight: 800;
                background-color: #241410;
                border: 1px solid #7c2d12;
                border-radius: 4px;
                padding: 4px;
                qproperty-alignment: AlignCenter;
            }
        """)
        layout.addWidget(self.lbl_axis)

        # 2. Min Limit Label
        self.lbl_min = QLabel(f"{int(self.min_val)}°")
        self.lbl_min.setFixedWidth(45)
        self.lbl_min.setStyleSheet("color: #64748b; font-size: 11px; font-weight: 600; qproperty-alignment: AlignRight;")
        layout.addWidget(self.lbl_min)

        # 3. Slider (Scaled by 10 for 0.1° resolution)
        self.slider = QSlider(Qt.Orientation.Horizontal)
        self.slider.setMinimum(int(self.min_val * self.multiplier))
        self.slider.setMaximum(int(self.max_val * self.multiplier))
        self.slider.setSingleStep(1)
        self.slider.setPageStep(10)
        self.slider.setValue(int(default_val * self.multiplier))
        self.slider.valueChanged.connect(self._on_slider_changed)
        layout.addWidget(self.slider, stretch=1)

        # 4. Max Limit Label
        self.lbl_max = QLabel(f"{int(self.max_val)}°")
        self.lbl_max.setFixedWidth(45)
        self.lbl_max.setStyleSheet("color: #64748b; font-size: 11px; font-weight: 600; qproperty-alignment: AlignLeft;")
        layout.addWidget(self.lbl_max)

        # 5. SpinBox for Direct Numeric Entry
        self.spinbox = QDoubleSpinBox()
        self.spinbox.setRange(self.min_val, self.max_val)
        self.spinbox.setDecimals(1)
        self.spinbox.setSingleStep(0.5)
        self.spinbox.setSuffix("°")
        self.spinbox.setFixedWidth(90)
        self.spinbox.setValue(default_val)
        self.spinbox.valueChanged.connect(self._on_spinbox_changed)
        layout.addWidget(self.spinbox)

        # 6. Current Readout Badge
        self.lbl_current = QLabel(f"{default_val:.1f}°")
        self.lbl_current.setFixedWidth(70)
        self.lbl_current.setStyleSheet("""
            QLabel {
                color: #38bdf8;
                font-family: "SF Mono", "Menlo", monospace;
                font-size: 13px;
                font-weight: 700;
                background-color: #0b1528;
                border: 1px solid #1e3a5f;
                border-radius: 4px;
                padding: 4px 6px;
                qproperty-alignment: AlignCenter;
            }
        """)
        layout.addWidget(self.lbl_current)

    def _on_slider_changed(self, raw_val: int):
        if self._updating:
            return
        self._updating = True
        val = raw_val / self.multiplier
        self.spinbox.setValue(val)
        self.lbl_current.setText(f"{val:.1f}°")
        self._updating = False
        self.valueChanged.emit(self.axis_id, val)

    def _on_spinbox_changed(self, val: float):
        if self._updating:
            return
        self._updating = True
        raw_val = int(val * self.multiplier)
        self.slider.setValue(raw_val)
        self.lbl_current.setText(f"{val:.1f}°")
        self._updating = False
        self.valueChanged.emit(self.axis_id, val)

    def get_value(self) -> float:
        """Return current axis angle in degrees."""
        return round(self.spinbox.value(), 1)

    def set_value(self, val: float):
        """Set axis angle safely within limits without triggering recursive signals."""
        clamped = max(self.min_val, min(self.max_val, val))
        self._updating = True
        self.spinbox.setValue(clamped)
        self.slider.setValue(int(clamped * self.multiplier))
        self.lbl_current.setText(f"{clamped:.1f}°")
        self._updating = False
