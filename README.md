# XCool-DSH灵动岛

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
![DSH](https://img.shields.io/badge/DeepSeek%20Harness-0.2.1--rc.5-blueviolet)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Web-lightgrey)

把 [岛仔 Daozai](https://github.com/Renly1994/xiaotang-daozai) 的**信息岛形态**搬进 DeepSeek Harness：
DSH 窗口最顶部正中悬一枚小岛，收起时一行看完当前会话在做什么，悬停或点击展开成信息面板。

> 原项目是 Rust + egui 的独立桌面程序，代码无法复用；这里重做的是它的交互与视觉语言
> （刘海/胶囊形态、毛玻璃、呼吸与眨眼、皮肤圆点切换），数据换成 DSH 自己的实时状态。

## 长什么样

**收起**（37px 纯黑胶囊，悬在窗口标题条正中，像 iPhone 的灵动岛）

```
[岛仔] 将 xiaotang-daozai UI 做成…   [2 在跑]   ◔ 33%
```

视觉语言跟 iOS 对齐：纯黑底 + 0.5px 发丝边 + 大圆角分组卡片、SF 字体与字重、
系统色（蓝 #0a84ff / 绿 #30d158 / 橙 #ff9f0a / 红 #ff453a）、spring 展开动画、
`backdrop-filter` 毛玻璃（玻璃皮肤）。岛仔的颜色就是状态：灰=空闲，蓝=在跑（浮动+眨眼），
橙=上下文快满，红=待审批。多个会话同时跑时出现「N 在跑」，右侧环+百分比是上下文占用。

**展开**（悬停 180ms 后自动展开，或点击钉住；`Esc` / 点空白处收起）

| 区块 | 内容 |
|---|---|
| 运行中 | **每个在跑的会话一行**，后面跟它自己的活跃族：正在处理 / 后台作业 / 子代理 / 定时任务 |
| 待审批 | 需要你确认的工具调用（尚未接入，见「已知限制」） |
| 额度 | 上下文占用水位条 + `已用 / 上限` |
| 底栏 | 会话总数、token 数、三款皮肤圆点（深空 / 奶油 / 玻璃，选择记在 localStorage） |

尊重 `prefers-reduced-motion`：关掉呼吸、眨眼、浮动与过渡。

## 能做什么（不只是看）

面板底部是固定操作区，**不随内容滚动**，六个按钮：

| 按钮 | 做了什么 | 走哪条路 |
|---|---|---|
| ＋ 新会话 | 新建并切过去 | 客户端 `ctx.uiWorkspace.startSession()`，降级到宿主 `sessionController.create()` + `openSession(id)` |
| ■ 停止轮次 | 停当前在跑的轮次 | 客户端 `ctx.remote.session.cancel({sessionId})`，降级到宿主 `agent.cancel({kind:'user'},{keepInbox:true})`（**必须保留 inbox**） |
| ⏱ 5 分钟 / 30 分钟 | 给当前会话加一次性提醒 | 宿主 `schedule.create(sessionId,{title,prompt,after_seconds})` |
| ⧉ 复制标题 | 复制当前会话标题 | 客户端 `navigator.clipboard.writeText` + `execCommand` 回退 |
| ⌖ 复位 | 把岛放回窗口顶部中央 | 纯本地，清 localStorage 位置 |

其它交互：

- **点「运行中」列表里的任意会话** → 直接切到那个会话（`ctx.uiWorkspace.openSession(id)`）。多会话并行时最常用。
- **日程行右侧 ✕** → 删除该提醒。只允许删标题以「岛仔提醒」开头的，防止误删你自己的日程。
- **按住岛体拖动** → 可拖到窗口任意位置，位置记在 localStorage；⌖ 复位可还原。
- **点岛体** → 钉住面板（不会因鼠标移开收起）；`Esc` 或点空白处取消钉住。
- 每个动作都有 **toast 回执**（成功/失败原因），失败不会静默。

### 动作路由的安全边界

`POST /island/action` 只接受白名单里的 5 个动作，并且：

- 校验 `Origin`/Host 同源、只收 POST、请求体 ≤ 8KB；
- 校验请求里的 `sessionId` 确实属于当前进程的会话，拒绝伪造目标；
- 文本字段 ≤ 4000 字符；每个动作独立 try/catch，失败只回一条 JSON，不抛到路由外；
- `deleteReminder` 额外校验标题前缀 + 会话归属，避免删到非本插件创建的任务。

**明确不做**（见 research-island-actions.md 的风险清单）：不直写 `session.append('user/message')` 当发送、
不带 `keepInbox` 的 cancel、静默改审批策略/模型选择、注册 `/api/*` 路由、宿主侧伪造 Electron clipboard。
## 动效设置

**最直接的入口在岛上**：悬停或点击展开面板 → 快捷操作区 →「**⚙ 动效**」，点一下就地展开开关网格，八个动效随开随关、立即生效。

也可以在 **设置 → XCool-DSH灵动岛**（左侧导航的独立分区，与「通用 / 模型 / 内置插件」并列）里找到同一组 iOS 风格开关，带说明文字和实时预览区。两处共用同一份配置（localStorage），改哪边都会同步：

| 开关 | 效果 |
|---|---|
| 入场弹入 | 首次出现时从上方轻轻落下 |
| 展开弹性 | 悬停展开的回弹曲线（关掉后变成匀速） |
| 在跑浮动 | 有会话运行时岛仔上下轻浮 |
| 岛仔眨眼 | 小生物每隔几秒眨一次眼 |
| 状态点呼吸 | 运行状态点向外扩散的光晕 |
| 提示动画 | 操作回执弹出的缩放淡入 |
| 悬停展开 | 关掉后**只能点击**岛体展开，鼠标扫过不再弹出面板 |
| 跟随系统减少动效 | 系统开启「减少动态效果」时自动全关 |
| **状态提示** | 完成时与异常时弹 toast；关掉后只在「最近状态」面板里留记录 |

右上角「恢复默认」一键还原；底部有实时预览区，能直接看到眨眼/浮动/呼吸的效果。

实现上，每个开关对应一个 `data-motion-*` 属性挂在岛体根节点上，CSS 里逐项用
`animation: none` / `--dz-spring: ease` 精确关掉，不需要重新注入样式表。
设置页与岛体通过 `CustomEvent('xcool-dsh-island:motion')` + `storage` 事件即时同步；
配置写在 `localStorage['island.motion']`。

> 没有走官方 `ctx.configForms`（那要宿主声明 `Config` schema、把值写进 Host 文档并处理
> revision 冲突）。动效是纯本地视觉偏好，localStorage 更轻、零重启、无额外依赖。


### 视觉动效清单（都能在「⚙ 动效」里关）

| 效果 | 说明 | 归属开关 |
|---|---|---|
| 岛面极光 | 蓝紫双色柔光在胶囊内缓慢游走、明灭 | 展开弹性 |
| 扫光 | 一道窄光带周期性掠过岛面（5.5s 一次） | 展开弹性 |
| 胶囊柔光呼吸 | 外圈蓝色光晕随呼吸胀缩 | 状态点呼吸 |
| 两端传感器光斑 | 左蓝右紫两个小光点错相明灭 | 状态点呼吸 |
| 在跑思考点 | 三个小绿点错峰跳动，表示有会话在跑 | 状态点呼吸 |
| 岛仔活体 | 身体呼吸变形、挤压、眨眼、眼睛微移、冒对话气泡 | 在跑浮动 / 岛仔眨眼 |
| 占用环轨道 | 渐变色环 + 环绕光点持续旋转 | 状态点呼吸 |
| 进度条流光 | 水位条上一道高光持续流动 | 展开弹性 |
| 分区错峰入场 | 展开时各卡片带模糊依次上滑（总计 0.34s） | 展开弹性 |
| 按钮涟漪 | 点击时缩放 + 水波反馈 | 提示动画 |
| 形变展开 | 胶囊 → 卡片时轻微挤压回弹 | 在跑浮动 |

所有效果都遵守 `prefers-reduced-motion`，且开关关闭时**不会残留半截动画**。
错峰动画带 `opacity:1` 兜底：动画被关掉或异常中断时内容仍然可见。

### 通知降噪

早期版本会把**命令全文**塞进 toast 详情（一条 `Move-Item D:\work\...` 能把输入区盖住），
而且每跑一条命令就弹「开始运行」。现在：

- 详情经 `compactDetail()` 压缩：命令路径只留**最后一个文件名**（`shot-current.ps1`），
  普通文本超 42 字省略，单行等宽显示；
- toast **默认只弹「完成 / 异常」**，「开始运行」由岛体状态点表达 —— 不再刷屏；
- toast 宽度 268px、靠岛右侧对齐，不再压住对话输入区；
- 「⚙ 动效 → 状态提示」可一键静音（仍然在「最近状态」列表里留痕）。

`test-compact.mjs` / `test-samestate.mjs` 覆盖详情压缩与快照去重。


## 状态提示（运行中 / 完成 / 异常）

岛会主动告诉你**状态变了**，不用一直盯着看。两条通道互为兜底：

| 通道 | 来源 | 覆盖 |
|---|---|---|
| 全局事件 | `ctx.on('session/event')` 过滤 `turn/start`、`turn/end`、`tool/result.error`、`job/settled`、`command/done`；另收 `api-session/status`/`api-session/error`、`agent/status`、`agent/error`、`agent-loop/config-start-failed` | 轮次开始/结束（reason 直接区分完成·异常·中止）、工具失败、作业结算、命令结束、LLM 错误 |
| 作业差分 | 每次 `/island/state` 读 `jobs.list()` 与上次快照对比（`JobStatus` = running / stopping / completed / killed / failed） | 事件没转发到宿主时仍能捕捉开始/完成/失败 |

三类提示：

| 类型 | 触发 | 颜色 |
|---|---|---|
| **运行中** | 轮次开始、作业注册、agent 转为 running | 蓝（图标旋转） |
| **完成** | `turn/end reason=completed`、`job/settled`、`command/done kind=success`、作业转 completed | 绿 |
| **异常** | `reason=error/blocked/max-tokens`、`tool/result.error`、作业 failed/killed、`api-session/error`、`agent/error` | 红 |

**呈现**：
- 检测到新 `seq` 时在岛上弹一条 toast（带标题 + 详情，一次最多 2 条防刷屏）
- 展开面板顶部有「最近状态」区块，保留最近 3 条（带三色点和时间），错过 toast 也能翻
- 首次加载只记水线**不回放历史**；宿主重启后 seq 变小会重新对齐
- 同一事件 1.2 秒内去重，缓冲最多 8 条；所有监听逐个 try/catch，单个 handler 抛错不影响宿主事件分发

`test-notifications.mjs` 覆盖 9 类事件映射 + 差分 + 去重的离线单测。

## 性能与代码组织

- **CSS 独立**：`src/client/styles.css`（881 行）经 esbuild 的 `.css: text` loader
  打进 bundle，`ensureStyles()` 注入；`src/client/index.jsx` 只留 950 行逻辑。
- **状态接口短 TTL 缓存**（700ms）+ 并发合并：实测平均延迟从 **234ms 降到 68ms**
  （缓存命中 2–15ms，过期重建 220–290ms）。
- **轮询热路径零磁盘写**：`diagnose()` 只在显式 `GET /island/diag` 时执行并落盘；
  之前每个状态请求都会额外跑一遍 `buildState()` + 写两个 JSON 文件。
- **多会话并发取活跃族**：`Promise.all` 代替逐会话串行 `await`。
- **客户端快照去重**：`sameState()` 忽略 `updatedAt` 心跳，状态没变化时
  不 `setState`，避免每 1.5s 触发整棵岛体重渲染。
- **通知不刷屏**：只有「转为运行」才推提示（idle 不打扰）；
  `turn/start` / `api-session/status` / `agent/status` 共用同一个去重 key，
  同一次状态变化只弹一次。动作成功或新通知到达时主动失效缓存。
- 所有热路径改动都不影响接口形状，客户端无需配套升级。


### 为什么删掉「待办」和「日程」

两个区块长期空白，不是 bug 而是**语义不匹配**：

- **待办**：`todos` 是 `dsh-tool-todo` 的会话投影，`apply` 规则是
  `event.type === "todo/write" ? 事件内容 : event.type === "turn/start" ? null : 旧值` ——
  **每轮开始就被清空**。它表达的是「agent 这一轮的小计划」，不是给人看的任务清单。
- **日程**：`schedule.list({ sessionId })` 只返回**当前会话**的 active 提醒，
  换会话 / 多会话时就全空；只有 `schedule.catalog()` 能列全部。

与其摆两个永远空的框（看起来像半成品），不如让面板只留**真的有内容**的四块：
最近状态 / 运行中 / 额度 / 快捷操作。

底层能力没丢：快捷操作里的「⏱ 5 分钟 / 30 分钟提醒」和删除提醒的动作都还在
（`schedule.create` / `schedule.delete`），只是不再常驻一个空列表。


## 本机状态（CPU / 内存 / 显卡 / 磁盘 / 音乐）

展开面板里的「本机」区块，把电脑的实时状态收进岛里：

| 指标 | 来源 | 说明 |
|---|---|---|
| CPU 型号 / 核心数 / 负载 | Node `os.cpus()` 两次采样差值 | 零子进程，实时 |
| 内存占用 / 总量 / 可用 | Node `os.totalmem()/freemem()` | 实时 |
| 显卡型号 / GPU 利用率 | `Win32_VideoController` + `\GPU Engine(*)\Utilization Percentage` | 慢层，12s 刷新 |
| 磁盘剩余 / 总量 | `Win32_LogicalDisk` | 慢层 |
| GPU 利用率 | 多引擎求和，clamp 到 0–100% | 慢层 |
| 电池电量 | `Win32_Battery`（有电池才有） | 慢层 |
| 正在播放的音乐 | Windows SMTC（`GlobalSystemMediaTransportControlsSessionManager`，WinRT via PowerShell `AsTask().Wait()`） | 歌名 / 艺术家 / 专辑 / 播放进度 / 来源应用 |

**关键设计：两层采集，不拖慢轮询**

- 快层用 Node 原生 `os`（零成本）；慢层 PowerShell（GPU 计数器约 0.3–3s）在**后台 12 秒**独立刷新，结果缓存。
- `/island/state` 只读缓存，实测延迟 ~85ms，与没加系统信息时一样。
- 两个 PowerShell 并行跑、各带超时，`timer.unref()`，插件卸载时 `system.stop()` 清理；任何一项失败自动降级，不影响岛体。
- `refresh()` 复用同一个 in-flight promise，并发调用不会拿到半成品缓存。

**音乐**：走 Windows 系统媒体传输控制，能覆盖网易云 / QQ 音乐 / Spotify / 浏览器视频等提供 SMTC 会话的播放器。

### 磁盘显示精度与告警

曾出现「磁盘 0G 可用」——不是采集错，是当时 C 盘真的只剩 **43 MB**，
`Round(0.04, 1)` 得 `0`。现在 PowerShell 直接输出**原始字节数**，
宿主换算成 GB（保留两位），客户端在小于 1GB 时改显示 **MB**（如 `44 MB 可用`），
并带上盘符（`磁盘 C:`）。低于 1GB 会额外显示红色警示条「系统盘空间严重不足」。
没播放时显示「♪ 未播放 · 播放音乐后显示」，不会整块消失。若系统不支持会标「音乐信息不可用」。

**开关**：第 10 个动效/功能开关「本机状态」，关掉时不仅隐藏 UI，还会通过 `toggleSystem` 动作让宿主**停掉后台采集**（不再起 PowerShell 子进程）；重新打开后下一轮恢复。
`test-system.mjs` 覆盖真实采集与开关。


## 交互优化（v2）

### 做减法：两个页签

展开面板顶部是「**概览 / 本机**」页签，默认概览只放「最近状态 / 运行中 / 快捷操作」，
一屏放得下、不用滚动；额度、本机指标、音乐放进「本机」页，按需切换。

### 元素可点

| 元素 | 点击后 |
|---|---|
| 运行中会话行 | 切到该会话（`uiWorkspace.openSession`） |
| 最近状态行 | 弹完整详情 toast |
| 上下文占用行 | 显示用量 + 当前模型 |
| CPU / 内存 / GPU / 磁盘 指标 | 显示型号、核心数、可用量等详情 |
| 音乐行 ⏮ ⏸ ⏭ | 通过 SMTC 控制上一首 / 播放暂停 / 下一首 |
| 通知行 / 会话标题 | 有详情或跳转 |

播控走 `mediaControl` 动作 → 宿主 `system.controlMedia()` → PowerShell 调
`TryPlayAsync/TryPauseAsync/TrySkipNextAsync/TrySkipPreviousAsync`；
没有媒体会话时返回友好失败，不会崩。

### 数据准确性

- **CPU 首轮不再 null**：Node `os` 两次差值算出前，用 `Win32_Processor.LoadPercentage` 兜底。
- **多磁盘**：枚举所有固定盘（`DriveType=3`），挑**剩余比例最低**的那个展示，带盘符；不再写死 C 盘。
- **GPU**：多引擎利用率求和后 clamp 到 0–100%。
- **磁盘小于 1GB 显示 MB** + 红色告警条（曾出现「0G」误导）。

### 性能与降噪

- GPU/磁盘/电池/**SMTC 合并进 1 个 PowerShell**（原来 2 个并行），子进程数减半；
  后台 12s 一次、约 3.7s 完成，状态接口延迟仍 ~140ms。
- 「最近状态」列表只留**完成 / 异常**，过滤 running；toast 也只弹这两类。

`test-system.mjs` / `test-perf.mjs` 覆盖合并采集、CPU 兜底、多盘与耗时。


## 主 / 子代理协作树

概览页的「协作」区块把 agent 之间的父子关系画成树：

- **主代理**一行：标题 + 状态点 + `N 子 · M 跑`，可折叠
- **子代理**缩进列出（带树线 `└`）：label / Team 成员名（如 `sqlite-dev`）、运行状态点
- 默认展开**有子代理在跑**的主代理；点行可展开/收起，点子代理显示详情

### 数据来源（实测 0.2.1-rc.5）

| 数据 | 来源 | 字段 |
|---|---|---|
| 子代理目录 | `sessionProjections.stateOf(session, 'subagentCatalog')` | `head.values[] = { childId, label, mode, childCreatedAt }` |
| Team 成员 | `stateOf(session, 'agentTeam')` | `members[] = { id, name, description, phase }`，补名字/角色 |
| fork 子会话 | `sessionController.list()` | 行上的 `parentSessionId` / `origin`，补 catalog 未登记的血缘 |
| 运行状态 | `ctx.agents.list()` | `agent.status`（running/idle），按会话 id 映射；Team `phase=active` 兜底 |
| 主/子标题 | `stateOf(session, 'title')` | 会话标题投影 |

全部调用包 try/catch，服务缺失或字段变化只会让区块消失，不影响岛体。
最多显示 4 个主代理、每个 12 个子代理，按「在跑的子代理数」排序。

**注意**：`ctx.agents` 的 Agent 对象上**没有** `owner`/`parentSessionId` 字段
（实测 Object.keys 只有 loop 内部字段）；血缘在会话 header / 投影 / sessionController 行里，
不要去读 agent 的私有 store。`subagents.listChildren()` 也可用，但字段是 `id` 而不是 `childId`。

## 获取

```bash
git clone https://github.com/XCool-603/XCool-DSH-Island.git
cd XCool-DSH-Island
```

## 装进 DSH

### 已经装好的（本机现状）

```
~/.dsh/profiles/desktop/node_modules/xcool-dsh-island  →  <你的插件目录>/XCool-DSH灵动岛   (junction)
~/.dsh/profiles/desktop/package.json
    dependencies["xcool-dsh-island"] = "link:<你的插件目录>/XCool-DSH灵动岛"
    dsh.profile.bundles 里追加 "xcool-dsh-island"
~/.dsh/profiles/desktop/pnpm-lock.yaml  记录同一个 link:
```

loader 条目由包自带的 `cordis.patch.yml`（`dsh.bundle.patch`）插入；
profile 的 `cordis.patch.yml` 里**不再**重复写 `insert`。
改 `package.json` 会触发宿主 recomposition，**不需要重启桌面应用**。

### 从零安装

**只写 `cordis.patch.yml` 的 `insert` 是不够的**：插件能加载，但「设置 → 插件」列表里不会出现。
插件管理页读的是 `profile/package.json` 的 `dependencies` + `dsh.profile.bundles`，两处都要有。

```powershell
# 1) 让 profile 能按包名解析到本地插件
New-Item -ItemType Junction `
  -Path "$env:USERPROFILE\.dsh\profiles\desktop\node_modules\xcool-dsh-island" `
  -Target "<你的插件目录>/XCool-DSH灵动岛"

# 2) 在 profile 目录跑一次 pnpm install（离线即可，会自动把 link 依赖写进 lock）
cd "$env:USERPROFILE\.dsh\profiles\desktop"
pnpm install --offline
```

```jsonc
// %USERPROFILE%\.dsh\profiles\desktop\package.json
{
  "dependencies": {
    "xcool-dsh-island": "link:<你的插件目录>/XCool-DSH灵动岛"
  },
  "dsh": {
    "profile": {
      "bundles": [
        "@deepseek-ai/dsh-base",
        "@deepseek-ai/dsh-web-app",
        "xcool-dsh-island"        // ← 追加这一项
      ]
    }
  }
}
```

包自带的 `cordis.patch.yml`（`dsh.bundle.patch`）会插入 loader 条目，
所以**不需要**再往 profile 的 `cordis.patch.yml` 里写 `insert`（写了反而重复）。

改完 `package.json` 会触发宿主 recomposition；刷新页面后即可在
「设置 → 插件 → 已安装插件」里看到 **xcool-dsh-island**；动效开关则在左侧导航的 **XCool-DSH灵动岛** 分区里。

## 开发

```powershell
node build.mjs          # lib/client.js（浏览器端）+ lib/index.js（宿主端）
node build.mjs --watch
node smoke.mjs          # 冒烟：模块注册 / 槽位 / 样式注入 / 渲染
node test-actions.mjs   # 宿主动作单元测试（假 ctx，不碰真实 DSH）
```

- **浏览器端** `src/client/index.jsx` + `src/client/styles.css`：React 18 + 手写 CSS，CSS 经 `.css: text` loader 内联；产物按 DSH 客户端模块契约包成
  `window.__ModuleLoader__.load({ id, factory })` 的 CJS 闭包（见 `build.mjs`）。挂 `shell.overlay` 槽位。
- **宿主端** `src/host/index.js`：纯 ESM，注册两条只读路由，`inject = ['webServer']`，
  其它服务用 `ctx.get(name)` 逐个兜底获取，缺谁都不影响加载。
- **离线预览**：双击 `preview.html`；`?collapsed=1` 只看收起态、`?expand=1` 强制展开、`?settings=1` 单独看动效设置页。
- **迭代**：改客户端代码后 `node build.mjs`，页面按 mtime 热替换，刷新即可看到；
  改宿主代码后摘掉 patch 里的 `insert` 再插回（或重启应用）才会重新加载。

## 接口

| 路由 | 说明 |
|---|---|
| `GET /island/state` | 状态快照（客户端 1.5 / 4 / 15s 自适应轮询） |
| `POST /island/action` | 执行一个白名单动作（见上） |
| `GET /island/diag` | 运行时自检：哪些服务可用、会话行与投影长什么样、`list()` 的报错、可用动作列表 |

快照形状：

```jsonc
{
  "ok": true,
  "sessions": 3,                      // 总会话数
  "runningCount": 2,                  // 在跑的会话数
  "busy": true,
  "session": { "id": "...", "title": "将 xiaotang-daozai UI 做成 DSH 插件", "model": "cn:deepseek-v4.1-flash" },
  "usage": { "percent": 33, "used": 339000, "capacity": 1000000, "label": "339k / 1.0M" },
  "tokens": 339000,
  "todos": [{ "content": "接宿主实时数据", "done": false }],
  "jobs": [{ "id": "session-...", "title": "将 xiaotang-daozai UI 做成 DSH 插件", "kinds": ["正在处理"] }],
  "schedule": [{ "id": "s1", "title": "每日回顾", "when": "2 小时后" }],
  "approvals": []
}
```

## 数据从哪来

| 字段 | 来源 |
|---|---|
| 会话清单 / 在跑状态 | 活跃 `Session` + `ctx.get('agents').list()` 的 `status === 'running'` |
| 标题 | 会话投影 `title`（`dsh-session-title` 的日志投影），缺失时退回首条 `user/message` |
| 额度 | 投影 `contextPressure`：`projectedTokens / contextWindow` |
| ~~待办~~ | 已移除：`todos` 投影每次 `turn/start` 就被清空，是 agent 单轮临时计划，长期看几乎永远空 |
| 运行中的活 | `ctx.waterfall('workspace/session-activity')` → turn / job / subagent / schedule 四族 |
| ~~日程~~ | 已移除展示：`list()` 只返回当前会话的 active 提醒，换会话就空。底层能力保留（快捷操作里的「⏱ 提醒」与删除提醒仍可用） |

> 注：`ctx.get('sessionController').list()` 在桌面宿主里可能返回空（依赖 `sessionQuery` 的持久化索引），
> 所以这里以活跃 Session 为主，`list()` 只作补充。

## 已知限制

- **不是桌面级悬浮窗**：岛活在 DSH 窗口内（`shell.overlay` 槽），不能覆盖其他应用、不能贴屏幕边缘。
  要做成真·置顶小窗得改 Electron 主进程或另起进程，插件做不到。
- **快速追问未接**：`remote.session.prompt` 需要 requestId/幂等与附件准入，成本高于收益，先留着（研究文档有完整签名）。
- **审批角标未接**：`approvals` 恒为空数组，需要旁路监听 `approval/request` 再 `next()`。
- **当前会话是推断的**：宿主不知道你在看哪个会话，用「正在跑的优先、否则最近更新」来选。
- 轮询而非推送；皮肤为自绘，与 DSH 明暗主题不完全联动。

## 踩坑记录（省下一次重来）

1. **`cordis.patch.yml` 新增条目必须用 `insert:`**。顶层写 `- id: xxx` 是「覆盖已存在的行」，
   对一个不存在的 id 会被静默忽略，表现为「装了但什么也没发生」。
2. **不要用 PowerShell `Set-Content`/`Get-Content` 往返改含中文的源文件**，编码会被转成乱码
   （本项目的 `src/client/index.jsx` 就被这么毁过一次，最后整文件重写）。用编辑器或 Node 读写。
3. `--dsh-frame-top-clearance` 是窗口顶部标题条的高度；岛最初放在 `top: 48px` 会正好压在会话标题和
   标签栏上，改成 `top: 0` 才是那条空白带。
4. 客户端插件注入的 `<style>` 若只按 id 判重，热替换后 CSS 不会更新；`ensureStyles()` 里要比对内容再覆盖。

## 许可

MIT。视觉与交互创意来自 [Renly1994/xiaotang-daozai](https://github.com/Renly1994/xiaotang-daozai)（MIT）。
5. **Windows 标题条是 `-webkit-app-region: drag` 的拖拽区，放进去的元素收不到鼠标事件。**
   DSH 自己的侧栏按钮用 `position:fixed; z-index:30; -webkit-app-region:no-drag` 逃出来；
   岛体照抄这套（z-index 40 + `--dsh-windows-titlebar-height` 垂直居中）悬停才会生效。
   表现是「岛看得到但悬停没反应」。

6. 客户端 bundle 的 CSS 走 `ensureStyles()` 注入；热替换只换 JS 不换样式表时，
   要比对 `textContent` 再覆盖，否则改了 CSS 页面还是老样子。
7. 客户端切会话/新建会话只能走 `ctx.uiWorkspace`；宿主 `sessionController` 没有 open/switch/select。
   `sessionController.createSession` 这个方法名不存在，真名是 `create()`（或 `.agents.createSession`）。
8. 离线预览默认收起，`preview.html?expand=1` 强制展开、`?collapsed=1` 只看收起态。
9. **「插件能用但设置里不显示」**：`pluginInventory/list` 投影的是 loader 行，
   而「已安装插件」页读 `pluginManager.listBundles()` —— 后者只认 `package.json` 的
   `dependencies` 与 `dsh.profile.bundles`。手工往 `cordis.patch.yml` 塞 `insert`
   能加载插件但不会出现在清单里；两处都补齐并 `pnpm install --offline` 后才会显示。
