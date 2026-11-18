#!/usr/bin/env python3
"""
scripts/build_full_match_samples.py

Fetches real 90/120-minute match event streams + 360° player-tracking freeze-frames
from StatsBomb Open Data (`hudl/open-data`) and compiles canonical 4-dimensional
Full-Match Pressing Breakdown datasets (`src/fullMatchSamples.js`), alongside our
frame-accurate real-MP4 continuous reel breakdown (`zhibo8_pedri_all_8_clips.mp4`).
"""

import json
import math
import subprocess
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
OUT_JS = REPO_ROOT / "src" / "fullMatchSamples.js"

PLAYER_ZH_MAP = {
    "Pedro González López": "佩德里 Pedri",
    "Lionel Andrés Messi Cuccittini": "梅西 Messi",
    "Frenkie de Jong": "德容 F. de Jong",
    "Sergio Busquets i Burgos": "布斯克茨 Busquets",
    "Jordi Alba Ramos": "阿尔巴 Jordi Alba",
    "Ousmane Dembélé": "登贝莱 Dembélé",
    "Ronald Federico Araújo da Silva": "阿劳霍 Araújo",
    "Óscar Mingueza García": "明格萨 Mingueza",
    "Clément Lenglet": "朗格莱 Lenglet",
    "Sergiño Gianni Dest": "德斯特 Dest",
    "Marc-André ter Stegen": "特尔施特根 Ter Stegen",
    "Antoine Griezmann": "格列兹曼 Griezmann",
    "Ilaix Moriba Kourouma Kourouma": "莫里巴 Moriba",
    "Francisco António Machado Mota de Castro Trincão": "特林康 Trincão",
    "Luka Modrić": "莫德里奇 Modrić",
    "Toni Kroos": "克罗斯 Kroos",
    "Carlos Henrique Casimiro": "卡塞米罗 Casemiro",
    "Vinícius José Paixão de Oliveira Júnior": "维尼修斯 Vinícius Jr",
    "Karim Benzema": "本泽马 Benzema",
    "Federico Santiago Valverde Dipetta": "巴尔韦德 Valverde",
    "Lucas Vázquez Iglesias": "巴斯克斯 L. Vázquez",
    "Ferland Mendy": "门迪 F. Mendy",
    " José Ignacio Fernández Iglesias": "纳乔 Nacho",
    "José Ignacio Fernández Iglesias": "纳乔 Nacho",
    "Éder Gabriel Militão": "米利唐 Militão",
    "Thibaut Courtois": "库尔图瓦 Courtois",
    "Marco Asensio Willemsen": "阿森西奥 Asensio",
    "Marcelo Vieira da Silva Júnior": "马塞洛 Marcelo",
    "isco": "伊斯科 Isco",
    "Francisco Román Alarcón Suárez": "伊斯科 Isco",
    "Álvaro Odriozola Arzallus": "奥德里奥索拉 Odriozola",
    # Euro 2024 Spain vs Germany
    "Lamine Yamal Nasraoui Ebana": "亚马尔 Yamal",
    "Rodrigo Hernández Cascante": "罗德里 Rodri",
    "Fabián Ruiz Peña": "法比安 Fabián Ruiz",
    "Daniel Olmo Carvajal": "奥尔莫 Dani Olmo",
    "Nicholas Williams Arthuer": "尼科·威廉姆斯 Nico",
    "Álvaro Borja Morata Martín": "莫拉塔 Morata",
    "Daniel Carvajal Ramos": "卡瓦哈尔 Carvajal",
    "Marc Cucurella Saseta": "库库雷利亚 Cucurella",
    "Robin Aime Robert Le Normand": "勒诺尔芒 Le Normand",
    "Aymeric Laporte": "拉波尔特 Laporte",
    "Unai Simón Mendibil": "乌奈·西蒙 Unai Simón",
    "Mikel Merino Zazón": "梅里诺 Merino",
    "Mikel Oyarzabal Ugarte": "奥亚萨瓦尔 Oyarzabal",
    "Ferran Torres García": "费兰·托雷斯 Ferran",
    " José Luis Mato Sanmartín": "何塞卢 Joselu",
    "Nacho": "纳乔 Nacho",
    "Jamal Musiala": "穆西亚拉 Musiala",
    "Florian Richard Wirtz": "维尔茨 Wirtz",
    "İlkay Gündoğan": "京多安 Gündoğan",
    "Joshua Walter Kimmich": "基米希 Kimmich",
    "Kai Lukas Havertz": "哈弗茨 Havertz",
    "Antonio Rüdiger": "吕迪格 Rüdiger",
    "Jonathan Tah": "若纳坦·塔 Tah",
    "David Raum": "劳姆 Raum",
    "Manuel Neuer": "诺伊尔 Neuer",
    "Robert Andrich": "安德里希 Andrich",
    "Emre Can": "埃姆雷·詹 Emre Can",
    "Leroy Sané": "萨内 Sané",
    "Niclas Füllkrug": "菲尔克鲁格 Füllkrug",
    "Thomas Müller": "托马斯·穆勒 Müller",
    "Maximilian Mittelstädt": "米特尔施泰特 Mittelstädt",
}

TEAM_ZH_MAP = {
    "Barcelona": "巴塞罗那",
    "Real Madrid": "皇家马德里",
    "Spain": "西班牙",
    "Germany": "德国",
}

TEAM_KIT_MAP = {
    "Barcelona": "barca-home",
    "Real Madrid": "madrid-white",
    "Spain": "spain-red",
    "Germany": "madrid-white",
}


def gh_json(repo_path: str):
    raw = subprocess.check_output(
        [
            "gh",
            "api",
            f"repos/hudl/open-data/contents/{repo_path}",
            "-H",
            "Accept: application/vnd.github.raw",
        ]
    )
    return json.loads(raw)


def short_player_name(raw_name: str) -> str:
    if raw_name in PLAYER_ZH_MAP:
        return PLAYER_ZH_MAP[raw_name]
    parts = raw_name.strip().split()
    return parts[-1] if len(parts) <= 2 else f"{parts[0]} {parts[-1]}"


def map_role(pos_name: str) -> tuple[str, str]:
    p = pos_name.lower()
    if "goalkeeper" in p:
        return "GK_DF", "门将 GK"
    if "back" in p or "defender" in p:
        if "wing" in p or "left back" in p or "right back" in p:
            return "GK_DF", "边后卫 FB"
        return "GK_DF", "中后卫 CB"
    if "wing" in p or "forward" in p or "striker" in p:
        return "FW", "前锋 FW"
    return "MF", "中场 MF"


def classify_pitch_zone(sb_x: float, sb_y: float) -> str:
    # StatsBomb pitch is 120 (attacking X: 0 own goal -> 120 opp goal) x 80 (width Y: 0 left -> 80 right)
    if sb_y <= 14.5 or sb_y >= 65.5:
        return "touchline_trap"
    if sb_x < 44.0:
        return "buildup_back"
    if sb_x <= 80.0:
        return "midfield_hub"
    return "zone14_halfspace"


def classify_press_type(sb_x: float, close_opps_3m5: int, close_opps_5m5: int) -> str:
    if sb_x < 36.0 and close_opps_5m5 >= 1:
        return "high_press"
    if close_opps_5m5 >= 3 or close_opps_3m5 >= 3:
        return "cage_3plus"
    if close_opps_5m5 >= 2 or close_opps_3m5 >= 2:
        return "double_trap"
    return "1v1_back"


def classify_escape_outcome(cluster_evs: list[dict], start_xy: list[float], end_xy: list[float]) -> str:
    types = [e["type"]["name"] for e in cluster_evs]
    for e in cluster_evs:
        tn = e["type"]["name"]
        if tn in ("Dispossessed", "Miscontrol"):
            return "turnover_loss"
        if tn == "Dribble" and e.get("dribble", {}).get("outcome", {}).get("name") == "Incomplete":
            return "turnover_loss"
        if tn == "Pass" and e.get("pass", {}).get("outcome") is not None:
            out_name = e["pass"]["outcome"].get("name", "")
            if out_name in ("Incomplete", "Out"):
                return "turnover_loss"

    for e in cluster_evs:
        if e["type"]["name"] == "Dribble" and e.get("dribble", {}).get("outcome", {}).get("name") == "Complete":
            return "skill_dribble"

    dx = end_xy[0] - start_xy[0]
    dy = end_xy[1] - start_xy[1]
    move_dist = math.hypot(dx, dy)

    pass_evs = [e for e in cluster_evs if e["type"]["name"] == "Pass"]
    carry_evs = [e for e in cluster_evs if e["type"]["name"] == "Carry"]
    carry_dist = 0.0
    for ce in carry_evs:
        eloc = ce.get("carry", {}).get("end_location")
        if eloc:
            carry_dist += math.hypot(eloc[0] - ce["location"][0], eloc[1] - ce["location"][1])

    duration = max(0.05, cluster_evs[-1]["_abs_sec"] - cluster_evs[0]["_abs_sec"])

    # Quick one-touch / two-touch wall or line-breaking pass under pressure
    if pass_evs and carry_dist < 3.2 and duration <= 2.2 and (dx >= 2.5 or move_dist >= 7.5):
        return "one_touch_wall"

    if carry_dist >= 4.2 and dx >= 2.2:
        return "half_turn"

    if pass_evs and dx >= 6.5:
        return "one_touch_wall"

    return "recycle_shield"


def match_reference_scenario(press_type: str, pitch_zone: str, escape_outcome: str, role: str) -> tuple[int, str]:
    """Maps any match slice to its closest 3D reference scenario index & Zhibo8 reference MP4."""
    if escape_outcome == "skill_dribble":
        if press_type == "cage_3plus":
            return (2, "./assets/videos/s3_zhibo8_roulette_psg.mp4") if role != "FW" else (10, "./assets/videos/s11_fw_yamal_slalom.mp4")
        if pitch_zone == "touchline_trap":
            return (3, "./assets/videos/s4_zhibo8_touchline_escape.mp4") if role != "FW" else (11, "./assets/videos/s12_fw_vinicius_burst.mp4")
        if pitch_zone == "zone14_halfspace":
            return (7, "./assets/videos/s8_zhibo8_sevilla_double_fakeshot.mp4")
        return (1, "./assets/videos/s2_zhibo8_la_croqueta.mp4")

    if escape_outcome == "one_touch_wall":
        if press_type in ("cage_3plus", "double_trap"):
            return (5, "./assets/videos/s6_zhibo8_cage_wallpass.mp4")
        return (4, "./assets/videos/s5_zhibo8_lapausa_through.mp4")

    if escape_outcome == "half_turn":
        if role == "GK_DF":
            return (15, "./assets/videos/s16_df_timber_turn.mp4")
        if role == "FW":
            return (13, "./assets/videos/s14_fw_bardhi_chop.mp4")
        if pitch_zone == "touchline_trap":
            return (9, "./assets/videos/s10_mf_kdb_pass.mp4")
        return (0, "./assets/videos/s1_zhibo8_half_turn.mp4")

    if escape_outcome == "recycle_shield":
        if pitch_zone == "touchline_trap":
            return (3, "./assets/videos/s4_zhibo8_touchline_escape.mp4")
        return (6, "./assets/videos/s7_zhibo8_shield_nutmeg.mp4")

    # turnover_loss -> maps to dynamic dispossession sequence in 3D, with high-press reference video
    return (5, "./assets/videos/s6_zhibo8_cage_wallpass.mp4")


def parse_ts_seconds(period: int, ts_str: str) -> float:
    # timestamp format "00:14:22.512"
    parts = ts_str.split(":")
    h, m, s = int(parts[0]), int(parts[1]), float(parts[2])
    in_p = h * 3600 + m * 60 + s
    offset = {1: 0.0, 2: 2700.0, 3: 5400.0, 4: 6300.0}.get(period, 0.0)
    return round(offset + in_p, 2)


def extract_match_slices(match_id: int, meta: dict, max_slices: int = 58) -> dict:
    evs = gh_json(f"data/events/{match_id}.json")
    t360_list = gh_json(f"data/three-sixty/{match_id}.json")
    t360_map = {item["event_uuid"]: item["freeze_frame"] for item in t360_list}

    # Precompute absolute match seconds & jersey numbers from Starting XI / substitutions
    jersey_map = {}
    for e in evs:
        if e["type"]["name"] == "Starting XI":
            for p in e.get("tactics", {}).get("lineup", []):
                jersey_map[p["player"]["id"]] = p.get("jersey_number", 8)
        e["_abs_sec"] = parse_ts_seconds(e.get("period", 1), e.get("timestamp", "00:00:00.0"))

    valid_types = {"Ball Receipt*", "Carry", "Dribble", "Pass", "Dispossessed", "Miscontrol", "Foul Won", "Shot"}
    clusters = []
    cur_cluster = []

    for e in evs:
        tn = e["type"]["name"]
        if not (e.get("under_pressure") and e.get("location") and e.get("player") and tn in valid_types):
            continue
        if not cur_cluster:
            cur_cluster = [e]
            continue
        prev = cur_cluster[-1]
        same_player = e["player"]["id"] == prev["player"]["id"]
        same_period = e["period"] == prev["period"]
        dt = e["_abs_sec"] - prev["_abs_sec"]
        if same_player and same_period and 0 <= dt <= 5.2:
            cur_cluster.append(e)
        else:
            clusters.append(cur_cluster)
            cur_cluster = [e]
    if cur_cluster:
        clusters.append(cur_cluster)

    candidates = []
    for cl in clusters:
        # Find best 360 freeze-frame inside cluster
        best_ev = None
        best_ff = None
        best_opp_score = -1.0

        for e in cl:
            ff = t360_map.get(e["id"])
            if not ff:
                continue
            loc = e["location"]
            opps = [p for p in ff if not p.get("teammate")]
            d_list = [math.hypot(p["location"][0] - loc[0], p["location"][1] - loc[1]) for p in opps]
            if not d_list:
                continue
            min_d = min(d_list)
            c35 = sum(1 for d in d_list if d <= 3.8)
            c55 = sum(1 for d in d_list if d <= 5.8)
            score = c35 * 3.0 + c55 * 1.5 + max(0.0, 5.0 - min_d)
            if score > best_opp_score:
                best_opp_score = score
                best_ev = e
                best_ff = ff

        if not best_ev or not best_ff:
            continue

        loc = best_ev["location"]
        opps = [p for p in best_ff if not p.get("teammate")]
        mates = [p for p in best_ff if p.get("teammate") and not p.get("actor")]
        opp_dists = sorted(
            [(math.hypot(p["location"][0] - loc[0], p["location"][1] - loc[1]), p) for p in opps],
            key=lambda x: x[0],
        )
        if not opp_dists or opp_dists[0][0] > 4.6:
            continue

        close_35 = sum(1 for d, _ in opp_dists if d <= 3.8)
        close_55 = sum(1 for d, _ in opp_dists if d <= 5.8)
        min_dist = round(opp_dists[0][0] * 0.9144, 2)  # StatsBomb yards -> meters!

        first_ev, last_ev = cl[0], cl[-1]
        start_xy = first_ev["location"]
        end_xy = last_ev["location"]
        if last_ev["type"]["name"] == "Pass" and last_ev.get("pass", {}).get("end_location"):
            end_xy = last_ev["pass"]["end_location"]
        elif last_ev["type"]["name"] == "Carry" and last_ev.get("carry", {}).get("end_location"):
            end_xy = last_ev["carry"]["end_location"]

        role_code, role_label = map_role(best_ev["position"]["name"])
        p_zone = classify_pitch_zone(loc[0], loc[1])
        p_type = classify_press_type(loc[0], close_35, close_55)
        e_out = classify_escape_outcome(cl, start_xy, end_xy)

        # Convert StatsBomb (120x80 yards) -> Normalized 105x68 meters
        x_m = round((loc[0] / 120.0) * 105.0, 1)
        y_m = round((loc[1] / 80.0) * 68.0, 1)
        end_x_m = round((end_xy[0] / 120.0) * 105.0, 1)
        end_y_m = round((end_xy[1] / 80.0) * 68.0, 1)

        # Compact 360 freeze-frame around carrier (nearest 4 opponents + nearest 2 teammates in meters)
        near_opps = [
            {
                "x": round((p["location"][0] / 120.0) * 105.0, 1),
                "y": round((p["location"][1] / 80.0) * 68.0, 1),
                "distM": round(d * 0.9144, 2),
                "gk": bool(p.get("keeper")),
            }
            for d, p in opp_dists[:4]
        ]
        mate_dists = sorted(
            [(math.hypot(p["location"][0] - loc[0], p["location"][1] - loc[1]), p) for p in mates],
            key=lambda x: x[0],
        )
        near_mates = [
            {
                "x": round((p["location"][0] / 120.0) * 105.0, 1),
                "y": round((p["location"][1] / 80.0) * 68.0, 1),
            }
            for _, p in mate_dists[:2]
        ]

        raw_player = best_ev["player"]["name"]
        zh_player = short_player_name(raw_player)
        team_en = best_ev["team"]["name"]
        team_zh = TEAM_ZH_MAP.get(team_en, team_en)
        opp_team_zh = meta["awayTeamZh"] if team_zh == meta["homeTeamZh"] else meta["homeTeamZh"]
        opp_team_en = meta["awayTeamEn"] if team_en == meta["homeTeamEn"] else meta["homeTeamEn"]

        ref_idx, ref_mp4 = match_reference_scenario(p_type, p_zone, e_out, role_code)

        zone_zh = {
            "buildup_back": "本方后场出球区",
            "midfield_hub": "中圈腹地枢纽",
            "touchline_trap": "边路死角走廊",
            "zone14_halfspace": "前场肋部与14区",
        }[p_zone]
        press_zh = {
            "1v1_back": "紧贴1v1顶防",
            "double_trap": "双人关门夹击",
            "cage_3plus": f"{max(3, close_55)}人合围包夹",
            "high_press": "高位逼抢压迫",
        }[p_type]
        out_zh = {
            "half_turn": "沉肩顺球半转身带离压迫圈",
            "skill_dribble": "高频扣顺变向过人突破重围",
            "one_touch_wall": "一脚顺势敲墙/直塞穿透防线",
            "recycle_shield": "稳健卡位护球安全转移重置",
            "turnover_loss": "受迫触球受阻被对手断球反击",
        }[e_out]

        intensity = round(min(99, 46 + close_55 * 11 + max(0.0, (3.6 - min_dist) * 12)), 0)
        bonus = (
            10.5
            if e_out in ("skill_dribble", "half_turn", "one_touch_wall")
            else (6.5 if e_out == "recycle_shield" else 5.0)
        )

        t_peak = best_ev["_abs_sec"]
        t_start = max(0.0, round(first_ev["_abs_sec"] - 1.5, 1))
        t_end = round(max(last_ev["_abs_sec"] + 2.0, t_start + 4.8), 1)
        mm = int(best_ev["minute"])
        ss = int(best_ev["second"])

        candidates.append(
            {
                "_priority": best_opp_score + bonus,
                "_abs_sec": t_peak,
                "clock": f"{mm:02d}:{ss:02d}",
                "minute": mm,
                "period": best_ev["period"],
                "tStart": t_start,
                "tEnd": t_end,
                "duration": round(t_end - t_start, 1),
                "team": team_zh,
                "teamKit": TEAM_KIT_MAP.get(team_en, "barca-home"),
                "oppTeam": opp_team_zh,
                "oppKit": TEAM_KIT_MAP.get(opp_team_en, "madrid-white"),
                "playerName": zh_player,
                "jerseyNumber": str(jersey_map.get(best_ev["player"]["id"], 8)),
                "playerRole": role_code,
                "positionLabel": role_label,
                "pressType": p_type,
                "pitchZone": p_zone,
                "escapeOutcome": e_out,
                "presserCount": max(1, close_55),
                "minDefDistM": min_dist,
                "intensity": int(intensity),
                "pitchXY": [x_m, y_m],
                "exitXY": [end_x_m, end_y_m],
                "freezeOpps": near_opps,
                "freezeMates": near_mates,
                "refScenarioIdx": ref_idx,
                "refVideoSrc": ref_mp4,
                "summary": f"#{jersey_map.get(best_ev['player']['id'], 8)} {zh_player.split()[0]}在{zone_zh}遭{opp_team_zh}{press_zh}（最近{min_dist}m），{out_zh}",
            }
        )

    # Stratified temporal + category selection so all 90+ minutes & all categories are represented
    candidates.sort(key=lambda x: x["_priority"], reverse=True)
    selected = []
    used_times = []
    turnover_count = 0
    max_turnovers = max(8, int(max_slices * 0.18))
    for c in candidates:
        if len(selected) >= max_slices:
            break
        if c["escapeOutcome"] == "turnover_loss" and turnover_count >= max_turnovers:
            continue
        if any(abs(c["_abs_sec"] - ut) < 22.0 for ut in used_times):
            continue
        if c["escapeOutcome"] == "turnover_loss":
            turnover_count += 1
        used_times.append(c["_abs_sec"])
        selected.append(c)

    selected.sort(key=lambda x: x["_abs_sec"])
    for idx, s in enumerate(selected, 1):
        s.pop("_priority", None)
        s.pop("_abs_sec", None)
        s["id"] = f"{meta['id']}_s{idx:02d}"
        s["index"] = idx

    return {
        **meta,
        "sliceCount": len(selected),
        "slices": selected,
    }


def build_pedri_reel_match() -> dict:
    """Real MP4 continuous 55.5s highlight reel with frame-accurate video sub-clips."""
    reel_slices = [
        {
            "id": "reel_s01", "index": 1, "clock": "12:18", "minute": 12, "period": 1,
            "tStart": 0.0, "tEnd": 4.0, "duration": 4.0,
            "team": "巴塞罗那", "teamKit": "barca-home", "oppTeam": "马略卡", "oppKit": "mallorca-yellow",
            "playerName": "佩德里 Pedri", "jerseyNumber": "8", "playerRole": "MF", "positionLabel": "中场 CM",
            "pressType": "1v1_back", "pitchZone": "midfield_hub", "escapeOutcome": "half_turn",
            "presserCount": 2, "minDefDistM": 0.95, "intensity": 88,
            "pitchXY": [49.0, 35.5], "exitXY": [62.0, 39.5],
            "freezeOpps": [{"x": 47.8, "y": 34.8, "distM": 0.95, "gk": False}, {"x": 54.5, "y": 41.2, "distM": 4.2, "gk": False}],
            "freezeMates": [{"x": 38.0, "y": 28.0}],
            "refScenarioIdx": 0, "refVideoSrc": "./assets/videos/zhibo8_pedri_all_8_clips.mp4",
            "summary": "迎左路高空球背身回撤扫描，左脚扎轴+右足凌空卸顺高球顺时针半转身抹过马略卡#30"
        },
        {
            "id": "reel_s02", "index": 2, "clock": "24:41", "minute": 24, "period": 1,
            "tStart": 4.0, "tEnd": 10.5, "duration": 6.5,
            "team": "巴塞罗那", "teamKit": "barca-home", "oppTeam": "巴列卡诺", "oppKit": "madrid-white",
            "playerName": "佩德里 Pedri", "jerseyNumber": "8", "playerRole": "MF", "positionLabel": "中场 CM",
            "pressType": "double_trap", "pitchZone": "midfield_hub", "escapeOutcome": "skill_dribble",
            "presserCount": 2, "minDefDistM": 1.04, "intensity": 92,
            "pitchXY": [52.5, 33.0], "exitXY": [68.0, 31.0],
            "freezeOpps": [{"x": 54.0, "y": 31.8, "distM": 1.04, "gk": False}, {"x": 53.8, "y": 34.6, "distM": 1.35, "gk": False}],
            "freezeMates": [{"x": 64.0, "y": 20.0}],
            "refScenarioIdx": 1, "refVideoSrc": "./assets/videos/zhibo8_pedri_all_8_clips.mp4",
            "summary": "中线碎步诱敌触发巴列卡诺双人关门夹击，右扣左顺伊涅斯塔式油炸丸子从两人夹缝钻出"
        },
        {
            "id": "reel_s03", "index": 3, "clock": "38:09", "minute": 38, "period": 1,
            "tStart": 10.5, "tEnd": 16.1, "duration": 5.6,
            "team": "巴塞罗那", "teamKit": "barca-home", "oppTeam": "巴黎圣日耳曼", "oppKit": "psg-navy",
            "playerName": "佩德里 Pedri", "jerseyNumber": "8", "playerRole": "MF", "positionLabel": "中场 CM",
            "pressType": "cage_3plus", "pitchZone": "midfield_hub", "escapeOutcome": "skill_dribble",
            "presserCount": 3, "minDefDistM": 1.12, "intensity": 96,
            "pitchXY": [51.0, 36.0], "exitXY": [64.5, 48.0],
            "freezeOpps": [{"x": 52.6, "y": 35.5, "distM": 1.12, "gk": False}, {"x": 50.2, "y": 38.0, "distM": 1.85, "gk": False}, {"x": 53.5, "y": 38.2, "distM": 2.4, "gk": False}],
            "freezeMates": [{"x": 62.0, "y": 54.0}],
            "refScenarioIdx": 2, "refVideoSrc": "./assets/videos/zhibo8_pedri_all_8_clips.mp4",
            "summary": "欧冠中圈遭巴黎三人合围包夹，右足底踩球急停衔接360°马赛回旋破围分边"
        },
        {
            "id": "reel_s04", "index": 4, "clock": "51:33", "minute": 51, "period": 2,
            "tStart": 16.1, "tEnd": 22.53, "duration": 6.43,
            "team": "巴塞罗那", "teamKit": "barca-gold", "oppTeam": "赫罗纳", "oppKit": "madrid-white",
            "playerName": "佩德里 Pedri", "jerseyNumber": "8", "playerRole": "MF", "positionLabel": "中场 CM",
            "pressType": "cage_3plus", "pitchZone": "touchline_trap", "escapeOutcome": "skill_dribble",
            "presserCount": 3, "minDefDistM": 0.92, "intensity": 94,
            "pitchXY": [66.0, 63.5], "exitXY": [71.0, 49.0],
            "freezeOpps": [{"x": 67.2, "y": 64.2, "distM": 0.92, "gk": False}, {"x": 65.0, "y": 61.5, "distM": 1.75, "gk": False}, {"x": 68.4, "y": 60.8, "distM": 2.6, "gk": False}],
            "freezeMates": [{"x": 68.0, "y": 42.0}],
            "refScenarioIdx": 3, "refVideoSrc": "./assets/videos/zhibo8_pedri_all_8_clips.mp4",
            "summary": "右侧边线死角1v3压迫陷阱，假突底线急停150°内扣切回中路走廊"
        },
        {
            "id": "reel_s05", "index": 5, "clock": "63:15", "minute": 63, "period": 2,
            "tStart": 22.53, "tEnd": 33.06, "duration": 10.53,
            "team": "巴塞罗那", "teamKit": "barca-home", "oppTeam": "比利亚雷亚尔", "oppKit": "mallorca-yellow",
            "playerName": "佩德里 Pedri", "jerseyNumber": "8", "playerRole": "MF", "positionLabel": "中场 CM",
            "pressType": "double_trap", "pitchZone": "zone14_halfspace", "escapeOutcome": "one_touch_wall",
            "presserCount": 2, "minDefDistM": 1.48, "intensity": 86,
            "pitchXY": [74.0, 38.0], "exitXY": [91.5, 51.0],
            "freezeOpps": [{"x": 76.2, "y": 37.5, "distM": 1.48, "gk": False}, {"x": 75.8, "y": 40.6, "distM": 2.15, "gk": False}],
            "freezeMates": [{"x": 86.0, "y": 53.0}],
            "refScenarioIdx": 4, "refVideoSrc": "./assets/videos/zhibo8_pedri_all_8_clips.mp4",
            "summary": "14区口袋La Pausa降速停顿诱使双后腰上抢，外脚背手术刀直塞打穿防线助攻亚马尔"
        },
        {
            "id": "reel_s06", "index": 6, "clock": "71:48", "minute": 71, "period": 2,
            "tStart": 33.06, "tEnd": 40.26, "duration": 7.2,
            "team": "巴塞罗那", "teamKit": "barca-home", "oppTeam": "马德里竞技", "oppKit": "atleti-striped",
            "playerName": "佩德里 Pedri", "jerseyNumber": "8", "playerRole": "MF", "positionLabel": "中场 CM",
            "pressType": "cage_3plus", "pitchZone": "zone14_halfspace", "escapeOutcome": "one_touch_wall",
            "presserCount": 4, "minDefDistM": 1.08, "intensity": 95,
            "pitchXY": [78.0, 34.0], "exitXY": [93.0, 33.5],
            "freezeOpps": [{"x": 79.4, "y": 33.2, "distM": 1.08, "gk": False}, {"x": 77.2, "y": 36.1, "distM": 1.65, "gk": False}, {"x": 80.5, "y": 35.8, "distM": 2.3, "gk": False}],
            "freezeMates": [{"x": 84.5, "y": 34.0}],
            "refScenarioIdx": 5, "refVideoSrc": "./assets/videos/zhibo8_pedri_all_8_clips.mp4",
            "summary": "肋部四人铁笼合围下不作停球，一脚撞墙找莱万支点反跑前插破门"
        },
        {
            "id": "reel_s07", "index": 7, "clock": "79:04", "minute": 79, "period": 2,
            "tStart": 40.26, "tEnd": 47.73, "duration": 7.47,
            "team": "巴塞罗那", "teamKit": "barca-home", "oppTeam": "毕尔巴鄂", "oppKit": "atleti-striped",
            "playerName": "佩德里 Pedri", "jerseyNumber": "8", "playerRole": "MF", "positionLabel": "后腰 CDM",
            "pressType": "high_press", "pitchZone": "buildup_back", "escapeOutcome": "recycle_shield",
            "presserCount": 2, "minDefDistM": 0.88, "intensity": 91,
            "pitchXY": [28.5, 48.0], "exitXY": [44.0, 39.0],
            "freezeOpps": [{"x": 27.6, "y": 48.5, "distM": 0.88, "gk": False}, {"x": 30.8, "y": 46.2, "distM": 2.1, "gk": False}],
            "freezeMates": [{"x": 42.0, "y": 36.0}],
            "refScenarioIdx": 6, "refVideoSrc": "./assets/videos/zhibo8_pedri_all_8_clips.mp4",
            "summary": "本方后场出球区遭高压疯抢，单手撑地护球稳住重心后穿裆转移化解险情"
        },
        {
            "id": "reel_s08", "index": 8, "clock": "85:52", "minute": 85, "period": 2,
            "tStart": 47.73, "tEnd": 55.5, "duration": 7.77,
            "team": "巴塞罗那", "teamKit": "barca-home", "oppTeam": "塞维利亚", "oppKit": "sevilla-white",
            "playerName": "佩德里 Pedri", "jerseyNumber": "8", "playerRole": "MF", "positionLabel": "中场 CM",
            "pressType": "double_trap", "pitchZone": "zone14_halfspace", "escapeOutcome": "skill_dribble",
            "presserCount": 3, "minDefDistM": 1.15, "intensity": 98,
            "pitchXY": [83.5, 37.5], "exitXY": [104.0, 31.0],
            "freezeOpps": [{"x": 85.0, "y": 36.8, "distM": 1.15, "gk": False}, {"x": 86.2, "y": 39.0, "distM": 2.25, "gk": False}, {"x": 103.5, "y": 34.0, "distM": 16.0, "gk": True}],
            "freezeMates": [{"x": 89.0, "y": 52.0}],
            "refScenarioIdx": 7, "refVideoSrc": "./assets/videos/zhibo8_pedri_all_8_clips.mp4",
            "summary": "禁区弧顶连续两次假射真扣先后晃飞拉基蒂奇与迭戈·卡洛斯滑铲贴地斩破门"
        },
    ]
    return {
        "id": "pedri_zhibo8_reel",
        "title": "巴萨中场实况合集 · 连续原片自动切片与四维归类样本 (55.5s 真MP4子片段)",
        "competition": "西甲 / 欧冠 实况连续视频流",
        "matchDate": "2024–2025",
        "homeTeamZh": "巴塞罗那",
        "awayTeamZh": "对手联队",
        "totalMinutes": 90,
        "videoSrc": "./assets/videos/zhibo8_pedri_all_8_clips.mp4",
        "hasDirectFullVideo": True,
        "sourceLabel": "本地实况连续 MP4 精确时间戳子切片 (0.0s–55.5s)",
        "sliceCount": len(reel_slices),
        "slices": reel_slices,
    }


def main():
    print("[1/3] Extracting El Clasico 3773497 (Real Madrid 2-1 Barcelona)...")
    clasico = extract_match_slices(
        3773497,
        {
            "id": "el_clasico_3773497",
            "title": "西甲国家德比 · 皇家马德里 2–1 巴塞罗那 (90分钟全场持球逼抢拆解)",
            "competition": "La Liga · 西甲第30轮",
            "matchDate": "2021-04-10",
            "homeTeamZh": "皇家马德里",
            "awayTeamZh": "巴塞罗那",
            "homeTeamEn": "Real Madrid",
            "awayTeamEn": "Barcelona",
            "totalMinutes": 94,
            "videoSrc": None,
            "hasDirectFullVideo": False,
            "sourceLabel": "StatsBomb Open Data + 360° 全员空间追踪真实比赛流",
        },
        max_slices=56,
    )
    print(f"  -> Extracted {clasico['sliceCount']} slices for El Clasico")

    print("[2/3] Extracting Euro 2024 QF 3942226 (Spain 2-1 Germany)...")
    euro_qf = extract_match_slices(
        3942226,
        {
            "id": "euro2024_esp_ger_3942226",
            "title": "2024欧洲杯 1/4决赛 · 西班牙 2–1 德国 (120分钟全场高压逼抢拆解)",
            "competition": "UEFA Euro 2024 · 1/4决赛",
            "matchDate": "2024-07-05",
            "homeTeamZh": "西班牙",
            "awayTeamZh": "德国",
            "homeTeamEn": "Spain",
            "awayTeamEn": "Germany",
            "totalMinutes": 122,
            "videoSrc": None,
            "hasDirectFullVideo": False,
            "sourceLabel": "StatsBomb Open Data + 360° 全员空间追踪真实比赛流",
        },
        max_slices=60,
    )
    print(f"  -> Extracted {euro_qf['sliceCount']} slices for Spain vs Germany")

    print("[3/3] Building Pedri continuous MP4 reel breakdown...")
    reel = build_pedri_reel_match()

    taxonomy = {
        "pressType": {
            "label": "逼抢形态与人数",
            "items": {
                "1v1_back": {"label": "背身1v1顶防", "color": "#38bdf8", "desc": "单防球员紧贴后背顶靠限制转身"},
                "double_trap": {"label": "双人关门夹击", "color": "#facc15", "desc": "两名防守人封锁正前方与内切通道"},
                "cage_3plus": {"label": "3人+合围反抢", "color": "#fb923c", "desc": "局部3名及以上防守人形成包夹牢笼"},
                "high_press": {"label": "后场高位逼抢", "color": "#f87171", "desc": "本方后场35m内针对门将/后卫的压迫"},
            },
        },
        "pitchZone": {
            "label": "球场发生区域",
            "items": {
                "buildup_back": {"label": "后场出球区", "color": "#60a5fa", "desc": "本方禁区至后场三分之一出球走廊"},
                "midfield_hub": {"label": "中圈腹地枢纽", "color": "#34d399", "desc": "中场中圈与攻防转换核心腹地"},
                "touchline_trap": {"label": "边路死角陷阱", "color": "#c084fc", "desc": "两侧距边线12m内的天然包夹走廊"},
                "zone14_halfspace": {"label": "前场肋部与14区", "color": "#fbbf24", "desc": "进攻三区禁区弧顶与左右肋部口袋"},
            },
        },
        "escapeOutcome": {
            "label": "摆脱技术与结果",
            "items": {
                "half_turn": {"label": "沉肩半转身摆脱", "color": "#2dd4bf", "desc": "顺来球敞髋半转身抹过顶防向前推进"},
                "skill_dribble": {"label": "油炸丸子·回旋过人", "color": "#facc15", "desc": "双足内侧扣顺、马赛回旋或假射过人"},
                "one_touch_wall": {"label": "一脚撞墙·直塞破抢", "color": "#38bdf8", "desc": "不停球顺势敲墙二过一或直塞打穿防线"},
                "recycle_shield": {"label": "护球卡位·安全重置", "color": "#94a3b8", "desc": "稳健护球卡住身位后回传或横传弱侧"},
                "turnover_loss": {"label": "被抢断丢球 (反例)", "color": "#ef4444", "desc": "受迫停球失误或路线锁死导致球权丢失"},
            },
        },
        "playerRole": {
            "label": "持球位置",
            "items": {
                "GK_DF": {"label": "门将·后卫", "color": "#60a5fa"},
                "MF": {"label": "中场", "color": "#facc15"},
                "FW": {"label": "前锋·边锋", "color": "#fb7185"},
            },
        },
    }

    js_content = (
        "/**\n"
        " * Auto-generated by `scripts/build_full_match_samples.py`.\n"
        " * Canonical 4D Pressing Taxonomy + Built-in Full-Match Breakdown Datasets.\n"
        " */\n\n"
        f"export const PRESSING_TAXONOMY = {json.dumps(taxonomy, ensure_ascii=False, indent=2)};\n\n"
        f"export const BUILTIN_FULL_MATCHES = {json.dumps([clasico, euro_qf, reel], ensure_ascii=False, indent=2)};\n"
    )
    OUT_JS.write_text(js_content, encoding="utf-8")
    print(f"Wrote {OUT_JS} ({OUT_JS.stat().st_size / 1024:.1f} KB)")


if __name__ == "__main__":
    main()
