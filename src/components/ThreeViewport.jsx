import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { Flame } from 'lucide-react';
import { METALS, WORKPIECE_SHAPES } from '../materials';
import { RobotKinematics } from '../kinematics';

const kinematics = new RobotKinematics();

// Helper to create KUKA logo canvas texture
function createKukaLogoTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#ff5500';
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
    // 9. HIGH-FIDELITY ROBOT COMPONENTS (BUILT ONCE, TRANSFORMED AT 60 FPS)
    // -------------------------------------------------------------------------
    kukaTextureRef.current = createKukaLogoTexture();

    const kukaOrangeMat = new THREE.MeshStandardMaterial({ color: 0xff5500, roughness: 0.22, metalness: 0.25 });
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

    // Forearm Mesh (Link 2: L2 = 430mm with KUKA logo)
    const kukaMat = new THREE.MeshStandardMaterial({ map: kukaTextureRef.current, roughness: 0.25, metalness: 0.2 });
    const forearmMaterials = [kukaOrangeMat, kukaOrangeMat, kukaOrangeMat, kukaOrangeMat, kukaMat, kukaOrangeMat];
    const forearmMesh = new THREE.Mesh(new THREE.BoxGeometry(48, kinematics.l2, 62), forearmMaterials);
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

      spherical.theta -= dx * 0.005;
      spherical.phi = Math.max(0.1, Math.min(Math.PI / 2 - 0.05, spherical.phi - dy * 0.005));
      updateCameraPos();
    };

    const onMouseUp = () => { isDragging = false; };

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

    parts.kukaOrangeMat.color.setHex(isPoweredOn ? 0xff5500 : 0x475569);

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
  }, [dispPos, jointAngles, controlMode, isWelding, isPoweredOn, metalData]);

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
