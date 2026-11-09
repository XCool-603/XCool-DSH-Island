/**
 * 客户端 bundle 冒烟测试：不依赖浏览器，验证
 *   1. 模块经 __ModuleLoader__ 正确注册、导出 name/inject/apply
 *   2. apply() 能往 shell.overlay 注册条目
 *   3. 样式标签被注入
 *   4. 组件能渲染成 React 元素树（react-dom/server 渲染成 HTML 字符串）
 *
 * 用法：node smoke.mjs
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require_ = createRequire(import.meta.url);

/* ── 假 DOM ──────────────────────────────────────── */
const created = [];
globalThis.document = {
  visibilityState: 'visible',
  head: {
    appendChild(node) {
      created.push(node);
      node.parentNode = this;
    },
  },
  createElement(tag) {
    const attrs = {};
    return {
      tagName: tag,
      id: '',
      textContent: '',
      parentNode: null,
      dataset: {},
      setAttribute(name, value) {
        attrs[name] = value;
      },
      getAttribute(name) {
        return attrs[name] ?? null;
      },
    };
  },
  getElementById(id) {
    return created.find((node) => node.id === id) ?? null;
  },
};

/* ── 假 React（真 React 也行，这里只做结构断言） ── */
const React = require_('react');

const registered = new Map();
globalThis.window = {
  localStorage: { getItem: () => null, setItem: () => {} },
  addEventListener: () => {},
  removeEventListener: () => {},
  __ModuleLoader__: {
    load({ id, factory }) {
      registered.set(id, factory);
    },
  },
};
globalThis.fetch = async () => ({ ok: false, status: 503, json: async () => ({}) });
globalThis.setTimeout = () => 0;
globalThis.clearTimeout = () => {};

/* ── 加载产物 ────────────────────────────────────── */
const code = readFileSync(new URL('./lib/client.js', import.meta.url), 'utf8');
// eslint-disable-next-line no-new-func
new Function('window', 'document', 'fetch', 'setTimeout', 'clearTimeout', code)(
  globalThis.window,
  globalThis.document,
  globalThis.fetch,
  globalThis.setTimeout,
  globalThis.clearTimeout,
);

const ids = [...registered.keys()];
console.log('registered ids:', ids);

const factory = registered.get('xcool-dsh-island');
if (!factory) throw new Error('bundle 没有按 id 注册');

const shim = (specifier) => {
  if (specifier === 'react') return React;
  if (specifier === 'react/jsx-runtime') {
    return {
      jsx: (type, props, key) => React.createElement(type, key === undefined ? props : { ...props, key }),
      jsxs: (type, props, key) => React.createElement(type, key === undefined ? props : { ...props, key }),
      Fragment: React.Fragment,
    };
  }
  throw new Error(`unexpected external: ${specifier}`);
};

const mod = factory(shim);
console.log('exports:', Object.keys(mod).sort().join(', '));
if (typeof mod.apply !== 'function') throw new Error('缺少 apply 导出');
if (!('name' in mod)) throw new Error('缺少 name 导出');

/* ── 假 ctx ──────────────────────────────────────── */
const entries = [];
const ctx = {
  effect: (fn) => {
    const dispose = fn();
    return () => dispose?.();
  },
  slots: {
    inject(name, register) {
      const dispose = register();
      return typeof dispose === 'function' ? dispose : () => {};
    },
    register(entry, Component) {
      entries.push({ entry, Component });
      return () => {};
    },
  },
};

mod.apply(ctx);

console.log('slot entries:', entries.map((e) => `${e.entry.name}#${e.entry.id}`).join(', ') || '(none)');
if (entries.length === 0) throw new Error('没有注册任何槽位条目');
if (entries[0].entry.name !== 'shell.overlay') throw new Error(`槽位不对: ${entries[0].entry.name}`);
if (typeof entries[0].Component !== 'function') throw new Error('注册的组件不是函数');

const styleTags = created.filter((node) => node.tagName === 'style');
console.log('style tags:', styleTags.length, 'bytes:', styleTags[0]?.textContent.length ?? 0);
if (styleTags.length === 0) throw new Error('没有注入样式');

/* ── 渲染一次（服务端渲染，验证组件不炸） ────────── */
const server = require_('react-dom/server');
const html = server.renderToStaticMarkup(React.createElement(entries[0].Component, {}));
console.log('rendered bytes:', html.length);
console.log('has island root:', html.includes('dz-root'));
console.log('has collapsed bar:', html.includes('dz-bar'));
console.log('preview head:', html.slice(0, 220));
if (!html.includes('dz-root')) throw new Error('渲染结果里没有岛根节点');

console.log('\nSMOKE OK');
