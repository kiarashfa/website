import * as THREE from "three";


function createCircleTexture() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');

  const gradient = ctx.createRadialGradient(
    size/2, size/2, 0,
    size/2, size/2, size/2
  );
  gradient.addColorStop(0,   'rgba(255,255,255,1)');
  gradient.addColorStop(0.5, 'rgba(255,255,255,0.9)');
  gradient.addColorStop(1,   'rgba(255,255,255,0.1)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.format   = THREE.RGBAFormat;
  return texture;
}

export function initThreeJS({ containerId = "canvas-container" } = {}) {
  const container = document.getElementById(containerId);
  if (!container) return { scene: null, camera: null, renderer: null, dispose: () => {} };

  /* ═══════════════════════════════════════════════════════════
     RENDERER & SCENE
     ═══════════════════════════════════════════════════════════ */
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 1);
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x010508, 0.003);

  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 800);

  const clock = new THREE.Clock();
  let animId = null;

  /* ═══════════════════════════════════════════════════════════
     PALETTE
     ═══════════════════════════════════════════════════════════ */
  const TEAL      = new THREE.Color(0x49c5b6);
  const CORAL     = new THREE.Color(0xff9398);
  const DEEP_TEAL = new THREE.Color(0x1a6b62);
  const DIM_TEAL  = new THREE.Color(0x49c5b6).multiplyScalar(0.07);
  const WHITE     = new THREE.Color(0xffffff);

  /* ═══════════════════════════════════════════════════════════
     SCROLL STATE — drives the camera journey
     ═══════════════════════════════════════════════════════════ */
  let scrollProgress = 0;
  let scrollSmoothed = 0;
  const scrollDamping = 0.04;

  function onScroll() {
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    scrollProgress = maxScroll > 0 ? window.scrollY / maxScroll : 0;
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ═══════════════════════════════════════════════════════════
     MOUSE STATE
     ═══════════════════════════════════════════════════════════ */
  const mouse = new THREE.Vector2(-9999, -9999);
  const mouse3D = new THREE.Vector3(-9999, -9999, -9999);
  const raycaster = new THREE.Raycaster();

  function onMouseMove(e) {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  }
  window.addEventListener("mousemove", onMouseMove, { passive: true });

  /* ═══════════════════════════════════════════════════════════
     CAMERA PATH — spline from vast distance into the core
     ═══════════════════════════════════════════════════════════ */
  const cameraPath = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 30, 200),
    new THREE.Vector3(-15, 20, 150),
    new THREE.Vector3(10, 10, 100),
    new THREE.Vector3(-5, 5, 60),
    new THREE.Vector3(8, -2, 35),
    new THREE.Vector3(-3, 3, 18),
    new THREE.Vector3(2, -1, 6),
  ], false, "catmullrom", 0.5);

  const lookPath = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(-2, -1, 0),
    new THREE.Vector3(3, 1, -5),
    new THREE.Vector3(0, 0, -10),
    new THREE.Vector3(2, -1, -15),
    new THREE.Vector3(-1, 1, -8),
    new THREE.Vector3(0, 0, 0),
  ], false, "catmullrom", 0.5);

  /* ═══════════════════════════════════════════════════════════
     NETWORK PARAMETERS
     ═══════════════════════════════════════════════════════════ */
  const NUM_NODES      = 500;
  const NETWORK_RADIUS = 55;
  const CONNECT_DIST   = 12;
  const MAX_EDGES_PER  = 5;
  const PULSE_CAP      = 200;
  const BURST_CAP      = 800;

  const nodes = [];
  const edges = [];
  let pulses  = [];
  let bursts  = [];
  const edgeLookup = new Map();

  /* ═══════════════════════════════════════════════════════════
     GENERATE VAST NETWORK — spherical, denser toward core
     ═══════════════════════════════════════════════════════════ */
  function generateNetwork() {
    const minDist = 4.2;
    let attempts = 0;
    const positions = [];

    while (positions.length < NUM_NODES && attempts < NUM_NODES * 50) {
      attempts++;
      const u = Math.random();
      const r = NETWORK_RADIUS * Math.pow(u, 0.45);
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.acos(2 * Math.random() - 1);

      const p = new THREE.Vector3(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta) * 0.7,
        r * Math.cos(phi)
      );

      let ok = true;
      for (const q of positions) {
        if (q.distanceTo(p) < minDist) { ok = false; break; }
      }
      if (ok) positions.push(p);
    }

    for (let i = 0; i < positions.length; i++) {
      const distFromCenter = positions[i].length();
      nodes.push({
        pos:       positions[i],
        restPos:   positions[i].clone(),
        vel:       new THREE.Vector3(),
        color:     Math.random() < 0.55 ? TEAL.clone() : CORAL.clone(),
        energy:    0,
        phase:     Math.random() * Math.PI * 2,
        freq:      0.2 + Math.random() * 0.3,
        neighbors: [],
        lastFired: -999,
        radius:    distFromCenter,
        baseSize:  0.5 + Math.random() * 0.6,
      });
    }

    for (let i = 0; i < nodes.length; i++) {
      const cands = [];
      for (let j = i + 1; j < nodes.length; j++) {
        const d = nodes[i].restPos.distanceTo(nodes[j].restPos);
        if (d < CONNECT_DIST) cands.push({ j, d });
      }
      cands.sort((a, b) => a.d - b.d);
      const take = Math.min(cands.length, MAX_EDGES_PER);
      for (let k = 0; k < take; k++) {
        const j = cands[k].j;
        if (!edges.some(e => (e.a === i && e.b === j) || (e.a === j && e.b === i))) {
          const idx = edges.length;
          edges.push({ a: i, b: j });
          nodes[i].neighbors.push(j);
          nodes[j].neighbors.push(i);
          edgeLookup.set(`${i}:${j}`, idx);
          edgeLookup.set(`${j}:${i}`, idx);
        }
      }
    }
  }
  generateNetwork();

  /* ═══════════════════════════════════════════════════════════
     DEEP SPACE — layered cosmic dust
     ═══════════════════════════════════════════════════════════ */
  function createCosmicDust() {
    const circleTexture = createCircleTexture();
    const layers = [
      { count: 3000, radius: 300, size: 1.2, opacity: 0.35, color: new THREE.Color(0x334455) },
      { count: 1500, radius: 180, size: 0.8, opacity: 0.5,  color: DEEP_TEAL },
      { count: 800,  radius: 100, size: 0.5, opacity: 0.6,  color: new THREE.Color(0x49c5b6) },
    ];
    const group = new THREE.Group();

    for (const layer of layers) {
      const positions = new Float32Array(layer.count * 3);
      for (let i = 0; i < layer.count; i++) {
        const i3 = i * 3;
        const r = layer.radius * (0.3 + Math.random() * 0.7);
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        positions[i3]     = r * Math.sin(phi) * Math.cos(theta);
        positions[i3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.65;
        positions[i3 + 2] = r * Math.cos(phi);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      const mat = new THREE.PointsMaterial({
        size: layer.size,
        color: layer.color,
        transparent: true,
        opacity: layer.opacity,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
	map: circleTexture,
	alphaMap: circleTexture,
      });
      group.add(new THREE.Points(geo, mat));
    }
    scene.add(group);
    return group;
  }
  const cosmicDust = createCosmicDust();

  /* ═══════════════════════════════════════════════════════════
     NEBULA FOG — volumetric shells with 3D noise
     ═══════════════════════════════════════════════════════════ */
  function createNebula() {
    const group = new THREE.Group();
    const shells = [
      { r: 70, color: TEAL,  opacity: 0.018 },
      { r: 55, color: CORAL, opacity: 0.015 },
      { r: 40, color: TEAL,  opacity: 0.022 },
      { r: 25, color: CORAL, opacity: 0.02  },
    ];

    const vert = `
      varying vec3 vNormal;
      varying vec3 vWorldPos;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;
    const frag = `
      uniform vec3 uColor;
      uniform float uOpacity;
      uniform float uTime;
      varying vec3 vNormal;
      varying vec3 vWorldPos;

      float hash(vec3 p) {
        p = fract(p * 0.3183099 + 0.1);
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }
      float noise3D(vec3 p) {
        vec3 i = floor(p);
        vec3 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(mix(hash(i), hash(i+vec3(1,0,0)), f.x),
              mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), f.x), f.y),
          mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), f.x),
              mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)), f.x), f.y), f.z);
      }

      void main() {
        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        float rim = 1.0 - abs(dot(viewDir, vNormal));
        rim = pow(rim, 2.5);

        float n = noise3D(vWorldPos * 0.06 + uTime * 0.03);
        n = n * 0.6 + 0.4;

        float alpha = rim * uOpacity * n;
        alpha += (1.0 - rim) * uOpacity * 0.15 * n;

        gl_FragColor = vec4(uColor, alpha);
      }
    `;

    for (const s of shells) {
      const geo = new THREE.IcosahedronGeometry(s.r, 4);
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uColor:   { value: s.color.clone() },
          uOpacity: { value: s.opacity },
          uTime:    { value: 0 },
        },
        vertexShader: vert,
        fragmentShader: frag,
        transparent: true,
        depthWrite: false,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.set(Math.random() * 2, Math.random() * 2, Math.random() * 2);
      group.add(mesh);
    }
    scene.add(group);
    return group;
  }
  const nebula = createNebula();

  /* ═══════════════════════════════════════════════════════════
     NODE RENDERING — GLSL point sprites with layered glow
     ═══════════════════════════════════════════════════════════ */
  function createNodeSystem() {
    const count = nodes.length;
    const pos    = new Float32Array(count * 3);
    const col    = new Float32Array(count * 3);
    const energy = new Float32Array(count);
    const sizes  = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const n = nodes[i];
      pos[i*3] = n.pos.x; pos[i*3+1] = n.pos.y; pos[i*3+2] = n.pos.z;
      col[i*3] = n.color.r; col[i*3+1] = n.color.g; col[i*3+2] = n.color.b;
      energy[i] = 0;
      sizes[i]  = n.baseSize;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aColor",   new THREE.BufferAttribute(col, 3));
    geo.setAttribute("aEnergy",  new THREE.BufferAttribute(energy, 1));
    geo.setAttribute("aSize",    new THREE.BufferAttribute(sizes, 1));

    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uPixelRatio: { value: renderer.getPixelRatio() } },
      vertexShader: `
        attribute vec3 aColor;
        attribute float aEnergy;
        attribute float aSize;
        uniform float uTime;
        uniform float uPixelRatio;
        varying vec3 vColor;
        varying float vEnergy;
        void main() {
          vColor = aColor;
          vEnergy = aEnergy;
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          float scale = aSize * (1.0 + aEnergy * 3.0);
          gl_PointSize = clamp(scale * (280.0 / -mvPos.z) * uPixelRatio, 1.0, 80.0);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vEnergy;
        void main() {
          float d = length(gl_PointCoord - 0.5) * 2.0;
          float core  = exp(-d * d * 12.0);
          float inner = exp(-d * d * 3.0) * 0.6;
          float outer = exp(-d * d * 0.8) * 0.2;
          float intensity = core + inner + outer;
          float boost = 1.0 + vEnergy * 2.5;
          intensity *= (0.4 + 0.6 * boost / 3.5);
          vec3 col = vColor * intensity * boost;
          col += vec3(1.0) * core * vEnergy * 1.2;
          col += vec3(1.0, 0.85, 0.7) * inner * vEnergy * 0.4;
          float alpha = clamp(intensity * (0.6 + vEnergy * 0.6), 0.0, 1.0);
          if (alpha < 0.01) discard;
          gl_FragColor = vec4(col, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const points = new THREE.Points(geo, mat);
    scene.add(points);
    return { points, geo, mat };
  }
  const nodeSystem = createNodeSystem();

  /* ═══════════════════════════════════════════════════════════
     EDGE RENDERING
     ═══════════════════════════════════════════════════════════ */
  function createEdgeSystem() {
    const count = edges.length;
    const pos     = new Float32Array(count * 6);
    const col     = new Float32Array(count * 6);
    const baseCol = new Float32Array(count * 6);

    for (let i = 0; i < count; i++) {
      const e = edges[i];
      const a = nodes[e.a].pos;
      const b = nodes[e.b].pos;
      const i6 = i * 6;
      pos[i6]=a.x; pos[i6+1]=a.y; pos[i6+2]=a.z;
      pos[i6+3]=b.x; pos[i6+4]=b.y; pos[i6+5]=b.z;
      baseCol[i6]=DIM_TEAL.r; baseCol[i6+1]=DIM_TEAL.g; baseCol[i6+2]=DIM_TEAL.b;
      baseCol[i6+3]=DIM_TEAL.r; baseCol[i6+4]=DIM_TEAL.g; baseCol[i6+5]=DIM_TEAL.b;
      col.set(baseCol.slice(i6, i6+6), i6);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color",    new THREE.BufferAttribute(col, 3));

    const mat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const lines = new THREE.LineSegments(geo, mat);
    scene.add(lines);
    return { lines, geo, pos, col, baseCol };
  }
  const edgeSystem = createEdgeSystem();

  /* ═══════════════════════════════════════════════════════════
     PULSE SPRITES — glowing orbs traveling along edges
     ═══════════════════════════════════════════════════════════ */
  function createPulseSystem() {
    const pos   = new Float32Array(PULSE_CAP * 3);
    const col   = new Float32Array(PULSE_CAP * 3);
    const sizes = new Float32Array(PULSE_CAP);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aColor",   new THREE.BufferAttribute(col, 3));
    geo.setAttribute("aSize",    new THREE.BufferAttribute(sizes, 1));

    const mat = new THREE.ShaderMaterial({
      uniforms: { uPixelRatio: { value: renderer.getPixelRatio() } },
      vertexShader: `
        attribute vec3 aColor;
        attribute float aSize;
        uniform float uPixelRatio;
        varying vec3 vColor;
        void main() {
          vColor = aColor;
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = clamp(aSize * (200.0 / -mvPos.z) * uPixelRatio, 0.0, 50.0);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        void main() {
          float d = length(gl_PointCoord - 0.5) * 2.0;
          float glow = exp(-d * d * 4.0);
          float outer = exp(-d * d * 1.0) * 0.3;
          float a = glow + outer;
          if (a < 0.01) discard;
          gl_FragColor = vec4(vColor * (glow * 2.0 + outer), a);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const points = new THREE.Points(geo, mat);
    scene.add(points);
    return { points, geo };
  }
  const pulseSystem = createPulseSystem();

  /* ═══════════════════════════════════════════════════════════
     BURST PARTICLES — sparks on neuron fire
     ═══════════════════════════════════════════════════════════ */
  function createBurstSystem() {
    const pos    = new Float32Array(BURST_CAP * 3);
    const col    = new Float32Array(BURST_CAP * 3);
    const alphas = new Float32Array(BURST_CAP);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aColor",   new THREE.BufferAttribute(col, 3));
    geo.setAttribute("aAlpha",   new THREE.BufferAttribute(alphas, 1));

    const mat = new THREE.ShaderMaterial({
      uniforms: { uPixelRatio: { value: renderer.getPixelRatio() } },
      vertexShader: `
        attribute vec3 aColor;
        attribute float aAlpha;
        uniform float uPixelRatio;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vColor = aColor;
          vAlpha = aAlpha;
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = clamp(aAlpha * (120.0 / -mvPos.z) * uPixelRatio, 0.0, 30.0);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          float d = length(gl_PointCoord - 0.5) * 2.0;
          float a = exp(-d * d * 5.0) * vAlpha;
          if (a < 0.01) discard;
          gl_FragColor = vec4(vColor * 1.6, a);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const points = new THREE.Points(geo, mat);
    scene.add(points);
    return { points, geo };
  }
  const burstSys = createBurstSystem();

  /* ═══════════════════════════════════════════════════════════
     FIRING LOGIC
     ═══════════════════════════════════════════════════════════ */
  function fireNode(idx, now) {
    if (idx < 0 || idx >= nodes.length) return;
    const n = nodes[idx];
    if (now - n.lastFired < 0.45) return;
    n.energy = 1.0;
    n.lastFired = now;

    for (const neigh of n.neighbors) {
      if (pulses.length >= PULSE_CAP) break;
      pulses.push({
        from: idx, to: neigh,
        t: 0,
        speed: 0.2 + Math.random() * 0.3,
        color: n.color.clone(),
      });
    }

    const sparkCount = 5 + Math.floor(Math.random() * 6);
    for (let s = 0; s < sparkCount; s++) {
      if (bursts.length >= BURST_CAP) break;
      const dir = new THREE.Vector3(
        (Math.random()-0.5), (Math.random()-0.5), (Math.random()-0.5)
      ).normalize().multiplyScalar(2 + Math.random() * 4);
      bursts.push({
        pos: n.pos.clone(),
        vel: dir,
        life: 1.0,
        decay: 1.0 + Math.random() * 1.5,
        color: n.color.clone().lerp(WHITE, 0.3),
      });
    }
  }

  function seedActivity(now) {
    for (let i = 0; i < 10; i++) {
      fireNode(Math.floor(Math.random() * nodes.length), now + i * 0.3);
    }
  }

  /* ═══════════════════════════════════════════════════════════
     UPDATE FUNCTIONS
     ═══════════════════════════════════════════════════════════ */
  function updateMouse3D() {
    raycaster.setFromCamera(mouse, camera);
    const lookTarget = lookPath.getPointAt(Math.min(scrollSmoothed, 0.999));
    const camDir = camera.getWorldDirection(new THREE.Vector3());
    const d = -lookTarget.dot(camDir);
    const plane = new THREE.Plane(camDir.negate(), d);
    const hit = raycaster.ray.intersectPlane(plane, mouse3D);
    if (!hit) mouse3D.set(-9999, -9999, -9999);
  }

  function updateNodes(delta, time) {
    const posArr    = nodeSystem.geo.attributes.position.array;
    const energyArr = nodeSystem.geo.attributes.aEnergy.array;

    const breathe = Math.sin(time * 0.25) * 0.012;

    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      n.energy = Math.max(0, n.energy - delta * 1.8);

      const drift = new THREE.Vector3(
        Math.sin(time * n.freq + n.phase) * 0.35,
        Math.cos(time * n.freq * 0.8 + n.phase * 1.3) * 0.28,
        Math.sin(time * n.freq * 1.2 + n.phase * 0.7) * 0.22
      );

      const breathDir = n.restPos.clone().normalize().multiplyScalar(breathe * n.radius);

      const toMouse = new THREE.Vector3().subVectors(mouse3D, n.pos);
      const dMouse = toMouse.length();
      if (dMouse < 16 && dMouse > 0.01) {
        const strength = Math.pow(1 - dMouse / 16, 2);
        const tangent = new THREE.Vector3(-toMouse.y, toMouse.x, toMouse.z * 0.3).normalize();
        const attract = toMouse.normalize().multiplyScalar(strength * 1.5);
        const swirl   = tangent.multiplyScalar(strength * 3.0);
        n.vel.add(swirl.add(attract).multiplyScalar(delta));
      }

      const spring = new THREE.Vector3().subVectors(n.restPos, n.pos).multiplyScalar(3.0 * delta);
      n.vel.add(spring);
      n.vel.multiplyScalar(0.88);

      n.pos.add(n.vel.clone().multiplyScalar(delta * 6));
      n.pos.add(drift.multiplyScalar(delta));
      n.pos.add(breathDir);

      const i3 = i * 3;
      posArr[i3] = n.pos.x; posArr[i3+1] = n.pos.y; posArr[i3+2] = n.pos.z;
      energyArr[i] = n.energy;
    }

    nodeSystem.geo.attributes.position.needsUpdate = true;
    nodeSystem.geo.attributes.aEnergy.needsUpdate  = true;
    nodeSystem.mat.uniforms.uTime.value = time;
  }

  function updateEdges() {
    const { pos, col, baseCol, geo } = edgeSystem;
    col.set(baseCol);

    for (let i = 0; i < edges.length; i++) {
      const e = edges[i];
      const a = nodes[e.a];
      const b = nodes[e.b];
      const i6 = i * 6;

      pos[i6]=a.pos.x; pos[i6+1]=a.pos.y; pos[i6+2]=a.pos.z;
      pos[i6+3]=b.pos.x; pos[i6+4]=b.pos.y; pos[i6+5]=b.pos.z;

      const mx=(a.pos.x+b.pos.x)*0.5, my=(a.pos.y+b.pos.y)*0.5, mz=(a.pos.z+b.pos.z)*0.5;
      const dM = Math.sqrt((mx-mouse3D.x)**2 + (my-mouse3D.y)**2 + (mz-mouse3D.z)**2);
      if (dM < 14) {
        const g = Math.pow(1-dM/14, 2) * 0.35;
        col[i6]+=TEAL.r*g; col[i6+1]+=TEAL.g*g; col[i6+2]+=TEAL.b*g;
        col[i6+3]+=TEAL.r*g; col[i6+4]+=TEAL.g*g; col[i6+5]+=TEAL.b*g;
      }

      const eA = a.energy * 0.5;
      const eB = b.energy * 0.5;
      if (eA > 0.02) {
        col[i6]+=a.color.r*eA; col[i6+1]+=a.color.g*eA; col[i6+2]+=a.color.b*eA;
      }
      if (eB > 0.02) {
        col[i6+3]+=b.color.r*eB; col[i6+4]+=b.color.g*eB; col[i6+5]+=b.color.b*eB;
      }
    }

    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate    = true;
  }

  function updatePulses(delta, time) {
    const active = [];
    const eCol = edgeSystem.col;
    const pPos = pulseSystem.geo.attributes.position.array;
    const pCol = pulseSystem.geo.attributes.aColor.array;
    const pSiz = pulseSystem.geo.attributes.aSize.array;

    for (const p of pulses) {
      p.t += p.speed * delta;
      if (p.t >= 1) {
        fireNode(p.to, time);
        continue;
      }
      active.push(p);

      const eIdx = edgeLookup.get(`${p.from}:${p.to}`);
      if (eIdx !== undefined) {
        const bright = Math.sin(p.t * Math.PI) * 0.9;
        const i6 = eIdx * 6;
        eCol[i6]+=p.color.r*bright; eCol[i6+1]+=p.color.g*bright; eCol[i6+2]+=p.color.b*bright;
        eCol[i6+3]+=p.color.r*bright; eCol[i6+4]+=p.color.g*bright; eCol[i6+5]+=p.color.b*bright;
      }
    }
    edgeSystem.geo.attributes.color.needsUpdate = true;

    for (let i = 0; i < PULSE_CAP; i++) {
      const i3 = i * 3;
      if (i < active.length) {
        const p = active[i];
        const from = nodes[p.from].pos;
        const to   = nodes[p.to].pos;
        const t = p.t;

        // Slight arc via bezier
        const mid = new THREE.Vector3().lerpVectors(from, to, 0.5);
        const dir = new THREE.Vector3().subVectors(to, from);
        const perp = new THREE.Vector3(-dir.y, dir.x, dir.z*0.5).normalize();
        mid.add(perp.multiplyScalar(Math.sin(t * Math.PI) * 0.6));

        const omt = 1 - t;
        pPos[i3]   = omt*omt*from.x + 2*omt*t*mid.x + t*t*to.x;
        pPos[i3+1] = omt*omt*from.y + 2*omt*t*mid.y + t*t*to.y;
        pPos[i3+2] = omt*omt*from.z + 2*omt*t*mid.z + t*t*to.z;

        const brightness = 0.8 + Math.sin(t * Math.PI) * 0.8;
        pCol[i3]   = p.color.r*brightness + 0.3;
        pCol[i3+1] = p.color.g*brightness + 0.2;
        pCol[i3+2] = p.color.b*brightness + 0.2;
        pSiz[i]    = 0.6 + Math.sin(t * Math.PI) * 0.5;
      } else {
        pSiz[i] = 0;
      }
    }

    pulseSystem.geo.attributes.position.needsUpdate = true;
    pulseSystem.geo.attributes.aColor.needsUpdate   = true;
    pulseSystem.geo.attributes.aSize.needsUpdate    = true;
    pulses = active;
  }

  function updateBursts(delta) {
    const active = [];
    const bPos = burstSys.geo.attributes.position.array;
    const bCol = burstSys.geo.attributes.aColor.array;
    const bAlp = burstSys.geo.attributes.aAlpha.array;

    for (const b of bursts) {
      b.life -= b.decay * delta;
      if (b.life <= 0) continue;
      b.vel.multiplyScalar(0.95);
      b.pos.add(b.vel.clone().multiplyScalar(delta));
      active.push(b);
    }

    for (let i = 0; i < BURST_CAP; i++) {
      const i3 = i * 3;
      if (i < active.length) {
        const b = active[i];
        bPos[i3]=b.pos.x; bPos[i3+1]=b.pos.y; bPos[i3+2]=b.pos.z;
        bCol[i3]=b.color.r; bCol[i3+1]=b.color.g; bCol[i3+2]=b.color.b;
        bAlp[i] = b.life;
      } else {
        bAlp[i] = 0;
      }
    }

    burstSys.geo.attributes.position.needsUpdate = true;
    burstSys.geo.attributes.aColor.needsUpdate   = true;
    burstSys.geo.attributes.aAlpha.needsUpdate   = true;
    bursts = active;
  }

  /* ═══════════════════════════════════════════════════════════
     CAMERA — scroll-driven dive into the network heart
     ═══════════════════════════════════════════════════════════ */
  function updateCamera(time) {
    scrollSmoothed += (scrollProgress - scrollSmoothed) * scrollDamping;
    const t = Math.min(scrollSmoothed, 0.9999);

    const camPos = cameraPath.getPointAt(t);
    const lookAt = lookPath.getPointAt(t);

    // Organic micro-sway, diminishes as you go deeper
    const swayScale = 1 - t * 0.5;
    const swayX = Math.sin(time * 0.3) * 0.8 * swayScale;
    const swayY = Math.cos(time * 0.25) * 0.5 * swayScale;

    camera.position.set(camPos.x + swayX, camPos.y + swayY, camPos.z);
    camera.lookAt(lookAt.x, lookAt.y, lookAt.z);

    // FOV widens as you enter → immersive
    camera.fov = THREE.MathUtils.lerp(60, 75, t);
    camera.updateProjectionMatrix();

    // Fog thickens inside the network
    scene.fog.density = THREE.MathUtils.lerp(0.003, 0.012, t * t);
  }

  /* ═══════════════════════════════════════════════════════════
     SPONTANEOUS ACTIVITY
     ═══════════════════════════════════════════════════════════ */
  let nextFire = 0;
  function spontaneousActivity(time) {
    if (time > nextFire) {
      const count = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < count; i++) {
        fireNode(Math.floor(Math.random() * nodes.length), time);
      }
      nextFire = time + 0.3 + Math.random() * 0.9;
    }
  }

  /* ═══════════════════════════════════════════════════════════
     MOUSE PROXIMITY FIRING
     ═══════════════════════════════════════════════════════════ */
  let lastProxFire = 0;
  function proximityInteraction(time) {
    if (time - lastProxFire < 0.35) return;
    for (let i = 0; i < nodes.length; i++) {
      const d = nodes[i].pos.distanceTo(mouse3D);
      if (d < 6 && Math.random() < 0.2) {
        fireNode(i, time);
        lastProxFire = time;
        break;
      }
    }
  }

  /* ═══════════════════════════════════════════════════════════
     CLICK → CASCADE
     ═══════════════════════════════════════════════════════════ */
  function onClick(e) {
    if (e.button !== 0) return;
    const mx = (e.clientX / window.innerWidth) * 2 - 1;
    const my = -(e.clientY / window.innerHeight) * 2 + 1;
    let closest = -1, minD = Infinity;
    for (let i = 0; i < nodes.length; i++) {
      const s = nodes[i].pos.clone().project(camera);
      const d = Math.hypot(s.x - mx, s.y - my);
      if (d < minD) { minD = d; closest = i; }
    }
    if (closest !== -1 && minD < 0.12) {
      const now = clock.getElapsedTime();
      fireNode(closest, now);
      const n = nodes[closest];
      for (let i = 0; i < Math.min(n.neighbors.length, 4); i++) {
        setTimeout(() => fireNode(n.neighbors[i], clock.getElapsedTime()), 60 + i * 50);
      }
    }
  }
  window.addEventListener("click", onClick);

  /* ═══════════════════════════════════════════════════════════
     NEBULA + DUST ANIMATION
     ═══════════════════════════════════════════════════════════ */
  function updateNebula(time) {
    nebula.children.forEach((mesh, i) => {
      mesh.material.uniforms.uTime.value = time;
      mesh.rotation.y += 0.0003 * (i % 2 === 0 ? 1 : -1);
      mesh.rotation.x += 0.0001;
    });
  }

  function updateDust(time) {
    cosmicDust.rotation.y = time * 0.008;
    cosmicDust.rotation.x = Math.sin(time * 0.02) * 0.05;
  }

  /* ═══════════════════════════════════════════════════════════
     RESIZE
     ═══════════════════════════════════════════════════════════ */
  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    const pr = renderer.getPixelRatio();
    nodeSystem.mat.uniforms.uPixelRatio.value = pr;
    pulseSystem.geo.parent && (pulseSystem.points.material.uniforms.uPixelRatio.value = pr);
    burstSys.points.material.uniforms.uPixelRatio.value = pr;
  }
  window.addEventListener("resize", onResize);

  /* ═══════════════════════════════════════════════════════════
     MAIN LOOP
     ═══════════════════════════════════════════════════════════ */
  seedActivity(0);

  function animate() {
    const delta = Math.min(clock.getDelta(), 0.05);
    const time  = clock.getElapsedTime();

    updateCamera(time);
    updateMouse3D();
    updateNodes(delta, time);
    updateEdges();
    updatePulses(delta, time);
    updateBursts(delta);
    updateNebula(time);
    updateDust(time);
    spontaneousActivity(time);
    proximityInteraction(time);

    renderer.render(scene, camera);
    animId = requestAnimationFrame(animate);
  }
  animate();

  /* ═══════════════════════════════════════════════════════════
     CLEANUP
     ═══════════════════════════════════════════════════════════ */
  function dispose() {
    if (animId) cancelAnimationFrame(animId);
    window.removeEventListener("resize", onResize);
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("click", onClick);
    window.removeEventListener("scroll", onScroll);
    scene.traverse(child => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
        else child.material.dispose();
      }
    });
    renderer.dispose();
    if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
  }

  return { scene, camera, renderer, dispose };
}