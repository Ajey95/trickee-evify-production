import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nextCli = path.join(projectRoot, "node_modules", "next", "dist", "bin", "next");
const port = 3137;
const baseUrl = `http://127.0.0.1:${port}`;
const output = [];

const server = spawn(process.execPath, [nextCli, "dev", "--turbo", "-H", "127.0.0.1", "-p", String(port)], {
  cwd: projectRoot,
  env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
  stdio: ["ignore", "pipe", "pipe"],
});

server.stdout.on("data", (chunk) => output.push(chunk.toString()));
server.stderr.on("data", (chunk) => output.push(chunk.toString()));

async function waitForServer() {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`Next.js exited before becoming ready.\n${output.join("")}`);
    }
    try {
      const response = await fetch(`${baseUrl}/__public_page_test_ready__`, { redirect: "manual" });
      if (response.status > 0) return;
    } catch {
      // The development server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for Next.js.\n${output.join("")}`);
}

async function stopServer() {
  if (server.exitCode !== null) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"], {
      stdio: "ignore",
    });
    return;
  }
  server.kill("SIGTERM");
  await Promise.race([
    once(server, "exit"),
    new Promise((resolve) => setTimeout(resolve, 5_000)),
  ]);
  if (server.exitCode === null) server.kill("SIGKILL");
}

test("mobile app public information routes render without authentication", async (t) => {
  t.after(stopServer);
  await waitForServer();

  const routes = [
    ["/gpsdriver/privacy", "GPS Driver Privacy Policy"],
    ["/gpsdriver/support", "GPS Driver Support"],
    ["/gpsdriver/terms", "GPS Driver Terms of Use"],
    ["/vrtrickee/privacy", "VRTrickee Privacy Policy"],
    ["/vrtrickee/support", "VRTrickee Support"],
    ["/vrtrickee/terms", "VRTrickee Terms of Use"],
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
