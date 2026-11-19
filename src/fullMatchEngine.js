/**
 * src/fullMatchEngine.js
 *
 * Greenfield v2 Full-Match Pressing Slicer, Tactical Analytics Engine & 3D White-Model Bridge:
 *   1. `scanLocalMatchVideoInBrowser(file, opts, onProgress)`:
 *      Two-Pass Coarse-to-Fine client-side HTML5 Video + Canvas 2D CV scanner featuring:
 *      - Configurable time window (`startSec`..`endSec`) & sampling precision (`0.5s` / `1.0s` / `2.0s`)
 *      - HSV green turf mask + Dual-Team Jersey Chromatic Contrast (异色球衣对抗度) + local motion flux
 *      - Pass-2 local peak refinement (`±2.0s @ 0.45s`) for accurate In/Out trim windows & directional escape vectors
 *   2. `computeFullMatchAnalytics(match, slices, taxonomy)`:
 *      Pure tactical analytics kernel computing Team-vs-Team Pressing Duels, 2D Press×Outcome Cross-Matrix,
 *      Pitch-Zone Escape Breakdown, 15-Minute Tempo Waves, Player Press-Resistance Leaderboard, and Auto-Insights.
 *   3. `buildMatchScoutingReportMarkdown(match, slices, taxonomy)`:
 *      Exports a publication-ready Markdown tactical scouting brief for coaches/players.
 *   4. `buildDynamic3DScenarioFromSlice(slice, matchMeta, taxonomy)`:
 *      Synthesizes a live Babylon.js 3D Scenario + C2-Inertialized 65-Bone Atomic Action Sequence at the
 *      exact stadium `[x, z]` coordinates of ANY full-match pressing slice (including turnover counter-examples).
 */

import { SCENARIO_ASSEMBLED_SEQUENCES } from './assembledSequences.js';

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function rgbToHsv(r, g, b) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d > 1e-5) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  return [h, s, max];
}

export function sliceNetProgressionM(slice) {
  if (!slice?.pitchXY || !slice?.exitXY) return 0;
  return Number((Number(slice.exitXY[0] || 0) - Number(slice.pitchXY[0] || 0)).toFixed(1));
}

export function parseClockToSeconds(clockStr, fallbackSec = 0) {
  if (typeof clockStr === 'string' && clockStr.includes(':')) {
    const parts = clockStr.split(':').map((n) => parseInt(n, 10) || 0);
    if (parts.length >= 2) return parts[0] * 60 + parts[1];
  }
  return Number(fallbackSec || 0);
}

/**
 * Analyze a single 160x90 RGBA frame for:
 *  - Broadcast turf ratio
 *  - 6x4 spatial athlete occupancy
 *  - Dual-Team Chromatic Contrast (distinct opposing jersey hue/luma bins in each cell)
 *  - Local motion flux against previous frame
 */
function analyzeCanvasFrameFeatures(imgData, W, H, prevLuma) {
  const luma = new Float32Array(W * H);
  const GX = 6;
  const GY = 4;
  const cells = GX * GY;
  const gridNonTurf = new Float32Array(cells);
  const gridMotion = new Float32Array(cells);
  // 6 coarse kit color buckets per cell: [white/bright, dark/black, red/orange, yellow, blue, purple/other]
  const kitHist = new Float32Array(cells * 6);

  let turfCount = 0;

  for (let y = 0; y < H; y++) {
    const gy = Math.min(GY - 1, Math.floor((y / H) * GY));
    for (let x = 0; x < W; x++) {
      const idx = y * W + x;
      const p = idx * 4;
      const r = imgData[p];
      const g = imgData[p + 1];
      const b = imgData[p + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      luma[idx] = lum;

      const [h, s, v] = rgbToHsv(r, g, b);
      const isTurf = h >= 58 && h <= 165 && s >= 0.14 && v >= 0.14 && g > r * 1.04;
      const gx = Math.min(GX - 1, Math.floor((x / W) * GX));
      const cIdx = gy * GX + gx;

      if (isTurf) {
        turfCount++;
      } else if (y >= 10 && y <= H - 8 && x >= 4 && x <= W - 4) {
        gridNonTurf[cIdx] += 1;
        // Classify jersey pixel into 6 chromatic buckets to detect opposing-kit collisions
        let bin = 5;
        if (s < 0.22) {
          bin = v >= 0.62 ? 0 : 1; // white/light vs black/navy
        } else if (h < 28 || h >= 330) {
          bin = 2; // red/orange
        } else if (h < 68) {
          bin = 3; // yellow/gold
        } else if (h >= 175 && h < 265) {
          bin = 4; // blue/cyan
        } else {
          bin = 5;
        }
        kitHist[cIdx * 6 + bin] += 1;
      }

      if (prevLuma) {
        gridMotion[cIdx] += Math.abs(lum - prevLuma[idx]) / 255;
      }
    }
  }

  const turfRatio = turfCount / (W * H);
  const isPitch = turfRatio >= 0.30 && turfRatio <= 0.92;
  let peakScore = 0;
  let bestGx = 0.5;
  let bestGy = 0.5;
  let bestPlayers = 1;
  let patchMotion = 0;
  let bestKitContrast = 0;
  let bestKitBin = 0;

  if (isPitch) {
    const cellArea = (W / GX) * (H / GY);
    for (let gy = 0; gy < GY; gy++) {
      for (let gx = 0; gx < GX; gx++) {
        const cIdx = gy * GX + gx;
        const nNon = gridNonTurf[cIdx];
        const occ = nNon / cellArea;
        const mot = gridMotion[cIdx] / cellArea;
        if (occ >= 0.04 && occ <= 0.54 && nNon >= 8) {
          // Compute opposing-kit chromatic contrast: 1 - maxBinShare (high when 2+ distinct kit hues collide)
          let maxBin = 0;
          let maxBinId = 0;
          let secondBin = 0;
          const base = cIdx * 6;
          for (let k = 0; k < 6; k++) {
            const cnt = kitHist[base + k];
            if (cnt > maxBin) {
              secondBin = maxBin;
              maxBin = cnt;
              maxBinId = k;
            } else if (cnt > secondBin) {
              secondBin = cnt;
            }
          }
          const oppKitBalance = secondBin / Math.max(1, maxBin); // 0..1 (peaks near 1 when 2 teams clash evenly)
          const kitContrast = clamp(oppKitBalance * (1 - maxBin / nNon) * 2.2, 0, 1);

          const sc = occ * 115 + mot * 185 + kitContrast * 34;
          if (sc > peakScore) {
            peakScore = sc;
            bestGx = (gx + 0.5) / GX;
            bestGy = (gy + 0.5) / GY;
            bestPlayers = clamp(Math.round(occ * 15 + kitContrast * 1.4), 1, 5);
            patchMotion = mot;
            bestKitContrast = kitContrast;
            bestKitBin = maxBinId;
          }
        }
      }
    }
  }

  return {
    luma,
    turfRatio,
    isPitch,
    pressScore: Math.min(99, peakScore),
    motion: patchMotion,
    kitContrast: Number(bestKitContrast.toFixed(2)),
    dominantKitBin: bestKitBin,
    cx: bestGx,
    cy: bestGy,
    players: bestPlayers
  };
}

/**
 * Pure In-Browser Two-Pass Full-Match MP4 / WebM Pressing Auto-Scanner.
 */
export async function scanLocalMatchVideoInBrowser(file, opts = {}, onProgress = null) {
  const blobUrl = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.src = blobUrl;

  await new Promise((resolve, reject) => {
    video.addEventListener('loadedmetadata', resolve, { once: true });
    video.addEventListener('error', () => reject(new Error('无法解码该视频文件，请使用 MP4 / WebM 格式')), {
      once: true
    });
  });

  const durationSec = video.duration || 0;
  if (durationSec < 2.0) {
    throw new Error('视频时长过短（需 >= 2 秒）');
  }

  const scanStartSec = clamp(Number(opts.startSec ?? 0), 0, Math.max(0, durationSec - 2));
  const scanEndSec = clamp(
    opts.endSec != null && opts.endSec > scanStartSec + 1 ? Number(opts.endSec) : durationSec,
    scanStartSec + 1.5,
    durationSec
  );
  const scanSpan = scanEndSec - scanStartSec;

  const W = 160;
  const H = 90;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  const thumbCanvas = document.createElement('canvas');
  thumbCanvas.width = 240;
  thumbCanvas.height = 135;
  const thumbCtx = thumbCanvas.getContext('2d');

  // Respect user-selected precision while capping browser seek budget cleanly
  const requestedStep = Number(opts.sampleStepSec || 0);
  const maxCoarseSteps = Number(opts.maxSamples || 540);
  const stepSec =
    requestedStep > 0
      ? Math.max(requestedStep, scanSpan / maxCoarseSteps)
      : clamp(scanSpan / clamp(Math.round(scanSpan / 1.0), 45, 360), 0.5, 4.0);
  const totalSteps = Math.max(1, Math.floor(scanSpan / stepSec));

  const seekAt = (t) =>
    new Promise((resolve) => {
      const onSeeked = () => {
        clearTimeout(timer);
        resolve();
      };
      const timer = setTimeout(() => {
        video.removeEventListener('seeked', onSeeked);
        resolve();
      }, 650);
      video.addEventListener('seeked', onSeeked, { once: true });
      video.currentTime = clamp(t, 0, Math.max(0, durationSec - 0.05));
    });

  // Pass 1: Coarse scan across requested window
  const samples = [];
  let prevLuma = null;
  let prevTurfRatio = 0;

  for (let i = 0; i <= totalSteps; i++) {
    if (opts.signal?.aborted) {
      throw new Error('SCAN_ABORTED');
    }
    const t = Math.min(scanEndSec - 0.05, scanStartSec + i * stepSec);
    await seekAt(t);
    ctx.drawImage(video, 0, 0, W, H);
    const img = ctx.getImageData(0, 0, W, H).data;
    const feat = analyzeCanvasFrameFeatures(img, W, H, prevLuma);
    const sceneCut = i > 0 && Math.abs(feat.turfRatio - prevTurfRatio) > 0.24;
    prevTurfRatio = feat.turfRatio;
    prevLuma = sceneCut ? null : feat.luma;

    samples.push({
      t: Number(t.toFixed(2)),
      isPitch: feat.isPitch,
      sceneCut,
      pressScore: feat.pressScore,
      motion: feat.motion,
      kitContrast: feat.kitContrast,
      dominantKitBin: feat.dominantKitBin,
      cx: feat.cx,
      cy: feat.cy,
      players: feat.players
    });

    if (onProgress && (i % 4 === 0 || i === totalSteps)) {
      onProgress(Math.round((i / totalSteps) * 72), samples.length, '第一阶段：全段球场草皮与异色球衣对抗扫描');
    }
  }

  // Adaptive threshold across broadcast pitch frames
  const pitchScores = samples.filter((s) => s.isPitch).map((s) => s.pressScore).sort((a, b) => a - b);
  const p60 = pitchScores.length > 0 ? pitchScores[Math.floor(pitchScores.length * 0.60)] : 36;
  const thresh = clamp(p60, 26, 70);

  const rawWindows = [];
  let cur = [];
  for (const s of samples) {
    if (s.sceneCut && cur.length > 0) {
      rawWindows.push(cur);
      cur = [];
    }
    if (s.isPitch && s.pressScore >= thresh) {
      cur.push(s);
    } else if (cur.length > 0) {
      rawWindows.push(cur);
      cur = [];
    }
  }
  if (cur.length > 0) rawWindows.push(cur);

  if (rawWindows.length === 0 && samples.length >= 2) {
    rawWindows.push(samples.slice(0, Math.min(samples.length, 6)));
  }

  // Rank & cap excessive candidate windows before Pass 2 refinement
  const maxSlices = Number(opts.maxSlices || 65);
  const rankedWindows =
    rawWindows.length > maxSlices
      ? rawWindows
          .map((w) => ({ w, peak: Math.max(...w.map((x) => x.pressScore)) }))
          .sort((a, b) => b.peak - a.peak)
          .slice(0, maxSlices)
          .sort((a, b) => a.w[0].t - b.w[0].t)
          .map((x) => x.w)
      : rawWindows;

  // Pass 2: Local Peak Refinement & High-Res Thumbnail Extraction
  const slices = [];
  for (let wi = 0; wi < rankedWindows.length; wi++) {
    if (opts.signal?.aborted) {
      throw new Error('SCAN_ABORTED');
    }
    let w = rankedWindows[wi];
    let peak = w.reduce((a, b) => (b.pressScore > a.pressScore ? b : a), w[0]);

    // When coarse step > 0.9s, refine ±1.8s around the peak at 0.45s resolution
    if (stepSec > 0.9) {
      const fine = [];
      let finePrevLuma = null;
      for (let dt = -1.8; dt <= 1.85; dt += 0.45) {
        const ft = clamp(peak.t + dt, scanStartSec, scanEndSec - 0.05);
        await seekAt(ft);
        ctx.drawImage(video, 0, 0, W, H);
        const fImg = ctx.getImageData(0, 0, W, H).data;
        const fFeat = analyzeCanvasFrameFeatures(fImg, W, H, finePrevLuma);
        finePrevLuma = fFeat.luma;
        if (fFeat.isPitch) {
          fine.push({
            t: Number(ft.toFixed(2)),
            pressScore: fFeat.pressScore,
            motion: fFeat.motion,
            kitContrast: fFeat.kitContrast,
            dominantKitBin: fFeat.dominantKitBin,
            cx: fFeat.cx,
            cy: fFeat.cy,
            players: fFeat.players
          });
        }
      }
      if (fine.length >= 2) {
        w = fine;
        peak = fine.reduce((a, b) => (b.pressScore > a.pressScore ? b : a), fine[0]);
      }
    }

    const t0 = Math.max(0, Number((w[0].t - 1.2).toFixed(2)));
    let t1 = Math.min(durationSec, Number((w[w.length - 1].t + 1.8).toFixed(2)));
    if (t1 - t0 < 3.2) t1 = Math.min(durationSec, Number((t0 + 4.5).toFixed(2)));
    t1 = Math.min(t1, Number((t0 + 9.5).toFixed(2)));
    if (t1 - t0 < 1.5) continue;
    if (slices.length > 0 && t0 < slices[slices.length - 1].tEnd - 0.5) continue;

    await seekAt(peak.t);
    thumbCtx.drawImage(video, 0, 0, 240, 135);
    const thumbDataUrl = thumbCanvas.toDataURL('image/jpeg', 0.72);

    const cx = peak.cx;
    const cy = peak.cy;
    const pitchZone =
      cy < 0.25 || cy > 0.78
        ? 'touchline_trap'
        : cx < 0.33
        ? 'buildup_back'
        : cx > 0.67
        ? 'zone14_halfspace'
        : 'midfield_hub';

    const pressType =
      pitchZone === 'buildup_back' && peak.players >= 2
        ? 'high_press'
        : peak.players >= 4
        ? 'cage_3plus'
        : peak.players >= 2
        ? 'double_trap'
        : '1v1_back';

    const dx = w[w.length - 1].cx - w[0].cx;
    const dy = w[w.length - 1].cy - w[0].cy;
    const disp = Math.hypot(dx, dy);
    const escapeOutcome =
      disp >= 0.20
        ? 'skill_dribble'
        : dx >= 0.07
        ? 'half_turn'
        : peak.motion >= 0.055
        ? 'one_touch_wall'
        : dx < -0.09
        ? 'turnover_loss'
        : 'recycle_shield';

    const playerRole = pitchZone === 'buildup_back' ? 'GK_DF' : pitchZone === 'zone14_halfspace' ? 'FW' : 'MF';
    const positionLabel = playerRole === 'GK_DF' ? '后卫 DF' : playerRole === 'FW' ? '前锋 FW' : '中场 MF';
    const xM = Number(clamp(cx * 105, 4, 101).toFixed(1));
    const yM = Number(clamp(cy * 68, 4, 64).toFixed(1));
    const exM = Number(clamp(w[w.length - 1].cx * 105, 3, 103).toFixed(1));
    const eyM = Number(clamp(w[w.length - 1].cy * 68, 3, 65).toFixed(1));
    const presserCount = clamp(peak.players, 1, 4);
    const minDist = Number(Math.max(0.80, 2.35 - presserCount * 0.32).toFixed(2));

    const mm = Math.floor(t0 / 60);
    const ss = Math.floor(t0 % 60);
    const idx = slices.length + 1;

    const opps = [];
    for (let k = 0; k < presserCount; k++) {
      const ang = (k / presserCount) * Math.PI * 1.3 - 0.5;
      opps.push({
        x: Number(clamp(xM + Math.cos(ang) * (minDist + k * 0.9), 2, 103).toFixed(1)),
        y: Number(clamp(yM + Math.sin(ang) * (minDist + k * 0.9), 2, 66).toFixed(1)),
        distM: Number((minDist + k * 0.5).toFixed(2)),
        gk: false
      });
    }

    const homeName = (opts.homeTeam || '主队(持球)').trim() || '主队(持球)';
    const awayName = (opts.awayTeam || '客队(逼抢)').trim() || '客队(逼抢)';

    slices.push({
      id: `local_s${String(idx).padStart(2, '0')}`,
      index: idx,
      clock: `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`,
      minute: mm,
      period: mm < 45 ? 1 : mm < 90 ? 2 : 3,
      tStart: t0,
      tEnd: t1,
      duration: Number((t1 - t0).toFixed(2)),
      team: homeName,
      teamKit: 'barca-home',
      oppTeam: awayName,
      oppKit: 'madrid-white',
      _dominantKitBin: peak.dominantKitBin ?? 0,
      playerName: playerRole === 'MF' ? '#8 中场枢纽' : playerRole === 'FW' ? '#9 锋线支点' : '#4 出球后卫',
      jerseyNumber: playerRole === 'MF' ? '8' : playerRole === 'FW' ? '9' : '4',
      playerRole,
      positionLabel,
      pressType,
      pitchZone,
      escapeOutcome,
      presserCount,
      minDefDistM: minDist,
      intensity: Math.round(clamp(peak.pressScore + 15, 55, 98)),
      kitContrast: peak.kitContrast || 0,
      pitchXY: [xM, yM],
      exitXY: [exM, eyM],
      freezeOpps: opps,
      freezeMates: [
        { x: Number(clamp(xM - 7, 4, 99).toFixed(1)), y: Number(clamp(yM + 6, 4, 64).toFixed(1)) },
        { x: Number(clamp(xM + 9, 4, 101).toFixed(1)), y: Number(clamp(yM - 7, 4, 64).toFixed(1)) }
      ],
      refScenarioIdx: 0,
      refVideoSrc: blobUrl,
      thumbnail: thumbDataUrl,
      summary: `本地视频两阶段自动切片 #${idx}（${t0.toFixed(1)}s–${t1.toFixed(1)}s）：约 ${presserCount} 人压迫合拢 · 球衣对抗度 ${Math.round((peak.kitContrast || 0.5) * 100)}%`
    });

    if (onProgress) {
      const pct = 72 + Math.round(((wi + 1) / Math.max(1, rankedWindows.length)) * 26);
      onProgress(pct, slices.length, `第二阶段：精修切片峰值与缩略图 (${wi + 1}/${rankedWindows.length})`);
    }
  }

  // Auto Dual-Team Assignment via top-2 dominant jersey chromatic bins across scanned slices
  const homeLabel = (opts.homeTeam || '主队(持球)').trim() || '主队(持球)';
  const awayLabel = (opts.awayTeam || '客队(逼抢)').trim() || '客队(逼抢)';
  if (slices.length >= 4) {
    const binCounts = new Map();
    for (const sl of slices) {
      binCounts.set(sl._dominantKitBin, (binCounts.get(sl._dominantKitBin) || 0) + 1);
    }
    const sortedBins = Array.from(binCounts.entries()).sort((a, b) => b[1] - a[1]);
    if (sortedBins.length >= 2) {
      const primaryHomeBin = sortedBins[0][0];
      for (const sl of slices) {
        if (sl._dominantKitBin !== primaryHomeBin) {
          sl.team = awayLabel;
          sl.oppTeam = homeLabel;
          sl.teamKit = 'madrid-white';
          sl.oppKit = 'barca-home';
        }
      }
    }
  }
  for (const sl of slices) delete sl._dominantKitBin;

  if (onProgress) onProgress(100, slices.length, '扫描、自动分队与四维归类完成');

  return {
    id: `local_video_${Date.now()}`,
    title: `本地录像 · ${file.name} (${slices.length}处持球逼抢自动切片)`,
    competition: '浏览器两阶段 WebCV 拆解',
    matchDate: new Date().toISOString().slice(0, 10),
    homeTeamZh: homeLabel,
    awayTeamZh: awayLabel,
    totalMinutes: Math.max(1, Math.ceil(durationSec / 60)),
    videoDurationSec: Number(durationSec.toFixed(2)),
    videoSrc: blobUrl,
    hasDirectFullVideo: true,
    kickoffOffsetSec: 0,
    sourceLabel: `浏览器两阶段自动扫描 (${stepSec.toFixed(1)}s 粗扫 + 0.45s 精修 · 自动分队)`,
    sliceCount: slices.length,
    slices
  };
}

/**
 * Pure Full-Match Tactical Analytics Kernel:
 * Computes Team-vs-Team Duels, 2D Cross-Matrix, Pitch-Zone Breakdown, 15-Min Tempo Waves,
 * Player Press-Resistance Leaderboard, and Auto-Generated Tactical Diagnosis Bullets.
 */
export function computeFullMatchAnalytics(match, slices, taxonomy) {
  const list = Array.isArray(slices) ? slices : [];
  const total = list.length;

  const summarizeGroup = (arr, name) => {
    const n = arr.length;
    const turnovers = arr.filter((s) => s.escapeOutcome === 'turnover_loss').length;
    const escaped = n - turnovers;
    const multi = arr.filter((s) => s.pressType !== '1v1_back').length;
    const highPress = arr.filter((s) => s.pressType === 'high_press').length;
    const avgDist =
      n > 0 ? Number((arr.reduce((a, s) => a + Number(s.minDefDistM || 1.5), 0) / n).toFixed(2)) : 0;
    const avgProg =
      n > 0 ? Number((arr.reduce((a, s) => a + sliceNetProgressionM(s), 0) / n).toFixed(1)) : 0;
    const avgInt =
      n > 0 ? Math.round(arr.reduce((a, s) => a + Number(s.intensity || 75), 0) / n) : 0;
    return {
      name,
      count: n,
      escaped,
      turnovers,
      escapeRate: n > 0 ? Math.round((escaped / n) * 100) : 0,
      multiPressRate: n > 0 ? Math.round((multi / n) * 100) : 0,
      highPressCount: highPress,
      avgMinDistM: avgDist,
      avgNetProgM: avgProg,
      avgIntensity: avgInt
    };
  };

  // 1. Team-vs-Team Head-to-Head Pressing Duel
  const homeName = match.homeTeamZh || list[0]?.team || '主队';
  const awayName = match.awayTeamZh || list.find((s) => s.team !== homeName)?.team || '客队';
  const homeSlices = list.filter((s) => s.team === homeName);
  const awaySlices = list.filter((s) => s.team === awayName && awayName !== homeName);
  const teamDuel = {
    hasTwoTeams: homeSlices.length > 0 && awaySlices.length > 0,
    home: summarizeGroup(homeSlices, homeName),
    away: summarizeGroup(awaySlices, awayName),
    overall: summarizeGroup(list, '全场合计')
  };

  // 2. Interactive 2D Cross-Matrix: Press Type (rows) × Escape Outcome (cols)
  const pressKeys = Object.keys(taxonomy.pressType.items);
  const outKeys = Object.keys(taxonomy.escapeOutcome.items);
  let matrixMaxCell = 1;
  const crossMatrixRows = pressKeys.map((pk) => {
    const rowSlices = list.filter((s) => s.pressType === pk);
    const rowTurnovers = rowSlices.filter((s) => s.escapeOutcome === 'turnover_loss').length;
    const cells = outKeys.map((ok) => {
      const cnt = rowSlices.filter((s) => s.escapeOutcome === ok).length;
      if (cnt > matrixMaxCell) matrixMaxCell = cnt;
      return { pressType: pk, escapeOutcome: ok, count: cnt };
    });
    return {
      pressType: pk,
      label: taxonomy.pressType.items[pk].label,
      color: taxonomy.pressType.items[pk].color,
      total: rowSlices.length,
      escapeRate: rowSlices.length > 0 ? Math.round(((rowSlices.length - rowTurnovers) / rowSlices.length) * 100) : 0,
      cells
    };
  });

  // 3. Pitch-Zone Breakdown (for both Pitch Zone Overlay and Diagnosis)
  const zoneKeys = Object.keys(taxonomy.pitchZone.items);
  const zoneStats = {};
  for (const zk of zoneKeys) {
    const zArr = list.filter((s) => s.pitchZone === zk);
    zoneStats[zk] = {
      key: zk,
      label: taxonomy.pitchZone.items[zk].label,
      color: taxonomy.pitchZone.items[zk].color,
      ...summarizeGroup(zArr, taxonomy.pitchZone.items[zk].label)
    };
  }

  // 4. 15-Minute Tempo & Momentum Duel Buckets
  const isExtraTime = (match.totalMinutes || 90) > 98;
  const bucketDefs = isExtraTime
    ? [
        { label: "0–15'", min0: 0, min1: 15 },
        { label: "15–30'", min0: 15, min1: 30 },
        { label: "30–45'", min0: 30, min1: 48 },
        { label: "45–60'", min0: 48, min1: 60 },
        { label: "60–75'", min0: 60, min1: 75 },
        { label: "75–90'", min0: 75, min1: 95 },
        { label: "90–105'", min0: 95, min1: 106 },
        { label: "105–120'", min0: 106, min1: 140 }
      ]
    : [
        { label: "0–15'", min0: 0, min1: 15 },
        { label: "15–30'", min0: 15, min1: 30 },
        { label: "30–45'", min0: 30, min1: 48 },
        { label: "45–60'", min0: 48, min1: 60 },
        { label: "60–75'", min0: 60, min1: 75 },
        { label: "75–90'+", min0: 75, min1: 120 }
      ];

  let tempoMax = 1;
  const tempoBuckets = bucketDefs.map((b) => {
    const inWin = list.filter((s) => {
      const m = parseClockToSeconds(s.clock, s.tStart) / 60;
      return m >= b.min0 && m < b.min1;
    });
    const hCnt = inWin.filter((s) => s.team === homeName).length;
    const aCnt = inWin.length - hCnt;
    const tCnt = inWin.filter((s) => s.escapeOutcome === 'turnover_loss').length;
    if (inWin.length > tempoMax) tempoMax = inWin.length;
    return {
      label: b.label,
      min0: b.min0,
      min1: b.min1,
      total: inWin.length,
      homeCount: hCnt,
      awayCount: aCnt,
      turnovers: tCnt
    };
  });

  // 5. Player Press-Resistance Leaderboard
  const playerMap = new Map();
  for (const s of list) {
    const key = `${s.playerName}||${s.team}`;
    if (!playerMap.has(key)) {
      playerMap.set(key, {
        playerName: s.playerName,
        jerseyNumber: s.jerseyNumber || '8',
        team: s.team,
        positionLabel: s.positionLabel || '',
        slices: []
      });
    }
    playerMap.get(key).slices.push(s);
  }

  const leaderboard = Array.from(playerMap.values())
    .map((entry) => {
      const st = summarizeGroup(entry.slices, entry.playerName);
      // Composite Press-Resistance Index (0..100): rewards escape rate, handling multi-man press, tight distance, forward progression & volume
      const score = Math.round(
        clamp(
          st.escapeRate * 0.48 +
            st.multiPressRate * 0.22 +
            clamp((2.6 - st.avgMinDistM) * 14, 0, 18) +
            clamp(st.avgNetProgM * 0.8 + 4, 0, 10) +
            Math.min(st.count, 8) * 1.1,
          20,
          99
        )
      );
      return {
        ...entry,
        ...st,
        pressIndex: score
      };
    })
    .sort((a, b) => b.count - a.count || b.pressIndex - a.pressIndex);

  // 6. Auto-Generated Tactical Scouting Diagnosis Bullets
  const insights = [];
  if (total > 0) {
    const peakTempo = tempoBuckets.reduce((a, b) => (b.total > a.total ? b : a), tempoBuckets[0]);
    if (peakTempo && peakTempo.total > 0) {
      insights.push(
        `🔥 逼抢峰值时段：${peakTempo.label} 共爆发 ${peakTempo.total} 处高压持球对抗（含 ${peakTempo.turnovers} 次被断失误），为全场攻防窒息度最高区间。`
      );
    }

    const activeZones = Object.values(zoneStats).filter((z) => z.count > 0);
    const riskZone = [...activeZones].sort(
      (a, b) => b.turnovers - a.turnovers || a.escapeRate - b.escapeRate || b.count - a.count
    )[0];
    if (riskZone) {
      insights.push(
        `⚠️ 高危压迫陷阱：「${riskZone.label}」累计触发 ${riskZone.count} 次压迫（破围率 ${riskZone.escapeRate}%，丢球 ${riskZone.turnovers} 次，平均净推进 ${riskZone.avgNetProgM >= 0 ? '+' : ''}${riskZone.avgNetProgM}m）。`
      );
    }

    const bestOut = outKeys
      .filter((k) => k !== 'turnover_loss')
      .map((k) => ({ key: k, label: taxonomy.escapeOutcome.items[k].label, count: list.filter((s) => s.escapeOutcome === k).length }))
      .sort((a, b) => b.count - a.count)[0];
    if (bestOut && bestOut.count > 0) {
      const share = Math.round((bestOut.count / total) * 100);
      insights.push(
        `🎯 首选破抢武器：全场最主要解围方式为「${bestOut.label}」（${bestOut.count} 次 · 占 ${share}%），整体抗压破围率 ${teamDuel.overall.escapeRate}%。`
      );
    }

    const mvp = leaderboard.find((p) => p.count >= 2) || leaderboard[0];
    if (mvp) {
      insights.push(
        `🏆 本场抗逼抢 MVP：#${mvp.jerseyNumber} ${mvp.playerName.split(' ')[0]}（${mvp.team}）承受 ${mvp.count} 次高压逼抢，破围率 ${mvp.escapeRate}% · 多人夹击占比 ${mvp.multiPressRate}% · 抗压指数 ${mvp.pressIndex}。`
      );
    }
  }

  return {
    total,
    teamDuel,
    crossMatrix: {
      cols: outKeys.map((k) => ({ key: k, ...taxonomy.escapeOutcome.items[k] })),
      rows: crossMatrixRows,
      maxCell: matrixMaxCell
    },
    zoneStats,
    tempo: {
      buckets: tempoBuckets,
      maxCount: tempoMax
    },
    leaderboard,
    insights
  };
}

/**
 * Generates a self-contained Coach-Ready Tactical Scouting Report (.md).
 */
export function buildMatchScoutingReportMarkdown(match, filteredSlices, taxonomy) {
  const analytics = computeFullMatchAnalytics(match, filteredSlices, taxonomy);
  const lines = [];
  lines.push(`# 整场比赛持球逼抢拆解与战术诊断报告`);
  lines.push(`- **比赛**：${match.title}`);
  lines.push(`- **赛事 / 来源**：${match.competition || ''} · ${match.sourceLabel || ''}`);
  lines.push(`- **统计切片数**：${filteredSlices.length} / ${match.slices.length} 处持球逼抢片段`);
  lines.push('');

  lines.push(`## 一、自动战术诊断要点`);
  analytics.insights.forEach((b) => lines.push(`- ${b}`));
  lines.push('');

  lines.push(`## 二、双方持球抗压对决总览`);
  lines.push(`| 维度 | ${analytics.teamDuel.home.name} | ${analytics.teamDuel.away.name} | 全场合计 |`);
  lines.push(`| :--- | :---: | :---: | :---: |`);
  const H = analytics.teamDuel.home;
  const A = analytics.teamDuel.away;
  const O = analytics.teamDuel.overall;
  lines.push(`| 遭遇持球逼抢次数 | ${H.count} | ${A.count} | ${O.count} |`);
  lines.push(`| 抗逼抢破围成功率 | ${H.escapeRate}% | ${A.escapeRate}% | ${O.escapeRate}% |`);
  lines.push(`| 被抢断丢球反例 | ${H.turnovers} | ${A.turnovers} | ${O.turnovers} |`);
  lines.push(`| 多人夹击 / 高位占比 | ${H.multiPressRate}% | ${A.multiPressRate}% | ${O.multiPressRate}% |`);
  lines.push(`| 平均最近贴防距离 | ${H.avgMinDistM}m | ${A.avgMinDistM}m | ${O.avgMinDistM}m |`);
  lines.push(`| 平均净推进距离 ΔX | ${H.avgNetProgM >= 0 ? '+' : ''}${H.avgNetProgM}m | ${A.avgNetProgM >= 0 ? '+' : ''}${A.avgNetProgM}m | ${O.avgNetProgM >= 0 ? '+' : ''}${O.avgNetProgM}m |`);
  lines.push('');

  lines.push(`## 三、逼抢形态 × 摆脱结果 交叉矩阵`);
  lines.push(
    `| 逼抢形态 | ${analytics.crossMatrix.cols.map((c) => c.label).join(' | ')} | 合计 | 破围率 |`
  );
  lines.push(`| :--- | ${analytics.crossMatrix.cols.map(() => ':---:').join(' | ')} | :---: | :---: |`);
  for (const r of analytics.crossMatrix.rows) {
    lines.push(
      `| ${r.label} | ${r.cells.map((c) => c.count).join(' | ')} | ${r.total} | ${r.escapeRate}% |`
    );
  }
  lines.push('');

  lines.push(`## 四、全场球员抗逼抢排行榜 (Top 10)`);
  lines.push(`| 排名 | 球员 | 球队 | 承受逼抢 | 破围率 | 多人夹击比 | 平均贴防距 | 净推进 ΔX | 抗压指数 |`);
  lines.push(`| :---: | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |`);
  analytics.leaderboard.slice(0, 10).forEach((p, i) => {
    lines.push(
      `| ${i + 1} | #${p.jerseyNumber} ${p.playerName} | ${p.team} | ${p.count} | ${p.escapeRate}% | ${p.multiPressRate}% | ${p.avgMinDistM}m | ${p.avgNetProgM >= 0 ? '+' : ''}${p.avgNetProgM}m | **${p.pressIndex}** |`
    );
  });
  lines.push('');

  lines.push(`## 五、时间戳切片归类明细`);
  lines.push(`| # | 时刻 | 球队 | 球员 | 逼抢形态 | 发生区域 | 摆脱结果 | 最近贴防 | 净推进 | 战术摘要 |`);
  lines.push(`| :---: | :---: | :--- | :--- | :--- | :--- | :--- | :---: | :---: | :--- |`);
  for (const s of filteredSlices) {
    const pLbl = taxonomy.pressType.items[s.pressType]?.label || s.pressType;
    const zLbl = taxonomy.pitchZone.items[s.pitchZone]?.label || s.pitchZone;
    const oLbl = taxonomy.escapeOutcome.items[s.escapeOutcome]?.label || s.escapeOutcome;
    const prog = sliceNetProgressionM(s);
    lines.push(
      `| #${String(s.index).padStart(2, '0')} | ${s.clock} | ${s.team} | #${s.jerseyNumber || '8'} ${s.playerName} | ${pLbl} | ${zLbl} | ${oLbl} | ${s.minDefDistM}m | ${prog >= 0 ? '+' : ''}${prog}m | ${s.summary} |`
    );
  }
  lines.push('');
  return lines.join('\n');
}

/**
 * Generates an executable FFmpeg Cut-Up Batch Script (.sh) that slices the exact
 * currently filtered or starred shortlist from a local full-match MP4 and merges them
 * into a single halftime meeting reel.
 */
export function buildFfmpegCutupScript(match, filteredSlices) {
  const offset = Number(match.kickoffOffsetSec || 0);
  const srcHint = match._userBoundVideoName || 'full_match.mp4';
  const lines = [
    '#!/usr/bin/env bash',
    '# 自动生成的教练赛后/中场复盘视频剪辑包脚本 (FFmpeg Cut-Up Reel)',
    `# 比赛: ${match.title}`,
    `# 切片数: ${filteredSlices.length} | 开球偏移校准: ${offset >= 0 ? '+' : ''}${offset}s`,
    'set -euo pipefail',
    `INPUT_MP4="\${1:-${srcHint}}"`,
    'OUT_DIR="./cutup_clips"',
    'mkdir -p "$OUT_DIR"',
    'CONCAT_LIST="$OUT_DIR/concat_list.txt"',
    ': > "$CONCAT_LIST"',
    ''
  ];

  filteredSlices.forEach((s, idx) => {
    const t0 = Math.max(0, Number(s.tStart || parseClockToSeconds(s.clock, 0)) + offset);
    const dur = Math.max(2.0, Number(s.duration || (Number(s.tEnd || t0 + 4.5) - Number(s.tStart || t0))));
    const safeName = `clip_${String(idx + 1).padStart(2, '0')}_${s.clock.replace(':', 'm')}s_${s.pressType}_${s.escapeOutcome}.mp4`;
    lines.push(`# #${String(s.index).padStart(2, '0')} [${s.clock}] ${s.team} #${s.jerseyNumber || '8'} ${s.playerName} (${s.pressType} -> ${s.escapeOutcome})`);
    lines.push(`ffmpeg -y -ss ${t0.toFixed(2)} -i "$INPUT_MP4" -t ${dur.toFixed(2)} -c:v libx264 -preset fast -crf 20 -an "$OUT_DIR/${safeName}"`);
    lines.push(`echo "file '${safeName}'" >> "$CONCAT_LIST"`);
    lines.push('');
  });

  lines.push('# 合并全部精选切片为单个会议连播视频:');
  lines.push('ffmpeg -y -f concat -safe 0 -i "$CONCAT_LIST" -c copy "$OUT_DIR/coach_cutup_reel.mp4"');
  lines.push('echo "Done -> $OUT_DIR/coach_cutup_reel.mp4"');
  lines.push('');
  return lines.join('\n');
}

/**
 * Maps 105m x 68m tactical pitch coordinates to our Babylon.js Stadium coordinates:
 *   - Attacking Goal = Z: -34.0m, Halfway Line = Z: +8.0m, Defensive Goal = Z: +50.0m
 *   - Width X in [-25.0m, +25.0m]
 */
export function mapPitch105ToBabylonXZ(xM, yM) {
  const z = clamp(50.0 - (xM / 105.0) * 84.0, -31.5, 45.5);
  const x = clamp(((yM - 34.0) / 68.0) * 50.0, -24.5, 24.5);
  return [Number(x.toFixed(2)), Number(z.toFixed(2))];
}

/**
 * Synthesizes a complete 3D Scenario + C2-Inertialized 65-Bone Atomic Action Sequence
 * at the exact stadium coordinates of ANY full-match pressing slice!
 */
export function buildDynamic3DScenarioFromSlice(slice, matchMeta, taxonomy) {
  const dynId = `fullmatch-slice-${slice.id}`;
  const [hx, hz] = mapPitch105ToBabylonXZ(slice.pitchXY[0], slice.pitchXY[1]);
  const [exRaw, ezRaw] = mapPitch105ToBabylonXZ(slice.exitXY[0], slice.exitXY[1]);

  let dx = exRaw - hx;
  let dz = ezRaw - hz;
  let dist = Math.hypot(dx, dz);
  if (dist < 3.8) {
    const dirZ = slice.escapeOutcome === 'recycle_shield' ? 1 : -1;
    dx = slice.pitchZone === 'touchline_trap' ? (hx > 0 ? -3.2 : 3.2) : 1.8;
    dz = dirZ * 5.2;
    dist = Math.hypot(dx, dz);
  } else if (dist > 10.5) {
    const scale = 10.5 / dist;
    dx *= scale;
    dz *= scale;
  }

  const endX = Number(clamp(hx + dx, -25.5, 25.5).toFixed(2));
  const endZ = Number(clamp(hz + dz, -32.0, 46.5).toFixed(2));
  const exitYaw = Number(Math.atan2(endX - hx, endZ - hz).toFixed(3));
  const midX = Number((hx + (endX - hx) * 0.46).toFixed(2));
  const midZ = Number((hz + (endZ - hz) * 0.46).toFixed(2));

  const dur = clamp(Number(slice.duration || 5.2), 4.2, 7.2);
  const heroId = 'fm_hero';

  let heroSegments = [];
  if (slice.escapeOutcome === 'half_turn') {
    heroSegments = [
      {
        clipId: 'loco_walk_back',
        durationSec: Number((dur * 0.24).toFixed(2)),
        endFacingYaw: Number((exitYaw + Math.PI * 0.85).toFixed(3)),
        endAnchor: [Number((hx - dx * 0.06).toFixed(2)), Number((hz - dz * 0.06).toFixed(2))],
        note: '接球前背身回撤扫描'
      },
      {
        clipId: 'turn_shield_pivot_90_r',
        clipIn: 0.08,
        clipOut: 0.96,
        durationSec: Number((dur * 0.20).toFixed(2)),
        blendSec: 0.22,
        endFacingYaw: Number((exitYaw + 0.95).toFixed(3)),
        endAnchor: [hx, hz],
        note: '提前敞髋抗住贴防'
      },
      {
        clipId: 'touch_diag_take_r',
        clipIn: 0.04,
        clipOut: 0.84,
        durationSec: Number((dur * 0.20).toFixed(2)),
        blendSec: 0.20,
        endFacingYaw: Number((exitYaw + 0.35).toFixed(3)),
        endAnchor: [Number((hx + (endX - hx) * 0.24).toFixed(2)), Number((hz + (endZ - hz) * 0.24).toFixed(2))],
        note: '顺来球第一脚斜向领球'
      },
      {
        clipId: 'turn_tight_r',
        clipIn: 0.10,
        clipOut: 1.18,
        durationSec: Number((dur * 0.18).toFixed(2)),
        blendSec: 0.20,
        endFacingYaw: exitYaw,
        endAnchor: [midX, midZ],
        note: '紧凑半转身抹过逼抢人'
      },
      {
        clipId: 'loco_ball_run_fast',
        durationSec: Number((dur - dur * 0.82).toFixed(2)),
        blendSec: 0.20,
        endFacingYaw: exitYaw,
        endAnchor: [endX, endZ],
        note: '爆发带球脱离包围圈'
      }
    ];
  } else if (slice.escapeOutcome === 'skill_dribble') {
    const useRoulette = slice.pressType === 'cage_3plus';
    heroSegments = [
      {
        clipId: 'touch_cushion_step_r',
        clipIn: 0.08,
        clipOut: 1.15,
        durationSec: Number((dur * 0.24).toFixed(2)),
        endFacingYaw: exitYaw,
        endAnchor: [hx, hz],
        note: '逼抢圈内柔和停球观察'
      },
      {
        clipId: useRoulette ? 'skill_spin_break_l' : 'skill_croqueta_rl',
        clipIn: 0.06,
        clipOut: useRoulette ? 1.40 : 1.72,
        durationSec: Number((dur * 0.36).toFixed(2)),
        blendSec: 0.22,
        endFacingYaw: exitYaw,
        endAnchor: [midX, midZ],
        note: useRoulette ? '360°踩球回旋破多人合围' : '双足油炸丸子扣顺穿双人缝'
      },
      {
        clipId: 'loco_ball_run_fast',
        durationSec: Number((dur * 0.24).toFixed(2)),
        blendSec: 0.20,
        endFacingYaw: exitYaw,
        endAnchor: [endX, endZ],
        note: '加速突破压迫防线'
      },
      {
        clipId: 'kick_pass_inside_r',
        clipIn: 0.12,
        clipOut: 1.10,
        durationSec: Number((dur - dur * 0.84).toFixed(2)),
        blendSec: 0.20,
        endFacingYaw: exitYaw,
        endAnchor: [endX, endZ],
        note: '破围后推传转移'
      }
    ];
  } else if (slice.escapeOutcome === 'one_touch_wall') {
    heroSegments = [
      {
        clipId: 'loco_dribble_jog',
        durationSec: Number((dur * 0.25).toFixed(2)),
        endFacingYaw: exitYaw,
        endAnchor: [hx, hz],
        note: '迎球吸引逼抢收缩'
      },
      {
        clipId: 'kick_pass_inside_r',
        clipIn: 0.08,
        clipOut: 1.08,
        durationSec: Number((dur * 0.24).toFixed(2)),
        blendSec: 0.20,
        endFacingYaw: Number((exitYaw + 0.28).toFixed(3)),
        endAnchor: [Number((hx + (endX - hx) * 0.18).toFixed(2)), Number((hz + (endZ - hz) * 0.18).toFixed(2))],
        note: '不停球一脚顺势敲墙出球'
      },
      {
        clipId: 'loco_sprint_fwd',
        durationSec: Number((dur * 0.31).toFixed(2)),
        blendSec: 0.20,
        endFacingYaw: exitYaw,
        endAnchor: [endX, endZ],
        note: '敲球后无球前插反跑越过逼抢线'
      },
      {
        clipId: 'kick_through_ball_r',
        clipIn: 0.10,
        clipOut: 1.25,
        durationSec: Number((dur - dur * 0.80).toFixed(2)),
        blendSec: 0.22,
        endFacingYaw: exitYaw,
        endAnchor: [endX, endZ],
        note: '接回敲直塞打穿防线'
      }
    ];
  } else if (slice.escapeOutcome === 'turnover_loss') {
    heroSegments = [
      {
        clipId: 'loco_dribble_jog',
        durationSec: Number((dur * 0.28).toFixed(2)),
        endFacingYaw: exitYaw,
        endAnchor: [hx, hz],
        note: '低头带球进入对手包夹陷阱'
      },
      {
        clipId: 'turn_cut_90_r',
        clipIn: 0.08,
        clipOut: 1.15,
        durationSec: Number((dur * 0.26).toFixed(2)),
        blendSec: 0.20,
        endFacingYaw: Number((exitYaw - 0.55).toFixed(3)),
        endAnchor: [Number((hx + (endX - hx) * 0.22).toFixed(2)), Number((hz + (endZ - hz) * 0.22).toFixed(2))],
        note: '受迫趟球过大暴露球权'
      },
      {
        clipId: 'def_run_hard_stop_r',
        clipIn: 0.08,
        clipOut: 1.45,
        durationSec: Number((dur * 0.26).toFixed(2)),
        blendSec: 0.20,
        endFacingYaw: Number((exitYaw + Math.PI * 0.75).toFixed(3)),
        endAnchor: [Number((hx + (endX - hx) * 0.26).toFixed(2)), Number((hz + (endZ - hz) * 0.26).toFixed(2))],
        note: '对抗受阻失去球权急停回追'
      },
      {
        clipId: 'loco_sprint_fwd',
        durationSec: Number((dur - dur * 0.80).toFixed(2)),
        blendSec: 0.22,
        endFacingYaw: Number((exitYaw + Math.PI * 0.85).toFixed(3)),
        endAnchor: [hx, Number((hz + 2.4).toFixed(2))],
        note: '丢球后反抢回追 (反面教材)'
      }
    ];
  } else {
    heroSegments = [
      {
        clipId: 'touch_cushion_step_r',
        clipIn: 0.06,
        clipOut: 1.12,
        durationSec: Number((dur * 0.26).toFixed(2)),
        endFacingYaw: Number((exitYaw - 0.8).toFixed(3)),
        endAnchor: [hx, hz],
        note: '高压下稳健卸球卡住身位'
      },
      {
        clipId: 'turn_shield_pivot_180_l',
        clipIn: 0.08,
        clipOut: 1.48,
        durationSec: Number((dur * 0.34).toFixed(2)),
        blendSec: 0.22,
        endFacingYaw: exitYaw,
        endAnchor: [midX, midZ],
        note: '背身护球向安全侧转身摆脱顶防'
      },
      {
        clipId: 'kick_pass_inside_l',
        clipIn: 0.10,
        clipOut: 1.14,
        durationSec: Number((dur * 0.22).toFixed(2)),
        blendSec: 0.20,
        endFacingYaw: exitYaw,
        endAnchor: [endX, endZ],
        note: '稳妥回传/横敲弱侧重置球权'
      },
      {
        clipId: 'stance_ball_scan',
        durationSec: Number((dur - dur * 0.82).toFixed(2)),
        blendSec: 0.22,
        endFacingYaw: exitYaw,
        endAnchor: [endX, endZ],
        note: '出球后观察重组阵型'
      }
    ];
  }

  const seqMap = {
    [heroId]: {
      id: `seq_${dynId}_hero`,
      startX: hx,
      startZ: hz,
      startYaw: heroSegments[0].endFacingYaw,
      segments: heroSegments
    }
  };

  const actors = [
    {
      id: heroId,
      role: 'pedri',
      kit: slice.teamKit || 'barca-home',
      number: String(slice.jerseyNumber || '8'),
      shirtName: (slice.playerName || 'HERO').split(' ').slice(-1)[0].toUpperCase().slice(0, 10),
      label: `#${slice.jerseyNumber || '8'} ${slice.playerName}`,
      keyframes: [
        { t: 0, x: hx, z: hz, yaw: exitYaw, scanYaw: 0.45 },
        { t: dur * 0.4, x: midX, z: midZ, yaw: exitYaw, scanYaw: -0.25 },
        { t: dur, x: endX, z: endZ, yaw: exitYaw, scanYaw: 0 }
      ]
    }
  ];

  const opps = (slice.freezeOpps || []).slice(0, 3);
  opps.forEach((op, idx) => {
    const [oxRaw, ozRaw] = mapPitch105ToBabylonXZ(op.x, op.y);
    let odx = oxRaw - hx;
    let odz = ozRaw - hz;
    const od = Math.hypot(odx, odz) || 1;
    const clampedD = clamp(od, 1.35 + idx * 0.55, 5.2);
    const ox = Number((hx + (odx / od) * clampedD).toFixed(2));
    const oz = Number((hz + (odz / od) * clampedD).toFixed(2));
    const startOx = Number((ox + (odx / od) * 1.8).toFixed(2));
    const startOz = Number((oz + (odz / od) * 1.8).toFixed(2));
    const chaseYaw = Number(Math.atan2(hx - startOx, hz - startOz).toFixed(3));
    const defId = `fm_def_${idx + 1}`;

    actors.push({
      id: defId,
      role: 'defender',
      kit: slice.oppKit || 'madrid-white',
      number: String(idx === 0 ? 6 : idx === 1 ? 14 : 5),
      shirtName: `PRESS ${idx + 1}`,
      label: `${slice.oppTeam} 逼抢#${idx + 1} (${op.distM}m)`,
      keyframes: [
        { t: 0, x: startOx, z: startOz, yaw: chaseYaw, showShadow: true },
        { t: dur * 0.5, x: ox, z: oz, yaw: chaseYaw, showShadow: true },
        { t: dur, x: midX, z: midZ, yaw: exitYaw, showShadow: true }
      ]
    });

    if (idx === 0 && slice.escapeOutcome === 'turnover_loss') {
      const counterX = Number(clamp(hx - dx * 0.9, -24, 24).toFixed(2));
      const counterZ = Number(clamp(hz - dz * 0.9, -31, 46).toFixed(2));
      const counterYaw = Number(Math.atan2(counterX - ox, counterZ - oz).toFixed(3));
      seqMap[defId] = {
        id: `seq_${dynId}_${defId}`,
        startX: startOx,
        startZ: startOz,
        startYaw: chaseYaw,
        segments: [
          {
            clipId: 'loco_sprint_fwd',
            durationSec: Number((dur * 0.44).toFixed(2)),
            endFacingYaw: chaseYaw,
            endAnchor: [ox, oz],
            note: '上抢封堵持球路线'
          },
          {
            clipId: 'touch_diag_take_l',
            durationSec: Number((dur * 0.22).toFixed(2)),
            blendSec: 0.20,
            endFacingYaw: counterYaw,
            endAnchor: [Number((hx + (endX - hx) * 0.22).toFixed(2)), Number((hz + (endZ - hz) * 0.22).toFixed(2))],
            note: '卡位断下球权'
          },
          {
            clipId: 'loco_ball_run_fast',
            durationSec: Number((dur - dur * 0.66).toFixed(2)),
            blendSec: 0.20,
            endFacingYaw: counterYaw,
            endAnchor: [counterX, counterZ],
            note: '断球就地发起反击'
          }
        ]
      };
    } else {
      const overshootX = Number((ox - (odx / od) * 1.15).toFixed(2));
      const overshootZ = Number((oz - (odz / od) * 1.15).toFixed(2));
      seqMap[defId] = {
        id: `seq_${dynId}_${defId}`,
        startX: startOx,
        startZ: startOz,
        startYaw: chaseYaw,
        segments: [
          {
            clipId: 'loco_sprint_fwd',
            durationSec: Number((dur * 0.42).toFixed(2)),
            endFacingYaw: chaseYaw,
            endAnchor: [ox, oz],
            note: '高速合拢压迫半径'
          },
          {
            clipId: idx % 2 === 0 ? 'def_press_brake_r' : 'def_bite_feint_l',
            durationSec: Number((dur * 0.32).toFixed(2)),
            blendSec: 0.22,
            endFacingYaw: chaseYaw,
            endAnchor: [overshootX, overshootZ],
            note: '被假动作/变向诱导急刹失位'
          },
          {
            clipId: 'loco_dribble_jog',
            durationSec: Number((dur - dur * 0.74).toFixed(2)),
            blendSec: 0.22,
            endFacingYaw: exitYaw,
            endAnchor: [midX, midZ],
            note: '转身回追'
          }
        ]
      };
    }
  });

  const mate = (slice.freezeMates || [])[0];
  const [mxRaw, mzRaw] = mate ? mapPitch105ToBabylonXZ(mate.x, mate.y) : [endX + 3.5, endZ - 2.5];
  const mx = Number(clamp(mxRaw, -24, 24).toFixed(2));
  const mz = Number(clamp(mzRaw, -31, 45).toFixed(2));
  actors.push({
    id: 'fm_mate_1',
    role: 'teammate',
    kit: slice.teamKit || 'barca-home',
    number: '10',
    shirtName: 'SUPPORT',
    label: `${slice.team} 接应支点`,
    keyframes: [
      { t: 0, x: mx, z: mz, yaw: Math.atan2(hx - mx, hz - mz) },
      { t: dur, x: Number(clamp(mx + dx * 0.35, -24, 24).toFixed(2)), z: Number(clamp(mz + dz * 0.35, -31, 45).toFixed(2)), yaw: exitYaw }
    ],
    mocapSchedule: [{ start: 0, end: dur, clip: 'jog_fwd', rate: 0.9 }]
  });

  SCENARIO_ASSEMBLED_SEQUENCES[dynId] = seqMap;

  let ballTrack = [];
  if (slice.escapeOutcome === 'one_touch_wall') {
    ballTrack = [
      { t: 0, x: hx - Math.sin(exitYaw) * 2.2, y: 0.115, z: hz - Math.cos(exitYaw) * 2.2 },
      { t: Number((dur * 0.28).toFixed(2)), x: hx + 0.22, y: 0.115, z: hz + 0.22 },
      { t: Number((dur * 0.52).toFixed(2)), x: mx, y: 0.115, z: mz },
      { t: Number((dur * 0.78).toFixed(2)), x: endX + Math.sin(exitYaw) * 0.4, y: 0.115, z: endZ + Math.cos(exitYaw) * 0.4 },
      { t: dur, x: clamp(endX + Math.sin(exitYaw) * 5.5, -25, 25), y: 0.115, z: clamp(endZ + Math.cos(exitYaw) * 5.5, -33, 47) }
    ];
  } else if (slice.escapeOutcome === 'turnover_loss') {
    const counterX = clamp(hx - dx * 0.95, -24, 24);
    const counterZ = clamp(hz - dz * 0.95, -31, 46);
    ballTrack = [
      { t: 0, x: hx + 0.25, y: 0.115, z: hz + 0.25 },
      { t: Number((dur * 0.46).toFixed(2)), x: hx + (endX - hx) * 0.24, y: 0.115, z: hz + (endZ - hz) * 0.24 },
      { t: Number((dur * 0.66).toFixed(2)), x: hx - dx * 0.25, y: 0.115, z: hz - dz * 0.25 },
      { t: dur, x: counterX, y: 0.115, z: counterZ }
    ];
  } else if (slice.escapeOutcome === 'recycle_shield') {
    ballTrack = [
      { t: 0, x: hx + 0.28, y: 0.115, z: hz + 0.28 },
      { t: Number((dur * 0.58).toFixed(2)), x: midX + 0.25, y: 0.115, z: midZ + 0.25 },
      { t: dur, x: mx, y: 0.115, z: mz }
    ];
  } else {
    ballTrack = [
      { t: 0, x: hx - Math.sin(exitYaw) * 1.8, y: 0.32, z: hz - Math.cos(exitYaw) * 1.8 },
      { t: Number((dur * 0.32).toFixed(2)), x: hx + Math.sin(exitYaw) * 0.35, y: 0.115, z: hz + Math.cos(exitYaw) * 0.35 },
      { t: Number((dur * 0.65).toFixed(2)), x: midX + Math.sin(exitYaw) * 0.42, y: 0.115, z: midZ + Math.cos(exitYaw) * 0.42 },
      { t: dur, x: endX + Math.sin(exitYaw) * 0.55, y: 0.115, z: endZ + Math.cos(exitYaw) * 0.55 }
    ];
  }

  const pressLabel = taxonomy.pressType.items[slice.pressType]?.label || slice.pressType;
  const zoneLabel = taxonomy.pitchZone.items[slice.pitchZone]?.label || slice.pitchZone;
  const outLabel = taxonomy.escapeOutcome.items[slice.escapeOutcome]?.label || slice.escapeOutcome;

  const sideCamSign = hx > 12 ? -1 : 1;
  const camTrack = [
    {
      t: 0,
      pos: [hx + sideCamSign * 11.5, 3.6, hz + 3.2],
      target: [hx, 0.92, hz],
      fov: 26
    },
    {
      t: Number((dur * 0.55).toFixed(2)),
      pos: [midX + sideCamSign * 10.8, 3.3, midZ + 2.8],
      target: [midX, 0.90, midZ],
      fov: 25
    },
    {
      t: dur,
      pos: [endX + sideCamSign * 11.5, 3.6, endZ + 3.0],
      target: [endX, 0.92, endZ],
      fov: 26
    }
  ];

  return {
    id: dynId,
    index: `FM${String(slice.index).padStart(2, '0')}`,
    positionGroup: slice.playerRole === 'GK_DF' ? 'DF' : slice.playerRole === 'FW' ? 'FW' : 'MF',
    positionLabel: slice.positionLabel || '中场 MF',
    starName: `#${slice.jerseyNumber || '8'} ${slice.playerName}`,
    durationSec: dur,
    title: `[${slice.clock}] ${slice.playerName} · ${zoneLabel} × ${pressLabel}`,
    moveName: `四维归类：${pressLabel} · ${zoneLabel} · ${outLabel}`,
    zoneTag: `${slice.clock} · ${zoneLabel}`,
    matchRef: `${matchMeta.title} · 切片 #${slice.index} (${slice.clock})`,
    pressureType: `${slice.oppTeam} ${slice.presserCount} 人逼抢合拢（最近间距 ${slice.minDefDistM}m · 压迫强度 ${slice.intensity}%）`,
    metrics: {
      touches: outLabel,
      feintAngle: `${pressLabel} (${slice.presserCount}人)`,
      scans: `最近压迫距 ${slice.minDefDistM}m`,
      escapeWindow: `${slice.duration}s (${slice.clock})`
    },
    keypoints: [
      `比赛时刻与空间坐标：${slice.clock}（第${slice.period}半场），发生于 ${zoneLabel}（球场坐标 [${slice.pitchXY[0]}m, ${slice.pitchXY[1]}m] ➔ [${slice.exitXY[0]}m, ${slice.exitXY[1]}m]）。`,
      `逼抢态势诊断：${slice.oppTeam} 局部 ${slice.presserCount} 名防守球员进入压迫半径，最近防守人贴近至 ${slice.minDefDistM}m（压迫强度 ${slice.intensity}%）。`,
      `动作组装重演：基于 86 组光学白模原子动作库自动匹配「${outLabel}」C2 惯性动作链，复现 360° 空间关系。`
    ],
    phases: heroSegments.map((seg, i) => {
      const prevDur = heroSegments.slice(0, i).reduce((acc, s) => acc + s.durationSec, 0);
      const t0 = Number(prevDur.toFixed(2));
      const t1 = Number((prevDur + seg.durationSec).toFixed(2));
      return {
        timeRange: [t0, t1],
        label: `${t0.toFixed(1)}–${t1.toFixed(1)}s ${seg.note}`,
        desc: `${slice.summary} —— 当前执行白模原子动作 [${seg.clipId}]。`
      };
    }),
    defaultFocus: [midX, 0, midZ],
    camTrack,
    actors,
    ballTrack,
    pedriRibbon: [
      [hx, 0.06, hz],
      [midX, 0.06, midZ],
      [endX, 0.06, endZ]
    ],
    overshootRibbon: opps.length > 0 ? [[hx, 0.05, hz], [endX, 0.05, endZ]] : [],
    _fullMatchSlice: slice,
    _fullMatchMeta: matchMeta
  };
}
