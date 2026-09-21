import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { rm } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nextCli = path.join(projectRoot, "node_modules", "next", "dist", "bin", "next");
const port = 3137;
const externalBaseUrl = process.env.TEST_BASE_URL?.replace(/\/$/, "");
const baseUrl = externalBaseUrl || `http://127.0.0.1:${port}`;
const output = [];
let ownedServerBecameReady = false;

const server = externalBaseUrl
  ? null
  : spawn(process.execPath, [nextCli, "dev", "--turbo", "-H", "127.0.0.1", "-p", String(port)], {
      cwd: projectRoot,
      env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    });

server?.stdout.on("data", (chunk) => output.push(chunk.toString()));
server?.stderr.on("data", (chunk) => output.push(chunk.toString()));

async function waitForServer() {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (server && server.exitCode !== null) {
      throw new Error(`Next.js exited before becoming ready.\n${output.join("")}`);
    }
    try {
      const response = await fetch(`${baseUrl}/__public_page_test_ready__`, { redirect: "manual" });
      if (response.status > 0) {
        ownedServerBecameReady = Boolean(server);
        return;
      }
    } catch {
      // The development server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for Next.js.\n${output.join("")}`);
}

async function stopServer() {
  if (!server) return;

  if (server.exitCode === null) {
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"], {
        stdio: "ignore",
      });
    } else {
      server.kill("SIGTERM");
      await Promise.race([
        once(server, "exit"),
        new Promise((resolve) => setTimeout(resolve, 5_000)),
      ]);
      if (server.exitCode === null) server.kill("SIGKILL");
    }
  }

  if (ownedServerBecameReady) {
    // A forced owned development-server stop can leave partially written route types.
    await rm(path.join(projectRoot, ".next", "dev"), { recursive: true, force: true });
  }
}

test.after(stopServer);

test("GPS Driver public information routes render without authentication", async () => {
  await waitForServer();

  const routes = [
    ["/gpsdriver/privacy", "GPS Driver Privacy Policy"],
    ["/gpsdriver/support", "GPS Driver Support"],
    ["/gpsdriver/terms", "GPS Driver Terms of Use"],
  ];

  for (const [route, heading] of routes) {
    const response = await fetch(`${baseUrl}${route}`, { redirect: "manual" });
    const html = await response.text();
    assert.equal(
      response.status,
      200,
      `${route} must be publicly reachable\n${output.join("")}`,
    );
    assert.match(html, new RegExp(`<h1[^>]*>\\s*${heading}\\s*</h1>`));
  }
});

test("the public shell exposes a persistent sun and moon theme control", async () => {
  await waitForServer();

  const response = await fetch(baseUrl);
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(html, /aria-label="Toggle sun and moon theme"/);
  assert.match(html, /trickee-theme:v1/);
});

test("the public landing renders the complete route-intelligence journey", async () => {
  await waitForServer();

  const response = await fetch(baseUrl);
  const html = await response.text();

  assert.equal(response.status, 200);
  for (const id of ["ping", "signal-gap", "predict", "prie", "ride", "trust", "field-notes", "contact"]) {
    assert.match(html, new RegExp(`id="${id}"`), `missing journey section #${id}`);
  }
  assert.match(html, /Your car already/);
  assert.match(html, /The signal/);
  assert.match(html, /The road speaks/);
  assert.match(html, /Foresight/);
  assert.match(html, /Every turn/);
  assert.match(html, /Proof, in every/);
  assert.match(html, /Move with/);
  assert.match(html, /custom-logo-intro/);
  assert.doesNotMatch(html, /<video|logo_reveal\.mp4/);
  assert.match(html, /Intelligence, in motion/);
  assert.match(html, /data-marquee-track/);
  assert.match(html, /href="\/fleet"/);
  assert.match(html, /href="\/signup"/);
});
