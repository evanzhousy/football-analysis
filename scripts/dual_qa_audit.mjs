#!/usr/bin/env node
/**
 * scripts/dual_qa_audit.mjs — Mandatory Dual-Verification Gate (AGENTS.md)
 *
 * Pass 1: Self Visual & Biomechanical Audit
 *   - Starts an ephemeral HTTP server with full `206 Partial Content` Range support
 *   - Launches Headless Chrome with mandatory ANGLE + SwiftShader WebGL2 flags
 *   - Verifies 0 console/page errors and hard 65-bone Mixamo biomechanical invariants
 *   - Captures real WebGL2 screenshots (ankle close-up + full 1:1 split-screen)
 *   - Builds 1:1 side-by-side forensic sheets `[原片高清放大帧 | 3D 足踝近景 | 1:1 分屏全局]`
 *     so the primary agent MUST visually inspect them via `view_file`
 *
 * Pass 2: Grok CLI Independent Audit
 *   - Invokes `/home/antigravity/.local/bin/grok` (or `grok` on PATH) headlessly
 *     with full biomechanical telemetry + git diff context (and xAI Vision multimodal
 *     screenshot audit when `GROK_API_KEY` / `XAI_API_KEY` is configured)
 *   - Fails closed if Pass 1 fails OR if Grok CLI flags issues / lacks API credentials
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
    '--window-size=1600,900',
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

function generateForensicComposites(pyBin, s01Records) {
  if (!pyBin) return null;
  const outComposite = path.join(OUT_DIR, 'qa_s01_forensic_comparison.png');
  const pyScript = `
import json, sys, cv2, numpy as np

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
    # Zoom onto Pedri & ball in HD match video
    cx = int(475 + max(0.0, t - 2.25) * 95)
    x0 = max(0, min(vw - 400, cx - 200))
    vcrop = cv2.resize(vframe[120:510, x0:x0+400], (420, 340), interpolation=cv2.INTER_CUBIC)
    cv2.putText(vcrop, f"HD Match Video t={t:.2f}s", (12, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.72, (60, 255, 120), 2)

    ankle_img = cv2.imread(rec["anklePng"])
    # Crop 3D viewport center of ankle close-up (full-canvas mode or right pane)
    ah, aw = ankle_img.shape[:2]
    acrop = cv2.resize(ankle_img[70:ah-90, int(aw*0.26):int(aw*0.76)], (480, 340), interpolation=cv2.INTER_AREA)
    b = rec["biomechanics"]
    cv2.putText(acrop, f"3D Close-Up t={t:.2f}s | spineUp={b['spineUpDot']:.2f}", (12, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.62, (80, 220, 255), 2)
    cv2.putText(acrop, f"L_footY={b['lFootPos'][1]:.2f}m R_footY={b['rFootPos'][1]:.2f}m ballD={b['minFootToBallDist']:.2f}m", (12, 54), cv2.FONT_HERSHEY_SIMPLEX, 0.54, (255, 235, 120), 1)

    split_img = cv2.imread(rec["splitPng"])
    scrop = cv2.resize(split_img, (600, 340), interpolation=cv2.INTER_AREA)
    cv2.putText(scrop, f"1:1 Split Studio UI t={t:.2f}s", (12, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.62, (255, 200, 90), 2)

    rows.append(np.hstack([vcrop, acrop, scrop]))

sheet = np.vstack(rows)
cv2.imwrite(out_path, sheet)
print(out_path)
`;
  const videoPath = path.join(REPO_ROOT, 'assets/videos/zhibo8_pedri_all_8_clips.mp4');
  const res = spawnSync(pyBin, ['-c', pyScript, videoPath, JSON.stringify(s01Records), outComposite], {
    encoding: 'utf8'
  });
  if (res.status !== 0) {
    console.error('[Pass 1] Failed to stitch composite:', res.stderr);
    return null;
  }
  return outComposite;
}

function runGrokCliAudit(reportSummary, compositePath) {
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
    'Audit the latest changes in src/videoCaptureDriver.js, src/videoCaptureData_S01.js, src/babylonPlayer.js, and src/scenarios.js,',
    'as well as the headless WebGL2 biomechanical telemetry in /tmp/dual_qa_out/audit_report.json',
    compositePath ? `and the 1:1 comparison sheet at ${compositePath}.` : '.',
    'Check specifically:',
    '1) Zero 90-degree Armature axis flip (hipsY in [0.68, 1.18], spineUpDot >= 0.72).',
    '2) Zero 90-degree vertical skyward boots (Mixamo -33 deg rest slope respected, planted toeSlopeY <= -0.10).',
    '3) S01 Pedri reception at t=2.28s matches HD footage: left leg planted on turf, right leg (#8) lifted backward to cushion dropping ball (y~0.39m), clockwise turn to sprint.',
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
  console.log('=== [Dual-QA Gate] Pass 1: Real WebGL2 Render + Biomechanical Invariant Audit ===');
  const { server, port } = await startRangeStaticServer(REPO_ROOT);
  const debugPort = 9330 + Math.floor(Math.random() * 400);
  let chrome = null;
  let cdp = null;

  const consoleErrors = [];
  const pageErrors = [];
  const invariantFailures = [];
  const auditedFrames = [];
  const s01CompositeInputs = [];

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

    // Wait for __STUDIO_DEBUG__ and 65-bone Mixamo rig + 32-clip library to finish loading
    const readyStart = Date.now();
    let studioReady = false;
    while (Date.now() - readyStart < 30000) {
      studioReady = await cdp.eval(`Boolean(window.__STUDIO_DEBUG__ && window.__STUDIO_DEBUG__.isReady())`);
      if (studioReady) break;
      await new Promise((r) => setTimeout(r, 250));
    }
    if (!studioReady) {
      throw new Error('Timed out waiting for window.__STUDIO_DEBUG__.isReady() (WebGL/rig init failed)');
    }
    await cdp.eval(`window.__STUDIO_DEBUG__.pauseRenderLoop()`);

    const auditPlan = [
      // S01 (Pedri vs Mallorca — VideoMocap + TouchIK): full reception-turn-sprint sequence
      { idx: 0, label: 's01', t: 1.68, expectStance: true },
      { idx: 0, label: 's01', t: 2.00, expectStance: true },
      { idx: 0, label: 's01', t: 2.28, expectTouchPeak: true, expectRightLift: true },
      { idx: 0, label: 's01', t: 2.52, expectStance: true },
      { idx: 0, label: 's01', t: 2.80, expectStance: true },
      { idx: 0, label: 's01', t: 3.30, expectSprint: true },
      // Regression checks on non-VideoMocap scenarios (S02 Rayo Croqueta & S16 Timber Turn)
      { idx: 1, label: 's02', t: 3.05, expectTouchPeak: true },
      { idx: 15, label: 's16', t: 2.68, expectTouchPeak: true }
    ];

    for (const item of auditPlan) {
      const tag = `${item.label}_${item.t.toFixed(2)}`;
      // 1. Capture 1:1 Split-Screen Broadcast View
      await cdp.eval(`window.__STUDIO_DEBUG__.setSplitLayout(true)`);
      const splitInfo = await cdp.eval(
        `window.__STUDIO_DEBUG__.inspectScenario(${item.idx}, ${item.t}, 'broadcast', null, false)`
      );
      const splitPng = path.join(OUT_DIR, `split_${tag}.png`);
      await cdp.screenshotPng(splitPng);

      // 2. Capture Full-Canvas 3D Ankle/Body Close-Up View
      await cdp.eval(`window.__STUDIO_DEBUG__.setSplitLayout(false)`);
      const ankleInfo = await cdp.eval(
        `window.__STUDIO_DEBUG__.inspectScenario(${item.idx}, ${item.t}, 'ankle', null, false)`
      );
      const anklePng = path.join(OUT_DIR, `ankle_${tag}.png`);
      await cdp.screenshotPng(anklePng);

      const b = ankleInfo.biomechanics;
      if (!b) {
        invariantFailures.push(`${tag}: missing biomechanics telemetry`);
        continue;
      }

      // Hard biomechanical assertions (AGENTS.md Section 1.2)
      const hipsY = b.hipsPos[1];
      if (hipsY < 0.68 || hipsY > 1.18) {
        invariantFailures.push(`${tag}: hipsY=${hipsY} out of anatomical [0.68, 1.18]m bounds`);
      }
      if (b.spineUpDot < 0.72) {
        invariantFailures.push(`${tag}: spineUpDot=${b.spineUpDot} (< 0.72 indicates torso fold/axis bug!)`);
      }
      const minFootY = Math.min(b.lFootPos[1], b.rFootPos[1]);
      if (item.expectStance && (minFootY < 0.105 || minFootY > 0.21)) {
        invariantFailures.push(`${tag}: stance minFootY=${minFootY}m out of [0.105, 0.21]m turf range`);
      }
      // Verify planted foot never points 90 deg straight up into the sky
      const stanceIsLeft = b.lFootPos[1] <= b.rFootPos[1];
      const plantedSlopeY = stanceIsLeft ? b.lToeSlopeY : b.rToeSlopeY;
      if (minFootY < 0.17 && plantedSlopeY > -0.08) {
        invariantFailures.push(
          `${tag}: planted ${stanceIsLeft ? 'Left' : 'Right'} boot toeSlopeY=${plantedSlopeY} (> -0.08 indicates upward boot flip!)`
        );
      }
      if (item.expectRightLift && !(b.rFootPos[1] > b.lFootPos[1] + 0.08)) {
        invariantFailures.push(
          `${tag}: expected Right (#8) receiving foot lifted above Left pivot foot, got L=${b.lFootPos[1]}m R=${b.rFootPos[1]}m`
        );
      }
      if (item.expectTouchPeak && b.minFootToBallDist > 0.44) {
        invariantFailures.push(
          `${tag}: touch peak minFootToBallDist=${b.minFootToBallDist}m exceeds 0.44m contact threshold`
        );
      }

      auditedFrames.push({
        tag,
        scenario: splitInfo.scenario,
        t: item.t,
        videoTime: splitInfo.videoTime,
        telemetry: ankleInfo.pedriTelemetry,
        biomechanics: b,
        splitPng,
        anklePng
      });

      if (item.idx === 0) {
        s01CompositeInputs.push({ t: item.t, splitPng, anklePng, biomechanics: b });
      }
      console.log(
        `  [OK] ${tag} | hipsY=${hipsY.toFixed(2)}m spineUp=${b.spineUpDot.toFixed(2)} ` +
          `L_footY=${b.lFootPos[1].toFixed(2)}m R_footY=${b.rFootPos[1].toFixed(2)}m ` +
          `plantedToeSlopeY=${plantedSlopeY.toFixed(2)} ballDist=${b.minFootToBallDist.toFixed(2)}m | ${b.activeMocapDebug}`
      );
    }

    // Restore split layout clean state
    await cdp.eval(`window.__STUDIO_DEBUG__.setSplitLayout(true)`);
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
  const compositePath = generateForensicComposites(pyBin, s01CompositeInputs);
  if (compositePath) {
    console.log(`  [Composite] 1:1 Forensic Comparison Sheet -> ${compositePath}`);
  }

  const pass1Ok = invariantFailures.length === 0;
  console.log(
    pass1Ok
      ? '=== [Pass 1 RESULT] AUTOMATED BIOMECHANICAL & RENDER GATE: PASS (Agent MUST now view_file composite!) ==='
      : `=== [Pass 1 RESULT] FAIL (${invariantFailures.length} invariant violations) ===\n  - ` +
          invariantFailures.join('\n  - ')
  );

  console.log('\n=== [Dual-QA Gate] Pass 2: Grok CLI Independent Audit ===');
  const grokResult = runGrokCliAudit(
    {
      pass1Ok,
      consoleErrorCount: consoleErrors.length,
      pageErrorCount: pageErrors.length,
      invariantFailures,
      frames: auditedFrames.map((f) => ({
        tag: f.tag,
        videoTime: f.videoTime,
        biomechanics: f.biomechanics,
        telemetry: f.telemetry
      }))
    },
    compositePath
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
        compositePath,
        auditedFrames,
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
