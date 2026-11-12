/**
 * 岛仔 · DSH 悬浮信息岛 —— 宿主端
 *
 * 只做一件事：把进程内的实时状态压成一份只读 JSON，供浏览器端轮询。
 *   GET /island/state   状态快照
 *   GET /island/diag    运行时自检（哪些服务可用、投影长什么样），排查用
 *
 * 设计约束：
 * - 任何一项取不到都不报错，退化成 null / 空数组，岛照常显示；
 * - 只读：不写配置、不改会话、不注册工具、不发消息；
 * - 所有宿主 API 都当作"可能不存在"来用，DSH 升级后不会炸。
 *
 * 数据来源（按优先级）：
 *   会话清单与投影  ctx.get('sessionController').list()
 *   活跃度         ctx.waterfall('workspace/session-activity')
 *   日程           ctx.get('schedule').list({ sessionId })
 *
 * @module xcool-dsh-island
 */

import { writeFileSync } from 'node:fs';
import { runAction, ACTION_NAMES } from './actions.js';
import { createNotifier, collectJobs, diffJobs, EVENT_DEFINITIONS } from './notifications.js';
import { createSystemMonitor } from './system.js';

export const name = 'island';

/** webServer 提供路由；其余服务一律可选，缺失不影响挂载 */
export const inject = ['webServer'];

const STATE_PATH = '/island/state';
const DIAG_PATH = '/island/diag';
const ACTION_PATH = '/island/action';

/** 自检落盘：没有浏览器也能确认宿主端到底看见了什么（仅开发期） */
const DEBUG_DIR = safe(() => process.env.TEMP ?? process.env.TMP ?? '.', '.');
const DIAG_FILE = `${DEBUG_DIR}\\dsh-island-diag.json`;
const SNAPSHOT_FILE = `${DEBUG_DIR}\\dsh-island-state.json`;

const isFn = (value) => typeof value === 'function';

/** 快照短 TTL 缓存：状态接口开销约 200ms，1.5s 轮询里多个页面/请求复用同一份 */
const SNAPSHOT_TTL_MS = 700;
let cachedSnapshot = null;
let cachedAt = 0;
let inFlight = null;

/** 通知收集器与作业状态快照：模块级单例，热重载后会重建 */
const notifier = createNotifier(() => {
  cachedSnapshot = null;
  cachedAt = 0;
});
const jobStatuses = new Map();
let jobSampling = true;

/** 本机状态采集器：后台慢速刷新，状态接口只读缓存 */
const system = createSystemMonitor({ intervalMs: 12_000, enabled: true });

/** 取快照：TTL 内复用；并发请求合并成同一个 Promise */
async function currentSnapshot(ctx) {
  const now = Date.now();
  if (cachedSnapshot && now - cachedAt < SNAPSHOT_TTL_MS) return cachedSnapshot;
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const snapshot = await safeAsync(() => buildState(ctx), { ok: false });
      cachedSnapshot = snapshot;
      cachedAt = Date.now();
      return snapshot;
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

/** 取不到就返回 fallback，绝不抛 */
function safe(fn, fallback) {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

/** 同上，异步版 */
async function safeAsync(fn, fallback) {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

function safeArray(fn) {
  const value = safe(fn, null);
  return Array.isArray(value) ? value : [];
}

/**
 * 取一个可选服务。
 * cordis 里访问未注入的服务会抛错，所以走 ctx.get()（不抛），再退回 reflect 与直接取值。
 */
function service(ctx, key) {
  const viaGet = safe(() => (isFn(ctx.get) ? ctx.get(key) : undefined), undefined);
  if (viaGet !== undefined && viaGet !== null) return viaGet;
  const viaReflect = safe(() => ctx.reflect?.get?.(key, false), undefined);
  if (viaReflect !== undefined && viaReflect !== null) return viaReflect;
  return safe(() => ctx[key], undefined);
}

/* ── 会话行归一化 ─────────────────────────────────── */

const TITLE_MAX = 48;

function clipTitle(text) {
  const clean = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (clean.length === 0) return '';
  return clean.length > TITLE_MAX ? `${clean.slice(0, TITLE_MAX)}…` : clean;
}

/** 投影取值：values 可能是快照对象，也可能直接就是载荷 */
function projection(row, key) {
  const values = row?.projections?.values ?? row?.projections ?? null;
  if (values === null || typeof values !== 'object') return undefined;
  return values[key];
}

/** todos 投影：{ items: [{ content, status }] } | 数组 | null */

/** contextPressure 投影：{ projectedTokens, pressureTokens, contextWindow } */
function readUsage(row) {
  const value = projection(row, 'contextPressure');
  if (!value || typeof value !== 'object') return null;
  const used = Number(value.projectedTokens ?? value.pressureTokens ?? 0);
  const capacity = Number(value.contextWindow ?? 0);
  if (!Number.isFinite(used) || used <= 0) return null;
  const percent =
    Number.isFinite(capacity) && capacity > 0 ? Math.round((used / capacity) * 100) : null;
  return {
    percent,
    used,
    capacity: capacity > 0 ? capacity : null,
    label: capacity > 0 ? `${formatTokens(used)} / ${formatTokens(capacity)}` : formatTokens(used),
  };
}

/** modelSelection 投影：{ lastUsed: { provider, model } } */
function readModel(row) {
  const value = projection(row, 'modelSelection');
  const used = value?.lastUsed ?? value?.pending ?? null;
  if (!used || typeof used !== 'object') return '';
  const model = String(used.model ?? '').trim();
  return model;
}

function normalizeRow(row) {
  const id = String(row?.sessionId ?? row?.id ?? '');
  return {
    id,
    title: clipTitle(row?.title ?? row?.name ?? ''),
    running: row?.running === true,
    updatedAt: Number(row?.updatedAt ?? 0),
    usage: readUsage(row),
    model: readModel(row),
    /** 原始行留着给自检用，不进快照响应 */
    raw: row,
  };
}

/** 兜底：从活跃 Session + 会话投影自己拼（不依赖 sessionQuery 索引） */
function fallbackRows(ctx) {
  const agents = safeArray(() => service(ctx, 'agents')?.list?.());
  const sessions = safeArray(() => service(ctx, 'sessions')?.list?.());
  const projections = service(ctx, 'sessionProjections');

  const stateOf = (session, key) => safe(() => projections?.stateOf?.(session, key), undefined);

  return sessions.map((session) => {
    const id = String(safe(() => session.id, ''));
    const agent = agents.find((candidate) => safe(() => candidate?.session, null) === session);
    const header = safe(() => session.header, null);
    const seq = Number(safe(() => session.seq, 0)) || 0;
    return {
      sessionId: id,
      // 真标题存在 `title` 投影里（dsh-session-title 的日志投影），拿不到再退回 header
      title: stateOf(session, 'title') || safe(() => header?.title ?? '', '') || '',
      running: safe(() => agent?.status === 'running', false),
      updatedAt: Number(safe(() => header?.updatedAt, 0)) || seq,
      projections: {
        values: {
          contextPressure: stateOf(session, 'contextPressure'),
          modelSelection: stateOf(session, 'modelSelection'),
        },
      },
      raw: { sessionId: id, seq, headerKeys: header ? Object.keys(header) : [] },
    };
  });
}

async function listRows(ctx) {
  const controller = service(ctx, 'sessionController');
  if (isFn(controller?.list)) {
    const rows = await safeAsync(() => controller.list(), null);
    if (Array.isArray(rows)) return rows.map(normalizeRow);
  }
  return fallbackRows(ctx).map(normalizeRow);
}

/** 标题缺失时，用首条用户消息补一句（只对当前会话做，成本可控） */
function deriveTitleFromSession(ctx, id) {
  const session = safe(() => service(ctx, 'sessions')?.get?.(id), null);
  if (!session) return '';
  const events = sessionEvents(session);
  for (const event of events) {
    if (event?.type !== 'user/message') continue;
    const content = event?.data?.content;
    let text = '';
    if (typeof content === 'string') text = content;
    else if (Array.isArray(content)) {
      text = content
        .filter((part) => part?.type === 'text' && typeof part.text === 'string')
        .map((part) => part.text)
        .join(' ');
    }
    const clipped = clipTitle(text);
    if (clipped.length > 0) return clipped;
  }
  return '';
}

/** Session 的事件日志：不同版本可能的取法 */
function sessionEvents(session) {
  if (!session) return [];
  const direct = safe(() => (isFn(session.events) ? session.events() : session.events), null);
  if (Array.isArray(direct)) return direct;
  const log = safe(() => session.log, null);
  if (Array.isArray(log)) return log;
  const snapshot = safe(() => session.eventsSnapshot, null);
  return Array.isArray(snapshot) ? snapshot : [];
}

/* ── 活跃度 ───────────────────────────────────────── */

const ACTIVITY_LABEL = {
  turn: '正在处理',
  job: '后台作业',
  subagent: '子代理',
  schedule: '定时任务',
};

/** workspace/session-activity：一次拿到 turn / job / subagent / schedule 四族 */
async function readActivity(ctx, sessionId) {
  if (!isFn(ctx.waterfall) || sessionId === '') return [];
  const families = await safeAsync(
    () => ctx.waterfall('workspace/session-activity', { sessionId }, () => Promise.resolve([])),
    null,
  );
  if (!Array.isArray(families)) return [];
  const seen = new Set();
  const out = [];
  for (const family of families) {
    const kind = String(family?.kind ?? '');
    if (kind === '' || seen.has(kind)) continue;
    seen.add(kind);
    out.push({
      id: kind,
      title: ACTIVITY_LABEL[kind] ?? kind,
      elapsed: typeof family?.title === 'string' ? clipTitle(family.title) : '',
    });
  }
  return out;
}

/* ── 日程 ─────────────────────────────────────────── */


function describeWhen(at) {
  if (!Number.isFinite(at) || at <= 0) return '';
  const delta = at - Date.now();
  if (delta <= 0) return '已到期';
  const minutes = Math.round(delta / 60_000);
  if (minutes < 1) return '马上';
  if (minutes < 60) return `${minutes} 分钟后`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} 小时后`;
  return `${Math.round(hours / 24)} 天后`;
}

function formatTokens(n) {
  if (!Number.isFinite(n)) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${Math.round(n / 1000)}k`;
  return String(Math.round(n));
}

/* ── 快照 ─────────────────────────────────────────── */

/** 最近一次组装用到的会话行，供自检复用（list() 不一定能在同一 tick 内重复调用） */
let lastRows = [];

async function buildState(ctx) {
  // 作业状态差分 → 生成「运行中 / 完成 / 异常」通知
  // 全部包在 try/catch 里：jobs 服务缺失或结构变化都不能让状态接口挂掉
  try {
    diffJobs(notifier, jobStatuses, collectJobs(ctx), { initial: jobSampling });
    jobSampling = false;
  } catch {
    /* 忽略：通知是增强，不是主链路 */
  }

  const rows = await listRows(ctx);
  if (rows.length > 0) lastRows = rows;

  const runningRows = rows.filter((row) => row.running);
  // 焦点会话：正在跑的最近一个，否则最近更新的那个
  const current = runningRows[0] ?? rows[0] ?? null;

  const titleOf = (row) => {
    if (row === null) return '';
    if (row.title) return row.title;
    return row.id === '' ? '' : deriveTitleFromSession(ctx, row.id);
  };

  // 每个在跑的会话各出一行；并发取活跃族，避免多会话时串行拖慢轮询
  const activityRows = runningRows.slice(0, 4);
  const families = await Promise.all(
    activityRows.map((row) => safeAsync(() => readActivity(ctx, row.id), [])),
  );
  const jobs = activityRows.map((row, index) => ({
      id: row.id,
      title: titleOf(row) || '未命名会话',
      kinds: families[index].map((family) => family.title),
      elapsed: '',
  }));

  const currentTitle = titleOf(current);

  return {
    ok: true,
    updatedAt: Date.now(),
    sessions: rows.length,
    runningCount: runningRows.length,
    busy: runningRows.length > 0,
    session:
      current === null
        ? null
        : {
            id: current.id,
            title: currentTitle || '未命名会话',
            model: current.model,
          },
    usage: current?.usage ?? null,
    tokens: current?.usage?.used ?? null,
    jobs,
    approvals: [],
    notifications: notifier.snapshot(),
    system: system.snapshot(),
  };
}

/* ── HTTP ─────────────────────────────────────────── */

function trusted(req) {
  const origin = req.headers.origin;
  if (origin === undefined) return true;
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

/** 校验请求里的 sessionId 确实属于当前进程：拒绝同机网页伪造任意目标 */
function knownSession(ctx, value) {
  if (value === undefined || value === null || value === '') return true;
  const sessions = service(ctx, 'sessions');
  const live = safeArray(() => sessions?.list?.());
  return live.some((session) => safe(() => String(session.id) === String(value), false));
}

/** 执行动作前的公共校验：动作白名单 + 会话归属 + 文本长度 */
function validateAction(ctx, payload) {
  if (!ACTION_NAMES.includes(String(payload?.action ?? ''))) return null;
  if (!knownSession(ctx, payload.sessionId)) return '会话不在当前进程中';
  const textFields = ['text', 'title', 'prompt'];
  for (const key of textFields) {
    if (typeof payload[key] === 'string' && payload[key].length > 4000) {
      return `${key} 过长`;
    }
  }
  return null;
}

/** 读取并解析请求体，带大小上限 */
async function readJsonBody(req, maxBytes = 8192) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) throw new Error('请求体过大');
    chunks.push(chunk);
  }
  if (size === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function sendJson(res, status, body) {
  let payload;
  try {
    payload = JSON.stringify(body);
  } catch {
    payload = '{"ok":false,"error":"unserializable"}';
  }
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(payload);
}

/* ── 自检 ─────────────────────────────────────────── */

const PROBE_SERVICES = [
  'sessions',
  'agents',
  'sessionController',
  'sessionProjections',
  'tokenMeter',
  'llm',
  'schedule',
  'jobs',
  'workspace',
  'webServer',
];

function membersOf(value) {
  const members = new Set();
  let proto = value;
  let depth = 0;
  while (proto && proto !== Object.prototype && depth < 4) {
    for (const key of safe(() => Object.getOwnPropertyNames(proto), [])) {
      if (key === 'constructor') continue;
      if (isFn(safe(() => value[key], undefined))) members.add(key);
    }
    proto = safe(() => Object.getPrototypeOf(proto), null);
    depth += 1;
  }
  return [...members].sort().slice(0, 60);
}

/** 只保留可 JSON 化的投影，避免把整棵会话图塞进诊断 */
function projectionPreview(row) {
  const values = row?.projections?.values ?? row?.projections ?? null;
  if (values === null || typeof values !== 'object') return null;
  const out = {};
  for (const key of Object.keys(values)) {
    const value = safe(() => values[key], null);
    out[key] = safe(() => JSON.parse(JSON.stringify(value)), '[unserializable]');
  }
  return out;
}

async function diagnose(ctx, { includeState = true } = {}) {
  const services = {};
  for (const key of PROBE_SERVICES) {
    const value = service(ctx, key);
    services[key] = value === undefined || value === null
      ? null
      : { type: typeof value, members: membersOf(value) };
  }

  const controller = service(ctx, 'sessionController');
  let rows = null;
  let listError = null;
  if (isFn(controller?.list)) {
    try {
      rows = await controller.list();
    } catch (error) {
      listError = String(error instanceof Error ? `${error.name}: ${error.message}` : error);
    }
  } else {
    listError = controller === undefined ? 'sessionController 不可用' : 'sessionController.list 不可用';
  }
  if (!Array.isArray(rows) || rows.length === 0) rows = lastRows;

  return {
    version: 6,
    services,
    listError,
    rawRowCount: Array.isArray(rows) ? rows.length : -1,
    rowCount: rows.length,
    rowKeys: rows[0] ? Object.keys(rows[0].raw ?? rows[0]) : [],
    rowSample: rows[0]
      ? {
          sessionId: rows[0].id,
          running: rows[0].running,
          updatedAt: rows[0].updatedAt,
          title: rows[0].title,
          rawTitle: rows[0].raw?.title,
          projectionKeys: Object.keys(rows[0].raw?.projections?.values ?? {}),
          rawProjections: safe(
            () => JSON.parse(JSON.stringify(rows[0].raw?.projections ?? null)),
            null,
          ),
        }
      : null,
    projectionPreview: rows[0] ? projectionPreview(rows[0].raw) : null,
    state: includeState ? await safeAsync(() => buildState(ctx), null) : null,
  };
}

/* ── 落盘自检 ─────────────────────────────────────── */

function replacer(_key, value) {
  if (typeof value === 'function') return `[fn ${value.name || 'anonymous'}]`;
  if (typeof value === 'bigint') return String(value);
  return value;
}

function dumpTo(file, value) {
  safe(() => writeFileSync(file, JSON.stringify(value, replacer, 2), 'utf8'));
}

/* ── 插件入口 ─────────────────────────────────────── */

export function apply(ctx) {
  const logger = ctx.logger ?? console;
  const disposers = [];

  safe(() => logger.info?.(`island: 状态接口就绪 ${STATE_PATH}`));
  // 挂全局事件监听（逐个 try/catch；缺事件不影响插件）
  // ctx.on 内部已带 fiber effect，这里再用 ctx.effect 统一收口，HMR 重载不泄漏
  const detach = notifier.attach(ctx, EVENT_DEFINITIONS);
  ctx.effect?.(() => () => detach(), 'island.notifications');
  disposers.push(detach);
  // 装载即留痕（一次性，不在轮询路径上）
  void (async () => dumpTo(DIAG_FILE, await diagnose(ctx, { includeState: false })))();

  disposers.push(
    ctx.webServer.register({
      kind: 'exact',
      path: STATE_PATH,
      handler: (req, res) => {
        if (!trusted(req)) return sendJson(res, 403, { ok: false, error: 'forbidden' });
        if (req.method !== 'GET' && req.method !== 'HEAD') {
          return sendJson(res, 405, { ok: false, error: 'method not allowed' });
        }
        // 热路径：只取一次快照（TTL 缓存 + 并发合并），不写磁盘、不跑诊断
        void (async () => {
          const snapshot = await currentSnapshot(ctx);
          sendJson(res, 200, snapshot);
        })();
        return undefined;
      },
    }),
  );

  disposers.push(
    ctx.webServer.register({
      kind: 'exact',
      path: ACTION_PATH,
      handler: (req, res) => {
        if (!trusted(req)) return sendJson(res, 403, { ok: false, error: 'forbidden' });
        if (req.method !== 'POST') {
          return sendJson(res, 405, { ok: false, error: 'method not allowed' });
        }
        void (async () => {
          let payload;
          try {
            payload = await readJsonBody(req);
          } catch (error) {
            return sendJson(res, 400, {
              ok: false,
              message: `请求无效：${error instanceof Error ? error.message : String(error)}`,
            });
          }
          const rejection = validateAction(ctx, payload);
          if (rejection) return sendJson(res, 422, { ok: false, message: rejection });
          const result = await runAction(ctx, payload, { system });
          // 成功的写动作会让旧快照过期，下一次轮询立刻看到新状态
          if (result?.ok) {
            cachedSnapshot = null;
            cachedAt = 0;
          }
          return sendJson(res, result.ok ? 200 : 422, result);
        })();
        return undefined;
      },
    }),
  );

  disposers.push(
    ctx.webServer.register({
      kind: 'exact',
      path: DIAG_PATH,
      handler: (req, res) => {
        if (!trusted(req)) return sendJson(res, 403, { ok: false, error: 'forbidden' });
        void (async () => {
          const diag = await safeAsync(() => diagnose(ctx), { ok: false });
          // 显式诊断时才落盘（含状态快照），轮询热路径完全不碰磁盘
          void (async () => {
            dumpTo(DIAG_FILE, diag);
            dumpTo(SNAPSHOT_FILE, diag?.state ?? { ok: false });
          })();
          sendJson(res, 200, { ...diag, actions: ACTION_NAMES });
        })();
        return undefined;
      },
    }),
  );

  ctx.effect?.(() => () => {
    for (const dispose of disposers.reverse()) safe(() => dispose?.());
    // 停掉后台采集定时器，避免 HMR 重载后留下孤儿进程
    system.stop();
  }, 'island.routes');
}
