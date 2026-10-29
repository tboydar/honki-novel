import * as THREE from '../../vendor/three.module.js';
import { ISLAND_LINES } from '../data.js';
import { createOrbit, disposeScene, glowTexture, makeNoise, mulberry32, clamp, smoothstep, polarDisc, pickScreen, reduced } from '../util.js';

const R = 30;
const SEA_Y = -40;
const SUN = new THREE.Vector3(-0.35, 0.16, -1).normalize();

const SKY_FN = `
uniform vec3 uSun;
vec3 skyCol(vec3 d){
  float h = d.y;
  vec3 horizon = vec3(0.96, 0.62, 0.36), mid = vec3(0.22, 0.42, 0.55), top = vec3(0.05, 0.12, 0.25);
  vec3 c = mix(horizon, mid, smoothstep(0.0, 0.16, h));
  c = mix(c, top, smoothstep(0.12, 0.65, h));
  float s = max(dot(d, uSun), 0.0);
  c += vec3(1.0, 0.62, 0.3) * pow(s, 18.0) * 0.7 + vec3(1.0, 0.9, 0.7) * pow(s, 500.0) * 1.2;
  return c;
}`;
const SKY_VERT = `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const SKY_FRAG = `${SKY_FN} varying vec3 vP; void main(){ gl_FragColor = vec4(skyCol(normalize(vP)), 1.0); }`;
const SEA_VERT = `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const SEA_FRAG = `${SKY_FN}
uniform float uTime; varying vec3 vW;
void main(){
  vec3 V = normalize(vW - cameraPosition);
  vec2 p = vW.xz * 0.06;
  float amp = 1.0 / (1.0 + length(vW - cameraPosition) * 0.02);
  vec3 n = normalize(vec3(
    (sin(p.x * 3.1 + uTime * 0.6) * 0.05 + sin(p.y * 5.3 - uTime * 0.8) * 0.04 + sin((p.x + p.y) * 9.0 + uTime * 1.3) * 0.02) * amp,
    1.0,
    (cos(p.y * 2.7 + uTime * 0.5) * 0.05 + cos(p.x * 6.1 + uTime * 0.9) * 0.04 + cos((p.x - p.y) * 8.0 - uTime * 1.1) * 0.02) * amp));
  vec3 Rf = reflect(V, n); Rf.y = abs(Rf.y);
  float fres = pow(1.0 - max(dot(-V, n), 0.0), 3.0);
  vec3 col = mix(vec3(0.02, 0.09, 0.14), skyCol(Rf), 0.4 + 0.6 * fres);
  gl_FragColor = vec4(col, mix(0.74, 0.97, fres));
}`;
const FALL_VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FALL_FRAG = `uniform float uTime; varying vec2 vUv;
void main(){
  float x = vUv.x, v = vUv.y;
  float edge = smoothstep(0.0, 0.22, x) * smoothstep(1.0, 0.78, x);
  float streak = 0.5 + 0.5 * sin(x * 38.0 + sin(v * 9.0) * 2.0);
  float flow = 0.5 + 0.5 * sin(v * 26.0 + uTime * 4.0 + x * 7.0);
  float a = edge * (0.3 + 0.5 * flow * streak) * smoothstep(0.0, 0.3, v);
  gl_FragColor = vec4(vec3(0.88, 0.96, 1.0), a * 0.85);
}`;

export function create({ camera, canvas, sfx, ui }) {
  camera.near = 1; camera.far = 3200; camera.updateProjectionMatrix();
  const rand = mulberry32(168);
  const noise = makeNoise(168);
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x9c6f58, 0.0011);
  const uTime = { value: 0 };
  const uSun = { value: SUN };
  const glow = glowTexture(0.3);

  // ---- sky + sea ----
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1600, 32, 16),
    new THREE.ShaderMaterial({ vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, uniforms: { uSun }, side: THREE.BackSide, depthWrite: false, fog: false }));
  sky.renderOrder = -10;
  scene.add(sky);
  const sea = new THREE.Mesh(new THREE.CircleGeometry(1500, 64).rotateX(-Math.PI / 2),
    new THREE.ShaderMaterial({ vertexShader: SEA_VERT, fragmentShader: SEA_FRAG, uniforms: { uSun, uTime }, transparent: true, depthWrite: false }));
  sea.position.y = SEA_Y;
  sea.renderOrder = 5;
  scene.add(sea);

  scene.add(new THREE.HemisphereLight(0x9bb7d6, 0x4a3328, 1.5));
  const sun = new THREE.DirectionalLight(0xffb070, 2.6);
  sun.position.copy(SUN).multiplyScalar(100);
  scene.add(sun);
  const marketLights = [-8, 8].map((x) => {
    const l = new THREE.PointLight(0xffa050, 90, 24, 2);
    scene.add(l);
    return { l, x };
  });

  // ---- terrain ----
  const MARKET_Z = 14;
  const boxDist = (x, z) => { const dx = Math.max(Math.abs(x) - 15, 0), dz = Math.max(Math.abs(z - MARKET_Z) - 5, 0); return Math.hypot(dx, dz); };
  function hAt(x, z) {
    const r = Math.hypot(x, z);
    const nz = noise.fbm(x * 0.07, 1.3, z * 0.07, 4);
    const spine = Math.exp(-((z + 7) * (z + 7)) / 72) * Math.max(0, 1 - Math.abs(x) / (R * 0.92));
    const ridge = noise.fbm(x * 0.15, 4.1, z * 0.15, 3);
    const inland = 1.5 + (nz - 0.5) * 3.2 + spine * (8 + 12 * ridge);
    const flat = 1 - smoothstep(0, 5, boxDist(x, z));
    const land = inland + (1.3 - inland) * flat;
    const beach = smoothstep(R * 0.64, R, r);
    return land * (1 - beach) + (0.15 - 0.15 * smoothstep(R * 0.9, R, r)) * beach;
  }
  const cSand = new THREE.Color(0xe3cb92), cG1 = new THREE.Color(0x5d8a3f), cG2 = new THREE.Color(0x3d6a35);
  const cRock = new THREE.Color(0x857868), cSnow = new THREE.Color(0xf3e7d6);
  const terrain = new THREE.Mesh(
    polarDisc(0, R, 30, 72, hAt, (c, x, h, z, r) => {
      const n = noise.n3(x * 0.3, 2.2, z * 0.3);
      c.copy(cG1).lerp(cG2, n);
      c.lerp(cRock, smoothstep(4.5, 7.5, h));
      c.lerp(cSnow, smoothstep(10.5, 13, h));
      c.lerp(cSand, (1 - smoothstep(0.35, 1.1, h)) * smoothstep(R * 0.6, R * 0.75, r));
      if (boxDist(x, z) < 1.2) c.lerp(cSand, 0.55); // market street: packed earth
    }),
    new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));

  // rock underside
  const cliffGeo = new THREE.ConeGeometry(R * 1.005, 20, 18, 5, true).rotateX(Math.PI).translate(0, -10, 0);
  {
    const p = cliffGeo.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      if (y < -0.2) {
        const a = Math.atan2(p.getZ(i), p.getX(i));
        const k = 0.8 + 0.4 * noise.n3(Math.cos(a) * 3, y * 0.25, Math.sin(a) * 3);
        p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k);
        p.setY(i, y + (noise.n3(p.getX(i) * 0.2, 9, p.getZ(i) * 0.2) - 0.5) * 3);
      }
      c.set(0x6c5646).lerp(new THREE.Color(0x2c2a34), smoothstep(0, -20, y));
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    cliffGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  }
  const cliff = new THREE.Mesh(cliffGeo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide }));

  const core = new THREE.Group();   // static island content (also mirrored in the sea)
  core.add(terrain, cliff);

  // ---- rivers + waterfalls ----
  const riverMat = new THREE.MeshBasicMaterial({ color: 0x7cc3dd, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
  const fallMat = new THREE.ShaderMaterial({ vertexShader: FALL_VERT, fragmentShader: FALL_FRAG, uniforms: { uTime }, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  const fallGeo = new THREE.PlaneGeometry(2.4, 30, 1, 1).translate(0, -15, 0);
  const mistPos = [];
  for (const a of [1.0, 2.35, 4.9]) {
    const pts = [];
    for (let i = 0; i <= 24; i++) {
      const r = R * 0.26 + (R - R * 0.26) * (i / 24);
      const wob = Math.sin(i * 0.7 + a * 3) * 0.7;
      const x = Math.cos(a) * r - Math.sin(a) * wob, z = Math.sin(a) * r + Math.cos(a) * wob;
      pts.push([x, hAt(x, z) + 0.14, z]);
    }
    const pos = [], idx = [];
    pts.forEach((p, i) => {
      const w = 0.45 + 0.35 * (i / 24);
      pos.push(p[0] - Math.sin(a) * w, p[1], p[2] + Math.cos(a) * w, p[0] + Math.sin(a) * w, p[1], p[2] - Math.cos(a) * w);
      if (i < 24) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    core.add(new THREE.Mesh(g, riverMat));
    const f = new THREE.Mesh(fallGeo, fallMat);
    f.position.set(Math.cos(a) * (R + 0.7), 0.1, Math.sin(a) * (R + 0.7));
    f.rotation.y = Math.PI / 2 - a;
    core.add(f);
    mistPos.push([Math.cos(a) * (R + 2), -28, Math.sin(a) * (R + 2)]);
  }

  // ---- trees ----
  const treeGeo = new THREE.ConeGeometry(1, 3.2, 6, 1, true);
  const TREES = 110;
  const trees = new THREE.InstancedMesh(treeGeo, new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), TREES);
  {
    const d = new THREE.Object3D(), c = new THREE.Color();
    let n = 0, guard = 0;
    while (n < TREES && guard++ < 4000) {
      const a = rand() * 6.283, r = Math.sqrt(rand()) * R * 0.82;
      const x = Math.cos(a) * r, z = Math.sin(a) * r, h = hAt(x, z);
      if (h < 1.0 || h > 6 || boxDist(x, z) < 4) continue;
      const s = 0.7 + rand() * 0.7;
      d.position.set(x, h + 1.4 * s, z); d.scale.set(s, s, s); d.rotation.y = rand() * 6; d.updateMatrix();
      trees.setMatrixAt(n, d.matrix);
      trees.setColorAt(n, c.setHex(0x2f5f3a).lerp(new THREE.Color(0x5d8a3f), rand() * 0.6));
      n++;
    }
    trees.count = n;
  }
  core.add(trees);

  // ---- night market ----
  const stallGeo = new THREE.BoxGeometry(3, 0.9, 1.2);
  const roofGeo = new THREE.ConeGeometry(2.5, 1.1, 4).rotateY(Math.PI / 4);
  const poleGeo = new THREE.CylinderGeometry(0.06, 0.06, 2.5, 5);
  const foodGeo = new THREE.BoxGeometry(0.35, 0.22, 0.35);
  const counterMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2f, flatShading: true });
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x4a3a2c });
  const foodMat = new THREE.MeshBasicMaterial({ color: 0xffb04a });
  const roofMats = [0xc8322f, 0xd9a43b, 0xf0e6d2, 0x2f6f73].map((c) => new THREE.MeshLambertMaterial({ color: c, flatShading: true }));
  const gy = (x, z) => hAt(x, z);
  [-10, -5, 0, 5, 10].forEach((x, i) => {
    [[11.4, 1], [16.6, -1]].forEach(([z, face], j) => {
      const g = new THREE.Group();
      g.position.set(x, gy(x, z), z);
      if (face < 0) g.rotation.y = Math.PI;
      const c = new THREE.Mesh(stallGeo, counterMat); c.position.y = 0.45; g.add(c);
      const roof = new THREE.Mesh(roofGeo, roofMats[(i + j * 2) % 4]); roof.position.y = 3.0; g.add(roof);
      for (const px of [-1.4, 1.4]) { const p = new THREE.Mesh(poleGeo, poleMat); p.position.set(px, 1.25, 0.5); g.add(p); }
      for (const fx of [-0.9, 0, 0.9]) { const f = new THREE.Mesh(foodGeo, foodMat); f.position.set(fx, 1.0, 0.15); g.add(f); }
      core.add(g);
    });
  });
  // lantern strings
  const beadPos = [];
  const lineMat = new THREE.LineBasicMaterial({ color: 0x3a2a20 });
  function string(a, b, sag, step) {
    const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
    const len = va.distanceTo(vb), n = Math.max(2, Math.round(len / step));
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, p = va.clone().lerp(vb, t);
      p.y -= Math.sin(t * Math.PI) * sag;
      pts.push(p);
      if (i > 0 && i < n) beadPos.push(p.clone().setY(p.y - 0.25));
    }
    core.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat));
  }
  const top = 3.9;
  for (const z of [12.4, 15.6]) string([-13, gy(-13, z) + top, z], [13, gy(13, z) + top, z], 0.9, 0.9);
  for (const x of [-7.5, -2.5, 2.5, 7.5]) string([x, gy(x, 11) + top + 0.4, 11], [x, gy(x, 17) + top + 0.4, 17], 0.7, 0.8);
  for (const [x, z] of [[-13, 12.4], [-13, 15.6], [13, 12.4], [13, 15.6]]) {
    const p = new THREE.Mesh(poleGeo, poleMat); p.scale.y = 1.7; p.position.set(x, gy(x, z) + 2.1, z); core.add(p);
  }
  const beadGeo = new THREE.SphereGeometry(0.22, 6, 4);
  const beads = new THREE.InstancedMesh(beadGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }), beadPos.length);
  const warm = [0xff8a3c, 0xffc24a, 0xe8452f, 0xffa040];
  beadPos.forEach((p, i) => {
    const m = new THREE.Matrix4().makeTranslation(p.x, p.y, p.z);
    beads.setMatrixAt(i, m);
    beads.setColorAt(i, new THREE.Color(warm[i % 4]));
  });
  core.add(beads);
  const beadGlow = new THREE.Points(
    new THREE.BufferGeometry().setFromPoints(beadPos),
    new THREE.PointsMaterial({ map: glow, color: 0xffa040, size: 2.6, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }));
  core.add(beadGlow);
  // signboard
  const signCv = document.createElement('canvas');
  signCv.width = 256; signCv.height = 96;
  {
    const g = signCv.getContext('2d');
    g.fillStyle = '#c8322f'; g.fillRect(0, 0, 256, 96);
    g.strokeStyle = '#c9962e'; g.lineWidth = 6; g.strokeRect(5, 5, 246, 86);
    g.fillStyle = '#f4ecdc'; g.font = 'bold 54px "LXGW WenKai TC","Noto Serif TC",serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('滷肉飯', 128, 52);
  }
  const signTex = new THREE.CanvasTexture(signCv); signTex.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Sprite(new THREE.SpriteMaterial({ map: signTex }));
  sign.scale.set(5, 1.9, 1);
  sign.position.set(0, gy(0, 14) + 6.2, 14);
  core.add(sign);

  const island = new THREE.Group();
  island.add(core);
  scene.add(island);

  // mirror in the sea (static copy of the island, flipped around the water plane)
  const mirrorWrap = new THREE.Group();
  mirrorWrap.position.y = SEA_Y; mirrorWrap.scale.y = -1;
  const mirrorCore = core.clone();
  mirrorCore.position.y = -SEA_Y;
  mirrorWrap.add(mirrorCore);
  scene.add(mirrorWrap);

  // ---- clouds + mist ----
  const cloudTex = glowTexture(0.1);
  const cloudGroup = new THREE.Group();
  const cloudMat = new THREE.SpriteMaterial({ map: cloudTex, color: 0xf4d6bd, transparent: true, opacity: 0.55, depthWrite: false });
  for (let i = 0; i < 46; i++) {
    const a = rand() * 6.283, r = 6 + rand() * 70;
    const s = new THREE.Sprite(cloudMat);
    const sz = 20 + rand() * 24;
    s.scale.set(sz * 1.6, sz * 0.7, 1);
    s.position.set(Math.cos(a) * r, -22 - rand() * 12, Math.sin(a) * r);
    cloudGroup.add(s);
  }
  const mistMat = new THREE.SpriteMaterial({ map: cloudTex, color: 0xffffff, transparent: true, opacity: 0.7, depthWrite: false });
  mistPos.forEach((p) => { const m = new THREE.Sprite(mistMat); m.scale.set(16, 9, 1); m.position.set(...p); cloudGroup.add(m); });
  scene.add(cloudGroup);

  // ---- drifting paper lanterns ----
  const lanternGeo = new THREE.SphereGeometry(0.9, 10, 8);
  const lanternGlowMat = new THREE.SpriteMaterial({ map: glow, color: 0xffb060, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending });
  const lanterns = [];
  const lcols = [0xff8a3c, 0xffc24a, 0xe8452f, 0xf4ecdc];
  for (let i = 0; i < 12; i++) {
    const mat = new THREE.MeshBasicMaterial({ color: lcols[i % 4], transparent: true });
    const mesh = new THREE.Mesh(lanternGeo, mat);
    mesh.scale.set(0.8, 1.05, 0.8);
    const gl = new THREE.Sprite(lanternGlowMat);
    gl.scale.set(5, 5, 1);
    mesh.add(gl);
    scene.add(mesh);
    const L = { mesh, mat, a: rand() * 6.283, r: 14 + rand() * 34, y: -4 + rand() * 28, spd: 0.5 + rand() * 0.6, w: 0.05 + rand() * 0.06, ph: rand() * 6, released: 0, pos: mesh.position, rad: 1.2 };
    lanterns.push(L);
  }
  function respawn(L) {
    L.a = rand() * 6.283; L.r = 14 + rand() * 34; L.y = -8; L.spd = 0.5 + rand() * 0.6; L.released = 0;
  }

  const orbit = createOrbit({ target: new THREE.Vector3(0, -6, 0), theta: 0.5, elev: 0.24, radius: 82, min: 40, max: 230, elevMin: 0.02, elevMax: 1.25 });
  const k = reduced ? 0.3 : 1;
  let lastLine = -1;

  return {
    scene,
    update(t, dt) {
      uTime.value = t;
      orbit.apply(camera, t, dt);
      const bob = Math.sin(t * 0.5 * k) * 0.5 * k;
      island.position.y = bob;
      mirrorCore.position.y = -SEA_Y + bob;
      cloudGroup.rotation.y += dt * 0.008 * k;
      for (const m of marketLights) m.l.position.set(m.x, hAt(m.x, 14) + 3.2 + bob, 14);
      for (const L of lanterns) {
        L.y += L.spd * dt * (L.released ? 7 : 1) * k;
        L.a += L.w * dt * 0.2 * k;
        if (L.y > 34) respawn(L);
        L.mesh.position.set(Math.cos(L.a) * L.r + Math.sin(t * 0.6 + L.ph) * 0.8, L.y + bob, Math.sin(L.a) * L.r);
        const fade = smoothstep(-8, -2, L.y) * (1 - smoothstep(24, 34, L.y));
        L.mat.opacity = fade;
        L.mesh.children[0].visible = fade > 0.05;
        L.mesh.scale.y = 1.05 + Math.sin(t * 3 + L.ph) * 0.04;
      }
    },
    drag: orbit.drag,
    zoom: orbit.zoom,
    pick(x, y, coarse) {
      orbit.touch();
      const L = pickScreen(lanterns, camera, canvas, x, y, coarse, 30);
      if (!L || L.released) return;
      L.released = 1;
      sfx('chime');
      let i;
      do { i = Math.floor(Math.random() * ISLAND_LINES.length); } while (i === lastLine);
      lastLine = i;
      ui.showToast(ISLAND_LINES[i]);
    },
    setViewport() {},
    dispose() { disposeScene(scene); },
  };
}
