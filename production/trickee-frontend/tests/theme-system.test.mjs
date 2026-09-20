import assert from "node:assert/strict";
import vm from "node:vm";
import test from "node:test";

let themeRuntime = {};

try {
  themeRuntime = await import("../lib/theme-runtime.mjs");
} catch {
  // The initial red run intentionally reaches these assertions before the
  // production theme runtime exists.
}

test("theme preference resolves stored values before the device preference", () => {
  assert.equal(themeRuntime.resolveTheme?.("light", true), "light");
  assert.equal(themeRuntime.resolveTheme?.("dark", false), "dark");
  assert.equal(themeRuntime.resolveTheme?.(null, true), "dark");
  assert.equal(themeRuntime.resolveTheme?.(null, false), "light");
  assert.equal(themeRuntime.resolveTheme?.("unexpected", false), "light");
});

test("theme storage is versioned and survives unavailable browser storage", () => {
  assert.equal(themeRuntime.THEME_STORAGE_KEY, "trickee-theme:v1");

  const values = new Map();
  const storage = {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };

  themeRuntime.saveTheme?.(storage, "light");
  assert.equal(themeRuntime.loadTheme?.(storage), "light");

  const unavailableStorage = {
    getItem() {
      throw new Error("blocked");
    },
    setItem() {
      throw new Error("blocked");
    },
  };

  assert.equal(themeRuntime.loadTheme?.(unavailableStorage), null);
  assert.doesNotThrow(() => themeRuntime.saveTheme?.(unavailableStorage, "dark"));
});

test("applying a theme updates the root contract consumed by CSS and controls", () => {
  const root = { dataset: {}, style: {} };

  themeRuntime.applyTheme?.(root, "light");
  assert.equal(root.dataset.theme, "light");
  assert.equal(root.style.colorScheme, "light");

  themeRuntime.applyTheme?.(root, "dark");
  assert.equal(root.dataset.theme, "dark");
  assert.equal(root.style.colorScheme, "dark");
});

test("bootstrap script applies a persisted theme before hydration", () => {
  const root = { dataset: {}, style: {} };
  const context = {
    document: { documentElement: root },
    localStorage: { getItem: () => "light" },
    matchMedia: () => ({ matches: true }),
  };
  context.window = context;

  vm.runInNewContext(themeRuntime.THEME_BOOTSTRAP_SCRIPT, context);

  assert.equal(root.dataset.theme, "light");
  assert.equal(root.style.colorScheme, "light");
});
