import * as THREE from '../../vendor/three.module.js';
import { CONTINENTS } from '../data.js';
import { createOrbit, disposeScene, makeNoise, mulberry32, smoothstep, clamp, reduced } from '../util.js';

const R = 20;
const SUN = new THREE.Vector3(0.7, 0.35, 0.65).normalize();
const deg = Math.PI / 180;
// lat, lon (deg), angular radius (rad)
const DEFS = [
  { lat: 15, lon: 0, rad: 0.62 },    // desert
  { lat: 75, lon: 150, rad: 0.56 },  // ice
  { lat: -10, lon: 100, rad: 0.6 },  // rainforest
  { lat: -25, lon: 200, rad: 0.5 },  // volcanic
  { lat: 25, lon: 290, rad: 0.55 },  // crystal
];

const VERT = `
attribute vec3 color; attribute float aBiome; attribute float aW;
varying vec3 vN; varying vec3 vC; varying vec3 vD; varying float vB; varying float vW; varying vec3 vP;
void main(){
  vD = normalize(position);
  vN = normalize(mat3(modelMatrix) * normal);
  vC = color; vB = aBiome; vW = aW;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vP = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const FRAG = `
uniform float uTime; uniform vec3 uSun;
varying vec3 vN; varying vec3 vC; varying vec3 vD; varying float vB; varying float vW; varying vec3 vP;
void main(){
  vec3 n = normalize(vN);
  float dif = max(dot(n, uSun), 0.0);
  vec3 col = vC * (0.26 + 0.9 * dif);
  if (vW < 0.1) {
    vec3 V = normalize(cameraPosition - vP);
    float spec = pow(max(dot(reflect(-uSun, n), V), 0.0), 36.0);
    col += vec3(0.8, 0.9, 1.0) * spec * 0.45;
  } else if (abs(vB - 4.0) < 0.5) {
    float lon = atan(vD.z, vD.x), lat = asin(clamp(vD.y, -1.0, 1.0));
    vec2 f = abs(fract(vec2(lon, lat) * 6.0) - 0.5);
    float line = smoothstep(0.42, 0.5, max(f.x, f.y));
    float pulse = 0.55 + 0.45 * sin(uTime * 2.0 + (lon + lat) * 5.0);
    col += vec3(0.3, 1.0, 0.95) * line * pulse * vW * 0.9;
  } else if (abs(vB - 3.0) < 0.5 && vC.r > 0.55) {
    col = vC * (0.95 + 0.25 * sin(uTime * 1.6 + vD.x * 18.0 + vD.z * 11.0));
  }
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;
const ATMO_VERT = `varying vec3 vN; varying vec3 vV;
void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`;
const ATMO_FRAG = `varying vec3 vN; varying vec3 vV;
void main(){ float f = pow(clamp(-dot(vN, vV), 0.0, 1.0), 1.8); gl_FragColor = vec4(0.45, 0.75, 1.0, f * 1.1); }`;

function labelTexture(text) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#f4ecdc'; g.fillRect(0, 0, 256, 64);
  g.strokeStyle = '#141210'; g.lineWidth = 4; g.strokeRect(2, 2, 252, 60);
  g.fillStyle = '#141210'; g.font = 'bold 30px "LXGW WenKai TC","Noto Serif TC",serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 128, 34);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function create({ camera, canvas, sfx, ui }) {
  camera.near = 1; camera.far = 4000; camera.updateProjectionMatrix();
  const rand = mulberry32(5050);
  const noise = makeNoise(5050);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x04060e);

  // stars
  {
    const N = 1600, p = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const u = rand() * 2 - 1, a = rand() * 6.283, s = Math.sqrt(1 - u * u), r = 1500;
      p[i * 3] = Math.cos(a) * s * r; p[i * 3 + 1] = u * r; p[i * 3 + 2] = Math.sin(a) * s * r;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xdfe9ff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.8 }));
    pts.frustumCulled = false;
    scene.add(pts);
  }

  // ---- globe ----
  const centers = DEFS.map((d) => new THREE.Vector3(Math.cos(d.lat * deg) * Math.cos(d.lon * deg), Math.sin(d.lat * deg), Math.cos(d.lat * deg) * Math.sin(d.lon * deg)));
  const geo = new THREE.SphereGeometry(R, 96, 72);
  {
    const p = geo.attributes.position;
    const col = new Float32Array(p.count * 3), biome = new Float32Array(p.count), wt = new Float32Array(p.count);
    const d = new THREE.Vector3(), c = new THREE.Color(), lc = new THREE.Color();
    const deep = new THREE.Color(0x0d3560), shallow = new THREE.Color(0x2a8fb0);
    const cols = {
      desert: [new THREE.Color(0xd9a45b), new THREE.Color(0xb8702f), new THREE.Color(0xf0c98a)],
      ice: [new THREE.Color(0xe8f4f8), new THREE.Color(0x9cc7dc), new THREE.Color(0x5f93b3)],
      forest: [new THREE.Color(0x2f7d3a), new THREE.Color(0x15502a), new THREE.Color(0x6fae4a)],
      volcano: [new THREE.Color(0x2b211f), new THREE.Color(0x4a3630), new THREE.Color(0xff5a1f)],
      crystal: [new THREE.Color(0x103848), new THREE.Color(0x1e6a78), new THREE.Color(0x7ae7ff)],
    };
    for (let i = 0; i < p.count; i++) {
      d.set(p.getX(i), p.getY(i), p.getZ(i)).normalize();
      let best = -1, bw = 0, near = 0, bd = 9;
      for (let k = 0; k < 5; k++) {
        const ang = Math.acos(clamp(d.dot(centers[k]), -1, 1));
        const b = DEFS[k].rad * (1 + 0.34 * (noise.fbm(d.x * 2.6 + k * 11, d.y * 2.6, d.z * 2.6, 3) - 0.5) * 2);
        const w = 1 - smoothstep(b * 0.72, b, ang);
        near = Math.max(near, 1 - smoothstep(b, b * 1.3, ang));
        if (w > bw) { bw = w; best = k; bd = ang; }
      }
      c.copy(deep).lerp(shallow, near);
      let lift = 0;
      if (best >= 0 && bw > 0.001) {
        const n = noise.fbm(d.x * 5, d.y * 5, d.z * 5, 4), n2 = noise.fbm(d.x * 9 + 3, d.y * 9, d.z * 9, 3);
        const [a, b2, hi] = Object.values(cols)[best];
        if (best === 0) { lc.copy(a).lerp(b2, 0.5 + 0.5 * Math.sin((d.x * 12 + d.z * 8 + n * 5) * 3)).lerp(hi, smoothstep(0.55, 0.8, n) * 0.5); }
        else if (best === 1) { lc.copy(a).lerp(b2, n); if (Math.abs(n2 - 0.5) < 0.03) lc.copy(hi); }
        else if (best === 2) { lc.copy(a).lerp(b2, n); lc.lerp(hi, smoothstep(0.62, 0.8, n2) * 0.7); }
        else if (best === 3) { lc.copy(a).lerp(b2, n); if (Math.abs(n2 - 0.5) < 0.04 || bd < 0.09) lc.copy(hi); }
        else { lc.copy(a).lerp(b2, n); lc.lerp(hi, smoothstep(0.62, 0.85, n2) * 0.8); }
        c.lerp(lc, smoothstep(0.0, 0.25, bw));
        lift = smoothstep(0.0, 0.3, bw) * (0.35 + 0.9 * n);
        if (best === 3) lift += 1.8 * Math.exp(-(bd * bd) / 0.02);
        if (best === 0) lift *= 0.7;
      }
      const rr = R + lift * 0.9;
      p.setXYZ(i, d.x * rr, d.y * rr, d.z * rr);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      biome[i] = bw > 0.12 ? best : -1;
      wt[i] = bw;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aBiome', new THREE.BufferAttribute(biome, 1));
    geo.setAttribute('aW', new THREE.BufferAttribute(wt, 1));
    geo.computeVertexNormals();
    // average normals of duplicated seam vertices so the UV seam does not show as a shading line
    const nrm = geo.attributes.normal, acc = new Map(), key = (i) => `${Math.round(p.getX(i) * 50)},${Math.round(p.getY(i) * 50)},${Math.round(p.getZ(i) * 50)}`;
    for (let i = 0; i < p.count; i++) {
      const k = key(i), a = acc.get(k) || [0, 0, 0];
      a[0] += nrm.getX(i); a[1] += nrm.getY(i); a[2] += nrm.getZ(i); acc.set(k, a);
    }
    for (let i = 0; i < p.count; i++) { const a = acc.get(key(i)); const l = Math.hypot(a[0], a[1], a[2]) || 1; nrm.setXYZ(i, a[0] / l, a[1] / l, a[2] / l); }
  }
  const uTime = { value: 0 };
  const globeMat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: { uTime, uSun: { value: SUN } } });
  const globe = new THREE.Mesh(geo, globeMat);
  scene.add(globe);
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(R * 1.13, 40, 28), new THREE.ShaderMaterial({
    vertexShader: ATMO_VERT, fragmentShader: ATMO_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide,
  }));
  scene.add(atmo);

  // continent labels (screen-constant size, fade when on far side)
  const labels = CONTINENTS.map((c, i) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture(c.name), transparent: true, sizeAttenuation: false, depthTest: false }));
    s.scale.set(0.2, 0.05, 1);
    scene.add(s);
    return s;
  });

  const orbit = createOrbit({ target: new THREE.Vector3(), theta: 0.4, elev: 0.25, radius: 72, min: 28, max: 120, elevMin: -1.2, elevMax: 1.3, sway: false });
  let frozen = false;
  const spin = reduced ? 0.01 : 0.06;
  const ray = new THREE.Ray(), sphere = new THREE.Sphere(new THREE.Vector3(), R * 1.04);
  const ndc = new THREE.Vector2(), hit = new THREE.Vector3(), inv = new THREE.Quaternion(), wv = new THREE.Vector3(), cd = new THREE.Vector3();

  function release() { frozen = false; orbit.goal = null; orbit.radiusGoal = 72; }

  return {
    scene,
    update(t, dt) {
      uTime.value = t;
      if (!frozen) globe.rotation.y += dt * spin;
      orbit.apply(camera, t, dt);
      cd.copy(camera.position).normalize();
      labels.forEach((s, i) => {
        wv.copy(centers[i]).applyQuaternion(globe.quaternion);
        s.position.copy(wv).multiplyScalar(R * 1.22);
        s.material.opacity = smoothstep(0.1, 0.4, wv.dot(cd));
        s.visible = s.material.opacity > 0.02;
      });
    },
    drag: orbit.drag,
    zoom: orbit.zoom,
    pick(x, y) {
      orbit.touch();
      const rect = canvas.getBoundingClientRect();
      ndc.set(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1);
      ray.origin.copy(camera.position);
      ray.direction.set(ndc.x, ndc.y, 0.5).unproject(camera).sub(camera.position).normalize();
      const h = ray.intersectSphere(sphere, hit);
      let found = -1, bestR = 1.2;
      if (h) {
        inv.copy(globe.quaternion).invert();
        const d = hit.applyQuaternion(inv).normalize();
        centers.forEach((c, i) => {
          const r = Math.acos(clamp(d.dot(c), -1, 1)) / DEFS[i].rad;
          if (r < bestR) { bestR = r; found = i; }
        });
      }
      if (found < 0) { ui.closeCard(); return; }
      sfx('chime');
      const ct = CONTINENTS[found];
      frozen = true;
      wv.copy(centers[found]).applyQuaternion(globe.quaternion);
      orbit.goal = { theta: Math.atan2(wv.x, wv.z), elev: clamp(Math.asin(wv.y), -1.1, 1.2) };
      orbit.radiusGoal = 40;
      ui.openCard({ label: `世界線 #5050　${ct.label}`, title: ct.name, line: ct.line, onClose: release });
    },
    setViewport() {},
    dispose() { disposeScene(scene); },
  };
}
