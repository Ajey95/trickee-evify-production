import assert from "node:assert/strict";
import test from "node:test";

let createGoogleIdentityButtonController;
try {
  ({ createGoogleIdentityButtonController } = await import(
    "../lib/google-button-controller.mjs"
  ));
} catch {
  // The RED phase deliberately starts before the controller exists.
}

test("resizing rerenders the Google button without reinitializing Google Identity", () => {
  assert.equal(
    typeof createGoogleIdentityButtonController,
    "function",
    "Google button controller is not implemented",
  );

  const initializeCalls = [];
  const renderCalls = [];
  const credentials = [];
  const errors = [];
  const googleIdentity = {
    initialize(options) {
      initializeCalls.push(options);
    },
    renderButton(target, options) {
      renderCalls.push({ target, options });
    },
  };
  const target = {
    clientWidth: 374,
    replaceChildren() {},
  };
  const controller = createGoogleIdentityButtonController({
    googleIdentity,
    clientId: "web-client.apps.googleusercontent.com",
    onCredential: (credential) => credentials.push(credential),
    onError: (message) => errors.push(message),
  });

  controller.render(target);
  target.clientWidth = 320;
  controller.render(target);

  assert.equal(initializeCalls.length, 1);
  assert.equal(initializeCalls[0].use_fedcm_for_button, true);
  assert.equal(renderCalls.length, 2);
  assert.equal(renderCalls[0].options.width, 374);
  assert.equal(renderCalls[1].options.width, 320);

  initializeCalls[0].callback({ credential: "google-id-token" });
  initializeCalls[0].callback({});
  assert.deepEqual(credentials, ["google-id-token"]);
  assert.deepEqual(errors, ["Google did not return an ID token."]);
});
