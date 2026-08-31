import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("GPS Pilot is an admin-only route backed by the monitoring proxy", () => {
  const roles = read("lib/roles.ts");
  const page = read("app/(dashboard)/gps-pilot/page.tsx");
  const api = read("lib/api.ts");

  assert.match(roles, /GPS Pilot.+\/gps-pilot.+trickee_admin/);
  assert.match(page, /allowedRoles=\{\["trickee_admin"\]\}/);
  assert.match(page, /useVisibilityPolling\(load.+30_000/s);
  assert.match(api, /gpsPilot.+\/admin\/gps-pilot/s);
});
