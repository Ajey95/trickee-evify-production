import test from "node:test";
import assert from "node:assert/strict";

import { canUseMockSos, isReadOnlyAccount } from "../lib/account-access.mjs";


test("read-only access is driven by the authenticated server profile", () => {
  assert.equal(isReadOnlyAccount({ access_mode: "read_only" }), true);
  assert.equal(isReadOnlyAccount({ access_mode: "full" }), false);
  assert.equal(isReadOnlyAccount(null), false);
});


test("mock SOS is only shown when the server grants the capability", () => {
  assert.equal(canUseMockSos({ capabilities: ["mock_sos"] }), true);
  assert.equal(canUseMockSos({ capabilities: [] }), false);
  assert.equal(canUseMockSos({ email: "jshah862@gmail.com" }), false);
});
