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
  buildFfmpegCutupScript,
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
 * Returns teams in canonical [Home, Away] order matching `homeTeamZh` (Gold #facc15)
 * and `awayTeamZh` (Cyan #38bdf8), preventing color inversions when the away team
 * appears in Slice #1 (e.g., Euro 2024 ESP vs GER).
 */
function getOrderedTeams(match) {
  const present = Array.from(new Set((match?.slices || []).map((s) => s.team).filter(Boolean)));
  const ordered = [];
  if (match?.homeTeamZh && present.includes(match.homeTeamZh)) ordered.push(match.homeTeamZh);
  if (match?.awayTeamZh && present.includes(match.awayTeamZh) && !ordered.includes(match.awayTeamZh)) {
    ordered.push(match.awayTeamZh);
  }
  for (const t of present) {
    if (!ordered.includes(t)) ordered.push(t);
  }
  return ordered;
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
    const starredSet = new Set(patch?.starredIds || []);
    const modMap = patch?.modifiedSlices || {};
    const slices = baseMatch.slices
      .filter((s) => !deletedSet.has(s.id))
      .map((s) => ({
        ...s,
        ...(modMap[s.id] || {}),
        starred: starredSet.has(s.id) || Boolean(modMap[s.id]?.starred)
      }));
    if (Array.isArray(patch?.customSlices)) {
      for (const cs of patch.customSlices) {
        if (!deletedSet.has(cs.id)) {
          slices.push({ ...cs, starred: starredSet.has(cs.id) || Boolean(cs.starred) });
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
  let zoom360Tactical = true; // 2.2x focused 360° cover-shadow tactical camera
  let diagCompactDock = true; // Auto-compact bottom dock in Diagnosis view so all 5 blocks fit above the fold
  let videoPlaybackRate = 0.5;
  let playlistAutoAdvance = false;
  let scanAbortController = null;
  let pendingScanFile = null;
  let hoveredTimelineSliceId = null;
  let timelineBrushState = null; // { startX, curX, dragging, padL, plotW, maxSec }

  const filters = {
    team: 'ALL',
    period: 'ALL',
    minuteRange: null, // [min0, min1] | null
    starredOnly: false,
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
          <button id="fm-range-chip" class="fm-range-chip" type="button" style="display:none;" title="点击清除时间段框选筛选"></button>
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
      <div class="fm-timeline-canvas-wrap" title="单击节点定位切片；按住拖拽可框选任意分钟时间段">
        <canvas id="fm-timeline-canvas"></canvas>
        <div id="fm-timeline-tooltip" class="fm-timeline-tooltip" style="display:none;"></div>
      </div>
    </header>

    <!-- Main 3-Column Tactical Breakdown Grid -->
    <div class="fm-body-grid">
      <!-- Left Column: KPIs + Search + Shortlist + 4D Taxonomy Filters -->
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
          <input id="fm-search-input" class="fm-search-input" type="search" placeholder="🔍 搜索球员、时刻或关键词..." aria-label="搜索切片" />
          <button id="btn-fm-starred-only" class="fm-star-filter-btn" type="button" title="仅显示标星收入「精选剪辑包」的重点会议片段">
            ★ <em id="fm-starred-count">0</em>
          </button>
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
            <div class="fm-cli-head">
              <span class="fm-cli-title">⚡ CLI & 剪辑包</span>
              <button id="btn-fm-export-sh" class="fm-cli-export-btn" type="button" title="将当前筛选/标星切片导出为可执行的 FFmpeg 自动合并视频剪辑脚本 (.sh)">🎬 导出.sh脚本</button>
            </div>
            <code>python scripts/analyze_full_match_pressing.py --video match.mp4 --export-clips</code>
          </div>
        </div>
      </aside>

      <!-- Center Column: 3-Mode Tactical Stage + Active Slice Video Studio & Live Editor -->
      <section id="fm-center-stage" class="fm-center-stage" aria-label="球场空间热力分布、战术诊断与当前切片检阅舱">
        <div class="fm-pitch-card">
          <div class="fm-card-bar">
            <div class="fm-card-bar-left">
              <span id="fm-stage-eyebrow" class="fm-eyebrow">105m × 68m 逼抢热区 & 分区破围</span>
              <span id="fm-stage-sub" class="fm-attack-dir">本方后场 ➔ 对方球门</span>
              <button id="btn-toggle-zone-hud" class="fm-mini-chip active" type="button" title="在球场上叠加四区破围率与点击筛选">分区破围层</button>
              <button id="btn-toggle-360-zoom" class="fm-mini-chip active" type="button" style="display:none;" title="在 2.2x 局部战术特写与 105m 全场鸟瞰间切换">🔍 局部特写 2.2x</button>
              <button id="btn-toggle-diag-dock" class="fm-mini-chip" type="button" style="display:none;" title="展开或折叠底部视频舱以最大化全场诊断表格空间">🎬 展开视频舱</button>
              <button id="btn-export-pitch-png" class="fm-mini-chip" type="button" title="导出高清带标注 PNG 战术图用于赛后复盘 PPT">📸 导图</button>
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

        <div id="fm-inspector-card" class="fm-inspector-card">
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
                  <button id="btn-fm-star-slice" class="fm-star-btn" type="button" title="收入/移出教练「★ 精选剪辑包」 (快捷键 S)">☆</button>
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
              <input id="fm-edit-jersey" class="fm-edit-mini-input jersey" type="text" maxlength="3" aria-label="编辑球衣号码" title="修改球衣号 (自动保存)" placeholder="#" />
              <input id="fm-edit-player" class="fm-edit-mini-input player" type="text" aria-label="编辑持球球员名" title="修改持球球员名称 (自动保存)" placeholder="球员名" />
              <input id="fm-edit-summary" class="fm-edit-summary-input" type="text" aria-label="编辑战术切片摘要" placeholder="点击批注战术观察要点（自动保存）..." />
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
  const rangeChipEl = document.getElementById('fm-range-chip');
  const teamTabsEl = document.getElementById('fm-team-tabs');
  const periodTabsEl = document.getElementById('fm-period-tabs');
  const timelineCanvas = document.getElementById('fm-timeline-canvas');
  const timelineTooltipEl = document.getElementById('fm-timeline-tooltip');

  const kpiCountEl = document.getElementById('fm-kpi-count');
  const kpiSuccessEl = document.getElementById('fm-kpi-success');
  const kpiHeavyEl = document.getElementById('fm-kpi-heavy');
  const kpiDistEl = document.getElementById('fm-kpi-dist');
  const searchInputEl = document.getElementById('fm-search-input');
  const btnStarredOnlyEl = document.getElementById('btn-fm-starred-only');
  const starredCountEl = document.getElementById('fm-starred-count');
  const btnResetFiltersEl = document.getElementById('btn-fm-reset-filters');
  const btnRestoreEditsEl = document.getElementById('btn-fm-restore-edits');
  const btnExportShEl = document.getElementById('btn-fm-export-sh');

  const centerStageEl = document.getElementById('fm-center-stage');
  const stageEyebrowEl = document.getElementById('fm-stage-eyebrow');
  const stageSubEl = document.getElementById('fm-stage-sub');
  const btnToggleZoneHudEl = document.getElementById('btn-toggle-zone-hud');
  const btnToggle360ZoomEl = document.getElementById('btn-toggle-360-zoom');
  const btnToggleDiagDockEl = document.getElementById('btn-toggle-diag-dock');
  const btnExportPitchPngEl = document.getElementById('btn-export-pitch-png');
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

  const btnStarSliceEl = document.getElementById('btn-fm-star-slice');
  const detClockEl = document.getElementById('fm-det-clock');
  const detTeamEl = document.getElementById('fm-det-team');
  const detProgEl = document.getElementById('fm-det-prog');
  const detMetricsEl = document.getElementById('fm-det-metrics');
  const detTitleEl = document.getElementById('fm-det-title');
  const editJerseyEl = document.getElementById('fm-edit-jersey');
  const editPlayerEl = document.getElementById('fm-edit-player');
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

  function ensureMatchPatchRecord(matchId) {
    if (!storedPatches[matchId]) {
      storedPatches[matchId] = {
        modifiedSlices: {},
        deletedIds: [],
        starredIds: [],
        customSlices: [],
        kickoffOffsetSec: 0
      };
    }
    if (!Array.isArray(storedPatches[matchId].starredIds)) {
      storedPatches[matchId].starredIds = [];
    }
    return storedPatches[matchId];
  }

  function persistSlicePatch(match, slice, isCustom = false) {
    const isBuiltin = BUILTIN_FULL_MATCHES.some((b) => b.id === match.id);
    if (!isBuiltin) return;
    const rec = ensureMatchPatchRecord(match.id);
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
        playerName: slice.playerName,
        jerseyNumber: slice.jerseyNumber,
        summary: slice.summary,
        starred: Boolean(slice.starred),
        tStart: slice.tStart,
        tEnd: slice.tEnd,
        duration: slice.duration,
        clock: slice.clock
      };
    }
    rec.starredIds = match.slices.filter((s) => s.starred).map((s) => s.id);
    rec.kickoffOffsetSec = Number(match.kickoffOffsetSec || 0);
    saveStoredPatches(storedPatches);
    flashSavedIndicator();
  }

  function persistStarredIds(match) {
    const isBuiltin = BUILTIN_FULL_MATCHES.some((b) => b.id === match.id);
    if (!isBuiltin) return;
    const rec = ensureMatchPatchRecord(match.id);
    rec.starredIds = match.slices.filter((s) => s.starred).map((s) => s.id);
    saveStoredPatches(storedPatches);
    flashSavedIndicator();
  }

  function persistSliceDelete(match, sliceId) {
    const isBuiltin = BUILTIN_FULL_MATCHES.some((b) => b.id === match.id);
    if (!isBuiltin) return;
    const rec = ensureMatchPatchRecord(match.id);
    if (!rec.deletedIds.includes(sliceId)) rec.deletedIds.push(sliceId);
    rec.starredIds = (rec.starredIds || []).filter((id) => id !== sliceId);
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
      (p.starredIds || []).length > 0 ||
      (p.customSlices || []).length > 0 ||
      Boolean(p.kickoffOffsetSec)
    );
  }

  function toggleSliceStar(sliceId = null) {
    const match = getActiveMatch();
    const target = sliceId ? match.slices.find((s) => s.id === sliceId) : getActiveSlice();
    if (!target) return false;
    target.starred = !target.starred;
    persistStarredIds(match);
    renderAll({ keepVideo: true });
    return Boolean(target.starred);
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

  btnStarSliceEl.addEventListener('click', () => toggleSliceStar());

  editJerseyEl.addEventListener('change', () => {
    const match = getActiveMatch();
    const slice = getActiveSlice();
    if (!slice) return;
    const val = editJerseyEl.value.trim().replace(/^#/, '').slice(0, 3);
    const oldJ = String(slice.jerseyNumber || '');
    if (val && val !== oldJ) {
      if (oldJ && slice.summary && slice.summary.startsWith(`#${oldJ} `)) {
        slice.summary = `#${val} ` + slice.summary.slice(oldJ.length + 2);
      }
      slice.jerseyNumber = val;
      persistSlicePatch(match, slice);
      renderAll({ keepVideo: true });
    }
  });

  editPlayerEl.addEventListener('change', () => {
    const match = getActiveMatch();
    const slice = getActiveSlice();
    if (!slice) return;
    const val = editPlayerEl.value.trim();
    const oldName = slice.playerName || '';
    if (val && val !== oldName) {
      const oldShort = oldName.split(' ')[0];
      const newShort = val.split(' ')[0];
      const jPrefix = `#${slice.jerseyNumber || '8'} `;
      if (slice.summary && oldShort && slice.summary.startsWith(`${jPrefix}${oldShort}`)) {
        slice.summary = `${jPrefix}${newShort}` + slice.summary.slice((jPrefix + oldShort).length);
      }
      slice.playerName = val;
      persistSlicePatch(match, slice);
      renderAll({ keepVideo: true });
    }
  });

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

  btnStarredOnlyEl.addEventListener('click', () => {
    filters.starredOnly = !filters.starredOnly;
    renderAll();
  });

  rangeChipEl.addEventListener('click', () => {
    filters.minuteRange = null;
    renderAll();
  });

  btnExportShEl.addEventListener('click', () => {
    const match = getActiveMatch();
    const rows = getFilteredSlices();
    const sh = buildFfmpegCutupScript(match, rows);
    const suffix = filters.starredOnly ? 'shortlist' : 'filtered';
    triggerDownload(
      new Blob([sh], { type: 'text/x-shellscript;charset=utf-8' }),
      `cutup_${match.id}_${suffix}.sh`
    );
  });

  function getActiveMatch() {
    return matches.find((m) => m.id === activeMatchId) || matches[0];
  }

  function matchesFilter(slice, omitDim = null) {
    if (omitDim !== 'starredOnly' && filters.starredOnly && !slice.starred) {
      return false;
    }
    if (omitDim !== 'minuteRange' && Array.isArray(filters.minuteRange) && filters.minuteRange.length === 2) {
      const m = parseClockToSeconds(slice.clock, slice.tStart) / 60;
      if (m < filters.minuteRange[0] || m >= filters.minuteRange[1]) {
        return false;
      }
    }
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
    const filtered = getFilteredSlices();
    if (filtered.length === 0) {
      return null;
    }
    const inFiltered = filtered.find((s) => s.id === activeSliceId);
    if (inFiltered) return inFiltered;
    activeSliceId = filtered[0].id;
    return filtered[0];
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
    filters.minuteRange = null;
    filters.starredOnly = false;
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
  function syncStageChrome() {
    centerStageEl.classList.toggle('diag-compact-dock', stageMode === 'diagnosis' && diagCompactDock);
    btnToggle360ZoomEl.classList.toggle('active', zoom360Tactical);
    btnToggle360ZoomEl.textContent = zoom360Tactical ? '🔍 局部特写 2.2x' : '🏟️ 全场鸟瞰 105m';
    btnToggleDiagDockEl.classList.toggle('active', !diagCompactDock);
    btnToggleDiagDockEl.textContent = diagCompactDock ? '🎬 展开视频舱' : '📐 折叠视频舱';
  }

  function exportPitchBoardPng() {
    if (stageMode === 'diagnosis') return;
    drawPitchCanvas();
    const match = getActiveMatch();
    const slice = getActiveSlice();
    const srcW = pitchCanvas.width || 1200;
    const srcH = pitchCanvas.height || 760;
    const headerH = Math.round(srcH * 0.13);
    const out = document.createElement('canvas');
    out.width = srcW;
    out.height = srcH + headerH;
    const octx = out.getContext('2d');

    // Tactical slide dark backdrop & metadata header
    octx.fillStyle = '#070e1a';
    octx.fillRect(0, 0, out.width, out.height);
    octx.fillStyle = '#0c1628';
    octx.fillRect(0, 0, out.width, headerH);
    octx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
    octx.lineWidth = 2;
    octx.beginPath();
    octx.moveTo(0, headerH - 1);
    octx.lineTo(out.width, headerH - 1);
    octx.stroke();

    const titleFontPx = Math.max(18, Math.round(headerH * 0.30));
    const subFontPx = Math.max(13, Math.round(headerH * 0.22));
    const padX = Math.round(out.width * 0.025);
    octx.fillStyle = '#f8fafc';
    octx.font = `700 ${titleFontPx}px "Inter", "Noto Sans SC", sans-serif`;
    octx.textAlign = 'left';
    const modeTag = stageMode === 'pitch_360' ? '360° 压迫遮蔽战术板' : '105m 逼抢热区 & 分区破围板';
    octx.fillText(`${match.title} · ${modeTag}`, padX, Math.round(headerH * 0.44));

    octx.fillStyle = '#94a3b8';
    octx.font = `500 ${subFontPx}px "Inter", "Noto Sans SC", sans-serif`;
    const subLine = slice
      ? `切片 #${String(slice.index).padStart(2, '0')} [${slice.clock}] ${slice.team} #${slice.jerseyNumber || '8'} ${slice.playerName} · ${PRESSING_TAXONOMY.pressType.items[slice.pressType]?.label || ''} × ${PRESSING_TAXONOMY.escapeOutcome.items[slice.escapeOutcome]?.label || ''} · 贴防 ${slice.minDefDistM}m · 净推进 ${sliceNetProgressionM(slice) >= 0 ? '+' : ''}${sliceNetProgressionM(slice)}m`
      : `筛选切片: ${getFilteredSlices().length} / ${match.slices.length}`;
    octx.fillText(subLine, padX, Math.round(headerH * 0.80));

    octx.drawImage(pitchCanvas, 0, headerH);
    out.toBlob((blob) => {
      if (!blob) return;
      const stamp = slice ? slice.clock.replace(':', 'm') : 'all';
      triggerDownload(blob, `tactical_board_${match.id}_${stageMode}_${stamp}.png`);
    }, 'image/png');
  }

  function setStageMode(nextMode) {
    if (!['pitch_heat', 'pitch_360', 'diagnosis'].includes(nextMode)) return;
    stageMode = nextMode;
    containerEl.querySelectorAll('.fm-pitch-mode-tabs .fm-mini-tab').forEach((b) => {
      b.classList.toggle('active', b.dataset.stage === stageMode);
    });

    if (stageMode === 'diagnosis') {
      stageEyebrowEl.textContent = '整场持球逼抢诊断报告 · 双边对决 × 交叉矩阵 × 抗压榜';
      stageSubEl.textContent = '点击 15分钟柱条 / 矩阵格 / 球员行 即可联动筛选切片';
      btnToggleZoneHudEl.style.display = 'none';
      btnToggle360ZoomEl.style.display = 'none';
      btnToggleDiagDockEl.style.display = 'inline-flex';
      btnExportPitchPngEl.style.display = 'none';
      pitchCanvasWrapEl.style.display = 'none';
      diagnosisViewEl.style.display = 'flex';
      syncStageChrome();
      renderDiagnosisView();
    } else if (stageMode === 'pitch_360') {
      stageEyebrowEl.textContent = '360° 单帧压迫遮蔽站位 & 传球通道诊断';
      stageSubEl.textContent = '红扇区=防守遮蔽阴影 · 绿虚线=开放出球 · 2.5m/5m 压迫环';
      btnToggleZoneHudEl.style.display = 'none';
      btnToggle360ZoomEl.style.display = 'inline-flex';
      btnToggleDiagDockEl.style.display = 'none';
      btnExportPitchPngEl.style.display = 'inline-flex';
      diagnosisViewEl.style.display = 'none';
      pitchCanvasWrapEl.style.display = 'block';
      syncStageChrome();
      drawPitchCanvas();
    } else {
      stageEyebrowEl.textContent = '105m × 68m 逼抢热区 & 分区破围率';
      stageSubEl.textContent = '本方后场 ➔ 对方球门 · 点击球场分区徽章可直接筛选';
      btnToggleZoneHudEl.style.display = 'inline-flex';
      btnToggle360ZoomEl.style.display = 'none';
      btnToggleDiagDockEl.style.display = 'none';
      btnExportPitchPngEl.style.display = 'inline-flex';
      diagnosisViewEl.style.display = 'none';
      pitchCanvasWrapEl.style.display = 'block';
      syncStageChrome();
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

  btnToggle360ZoomEl.addEventListener('click', () => {
    zoom360Tactical = !zoom360Tactical;
    syncStageChrome();
    drawPitchCanvas();
  });

  btnToggleDiagDockEl.addEventListener('click', () => {
    diagCompactDock = !diagCompactDock;
    syncStageChrome();
  });

  btnExportPitchPngEl.addEventListener('click', () => exportPitchBoardPng());

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

    // Active Minute-Range Chip (from Tempo Wave click or Timeline Drag-Brush)
    if (Array.isArray(filters.minuteRange) && filters.minuteRange.length === 2) {
      const [m0, m1] = filters.minuteRange;
      const endLbl = m1 >= Math.max(96, match.totalMinutes + 4) ? `${match.totalMinutes}'+` : `${m1}'`;
      rangeChipEl.textContent = `⏱ ${m0}'–${endLbl} ×`;
      rangeChipEl.style.display = 'inline-flex';
    } else {
      rangeChipEl.style.display = 'none';
    }

    // Team Perspective Segmented Control (Canonical [Home=Gold, Away=Cyan] ordering!)
    const distinctTeams = getOrderedTeams(match);
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
      teamTabsEl.innerHTML = '';
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

    // KPIs + Shortlist Star Count
    const ov = analytics.teamDuel.overall;
    kpiCountEl.textContent = `${filtered.length} / ${all.length}`;
    kpiSuccessEl.textContent = `${ov.escapeRate}%`;
    kpiHeavyEl.textContent = `${ov.multiPressRate}%`;
    kpiDistEl.textContent = `${ov.avgMinDistM.toFixed(2)}m · ${ov.avgNetProgM >= 0 ? '+' : ''}${ov.avgNetProgM}m`;

    const totalStarred = all.filter((s) => s.starred).length;
    starredCountEl.textContent = String(totalStarred);
    btnStarredOnlyEl.classList.toggle('active', filters.starredOnly);
    btnStarredOnlyEl.classList.toggle('has-stars', totalStarred > 0);

    const hasAnyFilter =
      filters.team !== 'ALL' ||
      filters.period !== 'ALL' ||
      Boolean(filters.minuteRange) ||
      filters.starredOnly ||
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
    // Keep all 15-min bars visible when user selects a minuteRange so switching windows is 1-click!
    const tempoPool = match.slices.filter((s) => matchesFilter(s, 'minuteRange'));
    const tempoAnalytics = computeFullMatchAnalytics(match, tempoPool, PRESSING_TAXONOMY);
    const { teamDuel, crossMatrix, leaderboard, insights } = analytics;
    const tempo = tempoAnalytics.tempo;

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
          <span class="fm-diag-sub-legend">点击柱条筛选时段 · 红点=失误</span>
        </div>
        <div class="fm-tempo-bars">
          ${tempo.buckets
            .map((b) => {
              const hPct = Math.round((b.homeCount / Math.max(1, tempo.maxCount)) * 100);
              const aPct = Math.round((b.awayCount / Math.max(1, tempo.maxCount)) * 100);
              const isAct =
                Array.isArray(filters.minuteRange) &&
                filters.minuteRange[0] === b.min0 &&
                filters.minuteRange[1] === b.min1;
              return `
                <button type="button" class="fm-tempo-col${isAct ? ' active' : ''}" data-min0="${b.min0}" data-min1="${b.min1}"
                  title="${b.label}: 共 ${b.total} 次 (${teamDuel.home.name} ${b.homeCount} / ${teamDuel.away.name} ${b.awayCount}, 丢球 ${b.turnovers}) · 点击筛选该时段">
                  <span class="fm-tempo-val">${b.total > 0 ? b.total : ''}${b.turnovers > 0 ? '<i class="fm-tempo-loss-dot"></i>' : ''}</span>
                  <div class="fm-tempo-stack">
                    ${b.awayCount > 0 ? `<div class="fm-tempo-seg away" style="height:${Math.max(8, aPct)}%;"></div>` : ''}
                    ${b.homeCount > 0 ? `<div class="fm-tempo-seg home" style="height:${Math.max(8, hPct)}%;"></div>` : ''}
                  </div>
                  <span class="fm-tempo-lbl">${b.label}</span>
                </button>
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
          <span>🏆 球员抗压榜 (Top 7)</span>
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
              .slice(0, 7)
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

    // Bind 15-Minute Tempo Wave Bar Clicks -> Instant Time-Window Filter!
    diagnosisViewEl.querySelectorAll('.fm-tempo-col').forEach((btn) => {
      btn.addEventListener('click', () => {
        const min0 = Number(btn.dataset.min0);
        const min1 = Number(btn.dataset.min1);
        if (Array.isArray(filters.minuteRange) && filters.minuteRange[0] === min0 && filters.minuteRange[1] === min1) {
          filters.minuteRange = null;
        } else {
          filters.minuteRange = [min0, min1];
        }
        renderAll();
      });
    });

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
      detClockEl.textContent = '—';
      detTeamEl.textContent = '0 命中';
      detTitleEl.textContent = '当前筛选条件下暂无命中切片，请放宽或重置左侧四维筛选器';
      detMetricsEl.textContent = '';
      detProgEl.textContent = '—';
      detProgEl.classList.remove('neg');
      editJerseyEl.value = '';
      editPlayerEl.value = '';
      editSummaryEl.value = '';
      editJerseyEl.disabled = true;
      editPlayerEl.disabled = true;
      editSummaryEl.disabled = true;
      Object.values(editSelects).forEach((s) => {
        s.disabled = true;
      });
      btnStarSliceEl.textContent = '☆';
      btnStarSliceEl.classList.remove('starred');
      btnStarSliceEl.disabled = true;
      btnSendTo3DEl.disabled = true;
      btnDeleteSliceEl.disabled = true;
      btnTrimInMinusEl.disabled = true;
      btnTrimInPlusEl.disabled = true;
      btnTrimOutMinusEl.disabled = true;
      btnTrimOutPlusEl.disabled = true;
      try {
        sliceVideoEl.pause();
      } catch {}
      sliceVideoEl.style.opacity = '0.16';
      videoBadgeEl.textContent = '⏸ 0 条命中切片';
      videoRangeLabelEl.textContent = '—';
      return;
    }
    sliceVideoEl.style.opacity = '';
    editJerseyEl.disabled = false;
    editPlayerEl.disabled = false;
    editSummaryEl.disabled = false;
    Object.values(editSelects).forEach((s) => {
      s.disabled = false;
    });
    btnStarSliceEl.disabled = false;
    btnStarSliceEl.textContent = slice.starred ? '★' : '☆';
    btnStarSliceEl.classList.toggle('starred', Boolean(slice.starred));
    btnSendTo3DEl.disabled = false;
    btnDeleteSliceEl.disabled = match.slices.length <= 1;
    btnTrimInMinusEl.disabled = false;
    btnTrimInPlusEl.disabled = false;
    btnTrimOutMinusEl.disabled = false;
    btnTrimOutPlusEl.disabled = false;

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
    editJerseyEl.value = slice.jerseyNumber || '';
    editPlayerEl.value = slice.playerName || '';
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

    const homeTeam = getOrderedTeams(match)[0] || match.homeTeamZh;
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
          <div class="fm-slice-card${isAct ? ' active' : ''}${s.starred ? ' is-starred' : ''}" data-slice-id="${escapeHtml(s.id)}">
            ${thumbHtml}
            <div class="fm-card-body">
              <div class="fm-card-top">
                <button type="button" class="fm-card-star${s.starred ? ' starred' : ''}" data-slice-id="${escapeHtml(s.id)}" title="收入/移出精选剪辑包">${s.starred ? '★' : '☆'}</button>
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
        if (e.target.closest('.act-3d') || e.target.closest('.fm-card-star')) return;
        selectSliceById(cardEl.dataset.sliceId);
      });
    });

    cardsScrollEl.querySelectorAll('.fm-card-star').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleSliceStar(btn.dataset.sliceId);
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
  // Interactive Dual-Team 90/120-Minute Timeline Canvas (Click + Drag-Brush Range)
  // ==========================================================================
  let timelineHitPoints = []; // [{ x, y, id, slice }]
  let timelineGeom = { padL: 64, padT: 8, plotW: 600, plotH: 48, maxSec: 5400 };
  let suppressNextTimelineClick = false;

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

    const distinctTeams = getOrderedTeams(match);
    const dualTeamSplit = distinctTeams.length >= 2 && filters.team === 'ALL';
    const homeTeamName = distinctTeams[0] || match.homeTeamZh;
    const awayTeamName = distinctTeams[1] || match.awayTeamZh;

    const maxSec = Math.max(
      match.totalMinutes * 60,
      ...match.slices.map((s) => parseClockToSeconds(s.clock, s.tStart) + 30),
      60
    );
    const useSecondsAxis = maxSec <= 180;

    const padL = dualTeamSplit ? 64 : 34;
    const padR = 18;
    const padT = 8;
    const padB = 17;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;
    const midY = padT + plotH * 0.5;
    timelineGeom = { padL, padT, plotW, plotH, maxSec };

    ctx.fillStyle = 'rgba(13, 21, 33, 0.88)';
    ctx.fillRect(padL, padT, plotW, plotH);

    // Highlight active minuteRange or live drag-brush selection window
    let selX0 = null;
    let selX1 = null;
    if (timelineBrushState && timelineBrushState.dragging) {
      selX0 = clamp(Math.min(timelineBrushState.startX, timelineBrushState.curX), padL, padL + plotW);
      selX1 = clamp(Math.max(timelineBrushState.startX, timelineBrushState.curX), padL, padL + plotW);
    } else if (Array.isArray(filters.minuteRange) && filters.minuteRange.length === 2) {
      const u0 = clamp((filters.minuteRange[0] * 60) / maxSec, 0, 1);
      const u1 = clamp((filters.minuteRange[1] * 60) / maxSec, 0, 1);
      selX0 = padL + u0 * plotW;
      selX1 = padL + u1 * plotW;
    }
    if (selX0 !== null && selX1 !== null && selX1 - selX0 >= 2) {
      ctx.fillStyle = 'rgba(250, 204, 21, 0.14)';
      ctx.fillRect(selX0, padT, selX1 - selX0, plotH);
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.85)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(selX0, padT);
      ctx.lineTo(selX0, padT + plotH);
      ctx.moveTo(selX1, padT);
      ctx.lineTo(selX1, padT + plotH);
      ctx.stroke();
      ctx.fillStyle = 'rgba(250, 204, 21, 0.75)';
      ctx.fillRect(selX0, padT, selX1 - selX0, 2);
    }

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
      ctx.fillText((homeTeamName || '主队').slice(0, 5), padL - 6, padT + plotH * 0.28 + 3);
      ctx.fillStyle = '#38bdf8';
      ctx.fillText((awayTeamName || '客队').slice(0, 5), padL - 6, padT + plotH * 0.78 + 3);
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
      } else if (s.starred) {
        ctx.strokeStyle = 'rgba(250, 204, 21, 0.9)';
        ctx.lineWidth = 1.25;
        ctx.beginPath();
        ctx.arc(x, y, 6.2, 0, Math.PI * 2);
        ctx.stroke();
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

  timelineCanvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    const rect = timelineCanvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    if (mx >= timelineGeom.padL && mx <= timelineGeom.padL + timelineGeom.plotW) {
      timelineBrushState = { startX: mx, curX: mx, dragging: false };
    }
  });

  timelineCanvas.addEventListener('click', (e) => {
    if (suppressNextTimelineClick) {
      suppressNextTimelineClick = false;
      return;
    }
    const rect = timelineCanvas.getBoundingClientRect();
    const best = findNearestTimelineHit(e.clientX - rect.left, e.clientY - rect.top);
    if (best) selectSliceById(best.id, true);
  });

  timelineCanvas.addEventListener('mousemove', (e) => {
    const rect = timelineCanvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    if (timelineBrushState) {
      timelineBrushState.curX = clamp(mx, timelineGeom.padL, timelineGeom.padL + timelineGeom.plotW);
      if (Math.abs(timelineBrushState.curX - timelineBrushState.startX) > 10) {
        timelineBrushState.dragging = true;
        const x0 = Math.min(timelineBrushState.startX, timelineBrushState.curX);
        const x1 = Math.max(timelineBrushState.startX, timelineBrushState.curX);
        const m0 = Math.max(0, Math.floor(((x0 - timelineGeom.padL) / Math.max(1, timelineGeom.plotW)) * (timelineGeom.maxSec / 60)));
        const m1 = Math.max(m0 + 1, Math.ceil(((x1 - timelineGeom.padL) / Math.max(1, timelineGeom.plotW)) * (timelineGeom.maxSec / 60)));
        timelineTooltipEl.textContent = `框选筛选时间段：${m0}' – ${m1}'（松手应用）`;
        timelineTooltipEl.style.display = 'block';
        timelineTooltipEl.style.left = `${clamp((x0 + x1) * 0.5, 110, rect.width - 120)}px`;
        drawTimelineCanvas();
        return;
      }
    }

    const best = findNearestTimelineHit(mx, my);
    if (best) {
      if (hoveredTimelineSliceId !== best.id) {
        hoveredTimelineSliceId = best.id;
        drawTimelineCanvas();
      }
      const s = best.slice;
      const oLbl = PRESSING_TAXONOMY.escapeOutcome.items[s.escapeOutcome]?.label || '';
      timelineTooltipEl.textContent = `[${s.clock}] ${s.team} #${s.jerseyNumber} ${s.playerName.split(' ')[0]} · ${oLbl} (${s.minDefDistM}m)${s.starred ? ' ★' : ''}`;
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

  window.addEventListener('mouseup', () => {
    if (!timelineBrushState) return;
    const st = timelineBrushState;
    timelineBrushState = null;
    if (st.dragging) {
      suppressNextTimelineClick = true;
      const x0 = Math.min(st.startX, st.curX);
      const x1 = Math.max(st.startX, st.curX);
      const totalMins = timelineGeom.maxSec / 60;
      const m0 = Math.max(0, Math.floor(((x0 - timelineGeom.padL) / Math.max(1, timelineGeom.plotW)) * totalMins));
      let m1 = Math.max(m0 + 2, Math.ceil(((x1 - timelineGeom.padL) / Math.max(1, timelineGeom.plotW)) * totalMins));
      if (x1 >= timelineGeom.padL + timelineGeom.plotW - 4) m1 = Math.ceil(totalMins) + 2;
      filters.minuteRange = [m0, m1];
      timelineTooltipEl.style.display = 'none';
      renderAll();
    }
  });

  timelineCanvas.addEventListener('mouseleave', () => {
    if (!timelineBrushState?.dragging) {
      hoveredTimelineSliceId = null;
      timelineTooltipEl.style.display = 'none';
      drawTimelineCanvas();
    }
  });

  // ==========================================================================
  // Interactive 105m × 68m Tactical Pitch Canvas (Heat+Zone HUD & 2.2x 360° Board)
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

    const match = getActiveMatch();
    const filtered = getFilteredSlices();
    const curActive = getActiveSlice();
    const analytics = computeFullMatchAnalytics(match, filtered, PRESSING_TAXONOMY);

    // Compute Tactical Viewport: Full 105m×68m OR Smart 2.2x Zoomed Crop in `pitch_360`
    const isZoomed360 = stageMode === 'pitch_360' && zoom360Tactical && Boolean(curActive);
    let vx0 = 0;
    let vy0 = 0;
    let vw = 105;
    let vh = 68;
    if (isZoomed360) {
      vw = 46.5; // ~2.26x tactical focus preserving 105:68 aspect
      vh = vw / aspect;
      const hxM = curActive.pitchXY[0];
      const hyM = curActive.pitchXY[1];
      const clusterPts = [[hxM, hyM], [curActive.exitXY[0], curActive.exitXY[1]]];
      for (const op of (curActive.freezeOpps || []).slice(0, 4)) {
        if (Math.hypot(op.x - hxM, op.y - hyM) <= 18) clusterPts.push([op.x, op.y]);
      }
      for (const m of (curActive.freezeMates || []).slice(0, 4)) {
        if (Math.hypot(m.x - hxM, m.y - hyM) <= 20) clusterPts.push([m.x, m.y]);
      }
      const avgX = clusterPts.reduce((a, p) => a + p[0], 0) / clusterPts.length;
      const avgY = clusterPts.reduce((a, p) => a + p[1], 0) / clusterPts.length;
      const focusX = hxM * 0.72 + avgX * 0.28;
      const focusY = hyM * 0.72 + avgY * 0.28;
      vx0 = clamp(focusX - vw * 0.5, 0, 105 - vw);
      vy0 = clamp(focusY - vh * 0.5, 0, 68 - vh);
    }

    const toPx = (xm, ym) => [ox + ((xm - vx0) / vw) * pw, oy + ((ym - vy0) / vh) * ph];
    const mToPx = (meters) => (meters / vw) * pw;

    // Clip turf + pitch markings + tactical overlays cleanly inside the board rectangle
    ctx.save();
    ctx.beginPath();
    ctx.rect(ox, oy, pw, ph);
    ctx.clip();

    // Pitch turf with real 10.5m mowing stripes
    ctx.fillStyle = '#0f241d';
    ctx.fillRect(ox, oy, pw, ph);
    for (let i = 0; i < 10; i++) {
      if (i % 2 === 0) {
        const [sx0] = toPx(i * 10.5, 0);
        const [sx1] = toPx((i + 1) * 10.5, 0);
        ctx.fillStyle = 'rgba(22, 62, 44, 0.30)';
        ctx.fillRect(sx0, oy, sx1 - sx0, ph);
      }
    }

    // Subtle 5m tactical scale grid in zoomed 360° mode
    if (isZoomed360) {
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.085)';
      ctx.lineWidth = 0.8;
      for (let gx = Math.ceil(vx0 / 5) * 5; gx <= vx0 + vw; gx += 5) {
        const [px] = toPx(gx, 0);
        ctx.beginPath();
        ctx.moveTo(px, oy);
        ctx.lineTo(px, oy + ph);
        ctx.stroke();
      }
      for (let gy = Math.ceil(vy0 / 5) * 5; gy <= vy0 + vh; gy += 5) {
        const [, py] = toPx(0, gy);
        ctx.beginPath();
        ctx.moveTo(ox, py);
        ctx.lineTo(ox + pw, py);
        ctx.stroke();
      }
    }

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

    // Real FIFA pitch lines (works identically at 1.0x full-pitch and 2.2x zoomed crop!)
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.42)';
    ctx.lineWidth = isZoomed360 ? 1.6 : 1.25;
    const [p0x, p0y] = toPx(0, 0);
    const [p1x, p1y] = toPx(105, 68);
    ctx.strokeRect(p0x, p0y, p1x - p0x, p1y - p0y);

    const [midX, midY] = toPx(52.5, 34);
    ctx.beginPath();
    ctx.moveTo(midX, p0y);
    ctx.lineTo(midX, p1y);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(midX, midY, mToPx(9.15), 0, Math.PI * 2);
    ctx.stroke();

    const [lpX1, lpY0] = toPx(16.5, (68 - 40.3) / 2);
    const [, lpY1] = toPx(16.5, (68 + 40.3) / 2);
    ctx.strokeRect(p0x, lpY0, lpX1 - p0x, lpY1 - lpY0);
    const [rpX0] = toPx(105 - 16.5, 0);
    ctx.strokeRect(rpX0, lpY0, p1x - rpX0, lpY1 - lpY0);

    if (isZoomed360) {
      // 6-yard boxes & penalty spots for rich spatial reference when zoomed
      const [l6X1, l6Y0] = toPx(5.5, (68 - 18.32) / 2);
      const [, l6Y1] = toPx(5.5, (68 + 18.32) / 2);
      ctx.strokeRect(p0x, l6Y0, l6X1 - p0x, l6Y1 - l6Y0);
      const [r6X0] = toPx(105 - 5.5, 0);
      ctx.strokeRect(r6X0, l6Y0, p1x - r6X0, l6Y1 - l6Y0);
      for (const spotX of [11, 94]) {
        const [sx, sy] = toPx(spotX, 34);
        ctx.fillStyle = 'rgba(226, 232, 240, 0.55)';
        ctx.beginPath();
        ctx.arc(sx, sy, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    pitchHitPoints = [];

    // Mode 1: Radial Heatmap + All Filtered Escape Vectors
    if (stageMode === 'pitch_heat') {
      for (const s of filtered) {
        const [sx, sy] = toPx(s.pitchXY[0], s.pitchXY[1]);
        const rad = mToPx(7.5);
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

    // Active Slice 360° Tactical Freeze-Frame
    let openLaneCount = 0;
    let blockedLaneCount = 0;
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
          const coneLen = mToPx(isZoomed360 ? 13.5 : 11.5);
          const spread = 0.28;
          const grad = ctx.createRadialGradient(px, py, 2, px, py, coneLen);
          grad.addColorStop(0, 'rgba(239, 68, 68, 0.42)');
          grad.addColorStop(0.55, 'rgba(239, 68, 68, 0.16)');
          grad.addColorStop(1, 'rgba(239, 68, 68, 0.015)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.arc(px, py, coneLen, ang - spread, ang + spread);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = 'rgba(248, 113, 113, 0.42)';
          ctx.lineWidth = isZoomed360 ? 1.15 : 0.9;
          ctx.stroke();
        }
      }

      // Concentric Pressure Rings: 5.0m (合拢圈) + 2.5m (贴防高压圈) in 360° mode, or 4.5m in Heat mode
      if (stageMode === 'pitch_360') {
        const r5 = mToPx(5.0);
        ctx.fillStyle = 'rgba(239, 68, 68, 0.075)';
        ctx.strokeStyle = 'rgba(248, 113, 113, 0.48)';
        ctx.lineWidth = 1.1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(hx, hy, r5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        const r25 = mToPx(2.5);
        ctx.fillStyle = 'rgba(239, 68, 68, 0.12)';
        ctx.strokeStyle = 'rgba(251, 113, 133, 0.78)';
        ctx.lineWidth = 1.25;
        ctx.setLineDash([3, 2]);
        ctx.beginPath();
        ctx.arc(hx, hy, r25, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]);

        if (isZoomed360) {
          ctx.font = '600 9px "JetBrains Mono", monospace';
          ctx.textAlign = 'left';
          ctx.fillStyle = 'rgba(254, 202, 202, 0.78)';
          ctx.fillText('2.5m', hx + r25 * 0.72 + 2, hy + r25 * 0.72 + 2);
          ctx.fillStyle = 'rgba(248, 113, 113, 0.65)';
          ctx.fillText('5.0m', hx + r5 * 0.72 + 2, hy + r5 * 0.72 + 2);
        }
      } else {
        const pressRad = mToPx(4.5);
        ctx.fillStyle = 'rgba(239, 68, 68, 0.13)';
        ctx.strokeStyle = 'rgba(248, 113, 113, 0.65)';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.arc(hx, hy, pressRad, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Teammates & Open vs Blocked Passing Lanes
      const mates = (curActive.freezeMates || []).slice(0, stageMode === 'pitch_360' ? 9 : 4);
      let badgeDrawnCount = 0;
      for (const m of mates) {
        const [mx, my] = toPx(m.x, m.y);
        const passDistM = Math.hypot(m.x - curActive.pitchXY[0], m.y - curActive.pitchXY[1]);
        const blocked =
          stageMode === 'pitch_360' &&
          isPassLaneBlockedByCoverShadow(curActive.pitchXY[0], curActive.pitchXY[1], m.x, m.y, oppsAll);
        if (blocked) blockedLaneCount++;
        else openLaneCount++;

        ctx.strokeStyle =
          stageMode === 'pitch_360'
            ? blocked
              ? 'rgba(248, 113, 113, 0.58)'
              : 'rgba(52, 211, 153, 0.76)'
            : 'rgba(56, 189, 248, 0.30)';
        ctx.lineWidth = stageMode === 'pitch_360' ? (isZoomed360 ? 1.85 : 1.5) : 1.0;
        ctx.setLineDash(blocked ? [3, 3] : [6, 3]);
        ctx.beginPath();
        ctx.moveTo(hx, hy);
        ctx.lineTo(mx, my);
        ctx.stroke();
        ctx.setLineDash([]);

        if (stageMode === 'pitch_360' && blocked) {
          const midLx = (hx + mx) * 0.5;
          const midLy = (hy + my) * 0.5;
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.moveTo(midLx - 4, midLy - 4);
          ctx.lineTo(midLx + 4, midLy + 4);
          ctx.moveTo(midLx + 4, midLy - 4);
          ctx.lineTo(midLx - 4, midLy + 4);
          ctx.stroke();
        }

        const mateR = isZoomed360 ? 6.2 : 4.4;
        ctx.fillStyle = stageMode === 'pitch_360' && !blocked ? '#34d399' : '#38bdf8';
        ctx.beginPath();
        ctx.arc(mx, my, mateR, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1.3;
        ctx.stroke();

        // Explicit pass-lane badge near visible teammates in 2.2x zoomed 360° mode
        // Clamp strictly clear of top HUD ([oy+8, oy+27]) and bottom 360° HUD ([oy+ph-26, oy+ph-6])
        const inView = mx > ox + 28 && mx < ox + pw - 28 && my > oy + 24 && my < oy + ph - 30;
        if (isZoomed360 && inView && badgeDrawnCount < 5) {
          badgeDrawnCount++;
          const lbl = blocked ? '遮蔽 ✕' : `开放 ${passDistM.toFixed(1)}m`;
          ctx.font = '600 9.5px "Inter", "Noto Sans SC", monospace';
          const bw = ctx.measureText(lbl).width + 10;
          const bx = clamp(mx - bw * 0.5, ox + 6, ox + pw - bw - 6);
          const topSafe = oy + 32;
          const botSafe = oy + ph - 32 - 15;
          let by = my < hy ? my - 23 : my + 10;
          if (by > botSafe) by = my - 23;
          if (by < topSafe) by = my + 10;
          by = clamp(by, topSafe, botSafe);
          ctx.fillStyle = blocked ? 'rgba(69, 10, 10, 0.86)' : 'rgba(6, 46, 36, 0.86)';
          ctx.strokeStyle = blocked ? 'rgba(248, 113, 113, 0.65)' : 'rgba(52, 211, 153, 0.72)';
          ctx.lineWidth = 1;
          ctx.fillRect(bx, by, bw, 15);
          ctx.strokeRect(bx, by, bw, 15);
          ctx.fillStyle = blocked ? '#fecaca' : '#a7f3d0';
          ctx.textAlign = 'center';
          ctx.fillText(lbl, bx + bw * 0.5, by + 10.8);
        }
      }

      // Opponents + Closing-In Pressure Arrows
      const escAng = Math.atan2(ey - hy, ex - hx);
      const opps = oppsAll.slice(0, stageMode === 'pitch_360' ? 10 : 5);
      opps.forEach((op, idx) => {
        const [px, py] = toPx(op.x, op.y);
        const isPresser = idx < curActive.presserCount;
        const closingAng = Math.atan2(hy - py, hx - px);

        if (isPresser) {
          ctx.strokeStyle = 'rgba(248, 113, 113, 0.84)';
          ctx.lineWidth = isZoomed360 ? 1.8 : 1.4;
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(hx, hy);
          ctx.stroke();

          // Directional closing arrow midway toward ball carrier
          if (isZoomed360 && Math.hypot(hx - px, hy - py) > 22) {
            const ax = px + (hx - px) * 0.52;
            const ay = py + (hy - py) * 0.52;
            ctx.fillStyle = '#f87171';
            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.lineTo(ax - Math.cos(closingAng - 0.5) * 6.5, ay - Math.sin(closingAng - 0.5) * 6.5);
            ctx.lineTo(ax - Math.cos(closingAng + 0.5) * 6.5, ay - Math.sin(closingAng + 0.5) * 6.5);
            ctx.closePath();
            ctx.fill();
          }
        }

        const oppR = isPresser ? (isZoomed360 ? 7.2 : 5.0) : (isZoomed360 ? 5.2 : 3.8);
        ctx.fillStyle = isPresser ? '#ef4444' : '#94a3b8';
        ctx.beginPath();
        ctx.arc(px, py, oppR, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = isZoomed360 ? 1.4 : 1;
        ctx.stroke();

        if (isZoomed360 && isPresser) {
          ctx.font = '700 8.5px "JetBrains Mono", monospace';
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.fillText(`D${idx + 1}`, px, py + 3);
        }

        // Exact distance label in 360° mode (2-decimal uniform precision, clamped clear of HUD bars)
        if (stageMode === 'pitch_360' && isPresser && op.distM != null) {
          let lblAng = Math.atan2(py - hy, px - hx);
          const diffEsc = Math.atan2(Math.sin(lblAng - escAng), Math.cos(lblAng - escAng));
          if (isZoomed360 && Math.abs(diffEsc) < 0.45) {
            lblAng += diffEsc >= 0 ? 0.72 : -0.72;
          }
          const distOff = isZoomed360 ? 25 : 14;
          const dTxt = `${Number(op.distM).toFixed(2)}m`;
          ctx.font = '700 9.5px "JetBrains Mono", monospace';
          const dw = ctx.measureText(dTxt).width + 8;
          const lx = clamp(px + Math.cos(lblAng) * distOff, ox + dw * 0.5 + 6, ox + pw - dw * 0.5 - 6);
          const ly = clamp(py + Math.sin(lblAng) * distOff, oy + 38, oy + ph - 38);
          if (isZoomed360) {
            ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
            ctx.strokeStyle = 'rgba(248, 113, 113, 0.65)';
            ctx.lineWidth = 0.9;
            ctx.fillRect(lx - dw * 0.5, ly - 7.5, dw, 14);
            ctx.strokeRect(lx - dw * 0.5, ly - 7.5, dw, 14);
          }
          ctx.fillStyle = '#fecaca';
          ctx.textAlign = 'center';
          ctx.fillText(dTxt, lx, ly + 3);
        }
      });

      // Active Escape / Turnover Vector Arrow
      const vecCol = curActive.escapeOutcome === 'turnover_loss' ? '#ef4444' : '#facc15';
      ctx.strokeStyle = vecCol;
      ctx.lineWidth = isZoomed360 ? 3.2 : 2.6;
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.lineTo(ex, ey);
      ctx.stroke();

      const ang = escAng;
      const arrowLen = isZoomed360 ? 11 : 8;
      ctx.fillStyle = vecCol;
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex - Math.cos(ang - 0.45) * arrowLen, ey - Math.sin(ang - 0.45) * arrowLen);
      ctx.lineTo(ex - Math.cos(ang + 0.45) * arrowLen, ey - Math.sin(ang + 0.45) * arrowLen);
      ctx.closePath();
      ctx.fill();

      // Active Ball Carrier Node
      const heroR = isZoomed360 ? 9.5 : 6.4;
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(hx, hy, heroR, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2;
      ctx.stroke();

      if (isZoomed360) {
        ctx.font = '800 9.5px "JetBrains Mono", monospace';
        ctx.fillStyle = '#0f172a';
        ctx.textAlign = 'center';
        ctx.fillText(String(curActive.jerseyNumber || '8').slice(0, 2), hx, hy + 3.4);
      }

      // Floating Callout Pill in Heat mode (in all 360° modes, rendered cleanly in top-left HUD bar below)
      if (stageMode !== 'pitch_360') {
        const prog = sliceNetProgressionM(curActive);
        const tagText = `[${curActive.clock}] #${curActive.jerseyNumber || '8'} ${curActive.playerName.split(' ')[0]} · 贴防${curActive.minDefDistM}m · ΔX ${prog >= 0 ? '+' : ''}${prog}m`;
        ctx.font = '600 10.5px "Inter", "Noto Sans SC", sans-serif';
        const tw = ctx.measureText(tagText).width + 12;
        const tx = clamp(hx - tw * 0.5, ox + 6, ox + pw - tw - 6);
        const ty = hy > oy + 35 ? hy - 25 : hy + 14;
        ctx.fillStyle = 'rgba(10, 16, 28, 0.92)';
        ctx.strokeStyle = 'rgba(250, 204, 21, 0.85)';
        ctx.lineWidth = 1.1;
        ctx.fillRect(tx, ty, tw, 19);
        ctx.strokeRect(tx, ty, tw, 19);
        ctx.fillStyle = '#fef08a';
        ctx.textAlign = 'left';
        ctx.fillText(tagText, tx + 6, ty + 13.5);
      }
    }

    ctx.restore();

    // Outer tactical board frame border
    ctx.strokeStyle = isZoomed360 ? 'rgba(56, 189, 248, 0.45)' : 'rgba(226, 232, 240, 0.35)';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(ox, oy, pw, ph);

    // Empty-Filter Tactical Board Callout (when 0 slices match current filter criteria)
    if (!curActive && filtered.length === 0) {
      const msg = '当前筛选条件命中 0 条切片 · 请调整筛选或点击左侧「重置筛选」';
      ctx.font = '600 11.5px "Inter", "Noto Sans SC", sans-serif';
      const mw = Math.min(pw - 24, ctx.measureText(msg).width + 28);
      const mh = 34;
      const mxBox = ox + (pw - mw) * 0.5;
      const myBox = oy + (ph - mh) * 0.5;
      ctx.fillStyle = 'rgba(9, 15, 28, 0.92)';
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.50)';
      ctx.lineWidth = 1.2;
      ctx.fillRect(mxBox, myBox, mw, mh);
      ctx.strokeRect(mxBox, myBox, mw, mh);
      ctx.fillStyle = '#e2e8f0';
      ctx.textAlign = 'center';
      ctx.fillText(msg, ox + pw * 0.5, myBox + 21);
    }

    // Unclipped HUD Badges in 360° Mode (Top-left active callout + Top-right scale + Bottom-left space evaluation)
    if (stageMode === 'pitch_360' && curActive) {
      const prog = sliceNetProgressionM(curActive);
      const tagText = `[${curActive.clock}] #${curActive.jerseyNumber || '8'} ${curActive.playerName.split(' ')[0]} · 贴防${curActive.minDefDistM}m · ΔX ${prog >= 0 ? '+' : ''}${prog}m`;
      ctx.font = '600 10.5px "Inter", "Noto Sans SC", sans-serif';
      const tw = ctx.measureText(tagText).width + 14;
      ctx.fillStyle = 'rgba(10, 16, 28, 0.92)';
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.85)';
      ctx.lineWidth = 1.1;
      ctx.fillRect(ox + 8, oy + 8, tw, 19);
      ctx.strokeRect(ox + 8, oy + 8, tw, 19);
      ctx.fillStyle = '#fef08a';
      ctx.textAlign = 'left';
      ctx.fillText(tagText, ox + 15, oy + 21);

      const zHud = isZoomed360 ? '🔍 2.2x 战术特写 · 5m 网格' : '🏟️ 1.0x 全场鸟瞰 · 105m';
      ctx.font = '600 10px "Inter", "Noto Sans SC", monospace';
      const zw = ctx.measureText(zHud).width + 14;
      ctx.fillStyle = 'rgba(7, 13, 24, 0.86)';
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
      ctx.lineWidth = 1;
      ctx.fillRect(ox + pw - zw - 8, oy + 8, zw, 19);
      ctx.strokeRect(ox + pw - zw - 8, oy + 8, zw, 19);
      ctx.fillStyle = '#7dd3fc';
      ctx.textAlign = 'left';
      ctx.fillText(zHud, ox + pw - zw - 1, oy + 21);

      const laneHud = `360° 空间评估：${curActive.presserCount} 名逼抢人施压 · 开放出球点 ${openLaneCount} 处 · 被遮蔽通道 ${blockedLaneCount} 处`;
      ctx.font = '600 10.5px "Inter", "Noto Sans SC", sans-serif';
      const lw = ctx.measureText(laneHud).width + 16;
      ctx.fillStyle = 'rgba(7, 13, 24, 0.90)';
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.50)';
      ctx.lineWidth = 1;
      ctx.fillRect(ox + 8, oy + ph - 26, lw, 20);
      ctx.strokeRect(ox + 8, oy + ph - 26, lw, 20);
      ctx.fillStyle = '#e0f2fe';
      ctx.textAlign = 'left';
      ctx.fillText(laneHud, ox + 16, oy + ph - 12.5);
    }
  }

  pitchCanvas.addEventListener('click', (e) => {
    const rect = pitchCanvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    // 1. Check clickable pitch zone HUD pills FIRST so underlying dots never hijack direct pill clicks
    for (const zb of pitchZoneHitBoxes) {
      if (mx >= zb.x && mx <= zb.x + zb.w && my >= zb.y && my <= zb.y + zb.h) {
        filters.pitchZone = filters.pitchZone === zb.zoneKey ? 'ALL' : zb.zoneKey;
        renderAll();
        return;
      }
    }

    // 2. Check slice dot hit
    let best = null;
    let bestD = 14;
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
  });

  pitchCanvas.addEventListener('mousemove', (e) => {
    const rect = pitchCanvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const overZone = pitchZoneHitBoxes.some((zb) => mx >= zb.x && mx <= zb.x + zb.w && my >= zb.y && my <= zb.y + zb.h);
    const overDot = !overZone && pitchHitPoints.some((pt) => Math.hypot(pt.x - mx, pt.y - my) < 14);
    pitchCanvas.style.cursor = overZone || overDot ? 'pointer' : 'default';
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
    } else if (e.key === 's' || e.key === 'S') {
      e.preventDefault();
      toggleSliceStar();
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
  syncStageChrome();

  return {
    onShow() {
      syncStageChrome();
      renderAll();
    },
    onHide() {
      sliceVideoEl.pause();
    },
    selectMatch,
    setStageMode,
    stepSlice,
    togglePlaylistMode,
    toggleSliceStar,
    trimActiveSlice,
    createManualSliceAtCurrentTime,
    deleteActiveSlice,
    setMinuteRange(range = null) {
      filters.minuteRange = Array.isArray(range) && range.length === 2 ? [Number(range[0]), Number(range[1])] : null;
      renderAll();
      return this.getSummary();
    },
    set360Zoom(val) {
      zoom360Tactical = Boolean(val);
      syncStageChrome();
      if (stageMode !== 'diagnosis') drawPitchCanvas();
      return zoom360Tactical;
    },
    setDiagCompactDock(val) {
      diagCompactDock = Boolean(val);
      syncStageChrome();
      return diagCompactDock;
    },
    getOrderedTeamTabs() {
      return getOrderedTeams(getActiveMatch());
    },
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
        orderedTeams: getOrderedTeams(m),
        stageMode,
        zoom360Tactical,
        diagCompactDock,
        playlistAutoAdvance,
        totalSlices: m.slices.length,
        filteredSlices: filtered.length,
        starredCount: m.slices.filter((s) => s.starred).length,
        filters: { ...filters },
        groupByMode,
        activeSlice: active
          ? {
              id: active.id,
              index: active.index,
              clock: active.clock,
              team: active.team,
              playerName: active.playerName,
              jerseyNumber: active.jerseyNumber,
              starred: Boolean(active.starred),
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
