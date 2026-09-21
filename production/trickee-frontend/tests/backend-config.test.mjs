import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("production frontend defaults to the live asia-south1 backend", () => {
  const sources = [read("next.config.mjs"), read("hooks/useDriverLocationWS.ts")];

  for (const source of sources) {
    assert.doesNotMatch(source, /asia-southeast1/, "stale Cloud Run region must not be shipped");
    assert.match(source, /trickee-backend-397358873357\.asia-south1\.run\.app/);
  }

  assert.match(read("lib/api.ts"), /DEFAULT_BACKEND_URL = "\/api\/backend"/);
});

test("production browser requests stay same-origin when Vercel has a stale backend URL", async () => {
  let resolveBrowserBackendUrl;
  try {
    ({ resolveBrowserBackendUrl } = await import("../lib/backend-url.mjs"));
  } catch (error) {
    assert.fail(`browser backend resolver is missing: ${error.message}`);
  }

  assert.equal(
    resolveBrowserBackendUrl(
      "production",
      "https://trickee-backend-397358873357.asia-southeast1.run.app",
    ),
    "/api/backend",
  );
  assert.equal(
    resolveBrowserBackendUrl("development", "http://127.0.0.1:8000"),
    "http://127.0.0.1:8000",
  );
});
