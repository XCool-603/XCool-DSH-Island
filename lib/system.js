/**
 * 岛仔 · 本机状态采集
 *
 * 分两层，避免拖慢 /island/state 轮询：
 *  - 快层：Node 原生 os 模块（CPU 型号/负载、内存、系统时长）—— 零子进程、每次可读
 *  - 慢层：PowerShell 取 GPU 利用率 / 显存 / 磁盘 / SMTC 音乐 —— 约 0.3~3s，
 *          后台低频（默认 12s）刷新，结果缓存；失败自动降级、不抛到主链路。
 *
 * 所有采集都是只读，不修改系统状态。
 */
import { cpus, totalmem, freemem, uptime, platform, arch } from 'node:os';
import { spawn } from 'node:child_process';

const DEFAULT_INTERVAL_MS = 12_000;

function safeJson(text) {
  try {
    return JSON.parse(String(text).trim());
  } catch {
    return null;
  }
}

/** 跑一段 PowerShell，带超时；永不抛 */
function runPowerShell(code, timeoutMs = 6000) {
  return new Promise((resolve) => {
    let done = false;
    let out = '';
    let err = '';
    const finish = (value) => {
      if (done) return;
      done = true;
      resolve(value);
    };
    let child;
    try {
      child = spawn('powershell', ['-NoProfile', '-NonInteractive', '-Command', code], {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch {
      finish(null);
      return;
    }
    const timer = setTimeout(() => {
      try { child.kill(); } catch { /* ignore */ }
      finish(null);
    }, timeoutMs);
    child.stdout?.on('data', (chunk) => { out += chunk.toString(); });
    child.stderr?.on('data', (chunk) => { err += chunk.toString(); });
    child.on('error', () => { clearTimeout(timer); finish(null); });
    child.on('close', () => {
      clearTimeout(timer);
      finish(safeJson(out) ?? (err ? null : null));
    });
  });
}

/* ── 快层：Node 原生 ─────────────────────────────── */

function readFast() {
  try {
    const list = cpus();
    const model = list[0]?.model ?? '未知 CPU';
    // 用两次采样之间的累计时间差算负载；首次给 null，由后续刷新填充
    let idle = 0;
    let total = 0;
    for (const cpu of list) {
      const times = cpu.times;
      idle += times.idle;
      total += times.user + times.nice + times.sys + times.idle + times.irq;
    }
    return {
      cpuModel: String(model).replace(/\(R\)|\(TM\)|CPU @.*$/g, '').trim(),
      cores: list.length,
      cpuLoad: computeCpuLoad(idle, total),
      memTotalGB: round(totalmem() / GB, 1),
      memFreeGB: round(freemem() / GB, 1),
      memPct: Math.round(((totalmem() - freemem()) / totalmem()) * 100),
      uptimeHours: Math.round(uptime() / 3600),
      platform: `${platform()} ${arch()}`,
    };
  } catch {
    return null;
  }
}

const GB = 1024 ** 3;
const round = (n, d = 0) => Math.round(n * 10 ** d) / 10 ** d;

let prevIdle = 0;
let prevTotal = 0;
function computeCpuLoad(idle, total) {
  if (prevTotal === 0) {
    prevIdle = idle;
    prevTotal = total;
    return null;
  }
  const dIdle = idle - prevIdle;
  const dTotal = total - prevTotal;
  prevIdle = idle;
  prevTotal = total;
  if (dTotal <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((1 - dIdle / dTotal) * 100)));
}

/* ── 慢层：PowerShell（GPU / 磁盘 / 音乐） ────────── */

const PS_GPU_DISK = `
$ErrorActionPreference='SilentlyContinue'
$o=[ordered]@{}
$gpus=@(Get-CimInstance Win32_VideoController | Where-Object {$_.Name -notmatch 'Virtual|Basic Display'})
$o.gpu = if($gpus.Count -gt 0){ ($gpus | Select-Object -First 1 -ExpandProperty Name) } else { '' }
$g=0
try { $c=(Get-Counter '\\GPU Engine(*)\\Utilization Percentage' -ErrorAction Stop).CounterSamples; if($c){ $g=[math]::Round(($c | Measure-Object CookedValue -Sum).Sum) } } catch {}
$o.gpuLoad=$g
$d=Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='C:'"
if($d){ $o.diskFreeBytes=[double]$d.FreeSpace; $o.diskTotalBytes=[double]$d.Size; $o.diskDrive=[string]$d.DeviceID }
$b=Get-CimInstance Win32_Battery
if($b){ $o.battery=[int]$b.EstimatedChargeRemaining }
$o | ConvertTo-Json -Compress
`;

const PS_MEDIA = `
$ErrorActionPreference='Stop'
try {
  [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager,Windows.Media.Control,ContentType=WindowsRuntime] | Out-Null
  Add-Type -AssemblyName System.Runtime.WindowsRuntime
  $asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1' } | Select-Object -First 1
  $op = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()
  $task = $asTask.MakeGenericMethod([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]).Invoke($null, @($op))
  if (-not $task.Wait(2500)) { Write-Output '{"ok":false,"reason":"timeout"}'; exit }
  $mgr = $task.Result
  $s = $mgr.GetCurrentSession()
  if ($null -eq $s) { Write-Output '{"ok":true,"playing":false}'; exit }
  $op2 = $s.TryGetMediaPropertiesAsync()
  $task2 = $asTask.MakeGenericMethod([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties]).Invoke($null, @($op2))
  if (-not $task2.Wait(1500)) { Write-Output '{"ok":false,"reason":"props_timeout"}'; exit }
  $m = $task2.Result
  $pi = $s.GetPlaybackInfo()
  $tl = $s.GetTimelineProperties()
  [ordered]@{
    ok=$true; playing=($pi.PlaybackStatus -eq 3)
    title=[string]$m.Title; artist=[string]$m.Artist; album=[string]$m.AlbumTitle
    app=[string]$s.SourceAppUserModelId
    position=[math]::Round($tl.Position.TotalSeconds); duration=[math]::Round($tl.EndTime.TotalSeconds)
  } | ConvertTo-Json -Compress
} catch { Write-Output '{"ok":false}' }
`;

/* ── 采集器 ───────────────────────────────────────── */

export function createSystemMonitor({ intervalMs = DEFAULT_INTERVAL_MS, enabled = true } = {}) {
  let cache = {
    ok: false,
    collectedAt: 0,
    fast: null,
    gpu: null,
    gpuLoad: null,
    diskFreeGB: null,
    diskTotalGB: null,
    diskFreeBytes: null,
    diskDrive: null,
    battery: null,
    media: null,
    mediaSupported: true,
  };
  let timer = null;
  let inFlight = null;
  let isEnabled = enabled;

  async function collectSlow() {
    // 两个 PowerShell 并行跑，总耗时取较慢的那个
    const [gpuDisk, media] = await Promise.all([
      runPowerShell(PS_GPU_DISK, 7000),
      runPowerShell(PS_MEDIA, 6000),
    ]);
    return { gpuDisk, media };
  }

  async function refresh() {
    // 并发调用复用同一次采集，避免调用者拿到还没填好的缓存
    if (inFlight) return inFlight;
    inFlight = (async () => {
    try {
      const fast = readFast();
      const { gpuDisk, media } = await collectSlow();
      cache = {
        ok: true,
        collectedAt: Date.now(),
        fast,
        gpu: gpuDisk?.gpu || null,
        gpuLoad: Number.isFinite(gpuDisk?.gpuLoad)
          ? Math.max(0, Math.min(100, Math.round(gpuDisk.gpuLoad)))
          : null,
        diskFreeBytes: Number.isFinite(gpuDisk?.diskFreeBytes) ? gpuDisk.diskFreeBytes : null,
        diskFreeGB: Number.isFinite(gpuDisk?.diskFreeBytes)
          ? Math.round((gpuDisk.diskFreeBytes / 1024 ** 3) * 100) / 100
          : null,
        diskTotalGB: Number.isFinite(gpuDisk?.diskTotalBytes)
          ? Math.round((gpuDisk.diskTotalBytes / 1024 ** 3) * 10) / 10
          : null,
        diskDrive: typeof gpuDisk?.diskDrive === 'string' ? gpuDisk.diskDrive : null,
        battery: Number.isFinite(gpuDisk?.battery) ? gpuDisk.battery : null,
        media: media && media.ok
          ? {
              playing: media.playing === true,
              title: String(media.title ?? '').slice(0, 120),
              artist: String(media.artist ?? '').slice(0, 80),
              album: String(media.album ?? '').slice(0, 80),
              app: String(media.app ?? '').slice(0, 80),
              position: Number(media.position) || 0,
              duration: Number(media.duration) || 0,
            }
          : null,
        mediaSupported: media !== null,
      };
    } catch {
      // 保留上一次缓存，只标记本次失败
      cache = { ...cache, ok: cache.collectedAt > 0 };
    } finally {
      inFlight = null;
    }
    })();
    return inFlight;
  }

  function start() {
    if (timer || !isEnabled) return;
    void refresh();
    timer = setInterval(() => { void refresh(); }, Math.max(5000, intervalMs));
    // 别让定时器阻止进程退出
    try { timer.unref?.(); } catch { /* ignore */ }
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  function setEnabled(value) {
    const next = Boolean(value);
    if (next === isEnabled) return;
    isEnabled = next;
    if (next) start();
    else stop();
  }

  /** 主链路只读缓存，绝不触发采集 */
  function snapshot() {
    if (!isEnabled) return { enabled: false };
    return { enabled: true, ...cache };
  }

  if (isEnabled) start();
  return { start, stop, setEnabled, snapshot, refresh };
}
