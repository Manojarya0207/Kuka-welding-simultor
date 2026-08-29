import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Flame, Shield, ShieldCheck, ShieldAlert, Sparkles, Eye, Info } from 'lucide-react';
import { METALS, WORKPIECE_SHAPES } from '../materials';
import { RobotKinematics } from '../kinematics';

const kinematics = new RobotKinematics();

// Helper to create KUKA logo canvas texture
function createKukaLogoTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#f97316';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.font = '900 86px "Outfit", "Arial Black", sans-serif';
  ctx.fillStyle = '#080c14';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.letterSpacing = '6px';
  ctx.fillText('KUKA', canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

// Helper to create Hazard Warning Canvas Texture
function createHazardTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#0f172a';
  for (let i = -64; i < 256 + 64; i += 32) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 24, 0);
    ctx.lineTo(i - 8, 64);
    ctx.lineTo(i - 32, 64);
    ctx.closePath();
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 1);
  texture.needsUpdate = true;
  return texture;
}

export default function ThreeViewport({
  dispPos,
  isWelding,
  isPoweredOn,
  selectedMetalKey,
  selectedShapeKey,
  speedOverride,
  autoStepName,
  cameraPreset,
  setCameraPreset
}) {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const robotArmGroupRef = useRef(null);
  const wpGroupRef = useRef(null);
  const weldBeadsGroupRef = useRef(null);
  const arcLightRef = useRef(null);
  const arcGlowMeshRef = useRef(null);
  const sparksGroupRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const particlesRef = useRef([]);
  const weldHistoryRef = useRef([]);
  const kukaTextureRef = useRef(null);
  const floorMeshRef = useRef(null);
  const materialsRef = useRef({});
  const robotPartsRef = useRef({});
  const safetyGrillGroupRef = useRef(null);
  const andonLightsRef = useRef({});

  // Safety Glass State
  const [showSafetyGrill, setShowSafetyGrill] = useState(true);
  const showSafetyGrillRef = useRef(showSafetyGrill);
  showSafetyGrillRef.current = showSafetyGrill;

  const metalData = METALS[selectedMetalKey] || METALS.carbon_steel;
  const shapeData = WORKPIECE_SHAPES[selectedShapeKey] || WORKPIECE_SHAPES.circle_pipe;

  // Initialize Three.js Scene ONCE
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth - 460;
    const height = container.clientHeight || window.innerHeight - 56;

    // 1. Scene & Background
    const scene = new THREE.Scene();
    const bgCol = new THREE.Color(0xf1f5f9);
    scene.background = bgCol;
    scene.fog = new THREE.FogExp2(bgCol, 0.0003);
    sceneRef.current = scene;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    container.appendChild(renderer.domElement);

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(40, width / height, 10, 5000);
    camera.position.set(1100, 850, 1150);
    cameraRef.current = camera;

    // 3. Cinematic Studio Lighting
    const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x1e293b, 1.4);
    hemiLight.position.set(0, 1500, 0);
    scene.add(hemiLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 2.2);
    dirLight1.position.set(800, 1400, 900);
    dirLight1.castShadow = true;
    dirLight1.shadow.mapSize.width = 2048;
    dirLight1.shadow.mapSize.height = 2048;
    dirLight1.shadow.camera.near = 100;
    dirLight1.shadow.camera.far = 3500;
    dirLight1.shadow.camera.left = -1100;
    dirLight1.shadow.camera.right = 1100;
    dirLight1.shadow.camera.top = 1100;
    dirLight1.shadow.camera.bottom = -1100;
    dirLight1.shadow.bias = -0.0003;
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x38bdf8, 1.6);
    dirLight2.position.set(-800, 900, -800);
    scene.add(dirLight2);

    const fillLight = new THREE.DirectionalLight(0xffedd5, 1.2);
    fillLight.position.set(400, 600, -600);
    scene.add(fillLight);

    // 4. Floor & Industrial Grid
    const floorGeo = new THREE.PlaneGeometry(3200, 3200);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0xcfd8dc,
      roughness: 0.75,
      metalness: 0.15
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    floorMeshRef.current = floor;

    const gridHelper = new THREE.GridHelper(3200, 32, 0x0284c7, 0xb0bec5);
    gridHelper.position.y = 0.5;
    scene.add(gridHelper);

    // 5. Heavy Slotted Fixture Welding Table (Demmeler style at X=620, Top Y=280mm)
    const tableGroup = new THREE.Group();
    const tableTopGeo = new THREE.BoxGeometry(440, 40, 520);
    const tableMat = new THREE.MeshStandardMaterial({ color: 0x242e40, roughness: 0.3, metalness: 0.85 });
    const tableTop = new THREE.Mesh(tableTopGeo, tableMat);
    tableTop.position.set(620, 260, 0); // Top is at Y=280mm
    tableTop.castShadow = true;
    tableTop.receiveShadow = true;
    tableGroup.add(tableTop);

    // Table matrix boreholes
    const holeMat = new THREE.MeshStandardMaterial({ color: 0x0a0f1a, roughness: 0.9, metalness: 0.1 });
    for (let hx = -160; hx <= 160; hx += 55) {
      for (let hz = -200; hz <= 200; hz += 50) {
        const holeGeo = new THREE.CylinderGeometry(7, 7, 2, 16);
        const hole = new THREE.Mesh(holeGeo, holeMat);
        hole.position.set(620 + hx, 281, hz);
        tableGroup.add(hole);
      }
    }

    // Heavy Table Legs with Leveling Feet (Height = 240mm)
    const legGeo = new THREE.CylinderGeometry(20, 20, 236, 20);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x1a2130, roughness: 0.5, metalness: 0.6 });
    const footGeo = new THREE.CylinderGeometry(34, 38, 14, 24);
    const footMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4, metalness: 0.8 });

    for (const [lx, lz] of [[440, -210], [800, -210], [440, 210], [800, 210]]) {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(lx, 122, lz);
      leg.castShadow = true;
      tableGroup.add(leg);

      const foot = new THREE.Mesh(footGeo, footMat);
      foot.position.set(lx, 7, lz);
      foot.castShadow = true;
      tableGroup.add(foot);
    }
    scene.add(tableGroup);

    // -------------------------------------------------------------------------
    // 6. INDUSTRIAL PROTECTIVE SAFETY GLASS ENCLOSURE (SURROUNDING WORKING PLATFORM)
    // -------------------------------------------------------------------------
    const safetyGrillGroup = new THREE.Group();
    const hazardTex = createHazardTexture();
    const hazardMat = new THREE.MeshBasicMaterial({ map: hazardTex });

    const postYellowMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.35, metalness: 0.6 });
    const frameDarkMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.35, metalness: 0.75 });
    const clampChromeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.15, metalness: 0.9 });

    // Premium Optical Safety Glass Material
    const safetyGlassMat = new THREE.MeshPhysicalMaterial({
      color: 0x67e8f9,
      transparent: true,
      opacity: 0.38,
      roughness: 0.05,
      metalness: 0.15,
      transmission: 0.88,
      thickness: 5,
      reflectivity: 0.8,
      side: THREE.DoubleSide
    });

    // Perimeter Guard Posts surrounding Robot (0,0) & Table (620,0)
    // Cell Bounds: X from -320 to 1080, Z from -650 to 650, Height = 650mm
    const postGeo = new THREE.BoxGeometry(22, 650, 22);
    const postFootGeo = new THREE.BoxGeometry(38, 25, 38);

    const postLocations = [
      [-320, -650], [380, -650], [1080, -650], // Back Row
      [-320, 650], [380, 650], [1080, 650],   // Front Row
      [-320, 0], [1080, 0]                     // Side Mid Posts
    ];

    postLocations.forEach(([px, pz]) => {
      const post = new THREE.Mesh(postGeo, postYellowMat);
      post.position.set(px, 325, pz);
      post.castShadow = true;
      post.userData = { isSafetyGlass: true };
      safetyGrillGroup.add(post);

      const foot = new THREE.Mesh(postFootGeo, hazardMat);
      foot.position.set(px, 12.5, pz);
      foot.userData = { isSafetyGlass: true };
      safetyGrillGroup.add(foot);

      const cap = new THREE.Mesh(new THREE.CylinderGeometry(14, 14, 8, 16), frameDarkMat);
      cap.position.set(px, 654, pz);
      cap.userData = { isSafetyGlass: true };
      safetyGrillGroup.add(cap);
    });

    // Transparent Safety Glass Panels between Posts
    const addGlassPanel = (x1, z1, x2, z2) => {
      const dx = x2 - x1;
      const dz = z2 - z1;
      const len = Math.sqrt(dx * dx + dz * dz);
      const angle = Math.atan2(dz, dx);
      const midX = (x1 + x2) / 2;
      const midZ = (z1 + z2) / 2;

      const panelGroup = new THREE.Group();
      panelGroup.position.set(midX, 325, midZ);
      panelGroup.rotation.y = -angle;

      // Top & Bottom Aluminum Rails
      const railGeo = new THREE.BoxGeometry(len, 16, 16);
      const topRail = new THREE.Mesh(railGeo, frameDarkMat);
      topRail.position.y = 280;
      topRail.castShadow = true;
      topRail.userData = { isSafetyGlass: true };
      panelGroup.add(topRail);

      const botRail = new THREE.Mesh(railGeo, frameDarkMat);
      botRail.position.y = -280;
      botRail.userData = { isSafetyGlass: true };
      panelGroup.add(botRail);

      // Glass Sheet (Transparent Safety Screen)
      const glassGeo = new THREE.BoxGeometry(len - 24, 540, 5);
      const glassMesh = new THREE.Mesh(glassGeo, safetyGlassMat);
      glassMesh.castShadow = true;
      glassMesh.receiveShadow = true;
      glassMesh.userData = { isSafetyGlass: true };
      panelGroup.add(glassMesh);

      // Mounting Clamps on top & bottom
      for (const cx of [-len * 0.35, len * 0.35]) {
        const clampTop = new THREE.Mesh(new THREE.BoxGeometry(18, 22, 14), clampChromeMat);
        clampTop.position.set(cx, 268, 0);
        clampTop.userData = { isSafetyGlass: true };
        panelGroup.add(clampTop);

        const clampBot = new THREE.Mesh(new THREE.BoxGeometry(18, 22, 14), clampChromeMat);
        clampBot.position.set(cx, -268, 0);
        clampBot.userData = { isSafetyGlass: true };
        panelGroup.add(clampBot);
      }

      panelGroup.userData = { isSafetyGlass: true };
      safetyGrillGroup.add(panelGroup);
    };

    // Back Glass Panels
    addGlassPanel(-320, -650, 380, -650);
    addGlassPanel(380, -650, 1080, -650);

    // Left Glass Panels
    addGlassPanel(-320, -650, -320, 0);
    addGlassPanel(-320, 0, -320, 650);

    // Right Glass Panels
    addGlassPanel(1080, -650, 1080, 0);
    addGlassPanel(1080, 0, 1080, 650);

    // Front Safety Demarcation Floor Stripe
    const safetyFloorStripe = new THREE.Mesh(new THREE.PlaneGeometry(1420, 35), hazardMat);
    safetyFloorStripe.rotation.x = -Math.PI / 2;
    safetyFloorStripe.position.set(380, 1, 650);
    safetyFloorStripe.userData = { isSafetyGlass: true };
    safetyGrillGroup.add(safetyFloorStripe);

    // 3-Stage Andon Light Tower (Corner Post at [1080, 650])
    const andonPole = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 120, 16), frameDarkMat);
    andonPole.position.set(1080, 710, 650);
    andonPole.userData = { isSafetyGlass: true };
    safetyGrillGroup.add(andonPole);

    const redLight = new THREE.Mesh(new THREE.CylinderGeometry(12, 12, 20, 18), new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 0.2 }));
    redLight.position.set(1080, 810, 650);
    redLight.userData = { isSafetyGlass: true };
    safetyGrillGroup.add(redLight);

    const amberLight = new THREE.Mesh(new THREE.CylinderGeometry(12, 12, 20, 18), new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xf59e0b, emissiveIntensity: 0.2 }));
    amberLight.position.set(1080, 785, 650);
    amberLight.userData = { isSafetyGlass: true };
    safetyGrillGroup.add(amberLight);

    const greenLight = new THREE.Mesh(new THREE.CylinderGeometry(12, 12, 20, 18), new THREE.MeshStandardMaterial({ color: 0x10b981, emissive: 0x10b981, emissiveIntensity: 0.8 }));
    greenLight.position.set(1080, 760, 650);
    greenLight.userData = { isSafetyGlass: true };
    safetyGrillGroup.add(greenLight);

    andonLightsRef.current = { red: redLight, amber: amberLight, green: greenLight };

    safetyGrillGroup.userData = { isSafetyGlass: true };
    scene.add(safetyGrillGroup);
    safetyGrillGroupRef.current = safetyGrillGroup;

    // 7. Dynamic Workpiece Group (at X=620, Base Y=280)
    const wpGroup = new THREE.Group();
    wpGroup.position.set(620, 280, 0);
    scene.add(wpGroup);
    wpGroupRef.current = wpGroup;

    // 8. Weld Beads Group & Sparks Group
    const weldBeadsGroup = new THREE.Group();
    scene.add(weldBeadsGroup);
    weldBeadsGroupRef.current = weldBeadsGroup;

    const sparksGroup = new THREE.Group();
    scene.add(sparksGroup);
    sparksGroupRef.current = sparksGroup;

    // 9. Arc Point Light & Glow Mesh
    const arcLight = new THREE.PointLight(new THREE.Color(metalData.arcGlow), 0, 400);
    scene.add(arcLight);
    arcLightRef.current = arcLight;

    const arcGlowGeo = new THREE.SphereGeometry(8, 16, 16);
    const arcGlowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(metalData.arcCore), transparent: true, opacity: 0 });
    const arcGlowMesh = new THREE.Mesh(arcGlowGeo, arcGlowMat);
    scene.add(arcGlowMesh);
    arcGlowMeshRef.current = arcGlowMesh;

    // -------------------------------------------------------------------------
    // 10. HIGH-FIDELITY ROBOT COMPONENTS (UNIFORM KUKA ORANGE FINISH)
    // -------------------------------------------------------------------------
    kukaTextureRef.current = createKukaLogoTexture();

    const kukaOrangeMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.28, metalness: 0.22 });
    const darkCastMat = new THREE.MeshStandardMaterial({ color: 0x161d2b, roughness: 0.4, metalness: 0.8 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.12, metalness: 0.95 });
    const brassMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.2, metalness: 0.85 });
    const rubberMat = new THREE.MeshStandardMaterial({ color: 0x0f141f, roughness: 0.85, metalness: 0.05 });

    materialsRef.current = { kukaOrangeMat, darkCastMat, chromeMat, brassMat, rubberMat };

    const robotArmGroup = new THREE.Group();
    scene.add(robotArmGroup);
    robotArmGroupRef.current = robotArmGroup;

    // Fixed Base Pedestal
    const basePlateM = new THREE.Mesh(new THREE.CylinderGeometry(110, 120, 40, 36), darkCastMat);
    basePlateM.position.y = 20;
    basePlateM.castShadow = true;
    basePlateM.receiveShadow = true;
    robotArmGroup.add(basePlateM);

    for (let a = 0; a < 8; a++) {
      const ang = (a / 8) * Math.PI * 2;
      const bolt = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 8, 12), chromeMat);
      bolt.position.set(Math.cos(ang) * 98, 42, Math.sin(ang) * 98);
      robotArmGroup.add(bolt);
    }

    // Rotating Turntable Carousel
    const carouselGroup = new THREE.Group();
    carouselGroup.position.y = 40;
    robotArmGroup.add(carouselGroup);

    const carBase = new THREE.Mesh(new THREE.CylinderGeometry(95, 106, 90, 36), kukaOrangeMat);
    carBase.position.y = 45;
    carBase.castShadow = true;
    carouselGroup.add(carBase);

    // Horizontal A1 Motor Unit on side of carousel
    const a1Motor = new THREE.Mesh(new THREE.CylinderGeometry(30, 30, 75, 24), darkCastMat);
    a1Motor.position.set(0, 45, 80);
    a1Motor.rotation.x = Math.PI / 2;
    a1Motor.castShadow = true;
    carouselGroup.add(a1Motor);

    const a1Cap = new THREE.Mesh(new THREE.CylinderGeometry(24, 24, 10, 24), chromeMat);
    a1Cap.position.set(0, 45, 122);
    a1Cap.rotation.x = Math.PI / 2;
    carouselGroup.add(a1Cap);

    // Shoulder Fork Casting
    const forkCasting = new THREE.Mesh(new THREE.BoxGeometry(160, 160, 120), kukaOrangeMat);
    forkCasting.position.set(70, 160, 0);
    forkCasting.castShadow = true;
    carouselGroup.add(forkCasting);

    const earFront = new THREE.Mesh(new THREE.BoxGeometry(110, 110, 28), kukaOrangeMat);
    earFront.position.set(140, 280, 52);
    earFront.castShadow = true;
    carouselGroup.add(earFront);

    const earBack = new THREE.Mesh(new THREE.BoxGeometry(110, 110, 28), kukaOrangeMat);
    earBack.position.set(140, 280, -52);
    earBack.castShadow = true;
    carouselGroup.add(earBack);

    const discFront = new THREE.Mesh(new THREE.CylinderGeometry(56, 56, 12, 32), darkCastMat);
    discFront.position.set(140, 280, 68);
    discFront.rotation.x = Math.PI / 2;
    discFront.castShadow = true;
    carouselGroup.add(discFront);

    const discBack = new THREE.Mesh(new THREE.CylinderGeometry(56, 56, 12, 32), darkCastMat);
    discBack.position.set(140, 280, -68);
    discBack.rotation.x = Math.PI / 2;
    discBack.castShadow = true;
    carouselGroup.add(discBack);

    // Shoulder Center Disc Hub
    const shoulderHub = new THREE.Mesh(new THREE.CylinderGeometry(52, 52, 72, 32), darkCastMat);
    shoulderHub.position.set(140, 320, 0);
    shoulderHub.rotation.x = Math.PI / 2;
    shoulderHub.castShadow = true;
    robotArmGroup.add(shoulderHub);

    // Upper Arm Mesh (Link 1: L1 = 430mm)
    const upperArmMesh = new THREE.Mesh(new THREE.BoxGeometry(56, kinematics.l1, 72), kukaOrangeMat);
    upperArmMesh.castShadow = true;
    robotArmGroup.add(upperArmMesh);

    // Counterbalance Strut
    const strutMesh = new THREE.Mesh(new THREE.CylinderGeometry(15, 15, kinematics.l1 * 0.75, 18), darkCastMat);
    strutMesh.castShadow = true;
    robotArmGroup.add(strutMesh);

    // Elbow Hub (Axis 3)
    const elbowHub = new THREE.Mesh(new THREE.SphereGeometry(50, 28, 28), kukaOrangeMat);
    elbowHub.castShadow = true;
    robotArmGroup.add(elbowHub);

    const elbowMotor = new THREE.Mesh(new THREE.CylinderGeometry(32, 32, 85, 28), darkCastMat);
    elbowMotor.rotation.x = Math.PI / 2;
    elbowMotor.castShadow = true;
    robotArmGroup.add(elbowMotor);

    const elbowCap = new THREE.Mesh(new THREE.CylinderGeometry(25, 25, 12, 28), chromeMat);
    elbowCap.rotation.x = Math.PI / 2;
    robotArmGroup.add(elbowCap);

    const feeder = new THREE.Mesh(new THREE.BoxGeometry(65, 75, 80), darkCastMat);
    feeder.castShadow = true;
    robotArmGroup.add(feeder);

    // Forearm Mesh (Link 2: L2 = 430mm)
    const forearmMesh = new THREE.Mesh(new THREE.BoxGeometry(50, kinematics.l2, 64), kukaOrangeMat);
    forearmMesh.castShadow = true;
    robotArmGroup.add(forearmMesh);

    // Hollow Wrist & Boot (Axis 5)
    const wristHub = new THREE.Mesh(new THREE.SphereGeometry(34, 24, 24), kukaOrangeMat);
    wristHub.castShadow = true;
    robotArmGroup.add(wristHub);

    const rubberRings = [];
    for (let r = 1; r <= 5; r++) {
      const rubberRing = new THREE.Mesh(new THREE.TorusGeometry(19 - r * 1.5, 4, 12, 24), rubberMat);
      rubberRing.castShadow = true;
      robotArmGroup.add(rubberRing);
      rubberRings.push(rubberRing);
    }

    const flange = new THREE.Mesh(new THREE.CylinderGeometry(22, 22, 14, 24), chromeMat);
    robotArmGroup.add(flange);

    // Curved Torch & Brass Gas Cup Nozzle
    const torch = new THREE.Mesh(new THREE.CylinderGeometry(7, 10, 60, 18), darkCastMat);
    robotArmGroup.add(torch);

    const nozzle = new THREE.Mesh(new THREE.ConeGeometry(9, 24, 20), brassMat);
    robotArmGroup.add(nozzle);

    const tip = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 14, 12), chromeMat);
    robotArmGroup.add(tip);

    robotPartsRef.current = {
      carouselGroup,
      shoulderHub,
      upperArmMesh,
      strutMesh,
      elbowHub,
      elbowMotor,
      elbowCap,
      feeder,
      forearmMesh,
      wristHub,
      rubberRings,
      flange,
      torch,
      nozzle,
      tip,
      kukaOrangeMat
    };

    // Raycaster for 3D Safety Glass Interactive Clicking & Hover
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    // Orbit Camera Drag & Click Controls
    let isDragging = false;
    let dragStart = { x: 0, y: 0 };
    let mouseDownPos = { x: 0, y: 0 };
    let spherical = { radius: 1650, theta: THREE.MathUtils.degToRad(38), phi: THREE.MathUtils.degToRad(60) };

    const updateCameraPos = () => {
      camera.position.x = spherical.radius * Math.sin(spherical.phi) * Math.sin(spherical.theta);
      camera.position.y = spherical.radius * Math.cos(spherical.phi);
      camera.position.z = spherical.radius * Math.sin(spherical.phi) * Math.cos(spherical.theta);
      camera.lookAt(360, 360, 0);
    };
    updateCameraPos();

    const onMouseDown = (e) => {
      isDragging = true;
      dragStart = { x: e.clientX, y: e.clientY };
      mouseDownPos = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e) => {
      // Hover detection on 3D Safety Glass
      if (container && safetyGrillGroupRef.current && showSafetyGrillRef.current) {
        const rect = container.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(safetyGrillGroupRef.current.children, true);
        if (intersects.length > 0) {
          container.style.cursor = 'pointer';
        } else if (!isDragging) {
          container.style.cursor = 'default';
        }
      }

      if (!isDragging) return;
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      dragStart = { x: e.clientX, y: e.clientY };

      spherical.theta -= dx * 0.005;
      spherical.phi = Math.max(0.1, Math.min(Math.PI / 2 - 0.05, spherical.phi - dy * 0.005));
      updateCameraPos();
    };

    const onMouseUp = (e) => {
      isDragging = false;
      if (container) container.style.cursor = 'default';

      // If clicked without dragging (distance < 5px), check raycast on safety glass
      const dist = Math.hypot(e.clientX - mouseDownPos.x, e.clientY - mouseDownPos.y);
      if (dist < 6 && container && safetyGrillGroupRef.current && showSafetyGrillRef.current) {
        const rect = container.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(safetyGrillGroupRef.current.children, true);
        if (intersects.length > 0) {
          setShowSafetyGrill((prev) => !prev);
        }
      }
    };

    const onWheel = (e) => {
      spherical.radius = Math.max(400, Math.min(3200, spherical.radius + e.deltaY * 0.8));
      updateCameraPos();
    };

    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    container.addEventListener('wheel', onWheel);

    controlsRef.current = { updateCameraPos, spherical };

    // Resize listener
    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w > 0 && h > 0) {
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
    };
    window.addEventListener('resize', onResize);

    // 60 FPS Render Loop
    let reqId;
    const animate = () => {
      reqId = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(reqId);
      container.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      container.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Update Andon Light Tower Status
  useEffect(() => {
    if (!andonLightsRef.current.green) return;
    const { red, amber, green } = andonLightsRef.current;

    if (!isPoweredOn) {
      red.material.emissiveIntensity = 1.0;
      amber.material.emissiveIntensity = 0.1;
      green.material.emissiveIntensity = 0.1;
    } else if (isWelding) {
      red.material.emissiveIntensity = 0.1;
      amber.material.emissiveIntensity = 0.9;
      green.material.emissiveIntensity = 0.9;
    } else {
      red.material.emissiveIntensity = 0.1;
      amber.material.emissiveIntensity = 0.2;
      green.material.emissiveIntensity = 0.9;
    }
  }, [isPoweredOn, isWelding]);

  // Toggle Visibility of Safety Glass Enclosure
  useEffect(() => {
    if (safetyGrillGroupRef.current) {
      safetyGrillGroupRef.current.visible = showSafetyGrill;
    }
  }, [showSafetyGrill]);

  // Re-build Workpiece Geometry on Shape or Metal Selection (at Table Top Y=280)
  useEffect(() => {
    if (!wpGroupRef.current) return;
    const wpGroup = wpGroupRef.current;

    while (wpGroup.children.length > 0) {
      const obj = wpGroup.children[0];
      wpGroup.remove(obj);
      if (obj.geometry) obj.geometry.dispose();
    }

    const pbrMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(metalData.color),
      roughness: metalData.roughness,
      metalness: metalData.metalness,
      side: THREE.DoubleSide
    });

    const seamMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(metalData.seamColor),
      roughness: 0.25,
      metalness: 0.75
    });

    // 1. Common Base Plate (240mm x 240mm, 14mm thick at Y=7)
    const basePlate = new THREE.Mesh(new THREE.BoxGeometry(240, 14, 240), pbrMat);
    basePlate.position.y = 7;
    basePlate.castShadow = true;
    basePlate.receiveShadow = true;
    wpGroup.add(basePlate);

    if (selectedShapeKey === 'square_box') {
      const box = new THREE.Mesh(new THREE.BoxGeometry(124, 45, 124), pbrMat);
      box.position.y = 36.5;
      box.castShadow = true;
      wpGroup.add(box);

      for (const [w, h, px, pz] of [
        [140, 4, 0, -70],
        [140, 4, 0, 70],
        [4, 140, -70, 0],
        [4, 140, 70, 0]
      ]) {
        const seamEdge = new THREE.Mesh(new THREE.BoxGeometry(w, 4, h), seamMat);
        seamEdge.position.set(px, 14, pz);
        wpGroup.add(seamEdge);
      }
    } else if (selectedShapeKey === 't_fillet') {
      const gusset = new THREE.Mesh(new THREE.BoxGeometry(200, 65, 12), pbrMat);
      gusset.position.y = 46.5;
      gusset.castShadow = true;
      wpGroup.add(gusset);

      const seamL = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 200, 12), seamMat);
      seamL.position.set(0, 15, -16);
      seamL.rotation.z = Math.PI / 2;
      wpGroup.add(seamL);

      const seamR = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 200, 12), seamMat);
      seamR.position.set(0, 15, 16);
      seamR.rotation.z = Math.PI / 2;
      wpGroup.add(seamR);
    } else if (selectedShapeKey === 'hex_flange') {
      const hex = new THREE.Mesh(new THREE.CylinderGeometry(66, 66, 45, 6), pbrMat);
      hex.position.y = 36.5;
      hex.castShadow = true;
      wpGroup.add(hex);

      const seamHex = new THREE.Mesh(new THREE.TorusGeometry(74, 3.5, 6, 6), seamMat);
      seamHex.position.y = 14;
      seamHex.rotation.x = Math.PI / 2;
      wpGroup.add(seamHex);
    } else {
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(64, 64, 50, 48, 1, true), pbrMat);
      ring.position.y = 39;
      ring.castShadow = true;
      wpGroup.add(ring);

      const seam = new THREE.Mesh(new THREE.TorusGeometry(72, 3.5, 16, 64), seamMat);
      seam.position.y = 14;
      seam.rotation.x = Math.PI / 2;
      wpGroup.add(seam);
    }
  }, [selectedShapeKey, selectedMetalKey, metalData]);

  // Update Camera on Preset Change
  useEffect(() => {
    if (!controlsRef.current || !cameraPreset) return;
    const { spherical, updateCameraPos } = controlsRef.current;
    if (cameraPreset === 'ISO') {
      spherical.theta = THREE.MathUtils.degToRad(38);
      spherical.phi = THREE.MathUtils.degToRad(60);
      spherical.radius = 1650;
    } else if (cameraPreset === 'TOP') {
      spherical.theta = 0;
      spherical.phi = 0.05;
      spherical.radius = 1650;
    } else if (cameraPreset === 'FRONT') {
      spherical.theta = 0;
      spherical.phi = THREE.MathUtils.degToRad(84);
      spherical.radius = 1550;
    } else if (cameraPreset === 'SIDE') {
      spherical.theta = Math.PI / 2;
      spherical.phi = THREE.MathUtils.degToRad(84);
      spherical.radius = 1550;
    }
    updateCameraPos();
    if (setCameraPreset) setCameraPreset(null);
  }, [cameraPreset, setCameraPreset]);

  // ULTRA-FAST 60 FPS CLOSED-FORM FORWARD KINEMATICS POSITIONING
  useEffect(() => {
    if (!robotPartsRef.current.carouselGroup || !dispPos) return;
    const parts = robotPartsRef.current;

    parts.kukaOrangeMat.color.setHex(isPoweredOn ? 0xf97316 : 0x475569);

    const { x, y, z } = dispPos;
    const res = kinematics.solve(x, y, z);
    const j = res.joints;
    const a1Rad = THREE.MathUtils.degToRad(res.angles.A1);

    // Joint Positions in Three.js Coordinates: [X, Z(Height), Y]
    const pJ0 = new THREE.Vector3(j.J0[0], j.J0[2], j.J0[1]);
    const pJ1 = new THREE.Vector3(j.J1[0], j.J1[2], j.J1[1]);
    const pJ2 = new THREE.Vector3(j.J2[0], j.J2[2], j.J2[1]);
    const pJ3 = new THREE.Vector3(j.J3[0], j.J3[2], j.J3[1]);
    const pJ4 = new THREE.Vector3(j.J4[0], j.J4[2], j.J4[1]);
    const pTCP = new THREE.Vector3(j.TCP[0], j.TCP[2], j.TCP[1]);

    // 1. Turntable Carousel Rotation
    parts.carouselGroup.rotation.y = -a1Rad;

    // 2. Shoulder Hub & Disc (at pJ2)
    parts.shoulderHub.position.copy(pJ2);
    parts.shoulderHub.rotation.y = -a1Rad;

    // 3. Link 1: Upper Arm (from pJ2 to pJ3)
    const arm1Mid = new THREE.Vector3().addVectors(pJ2, pJ3).multiplyScalar(0.5);
    const arm1Dir = new THREE.Vector3().subVectors(pJ3, pJ2).normalize();
    parts.upperArmMesh.position.copy(arm1Mid);
    parts.upperArmMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), arm1Dir);

    // Counterbalance Strut
    const strutOffset = new THREE.Vector3(-20, 0, -22).applyQuaternion(parts.upperArmMesh.quaternion);
    parts.strutMesh.position.copy(arm1Mid.clone().add(strutOffset));
    parts.strutMesh.quaternion.copy(parts.upperArmMesh.quaternion);

    // 4. Elbow Hub & Drive Package (at pJ3)
    parts.elbowHub.position.copy(pJ3);

    const elbowDirZ = new THREE.Vector3(-Math.sin(a1Rad), 0, -Math.cos(a1Rad));
    parts.elbowMotor.position.copy(pJ3.clone().add(elbowDirZ.clone().multiplyScalar(42)));
    parts.elbowMotor.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), elbowDirZ);

    parts.elbowCap.position.copy(pJ3.clone().add(elbowDirZ.clone().multiplyScalar(86)));
    parts.elbowCap.quaternion.copy(parts.elbowMotor.quaternion);

    parts.feeder.position.copy(pJ3.clone().add(new THREE.Vector3(30, 20, -30).applyAxisAngle(new THREE.Vector3(0, 1, 0), -a1Rad)));

    // 5. Link 2: Forearm (from pJ3 to pJ4)
    const arm2Mid = new THREE.Vector3().addVectors(pJ3, pJ4).multiplyScalar(0.5);
    const arm2Dir = new THREE.Vector3().subVectors(pJ4, pJ3).normalize();
    parts.forearmMesh.position.copy(arm2Mid);
    parts.forearmMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), arm2Dir);

    // 6. Hollow Wrist (at pJ4) & Torch pointing DOWNWARDS at pTCP
    parts.wristHub.position.copy(pJ4);

    const toolDir = new THREE.Vector3().subVectors(pTCP, pJ4).normalize();

    for (let r = 0; r < parts.rubberRings.length; r++) {
      const ring = parts.rubberRings[r];
      const rPos = pJ4.clone().add(toolDir.clone().multiplyScalar((r + 1) * 11));
      ring.position.copy(rPos);
      ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), toolDir);
    }

    const flangePos = pJ4.clone().add(toolDir.clone().multiplyScalar(62));
    parts.flange.position.copy(flangePos);
    parts.flange.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), toolDir);

    const torchMid = new THREE.Vector3().addVectors(flangePos, pTCP).multiplyScalar(0.5);
    parts.torch.position.copy(torchMid);
    parts.torch.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), toolDir);

    parts.nozzle.position.copy(pTCP);
    parts.nozzle.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), toolDir);

    parts.tip.position.copy(pTCP.clone().add(toolDir.clone().multiplyScalar(5)));
    parts.tip.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), toolDir);

    // 7. Arc Lighting, Plasma Bloom & Sparks
    if (arcLightRef.current && arcGlowMeshRef.current) {
      if (isWelding && isPoweredOn) {
        arcLightRef.current.position.copy(pTCP);
        arcLightRef.current.color = new THREE.Color(metalData.arcGlow);
        arcLightRef.current.intensity = 3.2 + Math.random() * 0.8;

        arcGlowMeshRef.current.position.copy(pTCP);
        arcGlowMeshRef.current.material.color = new THREE.Color(metalData.arcCore);
        arcGlowMeshRef.current.material.opacity = 0.95;
        arcGlowMeshRef.current.scale.setScalar(1.0 + Math.random() * 0.3);

        // Spawn Micro-Sparks
        if (sparksGroupRef.current && particlesRef.current.length < 35) {
          const sparkGeo = new THREE.SphereGeometry(1.4, 8, 8);
          const sparkMat = new THREE.MeshBasicMaterial({
            color: new THREE.Color(metalData.sparkColors[Math.floor(Math.random() * metalData.sparkColors.length)])
          });
          const sparkMesh = new THREE.Mesh(sparkGeo, sparkMat);
          sparkMesh.position.copy(pTCP);
          sparksGroupRef.current.add(sparkMesh);

          particlesRef.current.push({
            mesh: sparkMesh,
            vx: (Math.random() - 0.5) * 4,
            vy: Math.random() * 4 + 2,
            vz: (Math.random() - 0.5) * 4,
            life: 1.0
          });
        }

        // Add to weld bead history
        if (weldBeadsGroupRef.current && weldHistoryRef.current.length < 200) {
          const beadGeo = new THREE.SphereGeometry(3.2, 10, 10);
          const beadMat = new THREE.MeshStandardMaterial({
            color: new THREE.Color(metalData.beadColor),
            roughness: 0.3,
            metalness: 0.85
          });
          const bead = new THREE.Mesh(beadGeo, beadMat);
          bead.position.copy(pTCP);
          weldBeadsGroupRef.current.add(bead);
          weldHistoryRef.current.push(bead);
        }
      } else {
        arcLightRef.current.intensity = 0;
        arcGlowMeshRef.current.material.opacity = 0;
      }
    }
  }, [dispPos, isWelding, isPoweredOn, metalData]);

  // Animate Micro-Sparks Particles
  useEffect(() => {
    let animId;
    const updateSparks = () => {
      animId = requestAnimationFrame(updateSparks);
      const particles = particlesRef.current;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.mesh.position.x += p.vx;
        p.mesh.position.y += p.vy;
        p.mesh.position.z += p.vz;
        p.vy -= 0.35;
        p.life -= 0.08;

        if (p.mesh.position.y <= 280) {
          p.vy = -p.vy * 0.3;
        }

        if (p.life <= 0) {
          if (sparksGroupRef.current) sparksGroupRef.current.remove(p.mesh);
          p.mesh.geometry.dispose();
          p.mesh.material.dispose();
          particles.splice(i, 1);
        }
      }
    };
    updateSparks();
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <div className="three-viewport-container" ref={mountRef}>
      {/* 3D Viewport Top HUD */}
      <div className="viewport-hud-top">
        <span className="hud-badge-title">
          <span className="pulse-dot"></span>
          KUKA KR CYBERTECH 3D
        </span>
        <span className="hud-sep">|</span>
        <span className="hud-coords">
          TCP: X:{dispPos?.x.toFixed(1)} Y:{dispPos?.y.toFixed(1)} Z:{dispPos?.z.toFixed(1)} mm
        </span>
        <span className="hud-sep">|</span>
        <span className="hud-step">{shapeData.name}: {autoStepName}</span>
      </div>

      {/* Camera Preset Quick Buttons */}
      <div className="viewport-camera-toolbar">
        {[
          { label: 'ISO', id: 'ISO' },
          { label: 'TOP', id: 'TOP' },
          { label: 'FRONT', id: 'FRONT' },
          { label: 'SIDE', id: 'SIDE' }
        ].map((btn) => (
          <button
            key={btn.id}
            onClick={() => setCameraPreset(btn.id)}
            className="cam-btn"
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* Bottom Floating Safety Glass Controls & Status */}
      <div className="viewport-bottom-bar">
        <button
          onClick={() => setShowSafetyGrill(!showSafetyGrill)}
          className={`safety-grill-toggle ${showSafetyGrill ? 'active' : ''}`}
          title="Click here or click directly on the 3D safety glass to remove/add it"
        >
          {showSafetyGrill ? <ShieldCheck size={14} className="text-emerald-500" /> : <ShieldAlert size={14} className="text-amber-500" />}
          <span>{showSafetyGrill ? 'SAFETY GLASS: ENCLOSING CELL (CLICK TO REMOVE)' : 'SAFETY GLASS: REMOVED (CLICK TO ADD)'}</span>
        </button>

        {/* 3 Status Indicator Boxes */}
        <div className="safety-status-boxes">
          <div className={`status-box-indicator ${isPoweredOn ? 'green' : 'red'}`} title={isPoweredOn ? 'Drives Energized (Safe)' : 'Emergency Lockout (Trip)'}>
            <span className="dot"></span>
            <span>POWER</span>
          </div>
          <div className={`status-box-indicator ${isWelding ? 'amber' : 'green'}`} title={isWelding ? 'Arc Struck (Hot Zone)' : 'Standby / Clear'}>
            <span className="dot"></span>
            <span>{isWelding ? 'ARC HOT' : 'CLEAR'}</span>
          </div>
          <div className={`status-box-indicator ${showSafetyGrill ? 'green' : 'gray'}`} title={showSafetyGrill ? 'Safety Glass Enclosed' : 'Safety Glass Removed'}>
            <span className="dot"></span>
            <span>{showSafetyGrill ? 'GLASS ON' : 'OPEN'}</span>
          </div>
        </div>
      </div>

      {/* Welding Active Banner */}
      {isWelding && isPoweredOn && (
        <div className="welding-active-badge">
          <Flame size={14} className="text-amber-400" />
          <span className="welding-text">
            ARC WELDING: {metalData.code} ({shapeData.name})
          </span>
        </div>
      )}
    </div>
  );
}
