/**
 * 岛仔 · DSH 悬浮信息岛 —— 浏览器端
 *
 * 挂在 shell.overlay 槽位（AppFrame 内 position:absolute;inset:0;pointer-events:none 的全屏层），
 * 自己钉在窗口最顶部那条空白带里，像一枚刘海。收起是一行状态，悬停/点击展开成信息面板。
 *
 * 数据全部来自同名宿主插件注册的只读接口 /island/state，这里只负责呈现。
 */
import { useEffect, useRef, useState } from 'react';
import STYLES from './styles.css';

const NS = 'island';

/** 宿主接口：只读快照，客户端按可见性与忙碌程度自适应轮询 */
const STATE_PATH = '/island/state';
const ACTION_PATH = '/island/action';
const POSITION_KEY = `${NS}.position`;

/** 悬停多久才展开：鼠标扫过窗口顶部时不会顺手弹出面板盖住正文 */
const HOVER_DELAY_MS = 180;

const POLL_ACTIVE_MS = 1500;
const POLL_IDLE_MS = 4000;
const POLL_HIDDEN_MS = 15000;

/** 样式命名空间前缀，避开 DSH 自己的类名 */
const CLS = 'dz';

const STYLE_ID = `${NS}-styles`;

/** 可开关的动效；每项对应一个 CSS 钩子 */
const MOTION_DEFS = [
  { key: 'drop',   label: '入场弹入',     hint: '首次出现时从上方轻轻落下',       default: true },
  { key: 'spring', label: '展开弹性',     hint: '悬停展开时的回弹曲线',           default: true },
  { key: 'bob',    label: '在跑浮动',     hint: '有会话运行时岛仔上下轻浮',       default: true },
  { key: 'blink',  label: '岛仔眨眼',     hint: '小生物每隔几秒眨一次眼',         default: true },
  { key: 'pulse',  label: '状态点呼吸',   hint: '运行状态点向外扩散的光晕',       default: true },
  { key: 'toast',  label: '提示动画',     hint: '操作回执弹出的缩放淡入',         default: true },
  { key: 'hover',  label: '悬停展开',     hint: '关闭后只能点击岛体展开',         default: true },
  { key: 'reduce', label: '跟随系统减少动效', hint: '系统开启「减少动态效果」时自动全关', default: true },
  { key: 'notify', label: '状态提示',     hint: '完成时与异常时弹出提示；关闭后只在面板里留记录', default: true },
];

const MOTION_KEY = `${NS}.motion`;

function readMotion() {
  const defaults = Object.fromEntries(MOTION_DEFS.map((d) => [d.key, d.default]));
  try {
    const raw = window.localStorage.getItem(MOTION_KEY);
    if (!raw) return defaults;
    const saved = JSON.parse(raw);
    if (!saved || typeof saved !== 'object') return defaults;
    return { ...defaults, ...saved };
  } catch {
    return defaults;
  }
}

function writeMotion(value) {
  try {
    window.localStorage.setItem(MOTION_KEY, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

/** 动效配置的共享 store：设置页与岛体通过它即时同步（同一页面内） */
const MOTION_EVENT = 'xcool-dsh-island:motion';
function broadcastMotion(value) {
  try {
    window.dispatchEvent(new CustomEvent(MOTION_EVENT, { detail: value }));
  } catch {
    /* ignore */
  }
}

function useMotion() {
  const [motion, setMotion] = useState(readMotion);
  useEffect(() => {
    const onChange = (event) => setMotion({ ...readMotion(), ...(event.detail ?? {}) });
    window.addEventListener(MOTION_EVENT, onChange);
    const onStorage = (event) => {
      if (event.key === MOTION_KEY) setMotion(readMotion());
    };
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(MOTION_EVENT, onChange);
      window.removeEventListener('storage', onStorage);
    };
  }, []);
  const update = (key, value) => {
    const next = { ...motion, [key]: value };
    setMotion(next);
    writeMotion(next);
    broadcastMotion(next);
  };
  const reset = () => {
    const defaults = Object.fromEntries(MOTION_DEFS.map((d) => [d.key, d.default]));
    setMotion(defaults);
    writeMotion(defaults);
    broadcastMotion(defaults);
  };
  return { motion, update, reset };
}

/** 生成 data-motion-* 属性，供 CSS 逐项关闭动画 */
function motionAttrs(motion) {
  const attrs = {};
  for (const def of MOTION_DEFS) {
    attrs[`data-motion-${def.key}`] = motion[def.key] === false ? 'off' : 'on';
  }
  return attrs;
}


/* ── 数据 ─────────────────────────────────────────── */

const EMPTY_STATE = {
  ok: false,
  sessions: 0,
  runningCount: 0,
  busy: false,
  session: null,
  usage: null,
  todos: [],
  jobs: [],
  schedule: [],
  approvals: [],
};

/**
 * 判定两次快照是否"看起来一样"：忽略 updatedAt 心跳，只比 UI 真正用到的字段。
 * 内容用短 JSON 比，数组顺序变化也算变化（顺序本身会影响显示）。
 */
function sameState(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  const keys = [
    'ok', 'sessions', 'runningCount', 'busy', 'session',
    'usage', 'tokens', 'todos', 'jobs', 'schedule', 'approvals',
    'notificationsSeq',
  ];
  for (const key of keys) {
    const av = key === 'notificationsSeq' ? a.notifications?.seq : a[key];
    const bv = key === 'notificationsSeq' ? b.notifications?.seq : b[key];
    if (typeof av === 'object' || typeof bv === 'object') {
      if (JSON.stringify(av) !== JSON.stringify(bv)) return false;
    } else if (av !== bv) {
      return false;
    }
  }
  return true;
}

function useIslandState() {
  const [state, setState] = useState(EMPTY_STATE);
  const [reachable, setReachable] = useState(true);

  useEffect(() => {
    let alive = true;
    let timer;

    const poll = async () => {
      let next = POLL_IDLE_MS;
      try {
        const res = await fetch(STATE_PATH, { cache: 'no-store', credentials: 'same-origin' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!alive) return;
        const merged = { ...EMPTY_STATE, ...data, ok: true };
        // 状态没实质变化时不 setState，避免每 1.5s 触发整棵岛体重渲染
        setState((prev) => (sameState(prev, merged) ? prev : merged));
        setReachable(true);
        const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
        next = hidden ? POLL_HIDDEN_MS : data?.busy ? POLL_ACTIVE_MS : POLL_IDLE_MS;
      } catch {
        if (!alive) return;
        setReachable(false);
        setState((prev) => ({ ...prev, ok: false, busy: false, runningCount: 0 }));
        next = POLL_HIDDEN_MS;
      }
      timer = setTimeout(poll, next);
    };

    void poll();
    return () => {
      alive = false;
      if (timer !== undefined) clearTimeout(timer);
    };
  }, []);

  return { state, reachable };
}

/** 调用宿主动作；结果以 toast 形式反馈，失败也不打断岛体 */

/** 把可能是命令全文的详情压成一行：路径只留文件名，超长省略 */
function compactDetail(text, max = 42) {
  let s = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (!s) return '';
  // 命令常带多个路径：取最后一个带脚本后缀的 token，只显示文件名
  const tokens = s.split(/[\s"']+/).filter(Boolean);
  let picked = '';
  for (const token of tokens) {
    const m = token.match(/([^\\/\s]+\.(?:ps1|mjs|js|ts|cmd|bat|py|sh|exe))$/i);
    if (m) picked = m[1];
  }
  if (picked) s = picked;
  else if (s.length > max) s = s.slice(0, max - 1) + '…';
  return s;
}

/** 监听宿主下发的通知流：只弹「本次会话没见过」的，刷新页面不重放历史 */
function useNotifications(state, show, motion) {
  const lastSeq = useRef(null);
  const showRef = useRef(show);
  showRef.current = show;
  const latest = state?.notifications?.seq ?? null;
  const notifyEnabled = motion?.notify !== false;

  useEffect(() => {
    const payload = state?.notifications;
    if (!payload || typeof payload.seq !== 'number') return;
    const items = Array.isArray(payload.items) ? payload.items : [];

    // 首次拿到快照：记下水线，不回放历史
    if (lastSeq.current === null) {
      lastSeq.current = payload.seq;
      return;
    }
    // 宿主重启后 seq 会变小：重新对齐水线，不回放、也不卡死
    if (payload.seq < lastSeq.current) {
      lastSeq.current = payload.seq;
      return;
    }
    if (payload.seq <= lastSeq.current) return;

    const fresh = items.filter((item) => item.seq > lastSeq.current);
    lastSeq.current = payload.seq;
    if (fresh.length === 0) return;

    // 开关关闭时只推进水线，不弹
    if (!notifyEnabled) return;
    // 只弹「完成 / 异常」；「开始运行」交给岛体状态点表达，避免每跑一条命令就弹
    const toastable = fresh.filter((item) => item.kind === 'success' || item.kind === 'error');
    for (const item of toastable.slice(-2)) {
      const detail = compactDetail(item.detail);
      showRef.current(item.title || '状态更新', item.kind === 'error' ? 'error' : 'success', detail);
    }
  }, [latest, notifyEnabled]);
}

function useAction() {
  const [toast, setToast] = useState(null);
  const timer = useRef(0);

  /**
   * 弹一条回执。kind: 'running' | 'success' | 'error'；
   * 兼容旧的布尔 ok 参数（true→success，false→error）。
   */
  const show = (text, okOrKind = true, detail = '') => {
    const kind =
      typeof okOrKind === 'string'
        ? okOrKind
        : okOrKind
          ? 'success'
          : 'error';
    if (timer.current) clearTimeout(timer.current);
    setToast({ text, detail, kind, id: Date.now() });
    timer.current = window.setTimeout(() => setToast(null), kind === 'running' ? 2200 : 3200);
  };

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const run = async (action, payload = {}) => {
    try {
      const res = await fetch(ACTION_PATH, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ action, ...payload }),
      });
      const result = await res.json();
      // 宿主侧没有 clipboard 服务时，退回浏览器剪贴板
      if (result?.fallback && result?.text) {
        await copyToClipboard(result.text);
        show('已复制', true);
        return { ok: true };
      }
      show(result?.message || (result?.ok ? '完成' : '操作失败'), Boolean(result?.ok));
      return result ?? { ok: false };
    } catch (error) {
      show(`操作失败：${error instanceof Error ? error.message : String(error)}`, false);
      return { ok: false };
    }
  };

  return { toast, run, show };
}

async function copyToClipboard(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* 走下面的兜底 */
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

/** 拖动定位：按住岛体可拖，位置记在 localStorage */
function usePosition() {
  const [pos, setPos] = useState(() => {
    try {
      const raw = window.localStorage.getItem(POSITION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Number.isFinite(parsed?.x) && Number.isFinite(parsed?.y)) return parsed;
      }
    } catch {
      /* ignore */
    }
    return null;
  });
  const drag = useRef(null);

  const onPointerDown = (event) => {
    // 按钮 / 皮肤圆点 / 表单控件不触发拖动
    if (event.target.closest('button, input, a, [data-no-drag]')) return;
    if (event.button !== 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    drag.current = {
      startX: event.clientX,
      startY: event.clientY,
      baseX: rect.left,
      baseY: rect.top,
      moved: false,
    };
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* ignore */
    }
  };

  const onPointerMove = (event) => {
    const d = drag.current;
    if (!d) return;
    const dx = event.clientX - d.startX;
    const dy = event.clientY - d.startY;
    if (!d.moved && Math.abs(dx) + Math.abs(dy) < 4) return;
    d.moved = true;
    const maxX = Math.max(0, window.innerWidth - 120);
    const maxY = Math.max(0, window.innerHeight - 60);
    setPos({
      x: Math.min(maxX, Math.max(0, d.baseX + dx)),
      y: Math.min(maxY, Math.max(0, d.baseY + dy)),
    });
  };

  const onPointerUp = () => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    if (!d.moved) return;
    try {
      const raw = window.localStorage.getItem(POSITION_KEY);
      void raw;
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    if (!pos) return;
    try {
      window.localStorage.setItem(POSITION_KEY, JSON.stringify(pos));
    } catch {
      /* ignore */
    }
  }, [pos]);

  const reset = () => {
    try {
      window.localStorage.removeItem(POSITION_KEY);
    } catch {
      /* ignore */
    }
    setPos(null);
  };

  return { pos, drag, onPointerDown, onPointerMove, onPointerUp, reset };
}

/* ── 小组件 ───────────────────────────────────────── */

function Pet({ tone }) {
  return (
    <svg
      className={`${CLS}-pet`}
      viewBox="0 0 24 24"
      data-tone={tone}
      data-live={tone === 'live' ? 'true' : 'false'}
      aria-hidden="true"
    >
      <rect className="body" x="2.5" y="5" width="19" height="14" rx="7" />
      <g className="eyes">
        <circle className="eye" cx="9.5" cy="12" r="1.7" />
        <circle className="eye" cx="14.5" cy="12" r="1.7" />
      </g>
      {/* 在跑时嘴边冒一个小气泡，让岛仔看起来在"说话" */}
      <circle className="speech" cx="20.5" cy="6.5" r="1.5" />
    </svg>
  );
}

function Ring({ percent }) {
  const radius = 6;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, Number(percent) || 0));
  const filled = (clamped / 100) * circumference;
  return (
    <svg className={`${CLS}-ring`} viewBox="0 0 15 15" aria-hidden="true">
      <defs>
        <linearGradient id="dzRingGradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0a84ff" />
          <stop offset="55%" stopColor="#5ac8fa" />
          <stop offset="100%" stopColor="#bf5af2" />
        </linearGradient>
      </defs>
      <circle className="bg" cx="7.5" cy="7.5" r={radius} />
      <circle
        className="fg"
        cx="7.5"
        cy="7.5"
        r={radius}
        strokeDasharray={`${filled} ${circumference - filled}`}
      />
      <g className="orbit">
        <circle cx="7.5" cy="1.6" r="1.3" />
      </g>
    </svg>
  );
}

function Section({ title, extra, children }) {
  return (
    <div className={`${CLS}-section`}>
      <div className={`${CLS}-section-head`}>
        <b>{title}</b>
        {extra ? <span>{extra}</span> : null}
      </div>
      {children}
    </div>
  );
}

function Empty({ children }) {
  return <div className={`${CLS}-empty`}>{children}</div>;
}

/* ── 岛主体 ───────────────────────────────────────── */

function formatAgo(at) {
  if (!Number.isFinite(at)) return '';
  const delta = Math.max(0, Math.round((Date.now() - at) / 1000));
  if (delta < 10) return '刚刚';
  if (delta < 60) return `${delta} 秒前`;
  if (delta < 3600) return `${Math.floor(delta / 60)} 分钟前`;
  return `${Math.floor(delta / 3600)} 小时前`;
}

const SKINS = [
  { id: 'ink', color: '#2a2a31', label: '深空' },
  { id: 'cream', color: '#f2e8d8', label: '奶油' },
  { id: 'glass', color: '#cfe4ff', label: '玻璃' },
];

const SKIN_KEY = `${NS}.skin`;

function readSkin() {
  try {
    const stored = window.localStorage.getItem(SKIN_KEY);
    if (stored === 'ink' || stored === 'cream' || stored === 'glass') return stored;
  } catch {
    /* localStorage 可能被禁用 */
  }
  return 'ink';
}

function Island() {
  const { state, reachable } = useIslandState();
  const { toast, run, show } = useAction();
  const position = usePosition();
  const { motion, update: updateMotion, reset: resetMotion } = useMotion();
  useNotifications(state, show, motion);
  const [showMotion, setShowMotion] = useState(false);
  // 离线预览页 ?expand=1 强制展开；生产环境不带该参数
  const [pinned, setPinned] = useState(() => {
    try {
      return new URLSearchParams(window.location.search).get('expand') === '1';
    } catch {
      return false;
    }
  });
  const [hovered, setHovered] = useState(false);
  const [skin, setSkin] = useState(readSkin);
  const rootRef = useRef(null);
  const hoverTimer = useRef(0);

  const expanded = pinned || hovered;

  useEffect(() => {
    try {
      window.localStorage.setItem(SKIN_KEY, skin);
    } catch {
      /* ignore */
    }
  }, [skin]);

  // 悬停延迟展开（可在设置里关掉，关掉后只靠点击）
  const handleEnter = () => {
    if (pinned || motion.hover === false) return;
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => setHovered(true), HOVER_DELAY_MS);
  };
  const handleLeave = () => {
    if (hoverTimer.current) {
      clearTimeout(hoverTimer.current);
      hoverTimer.current = 0;
    }
    setHovered(false);
  };
  useEffect(
    () => () => {
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
    },
    [],
  );

  // 钉住时：Esc 或点空白处收起
  useEffect(() => {
    if (!pinned) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') setPinned(false);
    };
    const onDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) setPinned(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onDown, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onDown, true);
    };
  }, [pinned]);

  const usagePercent = state.usage?.percent ?? null;
  const approvals = state.approvals ?? [];
  const todos = state.todos ?? [];
  const jobs = state.jobs ?? [];
  const notices = (state.notifications?.items ?? []).slice(-3).reverse();
  const schedule = state.schedule ?? [];
  const runningCount = state.runningCount ?? (state.busy ? 1 : 0);
  const openTodos = todos.filter((item) => !item.done);

  // ── 客户端动作（不写会话日志，优先走 DSH 自己的正规路径） ──
  const openSession = (sessionId) => {
    if (!sessionId) return;
    const ui = clientService('uiWorkspace');
    try {
      if (ui && typeof ui.openSession === 'function') {
        ui.openSession(sessionId);
        show('已切到该会话', true);
        return;
      }
    } catch (error) {
      show(`切换失败：${error instanceof Error ? error.message : String(error)}`, false);
      return;
    }
    show('该版本不支持从岛体切换会话', false);
  };

  const startNewSession = async () => {
    const ui = clientService('uiWorkspace');
    try {
      if (ui && typeof ui.startSession === 'function') {
        ui.startSession();
        show('已新建会话', true);
        return;
      }
    } catch (error) {
      show(`新建失败：${error instanceof Error ? error.message : String(error)}`, false);
      return;
    }
    // 退到宿主端
    const result = await run('newSession');
    if (result?.ok && result?.sessionId) openSession(result.sessionId);
  };

  const cancelTurn = async () => {
    const remote = clientService('remote');
    const sessionId = state.session?.id;
    try {
      if (remote && typeof remote.session?.cancel === 'function' && sessionId) {
        await remote.session.cancel({ sessionId });
        show('已请求停止当前轮次', true);
        return;
      }
    } catch {
      /* 退到宿主 */
    }
    void run('stopTurn');
  };

  const tone = !reachable
    ? 'idle'
    : approvals.length > 0
      ? 'alert'
      : runningCount > 0
        ? 'live'
        : usagePercent !== null && usagePercent >= 85
          ? 'warn'
          : 'idle';

  const title = !reachable
    ? '宿主未连接'
    : state.session?.title || (state.sessions > 0 ? `${state.sessions} 个会话` : '空闲');

  return (
    <div
      className={`${CLS}-root`}
      ref={rootRef}
      data-dragged={position.pos ? 'true' : 'false'}
      {...motionAttrs(motion)}
      style={
        position.pos
          ? { position: 'fixed', top: position.pos.y, left: position.pos.x, right: 'auto' }
          : undefined
      }
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <div
        className={`${CLS}-island`}
        data-expanded={expanded ? 'true' : 'false'}
        data-skin={skin}
        role="button"
        tabIndex={0}
        onPointerDown={position.onPointerDown}
        onPointerMove={position.onPointerMove}
        onPointerUp={position.onPointerUp}
        onPointerCancel={position.onPointerUp}
        onClick={(event) => {
          if (position.drag.current?.moved) return;
          setPinned((value) => !value);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setPinned((value) => !value);
          }
        }}
      >
        <span className={`${CLS}-aurora`} aria-hidden="true" />
        <span className={`${CLS}-shimmer`} aria-hidden="true" />
        <div className={`${CLS}-bar`}>
          <span className={`${CLS}-sensor`} data-side="left" aria-hidden="true" />
          <Pet tone={tone} />
          <span className={`${CLS}-title`} title={title}>
            {title}
          </span>
          {expanded && state.session?.model ? (
            <span className={`${CLS}-meta`}>{state.session.model}</span>
          ) : null}
          {runningCount > 1 ? (
            <span className={`${CLS}-pill`}>{runningCount} 在跑</span>
          ) : null}
          {usagePercent !== null ? (
            <span className={`${CLS}-usage`}>
              <Ring percent={usagePercent} />
              <b>{usagePercent}%</b>
            </span>
          ) : null}
          {approvals.length > 0 ? (
            <span className={`${CLS}-badge`}>{approvals.length}</span>
          ) : null}
          {runningCount > 0 ? (
            <span className={`${CLS}-thinking`} aria-hidden="true">
              <i /><i /><i />
            </span>
          ) : null}
          <span className={`${CLS}-sensor`} data-side="right" aria-hidden="true" />
        </div>

        <div className={`${CLS}-panel`}>
          <div className={`${CLS}-panel-inner`}>
            <div className={`${CLS}-body`}>
              {notices.length > 0 ? (
                <Section title="最近状态" extra={`${notices.length} 条`}>
                  {notices.map((item) => (
                    <div className={`${CLS}-row`} key={item.id ?? item.seq}>
                      <span className={`${CLS}-notice-dot`} data-kind={item.kind} />
                      <span className={`${CLS}-row-text`}>{item.title}</span>
                      <span className={`${CLS}-row-sub`}>{item.detail || formatAgo(item.at)}</span>
                    </div>
                  ))}
                </Section>
              ) : null}
              {jobs.length > 0 ? (
                <Section title="运行中" extra={`${jobs.length} 个会话`}>
                  {jobs.slice(0, 4).map((job, index) => (
                    <div
                      className={`${CLS}-row`}
                      key={job.id ?? index}
                      role="button"
                      tabIndex={0}
                      title="点击切到该会话"
                      data-no-drag
                      onClick={(event) => { event.stopPropagation(); openSession(job.id); }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') { event.preventDefault(); openSession(job.id); }
                      }}
                    >
                      <span className={`${CLS}-dot`} data-live="true" data-tone="live" />
                      <span className={`${CLS}-row-text`}>{job.title || '会话'}</span>
                      <span className={`${CLS}-row-sub`}>{(job.kinds ?? []).join(' · ')}</span>
                    </div>
                  ))}
                </Section>
              ) : null}

              {approvals.length > 0 ? (
                <Section title="待审批" extra={`${approvals.length}`}>
                  {approvals.slice(0, 3).map((item, index) => (
                    <div className={`${CLS}-row`} key={item.id ?? index}>
                      <span className={`${CLS}-badge`}>!</span>
                      <span className={`${CLS}-row-text`}>{item.title || '需要你的确认'}</span>
                    </div>
                  ))}
                </Section>
              ) : null}

              <Section
                title="待办"
                extra={openTodos.length > 0 ? `${openTodos.length} 项未完成` : undefined}
              >
                {todos.length === 0 ? (
                  <Empty>当前会话没有待办</Empty>
                ) : (
                  todos.slice(0, 5).map((item, index) => (
                    <div className={`${CLS}-row`} key={index}>
                      <span className={`${CLS}-check`} data-done={item.done ? 'true' : 'false'} />
                      <span className={`${CLS}-row-text`} data-done={item.done ? 'true' : 'false'}>
                        {item.content}
                      </span>
                    </div>
                  ))
                )}
              </Section>

              <Section title="日程">
                {schedule.length === 0 ? (
                  <Empty>没有临近的提醒</Empty>
                ) : (
                  schedule.slice(0, 3).map((item, index) => (
                    <div className={`${CLS}-row`} key={item.id ?? index}>
                      <span className={`${CLS}-row-sub`}>{item.when || ''}</span>
                      <span className={`${CLS}-row-text`}>{item.title}</span>
                      {item.id ? (
                        <button
                          type="button"
                          className={`${CLS}-mini`}
                          title="删除这条提醒"
                          data-no-drag
                          onClick={(event) => {
                            event.stopPropagation();
                            void run('deleteReminder', { id: item.id });
                          }}
                        >✕</button>
                      ) : null}
                    </div>
                  ))
                )}
              </Section>

              <Section title="额度">
                {usagePercent === null ? (
                  <Empty>暂无用量信息</Empty>
                ) : (
                  <>
                    <div className={`${CLS}-row`}>
                      <span className={`${CLS}-row-text`}>上下文占用</span>
                      <span className={`${CLS}-row-sub`}>
                        {state.usage?.label || `${usagePercent}%`}
                      </span>
                    </div>
                    <div
                      className={`${CLS}-meter`}
                      data-tone={usagePercent >= 85 ? 'alert' : usagePercent >= 60 ? 'warn' : 'ok'}
                    >
                      <i style={{ width: `${Math.min(100, usagePercent)}%` }} />
                    </div>
                  </>
                )}
              </Section>

            </div>

            <div className={`${CLS}-quick`} data-no-drag>
              <Section title="快捷操作">
                <div className={`${CLS}-actions`}>
                  <button type="button" className={`${CLS}-action`}
                    onClick={(e) => { e.stopPropagation(); void startNewSession(); }}>
                    ＋ 新会话
                  </button>
                  <button type="button" className={`${CLS}-action`}
                    disabled={runningCount === 0}
                    onClick={(e) => { e.stopPropagation(); void cancelTurn(); }}>
                    ■ 停止轮次
                  </button>
                  <button type="button" className={`${CLS}-action`}
                    onClick={(e) => { e.stopPropagation(); void run('remind', { minutes: 5, text: '' }); }}>
                    ⏱ 5 分钟提醒
                  </button>
                  <button type="button" className={`${CLS}-action`}
                    onClick={(e) => { e.stopPropagation(); void run('remind', { minutes: 30, text: '' }); }}>
                    ⏱ 30 分钟
                  </button>
                  <button type="button" className={`${CLS}-action`}
                    onClick={async (e) => {
                      e.stopPropagation();
                      const ok = await copyToClipboard(
                        state.session?.title || title || 'DSH 信息岛'
                      );
                      show(ok ? '已复制会话标题' : '复制失败', ok);
                    }}>
                    ⧉ 复制标题
                  </button>
                  <button type="button" className={`${CLS}-action`}
                    onClick={(e) => {
                      e.stopPropagation();
                      position.reset();
                      show('已回到默认位置', true);
                    }}>
                    ⌖ 复位
                  </button>
                  <button type="button" className={`${CLS}-action`}
                    data-active={showMotion ? 'true' : 'false'}
                    onClick={(e) => { e.stopPropagation(); setShowMotion((v) => !v); }}>
                    ⚙ 动效
                  </button>
                </div>

                {showMotion ? (
                  <div className={`${CLS}-motion-panel`} data-no-drag {...motionAttrs(motion)}>
                    <div className={`${CLS}-motion-head`}>
                      <b>动效开关</b>
                      <button type="button" onClick={() => resetMotion()}>恢复默认</button>
                    </div>
                    <div className={`${CLS}-motion-grid`}>
                      {MOTION_DEFS.map((def) => (
                        <label className={`${CLS}-motion-item`} key={def.key} title={def.hint}>
                          <input
                            type="checkbox"
                            checked={motion[def.key] !== false}
                            onChange={(event) => updateMotion(def.key, event.target.checked)}
                          />
                          <span className={`${CLS}-switch`} aria-hidden="true" />
                          <span>{def.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ) : null}
              </Section>
            </div>

            <div className={`${CLS}-foot`}>
              <span>{state.sessions > 0 ? `${state.sessions} 个会话` : '无会话'}</span>
              {state.tokens ? <span>{state.tokens} tokens</span> : null}
              <div
                className={`${CLS}-skins`}
                onClick={(event) => event.stopPropagation()}
                role="group"
              >
                {SKINS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    title={option.label}
                    aria-label={option.label}
                    className={`${CLS}-skin`}
                    data-active={skin === option.id ? 'true' : 'false'}
                    style={{ background: option.color }}
                    onClick={() => setSkin(option.id)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      {toast ? (
        <div className={`${CLS}-toast`} data-kind={toast.kind ?? 'success'} key={toast.id}>
          <span className={`${CLS}-toast-icon`}>
            {toast.kind === 'error' ? '!' : toast.kind === 'running' ? '◌' : '✓'}
          </span>
          <span className={`${CLS}-toast-copy`}>
            <b>{toast.text}</b>
            {toast.detail ? <small>{toast.detail}</small> : null}
          </span>
        </div>
      ) : null}
    </div>
  );
}

/* ── 设置页：动效开关 ─────────────────────────────── */

function IslandSettingsSection() {
  const { motion, update, reset } = useMotion();
  const [previewPulse, setPreviewPulse] = useState(0);

  // 每次改动后重放一次预览动画；配置广播由 useMotion().update 负责
  const preview = () => setPreviewPulse((n) => n + 1);

  return (
    <div className={`${CLS}-settings`} data-no-drag {...motionAttrs(motion)}>
      <div className={`${CLS}-settings-head`}>
        <div>
          <div className={`${CLS}-settings-title`}>XCool-DSH灵动岛 · 动效</div>
          <div className={`${CLS}-settings-sub`}>
            逐项开关，改动立即生效并保存到本机（localStorage）
          </div>
        </div>
        <button type="button" className={`${CLS}-settings-reset`} onClick={reset}>
          恢复默认
        </button>
      </div>

      <div className={`${CLS}-settings-grid`}>
        {MOTION_DEFS.map((def) => (
          <label className={`${CLS}-settings-row`} key={def.key} title={def.hint}>
            <span className={`${CLS}-settings-copy`}>
              <b>{def.label}</b>
              <small>{def.hint}</small>
            </span>
            <input
              type="checkbox"
              role="switch"
              checked={motion[def.key] !== false}
              onChange={(event) => {
                update(def.key, event.target.checked);
                preview();
              }}
            />
            <span className={`${CLS}-switch`} aria-hidden="true" />
          </label>
        ))}
      </div>

      <div className={`${CLS}-settings-foot`} key={previewPulse}>
        <span className={`${CLS}-settings-demo`} data-skin="ink">
          <svg className={`${CLS}-pet`} viewBox="0 0 24 24" data-tone="live" data-live="true" aria-hidden="true">
            <rect className="body" x="2.5" y="5" width="19" height="14" rx="7" />
            <circle className="eye" cx="9.5" cy="12" r="1.7" />
            <circle className="eye" cx="14.5" cy="12" r="1.7" />
          </svg>
          <span className={`${CLS}-dot`} data-live="true" data-tone="live" />
          <span>预览：岛仔会眨眼、浮动，状态点会呼吸</span>
        </span>
      </div>
    </div>
  );
}

/* ── 插件入口 ─────────────────────────────────────── */

export const name = `${NS}-client`;

/** cordis 服务依赖：只硬依赖槽位；uiWorkspace / remote 通过可选 ctx 调用 */
export const inject = ['slots'];

/** 由 apply 注入，组件里用它做「切会话 / 新会话 / 停止」等客户端动作 */
let clientCtx = null;

/** 安全取客户端服务：没有就返回 undefined，不影响岛体 */
function clientService(key) {
  try {
    return clientCtx && typeof clientCtx.get === 'function' ? clientCtx.get(key) : clientCtx?.[key];
  } catch {
    return undefined;
  }
}

export function apply(ctx) {
  ensureStyles();
  clientCtx = ctx;

  const slots = ctx?.slots;
  if (!slots?.inject) {
    console.warn('[island] 客户端缺少 slots 服务，跳过挂载');
    return;
  }

  const disposers = [];
  disposers.push(
    slots.inject('shell.overlay', () =>
      slots.register(
        {
          name: 'shell.overlay',
          id: `${NS}.overlay`,
          order: 60,
        },
        Island,
      ),
    ),
  );

  // 设置页：动效开关（与 qqbot 相同的 settings.section 注册方式）
  disposers.push(
    slots.inject('settings.section', () =>
      slots.register(
        {
          name: 'settings.section',
          id: 'xcool-dsh-island',
          order: 61,
          label: 'XCool-DSH灵动岛',
        },
        IslandSettingsSection,
      ),
    ),
  );

  ctx.effect?.(() => () => {
    for (const dispose of disposers.reverse()) dispose?.();
    document.getElementById(STYLE_ID)?.remove();
  }, 'island.overlay');
}

/** 样式在模块求值时注入；热替换后要覆盖旧内容，否则改了 CSS 看不到变化 */
function ensureStyles() {
  if (typeof document === 'undefined') return;
  const existing = document.getElementById(STYLE_ID);
  if (existing !== null) {
    if (existing.textContent !== STYLES) existing.textContent = STYLES;
    return;
  }
  const style = document.createElement('style');
  style.id = STYLE_ID;
  // 标上归属，客户端模块系统据此在卸载时回收样式
  style.setAttribute('data-plugin', 'xcool-dsh-island');
  style.setAttribute('data-plugin-css', 'island');
  style.textContent = STYLES;
  document.head.appendChild(style);
}
