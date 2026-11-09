/**
 * 岛仔 · 状态通知收集器
 *
 * 宿主端把「运行中 / 完成 / 异常」三类状态变化收进一个环形缓冲，
 * 由 /island/state 下发给客户端弹 toast。
 *
 * 设计原则：
 * - 所有 ctx.on 都逐个 try/catch；某个事件不存在或监听器抛错都不影响插件；
 * - 每条通知带单调递增 seq，客户端据此只弹「没见过」的；
 * - 去重：同一 key 在短时间内不重复入队；
 * - 只读观察，绝不调用 emit / 修改会话。
 */
import { randomUUID } from 'node:crypto';

const MAX_EVENTS = 8;
const DEDUPE_MS = 1200;

export function createNotifier() {
  let seq = 0;
  const events = [];
  const recent = new Map();
  const disposers = [];

  function push(kind, title, detail, key) {
    const now = Date.now();
    const dedupeKey = key ?? `${kind}:${title}`;
    const last = recent.get(dedupeKey) ?? 0;
    if (now - last < DEDUPE_MS) return;
    recent.set(dedupeKey, now);
    // 别让去重表无限长
    if (recent.size > 200) {
      const cutoff = now - 60_000;
      for (const [k, at] of recent) if (at < cutoff) recent.delete(k);
    }

    seq += 1;
    events.push({
      seq,
      id: randomUUID(),
      kind,
      title: String(title ?? '').slice(0, 120),
      detail: String(detail ?? '').slice(0, 200),
      at: now,
    });
    while (events.length > MAX_EVENTS) events.shift();
  }

  /** 注册一个可选监听：事件名不存在、ctx.on 抛错都静默跳过 */
  function listen(ctx, eventName, makeNotification) {
    if (!eventName || typeof ctx?.on !== 'function') return;
    try {
      const dispose = ctx.on(eventName, (...args) => {
        try {
          const result = makeNotification(...args);
          if (!result) return;
          const { kind, title, detail, key } = result;
          push(kind, title, detail, key);
        } catch {
          /* 单个 handler 出错不能影响宿主事件分发 */
        }
      });
      if (typeof dispose === 'function') disposers.push(dispose);
      else disposers.push(() => {
        try { ctx.off?.(eventName, dispose); } catch { /* ignore */ }
      });
    } catch {
      /* 事件未注册 / ctx 不允许监听 */
    }
  }

  /** 由 apply 调用，挂上所有监听；返回卸载函数 */
  function attach(ctx, definitions) {
    for (const def of definitions) listen(ctx, def.event, def.map);
    return () => {
      for (const dispose of disposers.reverse()) {
        try { dispose(); } catch { /* ignore */ }
      }
      disposers.length = 0;
    };
  }

  function snapshot() {
    return {
      seq,
      items: events.map((event) => ({ ...event })),
    };
  }

  return { push, listen, attach, snapshot };
}


/* ── 作业状态差分：不依赖事件名，最可靠的一条路径 ────────── */

const TERMINAL_OK = new Set(['completed']);
const TERMINAL_BAD = new Set(['failed', 'killed', 'error']);
const ACTIVE = new Set(['running', 'stopping']);

/** 从 jobs 服务里尽量多取一些行（不同版本 list 的入参不同，逐个兜底） */
export function collectJobs(ctx) {
  const jobs = getService(ctx, 'jobs');
  if (!jobs || typeof jobs.list !== 'function') return [];
  const agents = getService(ctx, 'agents');
  const owners = [undefined];
  try {
    const live = typeof agents?.list === 'function' ? agents.list() : [];
    for (const agent of live) {
      try { if (agent?.id) owners.push(agent.id); } catch { /* ignore */ }
    }
  } catch { /* ignore */ }

  for (const owner of owners) {
    try {
      const rows = owner === undefined ? jobs.list() : jobs.list(owner);
      if (Array.isArray(rows) && rows.length > 0) return rows;
    } catch { /* 试下一种入参 */ }
  }
  return [];
}

function getService(ctx, key) {
  try {
    return typeof ctx?.get === 'function' ? ctx.get(key) : undefined;
  } catch {
    return undefined;
  }
}

/** 拿一行作业的可读名字 */
function jobLabel(row) {
  const title = row?.title ?? row?.label ?? row?.name ?? row?.spec?.title;
  if (typeof title === 'string' && title.trim()) return title.trim().slice(0, 80);
  const kind = row?.kind ?? row?.spec?.kind;
  return typeof kind === 'string' && kind ? kind : '作业';
}

/**
 * 对比前后两次作业列表，把状态变化推成通知。
 * notifier: createNotifier() 的返回值；previous: Map<id, status>（会被原地更新）
 */
export function diffJobs(notifier, previous, rows, { initial = false } = {}) {
  const seen = new Set();
  for (const row of rows) {
    const id = String(row?.id ?? row?.jobId ?? '');
    if (!id) continue;
    seen.add(id);
    const status = String(row?.status ?? 'unknown');
    const label = jobLabel(row);
    const before = previous.get(id);
    previous.set(id, status);

    // 第一次采样不弹历史
    if (initial) continue;
    // 新出现且已经在跑的作业，也算「开始运行」
    if (before === undefined) {
      if (ACTIVE.has(status)) notifier.push('running', '开始运行', label, `running:${id}`);
      continue;
    }
    if (before === status) continue;

    if (ACTIVE.has(status) && !ACTIVE.has(before)) {
      notifier.push('running', '开始运行', label, `running:${id}`);
    } else if (TERMINAL_OK.has(status)) {
      notifier.push('success', '已完成', label, `done:${id}`);
    } else if (TERMINAL_BAD.has(status)) {
      const detail = row?.error ?? row?.message ?? row?.exitReason;
      notifier.push(
        'error',
        status === 'killed' ? '已中止' : '运行异常',
        detail ? `${label} · ${String(detail).slice(0, 90)}` : label,
        `fail:${id}`,
      );
    }
  }

  // 已消失的作业（settled 后被清理）也算完成，除非上一次就是失败态
  for (const [id, status] of previous) {
    if (seen.has(id)) continue;
    previous.delete(id);
    if (!initial && !TERMINAL_BAD.has(status) && !TERMINAL_OK.has(status)) {
      notifier.push('success', '已完成', id.slice(0, 24), `gone:${id}`);
    }
  }
}


/* ── 事件监听定义（已证实于 asar 0.2.1-rc.5） ──────────────
 *
 * session/event 是全局钩子（dsh-session/lib/index.js:1579 commit()），
 * payload 为 (session, event)，event = { type, seq, time, data }。
 * 这里只读观察，绝不 append / 修改会话。
 */

function sessionEventMap(session, event) {
  const type = event?.type;
  const data = event?.data ?? {};
  const title = (() => {
    try {
      const proj = session?.header?.title;
      if (typeof proj === 'string' && proj.trim()) return proj.trim().slice(0, 60);
    } catch { /* ignore */ }
    return '会话';
  })();

  // 轮次结束：reason 直接区分完成 / 异常 / 中止
  if (type === 'turn/end') {
    const reason = data?.reason?.kind ?? data?.reason ?? 'completed';
    if (reason === 'completed') {
      return { kind: 'success', title: '已完成', detail: title, key: `turn:${session?.id}:${event?.seq}` };
    }
    if (reason === 'aborted' || reason === 'interrupted' || reason === 'forked') {
      return { kind: 'running', title: '已中止', detail: title, key: `turn:${session?.id}:${event?.seq}` };
    }
    if (reason === 'error' || reason === 'blocked' || reason === 'max-tokens') {
      const message = data?.reason?.error?.message ?? data?.error?.message;
      return {
        kind: 'error',
        title: reason === 'max-tokens' ? '达到长度上限' : '运行异常',
        detail: message ? `${title} · ${String(message).slice(0, 90)}` : title,
        key: `turn:${session?.id}:${event?.seq}`,
      };
    }
    return null;
  }

  // 工具执行失败
  if (type === 'tool/result' && data?.error) {
    const reason = data.error.reason ?? data.error.message ?? data.error.code;
    return {
      kind: 'error',
      title: '工具执行失败',
      detail: reason ? `${data?.name ?? '工具'} · ${String(reason).slice(0, 90)}` : String(data?.name ?? '工具'),
      key: `tool:${session?.id}:${event?.seq}`,
    };
  }

  // 作业结算（settle() 会 append job/settled 到会话日志）
  if (type === 'job/settled') {
    const status = data?.status ?? data?.job?.status;
    const label = data?.title ?? data?.job?.title ?? data?.label ?? '作业';
    if (status === 'failed' || status === 'killed') {
      return { kind: 'error', title: status === 'killed' ? '作业已中止' : '作业失败', detail: String(label).slice(0, 80), key: `job:${event?.seq}` };
    }
    return { kind: 'success', title: '作业已完成', detail: String(label).slice(0, 80), key: `job:${event?.seq}` };
  }

  // 命令结束（success / error）
  if (type === 'command/done') {
    const label = data?.name ?? data?.command ?? '命令';
    if (data?.kind === 'error') {
      return { kind: 'error', title: '命令执行异常', detail: String(label).slice(0, 80), key: `cmd:${event?.seq}` };
    }
    return { kind: 'success', title: '命令已完成', detail: String(label).slice(0, 80), key: `cmd:${event?.seq}` };
  }

  // 轮次开始
  if (type === 'turn/start') {
    return { kind: 'running', title: '开始处理', detail: title, key: `turnstart:${session?.id}:${event?.seq}` };
  }

  return null;
}

/** 事件清单：全部经 notifier.listen 逐个 try/catch，缺哪个都不影响其它 */
export const EVENT_DEFINITIONS = [
  { event: 'session/event', map: sessionEventMap },

  // api-session-controller 转发的无 scope 事件（dsh-api-session-controller/lib/index.js:2991）
  {
    event: 'api-session/status',
    map: (payload) => {
      const running = payload?.running ?? payload?.status === 'running';
      return {
        kind: 'running',
        title: running ? '开始运行' : '已空闲',
        detail: '',
        key: `apis:${payload?.sessionId ?? ''}:${running}`,
      };
    },
  },
  {
    event: 'api-session/error',
    map: (payload) => ({
      kind: 'error',
      title: '运行异常',
      detail: String(payload?.message ?? '').slice(0, 120),
      key: `apierr:${payload?.sessionId ?? ''}:${payload?.message ?? ''}`,
    }),
  },

  // agent/status 是 agent-scoped 派发，但无 scope 标签的宿主监听器全局通过
  {
    event: 'agent/status',
    map: (payload) => {
      const status = payload?.status;
      if (status !== 'running' && status !== 'idle') return null;
      return {
        kind: 'running',
        title: status === 'running' ? '开始运行' : '已空闲',
        detail: '',
        key: `ags:${payload?.agent?.id ?? payload?.sessionId ?? ''}:${status}`,
      };
    },
  },

  // agent-loop 启动失败
  {
    event: 'agent-loop/config-start-failed',
    map: (payload) => ({
      kind: 'error',
      title: '启动失败',
      detail: String(payload?.error?.message ?? payload?.error ?? '').slice(0, 120),
      key: `cfgfail:${payload?.sessionId ?? ''}`,
    }),
  },

  // agent 抛出致命错误（throwError，dsh-agent-loop/lib/index.js）
  {
    event: 'agent/error',
    map: (payload) => ({
      kind: 'error',
      title: '运行异常',
      detail: String(payload?.error?.message ?? payload?.error ?? '').slice(0, 120),
      key: `agerr:${payload?.turn ?? ''}:${payload?.step ?? ''}`,
    }),
  },
];
