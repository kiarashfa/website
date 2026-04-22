import * as THREE from "three";

// ═══════════════════════════════════════════════════════════
// LIVING POLYMER REACTOR — Light Theme Background  v3
//
// True physics-driven free-radical chain-growth polymerization:
//   • Monomers drift freely through 3D space (Brownian motion)
//   • Initiation: radical spark activates a monomer
//   • Propagation: monomers *fly toward* the radical chain-end,
//     dock on, and extend the zigzag backbone
//   • Termination: two radical ends meet and cap
//   • Scission: old chains break, fragments become free monomers
//
// Ghost molecule field provides the "infinity illusion"
// ═══════════════════════════════════════════════════════════

export function initThreeJSLight({ containerId = "canvas-container" } = {}) {
  const container = document.getElementById(containerId);
  if (!container) return { scene: null, camera: null, renderer: null, dispose: () => {} };

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0xf5f2ed, 1);
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0xfaf8f5, 0.0038);
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 800);
  const clock = new THREE.Clock();
  let animId = null;

  /* ── Lighting ── */
  scene.add(new THREE.AmbientLight(0xf5f2ed, 0.55));
  const kL = new THREE.DirectionalLight(0xffffff, 0.85); kL.position.set(30, 50, 40); scene.add(kL);
  const fL = new THREE.DirectionalLight(0xe9c46a, 0.25); fL.position.set(-20, -10, 30); scene.add(fL);
  const rL = new THREE.DirectionalLight(0x2a9d8f, 0.2); rL.position.set(0, 20, -40); scene.add(rL);

  /* ── Palette ── */
  const TEAL = new THREE.Color(0x2a9d8f), CORAL = new THREE.Color(0xe76f51);
  const CARBON = new THREE.Color(0x4a5c6a), OXYGEN = new THREE.Color(0xc49080);
  const NITROGEN = new THREE.Color(0x6aafa4), HYDROGEN = new THREE.Color(0xd5dde2);
  const BOND_COLOR = new THREE.Color(0xa0aeb6), BOND_DIM = new THREE.Color(0xd0d6da);
  const HIGHLIGHT = new THREE.Color(0xe9c46a), BG_COLOR = new THREE.Color(0xf5f2ed);

  /* ── Scroll ── */
  let scrollProgress = 0, scrollSmoothed = 0;
  const scrollDamping = 0.04;
  function onScroll() {
    const m = document.documentElement.scrollHeight - window.innerHeight;
    scrollProgress = m > 0 ? window.scrollY / m : 0;
  }
  window.addEventListener("scroll", onScroll, { passive: true }); onScroll();

  /* ── Mouse ── */
  const mouse = new THREE.Vector2(-9999, -9999);
  const mouse3D = new THREE.Vector3(-9999, -9999, -9999);
  const raycaster = new THREE.Raycaster();
  function onMouseMove(e) {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  }
  window.addEventListener("mousemove", onMouseMove, { passive: true });

  /* ── Camera path ── */
  const cameraPath = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 30, 200), new THREE.Vector3(-15, 20, 150),
    new THREE.Vector3(10, 10, 100), new THREE.Vector3(-5, 5, 60),
    new THREE.Vector3(8, -2, 35), new THREE.Vector3(-3, 3, 18),
    new THREE.Vector3(2, -1, 6),
  ], false, "catmullrom", 0.5);
  const lookPath = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0), new THREE.Vector3(-2, -1, 0),
    new THREE.Vector3(3, 1, -5), new THREE.Vector3(0, 0, -10),
    new THREE.Vector3(2, -1, -15), new THREE.Vector3(-1, 1, -8),
    new THREE.Vector3(0, 0, 0),
  ], false, "catmullrom", 0.5);

  /* ═══════════════════════════════════════════════════════════
     CONSTANTS & POOLS
     ═══════════════════════════════════════════════════════════ */
  const R = 55; // network radius
  const SPARK_CAP = 600;
  const MAX_ATOMS = 3000;
  const MAX_BONDS = 4000;
  const BOND_LEN = 1.6;

  // ── Monomer pool: free-floating vinyl monomers ──
  // Each monomer = 2 carbons (C=C) + 4 hydrogens, drifting as a rigid body
  const MAX_MONOMERS = 180;
  const monX = new Float32Array(MAX_MONOMERS); // center position
  const monY = new Float32Array(MAX_MONOMERS);
  const monZ = new Float32Array(MAX_MONOMERS);
  const monVX = new Float32Array(MAX_MONOMERS); // velocity (Brownian)
  const monVY = new Float32Array(MAX_MONOMERS);
  const monVZ = new Float32Array(MAX_MONOMERS);
  const monQuat = new Array(MAX_MONOMERS); // orientation quaternion
  const monRotVel = new Array(MAX_MONOMERS); // angular velocity
  const monAlive = new Uint8Array(MAX_MONOMERS);
  const monAtoms = new Array(MAX_MONOMERS); // [c1,c2,h1,h2,h3,h4] atom indices
  const monBonds = new Array(MAX_MONOMERS); // bond indices
  const monTarget = new Int16Array(MAX_MONOMERS).fill(-1); // chain id being attracted to
  let monCount = 0;

  // ── Atom pool ──
  let atomCount = 0;
  const aPX = new Float32Array(MAX_ATOMS), aPY = new Float32Array(MAX_ATOMS), aPZ = new Float32Array(MAX_ATOMS);
  const aCR = new Float32Array(MAX_ATOMS), aCG = new Float32Array(MAX_ATOMS), aCB = new Float32Array(MAX_ATOMS);
  const aRad = new Float32Array(MAX_ATOMS); // sphere radius
  const aEnergy = new Float32Array(MAX_ATOMS);
  const aType = new Uint8Array(MAX_ATOMS); // 0=C 1=O 2=N 3=H
  const aAlive = new Uint8Array(MAX_ATOMS);
  const aMonomer = new Int16Array(MAX_ATOMS).fill(-1); // which monomer owns this (-1 = chain/scenery)

  // ── Bond pool ──
  let bondCount = 0;
  const bA = new Uint16Array(MAX_BONDS), bB = new Uint16Array(MAX_BONDS);
  const bAlive = new Uint8Array(MAX_BONDS);
  const bMon = new Int16Array(MAX_BONDS).fill(-1); // which monomer owns this bond

  // ── Chain registry ──
  const chains = new Map();
  let nextChainId = 0;

  // Each chain: { atoms: [indices], endPos: Vec3, endDir: Vec3, radical: bool, zigzag: int, birthTime }
  let sparks = [];

  /* ── Helpers ── */
  const TYPE_INFO = [
    { r: CARBON.r, g: CARBON.g, b: CARBON.b, rad: 0.55 },
    { r: OXYGEN.r, g: OXYGEN.g, b: OXYGEN.b, rad: 0.45 },
    { r: NITROGEN.r, g: NITROGEN.g, b: NITROGEN.b, rad: 0.48 },
    { r: HYDROGEN.r, g: HYDROGEN.g, b: HYDROGEN.b, rad: 0.28 },
  ];

  function addAtom(x, y, z, type, scale, monId) {
    if (atomCount >= MAX_ATOMS) return -1;
    const i = atomCount++; const info = TYPE_INFO[type];
    aPX[i] = x; aPY[i] = y; aPZ[i] = z;
    aCR[i] = info.r; aCG[i] = info.g; aCB[i] = info.b;
    aRad[i] = info.rad * scale; aEnergy[i] = 0; aType[i] = type;
    aAlive[i] = 1; aMonomer[i] = monId !== undefined ? monId : -1;
    return i;
  }

  function addBond(a, b, monId) {
    if (bondCount >= MAX_BONDS) return -1;
    const i = bondCount++; bA[i] = a; bB[i] = b; bAlive[i] = 1;
    bMon[i] = monId !== undefined ? monId : -1; return i;
  }

  /* ═══════════════════════════════════════════════════════════
     SPAWN FREE MONOMERS — vinyl monomers drifting in 3D
     Each is a rigid body: C=C core + 4 H's
     Local coords: C1 at (-0.7,0,0), C2 at (0.7,0,0)
     H's at (±1.4, ±0.9, 0)
     ═══════════════════════════════════════════════════════════ */
  const MON_LOCAL = [
    { type: 0, x: -0.7, y: 0, z: 0 },    // C1
    { type: 0, x: 0.7, y: 0, z: 0 },     // C2
    { type: 3, x: -1.4, y: 0.9, z: 0.3 }, // H1
    { type: 3, x: -1.4, y: -0.9, z: -0.3 },// H2
    { type: 3, x: 1.4, y: 0.9, z: -0.3 }, // H3
    { type: 3, x: 1.4, y: -0.9, z: 0.3 }, // H4
  ];
  const MON_BONDS = [[0, 1], [0, 2], [0, 3], [1, 4], [1, 5]];

  function spawnMonomer() {
    if (monCount >= MAX_MONOMERS) return -1;
    const mi = monCount++;
    // Random position in sphere
    const r = R * Math.pow(Math.random(), 0.4) * 0.9;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    monX[mi] = r * Math.sin(phi) * Math.cos(theta);
    monY[mi] = r * Math.sin(phi) * Math.sin(theta) * 0.7;
    monZ[mi] = r * Math.cos(phi);

    // Random Brownian velocity
    const speed = 0.8 + Math.random() * 1.5;
    const vTheta = Math.random() * Math.PI * 2;
    const vPhi = Math.acos(2 * Math.random() - 1);
    monVX[mi] = speed * Math.sin(vPhi) * Math.cos(vTheta);
    monVY[mi] = speed * Math.sin(vPhi) * Math.sin(vTheta);
    monVZ[mi] = speed * Math.cos(vPhi);

    // Random orientation + tumbling
    monQuat[mi] = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(Math.random() * Math.PI * 2, Math.random() * Math.PI * 2, Math.random() * Math.PI * 2));
    monRotVel[mi] = new THREE.Vector3(
      (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.8);

    monAlive[mi] = 1;
    monTarget[mi] = -1;
    const sc = 0.85 + Math.random() * 0.25;

    // Create atoms
    const atomIds = [];
    for (const la of MON_LOCAL) {
      const idx = addAtom(0, 0, 0, la.type, sc, mi);
      if (idx === -1) { monAlive[mi] = 0; return -1; }
      atomIds.push(idx);
    }
    monAtoms[mi] = atomIds;

    // Create internal bonds
    const bondIds = [];
    for (const [a, b] of MON_BONDS) {
      const idx = addBond(atomIds[a], atomIds[b], mi);
      if (idx !== -1) bondIds.push(idx);
    }
    monBonds[mi] = bondIds;

    // Position atoms from rigid body
    updateMonomerAtoms(mi, sc);
    return mi;
  }

  function updateMonomerAtoms(mi, scale) {
    if (!monAlive[mi]) return;
    const q = monQuat[mi];
    const sc = scale || 1.0;
    const atoms = monAtoms[mi];
    if (!atoms) return;
    for (let a = 0; a < MON_LOCAL.length && a < atoms.length; a++) {
      const la = MON_LOCAL[a];
      const lp = new THREE.Vector3(la.x, la.y, la.z).multiplyScalar(sc);
      lp.applyQuaternion(q);
      const idx = atoms[a];
      aPX[idx] = monX[mi] + lp.x;
      aPY[idx] = monY[mi] + lp.y;
      aPZ[idx] = monZ[mi] + lp.z;
    }
  }

  // Spawn initial monomers
  for (let i = 0; i < MAX_MONOMERS; i++) spawnMonomer();

  /* ═══════════════════════════════════════════════════════════
     SCENERY MOLECULES — static decoration
     ═══════════════════════════════════════════════════════════ */
  function makeTemplates() {
    const T = [];
    // Benzene
    T.push({ atoms: (() => { const a = [];
      for (let i = 0; i < 6; i++) { const ang = (i / 6) * Math.PI * 2;
        a.push({ type: 0, x: Math.cos(ang) * 1.8, y: Math.sin(ang) * 1.8, z: 0 });
        a.push({ type: 3, x: Math.cos(ang) * 3.0, y: Math.sin(ang) * 3.0, z: 0 }); }
      return a; })(),
      bonds: (() => { const b = [];
        for (let i = 0; i < 6; i++) { b.push([i * 2, ((i + 1) % 6) * 2]); b.push([i * 2, i * 2 + 1]); }
        return b; })() });
    // Ester
    T.push({ atoms: [
      { type: 0, x: 0, y: 0, z: 0 }, { type: 0, x: 1.5, y: 0, z: 0 },
      { type: 1, x: 2.3, y: 1.1, z: 0 }, { type: 1, x: 2.3, y: -1.1, z: 0 },
      { type: 0, x: 3.6, y: -1.1, z: 0 }, { type: 2, x: 5.0, y: -0.3, z: 0 },
      { type: 3, x: -0.9, y: 0.6, z: 0 }, { type: 3, x: 5.9, y: -0.8, z: 0 }],
      bonds: [[0, 1], [1, 2], [1, 3], [3, 4], [4, 5], [0, 6], [5, 7]] });
    // Tetrahedral
    T.push({ atoms: [
      { type: 0, x: 0, y: 0, z: 0 }, { type: 0, x: 1.3, y: 1.3, z: 0 },
      { type: 1, x: -1.3, y: 1.3, z: 0 }, { type: 2, x: 0, y: -1.0, z: 1.3 },
      { type: 3, x: 0, y: -1.0, z: -1.3 }, { type: 3, x: 1.3, y: 2.3, z: 0.5 }],
      bonds: [[0, 1], [0, 2], [0, 3], [0, 4], [1, 5]] });
    return T;
  }

  function stampScenery() {
    const templates = makeTemplates();
    const placed = [];
    for (let m = 0; m < 40; m++) {
      const tmpl = templates[Math.floor(Math.random() * templates.length)];
      let cx, cy, cz, tries = 0;
      do {
        const r = R * Math.pow(Math.random(), 0.42) * 0.85;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        cx = r * Math.sin(phi) * Math.cos(theta);
        cy = r * Math.sin(phi) * Math.sin(theta) * 0.7;
        cz = r * Math.cos(phi); tries++;
        if (!placed.some(c => Math.hypot(c[0] - cx, c[1] - cy, c[2] - cz) < 7)) break;
      } while (tries < 60);
      placed.push([cx, cy, cz]);
      const quat = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(Math.random() * Math.PI * 2, Math.random() * Math.PI * 2, Math.random() * Math.PI * 2));
      const sc = 0.85 + Math.random() * 0.35;
      const iMap = {};
      for (let a = 0; a < tmpl.atoms.length; a++) {
        const ta = tmpl.atoms[a];
        const lp = new THREE.Vector3(ta.x, ta.y, ta.z).multiplyScalar(sc).applyQuaternion(quat);
        const idx = addAtom(cx + lp.x, cy + lp.y, cz + lp.z, ta.type, sc, -1);
        if (idx === -1) return; iMap[a] = idx;
      }
      for (const [ai, bi] of tmpl.bonds) {
        if (iMap[ai] !== undefined && iMap[bi] !== undefined) addBond(iMap[ai], iMap[bi], -1);
      }
    }
  }
  stampScenery();

  /* ═══════════════════════════════════════════════════════════
     GHOST MOLECULE FIELD — infinity illusion
     ═══════════════════════════════════════════════════════════ */
  function createCircleTexture() {
    const size = 64, canvas = document.createElement("canvas"); canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d");
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, "rgba(0,0,0,1)"); gradient.addColorStop(0.4, "rgba(0,0,0,0.7)");
    gradient.addColorStop(1, "rgba(0,0,0,0.0)"); ctx.fillStyle = gradient; ctx.fillRect(0, 0, size, size);
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter; texture.magFilter = THREE.LinearFilter; return texture;
  }

  function createGhostField() {
    const ct = createCircleTexture(), group = new THREE.Group();
    const layers = [
      { count: 4000, radius: 350, size: 1.0, opacity: 0.07, color: new THREE.Color(0x8a9aa5) },
      { count: 2500, radius: 220, size: 0.7, opacity: 0.10, color: new THREE.Color(0x264653).lerp(BG_COLOR, 0.5) },
      { count: 1500, radius: 150, size: 0.5, opacity: 0.12, color: TEAL.clone().lerp(BG_COLOR, 0.4) },
      { count: 800, radius: 100, size: 0.4, opacity: 0.15, color: CORAL.clone().lerp(BG_COLOR, 0.35) },
    ];
    for (const layer of layers) {
      const positions = new Float32Array(layer.count * 3);
      for (let i = 0; i < layer.count; i++) {
        const i3 = i * 3, r = layer.radius * (0.25 + Math.random() * 0.75);
        const theta = Math.random() * Math.PI * 2, phi = Math.acos(2 * Math.random() - 1);
        positions[i3] = r * Math.sin(phi) * Math.cos(theta);
        positions[i3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.65;
        positions[i3 + 2] = r * Math.cos(phi);
      }
      const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      group.add(new THREE.Points(geo, new THREE.PointsMaterial({
        size: layer.size, color: layer.color, transparent: true, opacity: layer.opacity,
        depthWrite: false, blending: THREE.NormalBlending, sizeAttenuation: true, map: ct, alphaMap: ct })));
    }
    // Ghost bonds
    const gbc = 2000, gbPos = new Float32Array(gbc * 6), gbCol = new Float32Array(gbc * 6);
    for (let i = 0; i < gbc; i++) {
      const r = 80 + Math.random() * 250, theta = Math.random() * Math.PI * 2, phi = Math.acos(2 * Math.random() - 1);
      const x = r * Math.sin(phi) * Math.cos(theta), y = r * Math.sin(phi) * Math.sin(theta) * 0.65, z = r * Math.cos(phi);
      const dx = (Math.random() - 0.5) * 2.5, dy = (Math.random() - 0.5) * 2.5, dz = (Math.random() - 0.5) * 2.5;
      const i6 = i * 6; gbPos[i6] = x; gbPos[i6 + 1] = y; gbPos[i6 + 2] = z;
      gbPos[i6 + 3] = x + dx; gbPos[i6 + 4] = y + dy; gbPos[i6 + 5] = z + dz;
      const fade = Math.max(0.03, 0.12 - (r - 80) / 2800);
      const c = Math.random() < 0.5 ? BOND_COLOR : BOND_DIM;
      gbCol[i6] = c.r * fade; gbCol[i6 + 1] = c.g * fade; gbCol[i6 + 2] = c.b * fade;
      gbCol[i6 + 3] = c.r * fade; gbCol[i6 + 4] = c.g * fade; gbCol[i6 + 5] = c.b * fade;
    }
    const gbGeo = new THREE.BufferGeometry();
    gbGeo.setAttribute("position", new THREE.BufferAttribute(gbPos, 3));
    gbGeo.setAttribute("color", new THREE.BufferAttribute(gbCol, 3));
    group.add(new THREE.LineSegments(gbGeo, new THREE.LineBasicMaterial({
      vertexColors: true, transparent: true, opacity: 1.0, depthWrite: false, blending: THREE.NormalBlending })));
    scene.add(group); return group;
  }
  const ghostField = createGhostField();

  /* ── Solvent fog ── */
  function createSolventFog() {
    const group = new THREE.Group();
    const shells = [{ r: 75, color: TEAL, opacity: 0.014 }, { r: 58, color: CORAL, opacity: 0.011 },
      { r: 42, color: TEAL, opacity: 0.016 }, { r: 28, color: new THREE.Color(0xe9c46a), opacity: 0.013 }];
    const vert = `varying vec3 vN;varying vec3 vW;void main(){vN=normalize(normalMatrix*normal);vW=(modelMatrix*vec4(position,1.0)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;
    const frag = `uniform vec3 uC;uniform float uO;uniform float uT;varying vec3 vN;varying vec3 vW;
      float h(vec3 p){p=fract(p*0.3183099+0.1);p*=17.0;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
      float n(vec3 p){vec3 i=floor(p);vec3 f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z);}
      void main(){vec3 vd=normalize(cameraPosition-vW);float rim=1.0-abs(dot(vd,vN));rim=pow(rim,2.5);float nn=n(vW*0.06+uT*0.03);nn=nn*0.6+0.4;float a=rim*uO*nn;a+=(1.0-rim)*uO*0.1*nn;gl_FragColor=vec4(uC,a);}`;
    for (const s of shells) {
      const geo = new THREE.IcosahedronGeometry(s.r, 4);
      const mat = new THREE.ShaderMaterial({ uniforms: { uC: { value: s.color.clone() }, uO: { value: s.opacity }, uT: { value: 0 } },
        vertexShader: vert, fragmentShader: frag, transparent: true, depthWrite: false, side: THREE.BackSide, blending: THREE.NormalBlending });
      const mesh = new THREE.Mesh(geo, mat); mesh.rotation.set(Math.random() * 2, Math.random() * 2, Math.random() * 2);
      group.add(mesh);
    }
    scene.add(group); return group;
  }
  const solventFog = createSolventFog();

  /* ═══════════════════════════════════════════════════════════
     INSTANCED RENDERING
     ═══════════════════════════════════════════════════════════ */
  const sphereGeo = new THREE.SphereGeometry(1, 14, 10);
  const atomMat = new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0.04 });
  const atomMesh = new THREE.InstancedMesh(sphereGeo, atomMat, MAX_ATOMS);
  atomMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); atomMesh.count = 0;
  const iColors = new Float32Array(MAX_ATOMS * 3);
  atomMesh.instanceColor = new THREE.InstancedBufferAttribute(iColors, 3);
  atomMesh.instanceColor.setUsage(THREE.DynamicDrawUsage); scene.add(atomMesh);

  const cylGeo = new THREE.CylinderGeometry(0.09, 0.09, 1, 5, 1);
  cylGeo.translate(0, 0.5, 0); cylGeo.rotateX(Math.PI / 2);
  const bondMat = new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.05 });
  const bondMesh = new THREE.InstancedMesh(cylGeo, bondMat, MAX_BONDS);
  bondMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); bondMesh.count = 0;
  const bColors = new Float32Array(MAX_BONDS * 3);
  bondMesh.instanceColor = new THREE.InstancedBufferAttribute(bColors, 3);
  bondMesh.instanceColor.setUsage(THREE.DynamicDrawUsage); scene.add(bondMesh);

  const dummy = new THREE.Object3D();
  const _dir = new THREE.Vector3(), _up = new THREE.Vector3(0, 0, 1), _quat = new THREE.Quaternion();

  /* ── Sparks ── */
  function createSparkSystem() {
    const p = new Float32Array(SPARK_CAP * 3), c = new Float32Array(SPARK_CAP * 3), a = new Float32Array(SPARK_CAP);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(p, 3));
    geo.setAttribute("aColor", new THREE.BufferAttribute(c, 3));
    geo.setAttribute("aAlpha", new THREE.BufferAttribute(a, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uPR: { value: renderer.getPixelRatio() } },
      vertexShader: `attribute vec3 aColor;attribute float aAlpha;uniform float uPR;varying vec3 vC;varying float vA;void main(){vC=aColor;vA=aAlpha;vec4 mv=modelViewMatrix*vec4(position,1.0);gl_PointSize=clamp(aAlpha*(120.0/-mv.z)*uPR,0.0,30.0);gl_Position=projectionMatrix*mv;}`,
      fragmentShader: `varying vec3 vC;varying float vA;void main(){float d=length(gl_PointCoord-0.5)*2.0;float a=exp(-d*d*5.0)*vA;if(a<0.01)discard;gl_FragColor=vec4(vC*1.4,a*0.85);}`,
      transparent: true, depthWrite: false, blending: THREE.NormalBlending });
    const pts = new THREE.Points(geo, mat); scene.add(pts); return { pts, geo };
  }
  const sparkSys = createSparkSystem();

  function emitSparks(x, y, z, col, n) {
    for (let s = 0; s < n; s++) { if (sparks.length >= SPARK_CAP) break;
      const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5)
        .normalize().multiplyScalar(1.5 + Math.random() * 3);
      sparks.push({ pos: new THREE.Vector3(x, y, z), vel: dir, life: 1.0, decay: 1.2 + Math.random() * 1.3, color: col.clone() }); } }

  /* ═══════════════════════════════════════════════════════════
     MONOMER PHYSICS — Brownian motion + boundary + attraction
     ═══════════════════════════════════════════════════════════ */
  function updateMonomers(delta, time) {
    for (let mi = 0; mi < monCount; mi++) {
      if (!monAlive[mi]) continue;

      // Brownian random kicks
      monVX[mi] += (Math.random() - 0.5) * 3.0 * delta;
      monVY[mi] += (Math.random() - 0.5) * 3.0 * delta;
      monVZ[mi] += (Math.random() - 0.5) * 3.0 * delta;

      // If targeted by a chain, fly toward it
      if (monTarget[mi] >= 0) {
        const chain = chains.get(monTarget[mi]);
        if (chain && chain.radical) {
          const ep = chain.endPos;
          const dx = ep.x - monX[mi], dy = ep.y - monY[mi], dz = ep.z - monZ[mi];
          const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (d > 0.01) {
            const force = 12.0; // strong attraction
            monVX[mi] += (dx / d) * force * delta;
            monVY[mi] += (dy / d) * force * delta;
            monVZ[mi] += (dz / d) * force * delta;
          }
        } else {
          monTarget[mi] = -1; // chain died
        }
      }

      // Drag
      monVX[mi] *= (1 - 1.5 * delta);
      monVY[mi] *= (1 - 1.5 * delta);
      monVZ[mi] *= (1 - 1.5 * delta);

      // Speed limit
      const spd = Math.sqrt(monVX[mi] * monVX[mi] + monVY[mi] * monVY[mi] + monVZ[mi] * monVZ[mi]);
      const maxSpd = monTarget[mi] >= 0 ? 15.0 : 3.0;
      if (spd > maxSpd) { const s = maxSpd / spd; monVX[mi] *= s; monVY[mi] *= s; monVZ[mi] *= s; }

      // Integrate position
      monX[mi] += monVX[mi] * delta;
      monY[mi] += monVY[mi] * delta;
      monZ[mi] += monVZ[mi] * delta;

      // Soft boundary — steer back if too far
      const dist = Math.sqrt(monX[mi] * monX[mi] + monY[mi] * monY[mi] + monZ[mi] * monZ[mi]);
      if (dist > R * 0.95) {
        const push = 2.0 * (dist - R * 0.8) / R;
        monVX[mi] -= (monX[mi] / dist) * push;
        monVY[mi] -= (monY[mi] / dist) * push;
        monVZ[mi] -= (monZ[mi] / dist) * push;
      }

      // Tumble rotation
      const rv = monRotVel[mi];
      const rotAngle = rv.length() * delta;
      if (rotAngle > 0.0001) {
        const rotAxis = rv.clone().normalize();
        const dq = new THREE.Quaternion().setFromAxisAngle(rotAxis, rotAngle);
        monQuat[mi].premultiply(dq).normalize();
      }

      // Update atom world positions from rigid body
      const atoms = monAtoms[mi];
      if (!atoms) continue;
      const sc = aRad[atoms[0]] / TYPE_INFO[0].rad; // recover scale from first carbon
      updateMonomerAtoms(mi, sc);
    }
  }

  /* ═══════════════════════════════════════════════════════════
     ✦ CHEMISTRY ENGINE ✦
     ═══════════════════════════════════════════════════════════ */

  // INITIATION: activate a monomer → start a chain
  function initiateChain(now) {
    // Find a free monomer (not targeted, alive)
    const cands = [];
    for (let mi = 0; mi < monCount; mi++) {
      if (monAlive[mi] && monTarget[mi] < 0) cands.push(mi);
    }
    if (cands.length < 3) return; // keep some free

    const mi = cands[Math.floor(Math.random() * cands.length)];
    const atoms = monAtoms[mi];
    const c1 = atoms[0], c2 = atoms[1]; // the two carbons

    // Kill monomer rigid body, keep atoms as chain start
    monAlive[mi] = 0;
    for (const ai of atoms) aMonomer[ai] = -1;
    for (const bi of monBonds[mi]) bMon[bi] = -1;

    // Create chain
    const chainId = nextChainId++;
    const endPos = new THREE.Vector3(aPX[c2], aPY[c2], aPZ[c2]);
    const endDir = new THREE.Vector3(aPX[c2] - aPX[c1], aPY[c2] - aPY[c1], aPZ[c2] - aPZ[c1]).normalize();

    chains.set(chainId, {
      atoms: [...atoms], backboneAtoms: [c1, c2], bondIndices: [...monBonds[mi]],
      endPos, endDir, radical: true, zigzag: 0, birthTime: now, lastGrowth: now,
    });

    aEnergy[c1] = 1.0; aEnergy[c2] = 1.0;
    emitSparks(aPX[c1], aPY[c1], aPZ[c1], HIGHLIGHT.clone().lerp(new THREE.Color(0xffffff), 0.3), 10);
  }

  // PROPAGATION: attract nearest monomer, dock it when close enough
  function propagateChains(now) {
    for (const [chainId, chain] of chains) {
      if (!chain.radical) continue;
      if (now - chain.lastGrowth < 0.15) continue;

      // Find nearest free monomer
      let bestMi = -1, bestDist = 15.0;
      for (let mi = 0; mi < monCount; mi++) {
        if (!monAlive[mi]) continue;
        if (monTarget[mi] >= 0 && monTarget[mi] !== chainId) continue;
        const dx = monX[mi] - chain.endPos.x, dy = monY[mi] - chain.endPos.y, dz = monZ[mi] - chain.endPos.z;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (d < bestDist) { bestDist = d; bestMi = mi; }
      }

      if (bestMi === -1) continue;

      // Attract it
      monTarget[bestMi] = chainId;

      // If close enough → DOCK
      if (bestDist < BOND_LEN * 1.5) {
        const mi = bestMi;
        const atoms = monAtoms[mi];
        const c1 = atoms[0], c2 = atoms[1];

        // Position new atoms at zigzag extension of chain
        chain.zigzag++;
        const zigDir = new THREE.Vector3();
        // Zigzag: alternate perpendicular direction
        const perp = new THREE.Vector3();
        if (Math.abs(chain.endDir.y) < 0.9) perp.crossVectors(chain.endDir, new THREE.Vector3(0, 1, 0)).normalize();
        else perp.crossVectors(chain.endDir, new THREE.Vector3(1, 0, 0)).normalize();
        const zigAngle = (chain.zigzag % 2 === 0) ? 0.6 : -0.6;
        zigDir.copy(chain.endDir).multiplyScalar(0.8).add(perp.multiplyScalar(zigAngle)).normalize();

        const newC1Pos = chain.endPos.clone().add(zigDir.clone().multiplyScalar(BOND_LEN));
        const newC2Pos = newC1Pos.clone().add(zigDir.clone().multiplyScalar(BOND_LEN));

        // Snap monomer atoms to new positions
        aPX[c1] = newC1Pos.x; aPY[c1] = newC1Pos.y; aPZ[c1] = newC1Pos.z;
        aPX[c2] = newC2Pos.x; aPY[c2] = newC2Pos.y; aPZ[c2] = newC2Pos.z;

        // Position H's around the new carbons
        const hPerp1 = new THREE.Vector3().crossVectors(zigDir, new THREE.Vector3(0, 0, 1)).normalize();
        const hPerp2 = new THREE.Vector3().crossVectors(zigDir, hPerp1).normalize();
        if (atoms.length > 2) { aPX[atoms[2]] = newC1Pos.x + hPerp1.x * 0.9; aPY[atoms[2]] = newC1Pos.y + hPerp1.y * 0.9; aPZ[atoms[2]] = newC1Pos.z + hPerp1.z * 0.9; }
        if (atoms.length > 3) { aPX[atoms[3]] = newC1Pos.x - hPerp1.x * 0.9; aPY[atoms[3]] = newC1Pos.y - hPerp1.y * 0.9; aPZ[atoms[3]] = newC1Pos.z - hPerp1.z * 0.9; }
        if (atoms.length > 4) { aPX[atoms[4]] = newC2Pos.x + hPerp2.x * 0.9; aPY[atoms[4]] = newC2Pos.y + hPerp2.y * 0.9; aPZ[atoms[4]] = newC2Pos.z + hPerp2.z * 0.9; }
        if (atoms.length > 5) { aPX[atoms[5]] = newC2Pos.x - hPerp2.x * 0.9; aPY[atoms[5]] = newC2Pos.y - hPerp2.y * 0.9; aPZ[atoms[5]] = newC2Pos.z - hPerp2.z * 0.9; }

        // Kill monomer rigid body
        monAlive[mi] = 0;
        monTarget[mi] = -1;
        for (const ai of atoms) aMonomer[ai] = -1;
        for (const bi of monBonds[mi]) bMon[bi] = -1;

        // Create backbone bond from old chain end to new c1
        const lastBB = chain.backboneAtoms[chain.backboneAtoms.length - 1];
        const newBondIdx = addBond(lastBB, c1, -1);

        // Update chain
        chain.atoms.push(...atoms);
        chain.backboneAtoms.push(c1, c2);
        if (newBondIdx >= 0) chain.bondIndices.push(newBondIdx);
        chain.bondIndices.push(...monBonds[mi]);
        chain.endPos.copy(newC2Pos);
        chain.endDir.copy(zigDir);
        chain.lastGrowth = now;

        // Energy flash
        aEnergy[c1] = 1.0; aEnergy[c2] = 1.0; aEnergy[lastBB] = 0.7;

        // Sparks
        const sc = Math.random() < 0.5 ? TEAL.clone() : CORAL.clone();
        emitSparks(newC1Pos.x, newC1Pos.y, newC1Pos.z, sc.lerp(HIGHLIGHT, 0.3), 6);
      }
    }
  }

  // TERMINATION
  function tryTermination(now) {
    const rc = [];
    for (const [id, ch] of chains) if (ch.radical) rc.push(id);
    if (rc.length < 2) return;
    let best = 12.0, bi = -1, bj = -1;
    for (let i = 0; i < rc.length; i++) {
      const a = chains.get(rc[i]).endPos;
      for (let j = i + 1; j < rc.length; j++) {
        const b = chains.get(rc[j]).endPos;
        const d = a.distanceTo(b);
        if (d < best) { best = d; bi = i; bj = j; }
      }
    }
    if (bi === -1) return;
    const cA = chains.get(rc[bi]), cB = chains.get(rc[bj]);
    const eA = cA.backboneAtoms[cA.backboneAtoms.length - 1];
    const eB = cB.backboneAtoms[cB.backboneAtoms.length - 1];
    addBond(eA, eB, -1);
    cA.radical = false; cB.radical = false;
    // Merge B into A
    cA.atoms.push(...cB.atoms); cA.backboneAtoms.push(...cB.backboneAtoms);
    cA.bondIndices.push(...cB.bondIndices);
    chains.delete(rc[bj]);
    const mx = (cA.endPos.x + cB.endPos.x) / 2, my = (cA.endPos.y + cB.endPos.y) / 2, mz = (cA.endPos.z + cB.endPos.z) / 2;
    emitSparks(mx, my, mz, HIGHLIGHT.clone().lerp(new THREE.Color(0xffffff), 0.4), 14);
    aEnergy[eA] = 1.0; aEnergy[eB] = 1.0;
  }

  // SCISSION — break old chains, respawn monomers
  function tryScission(now) {
    for (const [id, chain] of chains) {
      if (chain.radical) continue;
      if (chain.backboneAtoms.length < 8) continue;
      const age = now - chain.birthTime;
      if (Math.random() > 0.0004 * chain.backboneAtoms.length + 0.0002 * age) continue;

      // Sparks at midpoint
      const mid = Math.floor(chain.atoms.length / 2);
      const midAtom = chain.atoms[Math.min(mid, chain.atoms.length - 1)];
      emitSparks(aPX[midAtom], aPY[midAtom], aPZ[midAtom], CORAL.clone().lerp(HIGHLIGHT, 0.5), 8);

      // Kill all bonds
      for (const bi of chain.bondIndices) { if (bi >= 0 && bi < bondCount) bAlive[bi] = 0; }

      // Kill all atoms
      for (const ai of chain.atoms) { aAlive[ai] = 0; aEnergy[ai] = 0; }

      chains.delete(id);

      // Respawn some monomers
      const respawn = Math.min(6, Math.floor(chain.backboneAtoms.length / 2));
      for (let i = 0; i < respawn; i++) spawnMonomer();
      break;
    }
  }

  // MONOMER RESPAWN — keep population up
  function respawnMonomers() {
    let aliveCount = 0;
    for (let mi = 0; mi < monCount; mi++) if (monAlive[mi]) aliveCount++;
    while (aliveCount < 80 && monCount < MAX_MONOMERS) {
      if (spawnMonomer() >= 0) aliveCount++;
      else break;
    }
  }

  /* ── Chemistry scheduler ── */
  let nextInit = 2.0, nextTerm = 0, nextScis = 5.0, nextRespawn = 0;
  function runChemistry(time) {
    if (time > nextInit) { initiateChain(time); nextInit = time + 2.5 + Math.random() * 3.5; }
    propagateChains(time);
    if (time > nextTerm) { tryTermination(time); nextTerm = time + 1.0 + Math.random() * 2.0; }
    if (time > nextScis) { tryScission(time); nextScis = time + 3.0 + Math.random() * 5.0; }
    if (time > nextRespawn) { respawnMonomers(); nextRespawn = time + 1.0; }
  }

  /* ═══════════════════════════════════════════════════════════
     RENDER UPDATES
     ═══════════════════════════════════════════════════════════ */
  function updateMouse3D() {
    raycaster.setFromCamera(mouse, camera);
    const lt = lookPath.getPointAt(Math.min(scrollSmoothed, 0.999));
    const cd = camera.getWorldDirection(new THREE.Vector3());
    const d = -lt.dot(cd);
    const plane = new THREE.Plane(cd.negate(), d);
    if (!raycaster.ray.intersectPlane(plane, mouse3D)) mouse3D.set(-9999, -9999, -9999);
  }

  function updateAtomInstances(time) {
    let vc = 0;
    for (let i = 0; i < atomCount; i++) {
      if (!aAlive[i]) continue;
      aEnergy[i] = Math.max(0, aEnergy[i] - 0.016 * 1.2);

      const e = aEnergy[i];
      const gs = 1 + e * 0.5;
      dummy.position.set(aPX[i], aPY[i], aPZ[i]);
      dummy.scale.setScalar(aRad[i] * gs);
      dummy.updateMatrix();
      atomMesh.setMatrixAt(vc, dummy.matrix);

      const i3 = vc * 3;
      let cr = aCR[i], cg = aCG[i], cb = aCB[i];
      if (e > 0.01) { cr = cr * (1 - e * 0.6) + HIGHLIGHT.r * e * 0.6; cg = cg * (1 - e * 0.6) + HIGHLIGHT.g * e * 0.6; cb = cb * (1 - e * 0.6) + HIGHLIGHT.b * e * 0.6; }

      // Mouse proximity
      const dx = aPX[i] - mouse3D.x, dy = aPY[i] - mouse3D.y, dz = aPZ[i] - mouse3D.z;
      const dM = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dM < 10 && dM > 0.01) { const p = Math.pow(1 - dM / 10, 2) * 0.25; cr += TEAL.r * p; cg += TEAL.g * p; cb += TEAL.b * p; }

      iColors[i3] = cr; iColors[i3 + 1] = cg; iColors[i3 + 2] = cb;
      vc++;
    }
    atomMesh.count = vc; atomMesh.instanceMatrix.needsUpdate = true; atomMesh.instanceColor.needsUpdate = true;
  }

  function updateBondInstances(time) {
    let vc = 0;
    for (let i = 0; i < bondCount; i++) {
      if (!bAlive[i]) continue;
      const a = bA[i], b = bB[i];
      if (!aAlive[a] || !aAlive[b]) continue;

      _dir.set(aPX[b] - aPX[a], aPY[b] - aPY[a], aPZ[b] - aPZ[a]);
      const len = _dir.length(); if (len < 0.01) continue;
      _dir.divideScalar(len); _quat.setFromUnitVectors(_up, _dir);
      dummy.position.set(aPX[a], aPY[a], aPZ[a]);
      dummy.quaternion.copy(_quat); dummy.scale.set(1, 1, len);
      dummy.updateMatrix(); bondMesh.setMatrixAt(vc, dummy.matrix);

      const eMax = Math.max(aEnergy[a], aEnergy[b]);
      let cr = BOND_COLOR.r, cg = BOND_COLOR.g, cb = BOND_COLOR.b;
      if (eMax > 0.01) { cr = cr * (1 - eMax * 0.7) + HIGHLIGHT.r * eMax * 0.7; cg = cg * (1 - eMax * 0.7) + HIGHLIGHT.g * eMax * 0.7; cb = cb * (1 - eMax * 0.7) + HIGHLIGHT.b * eMax * 0.7; }

      const i3 = vc * 3; bColors[i3] = cr; bColors[i3 + 1] = cg; bColors[i3 + 2] = cb;
      vc++;
    }
    bondMesh.count = vc; bondMesh.instanceMatrix.needsUpdate = true; bondMesh.instanceColor.needsUpdate = true;
  }

  function updateSparks(delta) {
    const active = [];
    const sP = sparkSys.geo.attributes.position.array;
    const sC = sparkSys.geo.attributes.aColor.array;
    const sA = sparkSys.geo.attributes.aAlpha.array;
    for (const s of sparks) { s.life -= s.decay * delta; if (s.life <= 0) continue;
      s.vel.multiplyScalar(0.94); s.pos.add(s.vel.clone().multiplyScalar(delta)); active.push(s); }
    for (let i = 0; i < SPARK_CAP; i++) { const i3 = i * 3;
      if (i < active.length) { const s = active[i]; sP[i3] = s.pos.x; sP[i3 + 1] = s.pos.y; sP[i3 + 2] = s.pos.z;
        sC[i3] = s.color.r; sC[i3 + 1] = s.color.g; sC[i3 + 2] = s.color.b; sA[i] = s.life;
      } else { sA[i] = 0; } }
    sparkSys.geo.attributes.position.needsUpdate = true;
    sparkSys.geo.attributes.aColor.needsUpdate = true;
    sparkSys.geo.attributes.aAlpha.needsUpdate = true;
    sparks = active;
  }

  function updateCamera(time) {
    scrollSmoothed += (scrollProgress - scrollSmoothed) * scrollDamping;
    const t = Math.min(scrollSmoothed, 0.9999);
    const cp = cameraPath.getPointAt(t), la = lookPath.getPointAt(t);
    const ss = 1 - t * 0.5;
    camera.position.set(cp.x + Math.sin(time * 0.3) * 0.8 * ss, cp.y + Math.cos(time * 0.25) * 0.5 * ss, cp.z);
    camera.lookAt(la.x, la.y, la.z);
    camera.fov = THREE.MathUtils.lerp(60, 75, t); camera.updateProjectionMatrix();
    scene.fog.density = THREE.MathUtils.lerp(0.0038, 0.015, t * t);
  }

  /* ── Click: initiate chain from nearest monomer ── */
  function onClick(e) {
    if (e.button !== 0) return;
    const mx = (e.clientX / window.innerWidth) * 2 - 1, my = -(e.clientY / window.innerHeight) * 2 + 1;
    // Find nearest monomer center to click
    let bestMi = -1, bestD = Infinity;
    for (let mi = 0; mi < monCount; mi++) {
      if (!monAlive[mi] || monTarget[mi] >= 0) continue;
      const v = new THREE.Vector3(monX[mi], monY[mi], monZ[mi]).project(camera);
      const d = Math.hypot(v.x - mx, v.y - my);
      if (d < bestD) { bestD = d; bestMi = mi; }
    }
    if (bestMi !== -1 && bestD < 0.2) {
      // Force initiate from this monomer
      const mi = bestMi, atoms = monAtoms[mi], c1 = atoms[0], c2 = atoms[1];
      monAlive[mi] = 0;
      for (const ai of atoms) aMonomer[ai] = -1;
      for (const bi of monBonds[mi]) bMon[bi] = -1;
      const now = clock.getElapsedTime();
      const chainId = nextChainId++;
      const endPos = new THREE.Vector3(aPX[c2], aPY[c2], aPZ[c2]);
      const endDir = new THREE.Vector3(aPX[c2] - aPX[c1], aPY[c2] - aPY[c1], aPZ[c2] - aPZ[c1]).normalize();
      chains.set(chainId, {
        atoms: [...atoms], backboneAtoms: [c1, c2], bondIndices: [...monBonds[mi]],
        endPos, endDir, radical: true, zigzag: 0, birthTime: now, lastGrowth: now });
      aEnergy[c1] = 1.0; aEnergy[c2] = 1.0;
      emitSparks(aPX[c1], aPY[c1], aPZ[c1], HIGHLIGHT.clone(), 12);
    }
  }
  window.addEventListener("click", onClick);

  /* ── Mouse proximity sparks ── */
  let lastProx = 0;
  function proximityInteraction(time) {
    if (time - lastProx < 0.5) return;
    for (let i = 0; i < atomCount; i++) { if (!aAlive[i]) continue;
      const dx = aPX[i] - mouse3D.x, dy = aPY[i] - mouse3D.y, dz = aPZ[i] - mouse3D.z;
      if (Math.sqrt(dx * dx + dy * dy + dz * dz) < 5 && Math.random() < 0.12) {
        aEnergy[i] = 0.8; emitSparks(aPX[i], aPY[i], aPZ[i], TEAL.clone().lerp(HIGHLIGHT, 0.3), 3);
        lastProx = time; break; } }
  }

  function updateFog(time) { solventFog.children.forEach((m, i) => { m.material.uniforms.uT.value = time; m.rotation.y += 0.0002 * (i % 2 === 0 ? 1 : -1); m.rotation.x += 0.00008; }); }
  function updateGhost(time) { ghostField.rotation.y = time * 0.004; ghostField.rotation.x = Math.sin(time * 0.012) * 0.03; }

  function onResize() { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight); sparkSys.pts.material.uniforms.uPR.value = renderer.getPixelRatio(); }
  window.addEventListener("resize", onResize);

  /* ═══════════════════════════════════════════════════════════
     MAIN LOOP
     ═══════════════════════════════════════════════════════════ */
  function animate() {
    const delta = Math.min(clock.getDelta(), 0.05);
    const time = clock.getElapsedTime();
    updateCamera(time);
    updateMouse3D();
    updateMonomers(delta, time);
    runChemistry(time);
    updateAtomInstances(time);
    updateBondInstances(time);
    updateSparks(delta);
    updateFog(time);
    updateGhost(time);
    proximityInteraction(time);
    renderer.render(scene, camera);
    animId = requestAnimationFrame(animate);
  }
  animate();

  function dispose() {
    if (animId) cancelAnimationFrame(animId);
    window.removeEventListener("resize", onResize);
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("click", onClick);
    window.removeEventListener("scroll", onScroll);
    scene.traverse(child => { if (child.geometry) child.geometry.dispose();
      if (child.material) { if (Array.isArray(child.material)) child.material.forEach(m => m.dispose()); else child.material.dispose(); } });
    renderer.dispose();
    if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
  }

  return { scene, camera, renderer, dispose };
}
