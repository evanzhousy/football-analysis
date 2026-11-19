/**
 * src/fullMatchWorkspace.js
 *
 * Greenfield v2 Full-Match Ball-Carrying & Pressing Breakdown Studio Controller:
 *   - Built-in 90/120-min real matches (StatsBomb 360° El Clásico, Euro 2024 ESP-GER, Zhibo8 Reel)
 *   - Pre-Scan Config + Two-Pass Chromatic-Contrast Local MP4 Auto-Scanner + Local Video Binding & Kickoff Calibration
 *   - Dual-Team Split 90/120-min Pressing Timeline Canvas + Team/Period/Keyword/4D Cross-Filtering
 *   - 3-Mode Tactical Analysis Stage:
 *       1) `pitch_heat`: 105m × 68m Heatmap + Clickable Tactical Zone Success Rate Overlay
 *       2) `pitch_360`:  360° Freeze-Frame + Defender Cover-Shadow Cones + Open/Blocked Passing Lanes
 *       3) `diagnosis`:  Team-vs-Team Duel + Interactive Press×Outcome Cross-Matrix + 15-Min Tempo Wave + Player Leaderboard + Auto-Insights
 *   - Video Cut-Up Playlist Auto-Advance (`连续播单`), Precision In/Out Trimming, Manual Slice Creation/Deletion,
 *     Inline Tactical Notes, Auto-Persistence (`localStorage`), JSON/CSV/Markdown Brief Export, and 1-Click 3D White-Model Bridge.
 */

import { PRESSING_TAXONOMY, BUILTIN_FULL_MATCHES } from './fullMatchSamples.js';
import {
  scanLocalMatchVideoInBrowser,
  computeFullMatchAnalytics,
  buildMatchScoutingReportMarkdown,
  sliceNetProgressionM,
  parseClockToSeconds
} from './fullMatchEngine.js';

const STORAGE_KEY = 'football_analysis_fullmatch_edits_v2';

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

function formatClockFromSec(sec) {
  const s = Math.max(0, Math.floor(Number(sec || 0)));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

function hexToRgba(hex, alpha) {
  const clean = (hex || '#38bdf8').replace('#', '');
  const num = parseInt(clean, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Checks whether a straight passing lane from (hx, hy) to (mx, my) passes inside
 * the cover-shadow cone of any pressing opponent (ox, oy).
 */
function isPassLaneBlockedByCoverShadow(hx, hy, mx, my, opps) {
  const dx = mx - hx;
  const dy = my - hy;
  const passLen = Math.hypot(dx, dy);
  if (passLen < 1.0) return false;
  const ux = dx / passLen;
  const uy = dy / passLen;

  for (const op of opps) {
    const odx = op.x - hx;
    const ody = op.y - hy;
    const proj = odx * ux + ody * uy;
    if (proj <= 0.4 || proj >= passLen - 0.5) continue;
    const perp = Math.abs(odx * uy - ody * ux);
    // Cover-shadow cone widens with distance behind the defender
    const oppDist = Math.hypot(odx, ody);
    const coneHalfWidth = 0.85 + Math.max(0, passLen - oppDist) * 0.14;
    if (perp <= Math.min(2.6, coneHalfWidth)) {
      return true;
    }
  }
  return false;
}

function loadStoredPatches() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveStoredPatches(patches) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(patches));
  } catch {
    // Ignore storage quota / private-mode restrictions
  }
}

export function initFullMatchWorkspace({
  containerEl,
  topActionsEl,
  onInspectSliceIn3D
}) {
  const storedPatches = loadStoredPatches();

  function cloneBuiltinMatchWithPatches(baseMatch) {
    const patch = storedPatches[baseMatch.id];
    const deletedSet = new Set(patch?.deletedIds || []);
    const modMap = patch?.modifiedSlices || {};
    const slices = baseMatch.slices
      .filter((s) => !deletedSet.has(s.id))
      .map((s) => ({
        ...s,
        ...(modMap[s.id] || {})
      }));
    if (Array.isArray(patch?.customSlices)) {
      for (const cs of patch.customSlices) {
        if (!deletedSet.has(cs.id)) {
          slices.push({ ...cs });
        }
      }
    }
    return {
      ...baseMatch,
      kickoffOffsetSec: Number(patch?.kickoffOffsetSec || baseMatch.kickoffOffsetSec || 0),
      slices
    };
  }

  const matches = BUILTIN_FULL_MATCHES.map(cloneBuiltinMatchWithPatches);

  let activeMatchId = matches[0].id;
  let activeSliceId = matches[0].slices[0]?.id || null;
  let groupByMode = 'pressType'; // 'timeline' | 'pressType' | 'pitchZone' | 'escapeOutcome'
  let sortByMode = 'clock'; // 'clock' | 'intensity' | 'dist' | 'prog'
  let stageMode = 'pitch_heat'; // 'pitch_heat' | 'pitch_360' | 'diagnosis'
  let showZoneHudOverlay = true;
  let videoPlaybackRate = 0.5;
  let playlistAutoAdvance = false;
  let scanAbortController = null;
  let pendingScanFile = null;
  let hoveredTimelineSliceId = null;

  const filters = {
    team: 'ALL',
    period: 'ALL',
    pressType: 'ALL',
    pitchZone: 'ALL',
    escapeOutcome: 'ALL',
    playerRole: 'ALL',
    playerName: 'ALL',
    searchQuery: ''
  };

  // Build Topbar Controls inside `topActionsEl` (engineered to fit cleanly <= 1600px)
  topActionsEl.innerHTML = `
    <select id="fm-match-select" class="fm-match-select" aria-label="选择整场比赛数据集"></select>
    <button id="btn-fm-open-scan" class="fm-top-btn primary-upload" type="button" title="打开本地比赛 MP4/WebM 两阶段自动切片配置">
      📂 扫描MP4
    </button>
    <label class="fm-top-btn" for="fm-bind-video-input" title="为当前比赛（含内置360°数据或Python导入JSON）挂载本地完整比赛录像MP4以同步播放原片切片">
      🔗 绑定录像
    </label>
    <input id="fm-bind-video-input" type="file" accept="video/*" style="display:none;" />
    <label class="fm-top-btn" for="fm-import-json-input" title="导入离线 Python 脚本生成的 match_pressing_breakdown.json">
      📥 导入
    </label>
    <input id="fm-import-json-input" type="file" accept=".json,application/json" style="display:none;" />
    <button id="btn-fm-export-json" class="fm-top-btn" type="button" title="导出当前整场逼抢切片归类 JSON">JSON</button>
    <button id="btn-fm-export-csv" class="fm-top-btn" type="button" title="导出当前筛选切片统计表 CSV">CSV</button>
    <button id="btn-fm-export-md" class="fm-top-btn accent-report" type="button" title="一键导出完整战术球探诊断报告 (.md)">📝 战术报告</button>
  `;

  // Build Workspace Layout inside `containerEl`
  containerEl.innerHTML = `
    <!-- Top 90/120-Minute Dual-Team Pressing Intensity Timeline -->
    <header class="fm-timeline-card">
      <div class="fm-timeline-head">
        <div class="fm-timeline-title-group">
          <span id="fm-comp-badge" class="fm-comp-badge">LA LIGA</span>
          <h2 id="fm-match-title" class="fm-match-title"></h2>
          <span id="fm-source-pill" class="fm-source-pill"></span>
        </div>
        <div class="fm-timeline-controls">
          <div id="fm-team-tabs" class="fm-seg-group" role="tablist" aria-label="持球球队视角切换"></div>
          <div id="fm-period-tabs" class="fm-seg-group" role="tablist" aria-label="比赛半场筛选"></div>
          <div class="fm-timeline-legend">
            <span class="fm-leg-item"><i style="background:#2dd4bf;"></i>半转身</span>
            <span class="fm-leg-item"><i style="background:#facc15;"></i>过人</span>
            <span class="fm-leg-item"><i style="background:#38bdf8;"></i>一脚</span>
            <span class="fm-leg-item"><i style="background:#94a3b8;"></i>护球</span>
            <span class="fm-leg-item"><i style="background:#ef4444;"></i>被断</span>
          </div>
        </div>
      </div>
      <div class="fm-timeline-canvas-wrap">
        <canvas id="fm-timeline-canvas"></canvas>
        <div id="fm-timeline-tooltip" class="fm-timeline-tooltip" style="display:none;"></div>
      </div>
    </header>

    <!-- Main 3-Column Tactical Breakdown Grid -->
    <div class="fm-body-grid">
      <!-- Left Column: KPIs + Search + 4D Taxonomy Filters -->
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
            <span class="fm-kpi-label">贴防距 · 净推进</span>
            <strong id="fm-kpi-dist" class="fm-kpi-val accent-cyan compact-metric">0.00m</strong>
          </div>
        </div>

        <div class="fm-search-row">
          <input id="fm-search-input" class="fm-search-input" type="search" placeholder="🔍 搜索球员、时刻或战术关键词..." aria-label="搜索切片" />
        </div>

        <div class="fm-filter-header">
          <span>四维战术切片归类筛选</span>
          <div class="fm-filter-header-btns">
            <button id="btn-fm-restore-edits" class="fm-reset-btn" type="button" style="display:none;" title="清除本地保存的人工标注与新增切片">恢复默认</button>
            <button id="btn-fm-reset-filters" class="fm-reset-btn" type="button">重置筛选</button>
          </div>
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
            <div class="fm-cli-title">⚡ 离线超清整场批处理 CLI (含缩略图/CSV/报告/FFmpeg切片)</div>
            <code>python scripts/analyze_full_match_pressing.py --video match.mp4 --export-clips</code>
          </div>
        </div>
      </aside>

      <!-- Center Column: 3-Mode Tactical Stage + Active Slice Video Studio & Live Editor -->
      <section class="fm-center-stage" aria-label="球场空间热力分布、战术诊断与当前切片检阅舱">
        <div class="fm-pitch-card">
          <div class="fm-card-bar">
            <div class="fm-card-bar-left">
              <span id="fm-stage-eyebrow" class="fm-eyebrow">105m × 68m 逼抢热区 & 分区破围</span>
              <span id="fm-stage-sub" class="fm-attack-dir">本方后场 ➔ 对方球门</span>
              <button id="btn-toggle-zone-hud" class="fm-mini-chip active" type="button" title="在球场上叠加四区破围率与点击筛选">分区破围层</button>
            </div>
            <div class="fm-pitch-mode-tabs" role="tablist">
              <button id="btn-stage-heat" class="fm-mini-tab active" data-stage="pitch_heat" type="button">🗺️ 热区&分区</button>
              <button id="btn-stage-360" class="fm-mini-tab" data-stage="pitch_360" type="button">🎯 360°压迫遮蔽</button>
              <button id="btn-stage-diag" class="fm-mini-tab" data-stage="diagnosis" type="button">📊 全场诊断&矩阵</button>
            </div>
          </div>
          <div id="fm-pitch-canvas-wrap" class="fm-pitch-canvas-wrap">
            <canvas id="fm-pitch-canvas"></canvas>
          </div>
          <div id="fm-diagnosis-view" class="fm-diagnosis-view" style="display:none;"></div>
        </div>

        <div class="fm-inspector-card">
          <div class="fm-slice-video-col">
            <div class="fm-video-box">
              <video id="fm-slice-video" muted playsinline controls preload="metadata"></video>
              <span id="fm-video-mode-badge" class="fm-video-badge">0.5x 循环慢镜</span>
              <span id="fm-playlist-badge" class="fm-playlist-badge" style="display:none;">▶ 连续播单中</span>
            </div>
            <div class="fm-video-controls-bar">
              <div class="fm-playlist-btns">
                <button id="btn-fm-prev-slice" class="fm-mini-tab" type="button" title="上一处切片 (快捷键 [ 或 ←)">◀</button>
                <button id="btn-fm-next-slice" class="fm-mini-tab" type="button" title="下一处切片 (快捷键 ] 或 →)">▶</button>
                <button id="btn-fm-playlist-toggle" class="fm-mini-tab" type="button" title="按当前筛选列表连续播放所有切片 (快捷键 P)">🔁 连播</button>
              </div>
              <div class="fm-rate-btns">
                <button id="btn-fm-rate-05" class="fm-mini-tab active" type="button">0.5x</button>
                <button id="btn-fm-rate-10" class="fm-mini-tab" type="button">1.0x</button>
              </div>
            </div>
            <div class="fm-trim-bar">
              <span id="fm-video-range-label" class="fm-video-range">00:00</span>
              <div class="fm-trim-btns">
                <button id="btn-fm-trim-in-minus" class="fm-trim-btn" type="button" title="起点提前 0.5s">起-</button>
                <button id="btn-fm-trim-in-plus" class="fm-trim-btn" type="button" title="起点延后 0.5s">起+</button>
                <button id="btn-fm-trim-out-minus" class="fm-trim-btn" type="button" title="终点提前 0.5s">终-</button>
                <button id="btn-fm-trim-out-plus" class="fm-trim-btn" type="button" title="终点延后 0.5s">终+</button>
                <button id="btn-fm-add-slice" class="fm-trim-btn accent-add" type="button" title="在当前视频时刻手动新增一处持球逼抢切片">✂️ 打点</button>
              </div>
            </div>
          </div>

          <div class="fm-slice-detail-col">
            <div class="fm-detail-top">
              <div>
                <div class="fm-detail-badges">
                  <span id="fm-det-clock" class="fm-clock-pill">00:31</span>
                  <span id="fm-det-team" class="fm-team-pill">巴塞罗那</span>
                  <span id="fm-det-prog" class="fm-prog-pill">+0.0m</span>
                  <span id="fm-det-metrics" class="fm-metrics-inline"></span>
                </div>
                <h3 id="fm-det-title" class="fm-det-title"></h3>
              </div>
              <button id="btn-fm-send-to-3d" class="fm-send-3d-btn" type="button">
                🦴 送入 3D 白模实验室重演 ➔
              </button>
            </div>

            <div class="fm-edit-note-row">
              <input id="fm-edit-summary" class="fm-edit-summary-input" type="text" aria-label="编辑战术切片摘要" placeholder="点击此处直接批注战术观察要点（自动保存）..." />
              <div id="fm-offset-ctrl" class="fm-offset-ctrl" style="display:none;" title="校准本地比赛录像开球偏移秒数">
                <span>偏移</span>
                <button id="btn-fm-offset-minus" class="fm-trim-btn" type="button">-5s</button>
                <span id="fm-offset-val">0s</span>
                <button id="btn-fm-offset-plus" class="fm-trim-btn" type="button">+5s</button>
              </div>
              <span id="fm-save-indicator" class="fm-save-indicator" style="display:none;">💾 已保存</span>
              <button id="btn-fm-delete-slice" class="fm-del-btn" type="button" title="删除此条误检切片">🗑️</button>
            </div>

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
            <div class="fm-cards-right-meta">
              <select id="fm-sort-select" class="fm-sort-select" aria-label="切片排序方式">
                <option value="clock">按时间序</option>
                <option value="intensity">按压迫强度</option>
                <option value="dist">按贴防最近</option>
                <option value="prog">按净推进 ΔX</option>
              </select>
              <span id="fm-grouped-count" class="fm-panel-count">0</span>
            </div>
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

    <!-- Pre-Scan Config & Live Progress Modal -->
    <div id="fm-scan-modal" class="fm-scan-modal" style="display:none;">
      <div class="fm-scan-dialog">
        <div id="fm-scan-config-pane">
          <h3>📂 本地整场比赛 MP4 两阶段自动切片配置</h3>
          <p class="fm-scan-desc">基于浏览器 WebCV 草皮掩膜 + 异色球衣对抗度 + 两阶段局部峰值精修，全过程本地运行无需上传服务器。</p>
          <div class="fm-scan-form-grid">
            <label class="fm-scan-field full">
              <span>选择本地比赛视频 (MP4 / WebM)</span>
              <input id="fm-local-mp4-input" type="file" accept="video/*" />
            </label>
            <label class="fm-scan-field">
              <span>持球主队名称</span>
              <input id="fm-cfg-home" type="text" value="巴塞罗那" />
            </label>
            <label class="fm-scan-field">
              <span>逼抢客队名称</span>
              <input id="fm-cfg-away" type="text" value="逼抢对手" />
            </label>
            <label class="fm-scan-field">
              <span>扫描采样精度</span>
              <select id="fm-cfg-precision">
                <option value="1.0" selected>标准实战 (1.0s 粗扫 + 0.45s 精修)</option>
                <option value="0.5">精细模式 (0.5s 高密扫描)</option>
                <option value="2.0">极速预览 (2.0s 粗扫 + 0.45s 精修)</option>
              </select>
            </label>
            <label class="fm-scan-field">
              <span>扫描起止时间 (分钟, 留空扫全场)</span>
              <div class="fm-scan-range-inputs">
                <input id="fm-cfg-start-min" type="number" min="0" step="1" placeholder="起始分" />
                <span>–</span>
                <input id="fm-cfg-end-min" type="number" min="1" step="1" placeholder="结束分" />
              </div>
            </label>
          </div>
          <div class="fm-scan-actions">
            <button id="btn-fm-close-config" class="fm-reset-btn" type="button">取消</button>
            <button id="btn-fm-start-scan" class="fm-send-3d-btn" type="button" disabled>🚀 开始两阶段自动扫描</button>
          </div>
        </div>

        <div id="fm-scan-progress-pane" style="display:none;">
          <h3 id="fm-scan-title">正在自动扫描整场比赛视频持球逼抢片段...</h3>
          <p id="fm-scan-sub">初始化浏览器视频解码器...</p>
          <div class="fm-progress-track">
            <div id="fm-progress-fill" class="fm-progress-fill" style="width:0%;"></div>
          </div>
          <div class="fm-scan-status-row">
            <span id="fm-scan-pct">0%</span>
            <button id="btn-fm-cancel-scan" class="fm-reset-btn" type="button">中止扫描</button>
          </div>
        </div>
      </div>
    </div>
  `;

  // Grab DOM references
  const matchSelectEl = document.getElementById('fm-match-select');
  const btnOpenScanEl = document.getElementById('btn-fm-open-scan');
  const bindVideoInputEl = document.getElementById('fm-bind-video-input');
  const importJsonInputEl = document.getElementById('fm-import-json-input');
  const btnExportJsonEl = document.getElementById('btn-fm-export-json');
  const btnExportCsvEl = document.getElementById('btn-fm-export-csv');
  const btnExportMdEl = document.getElementById('btn-fm-export-md');

  const compBadgeEl = document.getElementById('fm-comp-badge');
  const matchTitleEl = document.getElementById('fm-match-title');
  const sourcePillEl = document.getElementById('fm-source-pill');
  const teamTabsEl = document.getElementById('fm-team-tabs');
  const periodTabsEl = document.getElementById('fm-period-tabs');
  const timelineCanvas = document.getElementById('fm-timeline-canvas');
  const timelineTooltipEl = document.getElementById('fm-timeline-tooltip');

  const kpiCountEl = document.getElementById('fm-kpi-count');
  const kpiSuccessEl = document.getElementById('fm-kpi-success');
  const kpiHeavyEl = document.getElementById('fm-kpi-heavy');
  const kpiDistEl = document.getElementById('fm-kpi-dist');
  const searchInputEl = document.getElementById('fm-search-input');
  const btnResetFiltersEl = document.getElementById('btn-fm-reset-filters');
  const btnRestoreEditsEl = document.getElementById('btn-fm-restore-edits');

  const stageEyebrowEl = document.getElementById('fm-stage-eyebrow');
  const stageSubEl = document.getElementById('fm-stage-sub');
  const btnToggleZoneHudEl = document.getElementById('btn-toggle-zone-hud');
  const pitchCanvasWrapEl = document.getElementById('fm-pitch-canvas-wrap');
  const pitchCanvas = document.getElementById('fm-pitch-canvas');
  const diagnosisViewEl = document.getElementById('fm-diagnosis-view');

  const sliceVideoEl = document.getElementById('fm-slice-video');
  const videoBadgeEl = document.getElementById('fm-video-mode-badge');
  const playlistBadgeEl = document.getElementById('fm-playlist-badge');
  const videoRangeLabelEl = document.getElementById('fm-video-range-label');
  const btnPrevSliceEl = document.getElementById('btn-fm-prev-slice');
  const btnNextSliceEl = document.getElementById('btn-fm-next-slice');
  const btnPlaylistToggleEl = document.getElementById('btn-fm-playlist-toggle');
  const btnRate05El = document.getElementById('btn-fm-rate-05');
  const btnRate10El = document.getElementById('btn-fm-rate-10');
  const btnTrimInMinusEl = document.getElementById('btn-fm-trim-in-minus');
  const btnTrimInPlusEl = document.getElementById('btn-fm-trim-in-plus');
  const btnTrimOutMinusEl = document.getElementById('btn-fm-trim-out-minus');
  const btnTrimOutPlusEl = document.getElementById('btn-fm-trim-out-plus');
  const btnAddSliceEl = document.getElementById('btn-fm-add-slice');

  const detClockEl = document.getElementById('fm-det-clock');
  const detTeamEl = document.getElementById('fm-det-team');
  const detProgEl = document.getElementById('fm-det-prog');
  const detMetricsEl = document.getElementById('fm-det-metrics');
  const detTitleEl = document.getElementById('fm-det-title');
  const editSummaryEl = document.getElementById('fm-edit-summary');
  const offsetCtrlEl = document.getElementById('fm-offset-ctrl');
  const offsetValEl = document.getElementById('fm-offset-val');
  const btnOffsetMinusEl = document.getElementById('btn-fm-offset-minus');
  const btnOffsetPlusEl = document.getElementById('btn-fm-offset-plus');
  const saveIndicatorEl = document.getElementById('fm-save-indicator');
  const btnDeleteSliceEl = document.getElementById('btn-fm-delete-slice');
  const btnSendTo3DEl = document.getElementById('btn-fm-send-to-3d');

  const editSelects = {
    pressType: document.getElementById('fm-edit-pressType'),
    pitchZone: document.getElementById('fm-edit-pitchZone'),
    escapeOutcome: document.getElementById('fm-edit-escapeOutcome'),
    playerRole: document.getElementById('fm-edit-playerRole')
  };

  const sortSelectEl = document.getElementById('fm-sort-select');
  const groupedCountEl = document.getElementById('fm-grouped-count');
  const cardsScrollEl = document.getElementById('fm-cards-scroll');

  const scanModalEl = document.getElementById('fm-scan-modal');
  const scanConfigPaneEl = document.getElementById('fm-scan-config-pane');
  const scanProgressPaneEl = document.getElementById('fm-scan-progress-pane');
  const localMp4InputEl = document.getElementById('fm-local-mp4-input');
  const cfgHomeEl = document.getElementById('fm-cfg-home');
  const cfgAwayEl = document.getElementById('fm-cfg-away');
  const cfgPrecisionEl = document.getElementById('fm-cfg-precision');
  const cfgStartMinEl = document.getElementById('fm-cfg-start-min');
  const cfgEndMinEl = document.getElementById('fm-cfg-end-min');
  const btnCloseConfigEl = document.getElementById('btn-fm-close-config');
  const btnStartScanEl = document.getElementById('btn-fm-start-scan');
  const scanTitleEl = document.getElementById('fm-scan-title');
  const scanSubEl = document.getElementById('fm-scan-sub');
  const progressFillEl = document.getElementById('fm-progress-fill');
  const scanPctEl = document.getElementById('fm-scan-pct');
  const btnCancelScanEl = document.getElementById('btn-fm-cancel-scan');

  // Auto-save toast helper
  let saveFlashTimer = null;
  function flashSavedIndicator() {
    saveIndicatorEl.style.display = 'inline-flex';
    clearTimeout(saveFlashTimer);
    saveFlashTimer = setTimeout(() => {
      saveIndicatorEl.style.display = 'none';
    }, 1800);
  }

  function persistSlicePatch(match, slice, isCustom = false) {
    const isBuiltin = BUILTIN_FULL_MATCHES.some((b) => b.id === match.id);
    if (!isBuiltin) return;
    if (!storedPatches[match.id]) {
      storedPatches[match.id] = { modifiedSlices: {}, deletedIds: [], customSlices: [], kickoffOffsetSec: 0 };
    }
    const rec = storedPatches[match.id];
    if (isCustom || slice._isCustom) {
      const idx = rec.customSlices.findIndex((x) => x.id === slice.id);
      const copy = { ...slice };
      if (idx >= 0) rec.customSlices[idx] = copy;
      else rec.customSlices.push(copy);
    } else {
      rec.modifiedSlices[slice.id] = {
        pressType: slice.pressType,
        pitchZone: slice.pitchZone,
        escapeOutcome: slice.escapeOutcome,
        playerRole: slice.playerRole,
        summary: slice.summary,
        tStart: slice.tStart,
        tEnd: slice.tEnd,
        duration: slice.duration,
        clock: slice.clock
      };
    }
    rec.kickoffOffsetSec = Number(match.kickoffOffsetSec || 0);
    saveStoredPatches(storedPatches);
    flashSavedIndicator();
  }

  function persistSliceDelete(match, sliceId) {
    const isBuiltin = BUILTIN_FULL_MATCHES.some((b) => b.id === match.id);
    if (!isBuiltin) return;
    if (!storedPatches[match.id]) {
      storedPatches[match.id] = { modifiedSlices: {}, deletedIds: [], customSlices: [], kickoffOffsetSec: 0 };
    }
    const rec = storedPatches[match.id];
    if (!rec.deletedIds.includes(sliceId)) rec.deletedIds.push(sliceId);
    rec.customSlices = (rec.customSlices || []).filter((x) => x.id !== sliceId);
    delete rec.modifiedSlices[sliceId];
    saveStoredPatches(storedPatches);
    flashSavedIndicator();
  }

  function hasStoredEditsForMatch(matchId) {
    const p = storedPatches[matchId];
    if (!p) return false;
    return (
      Object.keys(p.modifiedSlices || {}).length > 0 ||
      (p.deletedIds || []).length > 0 ||
      (p.customSlices || []).length > 0 ||
      Boolean(p.kickoffOffsetSec)
    );
  }

  // Populate Re-Classification Dropdowns
  for (const [dim, selectEl] of Object.entries(editSelects)) {
    const items = PRESSING_TAXONOMY[dim].items;
    selectEl.innerHTML = Object.entries(items)
      .map(([k, v]) => `<option value="${k}">${escapeHtml(v.label)}</option>`)
      .join('');
    selectEl.addEventListener('change', () => {
      const match = getActiveMatch();
      const slice = getActiveSlice();
      if (!slice) return;
      slice[dim] = selectEl.value;
      persistSlicePatch(match, slice);
      renderAll({ keepVideo: true });
    });
  }

  editSummaryEl.addEventListener('change', () => {
    const match = getActiveMatch();
    const slice = getActiveSlice();
    if (!slice) return;
    const val = editSummaryEl.value.trim();
    if (val && val !== slice.summary) {
      slice.summary = val;
      persistSlicePatch(match, slice);
      renderSliceCards();
    }
  });

  function getActiveMatch() {
    return matches.find((m) => m.id === activeMatchId) || matches[0];
  }

  function matchesFilter(slice, omitDim = null) {
    if (omitDim !== 'team' && filters.team !== 'ALL' && slice.team !== filters.team) {
      return false;
    }
    if (omitDim !== 'period' && filters.period !== 'ALL') {
      const p = Number(slice.period || 1);
      if (filters.period === '1' && p !== 1) return false;
      if (filters.period === '2' && p !== 2) return false;
      if (filters.period === 'ET' && p <= 2) return false;
    }
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
    if (omitDim !== 'searchQuery' && filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase();
      const hay = `${slice.playerName} ${slice.team} ${slice.oppTeam} ${slice.clock} ${slice.summary} #${slice.jerseyNumber}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }

  function sortSlices(list) {
    const arr = [...list];
    if (sortByMode === 'intensity') {
      arr.sort((a, b) => (b.intensity || 0) - (a.intensity || 0));
    } else if (sortByMode === 'dist') {
      arr.sort((a, b) => (a.minDefDistM || 9) - (b.minDefDistM || 9));
    } else if (sortByMode === 'prog') {
      arr.sort((a, b) => sliceNetProgressionM(b) - sliceNetProgressionM(a));
    } else {
      arr.sort((a, b) => parseClockToSeconds(a.clock, a.tStart) - parseClockToSeconds(b.clock, b.tStart) || a.index - b.index);
    }
    return arr;
  }

  function getFilteredSlices() {
    const m = getActiveMatch();
    return sortSlices(m.slices.filter((s) => matchesFilter(s)));
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
    filters.team = 'ALL';
    filters.period = 'ALL';
    filters.pressType = 'ALL';
    filters.pitchZone = 'ALL';
    filters.escapeOutcome = 'ALL';
    filters.playerRole = 'ALL';
    filters.playerName = 'ALL';
    filters.searchQuery = '';
    if (searchInputEl) searchInputEl.value = '';
    if (shouldRender) renderAll();
  }

  btnResetFiltersEl.addEventListener('click', () => resetFilters(true));

  btnRestoreEditsEl.addEventListener('click', () => {
    const m = getActiveMatch();
    const base = BUILTIN_FULL_MATCHES.find((b) => b.id === m.id);
    if (!base) return;
    delete storedPatches[m.id];
    saveStoredPatches(storedPatches);
    const idx = matches.findIndex((x) => x.id === m.id);
    if (idx >= 0) {
      matches[idx] = cloneBuiltinMatchWithPatches(base);
      activeSliceId = matches[idx].slices[0]?.id || null;
    }
    populateMatchSelector();
    renderAll();
  });

  searchInputEl.addEventListener('input', () => {
    filters.searchQuery = searchInputEl.value.trim();
    renderAll({ keepVideo: true });
  });

  sortSelectEl.addEventListener('change', () => {
    sortByMode = sortSelectEl.value;
    renderSliceCards();
  });

  function selectMatch(matchId) {
    const found = matches.find((m) => m.id === matchId);
    if (!found) return false;
    activeMatchId = found.id;
    resetFilters(false);
    activeSliceId = found.slices[0]?.id || null;
    if (saveIndicatorEl) saveIndicatorEl.style.display = 'none';
    populateMatchSelector();
    renderAll();
    return true;
  }

  // ==========================================================================
  // Sub-clip Video Loop, Playlist Auto-Advance & Precision In/Out Trimming
  // ==========================================================================
  let activeLoopWindow = null; // { start, end } | null
  let lastAdvanceTs = 0;

  function stepSlice(delta) {
    const filtered = getFilteredSlices();
    if (filtered.length === 0) return null;
    const curIdx = filtered.findIndex((s) => s.id === activeSliceId);
    const nextIdx = curIdx < 0 ? 0 : (curIdx + delta + filtered.length) % filtered.length;
    selectSliceById(filtered[nextIdx].id, true);
    return filtered[nextIdx];
  }

  function togglePlaylistMode(forceVal = null) {
    playlistAutoAdvance = forceVal === null ? !playlistAutoAdvance : Boolean(forceVal);
    btnPlaylistToggleEl.classList.toggle('active', playlistAutoAdvance);
    playlistBadgeEl.style.display = playlistAutoAdvance ? 'inline-block' : 'none';
    if (playlistAutoAdvance) {
      sliceVideoEl.loop = false;
      sliceVideoEl.play().catch(() => {});
    } else {
      const match = getActiveMatch();
      sliceVideoEl.loop = !match.hasDirectFullVideo;
    }
    return playlistAutoAdvance;
  }

  btnPrevSliceEl.addEventListener('click', () => stepSlice(-1));
  btnNextSliceEl.addEventListener('click', () => stepSlice(1));
  btnPlaylistToggleEl.addEventListener('click', () => togglePlaylistMode());

  sliceVideoEl.addEventListener('timeupdate', () => {
    if (!activeLoopWindow) return;
    if (sliceVideoEl.currentTime >= activeLoopWindow.end) {
      if (playlistAutoAdvance && performance.now() - lastAdvanceTs > 500) {
        lastAdvanceTs = performance.now();
        stepSlice(1);
        return;
      }
      sliceVideoEl.currentTime = activeLoopWindow.start;
      if (!sliceVideoEl.paused) {
        sliceVideoEl.play().catch(() => {});
      }
    } else if (sliceVideoEl.currentTime < activeLoopWindow.start - 0.35) {
      sliceVideoEl.currentTime = activeLoopWindow.start;
    }
  });

  sliceVideoEl.addEventListener('ended', () => {
    if (playlistAutoAdvance && !activeLoopWindow) {
      stepSlice(1);
    }
  });

  function loadActiveSliceVideo(slice, match) {
    if (!slice) return;
    const hasFullVid = Boolean(match.hasDirectFullVideo && match.videoSrc);
    const src = hasFullVid ? match.videoSrc : slice.refVideoSrc;
    if (!src) {
      sliceVideoEl.removeAttribute('src');
      return;
    }

    const offset = hasFullVid ? Number(match.kickoffOffsetSec || 0) : 0;
    const rawStart = Math.max(0, Number(slice.tStart || 0) + offset);
    const rawEnd = Math.max(rawStart + 1.2, Number(slice.tEnd || rawStart + 4.5) + offset);

    activeLoopWindow = hasFullVid ? { start: rawStart, end: rawEnd } : null;
    sliceVideoEl.loop = !hasFullVid && !playlistAutoAdvance;

    const curSrc = sliceVideoEl.getAttribute('data-cur-src');
    const targetStart = hasFullVid ? activeLoopWindow.start : 0;

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

    videoBadgeEl.textContent = hasFullVid
      ? `🎯 原片精准切片 ${rawStart.toFixed(1)}s–${rawEnd.toFixed(1)}s`
      : `📺 同类技术参考实况 + 360°真实追踪`;
    videoRangeLabelEl.textContent = hasFullVid
      ? `${rawStart.toFixed(0)}–${rawEnd.toFixed(0)}s (${(rawEnd - rawStart).toFixed(1)}s)`
      : `${slice.clock} · ${slice.duration}s`;

    offsetCtrlEl.style.display = match._userBoundVideo ? 'inline-flex' : 'none';
    offsetValEl.textContent = `${offset >= 0 ? '+' : ''}${offset}s`;
  }

  function trimActiveSlice(startDelta, endDelta) {
    const match = getActiveMatch();
    const slice = getActiveSlice();
    if (!slice) return null;
    const nextStart = Math.max(0, Number((Number(slice.tStart || 0) + startDelta).toFixed(2)));
    const nextEnd = Math.max(nextStart + 1.2, Number((Number(slice.tEnd || nextStart + 4) + endDelta).toFixed(2)));
    slice.tStart = nextStart;
    slice.tEnd = nextEnd;
    slice.duration = Number((nextEnd - nextStart).toFixed(2));
    if (match.hasDirectFullVideo && !match._preserveStatsClock) {
      slice.clock = formatClockFromSec(nextStart);
    }
    persistSlicePatch(match, slice);
    renderActiveInspector(false);
    drawTimelineCanvas();
    return slice;
  }

  btnTrimInMinusEl.addEventListener('click', () => trimActiveSlice(-0.5, 0));
  btnTrimInPlusEl.addEventListener('click', () => trimActiveSlice(0.5, 0));
  btnTrimOutMinusEl.addEventListener('click', () => trimActiveSlice(0, -0.5));
  btnTrimOutPlusEl.addEventListener('click', () => trimActiveSlice(0, 0.5));

  function adjustKickoffOffset(deltaSec) {
    const match = getActiveMatch();
    match.kickoffOffsetSec = Number(match.kickoffOffsetSec || 0) + deltaSec;
    const slice = getActiveSlice();
    if (slice) {
      persistSlicePatch(match, slice);
      loadActiveSliceVideo(slice, match);
    }
  }
  btnOffsetMinusEl.addEventListener('click', () => adjustKickoffOffset(-5));
  btnOffsetPlusEl.addEventListener('click', () => adjustKickoffOffset(5));

  function createManualSliceAtCurrentTime() {
    const match = getActiveMatch();
    const curSlice = getActiveSlice();
    const nowVideoSec = sliceVideoEl.readyState >= 1 ? sliceVideoEl.currentTime : (curSlice?.tStart || 30) + 12;
    const offset = Number(match.kickoffOffsetSec || 0);
    const tCenter = match.hasDirectFullVideo ? Math.max(2.0, nowVideoSec - offset) : parseClockToSeconds(curSlice?.clock, 60) + 15;
    const t0 = Number(Math.max(0, tCenter - 2.2).toFixed(2));
    const t1 = Number((t0 + 5.2).toFixed(2));

    // Try capturing live video thumbnail frame
    let thumbUrl = null;
    try {
      if (sliceVideoEl.readyState >= 2 && sliceVideoEl.videoWidth > 0) {
        const c = document.createElement('canvas');
        c.width = 240;
        c.height = 135;
        c.getContext('2d').drawImage(sliceVideoEl, 0, 0, 240, 135);
        thumbUrl = c.toDataURL('image/jpeg', 0.72);
      }
    } catch {
      thumbUrl = null;
    }

    const nextIdx = Math.max(0, ...match.slices.map((s) => Number(s.index || 0))) + 1;
    const mm = Math.floor(t0 / 60);
    const newSlice = {
      id: `manual_${match.id}_${Date.now()}`,
      index: nextIdx,
      clock: formatClockFromSec(t0),
      minute: mm,
      period: mm < 45 ? 1 : mm < 90 ? 2 : 3,
      tStart: t0,
      tEnd: t1,
      duration: Number((t1 - t0).toFixed(2)),
      team: filters.team !== 'ALL' ? filters.team : curSlice?.team || match.homeTeamZh || '主队',
      teamKit: curSlice?.teamKit || 'barca-home',
      oppTeam: curSlice?.oppTeam || match.awayTeamZh || '客队',
      oppKit: curSlice?.oppKit || 'madrid-white',
      playerName: curSlice?.playerName || '手动标注持球人',
      jerseyNumber: curSlice?.jerseyNumber || '8',
      playerRole: filters.playerRole !== 'ALL' ? filters.playerRole : curSlice?.playerRole || 'MF',
      positionLabel: curSlice?.positionLabel || '中场 MF',
      pressType: filters.pressType !== 'ALL' ? filters.pressType : 'double_trap',
      pitchZone: filters.pitchZone !== 'ALL' ? filters.pitchZone : 'midfield_hub',
      escapeOutcome: filters.escapeOutcome !== 'ALL' ? filters.escapeOutcome : 'half_turn',
      presserCount: 2,
      minDefDistM: 1.35,
      intensity: 86,
      pitchXY: [52.5, 34.0],
      exitXY: [61.5, 30.0],
      freezeOpps: [
        { x: 54.0, y: 35.1, distM: 1.35, gk: false },
        { x: 55.2, y: 31.8, distM: 3.1, gk: false }
      ],
      freezeMates: [{ x: 64.0, y: 24.5 }, { x: 46.0, y: 41.0 }],
      refScenarioIdx: curSlice?.refScenarioIdx || 0,
      refVideoSrc: curSlice?.refVideoSrc || './assets/videos/s1_zhibo8_mallorca_turn.mp4',
      thumbnail: thumbUrl,
      summary: `人工标记新切片 #${nextIdx}（${formatClockFromSec(t0)}）：点击下方下拉框即可即时完成四维战术归类`,
      _isCustom: true
    };

    match.slices.push(newSlice);
    match.sliceCount = match.slices.length;
    activeSliceId = newSlice.id;
    persistSlicePatch(match, newSlice, true);
    populateMatchSelector();
    renderAll();
    return newSlice;
  }

  btnAddSliceEl.addEventListener('click', () => createManualSliceAtCurrentTime());

  function deleteActiveSlice() {
    const match = getActiveMatch();
    const slice = getActiveSlice();
    if (!slice || match.slices.length <= 1) return false;
    const idx = match.slices.findIndex((s) => s.id === slice.id);
    if (idx < 0) return false;
    match.slices.splice(idx, 1);
    match.sliceCount = match.slices.length;
    persistSliceDelete(match, slice.id);
    activeSliceId = match.slices[Math.min(idx, match.slices.length - 1)]?.id || null;
    populateMatchSelector();
    renderAll();
    return true;
  }

  btnDeleteSliceEl.addEventListener('click', () => deleteActiveSlice());

  function setVideoRate(rate) {
    videoPlaybackRate = rate;
    btnRate05El.classList.toggle('active', rate === 0.5);
    btnRate10El.classList.toggle('active', rate === 1.0);
    sliceVideoEl.playbackRate = rate;
  }
  btnRate05El.addEventListener('click', () => setVideoRate(0.5));
  btnRate10El.addEventListener('click', () => setVideoRate(1.0));

  // ==========================================================================
  // 3-Mode Center Stage Controller (`pitch_heat` | `pitch_360` | `diagnosis`)
  // ==========================================================================
  function setStageMode(nextMode) {
    if (!['pitch_heat', 'pitch_360', 'diagnosis'].includes(nextMode)) return;
    stageMode = nextMode;
    containerEl.querySelectorAll('.fm-pitch-mode-tabs .fm-mini-tab').forEach((b) => {
      b.classList.toggle('active', b.dataset.stage === stageMode);
    });

    if (stageMode === 'diagnosis') {
      stageEyebrowEl.textContent = '整场持球逼抢诊断报告 · 双边对决 × 交叉矩阵 × 抗压榜';
      stageSubEl.textContent = '点击任意矩阵格子或球员行可直接联动筛选切片';
      btnToggleZoneHudEl.style.display = 'none';
      pitchCanvasWrapEl.style.display = 'none';
      diagnosisViewEl.style.display = 'flex';
      renderDiagnosisView();
    } else if (stageMode === 'pitch_360') {
      stageEyebrowEl.textContent = '360° 单帧压迫遮蔽站位 & 传球通道诊断';
      stageSubEl.textContent = '红扇区=防守遮蔽阴影 · 绿虚线=开放接应 · 红叉=路线封堵';
      btnToggleZoneHudEl.style.display = 'none';
      diagnosisViewEl.style.display = 'none';
      pitchCanvasWrapEl.style.display = 'block';
      drawPitchCanvas();
    } else {
      stageEyebrowEl.textContent = '105m × 68m 逼抢热区 & 分区破围率';
      stageSubEl.textContent = '本方后场 ➔ 对方球门 · 点击球场分区徽章可直接筛选';
      btnToggleZoneHudEl.style.display = 'inline-flex';
      diagnosisViewEl.style.display = 'none';
      pitchCanvasWrapEl.style.display = 'block';
      drawPitchCanvas();
    }
    return stageMode;
  }

  containerEl.querySelectorAll('.fm-pitch-mode-tabs .fm-mini-tab').forEach((btn) => {
    btn.addEventListener('click', () => setStageMode(btn.dataset.stage));
  });

  btnToggleZoneHudEl.addEventListener('click', () => {
    showZoneHudOverlay = !showZoneHudOverlay;
    btnToggleZoneHudEl.classList.toggle('active', showZoneHudOverlay);
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

  // ==========================================================================
  // Render Top Team/Period Switchers, Left KPIs & 4D Filter Chips
  // ==========================================================================
  function renderFiltersAndKpis() {
    const match = getActiveMatch();
    const all = match.slices;
    const filtered = getFilteredSlices();
    const analytics = computeFullMatchAnalytics(match, filtered, PRESSING_TAXONOMY);

    compBadgeEl.textContent = match.competition || 'FULL MATCH';
    matchTitleEl.textContent = match.title;
    sourcePillEl.textContent = match._userBoundVideo
      ? `🔗 已绑定本地录像 (${match._userBoundVideoName})`
      : match.sourceLabel || '';

    // Team Perspective Segmented Control
    const distinctTeams = Array.from(new Set(all.map((s) => s.team).filter(Boolean)));
    if (distinctTeams.length >= 2) {
      teamTabsEl.style.display = 'inline-flex';
      teamTabsEl.innerHTML =
        `<button type="button" class="fm-seg-btn${filters.team === 'ALL' ? ' active' : ''}" data-team="ALL">双方</button>` +
        distinctTeams
          .slice(0, 2)
          .map((t, i) => {
            const cnt = all.filter((s) => matchesFilter(s, 'team') && s.team === t).length;
            const dotCol = i === 0 ? '#facc15' : '#38bdf8';
            return `<button type="button" class="fm-seg-btn${filters.team === t ? ' active' : ''}" data-team="${escapeHtml(t)}"><i style="background:${dotCol};"></i>${escapeHtml(t)}<em>${cnt}</em></button>`;
          })
          .join('');
      teamTabsEl.querySelectorAll('.fm-seg-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const val = btn.dataset.team;
          filters.team = filters.team === val && val !== 'ALL' ? 'ALL' : val;
          renderAll();
        });
      });
    } else {
      teamTabsEl.style.display = 'none';
    }

    // Period Segmented Control
    const hasET = all.some((s) => Number(s.period || 1) > 2);
    const periods = [
      { id: 'ALL', label: '全场' },
      { id: '1', label: '上半场' },
      { id: '2', label: '下半场' },
      ...(hasET ? [{ id: 'ET', label: '加时' }] : [])
    ];
    periodTabsEl.innerHTML = periods
      .map(
        (p) =>
          `<button type="button" class="fm-seg-btn${filters.period === p.id ? ' active' : ''}" data-period="${p.id}">${p.label}</button>`
      )
      .join('');
    periodTabsEl.querySelectorAll('.fm-seg-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const val = btn.dataset.period;
        filters.period = filters.period === val && val !== 'ALL' ? 'ALL' : val;
        renderAll();
      });
    });

    // KPIs
    const ov = analytics.teamDuel.overall;
    kpiCountEl.textContent = `${filtered.length} / ${all.length}`;
    kpiSuccessEl.textContent = `${ov.escapeRate}%`;
    kpiHeavyEl.textContent = `${ov.multiPressRate}%`;
    kpiDistEl.textContent = `${ov.avgMinDistM.toFixed(2)}m · ${ov.avgNetProgM >= 0 ? '+' : ''}${ov.avgNetProgM}m`;

    const hasAnyFilter =
      filters.team !== 'ALL' ||
      filters.period !== 'ALL' ||
      filters.pressType !== 'ALL' ||
      filters.pitchZone !== 'ALL' ||
      filters.escapeOutcome !== 'ALL' ||
      filters.playerRole !== 'ALL' ||
      filters.playerName !== 'ALL' ||
      Boolean(filters.searchQuery);
    btnResetFiltersEl.classList.toggle('has-active', hasAnyFilter);
    btnRestoreEditsEl.style.display = hasStoredEditsForMatch(match.id) ? 'inline-flex' : 'none';

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

    // Top 8 Players in current match (respecting team/other filters)
    const playerWrap = document.getElementById('fm-chips-playerName');
    const playerPool = all.filter((s) => matchesFilter(s, 'playerName'));
    const countsByPlayer = new Map();
    for (const s of playerPool.length > 0 ? playerPool : all) {
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

  // ==========================================================================
  // Render Stage Mode 3: Full-Match Diagnosis & Interactive Cross-Matrix
  // ==========================================================================
  function renderDiagnosisView() {
    if (stageMode !== 'diagnosis') return;
    const match = getActiveMatch();
    const filtered = getFilteredSlices();
    const analytics = computeFullMatchAnalytics(match, filtered, PRESSING_TAXONOMY);
    const { teamDuel, crossMatrix, tempo, leaderboard, insights } = analytics;

    if (filtered.length === 0) {
      diagnosisViewEl.innerHTML = `<div class="fm-empty-cards">当前筛选条件下暂无命中切片，请重置左侧筛选查看全场诊断报告。</div>`;
      return;
    }

    const duelMetrics = [
      { label: '受迫持球次数', hv: teamDuel.home.count, av: teamDuel.away.count, unit: '次', max: Math.max(1, teamDuel.home.count, teamDuel.away.count) },
      { label: '抗逼抢破围率', hv: teamDuel.home.escapeRate, av: teamDuel.away.escapeRate, unit: '%', max: 100 },
      { label: '多人夹击占比', hv: teamDuel.home.multiPressRate, av: teamDuel.away.multiPressRate, unit: '%', max: 100 },
      { label: '平均贴防距离', hv: teamDuel.home.avgMinDistM, av: teamDuel.away.avgMinDistM, unit: 'm', max: 3.5 },
      { label: '平均净推进 ΔX', hv: teamDuel.home.avgNetProgM, av: teamDuel.away.avgNetProgM, unit: 'm', max: 18 }
    ];

    const insightsHtml = insights
      .map((txt) => `<div class="fm-diag-insight">${escapeHtml(txt)}</div>`)
      .join('');

    const duelHtml = teamDuel.hasTwoTeams
      ? `
        <div class="fm-diag-card">
          <div class="fm-diag-card-head">
            <span>⚔️ 球队双边持球抗压对决</span>
            <span class="fm-diag-sub-legend">
              <i style="background:#facc15;"></i>${escapeHtml(teamDuel.home.name)} (${teamDuel.home.count})
              <i style="background:#38bdf8;margin-left:8px;"></i>${escapeHtml(teamDuel.away.name)} (${teamDuel.away.count})
            </span>
          </div>
          <div class="fm-duel-rows">
            ${duelMetrics
              .map((m) => {
                const hw = clamp((Math.max(0, m.hv) / m.max) * 100, 6, 100);
                const aw = clamp((Math.max(0, m.av) / m.max) * 100, 6, 100);
                return `
                  <div class="fm-duel-row">
                    <span class="fm-duel-num home">${m.hv}${m.unit}</span>
                    <div class="fm-duel-bars">
                      <div class="fm-duel-bar-half left"><span style="width:${hw}%;"></span></div>
                      <span class="fm-duel-lbl">${m.label}</span>
                      <div class="fm-duel-bar-half right"><span style="width:${aw}%;"></span></div>
                    </div>
                    <span class="fm-duel-num away">${m.av}${m.unit}</span>
                  </div>
                `;
              })
              .join('')}
          </div>
        </div>
      `
      : `
        <div class="fm-diag-card">
          <div class="fm-diag-card-head">
            <span>⚔️ 单方持球抗压核心指标 (${escapeHtml(teamDuel.overall.name)})</span>
            <span class="fm-diag-sub-legend">${teamDuel.overall.count} 切片 · 丢球 ${teamDuel.overall.turnovers} 次</span>
          </div>
          <div class="fm-single-duel-grid">
            <div><span>破围成功率</span><strong>${teamDuel.overall.escapeRate}%</strong></div>
            <div><span>多人夹击比</span><strong>${teamDuel.overall.multiPressRate}%</strong></div>
            <div><span>平均贴防距</span><strong>${teamDuel.overall.avgMinDistM}m</strong></div>
            <div><span>平均净推进</span><strong>${teamDuel.overall.avgNetProgM >= 0 ? '+' : ''}${teamDuel.overall.avgNetProgM}m</strong></div>
          </div>
        </div>
      `;

    const tempoHtml = `
      <div class="fm-diag-card">
        <div class="fm-diag-card-head">
          <span>📈 15分钟分段逼抢波峰</span>
          <span class="fm-diag-sub-legend">柱高=受迫次数 · 红点=被断失误</span>
        </div>
        <div class="fm-tempo-bars">
          ${tempo.buckets
            .map((b) => {
              const hPct = Math.round((b.homeCount / Math.max(1, tempo.maxCount)) * 100);
              const aPct = Math.round((b.awayCount / Math.max(1, tempo.maxCount)) * 100);
              return `
                <div class="fm-tempo-col" title="${b.label}: 共 ${b.total} 次 (${teamDuel.home.name} ${b.homeCount} / ${teamDuel.away.name} ${b.awayCount}, 丢球 ${b.turnovers})">
                  <span class="fm-tempo-val">${b.total > 0 ? b.total : ''}${b.turnovers > 0 ? '<i class="fm-tempo-loss-dot"></i>' : ''}</span>
                  <div class="fm-tempo-stack">
                    ${b.awayCount > 0 ? `<div class="fm-tempo-seg away" style="height:${Math.max(8, aPct)}%;"></div>` : ''}
                    ${b.homeCount > 0 ? `<div class="fm-tempo-seg home" style="height:${Math.max(8, hPct)}%;"></div>` : ''}
                  </div>
                  <span class="fm-tempo-lbl">${b.label}</span>
                </div>
              `;
            })
            .join('')}
        </div>
      </div>
    `;

    const shortOutLabels = {
      half_turn: '半转身',
      skill_dribble: '过人',
      one_touch_wall: '一脚',
      recycle_shield: '护球',
      turnover_loss: '被断'
    };

    const matrixHtml = `
      <div class="fm-diag-card">
        <div class="fm-diag-card-head">
          <span>🧩 逼抢形态 × 摆脱结果 交叉矩阵</span>
          <span class="fm-diag-sub-legend">点击单元格交叉筛选</span>
        </div>
        <table class="fm-matrix-table">
          <thead>
            <tr>
              <th>逼抢形态</th>
              ${crossMatrix.cols
                .map((c) => `<th style="color:${c.color};">${shortOutLabels[c.key] || escapeHtml(c.label.slice(0, 3))}</th>`)
                .join('')}
              <th>计</th>
              <th>破围</th>
            </tr>
          </thead>
          <tbody>
            ${crossMatrix.rows
              .map((r) => {
                const cellsHtml = r.cells
                  .map((c) => {
                    const alpha = c.count > 0 ? 0.14 + (c.count / Math.max(1, crossMatrix.maxCell)) * 0.52 : 0.03;
                    const isLoss = c.escapeOutcome === 'turnover_loss';
                    const bg = isLoss
                      ? `rgba(239, 68, 68, ${c.count > 0 ? alpha + 0.08 : 0.03})`
                      : `rgba(56, 189, 248, ${alpha})`;
                    const isSelected =
                      filters.pressType === c.pressType && filters.escapeOutcome === c.escapeOutcome;
                    return `
                      <td>
                        <button type="button" class="fm-matrix-cell${c.count === 0 ? ' zero' : ''}${isSelected ? ' selected' : ''}"
                          data-press="${c.pressType}" data-out="${c.escapeOutcome}"
                          style="background:${bg};">
                          ${c.count}
                        </button>
                      </td>
                    `;
                  })
                  .join('');
                return `
                  <tr>
                    <td class="fm-matrix-row-lbl" style="border-left-color:${r.color};">${escapeHtml(r.label)}</td>
                    ${cellsHtml}
                    <td class="fm-matrix-total">${r.total}</td>
                    <td class="fm-matrix-rate${r.escapeRate < 85 && r.total > 0 ? ' warn' : ''}">${r.total > 0 ? r.escapeRate + '%' : '—'}</td>
                  </tr>
                `;
              })
              .join('')}
          </tbody>
        </table>
      </div>
    `;

    const leaderHtml = `
      <div class="fm-diag-card">
        <div class="fm-diag-card-head">
          <span>🏆 球员抗压榜 (Top 6)</span>
          <span class="fm-diag-sub-legend">点击行筛选个人集锦</span>
        </div>
        <table class="fm-leader-table">
          <thead>
            <tr>
              <th>#</th>
              <th>球员</th>
              <th>次</th>
              <th>破围</th>
              <th>ΔX</th>
              <th>指数</th>
            </tr>
          </thead>
          <tbody>
            ${leaderboard
              .slice(0, 6)
              .map((p, i) => {
                const dotCol = p.team === teamDuel.home.name ? '#facc15' : '#38bdf8';
                return `
                  <tr class="fm-leader-row${filters.playerName === p.playerName ? ' selected' : ''}" data-player="${escapeHtml(p.playerName)}" title="${escapeHtml(p.team)} · 多人夹击 ${p.multiPressRate}% · 贴防 ${p.avgMinDistM}m">
                    <td>${i + 1}</td>
                    <td class="fm-leader-name"><i class="fm-leader-team-dot" style="background:${dotCol};"></i>#${escapeHtml(p.jerseyNumber)} ${escapeHtml(p.playerName.split(' ')[0])}</td>
                    <td>${p.count}</td>
                    <td class="${p.escapeRate === 100 ? 'good' : p.escapeRate < 80 ? 'warn' : ''}">${p.escapeRate}%</td>
                    <td>${p.avgNetProgM >= 0 ? '+' : ''}${p.avgNetProgM}m</td>
                    <td><span class="fm-score-badge">${p.pressIndex}</span></td>
                  </tr>
                `;
              })
              .join('')}
          </tbody>
        </table>
      </div>
    `;

    diagnosisViewEl.innerHTML = `
      <div class="fm-diag-insights-grid">${insightsHtml}</div>
      <div class="fm-diag-split-row">${duelHtml}${tempoHtml}</div>
      <div class="fm-diag-bottom-split">${matrixHtml}${leaderHtml}</div>
    `;

    // Bind Cross-Matrix Cell Clicks -> Instant Cross-Filter!
    diagnosisViewEl.querySelectorAll('.fm-matrix-cell').forEach((btn) => {
      btn.addEventListener('click', () => {
        const p = btn.dataset.press;
        const o = btn.dataset.out;
        if (filters.pressType === p && filters.escapeOutcome === o) {
          filters.pressType = 'ALL';
          filters.escapeOutcome = 'ALL';
        } else {
          filters.pressType = p;
          filters.escapeOutcome = o;
        }
        renderAll();
      });
    });

    // Bind Leaderboard Player Row Clicks -> Instant Player Filter!
    diagnosisViewEl.querySelectorAll('.fm-leader-row').forEach((tr) => {
      tr.addEventListener('click', () => {
        const pName = tr.dataset.player;
        filters.playerName = filters.playerName === pName ? 'ALL' : pName;
        renderAll();
      });
    });
  }

  // ==========================================================================
  // Render Active Slice Inspector Panel
  // ==========================================================================
  function renderActiveInspector(keepVideo = false) {
    const match = getActiveMatch();
    const slice = getActiveSlice();
    if (!slice) {
      detTitleEl.textContent = '当前筛选条件下暂无命中切片，请放宽或重置左侧四维筛选器';
      detMetricsEl.textContent = '';
      detProgEl.textContent = '—';
      editSummaryEl.value = '';
      btnSendTo3DEl.disabled = true;
      btnDeleteSliceEl.disabled = true;
      return;
    }
    btnSendTo3DEl.disabled = false;
    btnDeleteSliceEl.disabled = match.slices.length <= 1;

    const pMeta = PRESSING_TAXONOMY.pressType.items[slice.pressType];
    const zMeta = PRESSING_TAXONOMY.pitchZone.items[slice.pitchZone];
    const oMeta = PRESSING_TAXONOMY.escapeOutcome.items[slice.escapeOutcome];
    const prog = sliceNetProgressionM(slice);

    detClockEl.textContent = `#${String(slice.index).padStart(2, '0')} · ${slice.clock}`;
    detTeamEl.textContent = `${slice.team} vs ${slice.oppTeam}`;
    detProgEl.textContent = `净推进 ${prog >= 0 ? '+' : ''}${prog}m`;
    detProgEl.classList.toggle('neg', prog < 0 || slice.escapeOutcome === 'turnover_loss');
    detMetricsEl.textContent = `${slice.presserCount}人压迫 · 贴防 ${slice.minDefDistM}m · 强度 ${slice.intensity}% · [${slice.pitchXY[0]}, ${slice.pitchXY[1]}]`;
    detTitleEl.textContent = `#${slice.jerseyNumber || '8'} ${slice.playerName} (${slice.positionLabel}) — ${pMeta?.label || ''} × ${oMeta?.label || ''}`;
    editSummaryEl.value = slice.summary || `${zMeta?.label || ''}`;

    editSelects.pressType.value = slice.pressType;
    editSelects.pitchZone.value = slice.pitchZone;
    editSelects.escapeOutcome.value = slice.escapeOutcome;
    editSelects.playerRole.value = slice.playerRole;

    if (!keepVideo) {
      loadActiveSliceVideo(slice, match);
    }
  }

  // ==========================================================================
  // Render Right Grouped Slice Cards Wall
  // ==========================================================================
  function renderSliceCards() {
    const match = getActiveMatch();
    const filtered = getFilteredSlices();
    const curActive = getActiveSlice();
    groupedCountEl.textContent = `${filtered.length} SLICES`;

    if (filtered.length === 0) {
      cardsScrollEl.innerHTML = `<div class="fm-empty-cards">暂无符合筛选组合的持球逼抢切片。<br/>点击左侧「重置筛选」查看全场完整切片。</div>`;
      return;
    }

    const groups = [];
    if (groupByMode === 'timeline') {
      const p1 = filtered.filter((s) => Number(s.period || 1) === 1);
      const p2 = filtered.filter((s) => Number(s.period || 1) === 2);
      const et = filtered.filter((s) => Number(s.period || 1) > 2);
      if (p1.length) groups.push({ key: 'p1', label: "上半场 (1st Half · 00'–45')", color: '#38bdf8', list: p1 });
      if (p2.length) groups.push({ key: 'p2', label: "下半场 (2nd Half · 45'–90')", color: '#facc15', list: p2 });
      if (et.length) groups.push({ key: 'et', label: "加时赛 (Extra Time · 90'–120')", color: '#fb7185', list: et });
    } else {
      const tax = PRESSING_TAXONOMY[groupByMode].items;
      for (const [k, meta] of Object.entries(tax)) {
        const list = filtered.filter((s) => s[groupByMode] === k);
        if (list.length > 0) {
          groups.push({ key: k, label: meta.label, color: meta.color, desc: meta.desc, list });
        }
      }
    }

    const homeTeam = match.homeTeamZh;
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
        const prog = sliceNetProgressionM(s);
        const teamDotCol = s.team === homeTeam ? '#facc15' : '#38bdf8';
        const thumbHtml = s.thumbnail
          ? `<img class="fm-card-thumb" src="${s.thumbnail}" alt="slice" />`
          : '';

        html += `
          <div class="fm-slice-card${isAct ? ' active' : ''}" data-slice-id="${escapeHtml(s.id)}">
            ${thumbHtml}
            <div class="fm-card-body">
              <div class="fm-card-top">
                <span class="fm-card-team-dot" style="background:${teamDotCol};" title="${escapeHtml(s.team)}"></span>
                <span class="fm-card-clock">#${String(s.index).padStart(2, '0')} · ${escapeHtml(s.clock)}</span>
                <span class="fm-card-player">#${escapeHtml(s.jerseyNumber || '8')} ${escapeHtml(s.playerName.split(' ')[0])}</span>
                <span class="fm-card-int" title="贴防距 · 净推进">${s.minDefDistM}m · ${prog >= 0 ? '+' : ''}${prog}m</span>
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
        selectSliceById(cardEl.dataset.sliceId);
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
    if (stageMode !== 'diagnosis') drawPitchCanvas();
    cardsScrollEl.querySelectorAll('.fm-slice-card').forEach((el) => {
      const act = el.dataset.sliceId === sliceId;
      el.classList.toggle('active', act);
      if (act && scrollCardIntoView) {
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    });
  }

  // ==========================================================================
  // Interactive Dual-Team 90/120-Minute Timeline Canvas
  // ==========================================================================
  let timelineHitPoints = []; // [{ x, y, id, slice }]

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

    const distinctTeams = Array.from(new Set(match.slices.map((s) => s.team).filter(Boolean)));
    const dualTeamSplit = distinctTeams.length >= 2 && filters.team === 'ALL';
    const homeTeamName = match.homeTeamZh || distinctTeams[0];

    const maxSec = Math.max(
      match.totalMinutes * 60,
      ...match.slices.map((s) => parseClockToSeconds(s.clock, s.tStart) + 30),
      60
    );
    const useSecondsAxis = maxSec <= 180;

    const padL = dualTeamSplit ? 54 : 34;
    const padR = 18;
    const padT = 8;
    const padB = 17;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;
    const midY = padT + plotH * 0.5;

    ctx.fillStyle = 'rgba(13, 21, 33, 0.88)';
    ctx.fillRect(padL, padT, plotW, plotH);

    // Dual-team center horizon line & team labels
    if (dualTeamSplit) {
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.28)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padL, midY);
      ctx.lineTo(padL + plotW, midY);
      ctx.stroke();

      ctx.font = '600 9.5px "Inter", "Noto Sans SC", sans-serif';
      ctx.textAlign = 'right';
      ctx.fillStyle = '#facc15';
      ctx.fillText((homeTeamName || '主队').slice(0, 4), padL - 5, padT + plotH * 0.28 + 3);
      ctx.fillStyle = '#38bdf8';
      ctx.fillText((match.awayTeamZh || distinctTeams[1] || '客队').slice(0, 4), padL - 5, padT + plotH * 0.78 + 3);
    }

    const tickStep = useSecondsAxis ? 15 : 15 * 60;
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
    ctx.fillStyle = 'rgba(148, 163, 184, 0.74)';
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
      ctx.fillText(lbl, x, H - 3);
    }

    // Dual-team or single-track intensity wave bars
    const bucketCount = 48;
    const upBuckets = new Float32Array(bucketCount);
    const dnBuckets = new Float32Array(bucketCount);
    for (const s of filtered) {
      const u = clamp(parseClockToSeconds(s.clock, s.tStart) / maxSec, 0, 0.999);
      const bi = Math.floor(u * bucketCount);
      if (dualTeamSplit && s.team !== homeTeamName) {
        dnBuckets[bi] = Math.max(dnBuckets[bi], s.intensity || 70);
      } else {
        upBuckets[bi] = Math.max(upBuckets[bi], s.intensity || 70);
      }
    }
    const barW = plotW / bucketCount;
    for (let i = 0; i < bucketCount; i++) {
      const bx = padL + i * barW + 1;
      const bw = Math.max(2, barW - 2);
      if (dualTeamSplit) {
        if (upBuckets[i] > 0) {
          const bh = (upBuckets[i] / 108) * (plotH * 0.46);
          ctx.fillStyle = 'rgba(250, 204, 21, 0.17)';
          ctx.fillRect(bx, midY - bh, bw, bh);
        }
        if (dnBuckets[i] > 0) {
          const bh = (dnBuckets[i] / 108) * (plotH * 0.46);
          ctx.fillStyle = 'rgba(56, 189, 248, 0.18)';
          ctx.fillRect(bx, midY + 1, bw, bh);
        }
      } else if (upBuckets[i] > 0) {
        const bh = (upBuckets[i] / 105) * (plotH - 6);
        ctx.fillStyle = 'rgba(56, 189, 248, 0.17)';
        ctx.fillRect(bx, padT + plotH - bh, bw, bh);
      }
    }

    // Plot slices
    timelineHitPoints = [];
    for (const s of match.slices) {
      const isVis = filteredSet.has(s.id);
      const u = clamp(parseClockToSeconds(s.clock, s.tStart) / maxSec, 0.005, 0.995);
      const x = padL + u * plotW;
      const normI = clamp(((s.intensity || 75) - 45) / 58, 0.18, 0.90);
      let y;
      if (dualTeamSplit) {
        const isHome = s.team === homeTeamName;
        y = isHome ? midY - 4 - normI * (plotH * 0.40) : midY + 4 + normI * (plotH * 0.40);
      } else {
        y = padT + plotH - normI * (plotH - 8);
      }
      const col = PRESSING_TAXONOMY.escapeOutcome.items[s.escapeOutcome]?.color || '#38bdf8';

      if (!isVis) {
        ctx.fillStyle = 'rgba(148, 163, 184, 0.16)';
        ctx.beginPath();
        ctx.arc(x, y, 2.3, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }

      timelineHitPoints.push({ x, y, id: s.id, slice: s });

      const isCur = curActive && curActive.id === s.id;
      const isHov = hoveredTimelineSliceId === s.id;
      if (isCur) {
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x, padT);
        ctx.lineTo(x, padT + plotH);
        ctx.stroke();

        ctx.fillStyle = 'rgba(250, 204, 21, 0.26)';
        ctx.beginPath();
        ctx.arc(x, y, 8.8, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(x, y, isCur ? 4.8 : isHov ? 4.6 : 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = isCur || isHov ? '#ffffff' : 'rgba(10, 15, 25, 0.85)';
      ctx.lineWidth = isCur ? 1.6 : 1.0;
      ctx.stroke();
    }
  }

  function findNearestTimelineHit(mx, my) {
    let best = null;
    let bestD = 999;
    for (const pt of timelineHitPoints) {
      const d = Math.hypot(pt.x - mx, pt.y - my);
      const dxOnly = Math.abs(pt.x - mx);
      const score = d < 18 ? d : dxOnly + 12;
      if (score < bestD && dxOnly < 24) {
        bestD = score;
        best = pt;
      }
    }
    return best;
  }

  timelineCanvas.addEventListener('click', (e) => {
    const rect = timelineCanvas.getBoundingClientRect();
    const best = findNearestTimelineHit(e.clientX - rect.left, e.clientY - rect.top);
    if (best) selectSliceById(best.id, true);
  });

  timelineCanvas.addEventListener('mousemove', (e) => {
    const rect = timelineCanvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const best = findNearestTimelineHit(mx, my);
    if (best) {
      if (hoveredTimelineSliceId !== best.id) {
        hoveredTimelineSliceId = best.id;
        drawTimelineCanvas();
      }
      const s = best.slice;
      const oLbl = PRESSING_TAXONOMY.escapeOutcome.items[s.escapeOutcome]?.label || '';
      timelineTooltipEl.textContent = `[${s.clock}] ${s.team} #${s.jerseyNumber} ${s.playerName.split(' ')[0]} · ${oLbl} (${s.minDefDistM}m)`;
      timelineTooltipEl.style.display = 'block';
      const tipX = clamp(best.x, 120, rect.width - 140);
      timelineTooltipEl.style.left = `${tipX}px`;
    } else {
      if (hoveredTimelineSliceId) {
        hoveredTimelineSliceId = null;
        drawTimelineCanvas();
      }
      timelineTooltipEl.style.display = 'none';
    }
  });

  timelineCanvas.addEventListener('mouseleave', () => {
    hoveredTimelineSliceId = null;
    timelineTooltipEl.style.display = 'none';
    drawTimelineCanvas();
  });

  // ==========================================================================
  // Interactive 105m × 68m Tactical Pitch Canvas (Heat+Zone HUD & 360° Shadows)
  // ==========================================================================
  let pitchHitPoints = []; // [{ x, y, id }]
  let pitchZoneHitBoxes = []; // [{ x, y, w, h, zoneKey }]

  function drawPitchCanvas() {
    if (stageMode === 'diagnosis') return;
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

    // Pitch turf with mowing stripes
    ctx.fillStyle = '#0f241d';
    ctx.fillRect(ox, oy, pw, ph);
    const stripes = 10;
    for (let i = 0; i < stripes; i++) {
      if (i % 2 === 0) {
        ctx.fillStyle = 'rgba(22, 62, 44, 0.30)';
        ctx.fillRect(ox + (i / stripes) * pw, oy, pw / stripes, ph);
      }
    }

    const match = getActiveMatch();
    const filtered = getFilteredSlices();
    const curActive = getActiveSlice();
    const analytics = computeFullMatchAnalytics(match, filtered, PRESSING_TAXONOMY);

    // Clickable Tactical Zone Bands Overlay in `pitch_heat` mode
    pitchZoneHitBoxes = [];
    if (stageMode === 'pitch_heat' && showZoneHudOverlay) {
      const zoneBoxes = [
        { key: 'buildup_back', x0: 0, y0: 12, x1: 35, y1: 56, pillX: 17.5, pillY: 34 },
        { key: 'midfield_hub', x0: 35, y0: 12, x1: 70, y1: 56, pillX: 52.5, pillY: 34 },
        { key: 'zone14_halfspace', x0: 70, y0: 12, x1: 105, y1: 56, pillX: 87.5, pillY: 34 },
        { key: 'touchline_trap', x0: 0, y0: 0, x1: 105, y1: 12, pillX: 52.5, pillY: 6 }
      ];
      for (const zb of zoneBoxes) {
        const st = analytics.zoneStats[zb.key];
        const [rx0, ry0] = toPx(zb.x0, zb.y0);
        const [rx1, ry1] = toPx(zb.x1, zb.y1);
        const isActZone = filters.pitchZone === zb.key;
        ctx.fillStyle = isActZone ? hexToRgba(st.color, 0.14) : hexToRgba(st.color, 0.045);
        ctx.fillRect(rx0, ry0, rx1 - rx0, ry1 - ry0);
        if (zb.key === 'touchline_trap') {
          const [bx0, by0] = toPx(0, 56);
          const [bx1, by1] = toPx(105, 68);
          ctx.fillRect(bx0, by0, bx1 - bx0, by1 - by0);
        }
        ctx.strokeStyle = isActZone ? hexToRgba(st.color, 0.65) : hexToRgba(st.color, 0.22);
        ctx.lineWidth = isActZone ? 1.5 : 1;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(rx0, ry0, rx1 - rx0, ry1 - ry0);
        ctx.setLineDash([]);

        // Zone metric pill badge (clickable!)
        const [px, py] = toPx(zb.pillX, zb.pillY);
        const pillText = `${st.label.slice(0, 4)} ${st.count}处 · ${st.count > 0 ? st.escapeRate + '%' : '—'}`;
        ctx.font = '600 10px "Inter", "Noto Sans SC", sans-serif';
        const bw = ctx.measureText(pillText).width + 12;
        const bh = 18;
        const bx = px - bw * 0.5;
        const by = py - bh * 0.5;
        ctx.fillStyle = isActZone ? 'rgba(250, 204, 21, 0.26)' : 'rgba(9, 15, 26, 0.72)';
        ctx.strokeStyle = isActZone ? '#facc15' : hexToRgba(st.color, 0.52);
        ctx.lineWidth = 1;
        ctx.fillRect(bx, by, bw, bh);
        ctx.strokeRect(bx, by, bw, bh);
        ctx.fillStyle = isActZone ? '#fef08a' : '#e2e8f0';
        ctx.textAlign = 'center';
        ctx.fillText(pillText, px, py + 3.5);
        pitchZoneHitBoxes.push({ x: bx, y: by, w: bw, h: bh, zoneKey: zb.key });
      }
    }

    // Standard FIFA pitch lines
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.42)';
    ctx.lineWidth = 1.25;
    ctx.strokeRect(ox, oy, pw, ph);
    const [midX, midY] = toPx(52.5, 34);
    ctx.beginPath();
    ctx.moveTo(midX, oy);
    ctx.lineTo(midX, oy + ph);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(midX, midY, (9.15 / 105) * pw, 0, Math.PI * 2);
    ctx.stroke();

    const [lpX1, lpY0] = toPx(16.5, (68 - 40.3) / 2);
    const [, lpY1] = toPx(16.5, (68 + 40.3) / 2);
    ctx.strokeRect(ox, lpY0, lpX1 - ox, lpY1 - lpY0);
    const [rpX0] = toPx(105 - 16.5, 0);
    ctx.strokeRect(rpX0, lpY0, ox + pw - rpX0, lpY1 - lpY0);

    pitchHitPoints = [];

    // Mode 1: Radial Heatmap + All Filtered Escape Vectors
    if (stageMode === 'pitch_heat') {
      for (const s of filtered) {
        const [sx, sy] = toPx(s.pitchXY[0], s.pitchXY[1]);
        const rad = (7.5 / 105) * pw;
        const grad = ctx.createRadialGradient(sx, sy, 1, sx, sy, rad);
        const baseCol = s.escapeOutcome === 'turnover_loss' ? '239, 68, 68' : '56, 189, 248';
        grad.addColorStop(0, `rgba(${baseCol}, 0.22)`);
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

          ctx.fillStyle = hexToRgba(col, 0.85);
          ctx.beginPath();
          ctx.arc(sx, sy, 3.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Active Slice 360° Tactical Freeze-Frame (Enhanced with Cover-Shadow Cones & Open/Blocked Pass Lanes in `pitch_360`!)
    if (curActive) {
      const [hx, hy] = toPx(curActive.pitchXY[0], curActive.pitchXY[1]);
      const [ex, ey] = toPx(curActive.exitXY[0], curActive.exitXY[1]);
      pitchHitPoints.push({ x: hx, y: hy, id: curActive.id });

      const oppsAll = curActive.freezeOpps || [];
      const pressers = oppsAll.slice(0, Math.max(1, curActive.presserCount || 2));

      // In `pitch_360` mode: draw Defender Cover-Shadow Cones (压迫遮蔽阴影扇区)
      if (stageMode === 'pitch_360') {
        for (const op of pressers) {
          const [px, py] = toPx(op.x, op.y);
          const ang = Math.atan2(py - hy, px - hx);
          const coneLen = (11.5 / 105) * pw;
          const spread = 0.29;
          const grad = ctx.createRadialGradient(px, py, 2, px, py, coneLen);
          grad.addColorStop(0, 'rgba(239, 68, 68, 0.36)');
          grad.addColorStop(1, 'rgba(239, 68, 68, 0.02)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.arc(px, py, coneLen, ang - spread, ang + spread);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = 'rgba(248, 113, 113, 0.32)';
          ctx.lineWidth = 0.9;
          ctx.stroke();
        }
      }

      // 4.5m Pressing Danger Ring
      const pressRad = (4.5 / 105) * pw;
      ctx.fillStyle = 'rgba(239, 68, 68, 0.13)';
      ctx.strokeStyle = 'rgba(248, 113, 113, 0.65)';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(hx, hy, pressRad, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);

      // Teammates & Open vs Blocked Passing Lanes
      const mates = (curActive.freezeMates || []).slice(0, stageMode === 'pitch_360' ? 9 : 4);
      let openLaneCount = 0;
      let blockedLaneCount = 0;
      for (const m of mates) {
        const [mx, my] = toPx(m.x, m.y);
        const blocked =
          stageMode === 'pitch_360' &&
          isPassLaneBlockedByCoverShadow(curActive.pitchXY[0], curActive.pitchXY[1], m.x, m.y, oppsAll);
        if (blocked) blockedLaneCount++;
        else openLaneCount++;

        ctx.strokeStyle =
          stageMode === 'pitch_360'
            ? blocked
              ? 'rgba(248, 113, 113, 0.55)'
              : 'rgba(52, 211, 153, 0.72)'
            : 'rgba(56, 189, 248, 0.30)';
        ctx.lineWidth = stageMode === 'pitch_360' ? 1.5 : 1.0;
        ctx.setLineDash(blocked ? [3, 3] : [5, 3]);
        ctx.beginPath();
        ctx.moveTo(hx, hy);
        ctx.lineTo(mx, my);
        ctx.stroke();
        ctx.setLineDash([]);

        if (stageMode === 'pitch_360' && blocked) {
          const midLx = (hx + mx) * 0.5;
          const midLy = (hy + my) * 0.5;
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(midLx - 3.5, midLy - 3.5);
          ctx.lineTo(midLx + 3.5, midLy + 3.5);
          ctx.moveTo(midLx + 3.5, midLy - 3.5);
          ctx.lineTo(midLx - 3.5, midLy + 3.5);
          ctx.stroke();
        }

        ctx.fillStyle = stageMode === 'pitch_360' && !blocked ? '#34d399' : '#38bdf8';
        ctx.beginPath();
        ctx.arc(mx, my, 4.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Opponents
      const opps = oppsAll.slice(0, stageMode === 'pitch_360' ? 10 : 5);
      opps.forEach((op, idx) => {
        const [px, py] = toPx(op.x, op.y);
        const isPresser = idx < curActive.presserCount;
        if (isPresser) {
          ctx.strokeStyle = 'rgba(248, 113, 113, 0.78)';
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(hx, hy);
          ctx.stroke();
        }
        ctx.fillStyle = isPresser ? '#ef4444' : '#94a3b8';
        ctx.beginPath();
        ctx.arc(px, py, isPresser ? 5.0 : 3.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Exact distance label in 360° mode (offset away from ball carrier so it never collides with callout)
        if (stageMode === 'pitch_360' && isPresser && op.distM) {
          const awayAng = Math.atan2(py - hy, px - hx);
          const lx = px + Math.cos(awayAng) * 14;
          const ly = py + Math.sin(awayAng) * 14 + 3;
          ctx.font = '600 9.5px "JetBrains Mono", monospace';
          ctx.fillStyle = '#fecaca';
          ctx.textAlign = 'center';
          ctx.fillText(`${op.distM}m`, lx, ly);
        }
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
      const prog = sliceNetProgressionM(curActive);
      const tagText = `[${curActive.clock}] #${curActive.jerseyNumber || '8'} ${curActive.playerName.split(' ')[0]} · 贴防${curActive.minDefDistM}m · ΔX ${prog >= 0 ? '+' : ''}${prog}m`;
      ctx.font = '600 10.5px "Inter", "Noto Sans SC", sans-serif';
      const tw = ctx.measureText(tagText).width + 12;
      const tx = clamp(hx - tw * 0.5, ox + 4, ox + pw - tw - 4);
      const pillLift = stageMode === 'pitch_360' ? 34 : 25;
      const ty = hy > oy + pillLift + 6 ? hy - pillLift : hy + 14;
      ctx.fillStyle = 'rgba(10, 16, 28, 0.90)';
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.78)';
      ctx.lineWidth = 1;
      ctx.fillRect(tx, ty, tw, 18);
      ctx.strokeRect(tx, ty, tw, 18);
      ctx.fillStyle = '#fef08a';
      ctx.textAlign = 'left';
      ctx.fillText(tagText, tx + 6, ty + 13);

      // 360° Passing Lane Summary Pill at bottom-left of pitch
      if (stageMode === 'pitch_360') {
        const laneHud = `360° 空间评估：${curActive.presserCount} 名逼抢人施压 · 开放出球点 ${openLaneCount} 处 · 被遮蔽通道 ${blockedLaneCount} 处`;
        ctx.font = '600 10.5px "Inter", "Noto Sans SC", sans-serif';
        const lw = ctx.measureText(laneHud).width + 16;
        ctx.fillStyle = 'rgba(7, 13, 24, 0.88)';
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
        ctx.fillRect(ox + 8, oy + ph - 26, lw, 20);
        ctx.strokeRect(ox + 8, oy + ph - 26, lw, 20);
        ctx.fillStyle = '#e0f2fe';
        ctx.textAlign = 'left';
        ctx.fillText(laneHud, ox + 16, oy + ph - 12.5);
      }
    }
  }

  pitchCanvas.addEventListener('click', (e) => {
    const rect = pitchCanvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    // 1. Check slice dot hit first
    let best = null;
    let bestD = 18;
    for (const pt of pitchHitPoints) {
      const d = Math.hypot(pt.x - mx, pt.y - my);
      if (d < bestD) {
        bestD = d;
        best = pt;
      }
    }
    if (best) {
      selectSliceById(best.id, true);
      return;
    }

    // 2. Check clickable pitch zone HUD pill hit
    for (const zb of pitchZoneHitBoxes) {
      if (mx >= zb.x && mx <= zb.x + zb.w && my >= zb.y && my <= zb.y + zb.h) {
        filters.pitchZone = filters.pitchZone === zb.zoneKey ? 'ALL' : zb.zoneKey;
        renderAll();
        return;
      }
    }
  });

  // ==========================================================================
  // Pre-Scan Config Modal + Two-Pass Local MP4 Scanner + Bind Local Video
  // ==========================================================================
  btnOpenScanEl.addEventListener('click', () => {
    pendingScanFile = null;
    localMp4InputEl.value = '';
    btnStartScanEl.disabled = true;
    scanConfigPaneEl.style.display = 'block';
    scanProgressPaneEl.style.display = 'none';
    scanModalEl.style.display = 'grid';
  });

  btnCloseConfigEl.addEventListener('click', () => {
    scanModalEl.style.display = 'none';
  });

  localMp4InputEl.addEventListener('change', () => {
    pendingScanFile = localMp4InputEl.files && localMp4InputEl.files[0] ? localMp4InputEl.files[0] : null;
    btnStartScanEl.disabled = !pendingScanFile;
  });

  btnStartScanEl.addEventListener('click', async () => {
    if (!pendingScanFile) return;
    const file = pendingScanFile;
    const sampleStepSec = Number(cfgPrecisionEl.value || 1.0);
    const startMin = cfgStartMinEl.value !== '' ? Number(cfgStartMinEl.value) : 0;
    const endMin = cfgEndMinEl.value !== '' ? Number(cfgEndMinEl.value) : null;

    scanConfigPaneEl.style.display = 'none';
    scanProgressPaneEl.style.display = 'block';
    scanAbortController = new AbortController();
    scanTitleEl.textContent = `正在两阶段拆解本地视频：${file.name}`;
    scanSubEl.textContent = '初始化视频解码器与草皮球衣色彩分析器...';
    progressFillEl.style.width = '2%';
    scanPctEl.textContent = '2%';

    try {
      const scannedMatch = await scanLocalMatchVideoInBrowser(
        file,
        {
          signal: scanAbortController.signal,
          homeTeam: cfgHomeEl.value.trim() || '主队',
          awayTeam: cfgAwayEl.value.trim() || '客队',
          sampleStepSec,
          startSec: startMin * 60,
          endSec: endMin != null && endMin > startMin ? endMin * 60 : null
        },
        (pct, count, phaseTxt) => {
          progressFillEl.style.width = `${pct}%`;
          scanPctEl.textContent = `${pct}% · ${count}`;
          if (phaseTxt) scanSubEl.textContent = phaseTxt;
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

  // Bind a local full-match MP4 directly to the active match (e.g. StatsBomb or Python CLI JSON!)
  bindVideoInputEl.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const match = getActiveMatch();
    const blobUrl = URL.createObjectURL(file);
    match.videoSrc = blobUrl;
    match.hasDirectFullVideo = true;
    match._userBoundVideo = true;
    match._userBoundVideoName = file.name;
    match._preserveStatsClock = true;
    renderAll();
  });

  // JSON Import / Export + CSV Export + Markdown Tactical Brief Export
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
    triggerDownload(
      new Blob([JSON.stringify(match, null, 2)], { type: 'application/json;charset=utf-8' }),
      `match_pressing_breakdown_${match.id}.json`
    );
  });

  btnExportCsvEl.addEventListener('click', () => {
    const match = getActiveMatch();
    const rows = getFilteredSlices();
    const header = [
      'index', 'clock', 'team', 'oppTeam', 'playerName', 'playerRole',
      'pressType', 'pitchZone', 'escapeOutcome', 'presserCount',
      'minDefDistM', 'netProgressionM', 'intensity', 'pitchX', 'pitchY', 'summary'
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
          sliceNetProgressionM(s),
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

  btnExportMdEl.addEventListener('click', () => {
    const match = getActiveMatch();
    const rows = getFilteredSlices();
    const md = buildMatchScoutingReportMarkdown(match, rows, PRESSING_TAXONOMY);
    triggerDownload(
      new Blob([md], { type: 'text/markdown;charset=utf-8' }),
      `match_pressing_report_${match.id}.md`
    );
  });

  // Keyboard shortcuts when Full-Match workspace is visible
  window.addEventListener('keydown', (e) => {
    if (containerEl.offsetParent === null) return;
    if (e.target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
    if (e.key === 'ArrowLeft' || e.key === '[') {
      e.preventDefault();
      stepSlice(-1);
    } else if (e.key === 'ArrowRight' || e.key === ']') {
      e.preventDefault();
      stepSlice(1);
    } else if (e.key === 'p' || e.key === 'P') {
      e.preventDefault();
      togglePlaylistMode();
    } else if (e.key === '1') {
      setStageMode('pitch_heat');
    } else if (e.key === '2') {
      setStageMode('pitch_360');
    } else if (e.key === '3') {
      setStageMode('diagnosis');
    }
  });

  function renderAll(opts = {}) {
    renderFiltersAndKpis();
    renderActiveInspector(Boolean(opts.keepVideo));
    renderSliceCards();
    drawTimelineCanvas();
    if (stageMode === 'diagnosis') {
      renderDiagnosisView();
    } else {
      drawPitchCanvas();
    }
  }

  const resizeObs = new ResizeObserver(() => {
    if (containerEl.offsetParent !== null) {
      drawTimelineCanvas();
      if (stageMode !== 'diagnosis') drawPitchCanvas();
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
    setStageMode,
    stepSlice,
    togglePlaylistMode,
    trimActiveSlice,
    createManualSliceAtCurrentTime,
    deleteActiveSlice,
    setFilters(nextFilters = {}) {
      resetFilters(false);
      Object.assign(filters, nextFilters);
      if (searchInputEl && filters.searchQuery) searchInputEl.value = filters.searchQuery;
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
    getAnalytics() {
      const m = getActiveMatch();
      return computeFullMatchAnalytics(m, getFilteredSlices(), PRESSING_TAXONOMY);
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
        stageMode,
        playlistAutoAdvance,
        totalSlices: m.slices.length,
        filteredSlices: filtered.length,
        filters: { ...filters },
        groupByMode,
        activeSlice: active
          ? {
              id: active.id,
              index: active.index,
              clock: active.clock,
              team: active.team,
              playerName: active.playerName,
              pressType: active.pressType,
              pitchZone: active.pitchZone,
              escapeOutcome: active.escapeOutcome,
              tStart: active.tStart,
              tEnd: active.tEnd,
              duration: active.duration,
              netProgM: sliceNetProgressionM(active)
            }
          : null
      };
    }
  };
}
