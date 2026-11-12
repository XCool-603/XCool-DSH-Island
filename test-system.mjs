import { createSystemMonitor } from '../XCool-DSH灵动岛/src/host/system.js';

// 用 5 秒间隔跑一次真实采集，验证结构完整且不会抛
const mon = createSystemMonitor({ intervalMs: 60_000, enabled: true });
await mon.refresh();
const s = mon.snapshot();

console.log('enabled:', s.enabled, '| ok:', s.ok);
console.log('cpu:', s.fast?.cpuModel, '| cores:', s.fast?.cores, '| load:', s.fast?.cpuLoad);
console.log('mem:', s.fast?.memPct + '%', '| free:', s.fast?.memFreeGB + 'GB');
console.log('gpu:', s.gpu, '| gpuLoad:', s.gpuLoad);
console.log('disk:', s.diskFreeGB + '/' + s.diskTotalGB + 'GB');
console.log('mediaSupported:', s.mediaSupported, '| media:', JSON.stringify(s.media));

// 开关验证
mon.setEnabled(false);
console.log('\nafter disable:', JSON.stringify(mon.snapshot()));
mon.setEnabled(true);
console.log('after enable: enabled =', mon.snapshot().enabled);

mon.stop();
console.log('\nALL OK');
