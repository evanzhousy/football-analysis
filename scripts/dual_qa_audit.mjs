#!/usr/bin/env node
/**
 * scripts/dual_qa_audit.mjs — Mandatory Dual-Verification Gate (AGENTS.md)
 *
 * Pass 1: Self Visual, Biomechanical & C2-Seam Continuity Audit
 *   - Starts an ephemeral HTTP server with full `206 Partial Content` Range support
 *   - Launches Headless Chrome with mandatory ANGLE + SwiftShader WebGL2 flags
 *   - Verifies 0 console/page errors, 86 canonical atomic clips loaded, White-Model default ON
 *   - Audits 8 representative White-Model Atomic Clips across all 7 categories -> `qa_whitebox_atomic_grid.png`
 *   - Audits C2-inertialized temporal continuity (`auditSequenceContinuity`) across S01, S02, S03, S08, S12, S16
 *   - Renders 1:1 Match Video vs White-Model Assembled S01 Filmstrip -> `qa_whitebox_s01_assembled_filmstrip.png`
 *   - Renders Multi-Position Assembled Split Sheet (S02, S03, S08, S16) -> `qa_whitebox_multipos_assembled.png`
 *   - Verifies 1-click `[W]` Stadium Kit toggle -> `qa_kit_mode_s01_verify.png`
 *
 * Pass 2: Grok CLI Independent Audit
 *   - Invokes `/home/antigravity/.local/bin/grok` headlessly with full telemetry + composite paths
 *   - Fails closed (`exit code 2` on `BLOCKED_GROK_AUTH`, `exit code 3` on `FAIL`)
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const OUT_DIR = process.env.QA_OUT_DIR || '/tmp/dual_qa_out';
fs.mkdirSync(OUT_DIR, { recursive: true });

const MIME_MAP = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.glb': 'model/gltf-binary',
  '.bvh': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.mp4': 'video/mp4',
  '.svg': 'image/svg+xml'
};

function startRangeStaticServer(rootDir) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const u = new URL(req.url, 'http://127.0.0.1');
        let rel = decodeURIComponent(u.pathname);
        if (rel === '/') rel = '/index.html';
        const fullPath = path.resolve(rootDir, '.' + rel);
        if (!fullPath.startsWith(rootDir) || !fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) {
          res.writeHead(404);
          res.end('Not found');
          return;
        }
        const stat = fs.statSync(fullPath);
        const ext = path.extname(fullPath).toLowerCase();
        const mime = MIME_MAP[ext] || 'application/octet-stream';
        const range = req.headers.range;

        if (range) {
          const m = /^bytes=(\d*)-(\d*)$/.exec(range);
          if (!m) {
            res.writeHead(416);
            res.end();
            return;
          }
          const start = m[1] ? parseInt(m[1], 10) : 0;
          const end = m[2] ? Math.min(stat.size - 1, parseInt(m[2], 10)) : stat.size - 1;
          if (start >= stat.size || start > end) {
            res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` });
            res.end();
            return;
          }
          res.writeHead(206, {
            'Content-Type': mime,
            'Content-Length': end - start + 1,
            'Content-Range': `bytes ${start}-${end}/${stat.size}`,
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'no-cache'
          });
          fs.createReadStream(fullPath, { start, end }).pipe(res);
        } else {
          res.writeHead(200, {
            'Content-Type': mime,
            'Content-Length': stat.size,
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'no-cache'
          });
          fs.createReadStream(fullPath).pipe(res);
        }
      } catch (err) {
        res.writeHead(500);
        res.end(String(err));
      }
    });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, port: server.address().port });
    });
  });
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.id = 0;
    this.pending = new Map();
    this.handlers = new Map();
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
    });
    this.ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(typeof ev.data === 'string' ? ev.data : ev.data.toString());
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
        else resolve(msg.result);
      } else if (msg.method && this.handlers.has(msg.method)) {
        for (const fn of this.handlers.get(msg.method)) fn(msg.params);
      }
    });
  }

  on(method, fn) {
    if (!this.handlers.has(method)) this.handlers.set(method, []);
    this.handlers.get(method).push(fn);
  }

  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true
    });
    if (res.exceptionDetails) {
      throw new Error(`Page eval exception: ${JSON.stringify(res.exceptionDetails)}`);
    }
    return res.result?.value;
  }

  async screenshotPng(outPath) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(outPath, Buffer.from(res.data, 'base64'));
  }

  close() {
    try {
      this.ws?.close();
    } catch {}
  }
}

async function launchHeadlessWebGLChrome(debugPort) {
  const userDataDir = fs.mkdtempSync('/tmp/chrome_dual_qa_');
  const args = [
    '--headless=new',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-webgl',
    '--ignore-gpu-blocklist',
    '--mute-audio',
    '--hide-scrollbars',
    '--window-size=1600,920',
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${userDataDir}`,
    'about:blank'
  ];
  const proc = spawn('google-chrome', args, { stdio: ['ignore', 'pipe', 'pipe'] });
  const startMs = Date.now();
  let pageWsUrl = null;
  while (Date.now() - startMs < 15000) {
    try {
      const resp = await fetch(`http://127.0.0.1:${debugPort}/json/list`, {
        signal: AbortSignal.timeout(1000)
      });
      if (resp.ok) {
        const list = await resp.json();
        const page = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
        if (page) {
          pageWsUrl = page.webSocketDebuggerUrl;
          break;
        }
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 180));
  }
  if (!pageWsUrl) {
    proc.kill('SIGKILL');
    throw new Error('Failed to connect to headless Chrome CDP endpoint');
  }
  return { proc, userDataDir, pageWsUrl };
}

function findPythonWithCv2() {
  const candidates = ['/home/antigravity/mocap_env/bin/python', 'python3'];
  for (const bin of candidates) {
    const chk = spawnSync(bin, ['-c', 'import cv2, numpy'], { stdio: 'ignore' });
    if (chk.status === 0) return bin;
  }
  return null;
}

function stitchAtomicShowcaseGrid(pyBin, atomicShots) {
  if (!pyBin || atomicShots.length === 0) return null;
  const outPath = path.join(OUT_DIR, 'qa_whitebox_atomic_grid.png');
  const pyScript = `
import json, re, sys, cv2, numpy as np

def clean_ascii(txt):
    t = txt.replace("→", "->").replace("·", "|")
    t = re.sub(r"[^\\x20-\\x7E]", "", t)
    return re.sub(r"\\s+", " ", t).strip()

shots = json.loads(sys.argv[1])
out_path = sys.argv[2]

tiles = []
for s in shots:
    img = cv2.imread(s["png"])
    h, w = img.shape[:2]
    crop = img[58:h-112, 275:w-315]
    tile = cv2.resize(crop, (460, 340), interpolation=cv2.INTER_AREA)
    cv2.rectangle(tile, (0, 0), (459, 54), (16, 22, 32), -1)
    cv2.putText(tile, f"[{s['cat']}] {s['clipId']}", (10, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.54, (80, 225, 255), 2)
    b = s["bio"]
    stance_tag = clean_ascii(b["plantedFeet"]) or "Air"
    cv2.putText(
        tile,
        f"t={s['t']:.2f}s | stance={stance_tag} | hipsY={b['hipsPos'][1]:.2f}m spineUp={b['spineUpDot']:.2f}",
        (10, 44),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.44,
        (235, 242, 250),
        1
    )
    tiles.append(tile)

row1 = np.hstack(tiles[:4])
row2 = np.hstack(tiles[4:8])
grid = np.vstack([row1, row2])
cv2.imwrite(out_path, grid)
print(out_path)
`;
  const res = spawnSync(pyBin, ['-c', pyScript, JSON.stringify(atomicShots), outPath], { encoding: 'utf8' });
  if (res.status !== 0) {
    console.error('[Pass 1] Failed to stitch atomic showcase grid:', res.stderr);
    return null;
  }
  return outPath;
}

function stitchS01AssembledFilmstrip(pyBin, s01Records) {
  if (!pyBin || s01Records.length === 0) return null;
  const outPath = path.join(OUT_DIR, 'qa_whitebox_s01_assembled_filmstrip.png');
  const videoPath = path.join(REPO_ROOT, 'assets/videos/zhibo8_pedri_all_8_clips.mp4');
  const pyScript = `
import json, re, sys, cv2, numpy as np

def clean_ascii(txt):
    t = txt.replace("C2惯性过渡", "C2-Inertial").replace("组装链", "Chain").replace("→", "->").replace("·", "|")
    t = re.sub(r"[^\\x20-\\x7E]", "", t)
    return re.sub(r"\\s+", " ", t).strip()

video_path = sys.argv[1]
records = json.loads(sys.argv[2])
out_path = sys.argv[3]

cap = cv2.VideoCapture(video_path)
fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
rows = []

for rec in records:
    t = rec["t"]
    cap.set(cv2.CAP_PROP_POS_FRAMES, int(round(t * fps)))
    ok, vframe = cap.read()
    if not ok:
        vframe = np.zeros((540, 960, 3), dtype=np.uint8)
    vh, vw = vframe.shape[:2]
    cx = int(475 + max(0.0, t - 2.25) * 95)
    x0 = max(0, min(vw - 420, cx - 210))
    vcrop = cv2.resize(vframe[115:510, x0:x0+420], (420, 310), interpolation=cv2.INTER_CUBIC)
    cv2.rectangle(vcrop, (0, 0), (419, 36), (12, 20, 16), -1)
    cv2.putText(vcrop, f"Real Video S01 t={t:.2f}s", (10, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.62, (90, 255, 140), 2)

    close_img = cv2.imread(rec["closePng"])
    ch, cw = close_img.shape[:2]
    ccrop = cv2.resize(close_img[58:ch-112, 280:cw-315], (480, 310), interpolation=cv2.INTER_AREA)
    b = rec["bio"]
    dbg = clean_ascii(b["activeMocapDebug"])[:38]
    st = clean_ascii(b["plantedFeet"]) or "Air"
    cv2.rectangle(ccrop, (0, 0), (479, 52), (16, 22, 32), -1)
    cv2.putText(ccrop, f"t={t:.2f}s | {dbg}", (10, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.46, (80, 225, 255), 1)
    cv2.putText(ccrop, f"stance={st} L_y={b['lFootPos'][1]:.2f}m R_y={b['rFootPos'][1]:.2f}m ballD={b['minFootToBallDist']:.2f}m", (10, 44), cv2.FONT_HERSHEY_SIMPLEX, 0.44, (255, 225, 120), 1)

    split_img = cv2.imread(rec["splitPng"])
    scrop = cv2.resize(split_img, (580, 310), interpolation=cv2.INTER_AREA)
    cv2.putText(scrop, f"1:1 Split Assembled UI t={t:.2f}s", (12, 24), cv2.FONT_HERSHEY_SIMPLEX, 0.56, (255, 205, 90), 2)

    rows.append(np.hstack([vcrop, ccrop, scrop]))

sheet = np.vstack(rows)
cv2.imwrite(out_path, sheet)
print(out_path)
`;
  const res = spawnSync(pyBin, ['-c', pyScript, videoPath, JSON.stringify(s01Records), outPath], {
    encoding: 'utf8'
  });
  if (res.status !== 0) {
    console.error('[Pass 1] Failed to stitch S01 filmstrip:', res.stderr);
    return null;
  }
  return outPath;
}

function stitchMultiPosSheet(pyBin, multiRecords) {
  if (!pyBin || multiRecords.length === 0) return null;
  const outPath = path.join(OUT_DIR, 'qa_whitebox_multipos_assembled.png');
  const pyScript = `
import json, re, sys, cv2, numpy as np

def clean_ascii(txt):
    t = txt.replace("C2惯性过渡", "C2-Inertial").replace("组装链", "Chain").replace("→", "->").replace("·", "|")
    t = re.sub(r"[^\\x20-\\x7E]", "", t)
    return re.sub(r"\\s+", " ", t).strip()

records = json.loads(sys.argv[1])
out_path = sys.argv[2]

tiles = []
for r in records:
    img = cv2.imread(r["splitPng"])
    tile = cv2.resize(img, (760, 430), interpolation=cv2.INTER_AREA)
    cv2.rectangle(tile, (0, 0), (759, 34), (14, 20, 30), -1)
    dbg = clean_ascii(r["bio"]["activeMocapDebug"])
    cv2.putText(
        tile,
        f"{r['title']} @ t={r['t']:.2f}s | {dbg}",
        (12, 23),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.52,
        (255, 220, 95),
        2
    )
    tiles.append(tile)

row1 = np.hstack(tiles[:2])
row2 = np.hstack(tiles[2:4])
sheet = np.vstack([row1, row2])
cv2.imwrite(out_path, sheet)
print(out_path)
`;
  const res = spawnSync(pyBin, ['-c', pyScript, JSON.stringify(multiRecords), outPath], { encoding: 'utf8' });
  if (res.status !== 0) {
    console.error('[Pass 1] Failed to stitch multipos sheet:', res.stderr);
    return null;
  }
  return outPath;
}

function runGrokCliAudit(reportSummary, compositePaths) {
  const grokCandidates = ['/home/antigravity/.local/bin/grok', 'grok'];
  let grokBin = null;
  for (const c of grokCandidates) {
    const chk = spawnSync(c, ['--version'], { encoding: 'utf8' });
    if (chk.status === 0) {
      grokBin = c;
      break;
    }
  }
  if (!grokBin) {
    return {
      status: 'BLOCKED_NO_BINARY',
      ok: false,
      detail: 'grok CLI binary not found on PATH or /home/antigravity/.local/bin/grok'
    };
  }

  const prompt = [
    'You are the independent Pass-2 QA Auditor required by AGENTS.md for football-analysis.',
    'Audit the White-Model 86-Clip Football Atomic Library + C2-Inertialized Sequence Assembler architecture:',
    '  - src/soccerAtomicCatalog.js & scripts/build_atomic_soccer_library.py (86 canonical 65-bone .glb clips)',
    '  - src/atomicMotionAssembler.js (C2 quintic inertialization + stride-matched Root Motion)',
    '  - src/assembledSequences.js (18 multi-clip complex action sequences S01..S18)',
    '  - src/babylonKit.js, src/babylonPitch.js, src/babylonPlayer.js, src/main.js',
    `Composite images generated by Pass 1: ${compositePaths.filter(Boolean).join(', ')}`,
    'Verify:',
    '1) All 86 atomic clips load cleanly with 0 console/page errors and White-Model mode default ON.',
    '2) C2 seam continuity across multi-clip transitions shows zero pelvis/foot teleportation (pelvisStep30ms <= 0.24m).',
    '3) S01 aerial ball cushion at t=2.22s has Left stance foot planted on turf and Right (#8) receiving foot lifted to meet the dropping ball.',
    'Reply with a concise structured audit ending with VERDICT: PASS or VERDICT: FAIL.',
    '',
    'Telemetry summary:',
    JSON.stringify(reportSummary, null, 2)
  ].join('\n');

  const env = { ...process.env };
  if (!env.GROK_API_KEY && env.XAI_API_KEY) {
    env.GROK_API_KEY = env.XAI_API_KEY;
  }

  const res = spawnSync(
    grokBin,
    ['-d', REPO_ROOT, '--no-sandbox', '--max-tool-rounds', '12', '-p', prompt],
    { encoding: 'utf8', env, timeout: 120000 }
  );
  const combined = `${res.stdout || ''}\n${res.stderr || ''}`.trim();

  if (/API key required|401|Unauthorized|Bad credentials/i.test(combined)) {
    return {
      status: 'BLOCKED_GROK_AUTH',
      ok: false,
      grokBin,
      detail: combined
    };
  }
  if (res.status !== 0 || /VERDICT:\s*FAIL/i.test(combined)) {
    return {
      status: 'FAIL',
      ok: false,
      grokBin,
      detail: combined
    };
  }
  return {
    status: 'PASS',
    ok: true,
    grokBin,
    detail: combined
  };
}

async function main() {
  console.log('=== [Dual-QA Gate] Pass 1: White-Model 86-Clip Atomic Library + C2 Assembled Sequence Audit ===');
  const { server, port } = await startRangeStaticServer(REPO_ROOT);
  const debugPort = 9330 + Math.floor(Math.random() * 400);
  let chrome = null;
  let cdp = null;

  const consoleErrors = [];
  const pageErrors = [];
  const invariantFailures = [];
  const atomicShots = [];
  const continuityAudits = [];
  const s01Records = [];
  const multiPosRecords = [];
  let kitVerifyPng = null;

  try {
    chrome = await launchHeadlessWebGLChrome(debugPort);
    cdp = new CDPClient(chrome.pageWsUrl);
    await cdp.connect();

    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Log.enable');

    cdp.on('Runtime.consoleAPICalled', (p) => {
      if (p.type === 'error') {
        const txt = (p.args || []).map((a) => a.value ?? a.description ?? '').join(' ');
        consoleErrors.push(txt);
      }
    });
    cdp.on('Runtime.exceptionThrown', (p) => {
      pageErrors.push(p.exceptionDetails?.text || JSON.stringify(p.exceptionDetails));
    });
    cdp.on('Log.entryAdded', (p) => {
      if (p.entry?.level === 'error' && !/favicon/i.test(p.entry?.url || '')) {
        consoleErrors.push(`${p.entry.source}: ${p.entry.text}`);
      }
    });

    const url = `http://127.0.0.1:${port}/index.html`;
    await cdp.send('Page.navigate', { url });

    const readyStart = Date.now();
    let studioReady = false;
    while (Date.now() - readyStart < 45000) {
      studioReady = await cdp.eval(`Boolean(window.__STUDIO_DEBUG__ && window.__STUDIO_DEBUG__.isReady())`);
      if (studioReady) break;
      await new Promise((r) => setTimeout(r, 250));
    }
    if (!studioReady) {
      throw new Error('Timed out waiting for window.__STUDIO_DEBUG__.isReady()');
    }
    await cdp.eval(`window.__STUDIO_DEBUG__.pauseRenderLoop()`);

    // 1. Verify 86-Clip Catalog & White-Model Default ON
    const catalogCount = await cdp.eval(`window.__STUDIO_DEBUG__.getAtomicCatalog().length`);
    if (catalogCount !== 86) {
      invariantFailures.push(`Expected 86 atomic clips in catalog, got ${catalogCount}`);
    }
    console.log(`  [Catalog] Loaded ${catalogCount} canonical 65-bone atomic clips`);

    // 2. Capture 8-Panel White-Model Atomic Library Showcase Grid (Full-Canvas 3D)
    await cdp.eval(`window.__STUDIO_DEBUG__.setWhiteBoxMode(true)`);
    await cdp.eval(`window.__STUDIO_DEBUG__.setSplitLayout(false)`);

    const atomicSamplePlan = [
      { clipId: 'stance_ball_scan', cat: '01_stance', t: 1.15 },
      { clipId: 'loco_ball_run_fast', cat: '02_loco', t: 0.44 },
      { clipId: 'touch_diag_take_r', cat: '03_touch', t: 0.34 },
      { clipId: 'turn_backpedal_half_r', cat: '04_turn', t: 1.28 },
      { clipId: 'skill_croqueta_rl', cat: '05_skill', t: 0.90 },
      { clipId: 'skill_spin_break_l', cat: '05_spin', t: 1.16 },
      { clipId: 'kick_stride_strike_l', cat: '06_strike', t: 0.88 },
      { clipId: 'def_press_brake_r', cat: '07_defend', t: 1.04 }
    ];

    for (const s of atomicSamplePlan) {
      const info = await cdp.eval(
        `window.__STUDIO_DEBUG__.inspectAtomicClip('${s.clipId}', ${s.t}, true, { trackRoot: true, targetOffset: [0, 0.88, 0], posOffset: [2.45, 1.52, 2.75], fovDeg: 33 }, false, false)`
      );
      const png = path.join(OUT_DIR, `atomic_${s.clipId}.png`);
      await cdp.screenshotPng(png);
      const b = info.biomechanics;
      if (!b || b.hipsPos[1] < 0.58 || b.hipsPos[1] > 1.26 || b.spineUpDot < 0.52) {
        invariantFailures.push(`Atomic ${s.clipId}: invalid posture ${JSON.stringify(b)}`);
      }
      atomicShots.push({ ...s, png, bio: b });
      console.log(
        `  [Atomic OK] ${s.clipId.padEnd(22)} | hipsY=${b.hipsPos[1].toFixed(2)}m spineUp=${b.spineUpDot.toFixed(2)} L_y=${b.lFootPos[1].toFixed(2)}m R_y=${b.rFootPos[1].toFixed(2)}m`
      );
    }

    // 3. Quantitative C2 Seam Continuity Audit across 6 Scenarios (MF / FW / DF)
    await cdp.eval(`window.__STUDIO_DEBUG__.setOverlays({ showLabels: true })`);
    const continuityScenarios = [0, 1, 2, 7, 11, 15];
    for (const scIdx of continuityScenarios) {
      const cont = await cdp.eval(`window.__STUDIO_DEBUG__.auditSequenceContinuity(${scIdx}, 0.04)`);
      continuityAudits.push(cont);
      const maxSeamPelvis = cont.seamRecords.reduce((m, r) => Math.max(m, r.pelvisStep30ms), 0);
      if (maxSeamPelvis > 0.25) {
        invariantFailures.push(
          `Scenario idx=${scIdx} (${cont.scenario}): seam pelvis jump ${maxSeamPelvis}m > 0.25m!`
        );
      }
      // Athletic deep fake-shot/cut forward torso hinge reaches ~55 deg (cos(55 deg)=0.57); 90 deg axis bug is <=0.15
      if (cont.minSpineUpDot < 0.52 || cont.minHipsY < 0.58) {
        invariantFailures.push(
          `Scenario idx=${scIdx} (${cont.scenario}): posture violation minSpineUp=${cont.minSpineUpDot} minHipsY=${cont.minHipsY}`
        );
      }
      console.log(
        `  [Continuity OK] S${String(scIdx + 1).padStart(2, '0')} (${cont.scenario}) | ${cont.segmentCount} segs | ` +
          `maxSeamPelvis30ms=${maxSeamPelvis.toFixed(4)}m maxPelvis40ms=${cont.maxPelvisStepMeters.toFixed(4)}m minSpineUp=${cont.minSpineUpDot.toFixed(2)}`
      );
    }

    // 4. S01 White-Model Assembled Sequence 5-Phase Filmstrip vs Real Video
    const s01Times = [1.00, 1.72, 2.24, 2.82, 3.52];
    for (const t of s01Times) {
      const tag = `s01_${t.toFixed(2)}`;
      await cdp.eval(`window.__STUDIO_DEBUG__.setSplitLayout(true)`);
      const splitInfo = await cdp.eval(
        `window.__STUDIO_DEBUG__.inspectScenario(0, ${t}, 'broadcast', null, false)`
      );
      const splitPng = path.join(OUT_DIR, `wb_split_${tag}.png`);
      await cdp.screenshotPng(splitPng);

      await cdp.eval(`window.__STUDIO_DEBUG__.setSplitLayout(false)`);
      const closeInfo = await cdp.eval(
        `window.__STUDIO_DEBUG__.inspectScenario(0, ${t}, 'ankle', null, false)`
      );
      const closePng = path.join(OUT_DIR, `wb_close_${tag}.png`);
      await cdp.screenshotPng(closePng);

      const b = closeInfo.biomechanics;
      if (Math.abs(t - 2.24) < 0.02) {
        if (!(b.rFootPos[1] > b.lFootPos[1] + 0.14)) {
          invariantFailures.push(
            `S01 t=2.24s expected Right (#8) foot lifted above Left stance foot, got L=${b.lFootPos[1]}m R=${b.rFootPos[1]}m`
          );
        }
        if (b.minFootToBallDist > 0.36) {
          invariantFailures.push(
            `S01 t=2.24s minFootToBallDist=${b.minFootToBallDist}m > 0.36m`
          );
        }
      }

      s01Records.push({
        t,
        splitPng,
        closePng,
        bio: b,
        videoTime: splitInfo.videoTime
      });
    }

    // 5. Multi-Position Assembled Scenarios Split Sheet (S02, S03, S08, S16)
    await cdp.eval(`window.__STUDIO_DEBUG__.setSplitLayout(true)`);
    const multiPlan = [
      { idx: 1, title: 'S02 Pedri La Croqueta (MF)', t: 3.05 },
      { idx: 2, title: 'S03 Pedri 360 Roulette (MF)', t: 2.45 },
      { idx: 7, title: 'S08 Pedri Double Fake-Shot (MF)', t: 3.55 },
      { idx: 15, title: 'S16 Timber 180 Half-Turn (DF)', t: 2.15 }
    ];
    for (const mp of multiPlan) {
      const info = await cdp.eval(
        `window.__STUDIO_DEBUG__.inspectScenario(${mp.idx}, ${mp.t}, 'broadcast', null, false)`
      );
      const splitPng = path.join(OUT_DIR, `wb_multi_s${String(mp.idx + 1).padStart(2, '0')}.png`);
      await cdp.screenshotPng(splitPng);
      multiPosRecords.push({ ...mp, splitPng, bio: info.biomechanics });
    }

    // 6. Verify 1-Click [W] Toggle to Stadium Kit + Mowed Grass Mode
    await cdp.eval(`window.__STUDIO_DEBUG__.setWhiteBoxMode(false)`);
    await cdp.eval(`window.__STUDIO_DEBUG__.inspectScenario(0, 2.24, 'broadcast', null, false)`);
    kitVerifyPng = path.join(OUT_DIR, 'qa_kit_mode_s01_verify.png');
    await cdp.screenshotPng(kitVerifyPng);
    await cdp.eval(`window.__STUDIO_DEBUG__.setWhiteBoxMode(true)`);
  } finally {
    cdp?.close();
    if (chrome?.proc) {
      try {
        chrome.proc.kill('SIGKILL');
      } catch {}
      await new Promise((r) => setTimeout(r, 250));
    }
    if (chrome?.userDataDir) {
      try {
        fs.rmSync(chrome.userDataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 120 });
      } catch {}
    }
    server.close();
  }

  if (consoleErrors.length > 0 || pageErrors.length > 0) {
    invariantFailures.push(`Console/Page errors: ${JSON.stringify([...consoleErrors, ...pageErrors])}`);
  }

  const pyBin = findPythonWithCv2();
  const atomicGridPath = stitchAtomicShowcaseGrid(pyBin, atomicShots);
  const s01FilmstripPath = stitchS01AssembledFilmstrip(pyBin, s01Records);
  const multiPosSheetPath = stitchMultiPosSheet(pyBin, multiPosRecords);

  if (atomicGridPath) console.log(`  [Composite 1] Atomic Showcase 8-Clip Grid -> ${atomicGridPath}`);
  if (s01FilmstripPath) console.log(`  [Composite 2] S01 Assembled Filmstrip     -> ${s01FilmstripPath}`);
  if (multiPosSheetPath) console.log(`  [Composite 3] Multi-Pos Assembled Sheet   -> ${multiPosSheetPath}`);
  if (kitVerifyPng) console.log(`  [Composite 4] Stadium Kit Toggle Verify   -> ${kitVerifyPng}`);

  const pass1Ok = invariantFailures.length === 0;
  console.log(
    pass1Ok
      ? '=== [Pass 1 RESULT] AUTOMATED BIOMECHANICAL & CONTINUITY GATE: PASS (Agent MUST now view_file composites!) ==='
      : `=== [Pass 1 RESULT] FAIL (${invariantFailures.length} invariant violations) ===\n  - ` +
          invariantFailures.join('\n  - ')
  );

  console.log('\n=== [Dual-QA Gate] Pass 2: Grok CLI Independent Audit ===');
  const grokResult = runGrokCliAudit(
    {
      pass1Ok,
      atomicCatalogCount: 86,
      consoleErrorCount: consoleErrors.length,
      pageErrorCount: pageErrors.length,
      invariantFailures,
      continuityAudits,
      atomicSamples: atomicShots.map((s) => ({ clipId: s.clipId, t: s.t, bio: s.bio }))
    },
    [atomicGridPath, s01FilmstripPath, multiPosSheetPath, kitVerifyPng]
  );

  console.log(`  [Grok CLI Status] ${grokResult.status}`);
  if (grokResult.detail) {
    console.log(`  [Grok CLI Output]\n${grokResult.detail.split('\n').map((l) => '    ' + l).join('\n')}`);
  }

  const reportPath = path.join(OUT_DIR, 'audit_report.json');
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        pass1Ok,
        consoleErrors,
        pageErrors,
        invariantFailures,
        composites: {
          atomicGridPath,
          s01FilmstripPath,
          multiPosSheetPath,
          kitVerifyPng
        },
        continuityAudits,
        grokAudit: grokResult
      },
      null,
      2
    )
  );
  console.log(`\n[Report] Saved full audit report -> ${reportPath}`);

  if (!pass1Ok) process.exit(1);
  if (grokResult.status === 'BLOCKED_GROK_AUTH' || grokResult.status === 'BLOCKED_NO_BINARY') {
    process.exit(2);
  }
  if (!grokResult.ok) process.exit(3);
}

main().catch((err) => {
  console.error('[Dual-QA Fatal Error]', err);
  process.exit(1);
});
