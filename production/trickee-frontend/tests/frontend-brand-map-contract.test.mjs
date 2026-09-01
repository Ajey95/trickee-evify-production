import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

function sourceFiles(relativeDirectory) {
  const directory = path.join(root, relativeDirectory);
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = path.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) return sourceFiles(relativePath);
    return /\.(?:ts|tsx)$/.test(entry.name) ? [relativePath] : [];
  });
}

test("dashboard hides the floating SOC card without reserving its old gutter", () => {
  const layout = read("app/(dashboard)/layout.tsx");

  assert.doesNotMatch(layout, /FloatingSocBadge/);
  assert.doesNotMatch(layout, /2xl:pr-\[280px\]/);
});

test("frontend source does not expose the old Evify display brand", () => {
  const matches = [...sourceFiles("app"), ...sourceFiles("components")].filter((file) => /\bevify\b/i.test(read(file)));

  assert.deepEqual(matches, []);
});

test("frontend maps use keyless OpenStreetMap tile sources", () => {
  const maps = [read("components/map/LiveMapPanel.tsx"), read("components/intelligence/MapPicker.tsx")];

  for (const map of maps) {
    assert.match(map, /tile\.openstreetmap\.org/);
    assert.doesNotMatch(map, /basemaps\.cartocdn\.com/);
  }
});
