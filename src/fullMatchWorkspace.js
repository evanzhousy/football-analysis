/**
 * src/fullMatchWorkspace.js
 *
 * Full-Match Ball-Carrying & Pressing Breakdown Workspace Controller:
 *   - Built-in 90/120-minute full-match datasets (StatsBomb 360° El Clásico, Euro 2024 ESP-GER, Zhibo8 Reel)
 *   - Pure client-side local MP4/WebM auto-scanner (`scanLocalMatchVideoInBrowser`) + JSON Import/Export + CSV Export
 *   - Interactive 90/120-min Pressing Intensity Timeline Canvas
 *   - Interactive 105m × 68m Tactical Pitch Heatmap + 360° Spatial Freeze-Frame Canvas
 *   - 4-Dimensional Taxonomy Filter Chips (`pressType` × `pitchZone` × `escapeOutcome` × `playerRole`/`playerName`)
 *   - Sub-clip Video Loop Inspector + Live 4D Manual Re-Classification + 1-Click Bridge to 3D White-Model Atomic Lab
 */

import { PRESSING_TAXONOMY, BUILTIN_FULL_MATCHES } from './fullMatchSamples.js';
import { scanLocalMatchVideoInBrowser } from './fullMatchEngine.js';

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sliceMatchSeconds(slice) {
  if (typeof slice.clock === 'string' && slice.clock.includes(':')) {
    const parts = slice.clock.split(':').map((n) => parseInt(n, 10) || 0);
    if (parts.length >= 2) return parts[0] * 60 + parts[1];
  }
  return Number(slice.tStart || 0);
}

function hexToRgba(hex, alpha) {
  const clean = (hex || '#38bdf8').replace('#', '');
  const num = parseInt(clean, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function initFullMatchWorkspace({
  containerEl,
  topActionsEl,
  onInspectSliceIn3D
}) {
  // Clone built-in matches so live manual re-classification mutates working state cleanly
  const matches = BUILTIN_FULL_MATCHES.map((m) => ({
    ...m,
    slices: m.slices.map((s) => ({ ...s }))
  }));

  let activeMatchId = matches[0].id;
  let activeSliceId = matches[0].slices[0]?.id || null;
  let groupByMode = 'pressType'; // 'timeline' | 'pressType' | 'pitchZone' | 'escapeOutcome'
  let pitchViewMode = 'all_heat'; // 'all_heat' | 'focus_360'
  let videoPlaybackRate = 0.5;
  let scanAbortController = null;

  const filters = {
    pressType: 'ALL',
    pitchZone: 'ALL',
    escapeOutcome: 'ALL',
    playerRole: 'ALL',
    playerName: 'ALL'
  };

  // Build Topbar Controls inside `topActionsEl`
  topActionsEl.innerHTML = `
    <select id="fm-match-select" class="fm-match-select" aria-label="选择整场比赛数据集"></select>
    <label class="fm-top-btn primary-upload" for="fm-local-mp4-input" title="纯前端扫描本地比赛 MP4/WebM，自动检测持球逼抢高密片段并四维归类">
      📂 导入比赛MP4切片
    </label>
    <input id="fm-local-mp4-input" type="file" accept="video/*" style="display:none;" />
    <label class="fm-top-btn" for="fm-import-json-input" title="导入离线 Python 脚本生成的 match_pressing_breakdown.json">
      📥 导入JSON
    </label>
    <input id="fm-import-json-input" type="file" accept=".json,application/json" style="display:none;" />
    <button id="btn-fm-export-json" class="fm-top-btn" type="button" title="导出当前整场逼抢切片归类 JSON">📤 导出JSON</button>
    <button id="btn-fm-export-csv" class="fm-top-btn" type="button" title="导出当前筛选切片统计表 CSV">📊 导出CSV</button>
  `;

  // Build Workspace Layout inside `containerEl`
  containerEl.innerHTML = `
    <!-- Top 90/120-Minute Match Pressing Intensity Timeline -->
    <header class="fm-timeline-card">
      <div class="fm-timeline-head">
        <div class="fm-timeline-title-group">
          <span id="fm-comp-badge" class="fm-comp-badge">LA LIGA</span>
          <h2 id="fm-match-title" class="fm-match-title"></h2>
          <span id="fm-source-pill" class="fm-source-pill"></span>
        </div>
        <div class="fm-timeline-legend">
          <span class="fm-leg-item"><i style="background:#2dd4bf;"></i>半转身</span>
          <span class="fm-leg-item"><i style="background:#facc15;"></i>过人技巧</span>
          <span class="fm-leg-item"><i style="background:#38bdf8;"></i>一脚出球</span>
          <span class="fm-leg-item"><i style="background:#94a3b8;"></i>护球重置</span>
          <span class="fm-leg-item"><i style="background:#ef4444;"></i>被断反例</span>
        </div>
      </div>
      <div class="fm-timeline-canvas-wrap">
        <canvas id="fm-timeline-canvas"></canvas>
      </div>
    </header>

    <!-- Main 3-Column Tactical Breakdown Grid -->
    <div class="fm-body-grid">
      <!-- Left Column: KPIs + 4D Taxonomy Filters -->
      <aside class="fm-filter-panel" aria-label="四维逼抢分类筛选面板">
        <div class="fm-kpi-grid">
          <div class="fm-kpi-box">
            <span class="fm-kpi-label">命中逼抢切片</span>
            <strong id="fm-kpi-count" class="fm-kpi-val">0 / 0</strong>
          </div>
          <div class="fm-kpi-box">
            <span class="fm-kpi-label">抗逼抢破围率</span>
            <strong id="fm-kpi-success" class="fm-kpi-val accent-emerald">0%</strong>
          </div>
          <div class="fm-kpi-box">
            <span class="fm-kpi-label">多人夹击/高位比</span>
            <strong id="fm-kpi-heavy" class="fm-kpi-val accent-gold">0%</strong>
          </div>
          <div class="fm-kpi-box">
            <span class="fm-kpi-label">平均最近贴防距</span>
            <strong id="fm-kpi-dist" class="fm-kpi-val accent-cyan">0.00m</strong>
          </div>
        </div>

        <div class="fm-filter-header">
          <span>四维战术切片归类筛选</span>
          <button id="btn-fm-reset-filters" class="fm-reset-btn" type="button">重置全部筛选</button>
        </div>

        <div id="fm-filters-scroll" class="fm-filters-scroll">
          <div class="fm-filter-group">
            <div class="fm-filter-group-title">1. 逼抢形态与人数 (Press Type)</div>
            <div id="fm-chips-pressType" class="fm-chips-wrap"></div>
          </div>

          <div class="fm-filter-group">
            <div class="fm-filter-group-title">2. 球场发生区域 (Pitch Zone)</div>
            <div id="fm-chips-pitchZone" class="fm-chips-wrap"></div>
          </div>

          <div class="fm-filter-group">
            <div class="fm-filter-group-title">3. 摆脱技术与结果 (Outcome)</div>
            <div id="fm-chips-escapeOutcome" class="fm-chips-wrap"></div>
          </div>

          <div class="fm-filter-group">
            <div class="fm-filter-group-title">4. 持球位置与焦点球员 (Role & Player)</div>
            <div id="fm-chips-playerRole" class="fm-chips-wrap" style="margin-bottom:6px;"></div>
            <div id="fm-chips-playerName" class="fm-chips-wrap compact-players"></div>
          </div>

          <div class="fm-cli-card">
            <div class="fm-cli-title">⚡ 离线超清整场批处理 CLI (FFmpeg 切片导出)</div>
            <code>python scripts/analyze_full_match_pressing.py --video match.mp4 --export-clips</code>
          </div>
        </div>
      </aside>

      <!-- Center Column: 2D Tactical Pitch Heatmap/360° + Active Slice Video & 3D Bridge -->
      <section class="fm-center-stage" aria-label="球场空间热力分布与当前切片检阅舱">
        <div class="fm-pitch-card">
          <div class="fm-card-bar">
            <div class="fm-card-bar-left">
              <span class="fm-eyebrow">105m × 68m 逼抢热区 & 360° 空间追踪</span>
              <span class="fm-attack-dir">本方后场 ➔ 对方球门 (进攻方向向右)</span>
            </div>
            <div class="fm-pitch-mode-tabs">
              <button id="btn-pitch-all" class="fm-mini-tab active" type="button">🔥 筛选热区+突围向量</button>
              <button id="btn-pitch-360" class="fm-mini-tab" type="button">🎯 聚焦单帧 360° 攻防站位</button>
            </div>
          </div>
          <div class="fm-pitch-canvas-wrap">
            <canvas id="fm-pitch-canvas"></canvas>
          </div>
        </div>

        <div class="fm-inspector-card">
          <div class="fm-slice-video-col">
            <div class="fm-video-box">
              <video id="fm-slice-video" muted playsinline controls preload="metadata"></video>
              <span id="fm-video-mode-badge" class="fm-video-badge">0.5x 循环慢镜</span>
            </div>
            <div class="fm-video-controls-bar">
              <span id="fm-video-range-label" class="fm-video-range">00:00</span>
              <div class="fm-rate-btns">
                <button id="btn-fm-rate-05" class="fm-mini-tab active" type="button">0.5x 慢镜</button>
                <button id="btn-fm-rate-10" class="fm-mini-tab" type="button">1.0x 原速</button>
              </div>
            </div>
          </div>

          <div class="fm-slice-detail-col">
            <div class="fm-detail-top">
              <div>
                <div class="fm-detail-badges">
                  <span id="fm-det-clock" class="fm-clock-pill">00:31</span>
                  <span id="fm-det-team" class="fm-team-pill">巴塞罗那</span>
                  <span id="fm-det-metrics" class="fm-metrics-inline"></span>
                </div>
                <h3 id="fm-det-title" class="fm-det-title"></h3>
              </div>
              <button id="btn-fm-send-to-3d" class="fm-send-3d-btn" type="button">
                🦴 送入 3D 白模实验室重演 ➔
              </button>
            </div>

            <p id="fm-det-summary" class="fm-det-summary"></p>

            <div class="fm-retag-box">
              <span class="fm-retag-label">人工复核归类：</span>
              <div class="fm-retag-selects">
                <select id="fm-edit-pressType" aria-label="修改逼抢形态分类"></select>
                <select id="fm-edit-pitchZone" aria-label="修改球场区域分类"></select>
                <select id="fm-edit-escapeOutcome" aria-label="修改摆脱结果分类"></select>
                <select id="fm-edit-playerRole" aria-label="修改球员位置分类"></select>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Right Column: Grouped Slice Cards Wall -->
      <aside class="fm-cards-panel" aria-label="归类切片卡片墙">
        <div class="fm-cards-header">
          <div class="fm-cards-title-row">
            <span class="fm-eyebrow">持球逼抢切片归类目录</span>
            <span id="fm-grouped-count" class="fm-panel-count">0 SLICES</span>
          </div>
          <div class="fm-groupby-tabs" role="tablist">
            <button class="fm-grp-btn active" data-grp="pressType" type="button">按逼抢形态</button>
            <button class="fm-grp-btn" data-grp="pitchZone" type="button">按发生区域</button>
            <button class="fm-grp-btn" data-grp="escapeOutcome" type="button">按摆脱结果</button>
            <button class="fm-grp-btn" data-grp="timeline" type="button">按时间轴</button>
          </div>
        </div>
        <div id="fm-cards-scroll" class="fm-cards-scroll"></div>
      </aside>
    </div>

    <!-- Local MP4 Auto-Scan Modal -->
    <div id="fm-scan-modal" class="fm-scan-modal" style="display:none;">
      <div class="fm-scan-dialog">
        <h3 id="fm-scan-title">正在自动扫描整场比赛视频持球逼抢片段...</h3>
        <p id="fm-scan-sub">基于浏览器 WebCV 草皮掩膜 + 局部球员高密聚拢度 + 镜头切分自动切片</p>
        <div class="fm-progress-track">
          <div id="fm-progress-fill" class="fm-progress-fill" style="width:0%;"></div>
        </div>
        <div class="fm-scan-status-row">
          <span id="fm-scan-pct">0%</span>
          <button id="btn-fm-cancel-scan" class="fm-reset-btn" type="button">取消扫描</button>
        </div>
      </div>
    </div>
  `;

  // Grab DOM references
  const matchSelectEl = document.getElementById('fm-match-select');
  const localMp4InputEl = document.getElementById('fm-local-mp4-input');
  const importJsonInputEl = document.getElementById('fm-import-json-input');
  const btnExportJsonEl = document.getElementById('btn-fm-export-json');
  const btnExportCsvEl = document.getElementById('btn-fm-export-csv');

  const compBadgeEl = document.getElementById('fm-comp-badge');
  const matchTitleEl = document.getElementById('fm-match-title');
  const sourcePillEl = document.getElementById('fm-source-pill');
  const timelineCanvas = document.getElementById('fm-timeline-canvas');
  const pitchCanvas = document.getElementById('fm-pitch-canvas');

  const kpiCountEl = document.getElementById('fm-kpi-count');
  const kpiSuccessEl = document.getElementById('fm-kpi-success');
  const kpiHeavyEl = document.getElementById('fm-kpi-heavy');
  const kpiDistEl = document.getElementById('fm-kpi-dist');
  const btnResetFiltersEl = document.getElementById('btn-fm-reset-filters');

  const btnPitchAllEl = document.getElementById('btn-pitch-all');
  const btnPitch360El = document.getElementById('btn-pitch-360');

  const sliceVideoEl = document.getElementById('fm-slice-video');
  const videoBadgeEl = document.getElementById('fm-video-mode-badge');
  const videoRangeLabelEl = document.getElementById('fm-video-range-label');
  const btnRate05El = document.getElementById('btn-fm-rate-05');
  const btnRate10El = document.getElementById('btn-fm-rate-10');

  const detClockEl = document.getElementById('fm-det-clock');
  const detTeamEl = document.getElementById('fm-det-team');
  const detMetricsEl = document.getElementById('fm-det-metrics');
  const detTitleEl = document.getElementById('fm-det-title');
  const detSummaryEl = document.getElementById('fm-det-summary');
  const btnSendTo3DEl = document.getElementById('btn-fm-send-to-3d');

  const editSelects = {
    pressType: document.getElementById('fm-edit-pressType'),
    pitchZone: document.getElementById('fm-edit-pitchZone'),
    escapeOutcome: document.getElementById('fm-edit-escapeOutcome'),
    playerRole: document.getElementById('fm-edit-playerRole')
  };

  const groupedCountEl = document.getElementById('fm-grouped-count');
  const cardsScrollEl = document.getElementById('fm-cards-scroll');

  const scanModalEl = document.getElementById('fm-scan-modal');
  const scanTitleEl = document.getElementById('fm-scan-title');
  const progressFillEl = document.getElementById('fm-progress-fill');
  const scanPctEl = document.getElementById('fm-scan-pct');
  const btnCancelScanEl = document.getElementById('btn-fm-cancel-scan');

  // Populate Re-Classification Dropdowns
  for (const [dim, selectEl] of Object.entries(editSelects)) {
    const items = PRESSING_TAXONOMY[dim].items;
    selectEl.innerHTML = Object.entries(items)
      .map(([k, v]) => `<option value="${k}">${escapeHtml(v.label)}</option>`)
      .join('');
    selectEl.addEventListener('change', () => {
      const slice = getActiveSlice();
      if (!slice) return;
      slice[dim] = selectEl.value;
      renderAll({ keepVideo: true });
    });
  }

  function getActiveMatch() {
    return matches.find((m) => m.id === activeMatchId) || matches[0];
  }

  function matchesFilter(slice, omitDim = null) {
    if (omitDim !== 'pressType' && filters.pressType !== 'ALL' && slice.pressType !== filters.pressType) {
      return false;
    }
    if (omitDim !== 'pitchZone' && filters.pitchZone !== 'ALL' && slice.pitchZone !== filters.pitchZone) {
      return false;
    }
    if (
      omitDim !== 'escapeOutcome' &&
      filters.escapeOutcome !== 'ALL' &&
      slice.escapeOutcome !== filters.escapeOutcome
    ) {
      return false;
    }
    if (omitDim !== 'playerRole' && filters.playerRole !== 'ALL' && slice.playerRole !== filters.playerRole) {
      return false;
    }
    if (omitDim !== 'playerName' && filters.playerName !== 'ALL' && slice.playerName !== filters.playerName) {
      return false;
    }
    return true;
  }

  function getFilteredSlices() {
    const m = getActiveMatch();
    return m.slices.filter((s) => matchesFilter(s));
  }

  function getActiveSlice() {
    const m = getActiveMatch();
    const filtered = getFilteredSlices();
    const inFiltered = filtered.find((s) => s.id === activeSliceId);
    if (inFiltered) return inFiltered;
    if (filtered.length > 0) {
      activeSliceId = filtered[0].id;
      return filtered[0];
    }
    return m.slices.find((s) => s.id === activeSliceId) || m.slices[0] || null;
  }

  function populateMatchSelector() {
    matchSelectEl.innerHTML = matches
      .map(
        (m, i) =>
          `<option value="${escapeHtml(m.id)}"${m.id === activeMatchId ? ' selected' : ''}>` +
          `[${String(i + 1).padStart(2, '0')}] ${escapeHtml(m.homeTeamZh)} vs ${escapeHtml(m.awayTeamZh)} (${m.slices.length}切片 · ${m.totalMinutes}')` +
          `</option>`
      )
      .join('');
  }

  matchSelectEl.addEventListener('change', () => {
    selectMatch(matchSelectEl.value);
  });

  function resetFilters(shouldRender = true) {
    filters.pressType = 'ALL';
    filters.pitchZone = 'ALL';
    filters.escapeOutcome = 'ALL';
    filters.playerRole = 'ALL';
    filters.playerName = 'ALL';
    if (shouldRender) renderAll();
  }

  btnResetFiltersEl.addEventListener('click', () => resetFilters(true));

  function selectMatch(matchId) {
    const found = matches.find((m) => m.id === matchId);
    if (!found) return false;
    activeMatchId = found.id;
    resetFilters(false);
    activeSliceId = found.slices[0]?.id || null;
    populateMatchSelector();
    renderAll();
    return true;
  }

  // Sub-clip Video Loop Logic
  let activeLoopWindow = null; // { start, end } | null
  sliceVideoEl.addEventListener('timeupdate', () => {
    if (!activeLoopWindow) return;
    if (
      sliceVideoEl.currentTime >= activeLoopWindow.end ||
      sliceVideoEl.currentTime < activeLoopWindow.start - 0.35
    ) {
      sliceVideoEl.currentTime = activeLoopWindow.start;
      if (!sliceVideoEl.paused) {
        sliceVideoEl.play().catch(() => {});
      }
    }
  });

  function loadActiveSliceVideo(slice, match) {
    if (!slice) return;
    const src = (match.hasDirectFullVideo && match.videoSrc) ? match.videoSrc : slice.refVideoSrc;
    if (!src) {
      sliceVideoEl.removeAttribute('src');
      return;
    }

    const isDirectSlice = Boolean(match.hasDirectFullVideo);
    activeLoopWindow = isDirectSlice
      ? { start: Number(slice.tStart || 0), end: Math.max(Number(slice.tStart || 0) + 1.2, Number(slice.tEnd || 4)) }
      : null;
    sliceVideoEl.loop = !isDirectSlice;

    const curSrc = sliceVideoEl.getAttribute('data-cur-src');
    const targetStart = isDirectSlice ? activeLoopWindow.start : 0;

    if (curSrc !== src) {
      sliceVideoEl.setAttribute('data-cur-src', src);
      sliceVideoEl.src = src;
      sliceVideoEl.load();
      sliceVideoEl.addEventListener(
        'loadedmetadata',
        () => {
          sliceVideoEl.currentTime = clamp(targetStart, 0, Math.max(0, (sliceVideoEl.duration || 10) - 0.1));
          sliceVideoEl.playbackRate = videoPlaybackRate;
          sliceVideoEl.play().catch(() => {});
        },
        { once: true }
      );
    } else if (sliceVideoEl.readyState >= 1) {
      sliceVideoEl.currentTime = clamp(targetStart, 0, Math.max(0, (sliceVideoEl.duration || 10) - 0.1));
      sliceVideoEl.playbackRate = videoPlaybackRate;
      sliceVideoEl.play().catch(() => {});
    }

    videoBadgeEl.textContent = isDirectSlice
      ? `🎯 原片精准切片 ${slice.tStart.toFixed(1)}s–${slice.tEnd.toFixed(1)}s`
      : `📺 同类技术参考实况 + 360°真实追踪`;
    videoRangeLabelEl.textContent = isDirectSlice
      ? `原片区间 ${slice.tStart.toFixed(1)}s – ${slice.tEnd.toFixed(1)}s (${slice.duration}s)`
      : `比赛时刻 ${slice.clock} · 时长 ${slice.duration}s`;
  }

  function setVideoRate(rate) {
    videoPlaybackRate = rate;
    btnRate05El.classList.toggle('active', rate === 0.5);
    btnRate10El.classList.toggle('active', rate === 1.0);
    sliceVideoEl.playbackRate = rate;
  }
  btnRate05El.addEventListener('click', () => setVideoRate(0.5));
  btnRate10El.addEventListener('click', () => setVideoRate(1.0));

  btnPitchAllEl.addEventListener('click', () => {
    pitchViewMode = 'all_heat';
    btnPitchAllEl.classList.add('active');
    btnPitch360El.classList.remove('active');
    drawPitchCanvas();
  });
  btnPitch360El.addEventListener('click', () => {
    pitchViewMode = 'focus_360';
    btnPitch360El.classList.add('active');
    btnPitchAllEl.classList.remove('active');
    drawPitchCanvas();
  });

  containerEl.querySelectorAll('.fm-grp-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      groupByMode = btn.dataset.grp;
      containerEl.querySelectorAll('.fm-grp-btn').forEach((b) => b.classList.toggle('active', b === btn));
      renderSliceCards();
    });
  });

  btnSendTo3DEl.addEventListener('click', () => {
    const slice = getActiveSlice();
    if (slice && onInspectSliceIn3D) {
      sliceVideoEl.pause();
      onInspectSliceIn3D(slice, getActiveMatch());
    }
  });

  // Render Left KPIs & 4D Filter Chips
  function renderFiltersAndKpis() {
    const match = getActiveMatch();
    const all = match.slices;
    const filtered = getFilteredSlices();

    compBadgeEl.textContent = match.competition || 'FULL MATCH';
    matchTitleEl.textContent = match.title;
    sourcePillEl.textContent = match.sourceLabel || '';

    const escapedCount = filtered.filter((s) => s.escapeOutcome !== 'turnover_loss').length;
    const successPct = filtered.length > 0 ? Math.round((escapedCount / filtered.length) * 100) : 0;
    const heavyCount = filtered.filter((s) => s.pressType !== '1v1_back').length;
    const heavyPct = filtered.length > 0 ? Math.round((heavyCount / filtered.length) * 100) : 0;
    const avgDist =
      filtered.length > 0
        ? (filtered.reduce((acc, s) => acc + Number(s.minDefDistM || 1.5), 0) / filtered.length).toFixed(2)
        : '0.00';

    kpiCountEl.textContent = `${filtered.length} / ${all.length}`;
    kpiSuccessEl.textContent = `${successPct}%`;
    kpiHeavyEl.textContent = `${heavyPct}%`;
    kpiDistEl.textContent = `${avgDist}m`;

    const hasAnyFilter = Object.values(filters).some((v) => v !== 'ALL');
    btnResetFiltersEl.classList.toggle('has-active', hasAnyFilter);

    const buildDimChips = (dim) => {
      const wrap = document.getElementById(`fm-chips-${dim}`);
      const basePool = all.filter((s) => matchesFilter(s, dim));
      const items = PRESSING_TAXONOMY[dim].items;

      let html = `<button type="button" class="fm-chip${filters[dim] === 'ALL' ? ' active' : ''}" data-dim="${dim}" data-val="ALL">
        <span>全部</span><em>${basePool.length}</em>
      </button>`;

      for (const [key, meta] of Object.entries(items)) {
        const cnt = basePool.filter((s) => s[dim] === key).length;
        const active = filters[dim] === key;
        html += `<button type="button" class="fm-chip${active ? ' active' : ''}${cnt === 0 ? ' zero' : ''}" data-dim="${dim}" data-val="${key}" style="--chip-color:${meta.color};">
          <i class="fm-dot" style="background:${meta.color};"></i>
          <span>${escapeHtml(meta.label)}</span>
          <em>${cnt}</em>
        </button>`;
      }
      wrap.innerHTML = html;
      wrap.querySelectorAll('.fm-chip').forEach((btn) => {
        btn.addEventListener('click', () => {
          const val = btn.dataset.val;
          filters[dim] = filters[dim] === val && val !== 'ALL' ? 'ALL' : val;
          renderAll();
        });
      });
    };

    buildDimChips('pressType');
    buildDimChips('pitchZone');
    buildDimChips('escapeOutcome');
    buildDimChips('playerRole');

    // Top 8 Players in current match (respecting other active filters)
    const playerWrap = document.getElementById('fm-chips-playerName');
    const playerPool = all.filter((s) => matchesFilter(s, 'playerName'));
    const countsByPlayer = new Map();
    for (const s of all) {
      countsByPlayer.set(s.playerName, (countsByPlayer.get(s.playerName) || 0) + 1);
    }
    const topPlayers = Array.from(countsByPlayer.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);

    let pHtml = `<button type="button" class="fm-chip${filters.playerName === 'ALL' ? ' active' : ''}" data-val="ALL">
      <span>全部球员</span><em>${playerPool.length}</em>
    </button>`;
    for (const [pName] of topPlayers) {
      const cnt = playerPool.filter((s) => s.playerName === pName).length;
      const shortName = pName.split(' ')[0];
      pHtml += `<button type="button" class="fm-chip${filters.playerName === pName ? ' active' : ''}${cnt === 0 ? ' zero' : ''}" data-val="${escapeHtml(pName)}" title="${escapeHtml(pName)}">
        <span>${escapeHtml(shortName)}</span><em>${cnt}</em>
      </button>`;
    }
    playerWrap.innerHTML = pHtml;
    playerWrap.querySelectorAll('.fm-chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        const val = btn.dataset.val;
        filters.playerName = filters.playerName === val && val !== 'ALL' ? 'ALL' : val;
        renderAll();
      });
    });
  }

  // Render Active Slice Inspector Panel
  function renderActiveInspector(keepVideo = false) {
    const match = getActiveMatch();
    const slice = getActiveSlice();
    if (!slice) {
      detTitleEl.textContent = '当前筛选条件下暂无命中切片，请放宽或重置左侧四维筛选器';
      detSummaryEl.textContent = '';
      detMetricsEl.textContent = '';
      btnSendTo3DEl.disabled = true;
      return;
    }
    btnSendTo3DEl.disabled = false;

    const pMeta = PRESSING_TAXONOMY.pressType.items[slice.pressType];
    const zMeta = PRESSING_TAXONOMY.pitchZone.items[slice.pitchZone];
    const oMeta = PRESSING_TAXONOMY.escapeOutcome.items[slice.escapeOutcome];

    detClockEl.textContent = `#${String(slice.index).padStart(2, '0')} · ${slice.clock}`;
    detTeamEl.textContent = `${slice.team} vs ${slice.oppTeam}`;
    detMetricsEl.textContent =
      `${slice.presserCount}人压迫 · 最近贴防 ${slice.minDefDistM}m · 强度 ${slice.intensity}% · 坐标 [${slice.pitchXY[0]}m, ${slice.pitchXY[1]}m]`;
    detTitleEl.textContent = `#${slice.jerseyNumber || '8'} ${slice.playerName} (${slice.positionLabel}) — ${pMeta?.label || ''} × ${oMeta?.label || ''}`;
    detSummaryEl.textContent = `${slice.summary}（区域：${zMeta?.label || slice.pitchZone}）`;

    editSelects.pressType.value = slice.pressType;
    editSelects.pitchZone.value = slice.pitchZone;
    editSelects.escapeOutcome.value = slice.escapeOutcome;
    editSelects.playerRole.value = slice.playerRole;

    if (!keepVideo) {
      loadActiveSliceVideo(slice, match);
    }
  }

  // Render Right Grouped Slice Cards Wall
  function renderSliceCards() {
    const match = getActiveMatch();
    const filtered = getFilteredSlices();
    const curActive = getActiveSlice();
    groupedCountEl.textContent = `${filtered.length} SLICES`;

    if (filtered.length === 0) {
      cardsScrollEl.innerHTML = `<div class="fm-empty-cards">暂无符合四维筛选组合的持球逼抢切片。<br/>点击左侧「重置全部筛选」查看全场完整切片。</div>`;
      return;
    }

    const groups = [];
    if (groupByMode === 'timeline') {
      const p1 = filtered.filter((s) => s.period === 1);
      const p2 = filtered.filter((s) => s.period === 2);
      const et = filtered.filter((s) => s.period > 2);
      if (p1.length) groups.push({ key: 'p1', label: '上半场 (1st Half · 00\'–45\')', color: '#38bdf8', list: p1 });
      if (p2.length) groups.push({ key: 'p2', label: '下半场 (2nd Half · 45\'–90\')', color: '#facc15', list: p2 });
      if (et.length) groups.push({ key: 'et', label: '加时赛 (Extra Time · 90\'–120\')', color: '#fb7185', list: et });
    } else {
      const tax = PRESSING_TAXONOMY[groupByMode].items;
      for (const [k, meta] of Object.entries(tax)) {
        const list = filtered.filter((s) => s[groupByMode] === k);
        if (list.length > 0) {
          groups.push({ key: k, label: meta.label, color: meta.color, desc: meta.desc, list });
        }
      }
    }

    let html = '';
    for (const grp of groups) {
      const sharePct = Math.round((grp.list.length / filtered.length) * 100);
      html += `
        <div class="fm-group-block">
          <div class="fm-group-header" style="border-left-color:${grp.color};">
            <span class="fm-group-name" style="color:${grp.color};">${escapeHtml(grp.label)}</span>
            <span class="fm-group-stat">${grp.list.length} 处 (${sharePct}%)</span>
          </div>
          <div class="fm-group-cards">
      `;
      for (const s of grp.list) {
        const isAct = curActive && curActive.id === s.id;
        const pMeta = PRESSING_TAXONOMY.pressType.items[s.pressType];
        const zMeta = PRESSING_TAXONOMY.pitchZone.items[s.pitchZone];
        const oMeta = PRESSING_TAXONOMY.escapeOutcome.items[s.escapeOutcome];
        const thumbHtml = s.thumbnail
          ? `<img class="fm-card-thumb" src="${s.thumbnail}" alt="slice" />`
          : '';

        html += `
          <div class="fm-slice-card${isAct ? ' active' : ''}" data-slice-id="${escapeHtml(s.id)}">
            ${thumbHtml}
            <div class="fm-card-body">
              <div class="fm-card-top">
                <span class="fm-card-clock">#${String(s.index).padStart(2, '0')} · ${escapeHtml(s.clock)}</span>
                <span class="fm-card-player">#${escapeHtml(s.jerseyNumber || '8')} ${escapeHtml(s.playerName.split(' ')[0])}</span>
                <span class="fm-card-int" title="局部逼抢压迫强度">${s.intensity}% · ${s.minDefDistM}m</span>
              </div>
              <div class="fm-card-tags">
                <span class="fm-tag" style="color:${pMeta?.color};border-color:${hexToRgba(pMeta?.color, 0.38)};">${escapeHtml(pMeta?.label)}</span>
                <span class="fm-tag" style="color:${zMeta?.color};border-color:${hexToRgba(zMeta?.color, 0.38)};">${escapeHtml(zMeta?.label)}</span>
                <span class="fm-tag" style="color:${oMeta?.color};border-color:${hexToRgba(oMeta?.color, 0.38)};">${escapeHtml(oMeta?.label)}</span>
              </div>
              <div class="fm-card-summary">${escapeHtml(s.summary)}</div>
              <div class="fm-card-actions">
                <button type="button" class="fm-card-act-btn act-preview" data-slice-id="${escapeHtml(s.id)}">▶ 定位预览</button>
                <button type="button" class="fm-card-act-btn act-3d" data-slice-id="${escapeHtml(s.id)}">🦴 3D白模重演</button>
              </div>
            </div>
          </div>
        `;
      }
      html += `</div></div>`;
    }

    cardsScrollEl.innerHTML = html;

    cardsScrollEl.querySelectorAll('.fm-slice-card').forEach((cardEl) => {
      cardEl.addEventListener('click', (e) => {
        if (e.target.closest('.act-3d')) return;
        const sid = cardEl.dataset.sliceId;
        selectSliceById(sid);
      });
    });

    cardsScrollEl.querySelectorAll('.act-3d').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const sid = btn.dataset.sliceId;
        const s = match.slices.find((x) => x.id === sid);
        if (s && onInspectSliceIn3D) {
          activeSliceId = s.id;
          sliceVideoEl.pause();
          onInspectSliceIn3D(s, match);
        }
      });
    });
  }

  function selectSliceById(sliceId, scrollCardIntoView = false) {
    activeSliceId = sliceId;
    renderActiveInspector(false);
    drawTimelineCanvas();
    drawPitchCanvas();
    cardsScrollEl.querySelectorAll('.fm-slice-card').forEach((el) => {
      const act = el.dataset.sliceId === sliceId;
      el.classList.toggle('active', act);
      if (act && scrollCardIntoView) {
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    });
  }

  // ==========================================================================
  // Interactive 90/120-Minute Timeline Canvas
  // ==========================================================================
  let timelineHitPoints = []; // [{ x, y, id }]

  function drawTimelineCanvas() {
    const rect = timelineCanvas.parentElement.getBoundingClientRect();
    if (rect.width < 20 || rect.height < 20) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = Math.floor(rect.width);
    const H = Math.floor(rect.height);
    if (timelineCanvas.width !== W * dpr || timelineCanvas.height !== H * dpr) {
      timelineCanvas.width = W * dpr;
      timelineCanvas.height = H * dpr;
    }
    const ctx = timelineCanvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const match = getActiveMatch();
    const filtered = getFilteredSlices();
    const filteredSet = new Set(filtered.map((s) => s.id));
    const curActive = getActiveSlice();

    const maxSec = Math.max(
      match.totalMinutes * 60,
      ...match.slices.map((s) => sliceMatchSeconds(s) + 30),
      60
    );
    const useSecondsAxis = maxSec <= 180;

    const padL = 34;
    const padR = 18;
    const padT = 10;
    const padB = 18;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;

    // Background band & HT / FT dividers
    ctx.fillStyle = 'rgba(13, 21, 33, 0.85)';
    ctx.fillRect(padL, padT, plotW, plotH);

    const tickStep = useSecondsAxis ? 15 : maxSec > 6000 ? 15 * 60 : 15 * 60;
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
    ctx.fillStyle = 'rgba(148, 163, 184, 0.72)';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';

    for (let t = 0; t <= maxSec; t += tickStep) {
      const x = padL + (t / maxSec) * plotW;
      ctx.beginPath();
      ctx.moveTo(x, padT);
      ctx.lineTo(x, padT + plotH);
      ctx.stroke();

      let lbl = useSecondsAxis ? `${t}s` : `${Math.round(t / 60)}'`;
      if (!useSecondsAxis && Math.round(t / 60) === 45) lbl = "45' HT";
      if (!useSecondsAxis && Math.round(t / 60) === 90) lbl = "90' FT";
      ctx.fillText(lbl, x, H - 4);
    }

    // Minute-bucket intensity bars
    const bucketCount = 46;
    const buckets = new Float32Array(bucketCount);
    for (const s of filtered) {
      const u = clamp(sliceMatchSeconds(s) / maxSec, 0, 0.999);
      const bi = Math.floor(u * bucketCount);
      buckets[bi] = Math.max(buckets[bi], s.intensity || 70);
    }
    const barW = plotW / bucketCount;
    for (let i = 0; i < bucketCount; i++) {
      if (buckets[i] <= 0) continue;
      const bh = (buckets[i] / 105) * (plotH - 6);
      const bx = padL + i * barW + 1;
      const by = padT + plotH - bh;
      ctx.fillStyle = 'rgba(56, 189, 248, 0.16)';
      ctx.fillRect(bx, by, Math.max(2, barW - 2), bh);
    }

    // Plot all match slices (dimmed if filtered out, vivid if active)
    timelineHitPoints = [];
    for (const s of match.slices) {
      const isVis = filteredSet.has(s.id);
      const u = clamp(sliceMatchSeconds(s) / maxSec, 0.005, 0.995);
      const x = padL + u * plotW;
      const normI = clamp(((s.intensity || 75) - 45) / 58, 0.15, 0.94);
      const y = padT + plotH - normI * (plotH - 8);
      const col = PRESSING_TAXONOMY.escapeOutcome.items[s.escapeOutcome]?.color || '#38bdf8';

      if (!isVis) {
        ctx.fillStyle = 'rgba(148, 163, 184, 0.18)';
        ctx.beginPath();
        ctx.arc(x, y, 2.5, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }

      timelineHitPoints.push({ x, y, id: s.id });

      const isCur = curActive && curActive.id === s.id;
      if (isCur) {
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(x, padT);
        ctx.lineTo(x, padT + plotH);
        ctx.stroke();

        ctx.fillStyle = 'rgba(250, 204, 21, 0.25)';
        ctx.beginPath();
        ctx.arc(x, y, 9.5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(x, y, isCur ? 5.2 : 3.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = isCur ? '#ffffff' : 'rgba(10, 15, 25, 0.85)';
      ctx.lineWidth = isCur ? 1.6 : 1.0;
      ctx.stroke();
    }
  }

  timelineCanvas.addEventListener('click', (e) => {
    const rect = timelineCanvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    let best = null;
    let bestD = 999;
    for (const pt of timelineHitPoints) {
      const d = Math.hypot(pt.x - mx, pt.y - my);
      const dxOnly = Math.abs(pt.x - mx);
      const score = d < 18 ? d : dxOnly + 12;
      if (score < bestD && dxOnly < 28) {
        bestD = score;
        best = pt;
      }
    }
    if (best) {
      selectSliceById(best.id, true);
    }
  });

  // ==========================================================================
  // Interactive 105m × 68m Tactical Pitch Heatmap + 360° Freeze-Frame Canvas
  // ==========================================================================
  let pitchHitPoints = []; // [{ x, y, id }]

  function drawPitchCanvas() {
    const rect = pitchCanvas.parentElement.getBoundingClientRect();
    if (rect.width < 20 || rect.height < 20) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = Math.floor(rect.width);
    const H = Math.floor(rect.height);
    if (pitchCanvas.width !== W * dpr || pitchCanvas.height !== H * dpr) {
      pitchCanvas.width = W * dpr;
      pitchCanvas.height = H * dpr;
    }
    const ctx = pitchCanvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // Fit 105:68 aspect ratio inside W x H
    const pad = 12;
    const availW = W - pad * 2;
    const availH = H - pad * 2;
    const aspect = 105 / 68;
    let pw = availW;
    let ph = pw / aspect;
    if (ph > availH) {
      ph = availH;
      pw = ph * aspect;
    }
    const ox = (W - pw) * 0.5;
    const oy = (H - ph) * 0.5;

    const toPx = (xm, ym) => [ox + (xm / 105) * pw, oy + (ym / 68) * ph];

    // Emerald-slate pitch turf with mowing stripes
    ctx.fillStyle = '#0f241d';
    ctx.fillRect(ox, oy, pw, ph);
    const stripes = 10;
    for (let i = 0; i < stripes; i++) {
      if (i % 2 === 0) {
        ctx.fillStyle = 'rgba(22, 62, 44, 0.30)';
        ctx.fillRect(ox + (i / stripes) * pw, oy, pw / stripes, ph);
      }
    }

    // Subtle tactical zone overlays (Touchline Trap & Zone 14)
    const [z14x0, z14y0] = toPx(70, 20);
    const [z14x1, z14y1] = toPx(88.5, 48);
    ctx.fillStyle = 'rgba(251, 191, 36, 0.05)';
    ctx.fillRect(z14x0, z14y0, z14x1 - z14x0, z14y1 - z14y0);
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.22)';
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(z14x0, z14y0, z14x1 - z14x0, z14y1 - z14y0);
    ctx.setLineDash([]);

    // Standard FIFA pitch lines
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.42)';
    ctx.lineWidth = 1.25;
    ctx.strokeRect(ox, oy, pw, ph);

    // Halfway line & center circle
    const [midX, midY] = toPx(52.5, 34);
    ctx.beginPath();
    ctx.moveTo(midX, oy);
    ctx.lineTo(midX, oy + ph);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(midX, midY, (9.15 / 105) * pw, 0, Math.PI * 2);
    ctx.stroke();

    // Left & Right penalty areas (16.5m x 40.3m)
    const [lpX1, lpY0] = toPx(16.5, (68 - 40.3) / 2);
    const [, lpY1] = toPx(16.5, (68 + 40.3) / 2);
    ctx.strokeRect(ox, lpY0, lpX1 - ox, lpY1 - lpY0);

    const [rpX0] = toPx(105 - 16.5, 0);
    ctx.strokeRect(rpX0, lpY0, ox + pw - rpX0, lpY1 - lpY0);

    const filtered = getFilteredSlices();
    const curActive = getActiveSlice();
    pitchHitPoints = [];

    // Mode 1: Radial Heatmap + All Filtered Escape Vectors
    if (pitchViewMode === 'all_heat') {
      for (const s of filtered) {
        const [sx, sy] = toPx(s.pitchXY[0], s.pitchXY[1]);
        const rad = (7.5 / 105) * pw;
        const grad = ctx.createRadialGradient(sx, sy, 1, sx, sy, rad);
        const baseCol =
          s.escapeOutcome === 'turnover_loss' ? '239, 68, 68' : '56, 189, 248';
        grad.addColorStop(0, `rgba(${baseCol}, 0.24)`);
        grad.addColorStop(1, `rgba(${baseCol}, 0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(sx, sy, rad, 0, Math.PI * 2);
        ctx.fill();
      }

      for (const s of filtered) {
        const [sx, sy] = toPx(s.pitchXY[0], s.pitchXY[1]);
        const [ex, ey] = toPx(s.exitXY[0], s.exitXY[1]);
        const col = PRESSING_TAXONOMY.escapeOutcome.items[s.escapeOutcome]?.color || '#38bdf8';
        const isCur = curActive && curActive.id === s.id;

        pitchHitPoints.push({ x: sx, y: sy, id: s.id });

        if (!isCur) {
          ctx.strokeStyle = hexToRgba(col, 0.42);
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(ex, ey);
          ctx.stroke();

          ctx.fillStyle = hexToRgba(col, 0.82);
          ctx.beginPath();
          ctx.arc(sx, sy, 3.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Always overlay 360° Freeze-Frame & Bold Escape Vector for the Active Slice!
    if (curActive) {
      const [hx, hy] = toPx(curActive.pitchXY[0], curActive.pitchXY[1]);
      const [ex, ey] = toPx(curActive.exitXY[0], curActive.exitXY[1]);
      pitchHitPoints.push({ x: hx, y: hy, id: curActive.id });

      // 4.5m Pressing Danger Zone Ring
      const pressRad = (4.5 / 105) * pw;
      ctx.fillStyle = 'rgba(239, 68, 68, 0.14)';
      ctx.strokeStyle = 'rgba(248, 113, 113, 0.65)';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(hx, hy, pressRad, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);

      // Teammates (360° freeze-frame)
      const mates = (curActive.freezeMates || []).slice(0, pitchViewMode === 'focus_360' ? 9 : 4);
      for (const m of mates) {
        const [mx, my] = toPx(m.x, m.y);
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.28)';
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.moveTo(hx, hy);
        ctx.lineTo(mx, my);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(mx, my, 4.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Opponents (360° freeze-frame pressing defenders)
      const opps = (curActive.freezeOpps || []).slice(0, pitchViewMode === 'focus_360' ? 10 : 5);
      opps.forEach((op, idx) => {
        const [px, py] = toPx(op.x, op.y);
        if (idx < curActive.presserCount) {
          ctx.strokeStyle = 'rgba(248, 113, 113, 0.72)';
          ctx.lineWidth = 1.3;
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(hx, hy);
          ctx.stroke();
        }
        ctx.fillStyle = idx < curActive.presserCount ? '#ef4444' : '#94a3b8';
        ctx.beginPath();
        ctx.arc(px, py, idx < curActive.presserCount ? 4.8 : 3.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();
      });

      // Active Escape / Turnover Vector Arrow
      const vecCol = curActive.escapeOutcome === 'turnover_loss' ? '#ef4444' : '#facc15';
      ctx.strokeStyle = vecCol;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.lineTo(ex, ey);
      ctx.stroke();

      const ang = Math.atan2(ey - hy, ex - hx);
      ctx.fillStyle = vecCol;
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex - Math.cos(ang - 0.45) * 8, ey - Math.sin(ang - 0.45) * 8);
      ctx.lineTo(ex - Math.cos(ang + 0.45) * 8, ey - Math.sin(ang + 0.45) * 8);
      ctx.closePath();
      ctx.fill();

      // Active Ball Carrier Node
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(hx, hy, 6.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Callout Pill
      const tagText = `[${curActive.clock}] #${curActive.jerseyNumber || '8'} ${curActive.playerName.split(' ')[0]} (${curActive.minDefDistM}m)`;
      ctx.font = '600 11px "Inter", "Noto Sans SC", sans-serif';
      const tw = ctx.measureText(tagText).width + 12;
      const tx = clamp(hx - tw * 0.5, ox + 4, ox + pw - tw - 4);
      const ty = hy > oy + 28 ? hy - 24 : hy + 10;
      ctx.fillStyle = 'rgba(10, 16, 28, 0.88)';
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.75)';
      ctx.lineWidth = 1;
      ctx.fillRect(tx, ty, tw, 18);
      ctx.strokeRect(tx, ty, tw, 18);
      ctx.fillStyle = '#fef08a';
      ctx.textAlign = 'left';
      ctx.fillText(tagText, tx + 6, ty + 13);
    }
  }

  pitchCanvas.addEventListener('click', (e) => {
    const rect = pitchCanvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    let best = null;
    let bestD = 22;
    for (const pt of pitchHitPoints) {
      const d = Math.hypot(pt.x - mx, pt.y - my);
      if (d < bestD) {
        bestD = d;
        best = pt;
      }
    }
    if (best) {
      selectSliceById(best.id, true);
    }
  });

  // ==========================================================================
  // Local MP4 Browser Auto-Scanner + JSON Import/Export + CSV Export
  // ==========================================================================
  localMp4InputEl.addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;

    scanAbortController = new AbortController();
    scanModalEl.style.display = 'grid';
    scanTitleEl.textContent = `正在自动拆解本地视频：${file.name}`;
    progressFillEl.style.width = '2%';
    scanPctEl.textContent = '初始化视频解码器...';

    try {
      const scannedMatch = await scanLocalMatchVideoInBrowser(
        file,
        { signal: scanAbortController.signal },
        (pct, sampleCount) => {
          progressFillEl.style.width = `${pct}%`;
          scanPctEl.textContent = `${pct}% · 已采样分析 ${sampleCount} 帧`;
        }
      );
      matches.unshift(scannedMatch);
      activeMatchId = scannedMatch.id;
      resetFilters(false);
      activeSliceId = scannedMatch.slices[0]?.id || null;
      populateMatchSelector();
      renderAll();
    } catch (err) {
      if (err && err.message !== 'SCAN_ABORTED') {
        alert(`本地视频扫描失败: ${err.message}`);
      }
    } finally {
      scanModalEl.style.display = 'none';
      scanAbortController = null;
    }
  });

  btnCancelScanEl.addEventListener('click', () => {
    if (scanAbortController) scanAbortController.abort();
  });

  importJsonInputEl.addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed || !Array.isArray(parsed.slices)) {
        throw new Error('JSON 文件缺少 slices 数组');
      }
      const imported = {
        ...parsed,
        id: parsed.id || `imported_${Date.now()}`,
        title: parsed.title || `导入归类集 · ${file.name}`
      };
      matches.unshift(imported);
      activeMatchId = imported.id;
      resetFilters(false);
      activeSliceId = imported.slices[0]?.id || null;
      populateMatchSelector();
      renderAll();
    } catch (err) {
      alert(`JSON 导入失败: ${err.message}`);
    }
  });

  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  btnExportJsonEl.addEventListener('click', () => {
    const match = getActiveMatch();
    const payload = JSON.stringify(match, null, 2);
    triggerDownload(
      new Blob([payload], { type: 'application/json;charset=utf-8' }),
      `match_pressing_breakdown_${match.id}.json`
    );
  });

  btnExportCsvEl.addEventListener('click', () => {
    const match = getActiveMatch();
    const rows = getFilteredSlices();
    const header = [
      'index',
      'clock',
      'team',
      'oppTeam',
      'playerName',
      'playerRole',
      'pressType',
      'pitchZone',
      'escapeOutcome',
      'presserCount',
      'minDefDistM',
      'intensity',
      'pitchX',
      'pitchY',
      'summary'
    ];
    const csvLines = [
      header.join(','),
      ...rows.map((s) =>
        [
          s.index,
          s.clock,
          `"${(s.team || '').replace(/"/g, '""')}"`,
          `"${(s.oppTeam || '').replace(/"/g, '""')}"`,
          `"${(s.playerName || '').replace(/"/g, '""')}"`,
          s.playerRole,
          PRESSING_TAXONOMY.pressType.items[s.pressType]?.label || s.pressType,
          PRESSING_TAXONOMY.pitchZone.items[s.pitchZone]?.label || s.pitchZone,
          PRESSING_TAXONOMY.escapeOutcome.items[s.escapeOutcome]?.label || s.escapeOutcome,
          s.presserCount,
          s.minDefDistM,
          s.intensity,
          s.pitchXY?.[0] ?? 0,
          s.pitchXY?.[1] ?? 0,
          `"${(s.summary || '').replace(/"/g, '""')}"`
        ].join(',')
      )
    ];
    triggerDownload(
      new Blob(['\ufeff' + csvLines.join('\n')], { type: 'text/csv;charset=utf-8' }),
      `match_pressing_slices_${match.id}.csv`
    );
  });

  function renderAll(opts = {}) {
    renderFiltersAndKpis();
    renderActiveInspector(Boolean(opts.keepVideo));
    renderSliceCards();
    drawTimelineCanvas();
    drawPitchCanvas();
  }

  const resizeObs = new ResizeObserver(() => {
    if (containerEl.offsetParent !== null) {
      drawTimelineCanvas();
      drawPitchCanvas();
    }
  });
  resizeObs.observe(containerEl);

  populateMatchSelector();

  return {
    onShow() {
      renderAll();
    },
    onHide() {
      sliceVideoEl.pause();
    },
    selectMatch,
    setFilters(nextFilters = {}) {
      resetFilters(false);
      Object.assign(filters, nextFilters);
      renderAll();
      return this.getSummary();
    },
    setGroupBy(mode) {
      groupByMode = mode;
      containerEl.querySelectorAll('.fm-grp-btn').forEach((b) => {
        b.classList.toggle('active', b.dataset.grp === mode);
      });
      renderSliceCards();
    },
    selectSliceByIndex(idx) {
      const m = getActiveMatch();
      const s = m.slices[idx];
      if (!s) return null;
      selectSliceById(s.id, true);
      return s;
    },
    getMatchById(id) {
      return matches.find((m) => m.id === id) || null;
    },
    getSummary() {
      const m = getActiveMatch();
      const filtered = getFilteredSlices();
      const active = getActiveSlice();
      return {
        matchCount: matches.length,
        matchesMeta: matches.map((x) => ({ id: x.id, sliceCount: x.slices.length, totalMinutes: x.totalMinutes })),
        activeMatchId: m.id,
        activeMatchTitle: m.title,
        totalSlices: m.slices.length,
        filteredSlices: filtered.length,
        filters: { ...filters },
        groupByMode,
        activeSlice: active
          ? {
              id: active.id,
              index: active.index,
              clock: active.clock,
              playerName: active.playerName,
              pressType: active.pressType,
              pitchZone: active.pitchZone,
              escapeOutcome: active.escapeOutcome
            }
          : null
      };
    }
  };
}
