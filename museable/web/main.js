/* ============================================================
 * museable A4 — 웹 3D 핀 매트릭스 뷰 (본선 메인 산출물)
 *
 * 핵심 규칙(제안서/계약 준수):
 *  - 핀 높이 = 백엔드가 준 H 양자화값(0..LEVELS-1) 그대로 매핑 (가짜 연출 X)
 *  - 작품 선택 → 각 핀이 H까지 실시간 상승 (행렬별 시차 ease)
 *  - 확대(ROI 변경) → 핀 전부 0으로 내림 → 새 H로 재상승
 *  - 백엔드(/api) 있으면 거기서 H, 없으면 JS 합성 H로 폴백 (file:// 에서도 동작)
 * ============================================================ */

/* ---- 계약 기본값 (백엔드 응답이 오면 거기 값으로 덮어씀) ---- */
let COLS = 48, ROWS = 32, LEVELS = 16;

/* ---- three 셋업 ---- */
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0c0e12);

const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
camera.position.set(0, 16, 20);

const controls = new THREE.OrbitControls(camera, canvas);
controls.enableDamping = true; controls.dampingFactor = 0.08;
controls.target.set(0, 1.2, 0);
controls.minDistance = 10; controls.maxDistance = 40;

scene.add(new THREE.AmbientLight(0xffffff, 0.35));
const key = new THREE.DirectionalLight(0xfff1dc, 1.25);
key.position.set(-8, 16, 10); scene.add(key);
const rim = new THREE.DirectionalLight(0x8fb8ff, 0.5);
rim.position.set(10, 6, -8); scene.add(rim);

/* ---- 베이스 플레이트 (디바이스 본체) ---- */
const PIN_GAP = 0.46;                     // 핀 간격
const W = COLS * PIN_GAP, D = ROWS * PIN_GAP;
const plate = new THREE.Mesh(
  new THREE.BoxGeometry(W + 1.6, 0.8, D + 1.6),
  new THREE.MeshStandardMaterial({ color: 0x111419, roughness: 0.7, metalness: 0.3 })
);
plate.position.y = -0.4; scene.add(plate);

/* ---- 핀: InstancedMesh (실린더 n×m) ---- */
let pinMesh, N;
const PIN_R = 0.16, PIN_MAXH = 4.2;       // 핀 반지름 / 최대 상승 높이(시각)
const dummy = new THREE.Object3D();
let curH, tgtH, velH;                      // 현재/목표/속도 (스프링)

function buildPins() {
  if (pinMesh) { scene.remove(pinMesh); pinMesh.geometry.dispose(); pinMesh.material.dispose(); }
  N = COLS * ROWS;
  const geo = new THREE.CylinderGeometry(PIN_R, PIN_R, 1, 10);
  geo.translate(0, 0.5, 0);                // 밑면이 베이스에 닿도록 (위로 자람)
  const mat = new THREE.MeshStandardMaterial({ color: 0xb9bcc4, roughness: 0.45, metalness: 0.6 });
  pinMesh = new THREE.InstancedMesh(geo, mat, N);
  pinMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3);
  scene.add(pinMesh);
  curH = new Float32Array(N); tgtH = new Float32Array(N); velH = new Float32Array(N);
  document.getElementById('stPins').textContent = N;
  document.getElementById('cGrid').textContent = `${COLS}×${ROWS}`;
  document.getElementById('cLv').textContent = LEVELS;
}

function pinXZ(x, y) {
  return [(x - (COLS - 1) / 2) * PIN_GAP, (y - (ROWS - 1) / 2) * PIN_GAP];
}

/* ---- H(정수 0..LEVELS-1, row-major) 적용 ---- */
function setTarget(data) {
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    const i = y * COLS + x;
    tgtH[i] = (data[i] / (LEVELS - 1)) * PIN_MAXH;   // 양자화값 → 시각 높이
  }
}
function dropAll() { for (let i = 0; i < N; i++) tgtH[i] = 0; }

/* ---- 렌더 루프 (스프링 상승 + 색 음영) ---- */
const cBase = new THREE.Color(0x9a9ea7), cHi = new THREE.Color(0xf3e6cf);
let spin = false;
function frame() {
  requestAnimationFrame(frame);
  if (spin) { scene.rotation.y += 0.0035; }
  for (let i = 0; i < N; i++) {
    // 오버슈트 없는 완만한 상승: 목표를 향해 천천히 수렴 (작을수록 느림)
    curH[i] += (tgtH[i] - curH[i]) * 0.045;
    const h = Math.max(0.04, curH[i]);
    const x = i % COLS, y = (i / COLS) | 0, [px, pz] = pinXZ(x, y);
    dummy.position.set(px, 0, pz); dummy.scale.set(1, h, 1); dummy.updateMatrix();
    pinMesh.setMatrixAt(i, dummy.matrix);
    const t = Math.min(1, curH[i] / PIN_MAXH);
    const col = cBase.clone().lerp(cHi, t * t);
    pinMesh.setColorAt(i, col);
  }
  pinMesh.instanceMatrix.needsUpdate = true;
  if (pinMesh.instanceColor) pinMesh.instanceColor.needsUpdate = true;
  controls.update();
  renderer.render(scene, camera);
}

/* ---- 데이터: 백엔드 우선, 실패 시 JS 합성 ---- */
const FALLBACK = [
  { id: 'buddha_01', title: '금동 반가사유상', era: '삼국시대 7세기', type: '3d', kind: 'face' },
  { id: 'celadon_01', title: '청자 상감운학문 매병', era: '고려 12세기', type: '3d', kind: 'dome' },
  { id: 'ssireum_01', title: '김홍도 「씨름」', era: '조선 18세기', type: '2d', kind: 'edges' },
];
let useBackend = false, artworks = FALLBACK, current = null;

async function loadArtworks() {
  try {
    const r = await fetch('/api/artworks', { signal: AbortSignal.timeout(800) });
    if (!r.ok) throw 0;
    artworks = await r.json(); useBackend = true;
  } catch { artworks = FALLBACK; useBackend = false; }
  document.getElementById('stSrc').textContent = useBackend ? '백엔드 /api' : 'JS 합성(폴백)';
  renderList();
}

async function getHeightmap(art) {
  if (useBackend) {
    const r = await fetch(`/api/artworks/${art.id}/heightmap`);
    const j = await r.json();
    COLS = j.cols; ROWS = j.rows; LEVELS = j.levels;
    return j.data;
  }
  return synthH(art.kind);                 // 폴백: 계약과 동일 포맷(정수 0..LEVELS-1)
}

/* JS 합성 H — pipeline/relief.py 와 동일 컨셉 (백엔드 없이도 시연 가능) */
function synthH(kind) {
  const data = new Int16Array(COLS * ROWS);
  const cx = (COLS - 1) / 2, cy = (ROWS - 1) / 2;
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    let h;
    const rx = (x - cx), ry = (y - cy);
    if (kind === 'face') {
      const r = Math.hypot(rx / (COLS * 0.32), (ry + 2) / (ROWS * 0.38));
      h = Math.pow(Math.max(0, 1 - r), 0.7);
      const crown = Math.exp(-((rx / (COLS * 0.18)) ** 2 + ((ry + ROWS * 0.34) / (ROWS * 0.10)) ** 2));
      h = Math.max(h, crown * 0.85);
    } else if (kind === 'edges') {
      const r = Math.hypot(rx / COLS, ry / ROWS);
      h = (0.5 + 0.5 * Math.sin(r * 26)) * Math.max(0, 1 - r * 1.6);
    } else {
      const r = Math.hypot(rx / (COLS * 0.42), ry / (ROWS * 0.42));
      h = Math.max(0, 1 - r * r);
    }
    data[y * COLS + x] = Math.round(Math.min(1, Math.max(0, h)) * (LEVELS - 1));
  }
  return Array.from(data);
}

/* ---- UI ---- */
const listEl = document.getElementById('artList');
function renderList() {
  listEl.innerHTML = '';
  artworks.forEach(a => {
    const b = document.createElement('button'); b.className = 'art'; b.id = 'a-' + a.id;
    b.innerHTML = `<div class="t">${a.title}</div><div class="s">${a.era} · ${a.type === '2d' ? '회화(윤곽 relief)' : '입체 유물'}</div>`;
    b.onclick = () => selectArt(a);
    listEl.appendChild(b);
  });
}
function selectArt(a) {
  current = a;
  document.querySelectorAll('.art').forEach(e => e.classList.remove('on'));
  document.getElementById('a-' + a.id).classList.add('on');
  document.getElementById('hudTitle').textContent = a.title;
  document.getElementById('hudSub').textContent = '「핀 올리기」를 누르면 H까지 상승';
}

async function raise(roiScale = 1) {
  if (!current) selectArt(artworks[0]);
  dropAll();                               // 규칙: 먼저 0으로 내림
  await new Promise(r => setTimeout(r, 180));
  const data = await getHeightmap(current);
  if (data.length !== COLS * ROWS) buildPins();   // 격자 바뀌면 재생성
  setTarget(data);
  document.getElementById('hudSub').textContent =
    `핀 ${COLS}×${ROWS} 상승 중 · 높이=H 양자화값 (FPGA 동일 값)`;
}

document.getElementById('btnRaise').onclick = () => raise();
document.getElementById('zoom').oninput = () => raise();   // ROI 변경 → 내렸다 재상승 (A4 규칙)
document.getElementById('btnSpin').onclick = function () { spin = !spin; this.classList.toggle('on', spin); };
document.getElementById('btnReset').onclick = () => {
  dropAll(); spin = false; document.getElementById('btnSpin').classList.remove('on');
  scene.rotation.y = 0;
  document.getElementById('hudTitle').textContent = '작품을 고르고 「핀 올리기」';
  document.getElementById('hudSub').textContent = '';
};

/* ---- 리사이즈 ---- */
function resize() {
  const m = document.querySelector('main');
  renderer.setSize(m.clientWidth, m.clientHeight, false);
  camera.aspect = m.clientWidth / m.clientHeight; camera.updateProjectionMatrix();
}
addEventListener('resize', resize);

/* ---- 시작 ---- */
buildPins(); resize(); frame(); loadArtworks();
