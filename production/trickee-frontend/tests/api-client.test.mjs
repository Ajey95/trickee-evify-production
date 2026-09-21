import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { resolveBrowserBackendUrl } from '../lib/backend-url.mjs';

function client(handler, initial = { refresh_token: 'refresh-old' }) {
  let session = initial;
  const storage = {
    readAccessToken: () => session?.access_token,
    readRefreshToken: () => session?.refresh_token,
    writeAuthSession: (value) => { session = value; },
  };
  const exports = {};
  const source = ts.transpileModule(readFileSync(new URL('../lib/api.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(source, {
    exports,
    require: (specifier) => specifier.includes('backend-url')
      ? { resolveBrowserBackendUrl }
      : storage,
    process: { env: {} },
    window: { setTimeout, clearTimeout }, AbortController, Headers,
    fetch: handler, console,
  });
  return { ...exports, session: () => session };
}
const response = (data, status = 200) => new Response(JSON.stringify(data), { status });

test('concurrent expired sessions rotate once and authenticate both reads', async () => {
  let refreshes = 0;
  const auth = [];
  const c = client(async (url, options) => {
    if (url.endsWith('/auth/refresh')) {
      refreshes++;
      return response({ success: true, data: { access_token: 'new-access', refresh_token: 'rotated' } });
    }
    auth.push(new Headers(options.headers).get('Authorization'));
    return response({ success: true, data: [] });
  });
  await Promise.all([c.api.vehicles.list(), c.api.drivers.list()]);
  assert.equal(refreshes, 1);
  assert.equal(c.session()?.refresh_token, 'rotated');
  assert.deepEqual(auth, ['Bearer new-access', 'Bearer new-access']);
});

test('temporary refresh failure preserves the refresh session', async () => {
  const c = client(async () => response({ detail: 'Temporarily unavailable' }, 503));
  await c.api.auth.me();
  assert.equal(c.session()?.refresh_token, 'refresh-old');
});

test('a rejected access token refreshes and retries the protected request once', async () => {
  let reads = 0;
  const c = client(async (url, options) => {
    if (url.endsWith('/auth/refresh')) return response({ success: true, data: { access_token: 'new', refresh_token: 'rotated' } });
    reads++;
    return new Headers(options.headers).get('Authorization') === 'Bearer new'
      ? response({ success: true, data: { id: 'user' } })
      : response({ detail: 'Expired' }, 401);
  }, { access_token: 'old', refresh_token: 'refresh-old' });
  assert.equal((await c.api.auth.me()).success, true);
  assert.equal(reads, 2);
});

test('validation errors are readable strings and malformed responses fail safely', async () => {
  const c = client(async () => response({ detail: [{ loc: ['body', 'email'], msg: 'Invalid email' }] }, 422), {});
  assert.equal(typeof (await c.api.auth.me()).error, 'string');
  const malformed = client(async () => new Response('<html>Gateway error</html>'), {});
  assert.equal((await malformed.api.auth.me()).success, false);
});

test('logout reset prevents a pending refresh from restoring a session', async () => {
  let finish;
  const c = client(async (url) => {
    if (url.endsWith('/auth/refresh')) return new Promise(resolve => { finish = resolve; });
    return response({ success: true, data: [] });
  });
  const pending = c.api.vehicles.list();
  await Promise.resolve();
  c.resetApiClientState();
  finish(response({ success: true, data: { access_token: 'new', refresh_token: 'rotated' } }));
  await pending;
  assert.equal(c.session()?.access_token, undefined);
});
