/**
 * 浏览器端 bundle 构建：产出 lib/client.js，遵循 dsh 客户端模块加载契约
 *   window.__ModuleLoader__.load({ id: "<包名>", factory: (require) => { ... } })
 *
 * - CJS 闭包工厂，baseline externals（react 等）经注入的 require 解析
 * - 单文件入口，sourcemap 供浏览器诊断
 */
import { build, context } from 'esbuild';
import { readFileSync, copyFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
const ID = pkg.name;

/** 客户端平台种子表：这些说明符必须保持外部引用 */
const BASELINE_EXTERNALS = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
];

const isBaseline = (specifier) =>
  BASELINE_EXTERNALS.some((name) => specifier === name || specifier.startsWith(`${name}/`));

/** @type {import('esbuild').BuildOptions} */
const options = {
  entryPoints: ['src/client/index.jsx'],
  outfile: 'lib/client.js',
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  jsx: 'automatic',
  sourcemap: true,
  legalComments: 'none',
  external: BASELINE_EXTERNALS,
  banner: {
    js: `window.__ModuleLoader__.load({ id: ${JSON.stringify(ID)}, factory: (require) => {\nvar module = { exports: {} }; var exports = module.exports;`,
  },
  footer: {
    js: `return module.exports; } });`,
  },
  loader: { '.css': 'text' },
  logLevel: 'info',
};

/** 宿主端是纯 ESM，Node 直接跑，构建只是把 src/host/*.js 搬到 lib/ */
function copyHost() {
  copyFileSync(new URL('./src/host/index.js', import.meta.url), new URL('./lib/index.js', import.meta.url));
  copyFileSync(new URL('./src/host/actions.js', import.meta.url), new URL('./lib/actions.js', import.meta.url));
  copyFileSync(new URL('./src/host/notifications.js', import.meta.url), new URL('./lib/notifications.js', import.meta.url));
  console.log('[island] copied lib/index.js + lib/actions.js + lib/notifications.js');
}

if (process.argv.includes('--watch')) {
  const ctx = await context(options);
  await ctx.watch();
  copyHost();
  console.log('[island] watching src/client → lib/client.js');
} else {
  await build(options);
  copyHost();
  console.log('[island] built lib/client.js + lib/index.js');
}
