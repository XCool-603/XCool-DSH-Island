import { createNotifier, diffJobs, EVENT_DEFINITIONS } from '../XCool-DSH灵动岛/src/host/notifications.js';

const n = createNotifier();
const map = new Map();
const def = EVENT_DEFINITIONS.find((d) => d.event === 'session/event').map;

/* 1) 事件映射：完成 / 异常 / 中止 / 工具错误 / 作业结算 / 命令 */
const cases = [
  ['turn/end 完成', { type: 'turn/end', seq: 1, data: { reason: { kind: 'completed' } } }, 'success'],
  ['turn/end 异常', { type: 'turn/end', seq: 2, data: { reason: { kind: 'error', error: { message: 'boom' } } } }, 'error'],
  ['turn/end 中止', { type: 'turn/end', seq: 3, data: { reason: { kind: 'aborted' } } }, 'running'],
  ['turn/start',    { type: 'turn/start', seq: 4, data: {} }, 'running'],
  ['tool/result err',{ type: 'tool/result', seq: 5, data: { name: 'bash', error: { reason: 'EACCES' } } }, 'error'],
  ['job/settled ok', { type: 'job/settled', seq: 6, data: { status: 'completed', title: 'build' } }, 'success'],
  ['job/settled fail',{ type: 'job/settled', seq: 7, data: { status: 'failed', title: 'test' } }, 'error'],
  ['command/done err',{ type: 'command/done', seq: 8, data: { kind: 'error', name: 'compile' } }, 'error'],
  ['无关事件',       { type: 'user/message', seq: 9, data: {} }, null],
];
for (const [name, event, expected] of cases) {
  const r = def({ id: 's1' }, event);
  const got = r ? r.kind : null;
  console.log((got === expected ? 'OK  ' : 'FAIL') + '  ' + name.padEnd(20) + ' -> ' + got);
}

/* 2) jobs 差分：首次静默 → 运行中 → 完成 → 异常 */
diffJobs(n, map, [{ id: 'j1', status: 'running', title: '构建' }], { initial: true });
console.log('\n首次采样后通知数:', n.snapshot().items.length, '(应为 0)');
diffJobs(n, map, [{ id: 'j1', status: 'completed', title: '构建' }]);
diffJobs(n, map, [{ id: 'j2', status: 'running', title: '测试' }]);
diffJobs(n, map, [{ id: 'j2', status: 'failed', title: '测试', error: 'exit 1' }]);
const snap = n.snapshot();
console.log('差分后通知数:', snap.items.length, '| seq:', snap.seq);
for (const e of snap.items) console.log('  ', e.kind, e.title, '-', e.detail);

/* 3) 去重：同一 key 连续两次只入一条 */
const n2 = createNotifier();
n2.push('running', '开始', 'A', 'same');
n2.push('running', '开始', 'A', 'same');
console.log('\n去重后条数:', n2.snapshot().items.length, '(应为 1)');
