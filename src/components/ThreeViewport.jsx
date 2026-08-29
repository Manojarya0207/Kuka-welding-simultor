import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { Flame } from 'lucide-react';
import { METALS, WORKPIECE_SHAPES } from '../materials';
import { RobotKinematics } from '../kinematics';

const kinematics = new RobotKinematics();

// Robust quaternion orientation calculation that prevents NaN when vectors are parallel or anti-parallel
function safeSetFromUnitVectors(quat, vFrom, vTo) {
  const r = vFrom.dot(vTo) + 1.0;
  if (r < 1e-6) {
    if (Math.abs(vFrom.x) > Math.abs(vFrom.z)) {
      quat.set(-vFrom.y, vFrom.x, 0, 0).normalize();
    } else {
      quat.set(0, -vFrom.z, vFrom.y, 0).normalize();
    }
  } else {
    const cross = new THREE.Vector3().crossVectors(vFrom, vTo);
    quat.set(cross.x, cross.y, cross.z, r).normalize();
  }
  return quat;
}

// High-resolution KUKA logo canvas texture with industrial cast plate, bevel & fasteners
function createKukaLogoTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 140;
  const ctx = canvas.getContext('2d');

  // Industrial Orange Powdercoat Plate
  ctx.fillStyle = '#ea580c';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Machined Chamfer Border
  ctx.strokeStyle = '#c2410c';
  ctx.lineWidth = 6;
  ctx.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);

  ctx.strokeStyle = '#fdba74';
  ctx.lineWidth = 2;
  ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);

  // Heavy Embossed Black KUKA Logotype with White Outline
  ctx.font = '900 88px "Outfit", "Arial Black", sans-serif';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 6;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.strokeText('KUKA', canvas.width / 2, canvas.height / 2);

  ctx.fillStyle = '#0f172a';
  ctx.fillText('KUKA', canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

// Analog Pressure Gauge Texture (0 - 250 bar nitrogen accumulator indicator)
function createPressureGaugeTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  // Stainless outer ring & white face
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(128, 128, 120, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 8;
  ctx.stroke();

  // Dial ticks and numbers
  for (let i = 0; i <= 25; i++) {
    const angle = Math.PI * 0.75 + (i / 25) * Math.PI * 1.5;
    const r1 = 110;
    const r2 = i % 5 === 0 ? 92 : 100;
    const x1 = 128 + Math.cos(angle) * r1;
    const y1 = 128 + Math.sin(angle) * r1;
    const x2 = 128 + Math.cos(angle) * r2;
    const y2 = 128 + Math.sin(angle) * r2;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = i >= 20 ? '#dc2626' : '#0f172a';
    ctx.lineWidth = i % 5 === 0 ? 4 : 2;
    ctx.stroke();
  }

  // Label
  ctx.font = '700 20px "Inter", sans-serif';
  ctx.fillStyle = '#475569';
  ctx.textAlign = 'center';
  ctx.fillText('bar', 128, 175);
  ctx.font = '800 14px "Inter", sans-serif';
  ctx.fillText('N2', 128, 90);

  // Pointer Needle (pointing to 160 bar)
  const needleAngle = Math.PI * 0.75 + (16 / 25) * Math.PI * 1.5;
  ctx.beginPath();
  ctx.moveTo(128, 128);
  ctx.lineTo(128 + Math.cos(needleAngle) * 88, 128 + Math.sin(needleAngle) * 88);
  ctx.strokeStyle = '#dc2626';
  ctx.lineWidth = 4;
  ctx.stroke();

  // Center rivet
  ctx.beginPath();
  ctx.arc(128, 128, 8, 0, Math.PI * 2);
  ctx.fillStyle = '#0f172a';
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

// Embossed Cast < A2 > Marking Texture
function createA2CastLabelTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#ea580c';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.font = '900 52px "Outfit", "Arial Black", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Cast shadow
  ctx.fillStyle = '#9a3412';
  ctx.fillText('< A2 >', canvas.width / 2 + 2, canvas.height / 2 + 2);

  // Highlight
  ctx.fillStyle = '#ffedd5';
  ctx.fillText('< A2 >', canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

// Industrial Hazard Safety Chevron Striping Texture
function createHazardStripeTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#eab308';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#0f172a';
  const stripeW = 24;
  for (let x = -canvas.height; x < canvas.width + canvas.height; x += stripeW * 2) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + stripeW, 0);
    ctx.lineTo(x + stripeW + canvas.height, canvas.height);
    ctx.lineTo(x + canvas.height, canvas.height);
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
  jointAngles,
  controlMode = 'CARTESIAN',
  isWelding,
  isPoweredOn,
  selectedMetalKey,
  selectedShapeKey,
  speedOverride,
  autoStepName,
  cameraPreset,
  setCameraPreset,
  targetJoints = null,
  isPreviewActive = false,
  robotStatus = 'idle',
  robotMode = 'LIVE',
  commandId = null
}) {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const ghostGroupRef = useRef(null);
  const ghostPartsRef = useRef({});
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
  const hazardTextureRef = useRef(null);
  const floorMeshRef = useRef(null);
  const materialsRef = useRef({});
  const robotPartsRef = useRef({});

  const metalData = METALS[selectedMetalKey] || METALS.carbon_steel;
  const shapeData = WORKPIECE_SHAPES[selectedShapeKey] || WORKPIECE_SHAPES.circle_pipe;

  // Initialize Three.js Scene ONCE
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth - 460;
    const height = container.clientHeight || window.innerHeight - 56;

    // 1. Scene & Background (Permanent Industrial Light Studio)
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
    tableTop.position.set(620, 260, 0);
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

    // Heavy Table Legs with Leveling Feet
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

    // 6. Dynamic Workpiece Group (at X=620, Base Y=280)
    const wpGroup = new THREE.Group();
    wpGroup.position.set(620, 280, 0);
    scene.add(wpGroup);
    wpGroupRef.current = wpGroup;

    // 7. Weld Beads Group & Sparks Group
    const weldBeadsGroup = new THREE.Group();
    scene.add(weldBeadsGroup);
    weldBeadsGroupRef.current = weldBeadsGroup;

    const sparksGroup = new THREE.Group();
    scene.add(sparksGroup);
    sparksGroupRef.current = sparksGroup;

    // 8. Arc Point Light & Glow Mesh
    const arcLight = new THREE.PointLight(new THREE.Color(metalData.arcGlow), 0, 400);
    scene.add(arcLight);
    arcLightRef.current = arcLight;

    const arcGlowGeo = new THREE.SphereGeometry(8, 16, 16);
    const arcGlowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(metalData.arcCore), transparent: true, opacity: 0 });
    const arcGlowMesh = new THREE.Mesh(arcGlowGeo, arcGlowMat);
    scene.add(arcGlowMesh);
    arcGlowMeshRef.current = arcGlowMesh;

    // -------------------------------------------------------------------------
    // 9. HIGH-FIDELITY REALISTIC KUKA ROBOT MODELING
    // -------------------------------------------------------------------------
    kukaTextureRef.current = createKukaLogoTexture();
    hazardTextureRef.current = createHazardStripeTexture();

    // High-Fidelity PBR Materials
    const kukaOrangeMat = new THREE.MeshStandardMaterial({
      color: 0xea580c,
      roughness: 0.35,
      metalness: 0.15
    });
    const darkCastMat = new THREE.MeshStandardMaterial({
      color: 0x14171c,
      roughness: 0.85,
      metalness: 0.22
    });
    const machinedSteelMat = new THREE.MeshStandardMaterial({
      color: 0xcfd8dc,
      roughness: 0.18,
      metalness: 0.90
    });
    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.08,
      metalness: 0.98
    });
    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      roughness: 0.24,
      metalness: 0.88
    });
    const rubberMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.88,
      metalness: 0.05
    });
    const hazardMat = new THREE.MeshStandardMaterial({
      map: hazardTextureRef.current,
      roughness: 0.35,
      metalness: 0.10
    });
    const kukaLogoMat = new THREE.MeshStandardMaterial({
      map: kukaTextureRef.current,
      roughness: 0.25,
      metalness: 0.15
    });
    const accumulatorMat = new THREE.MeshStandardMaterial({
      color: 0x111317,
      roughness: 0.32,
      metalness: 0.45
    });
    const gaugeMat = new THREE.MeshStandardMaterial({
      map: createPressureGaugeTexture(),
      roughness: 0.15,
      metalness: 0.30
    });
    const a2Mat = new THREE.MeshStandardMaterial({
      map: createA2CastLabelTexture(),
      roughness: 0.35,
      metalness: 0.15
    });
    const coolantBlueMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      roughness: 0.35,
      metalness: 0.25
    });
    const coolantRedMat = new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      roughness: 0.35,
      metalness: 0.25
    });
    const conduitMat = new THREE.MeshStandardMaterial({
      color: 0x1a1d21,
      roughness: 0.88,
      metalness: 0.08
    });

    materialsRef.current = {
      kukaOrangeMat,
      darkCastMat,
      machinedSteelMat,
      chromeMat,
      brassMat,
      rubberMat,
      hazardMat,
      kukaLogoMat,
      accumulatorMat,
      gaugeMat,
      a2Mat,
      coolantBlueMat,
      coolantRedMat,
      conduitMat
    };

    const robotArmGroup = new THREE.Group();
    scene.add(robotArmGroup);
    robotArmGroupRef.current = robotArmGroup;

    // -------------------------------------------------------------------------
    // 9.1 KUKA KR QUANTEC CAST IRON BASE (Forklift Pockets, Stiffener Rib, Bearing Race)
    // -------------------------------------------------------------------------
    const baseAssembly = new THREE.Group();
    baseAssembly.rotation.y = Math.PI * 0.38; // Face front forklift pockets directly toward primary ISO camera
    robotArmGroup.add(baseAssembly);

    // Flared Matte Black Cast Iron Base Skirt
    const baseSkirt = new THREE.Mesh(new THREE.CylinderGeometry(140, 168, 55, 36), darkCastMat);
    baseSkirt.position.y = 27.5;
    baseSkirt.castShadow = true;
    baseSkirt.receiveShadow = true;
    baseAssembly.add(baseSkirt);

    const baseBottomRim = new THREE.Mesh(new THREE.CylinderGeometry(168, 174, 12, 36), darkCastMat);
    baseBottomRim.position.y = 6;
    baseBottomRim.receiveShadow = true;
    baseAssembly.add(baseBottomRim);

    // Turntable Bearing Collar on Top of Base
    const baseCollar = new THREE.Mesh(new THREE.CylinderGeometry(122, 134, 18, 36), machinedSteelMat);
    baseCollar.position.y = 64;
    baseCollar.castShadow = true;
    baseAssembly.add(baseCollar);

    // Circle of 16 Chrome Allen Socket Fasteners on Turntable Race
    for (let c = 0; c < 16; c++) {
      const cAng = (c / 16) * Math.PI * 2;
      const cBolt = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.5, 5, 12), chromeMat);
      cBolt.position.set(Math.cos(cAng) * 115, 73, Math.sin(cAng) * 115);
      baseAssembly.add(cBolt);
    }

    // Two Large Rectangular Forklift Transport Cutouts on Front (Arched Tops)
    for (const xPocket of [-50, 50]) {
      // Dark hollow pocket cavity
      const pocketCavity = new THREE.Mesh(new THREE.BoxGeometry(66, 30, 42), darkCastMat);
      pocketCavity.position.set(xPocket, 24, 136);
      baseAssembly.add(pocketCavity);

      // Pocket Arched Top Lip
      const pocketArch = new THREE.Mesh(new THREE.CylinderGeometry(15, 15, 66, 16), darkCastMat);
      pocketArch.position.set(xPocket, 39, 136);
      pocketArch.rotation.z = Math.PI / 2;
      baseAssembly.add(pocketArch);

      // Interior dark void
      const innerVoid = new THREE.Mesh(
        new THREE.BoxGeometry(60, 26, 38),
        new THREE.MeshBasicMaterial({ color: 0x05070a })
      );
      innerVoid.position.set(xPocket, 24, 137);
      baseAssembly.add(innerVoid);
    }

    // Central Triangular Structural Stiffener Rib Between Pockets
    const centerRib = new THREE.Mesh(new THREE.BoxGeometry(16, 48, 34), darkCastMat);
    centerRib.position.set(0, 28, 148);
    centerRib.castShadow = true;
    baseAssembly.add(centerRib);

    // Lateral Transport Cutouts on Left & Right
    for (const xSide of [-138, 138]) {
      const sidePocket = new THREE.Mesh(new THREE.BoxGeometry(32, 26, 48), darkCastMat);
      sidePocket.position.set(xSide, 24, 0);
      baseAssembly.add(sidePocket);
    }

    // 4 Heavy Corner Anchor Lugs with M30 Hex Bolts
    for (let a = 0; a < 4; a++) {
      const ang = (a / 4) * Math.PI * 2 + Math.PI / 4;
      const ax = Math.cos(ang) * 152;
      const az = Math.sin(ang) * 152;

      const lugWasher = new THREE.Mesh(new THREE.CylinderGeometry(14, 14, 4, 16), machinedSteelMat);
      lugWasher.position.set(ax, 12, az);
      baseAssembly.add(lugWasher);

      const lugBolt = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 14, 6), chromeMat);
      lugBolt.position.set(ax, 19, az);
      baseAssembly.add(lugBolt);
    }

    // -------------------------------------------------------------------------
    // 9.2 TURNTABLE CAROUSEL & REAR DUAL NITROGEN ACCUMULATORS (Axis 1)
    // -------------------------------------------------------------------------
    const carouselGroup = new THREE.Group();
    carouselGroup.position.y = 73;
    robotArmGroup.add(carouselGroup);

    // Contoured Turntable Bell Housing in KUKA Safety Orange
    const carLower = new THREE.Mesh(new THREE.CylinderGeometry(98, 116, 56, 40), kukaOrangeMat);
    carLower.position.y = 28;
    carLower.castShadow = true;
    carouselGroup.add(carLower);

    const carWaist = new THREE.Mesh(new THREE.CylinderGeometry(90, 98, 28, 40), kukaOrangeMat);
    carWaist.position.y = 70;
    carWaist.castShadow = true;
    carouselGroup.add(carWaist);

    // Rear Counterbalance Manifold Block
    const manifold = new THREE.Mesh(new THREE.BoxGeometry(105, 42, 36), darkCastMat);
    manifold.position.set(-85, 48, 0);
    manifold.castShadow = true;
    carouselGroup.add(manifold);

    // Dual Nitrogen Accumulator Cylinders (Black semi-gloss)
    for (const zAcc of [-26, 26]) {
      const accCyl = new THREE.Mesh(new THREE.CylinderGeometry(18, 18, 92, 24), accumulatorMat);
      accCyl.position.set(-85, 74, zAcc);
      accCyl.castShadow = true;
      carouselGroup.add(accCyl);

      const accDome = new THREE.Mesh(new THREE.SphereGeometry(18, 20, 16, 0, Math.PI * 2, 0, Math.PI / 2), accumulatorMat);
      accDome.position.set(-85, 120, zAcc);
      carouselGroup.add(accDome);

      // Hydraulic connecting line into carousel
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4.5, 52, 16), darkCastMat);
      pipe.position.set(-58, 46, zAcc);
      pipe.rotation.z = Math.PI / 2;
      carouselGroup.add(pipe);
    }

    // Analog Pressure Gauge (White dial face with 0-250 bar scale & red needle)
    const gaugeBody = new THREE.Mesh(new THREE.CylinderGeometry(13, 13, 8, 24), chromeMat);
    gaugeBody.position.set(-85, 126, 0);
    gaugeBody.rotation.x = Math.PI / 2;
    carouselGroup.add(gaugeBody);

    const gaugeFace = new THREE.Mesh(new THREE.CircleGeometry(12, 24), gaugeMat);
    gaugeFace.position.set(-85, 126, 4.2);
    carouselGroup.add(gaugeFace);

    // Asymmetric Shoulder Fork Casting in KUKA Orange
    const forkCentral = new THREE.Mesh(new THREE.BoxGeometry(135, 155, 96), kukaOrangeMat);
    forkCentral.position.set(65, 150, 0);
    forkCentral.castShadow = true;
    carouselGroup.add(forkCentral);

    // Right Shoulder Circular Bearing Cover
    const shoulderCap = new THREE.Mesh(new THREE.CylinderGeometry(52, 52, 18, 36), kukaOrangeMat);
    shoulderCap.position.set(140, 247, 54);
    shoulderCap.rotation.x = Math.PI / 2;
    shoulderCap.castShadow = true;
    carouselGroup.add(shoulderCap);

    const shoulderCapCenter = new THREE.Mesh(new THREE.CylinderGeometry(20, 20, 20, 24), darkCastMat);
    shoulderCapCenter.position.set(140, 247, 56);
    shoulderCapCenter.rotation.x = Math.PI / 2;
    carouselGroup.add(shoulderCapCenter);

    // Embossed < A2 > Directional Marking Plate
    const a2Plate = new THREE.Mesh(new THREE.BoxGeometry(42, 22, 2), a2Mat);
    a2Plate.position.set(140, 195, 49);
    carouselGroup.add(a2Plate);

    // Crane Lifting Eyelet Lug on Carousel Top
    const eyelet = new THREE.Mesh(new THREE.TorusGeometry(12, 3.5, 16, 24), chromeMat);
    eyelet.position.set(40, 230, 0);
    eyelet.rotation.y = Math.PI / 2;
    carouselGroup.add(eyelet);

    // -------------------------------------------------------------------------
    // 9.3 AXIS 2 SHOULDER HUB & DYNAMIC COUNTERBALANCE
    // -------------------------------------------------------------------------
    const shoulderHubGroup = new THREE.Group();
    robotArmGroup.add(shoulderHubGroup);

    const shoulderHub = new THREE.Mesh(new THREE.CylinderGeometry(54, 54, 80, 36), darkCastMat);
    shoulderHub.rotation.x = Math.PI / 2;
    shoulderHub.castShadow = true;
    shoulderHubGroup.add(shoulderHub);

    for (let b = 0; b < 8; b++) {
      const bAng = (b / 8) * Math.PI * 2;
      const shBolt = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4.5, 6, 12), chromeMat);
      shBolt.position.set(Math.cos(bAng) * 42, Math.sin(bAng) * 42, 41);
      shBolt.rotation.x = Math.PI / 2;
      shoulderHubGroup.add(shBolt);
    }

    // Dynamic Counterbalance Cylinder Unit
    const cbCylinder = new THREE.Mesh(new THREE.CylinderGeometry(17, 17, kinematics.l1 * 0.68, 24), darkCastMat);
    cbCylinder.castShadow = true;
    robotArmGroup.add(cbCylinder);

    const cbRod = new THREE.Mesh(new THREE.CylinderGeometry(9.5, 9.5, kinematics.l1 * 0.65, 24), chromeMat);
    cbRod.castShadow = true;
    robotArmGroup.add(cbRod);

    // -------------------------------------------------------------------------
    // 9.4 UPPER ARM (Link 1: Sweeping Curved Silhouette, L1 = 430mm)
    // -------------------------------------------------------------------------
    const upperArmGroup = new THREE.Group();
    robotArmGroup.add(upperArmGroup);

    // Main Curved Sweeping Cast Beam in KUKA Orange
    const armLower = new THREE.Mesh(new THREE.CylinderGeometry(40, 48, kinematics.l1 * 0.45, 32), kukaOrangeMat);
    armLower.position.set(8, -kinematics.l1 * 0.26, 0);
    armLower.castShadow = true;
    upperArmGroup.add(armLower);

    const armWaist = new THREE.Mesh(new THREE.CylinderGeometry(34, 40, kinematics.l1 * 0.35, 32), kukaOrangeMat);
    armWaist.position.set(4, 0, 0);
    armWaist.castShadow = true;
    upperArmGroup.add(armWaist);

    const armUpper = new THREE.Mesh(new THREE.CylinderGeometry(44, 34, kinematics.l1 * 0.40, 32), kukaOrangeMat);
    armUpper.position.set(0, kinematics.l1 * 0.28, 0);
    armUpper.castShadow = true;
    upperArmGroup.add(armUpper);

    // Lateral Recessed Stiffener Pockets on Link 1 (Left & Right)
    for (const zSide of [-38, 38]) {
      const sidePocket = new THREE.Mesh(new THREE.BoxGeometry(32, kinematics.l1 * 0.68, 3), darkCastMat);
      sidePocket.position.set(4, 0, zSide);
      upperArmGroup.add(sidePocket);

      const sideRib = new THREE.Mesh(new THREE.BoxGeometry(8, kinematics.l1 * 0.60, 4), kukaOrangeMat);
      sideRib.position.set(4, 0, zSide);
      sideRib.rotation.z = Math.PI / 8;
      upperArmGroup.add(sideRib);
    }

    // Lower Cable Dress Pack Saddle Clamp on Link 1
    const harnessSaddle = new THREE.Mesh(new THREE.CylinderGeometry(16, 16, 20, 20), darkCastMat);
    harnessSaddle.position.set(-32, -kinematics.l1 * 0.20, -32);
    harnessSaddle.rotation.z = Math.PI / 2;
    upperArmGroup.add(harnessSaddle);

    // -------------------------------------------------------------------------
    // 9.5 ELBOW JOINT & DISTINCTIVE OVER-ARM ARCHED CONDUIT (Axis 3)
    // -------------------------------------------------------------------------
    const elbowGroup = new THREE.Group();
    robotArmGroup.add(elbowGroup);

    const elbowHub = new THREE.Mesh(new THREE.SphereGeometry(50, 32, 32), kukaOrangeMat);
    elbowHub.castShadow = true;
    elbowGroup.add(elbowHub);

    // Planetary Gear Hub Ring with Bolt Circle
    const gearRing = new THREE.Mesh(new THREE.CylinderGeometry(52, 52, 36, 36), machinedSteelMat);
    gearRing.rotation.x = Math.PI / 2;
    gearRing.castShadow = true;
    elbowGroup.add(gearRing);

    for (let g = 0; g < 12; g++) {
      const gAng = (g / 12) * Math.PI * 2;
      const gBolt = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.5, 5, 12), chromeMat);
      gBolt.position.set(Math.cos(gAng) * 44, Math.sin(gAng) * 44, 19);
      gBolt.rotation.x = Math.PI / 2;
      elbowGroup.add(gBolt);
    }

    // A3 Servo Motor with Chrome Resolver Cap
    const elbowMotor = new THREE.Mesh(new THREE.CylinderGeometry(30, 30, 75, 28), darkCastMat);
    elbowMotor.position.set(0, 0, 52);
    elbowMotor.rotation.x = Math.PI / 2;
    elbowMotor.castShadow = true;
    elbowGroup.add(elbowMotor);

    const elbowCap = new THREE.Mesh(new THREE.CylinderGeometry(24, 24, 10, 28), chromeMat);
    elbowCap.position.set(0, 0, 92);
    elbowCap.rotation.x = Math.PI / 2;
    elbowGroup.add(elbowCap);

    // Over-Arm Flexible Arched Conduit Loop (Iconic KUKA Quantec Signature)
    const overArmLoop = new THREE.Mesh(
      new THREE.TorusGeometry(46, 6.5, 14, 28, Math.PI * 1.05),
      conduitMat
    );
    overArmLoop.position.set(-20, 28, -26);
    overArmLoop.rotation.z = Math.PI * 0.45;
    elbowGroup.add(overArmLoop);

    // Silver/White Conduit Saddle Clamps
    const clamp1 = new THREE.Mesh(new THREE.BoxGeometry(16, 12, 18), chromeMat);
    clamp1.position.set(-52, 10, -26);
    elbowGroup.add(clamp1);

    const clamp2 = new THREE.Mesh(new THREE.BoxGeometry(16, 12, 18), chromeMat);
    clamp2.position.set(15, 58, -26);
    elbowGroup.add(clamp2);

    // -------------------------------------------------------------------------
    // 9.6 FOREARM (Link 2: Tapered Cylindrical Casting with KUKA Branding, L2 = 430mm)
    // -------------------------------------------------------------------------
    const forearmGroup = new THREE.Group();
    robotArmGroup.add(forearmGroup);

    // Smooth Tapered Conical Cylinder in KUKA Orange
    const forearmCylinder = new THREE.Mesh(
      new THREE.CylinderGeometry(38, 48, kinematics.l2, 36),
      kukaOrangeMat
    );
    forearmCylinder.castShadow = true;
    forearmGroup.add(forearmCylinder);

    // Bold Black KUKA Logotype Emblem on Forearm
    const kukaEmblem1 = new THREE.Mesh(new THREE.PlaneGeometry(130, 36), kukaLogoMat);
    kukaEmblem1.position.set(0, 20, 44);
    kukaEmblem1.rotation.z = Math.PI / 2;
    forearmGroup.add(kukaEmblem1);

    const kukaEmblem2 = new THREE.Mesh(new THREE.PlaneGeometry(130, 36), kukaLogoMat);
    kukaEmblem2.position.set(0, 20, -44);
    kukaEmblem2.rotation.y = Math.PI;
    kukaEmblem2.rotation.z = -Math.PI / 2;
    forearmGroup.add(kukaEmblem2);

    // Stepped Axis 4 In-Line Gear Ring Collar
    const a4Collar = new THREE.Mesh(new THREE.CylinderGeometry(42, 42, 24, 32), machinedSteelMat);
    a4Collar.position.set(0, kinematics.l2 * 0.40, 0);
    a4Collar.castShadow = true;
    forearmGroup.add(a4Collar);

    for (let s = 0; s < 10; s++) {
      const sAng = (s / 10) * Math.PI * 2;
      const sBolt = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 4, 12), chromeMat);
      sBolt.position.set(Math.cos(sAng) * 36, kinematics.l2 * 0.40, Math.sin(sAng) * 36);
      forearmGroup.add(sBolt);
    }

    // -------------------------------------------------------------------------
    // 9.7 COMPACT IN-LINE TRIPLE-ROLL WRIST (Axes 4, 5, 6)
    // -------------------------------------------------------------------------
    const wristHub = new THREE.Mesh(new THREE.SphereGeometry(34, 28, 28), kukaOrangeMat);
    wristHub.castShadow = true;
    robotArmGroup.add(wristHub);

    // Protective Rubber Bellows Rings (Axis 5)
    const rubberRings = [];
    for (let r = 1; r <= 4; r++) {
      const rubberRing = new THREE.Mesh(new THREE.TorusGeometry(18 - r * 1.5, 4.0, 14, 28), rubberMat);
      rubberRing.castShadow = true;
      robotArmGroup.add(rubberRing);
      rubberRings.push(rubberRing);
    }

    // ISO 9409-1-50 Ground Steel Tool Flange
    const flange = new THREE.Mesh(new THREE.CylinderGeometry(26, 26, 12, 36), chromeMat);
    flange.castShadow = true;
    robotArmGroup.add(flange);

    // Circular ISO Bolt Circle on Tool Flange Face
    for (let f = 0; f < 6; f++) {
      const fAng = (f / 6) * Math.PI * 2;
      const fHole = new THREE.Mesh(
        new THREE.CylinderGeometry(2.5, 2.5, 3, 12),
        new THREE.MeshBasicMaterial({ color: 0x0f172a })
      );
      fHole.position.set(Math.cos(fAng) * 18, 6, Math.sin(fAng) * 18);
      flange.add(fHole);
    }

    // -------------------------------------------------------------------------
    // 9.8 ROBOTIC WELDING TORCH & SENSORS
    // -------------------------------------------------------------------------
    const shockSensor = new THREE.Mesh(new THREE.CylinderGeometry(22, 24, 18, 6), darkCastMat);
    shockSensor.castShadow = true;
    robotArmGroup.add(shockSensor);

    const torchClamp = new THREE.Mesh(new THREE.CylinderGeometry(16, 18, 16, 20), darkCastMat);
    torchClamp.castShadow = true;
    robotArmGroup.add(torchClamp);

    const torch = new THREE.Mesh(new THREE.CylinderGeometry(8, 11, 65, 20), darkCastMat);
    torch.castShadow = true;
    robotArmGroup.add(torch);

    const hoseBlue = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 60, 12), coolantBlueMat);
    robotArmGroup.add(hoseBlue);

    const hoseRed = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 60, 12), coolantRedMat);
    robotArmGroup.add(hoseRed);

    const nozzle = new THREE.Mesh(new THREE.ConeGeometry(10, 26, 24), brassMat);
    nozzle.castShadow = true;
    robotArmGroup.add(nozzle);

    const tip = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.5, 14, 16), brassMat);
    robotArmGroup.add(tip);

    const wireStickout = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 14, 8), chromeMat);
    robotArmGroup.add(wireStickout);

    const dressPackSegments = [];
    for (let dp = 0; dp < 8; dp++) {
      const dpRing = new THREE.Mesh(new THREE.TorusGeometry(12, 3.5, 10, 20), conduitMat);
      robotArmGroup.add(dpRing);
      dressPackSegments.push(dpRing);
    }

    robotPartsRef.current = {
      carouselGroup,
      shoulderHubGroup,
      upperArmGroup,
      cbCylinder,
      cbRod,
      elbowGroup,
      forearmGroup,
      wristHub,
      rubberRings,
      flange,
      shockSensor,
      torchClamp,
      torch,
      hoseBlue,
      hoseRed,
      nozzle,
      tip,
      wireStickout,
      dressPackSegments,
      kukaOrangeMat
    };

    // -------------------------------------------------------------------------
    // 9.9 MATCHING GHOST TARGET PREVIEW DIGITAL TWIN
    // -------------------------------------------------------------------------
    const ghostMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      transparent: true,
      opacity: 0.38,
      roughness: 0.3,
      metalness: 0.1,
      depthWrite: false
    });

    const ghostArmGroup = new THREE.Group();
    ghostArmGroup.visible = false;
    scene.add(ghostArmGroup);
    ghostGroupRef.current = ghostArmGroup;

    const ghostCarousel = new THREE.Mesh(new THREE.CylinderGeometry(98, 116, 90, 24), ghostMat);
    ghostCarousel.position.y = 73;
    ghostArmGroup.add(ghostCarousel);

    const ghostShoulder = new THREE.Mesh(new THREE.CylinderGeometry(54, 54, 80, 24), ghostMat);
    ghostShoulder.rotation.x = Math.PI / 2;
    ghostArmGroup.add(ghostShoulder);

    const ghostUpperArm = new THREE.Mesh(new THREE.CylinderGeometry(40, 48, kinematics.l1, 24), ghostMat);
    ghostArmGroup.add(ghostUpperArm);

    const ghostElbow = new THREE.Mesh(new THREE.SphereGeometry(50, 20, 20), ghostMat);
    ghostArmGroup.add(ghostElbow);

    const ghostForearm = new THREE.Mesh(new THREE.CylinderGeometry(38, 48, kinematics.l2, 24), ghostMat);
    ghostArmGroup.add(ghostForearm);

    const ghostWrist = new THREE.Mesh(new THREE.SphereGeometry(34, 18, 18), ghostMat);
    ghostArmGroup.add(ghostWrist);

    const ghostFlange = new THREE.Mesh(new THREE.CylinderGeometry(26, 26, 12, 18), ghostMat);
    ghostArmGroup.add(ghostFlange);

    const ghostTorch = new THREE.Mesh(new THREE.CylinderGeometry(8, 11, 65, 16), ghostMat);
    ghostArmGroup.add(ghostTorch);

    const ghostNozzle = new THREE.Mesh(new THREE.ConeGeometry(10, 26, 18), ghostMat);
    ghostArmGroup.add(ghostNozzle);

    ghostPartsRef.current = {
      ghostArmGroup,
      ghostCarousel,
      ghostShoulder,
      ghostUpperArm,
      ghostElbow,
      ghostForearm,
      ghostWrist,
      ghostFlange,
      ghostTorch,
      ghostNozzle
    };

    // Orbit Camera Drag Controls
    let isDragging = false;
    let dragStart = { x: 0, y: 0 };
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
    };

    const onMouseMove = (e) => {
      if (!isDragging) return;
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      dragStart = { x: e.clientX, y: e.clientY };

      spherical.theta -= dx * 0.007;
      spherical.phi = Math.max(0.05, Math.min(Math.PI / 2 - 0.05, spherical.phi - dy * 0.007));
      updateCameraPos();
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    const onWheel = (e) => {
      e.preventDefault();
      spherical.radius = Math.max(700, Math.min(3200, spherical.radius + e.deltaY * 1.5));
      updateCameraPos();
    };

    const dom = renderer.domElement;
    dom.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    dom.addEventListener('wheel', onWheel, { passive: false });

    controlsRef.current = { spherical, updateCameraPos };

    // Render Animation Loop
    let animFrameId;
    const animate = () => {
      animFrameId = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    // Window Resize Handler
    const handleResize = () => {
      if (!mountRef.current) return;
      const w = mountRef.current.clientWidth || window.innerWidth - 460;
      const h = mountRef.current.clientHeight || window.innerHeight - 56;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animFrameId);
      window.removeEventListener('resize', handleResize);
      dom.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      dom.removeEventListener('wheel', onWheel);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

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
      // Square Box Section (124x124mm, 45mm tall)
      const box = new THREE.Mesh(new THREE.BoxGeometry(124, 45, 124), pbrMat);
      box.position.y = 36.5;
      box.castShadow = true;
      wpGroup.add(box);

      // Outside Perimeter Fillet Seam (at 140mm perimeter)
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
      // Vertical T-Joint Gusset Plate (200x65x12mm)
      const gusset = new THREE.Mesh(new THREE.BoxGeometry(200, 65, 12), pbrMat);
      gusset.position.y = 46.5;
      gusset.castShadow = true;
      wpGroup.add(gusset);

      // Outside Dual Linear Fillet Seams (at Y = ±16mm)
      const seamL = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 200, 12), seamMat);
      seamL.position.set(0, 15, -16);
      seamL.rotation.z = Math.PI / 2;
      wpGroup.add(seamL);

      const seamR = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 200, 12), seamMat);
      seamR.position.set(0, 15, 16);
      seamR.rotation.z = Math.PI / 2;
      wpGroup.add(seamR);
    } else if (selectedShapeKey === 'hex_flange') {
      // Hexagonal Flange (R=66mm outer prism)
      const hex = new THREE.Mesh(new THREE.CylinderGeometry(66, 66, 45, 6), pbrMat);
      hex.position.y = 36.5;
      hex.castShadow = true;
      wpGroup.add(hex);

      // Outside Hexagonal Perimeter Seam (R=74mm)
      const seamHex = new THREE.Mesh(new THREE.TorusGeometry(74, 3.5, 6, 6), seamMat);
      seamHex.position.y = 14;
      seamHex.rotation.x = Math.PI / 2;
      wpGroup.add(seamHex);
    } else {
      // Circular Pipe Collar (Outer Wall R=64mm, Outside Fillet Seam R=72mm)
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(64, 64, 50, 48, 1, true), pbrMat);
      ring.position.y = 39;
      ring.castShadow = true;
      wpGroup.add(ring);

      // Visible Outside Fillet Seam Ring
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
    if (!robotPartsRef.current.carouselGroup) return;
    const parts = robotPartsRef.current;

    parts.kukaOrangeMat.color.setHex(isPoweredOn ? 0xea580c : 0x475569);

    let res;
    if (controlMode === 'JOINTS' && jointAngles) {
      res = kinematics.forward(jointAngles);
    } else if (dispPos) {
      const { x, y, z } = dispPos;
      res = kinematics.solve(x, y, z);
    } else {
      return;
    }

    const j = res.joints;
    const a1Rad = THREE.MathUtils.degToRad(res.angles.A1);

    // Joint Positions in Three.js Coordinates: [X, Z(Height), Y]
    const pJ0 = new THREE.Vector3(j.J0[0], j.J0[2], j.J0[1]);
    const pJ1 = new THREE.Vector3(j.J1[0], j.J1[2], j.J1[1]);
    const pJ2 = new THREE.Vector3(j.J2[0], j.J2[2], j.J2[1]);
    const pJ3 = new THREE.Vector3(j.J3[0], j.J3[2], j.J3[1]);
    const pJ4 = new THREE.Vector3(j.J4[0], j.J4[2], j.J4[1]);
    const pTCP = new THREE.Vector3(j.TCP[0], j.TCP[2], j.TCP[1]);

    // 1. Turntable Carousel Rotation (Axis 1)
    parts.carouselGroup.rotation.y = -a1Rad;

    // 2. Shoulder Hub & Disc (Axis 2 at pJ2)
    parts.shoulderHubGroup.position.copy(pJ2);
    parts.shoulderHubGroup.rotation.y = -a1Rad;

    // 3. Link 1: Upper Arm (from pJ2 to pJ3)
    const arm1Mid = new THREE.Vector3().addVectors(pJ2, pJ3).multiplyScalar(0.5);
    const arm1Dir = new THREE.Vector3().subVectors(pJ3, pJ2).normalize();
    parts.upperArmGroup.position.copy(arm1Mid);
    safeSetFromUnitVectors(parts.upperArmGroup.quaternion, new THREE.Vector3(0, 1, 0), arm1Dir);

    // Dynamic Hydro-Pneumatic Counterbalance Cylinder & Rod
    const cbBase = pJ2.clone().add(new THREE.Vector3(-30, -50, -32).applyAxisAngle(new THREE.Vector3(0, 1, 0), -a1Rad));
    const cbTarget = arm1Mid.clone().add(new THREE.Vector3(-22, 10, -26).applyQuaternion(parts.upperArmGroup.quaternion));
    const cbDir = new THREE.Vector3().subVectors(cbTarget, cbBase).normalize();
    const cbDist = cbBase.distanceTo(cbTarget);

    if (cbDist > 1e-3) {
      parts.cbCylinder.position.copy(cbBase.clone().add(cbDir.clone().multiplyScalar(cbDist * 0.35)));
      safeSetFromUnitVectors(parts.cbCylinder.quaternion, new THREE.Vector3(0, 1, 0), cbDir);

      parts.cbRod.position.copy(cbBase.clone().add(cbDir.clone().multiplyScalar(cbDist * 0.72)));
      parts.cbRod.quaternion.copy(parts.cbCylinder.quaternion);
    }

    // 4. Elbow Hub & Wire Feeder (Axis 3 at pJ3)
    parts.elbowGroup.position.copy(pJ3);
    parts.elbowGroup.rotation.y = -a1Rad;

    // 5. Link 2: Forearm (from pJ3 to pJ4)
    const arm2Mid = new THREE.Vector3().addVectors(pJ3, pJ4).multiplyScalar(0.5);
    const arm2Dir = new THREE.Vector3().subVectors(pJ4, pJ3).normalize();
    parts.forearmGroup.position.copy(arm2Mid);
    safeSetFromUnitVectors(parts.forearmGroup.quaternion, new THREE.Vector3(0, 1, 0), arm2Dir);

    // 6. Hollow Wrist (at pJ4) & Torch pointing DOWNWARDS at pTCP
    parts.wristHub.position.copy(pJ4);

    const toolDir = new THREE.Vector3().subVectors(pTCP, pJ4).normalize();

    // Protective Bellows Rings
    for (let r = 0; r < parts.rubberRings.length; r++) {
      const ring = parts.rubberRings[r];
      const rPos = pJ4.clone().add(toolDir.clone().multiplyScalar((r + 1) * 9.5));
      ring.position.copy(rPos);
      safeSetFromUnitVectors(ring.quaternion, new THREE.Vector3(0, 0, 1), toolDir);
    }

    // Flange, Collision Shock Sensor & Torch Neck
    const flangePos = pJ4.clone().add(toolDir.clone().multiplyScalar(58));
    parts.flange.position.copy(flangePos);
    safeSetFromUnitVectors(parts.flange.quaternion, new THREE.Vector3(0, 1, 0), toolDir);

    const sensorPos = pJ4.clone().add(toolDir.clone().multiplyScalar(70));
    parts.shockSensor.position.copy(sensorPos);
    parts.shockSensor.quaternion.copy(parts.flange.quaternion);

    const clampPos = pJ4.clone().add(toolDir.clone().multiplyScalar(84));
    parts.torchClamp.position.copy(clampPos);
    parts.torchClamp.quaternion.copy(parts.flange.quaternion);

    const torchMid = new THREE.Vector3().addVectors(clampPos, pTCP).multiplyScalar(0.5);
    parts.torch.position.copy(torchMid);
    safeSetFromUnitVectors(parts.torch.quaternion, new THREE.Vector3(0, 1, 0), toolDir);

    // Cooling Lines Offset (Never produces NaN)
    let sideVec = new THREE.Vector3(0, 0, 1).cross(toolDir);
    if (sideVec.lengthSq() < 1e-4) {
      sideVec = new THREE.Vector3(1, 0, 0).cross(toolDir);
    }
    sideVec.normalize().multiplyScalar(7);

    parts.hoseBlue.position.copy(torchMid.clone().add(sideVec));
    parts.hoseBlue.quaternion.copy(parts.torch.quaternion);

    parts.hoseRed.position.copy(torchMid.clone().sub(sideVec));
    parts.hoseRed.quaternion.copy(parts.torch.quaternion);

    // Gas Nozzle, Contact Tip & Wire Stickout
    parts.nozzle.position.copy(pTCP);
    safeSetFromUnitVectors(parts.nozzle.quaternion, new THREE.Vector3(0, -1, 0), toolDir);

    const tipPos = pTCP.clone().add(toolDir.clone().multiplyScalar(5));
    parts.tip.position.copy(tipPos);
    safeSetFromUnitVectors(parts.tip.quaternion, new THREE.Vector3(0, 1, 0), toolDir);

    const wirePos = pTCP.clone().add(toolDir.clone().multiplyScalar(12));
    parts.wireStickout.position.copy(wirePos);
    parts.wireStickout.quaternion.copy(parts.tip.quaternion);

    // Flexible Dress Pack Conduit Rings along forearm
    for (let dp = 0; dp < parts.dressPackSegments.length; dp++) {
      const seg = parts.dressPackSegments[dp];
      const frac = dp / (parts.dressPackSegments.length - 1);
      const dpPos = arm2Mid.clone().lerp(clampPos, frac).add(new THREE.Vector3(-14, 18, -16));
      seg.position.copy(dpPos);
      seg.quaternion.copy(parts.forearmGroup.quaternion);
    }

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
  }, [dispPos, jointAngles, controlMode, isWelding, isPoweredOn, metalData]);

  // Ghost Robot Kinematics Positioning (Command Preview)
  useEffect(() => {
    if (!ghostPartsRef.current.ghostArmGroup) return;
    const g = ghostPartsRef.current;
    if (!isPreviewActive || !targetJoints) {
      g.ghostArmGroup.visible = false;
      return;
    }

    g.ghostArmGroup.visible = true;
    const res = kinematics.forward(targetJoints);
    const j = res.joints;
    const a1Rad = THREE.MathUtils.degToRad(res.angles.A1);

    const pJ2 = new THREE.Vector3(j.J2[0], j.J2[2], j.J2[1]);
    const pJ3 = new THREE.Vector3(j.J3[0], j.J3[2], j.J3[1]);
    const pJ4 = new THREE.Vector3(j.J4[0], j.J4[2], j.J4[1]);
    const pTCP = new THREE.Vector3(j.TCP[0], j.TCP[2], j.TCP[1]);

    g.ghostCarousel.rotation.y = -a1Rad;
    g.ghostShoulder.position.copy(pJ2);
    g.ghostShoulder.rotation.y = -a1Rad;

    const arm1Mid = new THREE.Vector3().addVectors(pJ2, pJ3).multiplyScalar(0.5);
    const arm1Dir = new THREE.Vector3().subVectors(pJ3, pJ2).normalize();
    g.ghostUpperArm.position.copy(arm1Mid);
    safeSetFromUnitVectors(g.ghostUpperArm.quaternion, new THREE.Vector3(0, 1, 0), arm1Dir);

    g.ghostElbow.position.copy(pJ3);

    const arm2Mid = new THREE.Vector3().addVectors(pJ3, pJ4).multiplyScalar(0.5);
    const arm2Dir = new THREE.Vector3().subVectors(pJ4, pJ3).normalize();
    g.ghostForearm.position.copy(arm2Mid);
    safeSetFromUnitVectors(g.ghostForearm.quaternion, new THREE.Vector3(0, 1, 0), arm2Dir);

    g.ghostWrist.position.copy(pJ4);

    const toolDir = new THREE.Vector3().subVectors(pTCP, pJ4).normalize();
    const flangePos = pJ4.clone().add(toolDir.clone().multiplyScalar(58));
    g.ghostFlange.position.copy(flangePos);
    safeSetFromUnitVectors(g.ghostFlange.quaternion, new THREE.Vector3(0, 1, 0), toolDir);

    const torchMid = new THREE.Vector3().addVectors(pJ4, pTCP).multiplyScalar(0.5);
    g.ghostTorch.position.copy(torchMid);
    safeSetFromUnitVectors(g.ghostTorch.quaternion, new THREE.Vector3(0, 1, 0), toolDir);

    g.ghostNozzle.position.copy(pTCP);
    safeSetFromUnitVectors(g.ghostNozzle.quaternion, new THREE.Vector3(0, -1, 0), toolDir);
  }, [isPreviewActive, targetJoints]);

  // Helper to format joints for HUD
  const formatJointSummary = (jointsObj) => {
    if (!jointsObj) return 'A1:0.0 deg';
    const a1 = jointsObj.a1 ?? jointsObj.A1 ?? 0;
    const a2 = jointsObj.a2 ?? jointsObj.A2 ?? 0;
    const a3 = jointsObj.a3 ?? jointsObj.A3 ?? 0;
    return `A1:${Number(a1).toFixed(1)} A2:${Number(a2).toFixed(1)} A3:${Number(a3).toFixed(1)}`;
  };

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
          KUKA KR QUANTEC 3D DIGITAL TWIN
        </span>
        <span className="hud-sep">|</span>
        <span className="hud-coords">
          TCP: X:{dispPos?.x.toFixed(1)} Y:{dispPos?.y.toFixed(1)} Z:{dispPos?.z.toFixed(1)} mm
        </span>
        <span className="hud-sep">|</span>
        <span className="hud-step">{shapeData.name}: {autoStepName}</span>
      </div>

      {/* 3D Simulator Status Panel (PRD Section 36) */}
      <div className="viewport-status-panel">
        <div className="vsp-header">
          <span className="vsp-robot-name">KUKA-01</span>
          <span className={`vsp-status-chip ${robotStatus.toLowerCase()}`}>
            {robotStatus.toUpperCase()}
          </span>
        </div>
        <div className="vsp-row">
          <span className="vsp-label">Target:</span>
          <span className="vsp-val font-mono">{formatJointSummary(targetJoints)}</span>
        </div>
        <div className="vsp-row">
          <span className="vsp-label">Actual:</span>
          <span className="vsp-val font-mono">{formatJointSummary(jointAngles)}</span>
        </div>
        <div className="vsp-row footer-row">
          <span className="vsp-label">Mode: {robotMode}</span>
          {isPreviewActive && <span className="preview-indicator">Preview Ghost Active</span>}
        </div>
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

      {/* Welding Active Banner */}
      {isWelding && isPoweredOn && (
        <div className="welding-active-badge">
          <Flame size={14} className="text-amber-500" />
          <span className="welding-text">
            ARC WELDING: {metalData.code} ({shapeData.name})
          </span>
        </div>
      )}
    </div>
  );
}
