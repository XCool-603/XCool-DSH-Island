/**
 * 岛仔 · 宿主端动作层
 *
 * 只暴露用户从界面上能点到的、语义明确的动作；每个动作独立 try/catch，
 * 失败只回一条 { ok:false, message }，绝不抛到路由外、绝不改插件状态。
 *
 * 动作白名单在 ACTIONS 里；新增动作必须同时在这里和客户端 UI 里声明。
 */
import { randomUUID } from 'node:crypto';

/** 从 ctx 上取可选服务（cordis 未注入的服务直接访问会抛） */
function get(ctx, key) {
  try {
    return typeof ctx.get === 'function' ? ctx.get(key) : undefined;
  } catch {
    return undefined;
  }
}

const isFn = (v) => typeof v === 'function';

/* ── 会话解析 ─────────────────────────────────────── */

/** 当前焦点会话 id：优先在跑的，否则第一个活跃会话 */
function focusSessionId(ctx) {
  const sessions = get(ctx, 'sessions');
  const agents = get(ctx, 'agents');
  const live = isFn(sessions?.list) ? sessions.list() : [];
  const running = isFn(agents?.list) ? agents.list() : [];
  const active = running.find((a) => {
    try {
      return a?.status === 'running' && a?.session?.id;
    } catch {
      return false;
    }
  });
  if (active) return String(active.session.id);
  return live.length > 0 ? String(live[0].id ?? '') : '';
}

/* ── 各动作 ───────────────────────────────────────── */

/**
 * 快速提醒：在当前会话建一条一次性定时提醒。
 * request: { minutes: 5|30|60|... , text?: string }
 */
async function remind(ctx, request) {
  const schedule = get(ctx, 'schedule');
  if (!schedule || !isFn(schedule.create)) {
    return { ok: false, message: '日程服务不可用' };
  }
  const sessionId = focusSessionId(ctx);
  if (!sessionId) return { ok: false, message: '没有可用会话' };

  const minutes = Number(request?.minutes);
  if (!Number.isFinite(minutes) || minutes < 1 || minutes > 60 * 24) {
    return { ok: false, message: '提醒时长需在 1 分钟到 24 小时之间' };
  }
  const label = `${minutes} 分钟后`;
  const text = String(request?.text ?? '').trim().slice(0, 120);
  const title = text ? `岛仔提醒 · ${text.slice(0, 18)}` : `岛仔提醒 · ${label}`;
  const prompt = text ? `提醒：${text}` : `这是你在信息岛上设置的 ${label} 提醒。`;

  try {
    await schedule.create(
      sessionId,
      { title, prompt, after_seconds: Math.round(minutes * 60) },
      undefined,
    );
    return { ok: true, message: `已设置 ${label}提醒` };
  } catch (error) {
    return { ok: false, message: `创建失败：${error instanceof Error ? error.message : String(error)}` };
  }
}

/** 新建会话：复用当前工作目录，返回新会话 id */
async function newSession(ctx) {
  const controller = get(ctx, 'sessionController');
  if (!controller) return { ok: false, message: '会话控制器不可用' };

  const sessions = get(ctx, 'sessions');
  const live = isFn(sessions?.list) ? sessions.list() : [];
  const cwd = (() => {
    for (const session of live) {
      try {
        const value = session?.header?.cwd;
        if (typeof value === 'string' && value.length > 0) return value;
      } catch {
        /* ignore */
      }
    }
    return undefined;
  })();

  try {
    // 正规入口是 controller.create({ cwd | workspaceId })；
    // 某些版本把创建挂在 .agents.createSession / .commands.create 上，逐级兜底
    const creator =
      (isFn(controller.create) ? (req) => controller.create(req) : null) ??
      (isFn(controller.agents?.createSession)
        ? (req) => controller.agents.createSession(req)
        : null) ??
      (isFn(controller.commands?.create) ? (req) => controller.commands.create(req) : null);

    if (!creator) return { ok: false, message: '会话控制器不支持创建' };
    const created = await creator(cwd === undefined ? {} : { cwd });
    const id = String(created?.sessionId ?? created?.id ?? created?.session?.id ?? '');
    return { ok: true, message: '已新建会话', sessionId: id };
  } catch (error) {
    return { ok: false, message: `新建失败：${error instanceof Error ? error.message : String(error)}` };
  }
}

/** 停止当前轮次：走 sessionController.cancel（官方入口，保留待处理 inbox） */
async function stopTurn(ctx) {
  const controller = get(ctx, 'sessionController');
  const sessionId = focusSessionId(ctx);
  if (!sessionId) return { ok: false, message: '没有可用会话' };

  // 优先 sessionController.cancel（若挂载）；否则直接对 agent 取消并保留 inbox
  if (controller && isFn(controller.cancel)) {
    try {
      await controller.cancel({ sessionId });
      return { ok: true, message: '已请求停止当前轮次' };
    } catch {
      /* 落到下面逐个 agent 取消 */
    }
  }

  const stopped = tryAgentCancel(ctx);
  return stopped > 0
    ? { ok: true, message: `已请求停止 ${stopped} 个轮次` }
    : { ok: false, message: '当前版本没有可用的停止接口' };
}

/** 兜底：agent 上公开的 cancel(...)（不碰内部 phase） */
function tryAgentCancel(ctx) {
  const agents = get(ctx, 'agents');
  if (!agents || !isFn(agents.list)) return 0;
  let stopped = 0;
  for (const agent of agents.list()) {
    try {
      if (agent?.status !== 'running') continue;
      const method = ['cancel', 'abort', 'interrupt', 'stop'].find((name) => isFn(agent?.[name]));
      if (!method) continue;
      if (method === 'cancel') agent.cancel({ kind: 'user' }, { keepInbox: true });
      else agent[method]();
      stopped += 1;
    } catch {
      /* 单个 agent 失败不影响其它 */
    }
  }
  return stopped;
}

/** 删除一条提醒：只允许删当前进程内、且标题带岛仔标记的（避免误删用户自己的日程） */
async function deleteReminder(ctx, request) {
  const schedule = get(ctx, 'schedule');
  if (!schedule || !isFn(schedule.delete)) return { ok: false, message: '日程服务不可用' };
  const id = String(request?.id ?? '');
  if (!id) return { ok: false, message: '缺少提醒 id' };
  const sessionId = focusSessionId(ctx);
  if (!sessionId) return { ok: false, message: '没有可用会话' };

  try {
    const rows = isFn(schedule.list) ? await schedule.list({ sessionId }) : [];
    const target = (Array.isArray(rows) ? rows : []).find((row) => String(row?.id) === id);
    if (!target) return { ok: false, message: '提醒不存在或不属于当前会话' };
    if (!String(target.title ?? '').startsWith('岛仔提醒')) {
      return { ok: false, message: '只能删除岛仔创建的提醒' };
    }
    const result = await schedule.delete({ id, sessionId });
    return result?.deleted
      ? { ok: true, message: '提醒已删除' }
      : { ok: false, message: '删除未生效' };
  } catch (error) {
    return { ok: false, message: `删除失败：${error instanceof Error ? error.message : String(error)}` };
  }
}

/** 把一段文本复制到系统剪贴板（宿主侧，走 Electron clipboard） */
async function copyText(ctx, request) {
  const text = String(request?.text ?? '').slice(0, 4000);
  if (!text) return { ok: false, message: '没有可复制的内容' };
  try {
    // 优先宿主侧 clipboard 服务；没有则让客户端自己用 navigator.clipboard
    const clipboard = get(ctx, 'clipboard');
    if (clipboard && isFn(clipboard.writeText)) {
      await clipboard.writeText(text);
      return { ok: true, message: '已复制' };
    }
    return { ok: false, message: '需由浏览器端复制', fallback: true, text };
  } catch (error) {
    return { ok: false, message: `复制失败：${error instanceof Error ? error.message : String(error)}`, fallback: true, text };
  }
}

/* ── 白名单 ───────────────────────────────────────── */

const ACTIONS = {
  remind,
  deleteReminder,
  newSession,
  stopTurn,
  copyText,
};

/** 执行一次动作；永远返回可 JSON 化的结果 */
export async function runAction(ctx, payload) {
  const action = String(payload?.action ?? '');
  const handler = ACTIONS[action];
  if (!handler) {
    return { ok: false, message: `未知动作 ${action || '(空)'}`, id: randomUUID() };
  }
  try {
    const result = await handler(ctx, payload);
    return { ...result, action, id: randomUUID() };
  } catch (error) {
    return {
      ok: false,
      action,
      id: randomUUID(),
      message: `动作异常：${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export const ACTION_NAMES = Object.keys(ACTIONS);
