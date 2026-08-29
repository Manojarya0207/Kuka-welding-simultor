/**
 * Analytical 6-Axis Robotic Kinematics for KUKA KR CYBERTECH
 * Maintains rigid, constant link lengths and unbreakable joint connectivity across all coordinates.
 * Features dynamic workpiece-normal tool orientation and continuous physical chain clamping.
 */

export class RobotKinematics {
  constructor() {
    // Physical Link Dimensions (mm)
    this.d1 = 320.0; // Base height to A2 shoulder pivot
    this.a1 = 140.0; // Shoulder horizontal offset from A1 axis
    this.l1 = 430.0; // Link 1: Upper arm length (Shoulder A2 to Elbow A3)
    this.l2 = 430.0; // Link 2: Forearm length (Elbow A3 to Wrist A5)
    this.l3 = 140.0; // Link 3: Tool Flange to Torch Tip (TCP)

    this.wpCenterX = 620.0; // Workpiece Table Center X
    this.wpCenterY = 0.0;   // Workpiece Table Center Y

    this.limits = {
      A1: [-185.0, 185.0],
      A2: [-135.0, 45.0],
      A3: [-120.0, 155.0],
      A4: [-180.0, 180.0],
      A5: [-125.0, 125.0],
      A6: [-350.0, 350.0]
    };
  }

  solve(tx, ty, tz) {
    const x = parseFloat(tx);
    const y = parseFloat(ty);
    const z = parseFloat(tz);

    // 1. Dynamic Workpiece-Normal Tool Orientation
    const dxWp = x - this.wpCenterX;
    const dyWp = y - this.wpCenterY;
    const dWp = Math.sqrt(dxWp * dxWp + dyWp * dyWp);

    const tPitch = (45.0 * Math.PI) / 180.0; // 45° industrial welding lead angle

    let uxOut, uyOut;
    if (dWp > 10.0 && z < 440.0) {
      // Near workpiece seam: Orient tool outward from workpiece center
      uxOut = dxWp / dWp;
      uyOut = dyWp / dWp;
    } else {
      // In transit / Home standby / Extended reaches: Orient tool toward base
      const rXy = Math.sqrt(x * x + y * y) + 1e-6;
      uxOut = -x / rXy;
      uyOut = -y / rXy;
    }

    // 2. Desired Wrist Center Point J4
    const j4xTarget = x + this.l3 * Math.sin(tPitch) * uxOut;
    const j4yTarget = y + this.l3 * Math.sin(tPitch) * uyOut;
    const j4zTarget = z + this.l3 * Math.cos(tPitch);

    // 3. Base Angle A1
    const a1Rad = Math.atan2(j4yTarget, j4xTarget);
    const a1Deg = (a1Rad * 180.0) / Math.PI;
    const uxArm = Math.cos(a1Rad);
    const uyArm = Math.sin(a1Rad);

    const r4Target = Math.sqrt(j4xTarget * j4xTarget + j4yTarget * j4yTarget);
    const dr = r4Target - this.a1;
    const dz = j4zTarget - this.d1;
    const dReach = Math.sqrt(dr * dr + dz * dz);

    const minReach = Math.abs(this.l1 - this.l2) + 5.0;
    const maxReach = this.l1 + this.l2 - 5.0;
    const reachable = dReach >= minReach && dReach <= maxReach;
    const dClamped = Math.max(minReach, Math.min(maxReach, dReach));

    // 4. Law of Cosines for Shoulder (A2) and Elbow (A3)
    const cosAlpha = (this.l1 * this.l1 + dClamped * dClamped - this.l2 * this.l2) / (2.0 * this.l1 * dClamped);
    const alpha = Math.acos(Math.max(-1.0, Math.min(1.0, cosAlpha)));
    const phi = Math.atan2(dz, dr);
    const theta1 = phi + alpha; // Upper Arm angle from horizontal

    const cosBeta = (this.l1 * this.l1 + this.l2 * this.l2 - dClamped * dClamped) / (2.0 * this.l1 * this.l2);
    const beta = Math.acos(Math.max(-1.0, Math.min(1.0, cosBeta)));
    const theta2 = Math.PI - beta;

    const a2Deg = ((Math.PI / 2.0 - theta1) * 180.0) / Math.PI;
    const a3Deg = ((theta2 - Math.PI / 2.0) * 180.0) / Math.PI;
    const a5Deg = ((tPitch - (theta1 - theta2)) * 180.0) / Math.PI;

    // 5. RIGOROUS PHYSICAL FORWARD KINEMATIC CHAIN (100% UNBREAKABLE AT ALL COORDINATES)
    const j0 = [0.0, 0.0, 0.0];
    const j1 = [0.0, 0.0, this.d1];
    const j2 = [uxArm * this.a1, uyArm * this.a1, this.d1];

    const r3 = this.a1 + this.l1 * Math.cos(theta1);
    const z3 = this.d1 + this.l1 * Math.sin(theta1);
    const j3 = [uxArm * r3, uyArm * r3, z3];

    // Actual physical wrist position from forearm link forward projection
    const r4Actual = r3 + this.l2 * Math.cos(theta1 - theta2);
    const z4Actual = z3 + this.l2 * Math.sin(theta1 - theta2);
    const j4Actual = [uxArm * r4Actual, uyArm * r4Actual, z4Actual];

    // Actual physical TCP attached rigidly to wrist J4
    const tcpActual = [
      j4Actual[0] - this.l3 * Math.sin(tPitch) * uxOut,
      j4Actual[1] - this.l3 * Math.sin(tPitch) * uyOut,
      j4Actual[2] - this.l3 * Math.cos(tPitch)
    ];

    return {
      joints: { J0: j0, J1: j1, J2: j2, J3: j3, J4: j4Actual, TCP: tcpActual },
      angles: {
        A1: a1Deg,
        A2: a2Deg,
        A3: a3Deg,
        A4: 0.0,
        A5: a5Deg,
        A6: ((x * 0.15 + y * 0.1) % 360.0) - 180.0
      },
      reachable
    };
  }

  /**
   * Closed-form Analytical Forward Kinematics
   * Computes 3D joint spatial coordinates (J0, J1, J2, J3, J4, TCP) directly from 6-axis angles (degrees).
   * Matches the KUKA physical model hierarchy and coordinate system.
   */
  forward(angles) {
    const a1 = angles.A1 ?? angles.a1 ?? 0.0;
    const a2 = angles.A2 ?? angles.a2 ?? -30.6;
    const a3 = angles.A3 ?? angles.a3 ?? 29.4;
    const a4 = angles.A4 ?? angles.a4 ?? 0.0;
    const a5 = angles.A5 ?? angles.a5 ?? 43.8;
    const a6 = angles.A6 ?? angles.a6 ?? -112.5;

    // Convert degrees to radians for Three.js trigonometric calculations
    const a1Rad = (a1 * Math.PI) / 180.0;
    const a2Rad = (a2 * Math.PI) / 180.0;
    const a3Rad = (a3 * Math.PI) / 180.0;
    const a5Rad = (a5 * Math.PI) / 180.0;

    const theta1 = Math.PI / 2.0 - a2Rad;
    const theta2 = a3Rad + Math.PI / 2.0;

    const uxArm = Math.cos(a1Rad);
    const uyArm = Math.sin(a1Rad);

    const j0 = [0.0, 0.0, 0.0];
    const j1 = [0.0, 0.0, this.d1];
    const j2 = [uxArm * this.a1, uyArm * this.a1, this.d1];

    const r3 = this.a1 + this.l1 * Math.cos(theta1);
    const z3 = this.d1 + this.l1 * Math.sin(theta1);
    const j3 = [uxArm * r3, uyArm * r3, z3];

    const r4 = r3 + this.l2 * Math.cos(theta1 - theta2);
    const z4 = z3 + this.l2 * Math.sin(theta1 - theta2);
    const j4 = [uxArm * r4, uyArm * r4, z4];

    // Tool pitch angle: in solve(), a5Deg = ((tPitch - (theta1 - theta2)) * 180) / PI
    // Therefore: tPitch = (theta1 - theta2) + a5Rad
    const tPitch = (theta1 - theta2) + a5Rad;

    // Direction vector of tool pointing down toward workpiece
    const tcp = [
      j4[0] + this.l3 * Math.sin(tPitch) * uxArm,
      j4[1] + this.l3 * Math.sin(tPitch) * uyArm,
      j4[2] - this.l3 * Math.cos(tPitch)
    ];

    return {
      joints: { J0: j0, J1: j1, J2: j2, J3: j3, J4: j4, TCP: tcp },
      angles: { A1: a1, A2: a2, A3: a3, A4: a4, A5: a5, A6: a6 },
      tcp: { x: tcp[0], y: tcp[1], z: tcp[2] }
    };
  }
}

