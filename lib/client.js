window.__ModuleLoader__.load({ id: "xcool-dsh-island", factory: (require) => {
var module = { exports: {} }; var exports = module.exports;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.jsx
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject,
  name: () => name
});
module.exports = __toCommonJS(index_exports);
var import_react = require("react");
var import_jsx_runtime = require("react/jsx-runtime");
var NS = "island";
var STATE_PATH = "/island/state";
var ACTION_PATH = "/island/action";
var POSITION_KEY = `${NS}.position`;
var HOVER_DELAY_MS = 180;
var POLL_ACTIVE_MS = 1500;
var POLL_IDLE_MS = 4e3;
var POLL_HIDDEN_MS = 15e3;
var CLS = "dz";
var STYLE_ID = `${NS}-styles`;
var MOTION_DEFS = [
  { key: "drop", label: "\u5165\u573A\u5F39\u5165", hint: "\u9996\u6B21\u51FA\u73B0\u65F6\u4ECE\u4E0A\u65B9\u8F7B\u8F7B\u843D\u4E0B", default: true },
  { key: "spring", label: "\u5C55\u5F00\u5F39\u6027", hint: "\u60AC\u505C\u5C55\u5F00\u65F6\u7684\u56DE\u5F39\u66F2\u7EBF", default: true },
  { key: "bob", label: "\u5728\u8DD1\u6D6E\u52A8", hint: "\u6709\u4F1A\u8BDD\u8FD0\u884C\u65F6\u5C9B\u4ED4\u4E0A\u4E0B\u8F7B\u6D6E", default: true },
  { key: "blink", label: "\u5C9B\u4ED4\u7728\u773C", hint: "\u5C0F\u751F\u7269\u6BCF\u9694\u51E0\u79D2\u7728\u4E00\u6B21\u773C", default: true },
  { key: "pulse", label: "\u72B6\u6001\u70B9\u547C\u5438", hint: "\u8FD0\u884C\u72B6\u6001\u70B9\u5411\u5916\u6269\u6563\u7684\u5149\u6655", default: true },
  { key: "toast", label: "\u63D0\u793A\u52A8\u753B", hint: "\u64CD\u4F5C\u56DE\u6267\u5F39\u51FA\u7684\u7F29\u653E\u6DE1\u5165", default: true },
  { key: "hover", label: "\u60AC\u505C\u5C55\u5F00", hint: "\u5173\u95ED\u540E\u53EA\u80FD\u70B9\u51FB\u5C9B\u4F53\u5C55\u5F00", default: true },
  { key: "reduce", label: "\u8DDF\u968F\u7CFB\u7EDF\u51CF\u5C11\u52A8\u6548", hint: "\u7CFB\u7EDF\u5F00\u542F\u300C\u51CF\u5C11\u52A8\u6001\u6548\u679C\u300D\u65F6\u81EA\u52A8\u5168\u5173", default: true }
];
var MOTION_KEY = `${NS}.motion`;
function readMotion() {
  const defaults = Object.fromEntries(MOTION_DEFS.map((d) => [d.key, d.default]));
  try {
    const raw = window.localStorage.getItem(MOTION_KEY);
    if (!raw) return defaults;
    const saved = JSON.parse(raw);
    if (!saved || typeof saved !== "object") return defaults;
    return { ...defaults, ...saved };
  } catch {
    return defaults;
  }
}
function writeMotion(value) {
  try {
    window.localStorage.setItem(MOTION_KEY, JSON.stringify(value));
  } catch {
  }
}
var MOTION_EVENT = "xcool-dsh-island:motion";
function broadcastMotion(value) {
  try {
    window.dispatchEvent(new CustomEvent(MOTION_EVENT, { detail: value }));
  } catch {
  }
}
function useMotion() {
  const [motion, setMotion] = (0, import_react.useState)(readMotion);
  (0, import_react.useEffect)(() => {
    const onChange = (event) => setMotion({ ...readMotion(), ...event.detail ?? {} });
    window.addEventListener(MOTION_EVENT, onChange);
    const onStorage = (event) => {
      if (event.key === MOTION_KEY) setMotion(readMotion());
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(MOTION_EVENT, onChange);
      window.removeEventListener("storage", onStorage);
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
function motionAttrs(motion) {
  const attrs = {};
  for (const def of MOTION_DEFS) {
    attrs[`data-motion-${def.key}`] = motion[def.key] === false ? "off" : "on";
  }
  return attrs;
}
var STYLES = `
.dz-root {
  position: fixed;
  /* Windows \u9876\u90E8\u662F --dsh-windows-titlebar-height \u7684\u62D6\u62FD\u6761\uFF08app-region: drag\uFF09\uFF0C
     \u7528 fixed + \u9AD8 z-index + no-drag \u624D\u80FD\u50CF DSH \u4FA7\u680F\u6309\u94AE\u4E00\u6837\u5728\u8FD9\u6761\u4E0A\u6536\u5230\u9F20\u6807\u4E8B\u4EF6 */
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

/* \u2500\u2500 \u5C9B\u4F53\uFF1AiOS \u7075\u52A8\u5C9B = \u7EAF\u9ED1\u80F6\u56CA \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
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
  box-shadow: 0 0 0 .5px rgba(255, 255, 255, 0.1), 0 10px 34px rgba(0, 0, 0, 0.5);
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
  animation: none;
}
/* \u76AE\u80A4\uFF1A\u5976\u6CB9 / \u6BDB\u73BB\u7483\uFF08\u9ED8\u8BA4\u7EAF\u9ED1\u6700\u50CF\u7075\u52A8\u5C9B\uFF09 */
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
/* \u9876\u90E8\u4E00\u9053\u6781\u6DE1\u9AD8\u5149\uFF0C\u6A21\u62DF\u5C9B\u9762\u73BB\u7483 */
.dz-island::before {
  content: '';
  position: absolute;
  inset: 0 0 auto 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.18), transparent);
  pointer-events: none;
  z-index: 2;
}

/* \u2500\u2500 \u6536\u8D77\u6001\u4E00\u884C \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
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

/* \u72B6\u6001\u70B9 */
.dz-dot {
  flex: 0 0 auto;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--dz-green);
  box-shadow: 0 0 0 0 color-mix(in srgb, var(--dz-green) 55%, transparent);
}
.dz-dot[data-live='true'] { animation: dz-pulse 2.2s ease-out infinite; }
.dz-dot[data-tone='warn'] { background: var(--dz-orange); }
.dz-dot[data-tone='alert'] { background: var(--dz-red); }
.dz-dot[data-tone='idle'] { background: var(--dz-3); animation: none; box-shadow: none; }

/* \u4E0A\u4E0B\u6587\u5360\u7528\uFF1A\u73AF + \u6570\u5B57 */
.dz-usage {
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

/* \u5C0F\u6807 / \u89D2\u6807 */
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

/* \u2500\u2500 \u5C55\u5F00\u9762\u677F \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
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

/* \u7528\u91CF\u6761 */
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
  background: linear-gradient(90deg, var(--dz-blue), #5ac8fa);
  transition: width .55s cubic-bezier(.32, 1.2, .5, 1);
}
.dz-meter[data-tone='warn'] > i { background: linear-gradient(90deg, var(--dz-orange), #ffd60a); }
.dz-meter[data-tone='alert'] > i { background: linear-gradient(90deg, var(--dz-red), #ff6961); }

/* \u5E95\u90E8 */
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

/* \u5C9B\u4ED4\uFF1A\u5C0F\u751F\u7269\uFF08\u4FDD\u7559\u5C9B\u4ED4\u7684\u7075\u9B42\uFF0C\u914D\u8272\u8DDF\u7740 iOS \u8D70\uFF09 */
.dz-pet {
  flex: 0 0 auto;
  width: 21px;
  height: 21px;
  overflow: visible;
}
.dz-pet .body { fill: var(--dz-accent); opacity: .95; }
.dz-pet .eye { fill: #fff; transform-origin: center; animation: dz-blink 5.2s infinite; }
.dz-pet[data-tone='idle'] .body { fill: var(--dz-3); opacity: .7; }
.dz-pet[data-tone='warn'] .body { fill: var(--dz-orange); }
.dz-pet[data-tone='alert'] .body { fill: var(--dz-red); }
.dz-pet[data-live='true'] { animation: dz-bob 3s ease-in-out infinite; }

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

/* \u2500\u2500 \u5FEB\u6377\u64CD\u4F5C \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
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
.dz-action:active:not(:disabled) { transform: scale(.96); }
.dz-action:disabled { opacity: .38; cursor: default; }

.dz-quick {
  padding: 2px 10px 6px;
  border-top: .5px solid var(--dz-sep);
  -webkit-app-region: no-drag;
}
.dz-quick .dz-section { margin-top: 4px; }

/* \u2500\u2500 toast \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
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

/* \u2500\u2500 \u62D6\u52A8 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
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


/* \u2500\u2500 \u52A8\u6548\u5F00\u5173\uFF1A\u9010\u9879\u7528 data-motion-* \u5173\u6389 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dz-root[data-motion-drop='off'] .dz-island { animation: none; }
.dz-root[data-motion-spring='off'] .dz-island { --dz-spring: ease; }
.dz-root[data-motion-spring='off'] .dz-panel { --dz-panel-spring: ease; }
.dz-root[data-motion-bob='off'] .dz-pet[data-live='true'] { animation: none !important; }
.dz-root[data-motion-blink='off'] .dz-pet .eye { animation: none !important; }
.dz-root[data-motion-pulse='off'] .dz-dot[data-live='true'] { animation: none !important; box-shadow: none; }
.dz-root[data-motion-toast='off'] .dz-toast { animation: none !important; }
.dz-root[data-motion-toast='off'] .dz-action { transition: none !important; }
.dz-root[data-motion-spring='off'] .dz-skin,
.dz-root[data-motion-spring='off'] .dz-meter > i { transition: none !important; }
/* \u8DDF\u968F\u7CFB\u7EDF\uFF1A\u53EA\u5728\u7528\u6237\u5141\u8BB8\u65F6\u751F\u6548 */


/* \u2500\u2500 \u5C9B\u5185\u52A8\u6548\u5FEB\u6377\u9762\u677F \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
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

/* \u2500\u2500 \u8BBE\u7F6E\u9875\uFF1A\u52A8\u6548\u5F00\u5173 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
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

/* iOS \u5F00\u5173 */
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

/* \u8BBE\u7F6E\u9875\u91CC\u7684\u52A8\u6548\u4E5F\u9075\u5B88\u5F00\u5173 */
.dz-settings[data-motion-drop='off'] .dz-settings-demo { animation: none; }
.dz-settings[data-motion-bob='off'] .dz-settings-demo .dz-pet { animation: none !important; }
.dz-settings[data-motion-blink='off'] .dz-settings-demo .dz-pet .eye { animation: none !important; }
.dz-settings[data-motion-pulse='off'] .dz-settings-demo .dz-dot { animation: none !important; box-shadow: none; }

@media (prefers-reduced-motion: reduce) {
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
var EMPTY_STATE = {
  ok: false,
  sessions: 0,
  runningCount: 0,
  busy: false,
  session: null,
  usage: null,
  todos: [],
  jobs: [],
  schedule: [],
  approvals: []
};
function useIslandState() {
  const [state, setState] = (0, import_react.useState)(EMPTY_STATE);
  const [reachable, setReachable] = (0, import_react.useState)(true);
  (0, import_react.useEffect)(() => {
    let alive = true;
    let timer;
    const poll = async () => {
      let next = POLL_IDLE_MS;
      try {
        const res = await fetch(STATE_PATH, { cache: "no-store", credentials: "same-origin" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!alive) return;
        setState({ ...EMPTY_STATE, ...data, ok: true });
        setReachable(true);
        const hidden = typeof document !== "undefined" && document.visibilityState === "hidden";
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
      if (timer !== void 0) clearTimeout(timer);
    };
  }, []);
  return { state, reachable };
}
function useAction() {
  const [toast, setToast] = (0, import_react.useState)(null);
  const timer = (0, import_react.useRef)(0);
  const show = (text, ok) => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ text, ok, id: Date.now() });
    timer.current = window.setTimeout(() => setToast(null), 2600);
  };
  (0, import_react.useEffect)(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  const run = async (action, payload = {}) => {
    try {
      const res = await fetch(ACTION_PATH, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ action, ...payload })
      });
      const result = await res.json();
      if (result?.fallback && result?.text) {
        await copyToClipboard(result.text);
        show("\u5DF2\u590D\u5236", true);
        return { ok: true };
      }
      show(result?.message || (result?.ok ? "\u5B8C\u6210" : "\u64CD\u4F5C\u5931\u8D25"), Boolean(result?.ok));
      return result ?? { ok: false };
    } catch (error) {
      show(`\u64CD\u4F5C\u5931\u8D25\uFF1A${error instanceof Error ? error.message : String(error)}`, false);
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
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  } catch {
    return false;
  }
}
function usePosition() {
  const [pos, setPos] = (0, import_react.useState)(() => {
    try {
      const raw = window.localStorage.getItem(POSITION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Number.isFinite(parsed?.x) && Number.isFinite(parsed?.y)) return parsed;
      }
    } catch {
    }
    return null;
  });
  const drag = (0, import_react.useRef)(null);
  const onPointerDown = (event) => {
    if (event.target.closest("button, input, a, [data-no-drag]")) return;
    if (event.button !== 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    drag.current = {
      startX: event.clientX,
      startY: event.clientY,
      baseX: rect.left,
      baseY: rect.top,
      moved: false
    };
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
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
      y: Math.min(maxY, Math.max(0, d.baseY + dy))
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
    }
  };
  (0, import_react.useEffect)(() => {
    if (!pos) return;
    try {
      window.localStorage.setItem(POSITION_KEY, JSON.stringify(pos));
    } catch {
    }
  }, [pos]);
  const reset = () => {
    try {
      window.localStorage.removeItem(POSITION_KEY);
    } catch {
    }
    setPos(null);
  };
  return { pos, drag, onPointerDown, onPointerMove, onPointerUp, reset };
}
function Pet({ tone }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "svg",
    {
      className: `${CLS}-pet`,
      viewBox: "0 0 24 24",
      "data-tone": tone,
      "data-live": tone === "live" ? "true" : "false",
      "aria-hidden": "true",
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { className: "body", x: "2.5", y: "5", width: "19", height: "14", rx: "7" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { className: "eye", cx: "9.5", cy: "12", r: "1.7" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { className: "eye", cx: "14.5", cy: "12", r: "1.7" })
      ]
    }
  );
}
function Ring({ percent }) {
  const radius = 6;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, Number(percent) || 0));
  const filled = clamped / 100 * circumference;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { className: `${CLS}-ring`, viewBox: "0 0 15 15", "aria-hidden": "true", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { className: "bg", cx: "7.5", cy: "7.5", r: radius }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "circle",
      {
        className: "fg",
        cx: "7.5",
        cy: "7.5",
        r: radius,
        strokeDasharray: `${filled} ${circumference - filled}`
      }
    )
  ] });
}
function Section({ title, extra, children }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: `${CLS}-section`, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: `${CLS}-section-head`, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: title }),
      extra ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: extra }) : null
    ] }),
    children
  ] });
}
function Empty({ children }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: `${CLS}-empty`, children });
}
var SKINS = [
  { id: "ink", color: "#2a2a31", label: "\u6DF1\u7A7A" },
  { id: "cream", color: "#f2e8d8", label: "\u5976\u6CB9" },
  { id: "glass", color: "#cfe4ff", label: "\u73BB\u7483" }
];
var SKIN_KEY = `${NS}.skin`;
function readSkin() {
  try {
    const stored = window.localStorage.getItem(SKIN_KEY);
    if (stored === "ink" || stored === "cream" || stored === "glass") return stored;
  } catch {
  }
  return "ink";
}
function Island() {
  const { state, reachable } = useIslandState();
  const { toast, run, show } = useAction();
  const position = usePosition();
  const { motion, update: updateMotion, reset: resetMotion } = useMotion();
  const [showMotion, setShowMotion] = (0, import_react.useState)(false);
  const [pinned, setPinned] = (0, import_react.useState)(() => {
    try {
      return new URLSearchParams(window.location.search).get("expand") === "1";
    } catch {
      return false;
    }
  });
  const [hovered, setHovered] = (0, import_react.useState)(false);
  const [skin, setSkin] = (0, import_react.useState)(readSkin);
  const rootRef = (0, import_react.useRef)(null);
  const hoverTimer = (0, import_react.useRef)(0);
  const expanded = pinned || hovered;
  (0, import_react.useEffect)(() => {
    try {
      window.localStorage.setItem(SKIN_KEY, skin);
    } catch {
    }
  }, [skin]);
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
  (0, import_react.useEffect)(
    () => () => {
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
    },
    []
  );
  (0, import_react.useEffect)(() => {
    if (!pinned) return void 0;
    const onKey = (event) => {
      if (event.key === "Escape") setPinned(false);
    };
    const onDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) setPinned(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown, true);
    };
  }, [pinned]);
  const usagePercent = state.usage?.percent ?? null;
  const approvals = state.approvals ?? [];
  const todos = state.todos ?? [];
  const jobs = state.jobs ?? [];
  const schedule = state.schedule ?? [];
  const runningCount = state.runningCount ?? (state.busy ? 1 : 0);
  const openTodos = todos.filter((item) => !item.done);
  const openSession = (sessionId) => {
    if (!sessionId) return;
    const ui = clientService("uiWorkspace");
    try {
      if (ui && typeof ui.openSession === "function") {
        ui.openSession(sessionId);
        show("\u5DF2\u5207\u5230\u8BE5\u4F1A\u8BDD", true);
        return;
      }
    } catch (error) {
      show(`\u5207\u6362\u5931\u8D25\uFF1A${error instanceof Error ? error.message : String(error)}`, false);
      return;
    }
    show("\u8BE5\u7248\u672C\u4E0D\u652F\u6301\u4ECE\u5C9B\u4F53\u5207\u6362\u4F1A\u8BDD", false);
  };
  const startNewSession = async () => {
    const ui = clientService("uiWorkspace");
    try {
      if (ui && typeof ui.startSession === "function") {
        ui.startSession();
        show("\u5DF2\u65B0\u5EFA\u4F1A\u8BDD", true);
        return;
      }
    } catch (error) {
      show(`\u65B0\u5EFA\u5931\u8D25\uFF1A${error instanceof Error ? error.message : String(error)}`, false);
      return;
    }
    const result = await run("newSession");
    if (result?.ok && result?.sessionId) openSession(result.sessionId);
  };
  const cancelTurn = async () => {
    const remote = clientService("remote");
    const sessionId = state.session?.id;
    try {
      if (remote && typeof remote.session?.cancel === "function" && sessionId) {
        await remote.session.cancel({ sessionId });
        show("\u5DF2\u8BF7\u6C42\u505C\u6B62\u5F53\u524D\u8F6E\u6B21", true);
        return;
      }
    } catch {
    }
    void run("stopTurn");
  };
  const tone = !reachable ? "idle" : approvals.length > 0 ? "alert" : runningCount > 0 ? "live" : usagePercent !== null && usagePercent >= 85 ? "warn" : "idle";
  const title = !reachable ? "\u5BBF\u4E3B\u672A\u8FDE\u63A5" : state.session?.title || (state.sessions > 0 ? `${state.sessions} \u4E2A\u4F1A\u8BDD` : "\u7A7A\u95F2");
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "div",
    {
      className: `${CLS}-root`,
      ref: rootRef,
      "data-dragged": position.pos ? "true" : "false",
      ...motionAttrs(motion),
      style: position.pos ? { position: "fixed", top: position.pos.y, left: position.pos.x, right: "auto" } : void 0,
      onMouseEnter: handleEnter,
      onMouseLeave: handleLeave,
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
          "div",
          {
            className: `${CLS}-island`,
            "data-expanded": expanded ? "true" : "false",
            "data-skin": skin,
            role: "button",
            tabIndex: 0,
            onPointerDown: position.onPointerDown,
            onPointerMove: position.onPointerMove,
            onPointerUp: position.onPointerUp,
            onPointerCancel: position.onPointerUp,
            onClick: (event) => {
              if (position.drag.current?.moved) return;
              setPinned((value) => !value);
            },
            onKeyDown: (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setPinned((value) => !value);
              }
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: `${CLS}-bar`, children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pet, { tone }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `${CLS}-title`, title, children: title }),
                expanded && state.session?.model ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `${CLS}-meta`, children: state.session.model }) : null,
                runningCount > 1 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: `${CLS}-pill`, children: [
                  runningCount,
                  " \u5728\u8DD1"
                ] }) : null,
                usagePercent !== null ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: `${CLS}-usage`, children: [
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Ring, { percent: usagePercent }),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("b", { children: [
                    usagePercent,
                    "%"
                  ] })
                ] }) : null,
                approvals.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `${CLS}-badge`, children: approvals.length }) : null
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: `${CLS}-panel`, children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: `${CLS}-panel-inner`, children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: `${CLS}-body`, children: [
                  jobs.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, { title: "\u8FD0\u884C\u4E2D", extra: `${jobs.length} \u4E2A\u4F1A\u8BDD`, children: jobs.slice(0, 4).map((job, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                    "div",
                    {
                      className: `${CLS}-row`,
                      role: "button",
                      tabIndex: 0,
                      title: "\u70B9\u51FB\u5207\u5230\u8BE5\u4F1A\u8BDD",
                      "data-no-drag": true,
                      onClick: (event) => {
                        event.stopPropagation();
                        openSession(job.id);
                      },
                      onKeyDown: (event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          openSession(job.id);
                        }
                      },
                      children: [
                        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `${CLS}-dot`, "data-live": "true", "data-tone": "live" }),
                        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `${CLS}-row-text`, children: job.title || "\u4F1A\u8BDD" }),
                        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `${CLS}-row-sub`, children: (job.kinds ?? []).join(" \xB7 ") })
                      ]
                    },
                    job.id ?? index
                  )) }) : null,
                  approvals.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, { title: "\u5F85\u5BA1\u6279", extra: `${approvals.length}`, children: approvals.slice(0, 3).map((item, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: `${CLS}-row`, children: [
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `${CLS}-badge`, children: "!" }),
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `${CLS}-row-text`, children: item.title || "\u9700\u8981\u4F60\u7684\u786E\u8BA4" })
                  ] }, item.id ?? index)) }) : null,
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                    Section,
                    {
                      title: "\u5F85\u529E",
                      extra: openTodos.length > 0 ? `${openTodos.length} \u9879\u672A\u5B8C\u6210` : void 0,
                      children: todos.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Empty, { children: "\u5F53\u524D\u4F1A\u8BDD\u6CA1\u6709\u5F85\u529E" }) : todos.slice(0, 5).map((item, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: `${CLS}-row`, children: [
                        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `${CLS}-check`, "data-done": item.done ? "true" : "false" }),
                        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `${CLS}-row-text`, "data-done": item.done ? "true" : "false", children: item.content })
                      ] }, index))
                    }
                  ),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, { title: "\u65E5\u7A0B", children: schedule.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Empty, { children: "\u6CA1\u6709\u4E34\u8FD1\u7684\u63D0\u9192" }) : schedule.slice(0, 3).map((item, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: `${CLS}-row`, children: [
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `${CLS}-row-sub`, children: item.when || "" }),
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `${CLS}-row-text`, children: item.title }),
                    item.id ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                      "button",
                      {
                        type: "button",
                        className: `${CLS}-mini`,
                        title: "\u5220\u9664\u8FD9\u6761\u63D0\u9192",
                        "data-no-drag": true,
                        onClick: (event) => {
                          event.stopPropagation();
                          void run("deleteReminder", { id: item.id });
                        },
                        children: "\u2715"
                      }
                    ) : null
                  ] }, item.id ?? index)) }),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, { title: "\u989D\u5EA6", children: usagePercent === null ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Empty, { children: "\u6682\u65E0\u7528\u91CF\u4FE1\u606F" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
                    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: `${CLS}-row`, children: [
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `${CLS}-row-text`, children: "\u4E0A\u4E0B\u6587\u5360\u7528" }),
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `${CLS}-row-sub`, children: state.usage?.label || `${usagePercent}%` })
                    ] }),
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                      "div",
                      {
                        className: `${CLS}-meter`,
                        "data-tone": usagePercent >= 85 ? "alert" : usagePercent >= 60 ? "warn" : "ok",
                        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { style: { width: `${Math.min(100, usagePercent)}%` } })
                      }
                    )
                  ] }) })
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: `${CLS}-quick`, "data-no-drag": true, children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Section, { title: "\u5FEB\u6377\u64CD\u4F5C", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: `${CLS}-actions`, children: [
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                      "button",
                      {
                        type: "button",
                        className: `${CLS}-action`,
                        onClick: (e) => {
                          e.stopPropagation();
                          void startNewSession();
                        },
                        children: "\uFF0B \u65B0\u4F1A\u8BDD"
                      }
                    ),
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                      "button",
                      {
                        type: "button",
                        className: `${CLS}-action`,
                        disabled: runningCount === 0,
                        onClick: (e) => {
                          e.stopPropagation();
                          void cancelTurn();
                        },
                        children: "\u25A0 \u505C\u6B62\u8F6E\u6B21"
                      }
                    ),
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                      "button",
                      {
                        type: "button",
                        className: `${CLS}-action`,
                        onClick: (e) => {
                          e.stopPropagation();
                          void run("remind", { minutes: 5, text: "" });
                        },
                        children: "\u23F1 5 \u5206\u949F\u63D0\u9192"
                      }
                    ),
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                      "button",
                      {
                        type: "button",
                        className: `${CLS}-action`,
                        onClick: (e) => {
                          e.stopPropagation();
                          void run("remind", { minutes: 30, text: "" });
                        },
                        children: "\u23F1 30 \u5206\u949F"
                      }
                    ),
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                      "button",
                      {
                        type: "button",
                        className: `${CLS}-action`,
                        onClick: async (e) => {
                          e.stopPropagation();
                          const ok = await copyToClipboard(
                            state.session?.title || title || "DSH \u4FE1\u606F\u5C9B"
                          );
                          show(ok ? "\u5DF2\u590D\u5236\u4F1A\u8BDD\u6807\u9898" : "\u590D\u5236\u5931\u8D25", ok);
                        },
                        children: "\u29C9 \u590D\u5236\u6807\u9898"
                      }
                    ),
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                      "button",
                      {
                        type: "button",
                        className: `${CLS}-action`,
                        onClick: (e) => {
                          e.stopPropagation();
                          position.reset();
                          show("\u5DF2\u56DE\u5230\u9ED8\u8BA4\u4F4D\u7F6E", true);
                        },
                        children: "\u2316 \u590D\u4F4D"
                      }
                    ),
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                      "button",
                      {
                        type: "button",
                        className: `${CLS}-action`,
                        "data-active": showMotion ? "true" : "false",
                        onClick: (e) => {
                          e.stopPropagation();
                          setShowMotion((v) => !v);
                        },
                        children: "\u2699 \u52A8\u6548"
                      }
                    )
                  ] }),
                  showMotion ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: `${CLS}-motion-panel`, "data-no-drag": true, ...motionAttrs(motion), children: [
                    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: `${CLS}-motion-head`, children: [
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "\u52A8\u6548\u5F00\u5173" }),
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", onClick: () => resetMotion(), children: "\u6062\u590D\u9ED8\u8BA4" })
                    ] }),
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: `${CLS}-motion-grid`, children: MOTION_DEFS.map((def) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: `${CLS}-motion-item`, title: def.hint, children: [
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                        "input",
                        {
                          type: "checkbox",
                          checked: motion[def.key] !== false,
                          onChange: (event) => updateMotion(def.key, event.target.checked)
                        }
                      ),
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `${CLS}-switch`, "aria-hidden": "true" }),
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: def.label })
                    ] }, def.key)) })
                  ] }) : null
                ] }) }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: `${CLS}-foot`, children: [
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: state.sessions > 0 ? `${state.sessions} \u4E2A\u4F1A\u8BDD` : "\u65E0\u4F1A\u8BDD" }),
                  state.tokens ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
                    state.tokens,
                    " tokens"
                  ] }) : null,
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                    "div",
                    {
                      className: `${CLS}-skins`,
                      onClick: (event) => event.stopPropagation(),
                      role: "group",
                      children: SKINS.map((option) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                        "button",
                        {
                          type: "button",
                          title: option.label,
                          "aria-label": option.label,
                          className: `${CLS}-skin`,
                          "data-active": skin === option.id ? "true" : "false",
                          style: { background: option.color },
                          onClick: () => setSkin(option.id)
                        },
                        option.id
                      ))
                    }
                  )
                ] })
              ] }) })
            ]
          }
        ),
        toast ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: `${CLS}-toast`, "data-ok": toast.ok ? "true" : "false", children: [
          toast.ok ? "\u2713" : "!",
          " ",
          toast.text
        ] }, toast.id) : null
      ]
    }
  );
}
function IslandSettingsSection() {
  const { motion, update, reset } = useMotion();
  const [previewPulse, setPreviewPulse] = (0, import_react.useState)(0);
  const preview = () => setPreviewPulse((n) => n + 1);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: `${CLS}-settings`, "data-no-drag": true, ...motionAttrs(motion), children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: `${CLS}-settings-head`, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: `${CLS}-settings-title`, children: "XCool-DSH\u7075\u52A8\u5C9B \xB7 \u52A8\u6548" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: `${CLS}-settings-sub`, children: "\u9010\u9879\u5F00\u5173\uFF0C\u6539\u52A8\u7ACB\u5373\u751F\u6548\u5E76\u4FDD\u5B58\u5230\u672C\u673A\uFF08localStorage\uFF09" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: `${CLS}-settings-reset`, onClick: reset, children: "\u6062\u590D\u9ED8\u8BA4" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: `${CLS}-settings-grid`, children: MOTION_DEFS.map((def) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: `${CLS}-settings-row`, title: def.hint, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: `${CLS}-settings-copy`, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: def.label }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: def.hint })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "input",
        {
          type: "checkbox",
          role: "switch",
          checked: motion[def.key] !== false,
          onChange: (event) => {
            update(def.key, event.target.checked);
            preview();
          }
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `${CLS}-switch`, "aria-hidden": "true" })
    ] }, def.key)) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: `${CLS}-settings-foot`, children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: `${CLS}-settings-demo`, "data-skin": "ink", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { className: `${CLS}-pet`, viewBox: "0 0 24 24", "data-tone": "live", "data-live": "true", "aria-hidden": "true", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { className: "body", x: "2.5", y: "5", width: "19", height: "14", rx: "7" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { className: "eye", cx: "9.5", cy: "12", r: "1.7" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { className: "eye", cx: "14.5", cy: "12", r: "1.7" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `${CLS}-dot`, "data-live": "true", "data-tone": "live" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "\u9884\u89C8\uFF1A\u5C9B\u4ED4\u4F1A\u7728\u773C\u3001\u6D6E\u52A8\uFF0C\u72B6\u6001\u70B9\u4F1A\u547C\u5438" })
    ] }) }, previewPulse)
  ] });
}
var name = `${NS}-client`;
var inject = ["slots"];
var clientCtx = null;
function clientService(key) {
  try {
    return clientCtx && typeof clientCtx.get === "function" ? clientCtx.get(key) : clientCtx?.[key];
  } catch {
    return void 0;
  }
}
function apply(ctx) {
  ensureStyles();
  clientCtx = ctx;
  const slots = ctx?.slots;
  if (!slots?.inject) {
    console.warn("[island] \u5BA2\u6237\u7AEF\u7F3A\u5C11 slots \u670D\u52A1\uFF0C\u8DF3\u8FC7\u6302\u8F7D");
    return;
  }
  const disposers = [];
  disposers.push(
    slots.inject(
      "shell.overlay",
      () => slots.register(
        {
          name: "shell.overlay",
          id: `${NS}.overlay`,
          order: 60
        },
        Island
      )
    )
  );
  disposers.push(
    slots.inject(
      "settings.section",
      () => slots.register(
        {
          name: "settings.section",
          id: "xcool-dsh-island",
          order: 61,
          label: "XCool-DSH\u7075\u52A8\u5C9B"
        },
        IslandSettingsSection
      )
    )
  );
  ctx.effect?.(() => () => {
    for (const dispose of disposers.reverse()) dispose?.();
    document.getElementById(STYLE_ID)?.remove();
  }, "island.overlay");
}
function ensureStyles() {
  if (typeof document === "undefined") return;
  const existing = document.getElementById(STYLE_ID);
  if (existing !== null) {
    if (existing.textContent !== STYLES) existing.textContent = STYLES;
    return;
  }
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.setAttribute("data-plugin", "xcool-dsh-island");
  style.setAttribute("data-plugin-css", "island");
  style.textContent = STYLES;
  document.head.appendChild(style);
}
return module.exports; } });
//# sourceMappingURL=client.js.map
