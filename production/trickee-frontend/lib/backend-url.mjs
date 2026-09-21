const SAME_ORIGIN_BACKEND_URL = "/api/backend";

export function resolveBrowserBackendUrl(nodeEnv, configuredBackendUrl) {
  const backendUrl =
    nodeEnv === "production"
      ? SAME_ORIGIN_BACKEND_URL
      : configuredBackendUrl || SAME_ORIGIN_BACKEND_URL;

  return backendUrl.replace(/\/$/, "");
}
