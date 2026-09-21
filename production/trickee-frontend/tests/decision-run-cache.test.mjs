import assert from "node:assert/strict";
import test from "node:test";

const decisions = await import("../lib/decision-run-cache.mjs").catch(() => ({}));

test("a partial retry reuses successful decisions and executes only the failed request", async () => {
  assert.equal(typeof decisions.createDecisionRunCache, "function");
  assert.equal(typeof decisions.runCachedDecisionSteps, "function");

  const cache = decisions.createDecisionRunCache();
  const attempts = { wait: 0, order: 0, charging: 0 };
  const steps = () => [
    {
      id: "wait",
      payload: { prep_min: 8, driver_location: { lng: 72.8, lat: 21.1 } },
      run: async () => {
        attempts.wait += 1;
        return { success: true, data: { estimated_wait_min: 11 } };
      },
    },
    {
      id: "order",
      payload: { order: { order_id: "ORDER-7" }, available_drivers: [{ driver_id: "D-1" }] },
      run: async () => {
        attempts.order += 1;
        return attempts.order === 1
          ? { success: false, data: null, error: "Assignment service unavailable" }
          : { success: true, data: { assigned_driver_id: "D-1" } };
      },
    },
    {
      id: "charging",
      payload: { driver: { driver_id: "D-1" }, order: { order_id: "ORDER-7" } },
      run: async () => {
        attempts.charging += 1;
        return { success: true, data: { chosen_option: "continue" } };
      },
    },
  ];

  const first = await decisions.runCachedDecisionSteps(cache, steps());
  assert.deepEqual(attempts, { wait: 1, order: 1, charging: 1 });
  assert.equal(first.wait.result.success, true);
  assert.equal(first.order.result.success, false);
  assert.equal(first.charging.result.success, true);

  const retry = await decisions.runCachedDecisionSteps(cache, steps());
  assert.deepEqual(attempts, { wait: 1, order: 2, charging: 1 });
  assert.equal(retry.wait.cached, true);
  assert.equal(retry.wait.result.data.estimated_wait_min, 11);
  assert.equal(retry.order.cached, false);
  assert.equal(retry.order.result.data.assigned_driver_id, "D-1");
  assert.equal(retry.charging.cached, true);
  assert.equal(retry.charging.result.data.chosen_option, "continue");
});

test("cache identity uses the exact request content independent of object insertion order", async () => {
  assert.equal(typeof decisions.createDecisionRunCache, "function");
  assert.equal(typeof decisions.runCachedDecisionSteps, "function");

  const cache = decisions.createDecisionRunCache();
  let attempts = 0;
  const execute = (payload) => decisions.runCachedDecisionSteps(cache, [{
    id: "wait",
    payload,
    run: async () => {
      attempts += 1;
      return { success: true, data: { attempt: attempts } };
    },
  }]);

  await execute({ location: { lat: 21.1, lng: 72.8 }, prep_min: 8 });
  const reordered = await execute({ prep_min: 8, location: { lng: 72.8, lat: 21.1 } });
  const changed = await execute({ prep_min: 9, location: { lng: 72.8, lat: 21.1 } });

  assert.equal(attempts, 2);
  assert.equal(reordered.wait.cached, true);
  assert.equal(reordered.wait.result.data.attempt, 1);
  assert.equal(changed.wait.cached, false);
  assert.equal(changed.wait.result.data.attempt, 2);
});
