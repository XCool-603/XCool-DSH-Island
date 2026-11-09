import { runAction, ACTION_NAMES } from './src/host/actions.js';

/* 假 ctx：模拟 cordis 的 get()，覆盖四种情况 */
function makeCtx(overrides = {}) {
  const services = {
    sessions: {
      list: () => [
        { id: 'session-test-1', header: { cwd: '/workspace' } },
      ],
    },
    agents: {
      list: () => [{ status: 'running', session: { id: 'session-test-1' } }],
    },
    schedule: {
      create: async (sessionId, request) => {
        if (!sessionId) throw new Error('missing sessionId');
        if (!request.title || !request.prompt) throw new Error('missing title/prompt');
        if (!request.after_seconds) throw new Error('missing delay');
        return { id: 'schedule-1', ...request };
      },
    },
    sessionController: {
      create: async (request) => ({ sessionId: 'session-new-1', cwd: request.cwd }),
      cancel: async (request) => ({ accepted: true, sessionId: request.sessionId }),
    },
    ...overrides,
  };
  return { get: (key) => services[key] };
}

const cases = [
  ['remind', { minutes: 5, text: '喝水' }],
  ['remind', { minutes: 999 }],
  ['newSession', {}],
  ['stopTurn', {}],
  ['copyText', { text: 'hello' }],
  ['unknown', {}],
];

console.log('actions:', ACTION_NAMES.join(', '));
for (const [action, payload] of cases) {
  const result = await runAction(makeCtx(), { action, ...payload });
  console.log(`${action.padEnd(12)} -> ok=${result.ok}  ${result.message}`);
}

// 服务缺失时不能抛
const empty = await runAction(makeCtx({ schedule: undefined, sessionController: undefined }), {
  action: 'remind', minutes: 5,
});
console.log('missing service ->', empty.ok, empty.message);
