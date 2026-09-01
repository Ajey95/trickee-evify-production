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

test("trip reconciliation separates stored delivery from contiguous progress", () => {
  const page = read("app/(dashboard)/gps-pilot/page.tsx");
  const types = read("types/gps-pilot.ts");

  for (const field of [
    "actual_missing_sequences",
    "upload_completeness_pct",
    "highest_contiguous_sequence",
    "highest_received_sequence",
    "stored_gps_pct",
    "end_to_end_gps_pct",
    "phone_backlog",
  ]) {
    assert.match(types, new RegExp(`${field}:`));
    assert.match(page, new RegExp(`trip\\.${field}`));
  }
  assert.doesNotMatch(page, />Uploaded \{trip\.uploaded_through\}/);
  assert.doesNotMatch(page, />Processed \{trip\.processed_through/);
  assert.doesNotMatch(page, /trip\.missing_sequences/);
  assert.match(page, /Stored/);
  assert.match(page, /Contiguous/);
  assert.match(page, /Phone backlog/);
});
