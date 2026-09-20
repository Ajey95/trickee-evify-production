import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function loadModule() {
  const scripts = [];
  const document = {
    head: {
      appendChild(script) {
        scripts.push(script);
      },
    },
    createElement() {
      return {
        dataset: {},
        addEventListener(type, listener) {
          this.listeners ??= {};
          this.listeners[type] = listener;
        },
        removeEventListener(type) {
          delete this.listeners?.[type];
        },
        dispatch(type) {
          this.listeners?.[type]?.();
          this[`on${type}`]?.();
        },
        remove() {
          const index = scripts.indexOf(this);
          if (index >= 0) scripts.splice(index, 1);
        },
      };
    },
    querySelector() {
      return scripts.find((script) =>
        script.src === "https://accounts.google.com/gsi/client"
      ) ?? null;
    },
  };
  const window = { document, setTimeout, clearTimeout };
  const exports = {};
  const source = ts.transpileModule(
    readFileSync(new URL("../lib/google-identity.ts", import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;

  vm.runInNewContext(source, { exports, process: { env: {} }, window, document });
  return { ...exports, scripts, window };
}

test("a failed Google script load can be retried", async () => {
  const harness = loadModule();
  const firstLoad = harness.loadGoogleIdentityScript({ timeoutMs: 20 });
  assert.equal(harness.scripts.length, 1);
  harness.scripts[0].dispatch("error");
  await assert.rejects(firstLoad, /Unable to load Google sign-in/);

  const retry = harness.loadGoogleIdentityScript({ timeoutMs: 20 });
  assert.equal(harness.scripts.length, 1, "retry should replace the failed script");
  harness.window.google = { accounts: { id: {} } };
  harness.scripts[0].dispatch("load");
  await retry;
});

test("a Google script that never settles fails within the configured timeout", async () => {
  const harness = loadModule();
  const outcome = await Promise.race([
    harness.loadGoogleIdentityScript({ timeoutMs: 10 }).then(
      () => "resolved",
      (error) => error.message,
    ),
    new Promise((resolve) => setTimeout(() => resolve("still pending"), 50)),
  ]);

  assert.match(outcome, /timed out/i);
});
