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
| 待办 | 当前会话的 `todos` 投影，完成项划线（iOS 风格圆形勾选） |
| 日程 | 本会话最近 3 条提醒，带「x 分钟后」 |
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
「设置 → 插件 → 已安装插件」里看到 **xcool-dsh-island**。

## 开发

```powershell
node build.mjs          # lib/client.js（浏览器端）+ lib/index.js（宿主端）
node build.mjs --watch
node smoke.mjs          # 冒烟：模块注册 / 槽位 / 样式注入 / 渲染
node test-actions.mjs   # 宿主动作单元测试（假 ctx，不碰真实 DSH）
```

- **浏览器端** `src/client/index.jsx`：React 18 + 手写 CSS，产物按 DSH 客户端模块契约包成
  `window.__ModuleLoader__.load({ id, factory })` 的 CJS 闭包（见 `build.mjs`）。挂 `shell.overlay` 槽位。
- **宿主端** `src/host/index.js`：纯 ESM，注册两条只读路由，`inject = ['webServer']`，
  其它服务用 `ctx.get(name)` 逐个兜底获取，缺谁都不影响加载。
- **离线预览**：双击 `preview.html`（本地 React UMD + 假数据）；`preview.html?collapsed=1` 只看收起态。
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
| 待办 | 投影 `todos`（最后一次 `todo/write` 的整表） |
| 运行中的活 | `ctx.waterfall('workspace/session-activity')` → turn / job / subagent / schedule 四族 |
| 日程 | `ctx.get('schedule').list({ sessionId })`，按时间升序取前 3 |

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
