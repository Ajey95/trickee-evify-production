// Checks method/path compatibility without sending mutations to the backend.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const origin = (process.env.BACKEND_URL || 'https://trickee-backend-397358873357.asia-south1.run.app').replace(/\/$/, '').replace(/\/api\/v1$/, '');
const res = await fetch(`${origin}/openapi.json`, { signal: AbortSignal.timeout(90_000) });
assert.equal(res.status, 200, 'OpenAPI must be reachable');
const spec = await res.json();
const calls = [];
const exports = {};
const source = ts.transpileModule(readFileSync(new URL('../lib/api.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
vm.runInNewContext(source, {
  exports, require: () => ({ readAccessToken: () => undefined, readRefreshToken: () => undefined, writeAuthSession: () => {} }),
  process: { env: {} }, window: { setTimeout, clearTimeout }, AbortController, Headers,
  fetch: async (url, options) => {
    calls.push({ url, method: options.method || 'GET' });
    return new Response(JSON.stringify({ success: true, data: {} }));
  },
});
for (const group of Object.values(exports.api)) {
  for (const method of Object.values(group)) {
    exports.resetApiClientState();
    await method('contract-id', {});
  }
}
for (const call of calls) {
  const path = new URL(call.url, 'https://frontend.invalid').pathname.replace('/api/backend', '/api/v1');
  const route = Object.keys(spec.paths).find(pattern => new RegExp(`^${pattern.replace(/\{[^}]+\}/g, '[^/]+')}$`).test(path));
  assert.ok(route, `Missing backend route: ${path}`);
  assert.ok(spec.paths[route][call.method.toLowerCase()], `Unsupported ${call.method} ${path}`);
}
console.log(`${calls.length} frontend API methods match the deployed OpenAPI paths and HTTP methods.`);
