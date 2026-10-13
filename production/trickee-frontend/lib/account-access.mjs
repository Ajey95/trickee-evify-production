export function isReadOnlyAccount(user) {
  return user?.access_mode === "read_only";
}


export function canUseMockSos(user) {
  return Array.isArray(user?.capabilities) && user.capabilities.includes("mock_sos");
}
