export function createGoogleIdentityButtonController({
  googleIdentity,
  clientId,
  onCredential,
  onError,
}) {
  let initialized = false;

  function initializeOnce() {
    if (initialized) return;
    googleIdentity.initialize({
      client_id: clientId,
      auto_select: false,
      cancel_on_tap_outside: true,
      use_fedcm_for_button: true,
      callback: (response) => {
        if (response.credential) {
          onCredential(response.credential);
        } else {
          onError("Google did not return an ID token.");
        }
      },
    });
    initialized = true;
  }

  return {
    render(target) {
      initializeOnce();
      target.replaceChildren();
      googleIdentity.renderButton(target, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "rectangular",
        logo_alignment: "left",
        width: Math.min(Math.max(target.clientWidth, 240), 400),
      });
    },
  };
}
