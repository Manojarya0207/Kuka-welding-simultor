import React, { useState, useEffect, useRef } from 'react';
import ThreeViewport from './components/ThreeViewport';
import TeachPendant from './components/TeachPendant';
import { RobotKinematics } from './kinematics';
import { METALS, WORKPIECE_SHAPES } from './materials';
import { Volume2, VolumeX, Zap, Radio } from 'lucide-react';

const kinematics = new RobotKinematics();

// Calibrated Natural Industrial Home Standby Pose (Folded ready pose)
const HOME_COORDS = { x: 450.0, y: 0.0, z: 600.0 };

export default function App() {
  const [targetPos, setTargetPos] = useState(HOME_COORDS);
  const [dispPos, setDispPos] = useState(HOME_COORDS);
  const [jointAngles, setJointAngles] = useState({ A1: 0.0, A2: -30.6, A3: 29.4, A4: 0.0, A5: 43.8, A6: -112.5 });
  const [controlMode, setControlMode] = useState('CARTESIAN'); // 'CARTESIAN' | 'JOINTS'
  const [wsConnected, setWsConnected] = useState(false);

  const targetJointAnglesRef = useRef({ A1: 0.0, A2: -30.6, A3: 29.4, A4: 0.0, A5: 43.8, A6: -112.5 });
  const currentJointAnglesRef = useRef({ A1: 0.0, A2: -30.6, A3: 29.4, A4: 0.0, A5: 43.8, A6: -112.5 });

  const [isPoweredOn, setIsPoweredOn] = useState(true);
  const [isAutoCycle, setIsAutoCycle] = useState(false);
  const [isWelding, setIsWelding] = useState(false);
  const [selectedMetalKey, setSelectedMetalKey] = useState('carbon_steel');
  const [selectedShapeKey, setSelectedShapeKey] = useState('circle_pipe');
  const [speedOverride, setSpeedOverride] = useState(50); // Default to Normal Realistic Speed (50%)
  const [jogStep, setJogStep] = useState(25.0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [cameraPreset, setCameraPreset] = useState(null);
  const [autoStepName, setAutoStepName] = useState('HOME STANDBY');
  const [logs, setLogs] = useState([
    '[INIT] KUKA KR CYBERTECH Workcell Initialized.',
    '[SYS] Calibrated Normal Industrial Travel Speed Online.',
    '[SYS] 10 Industrial Metallurgy Profiles & 4 CAD Joint Shapes Active.'
  ]);

  // KRL Code Script Execution Engine State
  const [krlCode, setKrlCode] = useState(WORKPIECE_SHAPES.circle_pipe.krlCode);
  const [isScriptRunning, setIsScriptRunning] = useState(false);
  const [currentScriptLine, setCurrentScriptLine] = useState(0);

  const targetPosRef = useRef(targetPos);
  targetPosRef.current = targetPos;

  const scriptExecutionRef = useRef({ isRunning: false, currentLine: 0, lines: [] });

  // Update KRL Template when Workpiece Shape changes
  useEffect(() => {
    if (WORKPIECE_SHAPES[selectedShapeKey]) {
      setKrlCode(WORKPIECE_SHAPES[selectedShapeKey].krlCode);
      addLog(`Selected Workpiece Joint: ${WORKPIECE_SHAPES[selectedShapeKey].name}`);
    }
  }, [selectedShapeKey]);

  const addLog = (msg) => {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [`[${time}] ${msg}`, ...prev.slice(0, 50)]);
  };

  // Update Robot 6-Axis Joints from External Controller (FastAPI WebSocket)
  const updateRobotJoints = (joints) => {
    if (!joints) return;
    const parsed = {
      A1: joints.a1 !== undefined ? Number(joints.a1) : (joints.A1 !== undefined ? Number(joints.A1) : 0),
      A2: joints.a2 !== undefined ? Number(joints.a2) : (joints.A2 !== undefined ? Number(joints.A2) : -30.6),
      A3: joints.a3 !== undefined ? Number(joints.a3) : (joints.A3 !== undefined ? Number(joints.A3) : 29.4),
      A4: joints.a4 !== undefined ? Number(joints.a4) : (joints.A4 !== undefined ? Number(joints.A4) : 0),
      A5: joints.a5 !== undefined ? Number(joints.a5) : (joints.A5 !== undefined ? Number(joints.A5) : 43.8),
      A6: joints.a6 !== undefined ? Number(joints.a6) : (joints.A6 !== undefined ? Number(joints.A6) : -112.5),
    };

    targetJointAnglesRef.current = parsed;
    setControlMode('JOINTS');
    setAutoStepName('EXTERNAL JOINT STREAM');
    addLog(`[ROBOT-CTRL] Joint Update: A1:${parsed.A1.toFixed(1)}° A2:${parsed.A2.toFixed(1)}° A3:${parsed.A3.toFixed(1)}° A4:${parsed.A4.toFixed(1)}° A5:${parsed.A5.toFixed(1)}° A6:${parsed.A6.toFixed(1)}°`);
  };

  // Real-Time WebSocket Client connecting to Python FastAPI Controller
  useEffect(() => {
    let ws;
    let reconnectTimer;
    let isUnmounted = false;

    const connectWs = () => {
      try {
        ws = new WebSocket('ws://127.0.0.1:8000/ws/robot');

        ws.onopen = () => {
          if (isUnmounted) return;
          setWsConnected(true);
          addLog('[WS-ROBOT] Connected to Python Robot Controller (ws://127.0.0.1:8000/ws/robot)');
        };

        ws.onmessage = (event) => {
          if (isUnmounted) return;
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'joint_update' && data.joints) {
              updateRobotJoints(data.joints);
            }
          } catch (err) {
            console.warn('Error parsing WS joint packet:', err);
          }
        };

        ws.onclose = () => {
          if (isUnmounted) return;
          setWsConnected(false);
          reconnectTimer = setTimeout(connectWs, 2000);
        };

        ws.onerror = () => {
          if (ws.readyState === WebSocket.OPEN) ws.close();
        };
      } catch (e) {
        reconnectTimer = setTimeout(connectWs, 2000);
      }
    };

    connectWs();

    return () => {
      isUnmounted = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) ws.close();
    };
  }, []);

  // Web Audio Synthesizer
  const audioCtxRef = useRef(null);
  const weldOscRef = useRef(null);

  const initAudio = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
  };

  const playWeldSound = () => {
    if (!soundEnabled || !isPoweredOn || weldOscRef.current) return;
    initAudio();
    if (!audioCtxRef.current) return;

    try {
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(120, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      weldOscRef.current = { osc, gain };
    } catch (e) {
      console.warn('Audio error:', e);
    }
  };

  const stopWeldSound = () => {
    if (weldOscRef.current) {
      try {
        weldOscRef.current.osc.stop();
        weldOscRef.current.osc.disconnect();
      } catch (e) {}
      weldOscRef.current = null;
    }
  };

  const playEstopSound = () => {
    if (!soundEnabled) return;
    initAudio();
    if (!audioCtxRef.current) return;

    try {
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(35, ctx.currentTime + 0.4);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.45);
    } catch (e) {}
  };

  // Jog Action Handler
  const handleJog = (axis, dir) => {
    if (!isPoweredOn) return;
    setControlMode('CARTESIAN');
    const delta = jogStep * dir;
    setTargetPos((prev) => {
      const updated = { ...prev, [axis]: prev[axis] + delta };
      addLog(`Jog ${axis.toUpperCase()} ${dir > 0 ? '+' : ''}${delta}mm -> ${updated[axis].toFixed(1)}mm`);
      return updated;
    });
  };

  // Preset Action Handler
  const handlePreset = (x, y, z) => {
    if (!isPoweredOn) return;
    setControlMode('CARTESIAN');
    setTargetPos({ x, y, z });
    addLog(`Target Preset -> X:${x} Y:${y} Z:${z}`);
  };

  // E-Stop Trigger
  const triggerEstop = () => {
    setIsPoweredOn(false);
    setIsAutoCycle(false);
    setIsWelding(false);
    setIsScriptRunning(false);
    scriptExecutionRef.current.isRunning = false;
    setAutoStepName('E-STOPPED');
    stopWeldSound();
    playEstopSound();
    addLog('[SAFETY-ESTOP] Emergency Stop Engaged: 400V Main Contactors Open! Mechanical Brakes Clamped.');
  };

  // Power-On Safety Reset
  const resetPowerOn = () => {
    setIsPoweredOn(true);
    setAutoStepName('READY');
    addLog('[SAFETY-RESET] Safety circuit interlocks reset. 400V Drives ENERGIZED.');
  };

  // Toggle Auto Cycle with Instant Return to Home
  const toggleAutoCycle = () => {
    if (!isPoweredOn) return;
    setControlMode('CARTESIAN');

    if (isAutoCycle) {
      setIsAutoCycle(false);
      setIsWelding(false);
      stopWeldSound();
      setAutoStepName('HOME STANDBY');
      addLog('[CYCLE-ABORT] Automatic cycle halted. Moving robot to Standby Home (450, 0, 600)...');
      setTargetPos(HOME_COORDS);
    } else {
      setIsAutoCycle(true);
      const activeShape = WORKPIECE_SHAPES[selectedShapeKey] || WORKPIECE_SHAPES.circle_pipe;
      addLog(`[CYCLE-START] Executing automated weld cycle on ${activeShape.name} (${METALS[selectedMetalKey].name})...`);
    }
  };

  // ===========================================================================
  // KRL SCRIPT PARSER & INTERPRETER ENGINE
  // ===========================================================================
  const parseCoordinates = (line) => {
    const xMatch = line.match(/X\s*(-?\d+(\.\d+)?)/i);
    const yMatch = line.match(/Y\s*(-?\d+(\.\d+)?)/i);
    const zMatch = line.match(/Z\s*(-?\d+(\.\d+)?)/i);
    return {
      x: xMatch ? parseFloat(xMatch[1]) : targetPosRef.current.x,
      y: yMatch ? parseFloat(yMatch[1]) : targetPosRef.current.y,
      z: zMatch ? parseFloat(zMatch[1]) : targetPosRef.current.z
    };
  };

  const executeKrlLine = async (line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith(';') || trimmed.startsWith('&') || trimmed.startsWith('DEF') || trimmed.startsWith('END')) {
      return 50;
    }

    addLog(`KRL CMD: ${trimmed}`);

    if (trimmed.toUpperCase().includes('HOME')) {
      setTargetPos(HOME_COORDS);
      return 2000;
    }

    if (trimmed.startsWith('CIRC')) {
      const coords = parseCoordinates(trimmed);
      const curX = targetPosRef.current.x - 620;
      const curY = targetPosRef.current.y;
      const tgtX = coords.x - 620;
      const tgtY = coords.y;

      let startAng = Math.atan2(curY, curX);
      let endAng = Math.atan2(tgtY, tgtX);

      if (endAng <= startAng) endAng += Math.PI * 2;
      const steps = 8;
      for (let s = 1; s <= steps; s++) {
        const frac = s / steps;
        const ang = startAng + (endAng - startAng) * frac;
        const subX = 620 + 72 * Math.cos(ang);
        const subY = 72 * Math.sin(ang);
        const subZ = targetPosRef.current.z + (coords.z - targetPosRef.current.z) * frac;
        setTargetPos({ x: subX, y: subY, z: subZ });
        await new Promise((r) => setTimeout(r, 380 * (50 / speedOverride)));
      }
      return 150;
    }

    if (trimmed.startsWith('PTP') || trimmed.startsWith('LIN')) {
      const coords = parseCoordinates(trimmed);
      setTargetPos(coords);
      return trimmed.startsWith('PTP') ? 1800 : 2200;
    }

    if (trimmed.startsWith('ARC_ON')) {
      setIsWelding(true);
      playWeldSound();
      return 1200;
    }

    if (trimmed.startsWith('ARC_OFF')) {
      setIsWelding(false);
      stopWeldSound();
      return 800;
    }

    if (trimmed.startsWith('WAIT SEC')) {
      const secMatch = trimmed.match(/WAIT\s+SEC\s*(\d+(\.\d+)?)/i);
      const secs = secMatch ? parseFloat(secMatch[1]) : 1.0;
      return secs * 1000;
    }

    return 800;
  };

  const runKrlScript = async () => {
    if (!isPoweredOn || isScriptRunning) return;
    setControlMode('CARTESIAN');
    const lines = krlCode.split('\n');
    setIsScriptRunning(true);
    scriptExecutionRef.current = { isRunning: true, currentLine: 0, lines };

    for (let i = 0; i < lines.length; i++) {
      if (!scriptExecutionRef.current.isRunning || !isPoweredOn) break;
      setCurrentScriptLine(i);
      scriptExecutionRef.current.currentLine = i;
      const delay = await executeKrlLine(lines[i]);
      await new Promise((r) => setTimeout(r, delay * (50 / speedOverride)));
    }

    setIsScriptRunning(false);
    scriptExecutionRef.current.isRunning = false;
    addLog('[KRL-COMPLETE] KRL Program Execution Finished.');
  };

  const stopKrlScript = () => {
    setIsScriptRunning(false);
    scriptExecutionRef.current.isRunning = false;
    setIsWelding(false);
    stopWeldSound();
    addLog('[KRL-HALT] KRL Program Aborted. Returning to Standby Home...');
    setTargetPos(HOME_COORDS);
  };

  const stepKrlScript = async () => {
    if (!isPoweredOn) return;
    const lines = krlCode.split('\n');
    let lineIdx = scriptExecutionRef.current.currentLine;
    if (lineIdx >= lines.length) lineIdx = 0;

    setCurrentScriptLine(lineIdx);
    await executeKrlLine(lines[lineIdx]);
    scriptExecutionRef.current.currentLine = (lineIdx + 1) % lines.length;
  };

  const loadKrlTemplate = (key) => {
    if (WORKPIECE_SHAPES[key]) {
      setSelectedShapeKey(key);
      setKrlCode(WORKPIECE_SHAPES[key].krlCode);
      addLog(`Loaded KRL Program Template: ${WORKPIECE_SHAPES[key].name}`);
    }
  };

  // Dynamic Trajectory Sequencer (Calibrated Normal Speed)
  useEffect(() => {
    if (!isAutoCycle || !isPoweredOn) return;

    const shape = WORKPIECE_SHAPES[selectedShapeKey] || WORKPIECE_SHAPES.circle_pipe;
    const cycleSteps = shape.trajectory;

    let idx = 0;
    let timerId;

    const runStep = () => {
      if (!isAutoCycle || !isPoweredOn) return;
      const step = cycleSteps[idx];
      setAutoStepName(step.name);
      setTargetPos({ x: step.x, y: step.y, z: step.z });
      idx = (idx + 1) % cycleSteps.length;
      timerId = setTimeout(runStep, step.delay * (50 / speedOverride));
    };

    runStep();
    return () => clearTimeout(timerId);
  }, [isAutoCycle, isPoweredOn, selectedShapeKey, speedOverride]);

  // Motion Interpolation & Kinematics Engine Loop (Fluid 60 FPS Normal Speed)
  useEffect(() => {
    let animId;

    const updateMotion = () => {
      animId = requestAnimationFrame(updateMotion);

      if (controlMode === 'JOINTS') {
        const lerp = Math.min(1.0, 0.08 * (speedOverride / 50)) * (isPoweredOn ? 1 : 0.05);
        const curr = currentJointAnglesRef.current;
        const tgt = targetJointAnglesRef.current;

        const nextAngles = {
          A1: curr.A1 + (tgt.A1 - curr.A1) * lerp,
          A2: curr.A2 + (tgt.A2 - curr.A2) * lerp,
          A3: curr.A3 + (tgt.A3 - curr.A3) * lerp,
          A4: curr.A4 + (tgt.A4 - curr.A4) * lerp,
          A5: curr.A5 + (tgt.A5 - curr.A5) * lerp,
          A6: curr.A6 + (tgt.A6 - curr.A6) * lerp
        };
        currentJointAnglesRef.current = nextAngles;
        setJointAngles(nextAngles);

        const fwd = kinematics.forward(nextAngles);
        setDispPos(fwd.tcp);
        targetPosRef.current = fwd.tcp;
      } else {
        setDispPos((curr) => {
          const lerp = (0.07 * (speedOverride / 50)) * (isPoweredOn ? 1 : 0.05);
          const dx = (targetPosRef.current.x - curr.x) * lerp;
          const dy = (targetPosRef.current.y - curr.y) * lerp;
          const dz = (targetPosRef.current.z - curr.z) * lerp;

          const next = {
            x: curr.x + dx,
            y: curr.y + dy,
            z: curr.z + dz
          };

          // Update Joint Angles via Kinematics
          const sol = kinematics.solve(next.x, next.y, next.z);
          setJointAngles(sol.angles);
          currentJointAnglesRef.current = sol.angles;

          // Check Seam Welding Zone Contact (Z <= 305mm on table at X=620)
          const inWeldPlane = isPoweredOn && next.z <= 305;
          const dxWp = next.x - 620;
          const dyWp = next.y;
          const distFromWpCenter = Math.sqrt(dxWp * dxWp + dyWp * dyWp);

          const atSeam = inWeldPlane && distFromWpCenter <= 120;

          if (atSeam !== isWelding) {
            setIsWelding(atSeam);
            if (atSeam) {
              playWeldSound();
            } else {
              stopWeldSound();
            }
          }

          return next;
        });
      }
    };

    updateMotion();
    return () => cancelAnimationFrame(animId);
  }, [controlMode, speedOverride, isPoweredOn, isWelding, soundEnabled]);

  return (
    <div className="app-container">
      {/* Top Header Bar */}
      <header className="app-header">
        <div className="brand-box">
          <div className="brand-icon">K</div>
          <div className="brand-title">
            <span className="brand-kuka">KUKA</span>
            <span>KR CYBERTECH WELD CELL</span>
            <span className="brand-badge">3D DIGITAL TWIN</span>
          </div>
        </div>

        {/* Status Indicators */}
        <div className="header-status-box">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="status-badge"
          >
            {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
            <span>{soundEnabled ? 'SOUND: ON' : 'MUTED'}</span>
          </button>

          <div className={`status-badge ${isPoweredOn ? 'online' : 'offline'}`}>
            <Zap size={14} />
            <span>{isPoweredOn ? '400V DRIVES: ENERGIZED' : 'DRIVES: LOCKED OUT'}</span>
          </div>

          <div className={`status-badge ${wsConnected ? 'online' : 'offline'}`}>
            <Radio size={14} />
            <span>{wsConnected ? 'PYTHON CTRL: CONNECTED' : 'PYTHON CTRL: OFFLINE'}</span>
          </div>

          <div className="status-badge active">
            <Radio size={14} />
            <span>KRC5 ONLINE</span>
          </div>
        </div>
      </header>

      {/* Main Split: 3D Viewport (Left) + Teach Pendant (Right) */}
      <main className="app-main">
        <div className="viewport-wrapper">
          <ThreeViewport
            dispPos={dispPos}
            jointAngles={jointAngles}
            controlMode={controlMode}
            isWelding={isWelding}
            isPoweredOn={isPoweredOn}
            selectedMetalKey={selectedMetalKey}
            selectedShapeKey={selectedShapeKey}
            speedOverride={speedOverride}
            autoStepName={autoStepName}
            cameraPreset={cameraPreset}
            setCameraPreset={setCameraPreset}
          />
        </div>

        <TeachPendant
          targetPos={targetPos}
          setTargetPos={setTargetPos}
          isPoweredOn={isPoweredOn}
          isAutoCycle={isAutoCycle}
          toggleAutoCycle={toggleAutoCycle}
          triggerEstop={triggerEstop}
          resetPowerOn={resetPowerOn}
          selectedMetalKey={selectedMetalKey}
          setSelectedMetalKey={setSelectedMetalKey}
          selectedShapeKey={selectedShapeKey}
          setSelectedShapeKey={setSelectedShapeKey}
          speedOverride={speedOverride}
          setSpeedOverride={setSpeedOverride}
          jogStep={jogStep}
          setJogStep={setJogStep}
          onJog={handleJog}
          onPreset={handlePreset}
          jointAngles={jointAngles}
          logs={logs}
          clearLogs={() => setLogs([])}
          krlCode={krlCode}
          setKrlCode={setKrlCode}
          isScriptRunning={isScriptRunning}
          currentScriptLine={currentScriptLine}
          runKrlScript={runKrlScript}
          stopKrlScript={stopKrlScript}
          stepKrlScript={stepKrlScript}
          loadKrlTemplate={loadKrlTemplate}
        />
      </main>
    </div>
  );
}
