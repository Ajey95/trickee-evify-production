import assert from 'node:assert/strict';
import test from 'node:test';
import { readSoc, scheduleDayType, scheduleRouteStatus, parseOrderInput, buildDriverContext } from '../lib/operational-inputs.mjs';

test('zero battery is preserved and absent or invalid telemetry is unavailable', () => {
  assert.equal(readSoc({soc:0}), 0);
  for (const latest of [undefined, {}, {soc:null}, {soc:''}, {soc:101}, {soc:-1}]) assert.equal(readSoc(latest), null);
});
test('schedule uses actual local calendar weekends', () => {
  assert.equal(scheduleDayType(new Date(2026,8,6),0),'weekend');
  assert.equal(scheduleDayType(new Date(2026,8,6),1),'weekday');
  assert.equal(scheduleDayType(new Date(2026,8,6),6),'weekend');
});
test('failed, missing, empty-battery and infeasible routes require review', () => {
  for(const data of [null, {}, {all_routes_infeasible:true,ranked_routes:[{}]}, {ranked_routes:[{is_feasible:false,soc_end:30}]}, {ranked_routes:[{soc_end:0}]}]) assert.equal(scheduleRouteStatus(data),'needs_review');
  assert.equal(scheduleRouteStatus({ranked_routes:[{is_feasible:true,soc_end_pct:35}]}),'planned');
  assert.equal(scheduleRouteStatus({ranked_routes:[{is_feasible:true,soc_end_pct:5}]}),'planned');
});
const order={orderId:'ORDER-123',waitMinutes:'0',distanceKm:'8',requiredRangeKm:'11',pickupLat:'0',pickupLng:'72.8',dropLat:'21.2',dropLng:'72.9'};
test('operator order inputs preserve zero coordinates and reject missing/invalid fields', () => {
  const result=parseOrderInput(order);
  assert.equal(result.pickup_location.lat,0);assert.equal(result.restaurant_wait_min,0);assert.equal(result.order_id,'ORDER-123');
  for(const patch of [{orderId:''},{orderId:'x'.repeat(101)},{pickupLat:''},{pickupLat:'91'},{dropLng:'181'},{distanceKm:'-1'},{distanceKm:'201'},{requiredRangeKm:'501'},{requiredRangeKm:'Infinity'},{waitMinutes:'-1'},{waitMinutes:'181'}]) assert.throws(()=>parseOrderInput({...order,...patch}));
});
test('decision context uses only mapped live vehicle facts and never invents SOC or range', () => {
  const driver={id:'d1',driver_code:'D1'};
  const vehicle={id:'v1',latest:{driver_id:'d1',soc:0,lat:0,lng:72.8,speed:0},latest_dynamic_range_km:0};
  const result=buildDriverContext(driver,vehicle,null,null);
  assert.equal(result.soc,0);assert.equal(result.available_range_km,0);assert.equal(result.current_location.lat,0);
  assert.equal(buildDriverContext(driver,{...vehicle,latest:{...vehicle.latest,driver_id:'d2'}},null,null),null);
  assert.equal(buildDriverContext(driver,{...vehicle,latest:{driver_id:'d1'}},null,null),null);
  assert.equal(buildDriverContext(driver,{...vehicle,latest_dynamic_range_km:undefined},null,null),null);
});
