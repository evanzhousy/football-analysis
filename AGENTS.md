# AGENTS.md — 强制双核对工程准则 (Mandatory Dual-Verification Gate)

> **最高铁律（ZERO-EXCEPTION MANDATE）**  
> 本仓库的任何代码、骨骼动画、IK 参数、视频动捕数据或战术轨迹改动，**严禁未经验证直接交付用户审核**。  
> **每一次改动**都必须严格按顺序通过以下 **两次独立核对（主 Agent 实况截图 1:1 自检 + Grok CLI 独立复核）**，且双方均确认无误后，方可提交并请用户最终验收。

---

## 一、强制双核对流程（Dual-Verification Workflow）

每次修改后，必须执行统一核对门禁脚本：

```bash
npm run qa
# 等价于: node scripts/dual_qa_audit.mjs
```

### 第 1 次核对：主 Agent 真实 WebGL 截图 1:1 逐帧比对（Self Visual & Biomechanical Audit）

1. **真实 WebGL2 渲染（严禁跳过或禁用 GPU 光栅化）**
   - 必须通过支持 HTTP `206 Partial Content`（`Range` 请求）的本地服务加载页面，确保左侧 `<video>` 精确 seek 到目标帧。
   - Headless Chrome **必须**携带以下 WebGL2 渲染参数（严禁传入 `--disable-gpu`，否则 WebGL 会报错失效）：
     ```text
     --headless=new --no-sandbox --disable-dev-shm-usage --use-gl=angle --use-angle=swiftshader --enable-webgl --ignore-gpu-blocklist --window-size=1600,900
     ```
2. **硬性生物力学与控制台不变量检查（0 容忍）**
   - `consoleErrors.length === 0` 且 `pageErrors.length === 0`。
   - 65 骨骼世界空间不变量（通过 `window.__STUDIO_DEBUG__.inspectScenario` 自动校验）：
     - **骨盆高度**：`hipsPos[1] ∈ [0.68m, 1.18m]`（杜绝角色悬空或陷入草皮）。
     - **躯干直立度**：站立/盘带/接球帧 `spineUpDot >= 0.72`（严禁出现 Armature `+90° X` 坐标系混用导致的 `90°` 折腰俯冲）。
     - **支撑脚贴地与球鞋倾角**：支撑脚踝 `Foot.y ∈ [0.105m, 0.195m]`，且着地脚 `Foot -> ToeBase` 单位向量 `toeSlopeY <= -0.10`（Mixamo 平踩草皮静息斜率为 `dy = -0.548, dz = +0.836`，严禁球鞋 `90°` 朝天竖立）。
     - **触球瞬间人球耦合**：在 `touchWindows` 峰值时刻，触球脚与 3D 足球中心距离 `minFootToBallDist <= 0.42m`，且触球脚别（左/右脚）、球高 `ballPos.y`、身体朝向 `yaw` 必须与原片逐帧特写一致。
3. **主 Agent 亲自阅片比对（必须调用图像查看工具逐张检查）**
   - `scripts/dual_qa_audit.mjs` 会自动截取并拼合 **`[原片高清放大特写 | 3D 足踝近景特写 | 1:1 左右分屏全局]`** 三联同框对比图（输出至 `/tmp/dual_qa_out/`）。
   - 主 Agent **必须**亲自打开生成的全部对比图逐帧目视审查：
     - 大腿、小腿、脚踝在接球缓冲、转身支撑、加速蹬地全周期的摆动轨迹是否自然连贯；
     - 支撑腿与触球腿的左右脚关系（例如短裤号码侧、球衣袖标侧、胸前赞助商朝向）是否与原片真人 100% 一致；
     - 跑步与变向是否存在滑步、反向折膝（膝关节超伸）或球鞋穿模。
   - **若发现任何一处不自然或与原片不符，主 Agent 必须立即返工修复并重新截图，绝不允许带病进入第 2 步或甩给用户！**

---

### 第 2 次核对：Grok CLI 独立复核（Independent Second-Opinion Audit via `grok` CLI）

1. **调用方式**
   - 本环境已安装独立 `grok` CLI（`/home/antigravity/.local/bin/grok`）。
   - 第 1 次核对通过后，必须由 `scripts/dual_qa_audit.mjs`（或直接命令行）调用 `grok` CLI 执行独立代码、生物力学遥测与多模态对比图复核：
     ```bash
     /home/antigravity/.local/bin/grok -p "<核对指令与遥测/改动摘要>" --no-sandbox
     ```
   - 当配置了 `GROK_API_KEY`（或 `XAI_API_KEY` / `~/.grok/user-settings.json`）时，脚本同时调用 Grok Vision 对生成的 1:1 三联同框截图与原片帧进行独立视觉挑刺。
2. **双签放行原则（Both-Pass Gate）**
   - **只有当 `[主 Agent 截图自检 = PASS]` 且 `[Grok CLI 独立核对 = PASS]` 同时成立时**，才允许向用户汇报“核对通过，请您最终查验”。
   - 若 Grok CLI 指出任何动作僵硬、角度异常、脚别错位或数学缺陷，主 Agent 必须先修复并重跑完整双核对，直到双方一致确认无误。
   - 若运行环境缺失 `GROK_API_KEY` 导致 `grok` CLI 返回认证错误，必须如实报告阻塞原因，绝不允许伪造或静默跳过 Grok 核对步骤。

---

## 二、Mixamo 65 骨骼与视频 3D 动捕技术红线

1. **严禁直接用世界/相机旋转矩阵覆盖 `boneNode.rotationQuaternion`**
   - Mixamo `Armature` 根节点自带 `+90° X` 旋转与 `0.01` 缩放。任何世界空间骨骼摆动增量 `qWorldDelta` 必须经父骨骼世界四元数共轭转换：
     `qLocalNew = inv(qParentWorld) * qWorldDelta * qParentWorld * qLocalCur`。
2. **单目视频 3D 动捕提取规范（`scripts/mocap/`）**
   - 必须使用 **1:1 正方形目标追踪裁剪框（Square Target-Tracked ROI）** 输入 `MediaPipe PoseLandmarker Heavy`，消除宽高比拉伸误差与多人抢镜干扰。
   - 必须通过右手系正交映射 `SO(3)` `(-z_mp, -y_mp, -x_mp)`（`det = +1`）转换至 **球场世界坐标系 `stadium_world`**（或正交骨盆本征系），融合 2D 屏幕平面投影消除单目深度压缩（`fuse_screen_plane`），并按单侧手臂可见度门控权重（`lw`/`rw`，遮挡侧 `< 0.32` 归零），严禁将原始相机坐标直接当作球员局部坐标。
