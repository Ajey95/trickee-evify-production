export function vehicleDriverId(vehicle) {
  return vehicle?.latest_telemetry?.driver_id
    ?? vehicle?.latest?.driver_id
    ?? vehicle?.latest_driver?.id
    ?? null;
}

export function chatVehiclesForDriver(vehicles, driverId) {
  if (!driverId) return [];
  return vehicles.filter((vehicle) => vehicleDriverId(vehicle) === driverId);
}

export function selectChatVehicleId(vehicles, driverId, selectedVehicleId = "") {
  const compatible = chatVehiclesForDriver(vehicles, driverId);
  return compatible.some((vehicle) => vehicle.id === selectedVehicleId)
    ? selectedVehicleId
    : compatible[0]?.id || "";
}
