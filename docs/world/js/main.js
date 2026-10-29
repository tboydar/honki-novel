import * as THREE from '../vendor/three.module.js';
import { WORLDLINES, FRAMING, NARRATION } from './data.js';
import { createAudio } from './audio.js';
import { ui, initUi } from './ui.js';

const $ = (id) => document.getElementById(id);
const canvas = $('c');
const fallback = $('fallback');
const byId = Object.fromEntries(WORLDLINES.map((w) => [w.id, w]));

function fail() {
  fallback.hidden = false;
  $('hud').hidden = true;
  canvas.hidden = true;
}

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  if (!renderer.getContext()) throw new Error('no gl');
} catch (e) {
  renderer = null;
  fail();
}

if (renderer) {
  initUi();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const camera = new THREE.PerspectiveCamera(50, 1, 0.5, 1200);
  const audio = createAudio();

  // ---- worldline switcher ----
  const rail = $('rail');
  for (const w of WORLDLINES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'wl';
    b.dataset.id = w.id;
    b.setAttribute('aria-label', `切換到世界線 #${w.no}：${w.name}`);
    b.innerHTML = `<span class="seal-s">#${w.no}</span><span class="nm">${w.name}</span>`;
    b.addEventListener('click', () => { if (location.hash !== `#${w.id}`) location.hash = w.id; });
    rail.appendChild(b);
  }
  $('framing').textContent = FRAMING;

  // ---- scene manager ----
  let cur = null, curId = null, token = 0, hintTimer = 0;
  const cache = {};
  let t = 0;

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = camera.aspect < 1 ? Math.min(88, 50 + (1 / camera.aspect - 1) * 22) : 50;
    camera.updateProjectionMatrix();
    if (cur) cur.setViewport(h * renderer.getPixelRatio(), camera.fov);
  }
  window.addEventListener('resize', resize);

  function paintHud(id) {
    const w = byId[id];
    document.body.className = `scene-${id}`;
    document.title = `${w.title}｜重生之 Debug 博士逆轉台北`;
    $('seal').textContent = `世界線 #${w.no}`;
    $('wl-title').textContent = w.title;
    const hint = $('wl-hint');
    hint.textContent = w.hint;
    hint.classList.remove('gone');
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => hint.classList.add('gone'), 9000);
    rail.querySelectorAll('.wl').forEach((b) => {
      if (b.dataset.id === id) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    renderAudioUi();
  }

  async function go(id) {
    if (!byId[id]) id = 'taipei';
    if (id === curId) return;
    const my = ++token;
    let mod;
    try {
      mod = cache[id] || (cache[id] = await import(`./scenes/${id}.js`));
    } catch (e) {
      console.error(e);
      return;
    }
    if (my !== token) return;
    ui.closeCard();
    if (cur) { cur.dispose(); cur = null; renderer.renderLists.dispose(); }
    camera.fov = 50;
    cur = mod.create({ renderer, camera, canvas, sfx: audio.sfx, ui });
    curId = id;
    t = 0;
    resize();
    paintHud(id);
    audio.setScene(id);
    audio.autoNarrate();
    if (location.hash !== `#${id}`) history.replaceState(null, '', `#${id}`);
  }
  window.addEventListener('hashchange', () => go(location.hash.slice(1)));

  // ---- input ----
  const pointers = new Map();
  let down = null, moved = false, pinch = 0;
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) { down = { x: e.clientX, y: e.clientY }; moved = false; }
    else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = Math.hypot(a.x - b.x, a.y - b.y); moved = true;
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    const p = pointers.get(e.pointerId);
    if (!p || !cur) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (pointers.size === 1) {
      if (!moved && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8) moved = true;
      if (moved) cur.drag(dx, dy);
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch > 0 && d > 0) cur.zoom(pinch / d);
      pinch = d;
    }
  });
  const end = (e) => {
    if (!pointers.has(e.pointerId)) return;
    const wasSingle = pointers.size === 1;
    pointers.delete(e.pointerId);
    if (wasSingle && !moved && e.type === 'pointerup' && cur) cur.pick(e.clientX, e.clientY, e.pointerType !== 'mouse');
    if (pointers.size < 2) pinch = 0;
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (cur) cur.zoom(Math.exp(e.deltaY * 0.001));
  }, { passive: false });

  // ---- audio UI ----
  const btnSound = $('btn-sound'), btnTheme = $('btn-theme'), btnNarr = $('btn-narr');
  function renderAudioUi() {
    btnSound.textContent = audio.on ? '音效：開' : '音效：關';
    btnSound.setAttribute('aria-pressed', String(audio.on));
    btnSound.setAttribute('aria-label', `音效開關，目前${audio.on ? '開啟' : '關閉'}`);
    btnTheme.hidden = !audio.themeOk;
    btnTheme.textContent = audio.themePlaying ? '主題曲：播放中' : '主題曲';
    btnTheme.setAttribute('aria-pressed', String(audio.themePlaying));
    btnTheme.setAttribute('aria-label', audio.themePlaying ? '暫停主題曲' : '播放主題曲');
    const hasN = !!curId && audio.narrOk(curId);
    btnNarr.hidden = !hasN;
    $('credit').hidden = !hasN;
    btnNarr.textContent = audio.narrPlaying ? '旁白：播放中' : '旁白';
    btnNarr.setAttribute('aria-pressed', String(audio.narrPlaying));
    btnNarr.setAttribute('aria-label', audio.narrPlaying ? '停止旁白' : '播放本世界線旁白');
    ui.setCaption(audio.narrPlaying && curId ? NARRATION[curId] : '');
  }
  audio.onChange(renderAudioUi);
  btnSound.addEventListener('click', () => {
    audio.setOn(!audio.on);
    if (audio.on) audio.autoNarrate();
  });
  btnTheme.addEventListener('click', () => audio.toggleTheme());
  btnNarr.addEventListener('click', () => audio.toggleNarration());
  $('zoom-btn').addEventListener('click', () => { if (cur && cur.nudge) cur.nudge(); });
  renderAudioUi();
  audio.probe();

  // ---- loop ----
  let raf = 0, last = 0;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (!cur) return;
    t += dt;
    cur.update(t, dt);
    renderer.render(cur.scene, camera);
  }
  function start() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } }
  function stop() { cancelAnimationFrame(raf); raf = 0; }
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else start(); });

  go(location.hash.slice(1) || 'taipei');
  start();
}
