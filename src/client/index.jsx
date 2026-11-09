/**
 * 岛仔 · DSH 悬浮信息岛 —— 浏览器端
 *
 * 挂在 shell.overlay 槽位（AppFrame 内 position:absolute;inset:0;pointer-events:none 的全屏层），
 * 自己钉在窗口最顶部那条空白带里，像一枚刘海。收起是一行状态，悬停/点击展开成信息面板。
 *
 * 数据全部来自同名宿主插件注册的只读接口 /island/state，这里只负责呈现。
 */
import { useEffect, useRef, useState } from 'react';

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

const STYLES = `
.dz-root {
  position: fixed;
  /* Windows 顶部是 --dsh-windows-titlebar-height 的拖拽条（app-region: drag），
     用 fixed + 高 z-index + no-drag 才能像 DSH 侧栏按钮一样在这条上收到鼠标事件 */
  top: calc((var(--dsh-windows-titlebar-height, 40px) - 37px) / 2);
  left: 0;
  right: 0;
  z-index: 40;
  display: flex;
  flex-direction: column;
  align-items: center;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display",
    "Segoe UI Variable", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
  font-size: 12px;
  line-height: 1.4;
  color: #fff;
  pointer-events: none;
  -webkit-app-region: no-drag;
  -webkit-font-smoothing: antialiased;
}
.dz-root > * { pointer-events: auto; -webkit-app-region: no-drag; }

/* ── 岛体：iOS 灵动岛 = 纯黑胶囊 ─────────────────── */
.dz-island {
  --dz-bg: #000;
  --dz-fill: rgba(255, 255, 255, 0.075);
  --dz-fill-2: rgba(255, 255, 255, 0.12);
  --dz-label: #fff;
  --dz-2: rgba(235, 235, 245, 0.6);
  --dz-3: rgba(235, 235, 245, 0.32);
  --dz-sep: rgba(255, 255, 255, 0.09);
  --dz-blue: #0a84ff;
  --dz-green: #30d158;
  --dz-orange: #ff9f0a;
  --dz-red: #ff453a;
  --dz-accent: var(--dz-blue);
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  width: 326px;
  max-width: min(560px, calc(100vw - 24px));
  border-radius: 999px;
  background: var(--dz-bg);
  box-shadow:
    0 0 0 .5px rgba(255, 255, 255, 0.1),
    0 10px 34px rgba(0, 0, 0, 0.5),
    0 0 18px rgba(10, 132, 255, .18);
  animation: dz-drop .5s cubic-bezier(.32, 1.3, .5, 1), dz-glow 4.5s ease-in-out infinite .5s;
  overflow: hidden;
  cursor: pointer;
  transform-origin: top center;
  -webkit-app-region: no-drag;
  --dz-spring: cubic-bezier(.32, 1.35, .5, 1);
  transition:
    width .44s var(--dz-spring),
    border-radius .44s var(--dz-spring),
    box-shadow .3s ease,
    background-color .3s ease;
  animation: dz-drop .5s cubic-bezier(.32, 1.3, .5, 1);
}
.dz-island[data-expanded='true'] {
  width: 396px;
  border-radius: 26px;
  box-shadow: 0 0 0 .5px rgba(255, 255, 255, 0.13), 0 20px 56px rgba(0, 0, 0, 0.62);
}
/* 皮肤：奶油 / 毛玻璃（默认纯黑最像灵动岛） */
.dz-island[data-skin='cream'] {
  --dz-bg: rgba(250, 248, 244, 0.96);
  --dz-fill: rgba(60, 50, 35, 0.055);
  --dz-fill-2: rgba(60, 50, 35, 0.1);
  --dz-label: #1c1c1e;
  --dz-2: rgba(60, 60, 67, 0.6);
  --dz-3: rgba(60, 60, 67, 0.35);
  --dz-sep: rgba(60, 50, 35, 0.1);
  --dz-accent: #b06a2c;
  box-shadow: 0 0 0 .5px rgba(0, 0, 0, 0.08), 0 10px 34px rgba(60, 40, 20, 0.22);
  backdrop-filter: blur(24px) saturate(160%);
  -webkit-backdrop-filter: blur(24px) saturate(160%);
}
.dz-island[data-skin='glass'] {
  --dz-bg: rgba(28, 28, 32, 0.42);
  --dz-fill: rgba(255, 255, 255, 0.1);
  --dz-fill-2: rgba(255, 255, 255, 0.17);
  --dz-accent: #64d2ff;
  --dz-label: #fff;
  --dz-2: rgba(255, 255, 255, 0.7);
  --dz-3: rgba(255, 255, 255, 0.45);
  --dz-sep: rgba(255, 255, 255, 0.16);
  box-shadow: 0 0 0 .5px rgba(255, 255, 255, 0.24), 0 16px 46px rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(30px) saturate(180%);
  -webkit-backdrop-filter: blur(30px) saturate(180%);
}
/* 顶部一道极淡高光，模拟岛面玻璃 */
.dz-island::before {
  content: '';
  position: absolute;
  inset: 0 0 auto 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.18), transparent);
  pointer-events: none;
  z-index: 3;
}
/* 岛面流光：一道很淡的渐变光带周期性扫过，像玻璃下的传感器反光 */
.dz-bar::before {
  content: '';
  position: absolute;
  position: absolute;
  inset: -40%;
  z-index: 0;
  pointer-events: none;
  background:
    radial-gradient(closest-side, rgba(10, 132, 255, .30), transparent 70%),
    radial-gradient(closest-side, rgba(90, 200, 250, .22), transparent 70%),
    radial-gradient(closest-side, rgba(191, 90, 242, .18), transparent 70%);
  background-size: 55% 90%, 48% 80%, 60% 95%;
  background-position: 12% 30%, 78% 65%, 45% 90%;
  background-repeat: no-repeat;
  filter: blur(14px);
  animation: dz-aurora 11s ease-in-out infinite alternate;
  opacity: .9;
}
/* 上面那层扫光保留，但更亮一点、周期短一点 */
.dz-island > .dz-bar { position: relative; z-index: 2; }
.dz-island > .dz-panel { position: relative; z-index: 2; }
.dz-island > .dz-foot { position: relative; z-index: 2; }
.dz-quick { position: relative; z-index: 2; }
.dz-bar::after {
  content: '';
  position: absolute;
  position: absolute;
  inset: 0;
  z-index: 3;
  pointer-events: none;
  background: linear-gradient(105deg,
    transparent 34%,
    rgba(255, 255, 255, .07) 46%,
    rgba(255, 255, 255, .16) 50%,
    rgba(255, 255, 255, .07) 54%,
    transparent 66%);
  background-size: 260% 100%;
  background-position: 180% 0;
  animation: dz-shimmer 5.5s cubic-bezier(.4, 0, .2, 1) infinite;
}
/* 展开时整块岛做一次轻微挤压回弹，而不是单纯变宽 */
.dz-island[data-expanded='true'] {
  animation: dz-morph .46s cubic-bezier(.32, 1.4, .5, 1);
}

/* ── 收起态一行 ───────────────────────────────────── */
.dz-bar {
  display: flex;
  align-items: center;
  gap: 9px;
  height: 37px;
  padding: 0 14px;
  min-width: 0;
}
.dz-island[data-expanded='true'] .dz-bar {
  height: 46px;
  padding: 0 16px;
}
.dz-title {
  position: relative;
  z-index: 1;
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 590;
  letter-spacing: -.01em;
  color: var(--dz-label);
}
.dz-meta {
  flex: 0 0 auto;
  font-size: 11px;
  color: var(--dz-3);
  max-width: 118px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 状态点 */
.dz-dot {
  flex: 0 0 auto;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--dz-green);
  box-shadow: 0 0 0 0 color-mix(in srgb, var(--dz-green) 55%, transparent);
}
.dz-dot[data-live='true'] {
  box-shadow: 0 0 0 0 rgba(48, 209, 88, .5);
  animation: dz-pulse 2.2s ease-out infinite, dz-ripple 2.2s ease-out infinite .3s;
}
.dz-dot[data-tone='warn'] { background: var(--dz-orange); }
.dz-dot[data-tone='alert'] { background: var(--dz-red); }
.dz-dot[data-tone='idle'] { background: var(--dz-3); animation: none; box-shadow: none; }

/* 上下文占用：环 + 数字 */
.dz-usage {
  position: relative;
  z-index: 1;
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 590;
  font-variant-numeric: tabular-nums;
  color: var(--dz-2);
}
.dz-usage b { color: var(--dz-label); font-weight: 600; }
.dz-ring { width: 16px; height: 16px; transform: rotate(-90deg); }
.dz-ring circle { fill: none; stroke-width: 2.8; }
.dz-ring .bg { stroke: var(--dz-fill-2); }
.dz-ring .fg { stroke: var(--dz-accent); stroke-linecap: round; transition: stroke-dasharray .5s ease; }
.dz-ring .orbit {
  fill: #fff;
  filter: drop-shadow(0 0 3px var(--dz-accent));
  transform-origin: 7.5px 7.5px;
  animation: dz-orbit 3.4s linear infinite;
}
.dz-usage b { position: relative; }

/* 小标 / 角标 */
.dz-pill {
  flex: 0 0 auto;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 10.5px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: #fff;
  background: var(--dz-blue);
}
.dz-badge {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: #fff;
  background: var(--dz-red);
}

/* ── 展开面板 ─────────────────────────────────────── */
.dz-panel {
  display: grid;
  grid-template-rows: 0fr;
  opacity: 0;
  --dz-panel-spring: cubic-bezier(.32, 1.2, .5, 1);
  transition: grid-template-rows .42s var(--dz-panel-spring), opacity .26s ease;
}
.dz-island[data-expanded='true'] .dz-panel {
  grid-template-rows: 1fr;
  opacity: 1;
}
.dz-panel-inner { overflow: hidden; min-height: 0; }
.dz-body {
  display: flex;
  flex-direction: column;
  padding: 2px 10px 8px;
  max-height: min(64vh, 460px);
  overflow-y: auto;
  overscroll-behavior: contain;
}
.dz-body::-webkit-scrollbar { width: 5px; }
.dz-body::-webkit-scrollbar-thumb { background: var(--dz-fill-2); border-radius: 3px; }

/* iOS grouped card */
.dz-section {
  margin-top: 6px;
  padding: 9px 12px 10px;
  border-radius: 16px;
  background: var(--dz-fill);
}
/* 展开时各分区依次淡入上滑，像灵动岛把内容"吐"出来 */
.dz-island[data-expanded='true'] .dz-body > .dz-section,
.dz-island[data-expanded='true'] .dz-quick > .dz-section,
.dz-island[data-expanded='true'] .dz-foot {
  animation: dz-stagger-in .34s cubic-bezier(.22, 1.12, .36, 1) both;
}
.dz-island[data-expanded='true'] .dz-body > .dz-section:nth-child(1) { animation-delay: .02s; }
.dz-island[data-expanded='true'] .dz-body > .dz-section:nth-child(2) { animation-delay: .04s; }
.dz-island[data-expanded='true'] .dz-body > .dz-section:nth-child(3) { animation-delay: .06s; }
.dz-island[data-expanded='true'] .dz-body > .dz-section:nth-child(4) { animation-delay: .08s; }
.dz-island[data-expanded='true'] .dz-body > .dz-section:nth-child(5) { animation-delay: .10s; }
.dz-island[data-expanded='true'] .dz-quick > .dz-section { animation-delay: .12s; }
.dz-island[data-expanded='true'] .dz-foot { animation-delay: .14s; }
/* 动画被关闭或异常中断时，内容必须仍然可见 */
.dz-island[data-expanded='true'] .dz-body > .dz-section,
.dz-island[data-expanded='true'] .dz-quick > .dz-section,
.dz-island[data-expanded='true'] .dz-foot { opacity: 1; }
.dz-section-head {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 5px;
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: .06em;
  text-transform: uppercase;
  color: var(--dz-3);
}
.dz-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 25px;
  padding: 2px 2px;
  border-radius: 8px;
}
.dz-row + .dz-row { border-top: .5px solid var(--dz-sep); border-radius: 0; }
.dz-row[role="button"] {
  cursor: pointer;
  -webkit-app-region: no-drag;
  border-radius: 8px !important;
  transition: background-color .16s ease;
}
.dz-row[role="button"]:hover { background: var(--dz-fill-2); }
.dz-row-text {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12.5px;
  color: var(--dz-label);
}
.dz-row-text[data-done='true'] { color: var(--dz-3); text-decoration: line-through; }
.dz-row-sub {
  flex: 0 0 auto;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: var(--dz-2);
}
.dz-check {
  flex: 0 0 auto;
  width: 13px;
  height: 13px;
  border-radius: 50%;
  border: 1.5px solid var(--dz-3);
}
.dz-check[data-done='true'] {
  background: var(--dz-green);
  border-color: var(--dz-green);
  box-shadow: inset 0 0 0 2.5px var(--dz-bg);
}
.dz-mini {
  flex: 0 0 auto;
  width: 18px;
  height: 18px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: var(--dz-fill-2);
  color: var(--dz-3);
  font: inherit;
  font-size: 10px;
  line-height: 1;
  cursor: pointer;
  -webkit-app-region: no-drag;
}
.dz-mini:hover { color: var(--dz-red); background: color-mix(in srgb, var(--dz-red) 20%, transparent); }
.dz-empty { padding: 3px 2px 1px; font-size: 11.5px; color: var(--dz-3); }

/* 用量条 */
.dz-meter {
  height: 5px;
  margin-top: 7px;
  border-radius: 999px;
  background: var(--dz-fill-2);
  overflow: hidden;
}
.dz-meter > i {
  display: block;
  height: 100%;
  border-radius: 999px;
  background:
    linear-gradient(100deg, transparent 20%, rgba(255,255,255,.55) 50%, transparent 80%) 0 0 / 60% 100% no-repeat,
    linear-gradient(90deg, var(--dz-blue), #5ac8fa);
  transition: width .55s cubic-bezier(.32, 1.2, .5, 1);
  animation: dz-meter-flow 2.6s linear infinite;
}
.dz-meter[data-tone='warn'] > i { background: linear-gradient(90deg, var(--dz-orange), #ffd60a); }
.dz-meter[data-tone='alert'] > i { background: linear-gradient(90deg, var(--dz-red), #ff6961); }

/* 底部 */
.dz-foot {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 7px 16px 10px;
  border-top: .5px solid var(--dz-sep);
  font-size: 10.5px;
  color: var(--dz-3);
}
.dz-foot span { white-space: nowrap; }
.dz-skins { display: flex; gap: 6px; margin-left: auto; }
.dz-skin {
  width: 12px;
  height: 12px;
  padding: 0;
  border-radius: 50%;
  border: 1.5px solid rgba(255, 255, 255, 0.28);
  cursor: pointer;
  transition: transform .18s cubic-bezier(.32, 1.4, .5, 1), box-shadow .18s ease;
}
.dz-skin:hover { transform: scale(1.18); }
.dz-skin[data-active='true'] { box-shadow: 0 0 0 2px var(--dz-bg), 0 0 0 3.5px var(--dz-accent); }

/* 岛仔：小生物（保留岛仔的灵魂，配色跟着 iOS 走） */
.dz-pet {
  position: relative;
  z-index: 1;
  flex: 0 0 auto;
  width: 21px;
  height: 21px;
  overflow: visible;
}
.dz-pet .body {
  fill: var(--dz-accent);
  opacity: .95;
  transform-origin: 12px 12px;
  animation: dz-pet-breathe 2.8s ease-in-out infinite;
}
.dz-pet .speech {
  fill: #fff;
  opacity: 0;
  transform-origin: 20.5px 6.5px;
}
.dz-pet[data-live='true'] .speech { animation: dz-speech 3.1s ease-in-out infinite; }
.dz-pet .eyes { transform-origin: 12px 12px; }
.dz-pet .eye {
  fill: #fff;
  transform-origin: center;
  animation: dz-blink 5.2s infinite, dz-eye-shift 4s ease-in-out infinite;
}
.dz-pet[data-live='true'] .body { animation: dz-pet-breathe 1.5s ease-in-out infinite, dz-pet-squish 3.1s ease-in-out infinite; }
.dz-pet[data-tone='idle'] .body { fill: var(--dz-3); opacity: .7; }
.dz-pet[data-tone='warn'] .body { fill: var(--dz-orange); }
.dz-pet[data-tone='alert'] .body { fill: var(--dz-red); }
.dz-pet[data-live='true'] { animation: dz-bob 3s ease-in-out infinite; }



@keyframes dz-speech {
  0%, 70%, 100% { opacity: 0; transform: scale(.3); }
  78%  { opacity: .9; transform: scale(1); }
  90%  { opacity: 0; transform: scale(1.5) translateY(-2px); }
}

/* 两端传感器光晕：静态也能看见的小彩斑，缓慢明灭 */
.dz-sensor {
  position: absolute;
  top: 50%;
  width: 7px; height: 7px;
  margin-top: -3.5px;
  border-radius: 50%;
  z-index: 1;
  pointer-events: none;
  animation: dz-sensor 3.2s ease-in-out infinite;
}
.dz-sensor[data-side='left'] {
  left: 6px;
  background: radial-gradient(circle, rgba(90, 200, 250, .9), rgba(10, 132, 255, 0) 70%);
}
.dz-sensor[data-side='right'] {
  right: 6px;
  background: radial-gradient(circle, rgba(191, 90, 242, .85), rgba(191, 90, 242, 0) 70%);
  animation-delay: 1.1s;
}
/* 在跑时的三个思考点 */
.dz-thinking {
  position: relative;
  z-index: 1;
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  height: 12px;
  padding: 0 1px;
}
.dz-thinking i {
  width: 3px; height: 3px;
  border-radius: 50%;
  background: var(--dz-green);
  animation: dz-think 1.15s ease-in-out infinite;
}
.dz-thinking i:nth-child(2) { animation-delay: .16s; }
.dz-thinking i:nth-child(3) { animation-delay: .32s; }

@keyframes dz-sensor {
  0%, 100% { opacity: .35; transform: scale(.85); }
  50%      { opacity: 1; transform: scale(1.25); }
}
@keyframes dz-think {
  0%, 60%, 100% { transform: translateY(0); opacity: .45; }
  30%           { transform: translateY(-3px); opacity: 1; }
}

@keyframes dz-aurora {
  0%   { background-position: 8% 25%, 82% 70%, 40% 92%; transform: rotate(0deg) scale(1); }
  50%  { background-position: 30% 60%, 60% 30%, 75% 75%; transform: rotate(8deg) scale(1.08); }
  100% { background-position: 70% 35%, 20% 80%, 15% 25%; transform: rotate(-6deg) scale(.96); }
}
@keyframes dz-glow {
  0%, 100% { box-shadow: 0 0 0 .5px rgba(255,255,255,.1), 0 10px 34px rgba(0,0,0,.5), 0 0 14px rgba(10,132,255,.12); }
  50%      { box-shadow: 0 0 0 .5px rgba(255,255,255,.16), 0 10px 34px rgba(0,0,0,.5), 0 0 26px rgba(10,132,255,.30); }
}
@keyframes dz-pet-breathe {
  0%, 100% { transform: scale(1, 1); }
  50%      { transform: scale(1.06, .94); }
}
@keyframes dz-pet-squish {
  0%, 88%, 100% { transform: scale(1, 1) rotate(0deg); }
  92%           { transform: scale(1.12, .86) rotate(-4deg); }
  96%           { transform: scale(.94, 1.08) rotate(3deg); }
}
@keyframes dz-eye-shift {
  0%, 100% { transform: translateX(0); }
  35%      { transform: translateX(.7px); }
  65%      { transform: translateX(-.7px); }
}
@keyframes dz-orbit {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

@keyframes dz-shimmer {
  0%   { background-position: 180% 0; opacity: 0; }
  8%   { opacity: .85; }
  42%  { background-position: -80% 0; opacity: .85; }
  55%, 100% { background-position: -80% 0; opacity: 0; }
}
@keyframes dz-morph {
  0%   { transform: scale(.97, .93); }
  55%  { transform: scale(1.012, 1.018); }
  100% { transform: scale(1, 1); }
}
@keyframes dz-stagger-in {
  from { opacity: 0; filter: blur(5px); transform: translateY(14px) scale(.97); }
  60%  { filter: blur(0); }
  to   { opacity: 1; filter: blur(0); transform: translateY(0) scale(1); }
}
@keyframes dz-ripple {
  0%   { box-shadow: 0 0 0 0 rgba(48, 209, 88, .45), 0 0 0 0 rgba(48, 209, 88, .25); }
  70%  { box-shadow: 0 0 0 5px rgba(48, 209, 88, 0), 0 0 0 9px rgba(48, 209, 88, 0); }
  100% { box-shadow: 0 0 0 0 rgba(48, 209, 88, 0), 0 0 0 0 rgba(48, 209, 88, 0); }
}
@keyframes dz-meter-flow {
  from { background-position: -60% 0, 0 0; }
  to   { background-position: 160% 0, 0 0; }
}
@keyframes dz-tap {
  0%   { opacity: .5; transform: scale(0) translate(-50%, -50%); }
  100% { opacity: 0; transform: scale(2.2) translate(-50%, -50%); }
}
/* 内容切换：标题/数值变化时轻微淡切 */
@keyframes dz-value-in {
  from { opacity: .35; transform: translateY(-3px); }
  to   { opacity: 1; transform: translateY(0); }
}
.dz-usage b { animation: dz-value-in .4s ease-out; }

@keyframes dz-pulse {
  0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--dz-green) 55%, transparent); }
  70% { box-shadow: 0 0 0 7px transparent; }
  100% { box-shadow: 0 0 0 0 transparent; }
}
@keyframes dz-blink { 0%, 92%, 100% { transform: scaleY(1); } 95% { transform: scaleY(.1); } }
@keyframes dz-bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-1.5px); } }
@keyframes dz-drop {
  from { transform: translateY(-14px) scale(.94); opacity: 0; }
  to { transform: translateY(0) scale(1); opacity: 1; }
}

/* ── 快捷操作 ─────────────────────────────────────── */
.dz-actions {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  margin-top: 2px;
}
.dz-action {
  appearance: none;
  -webkit-appearance: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 30px;
  padding: 5px 6px;
  border: .5px solid var(--dz-sep);
  border-radius: 9px;
  background: var(--dz-fill-2);
  color: var(--dz-label);
  font: inherit;
  font-size: 11.5px;
  font-weight: 500;
  cursor: pointer;
  -webkit-app-region: no-drag;
  transition: background-color .16s ease, transform .16s cubic-bezier(.32, 1.4, .5, 1);
}
.dz-action:hover:not(:disabled) { background: rgba(255, 255, 255, 0.18); transform: translateY(-1px); }
.dz-action:active:not(:disabled) { transform: scale(.94); }
.dz-action { position: relative; overflow: hidden; }
.dz-action::after {
  content: '';
  position: absolute;
  width: 60px; height: 60px;
  border-radius: 50%;
  background: rgba(255, 255, 255, .22);
  opacity: 0;
  transform: scale(0) translate(-50%, -50%);
  pointer-events: none;
}
.dz-action:active:not(:disabled)::after {
  animation: dz-tap .45s ease-out;
}
.dz-action:disabled { opacity: .38; cursor: default; }

.dz-quick {
  padding: 2px 10px 6px;
  border-top: .5px solid var(--dz-sep);
  -webkit-app-region: no-drag;
}
.dz-quick .dz-section { margin-top: 4px; }

/* ── toast ────────────────────────────────────────── */
.dz-toast {
  margin-top: 8px;
  padding: 6px 13px;
  border-radius: 999px;
  font-size: 11.5px;
  font-weight: 500;
  color: #fff;
  background: rgba(28, 28, 30, 0.94);
  box-shadow: 0 0 0 .5px rgba(255, 255, 255, 0.14), 0 8px 24px rgba(0, 0, 0, 0.45);
  -webkit-app-region: no-drag;
  animation: dz-toast-in .28s cubic-bezier(.32, 1.4, .5, 1);
}
.dz-toast[data-ok='false'] { background: rgba(120, 32, 32, 0.95); }

/* ── 拖动 ─────────────────────────────────────────── */
.dz-island { touch-action: none; cursor: grab; }
.dz-island:active { cursor: grabbing; }
.dz-root[data-dragged='true'] { align-items: flex-start; }
.dz-root[data-dragged='true'] .dz-island {
  border-radius: 20px;
  transform-origin: top left;
}

@keyframes dz-toast-in {
  from { opacity: 0; transform: translateY(-6px) scale(.94); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}


/* ── 动效开关：逐项用 data-motion-* 关掉 ─────────────── */
.dz-root[data-motion-drop='off'] .dz-island { animation: none; }
.dz-root[data-motion-spring='off'] .dz-island { --dz-spring: ease; }
.dz-root[data-motion-spring='off'] .dz-panel { --dz-panel-spring: ease; }
.dz-root[data-motion-bob='off'] .dz-pet[data-live='true'] { animation: none !important; }
.dz-root[data-motion-blink='off'] .dz-pet .eye { animation: none !important; }
.dz-root[data-motion-pulse='off'] .dz-dot[data-live='true'] { animation: none !important; box-shadow: none !important; }
.dz-root[data-motion-pulse='off'] .dz-sensor,
.dz-root[data-motion-pulse='off'] .dz-thinking i { animation: none !important; opacity: .6; }
.dz-root[data-motion-pulse='off'] .dz-island { animation-name: dz-drop; }
.dz-root[data-motion-bob='off'] .dz-island,
.dz-root[data-motion-bob='off'] .dz-island[data-expanded='true'] { animation-name: dz-drop; animation-iteration-count: 1; }
.dz-root[data-motion-pulse='off'] .dz-island { animation-name: dz-drop; animation-iteration-count: 1; }
.dz-root[data-motion-spring='off'] .dz-bar::before,
.dz-root[data-motion-spring='off'] .dz-bar::after { animation: none !important; opacity: 0; }
.dz-root[data-motion-bob='off'] .dz-pet .speech { animation: none !important; opacity: 0; }
.dz-root[data-motion-bob='off'] .dz-pet .body { animation: none !important; }
.dz-root[data-motion-blink='off'] .dz-pet .eye { animation: none !important; }
.dz-root[data-motion-pulse='off'] .dz-ring .orbit { animation: none !important; opacity: 0; }
.dz-root[data-motion-spring='off'] .dz-meter > i { animation: none !important; }
.dz-root[data-motion-spring='off'] .dz-body > .dz-section,
.dz-root[data-motion-spring='off'] .dz-quick > .dz-section,
.dz-root[data-motion-spring='off'] .dz-foot { animation: none !important; }
.dz-root[data-motion-toast='off'] .dz-action::after { animation: none !important; }
.dz-root[data-motion-toast='off'] .dz-usage b { animation: none !important; }
.dz-root[data-motion-toast='off'] .dz-toast { animation: none !important; }
.dz-root[data-motion-toast='off'] .dz-action { transition: none !important; }
.dz-root[data-motion-spring='off'] .dz-skin,
.dz-root[data-motion-spring='off'] .dz-meter > i { transition: none !important; }
/* 跟随系统：只在用户允许时生效 */


/* ── 岛内动效快捷面板 ────────────────────────────── */
.dz-action[data-active='true'] {
  background: var(--dz-blue);
  border-color: var(--dz-blue);
  color: #fff;
}
.dz-motion-panel {
  margin-top: 8px;
  padding: 10px 11px 8px;
  border-radius: 12px;
  background: var(--dz-fill);
  -webkit-app-region: no-drag;
  animation: dz-drop .32s cubic-bezier(.32, 1.3, .5, 1);
}
.dz-motion-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 11px;
  color: var(--dz-2);
}
.dz-motion-head b { font-weight: 600; color: var(--dz-label); font-size: 11.5px; }
.dz-motion-head button {
  appearance: none;
  border: 0;
  background: transparent;
  color: var(--dz-2);
  font: inherit;
  font-size: 11px;
  cursor: pointer;
}
.dz-motion-head button:hover { color: var(--dz-label); }
.dz-motion-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 4px 10px;
}
.dz-motion-item {
  display: flex;
  align-items: center;
  gap: 7px;
  min-height: 24px;
  font-size: 11.5px;
  color: var(--dz-label);
  cursor: pointer;
  -webkit-app-region: no-drag;
}
.dz-motion-item input { position: absolute; opacity: 0; width: 1px; height: 1px; }
.dz-motion-item .dz-switch { width: 30px; height: 18px; }
.dz-motion-item .dz-switch::after { width: 14px; height: 14px; }
.dz-motion-item input:checked + .dz-switch::after { transform: translateX(12px); }
.dz-motion-panel[data-motion-drop='off'] { animation: none; }

/* ── 设置页：动效开关 ─────────────────────────────── */
.dz-settings {
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-width: 720px;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI Variable",
    "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
  color: var(--dsw-alias-label-primary, inherit);
}
.dz-settings-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}
.dz-settings-title { font-size: 14px; font-weight: 600; }
.dz-settings-sub { margin-top: 3px; font-size: 11.5px; opacity: .55; }
.dz-settings-reset {
  appearance: none;
  border: 1px solid currentColor;
  background: transparent;
  color: inherit;
  padding: 5px 12px;
  border-radius: 8px;
  font: inherit;
  font-size: 11.5px;
  cursor: pointer;
  opacity: .7;
}
.dz-settings-reset:hover { opacity: 1; }

.dz-settings-grid {
  display: flex;
  flex-direction: column;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, currentColor 12%, transparent);
}
.dz-settings-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  cursor: pointer;
  background: color-mix(in srgb, currentColor 3%, transparent);
}
.dz-settings-row + .dz-settings-row {
  border-top: 1px solid color-mix(in srgb, currentColor 10%, transparent);
}
.dz-settings-row:hover { background: color-mix(in srgb, currentColor 7%, transparent); }
.dz-settings-copy { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.dz-settings-copy b { font-size: 12.5px; font-weight: 550; }
.dz-settings-copy small { font-size: 11px; opacity: .5; }
.dz-settings-row input { position: absolute; opacity: 0; width: 1px; height: 1px; }

/* iOS 开关 */
.dz-switch {
  flex: 0 0 auto;
  position: relative;
  width: 38px;
  height: 22px;
  border-radius: 999px;
  background: color-mix(in srgb, currentColor 18%, transparent);
  transition: background-color .22s ease;
}
.dz-switch::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, .3);
  transition: transform .22s cubic-bezier(.32, 1.4, .5, 1);
}
.dz-settings-row input:checked + .dz-switch { background: #30d158; }
.dz-settings-row input:checked + .dz-switch::after { transform: translateX(16px); }
.dz-settings-row input:focus-visible + .dz-switch { outline: 2px solid #0a84ff; outline-offset: 2px; }

.dz-settings-foot {
  padding: 12px 14px;
  border-radius: 12px;
  background: rgba(0, 0, 0, .78);
  color: #fff;
}
.dz-settings-demo {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  animation: dz-drop .5s cubic-bezier(.32, 1.3, .5, 1);
}
.dz-settings-demo .dz-pet { width: 24px; height: 24px; overflow: visible; }
.dz-settings-demo .dz-pet .body { fill: #0a84ff; opacity: .95; }
.dz-settings-demo .dz-pet .eye { fill: #fff; transform-origin: center; animation: dz-blink 5.2s infinite; }
.dz-settings-demo .dz-pet[data-live='true'] { animation: dz-bob 3s ease-in-out infinite; }
.dz-settings-demo .dz-dot { background: #30d158; }

/* 设置页里的动效也遵守开关 */
.dz-settings[data-motion-drop='off'] .dz-settings-demo { animation: none; }
.dz-settings[data-motion-bob='off'] .dz-settings-demo .dz-pet { animation: none !important; }
.dz-settings[data-motion-blink='off'] .dz-settings-demo .dz-pet .eye { animation: none !important; }
.dz-settings[data-motion-pulse='off'] .dz-settings-demo .dz-dot { animation: none !important; box-shadow: none; }

@media (prefers-reduced-motion: reduce) {
  .dz-root[data-motion-reduce='on'] .dz-sensor,
.dz-root[data-motion-reduce='on'] .dz-thinking i,
.dz-root[data-motion-reduce='on'] .dz-island::after,
    .dz-root[data-motion-reduce='on'] .dz-meter > i,
  .dz-root[data-motion-reduce='on'] .dz-body > .dz-section,
  .dz-root[data-motion-reduce='on'] .dz-quick > .dz-section,
  .dz-root[data-motion-reduce='on'] .dz-foot,
  .dz-root[data-motion-reduce='on'] .dz-usage b,
  .dz-root[data-motion-reduce='on'] .dz-island,
  .dz-root[data-motion-reduce='on'] .dz-dot,
  .dz-root[data-motion-reduce='on'] .dz-pet,
  .dz-root[data-motion-reduce='on'] .dz-pet .eye,
  .dz-root[data-motion-reduce='on'] .dz-panel,
  .dz-root[data-motion-reduce='on'] .dz-skin,
  .dz-root[data-motion-reduce='on'] .dz-action,
  .dz-root[data-motion-reduce='on'] .dz-toast {
    animation: none !important;
    transition: none !important;
  }
}

`;

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
        setState({ ...EMPTY_STATE, ...data, ok: true });
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
function useAction() {
  const [toast, setToast] = useState(null);
  const timer = useRef(0);

  const show = (text, ok) => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ text, ok, id: Date.now() });
    timer.current = window.setTimeout(() => setToast(null), 2600);
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
        <div className={`${CLS}-toast`} data-ok={toast.ok ? 'true' : 'false'} key={toast.id}>
          {toast.ok ? '✓' : '!'} {toast.text}
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
