import { createSystemMonitor } from '../XCool-DSH灵动岛/src/host/system.js';
const mon = createSystemMonitor({ intervalMs: 600000, enabled: true });
mon.stop();
const times = [];
for (let i = 0; i < 3; i++) {
  const t = Date.now();
  await mon.refresh();
  times.push(Date.now() - t);
}
const s = mon.snapshot();
console.log('采集耗时(ms):', times.join(', '), '| avg', Math.round(times.reduce((a, b) => a + b, 0) / times.length));
console.log('cpuFallback生效:', s.fast?.cpuLoad, '| diskDrive:', s.diskDrive, '| diskCount:', s.diskCount, '| gpu:', s.gpu);
mon.stop();
