function finite(value) {
  if (value == null || typeof value === 'boolean' || String(value).trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function readSoc(latest) {
  const value = finite(latest?.soc);
  return value !== null && value >= 0 && value <= 100 ? value : null;
}

export function scheduleDayType(start, offset) {
  const date = new Date(start);
  date.setDate(date.getDate() + offset);
  return [0, 6].includes(date.getDay()) ? 'weekend' : 'weekday';
}

export function scheduleRouteStatus(data) {
  const route = data?.ranked_routes?.[0];
  const socEnd = finite(route?.soc_end_pct ?? route?.soc_end);
  return route && !data.all_routes_infeasible && (route.is_feasible === true || (route.is_feasible == null && socEnd !== null && socEnd >= 10))
    ? 'planned' : 'needs_review';
}

export function parseOrderInput(input) {
  const orderId = input.orderId.trim();
  if (!orderId || orderId.length > 100) throw new Error('Enter an order ID of 1–100 characters.');
  const values = {};
  for (const [key, label, min, max] of [
    ['waitMinutes', 'Preparation time', 0, 180],
    ['distanceKm', 'Delivery distance', 0.01, 200],
    ['requiredRangeKm', 'Required range', 0.01, 500],
    ['pickupLat', 'Pickup latitude', -90, 90],
    ['pickupLng', 'Pickup longitude', -180, 180],
    ['dropLat', 'Drop-off latitude', -90, 90],
    ['dropLng', 'Drop-off longitude', -180, 180],
  ]) {
    const number = finite(input[key]);
    if (number === null || number < min || number > max) throw new Error(`Enter a valid ${label.toLowerCase()} (${min} to ${max}).`);
    values[key] = number;
  }
  return { order_id: orderId, restaurant_wait_min: values.waitMinutes, delivery_distance_km: values.distanceKm,
    required_range_km: values.requiredRangeKm, pickup_location: {lat: values.pickupLat, lng: values.pickupLng},
    drop_location: {lat: values.dropLat, lng: values.dropLng} };
}

export function buildDriverContext(driver, vehicle, liveDriver, point) {
  if (!driver || !vehicle) return null;
  const latest = vehicle.latest_telemetry ?? vehicle.latest;
  if ((latest?.driver_id ?? vehicle.latest_driver?.id) !== driver.id) return null;
  const soc = readSoc(latest);
  const range = finite(liveDriver?.range?.estimated_range_km ?? vehicle.latest_dynamic_range_km ?? vehicle.latest_prediction?.dynamic_range_km);
  const lat = finite(point?.lat ?? latest?.lat);
  const lng = finite(point?.lng ?? latest?.lng);
  if (soc === null || range === null || range < 0 || lat === null || lng === null || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { driver_id: driver.id, driver_code: driver.driver_code, vehicle_id: vehicle.id,
    soc, available_range_km: range, current_location: {lat, lng}, archetype: liveDriver?.archetype };
}
