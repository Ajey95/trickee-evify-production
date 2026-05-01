# Trickee — Current State & Roadmap
**Last Updated:** April 2026  
**Covers:** What is built today, what is planned, and what needs to happen in what order.

---

## 1. What Trickee Has Built Today

### 1.1 The AI Engine — V4.1 Physics-Informed LSTM

| Property | Value |
|---|---|
| Model type | Bidirectional LSTM |
| Target | `delta_soc` (next 5-minute SOC shift) |
| Features | 20 (9 raw from Evify + 4 bonus telemetry + 7 Trickee-computed physics) |
| MAE | **0.41% SOC units** |
| Accuracy within ±1% | 92.62% |
| Accuracy within ±3% | 99.75% |
| Model parameters | 135,169 |
| Train/test split | GroupShuffleSplit — tested blind on unseen vehicles |
| Loss function | Huber Loss (robust to sensor noise spikes) |
| Scaler | RobustScaler |
| Sequence length | 20 timesteps (100-minute lookback window) |
| Model file | `aicodeold/model_training/v4/battery_model_v4_1.pth` |
| Scalers | `scaler_v4_1.joblib`, `y_scaler_v4_1.joblib` |

**Physics features Trickee computes internally (no extra Evify data needed):**
- `power` = voltage × current
- `power_density` = power / capacity_Wh
- `temp_rise_rate` = dT/dt (thermal momentum)
- `voltage_sag_v` = OCV_curve(soc) − battery_voltage
- `r_internal_mohm` = f(cycle_count, SOH) — internal resistance proxy
- `minute_of_day` — time of day pattern
- `day_of_week` — weekday vs weekend intensity

---

### 1.2 The Dashboards

#### Evify Fleet Dashboard (`evify_dashboard.py`)
- Live fleet overview: all vehicles as KPI cards
- Status tagging: Charging 🔌 / Regen ♻️ / Driving 🏃 / Idling 🛑
- Battery health metrics per vehicle
- SOH trends, cell imbalance monitoring

#### Evify Predictive Dashboard (`evify_predictive_dashboard.py`)
- Live LSTM inference: 100-minute rolling window → next 5-minute SOC prediction
- **Dynamic range formula** (not naive BMS estimate):
  ```
  Range = 85km × SOH_factor × Thermal_factor × Aggression_factor
  ```
- Range penalty breakdown (expandable): SOH loss / thermal penalty / aggression penalty
- 4 KPI cards: Dynamic Range Now | AI Predicted Shift | Predicted Range After 5m | Ground Truth
- 100-minute context graph with AI prediction horizon
- Context features: thermal momentum, motor load stress, pack resistance
- **V5 Roadmap section** embedded in dashboard (external APIs table)

#### Interview Route Intelligence Dashboard (`interview/streamlit_dashboard.py`)
- 5-page dark-mode app
- Multi-route comparison, 7-day schedule, EV energy charts, personalized nudges, rerouting simulator

---

### 1.3 Data Currently Feeding the Model (13 Fields from Evify)

| # | Field | Type |
|---|---|---|
| 1 | `soc` | Raw telemetry |
| 2 | `current` | Raw telemetry |
| 3 | `battery_voltage` | Raw telemetry |
| 4 | `speed` | Raw telemetry |
| 5 | `temp_max` | Raw telemetry |
| 6 | `soh` | Raw telemetry |
| 7 | `charge_plug` | Raw telemetry |
| 8 | `ignition_on` | Raw telemetry |
| 9 | `time` | Raw telemetry |
| 10 | `regen_status` | Bonus telemetry |
| 11 | `throttle_status` | Bonus telemetry |
| 12 | `cycle_count` | Bonus telemetry |
| 13 | `cell_imbalance_mv` | Bonus telemetry |

---

### 1.4 Documentation Written

| File | Purpose |
|---|---|
| `evify_report_v4.1.md` | Technical report: model architecture, feature list, validation results, V5 roadmap |
| `visualization_benefits.md` | Business value mapping for stakeholders |
| `trickee_x_evify_colab.md` | Collaboration pitch document |
| `analysis/trickee_next_stage_analysis.md` | Full next-stage plan of action |
| `analysis/competitor_matrix.md` | Competitive comparison across 17 dimensions |
| `interview/trickee_interview_deep_analysis.md` | Microscopic analysis of the interview submission |

---

## 2. The Versioned Roadmap

### V4.1 — Current State ✅ Done

- [x] Physics-informed LSTM (0.41% MAE)
- [x] Fleet dashboard with live status tagging
- [x] Predictive dashboard with AI inference
- [x] Dynamic range formula (SOH × thermal × aggression)
- [x] Cold-start: rule-based fallback when window empty
- [x] V5 roadmap embedded in report and dashboard

---

### V5-A — Driver Behavioral Features 🔜 Next

**What changes:** Add 5 fields to Evify API request. Compute 4 rolling behavioral columns per driver. Retrain model with 24 features.

**Expected MAE:** 0.41% → ~0.28%

#### Task Checklist

- [ ] **Request 5 new fields from Evify:**
  - [ ] `driver_id` (string)
  - [ ] `lat` (float)
  - [ ] `lng` (float)
  - [ ] `trip_id` (string)
  - [ ] `planned_destination` (optional, string)

- [ ] **Update synthetic data generator** to include `driver_id`
  - File: `comparison_features/evify_2.0/evify data 2.0/generate_synthetic_evify.py`
  - Add 5 synthetic drivers with distinct behavioral profiles

- [ ] **Compute rolling behavioral features** in the data loader
  - `driver_avg_current_30m` — mean of last 30 min current per `driver_id`
  - `driver_avg_speed_30m` — mean of last 30 min speed per `driver_id`
  - `driver_regen_ratio_30m` — regen events / total steps in last 30 min
  - `driver_throttle_var_30m` — variance of throttle in last 30 min

- [ ] **Retrain model** with 24 features (20 + 4 behavioral)
  - File: `aicodeold/model_training/v4/train_model_v4.1.py`
  - Update `FEATURES` list
  - Save as `battery_model_v5a.pth`

- [ ] **Update dashboards** to show per-driver range estimate

---

### V5-B — External Environment APIs 🔜 Near-Term

**What changes:** Pull 3 live external data streams using GPS coordinates. Range formula gets 2 more penalty factors.

**Expected MAE:** 0.41% → ~0.20%

#### Task Checklist

- [ ] **Integrate OpenWeatherMap API** for ambient temperature at GPS location
  - Replace `temp_max` (battery sensor, lags by ~12 min) with real ambient temp
  - API: `api.openweathermap.org/data/2.5/weather?lat=&lon=&appid=`

- [ ] **Integrate Google Elevation API** for road slope at GPS location
  - Uphill draws 3× current → major range penalty
  - API: `maps.googleapis.com/maps/api/elevation/json?locations=lat,lng`

- [ ] **Integrate Google Maps Traffic API** for congestion index
  - Stop-start traffic vs. highway → ±15% range impact
  - Use current `speed` from BMS compared to free-flow speed from Maps API
  - `traffic_index = current_speed / free_flow_speed`

- [ ] **Update dynamic range formula:**
  ```
  Range = 85 × SOH_factor × Thermal_factor × Aggression_factor × Elevation_factor × Traffic_factor
  ```

- [ ] **Update dashboard** V5 roadmap section to mark these as ✅ Done

---

### V5-C — Personalized Nudge Engine 🔜 Near-Term

**What changes:** The route intelligence engine from the interview becomes a real-time notification system.

#### Task Checklist

- [ ] **Build route scorer** using real Google Traffic API speeds (replace static TRAFFIC_PROFILES)
  - Port `score_route()` from `interview/route_intelligence.py`
  - Replace hardcoded speeds with live API call

- [ ] **Build departure nudge generator**
  - Port `generate_nudge()` from `interview/route_intelligence.py`
  - Connect to per-driver personal factor (from V5-A behavioral features)
  - Trigger: ignition ON detected via `ignition_on = 1` in telemetry

- [ ] **Build opportunistic charging alert**
  ```
  if speed < 3 km/h for > 5 min AND soc < dynamic_threshold:
    query nearest charger via Google Places API
    send push notification to driver
  ```

- [ ] **Notification delivery options:**
  - Firebase Cloud Messaging (mobile app)
  - WhatsApp Business API (no app needed — just phone number)
  - In-dashboard alert banner (current state — Streamlit)

---

### V5-D — Smart Order Assignment & Wait-Time Charging Intelligence 🔜 Near-Term

**Source:** Evify product discussion, April 23 2026  
**What changes:** Trickee's nudge engine expands from driver-facing alerts to fleet-operator-level order assignment logic. The system decides *which driver gets which order* based on SOC, range, and estimated wait time — and calculates the optimal charging action during every restaurant wait.

---

#### Feature 1 — Intelligent Order Assignment

**Logic:**
```
Given: 2+ drivers available in the same zone
       order has an estimated restaurant wait time

if order.wait_time >= 15 min:
    assign to driver with LOWEST SOC (needs charging most)
    provided: driver.current_range >= delivery_distance * 1.3 (safety buffer)
else:
    assign to driver with HIGHEST efficiency score (fastest delivery)
```

**Why it matters:** Low-SOC drivers benefit most from wait-time charging. Instead of sending them on a quick run that doesn't give charging time, the system holds that order for them — killing two birds — charging AND delivery — simultaneously.

**Task Checklist:**
- [ ] Build `order_assignment_engine.py` — inputs: list of available drivers (SOC, range, location), order (distance, restaurant wait estimate)
- [ ] Score each driver: `assignment_score = (1/soc_pct) * wait_charge_benefit - distance_penalty`
- [ ] Expose as API endpoint: `POST /api/v1/orders/assign`
- [ ] Fleet operator dashboard: show "Trickee Assigned" tag on each order card

---

#### Feature 2 — True Wait Time Model

**Problem:** "Restaurant wait time" is not the same as "charging window". The actual time a driver has to charge = travel time + restaurant prep time, not just the prep time shown on the app.

**Trickee's definition:**
```
Total Wait Window = Travel Time to Restaurant (GPS + Traffic)
                  + Restaurant Prep Time (from order platform)
                  + Handover Buffer (avg 2 min)

Example:
  Order received:        2:00 PM
  Driver departs:        2:00 PM
  Driver arrives:        2:07 PM  (+7 min travel)
  Order ready:           2:17 PM  (+10 min prep)
  Order handed over:     2:19 PM  (+2 min handover)
  Total wait window:     19 min   (7 + 10 + 2)
  Effective charge time: ~17 min  (from arrival to handover)
```

**Task Checklist:**
- [ ] Build `wait_time_estimator.py`:
  - Input: driver current location, restaurant location, estimated prep time
  - Travel time: Google Maps Directions API with `departure_time=now`
  - Output: `{ travel_min, prep_min, buffer_min, total_window_min, chargeable_min }`
- [ ] Feed `chargeable_min` into charging alert engine to decide: "is it worth plugging in?"
  - Threshold: only alert if `chargeable_min >= 10` (below 10 min = not worth the plug/unplug overhead)
- [ ] Show estimated SOC gain on the nudge: "You have ~17 min. Plug in at Honest Restaurant charger (180m). Gain +13% SOC."

---

#### Feature 3 — 3-Option Smart Charging Decision Engine

**Problem:** When should a driver charge — now, at the restaurant, or not at all? Trickee computes all 3 options and picks the best one per ride.

**The 3 options evaluated every time a new order is assigned:**

```
Option A — Charge at destination during wait:
  Route: Driver → Restaurant → [charge during wait] → Customer
  Pros: Zero detour. Charging happens during dead time.
  Con:  Only works if charger exists near restaurant.

Option B — Detour to nearest charger before restaurant:
  Route: Driver → Charger (near driver) → Restaurant → Customer
  Pros: Full control of charge time.
  Con:  Adds distance + time. Only worth it if SOC < 25%.

Option C — No charge. Deliver directly:
  Route: Driver → Restaurant → Customer
  Pros: Fastest delivery time.
  Con:  SOC may drop dangerously low before next charge opportunity.
```

**Decision Rule:**
```python
def choose_charging_option(driver, order, chargers):
    soc = driver.current_soc
    wait_window = estimate_wait_window(driver, order)
    charger_at_dest = nearest_charger(order.restaurant_location, radius=500m)
    charger_near_driver = nearest_charger(driver.location, radius=300m)
    delivery_range_needed = order.total_distance_km * 1.25

    if charger_at_dest and wait_window.chargeable_min >= 10:
        return "OPTION_A"   # best case — no detour, free charging
    elif soc < 25 and charger_near_driver:
        detour_penalty = estimate_time(driver.location, charger_near_driver) * 2
        if detour_penalty < wait_window.total_window_min:
            return "OPTION_B"   # detour is faster than the wait anyway
    return "OPTION_C"  # just deliver — next opportunity will come
```

**Task Checklist:**
- [ ] Build `charging_decision_engine.py` with the 3-option evaluator
- [ ] Integrate Google Places API: find chargers within radius of restaurant + driver
- [ ] Integrate Google Maps Directions: compute detour time for Option B
- [ ] Push result as nudge to driver: "Option A recommended — plug in at Charger Hub 180m from restaurant while you wait"
- [ ] Log the chosen option + outcome (did SOC improve?) for model feedback loop
- [ ] Fleet operator view: show today's charging decisions as a table (Option A/B/C counts)

---

### V6 — Driver Embeddings + Trip Digital Twin 🔜 Medium-Term

**What changes:** Model learns a 16-dimensional "personality vector" per driver. Every completed trip gets a full digital twin reconstruction.

**Expected MAE for seen drivers:** < 0.15%

#### Task Checklist

- [ ] **Add Embedding Layer to LSTM architecture**
  ```
  Input = [20-step physics window] + [driver_id → Embedding(num_drivers, 16)]
  Both branches → Concatenate → Dense layers → delta_soc
  ```
  - Requires: minimum 3 months of data per driver

- [ ] **Build trip digital twin pipeline**
  - For each completed trip: reconstruct SOC vs. lat/long trace
  - Compute: driver behavior fingerprint, energy per route segment, comparison to fleet baseline

- [ ] **Build driver scorecard** for fleet operator dashboard
  - Energy efficiency rank vs. fleet average
  - Regen braking usage rate
  - Cost per km (vs. fleet median)
  - Battery stress events (high current spikes)

- [ ] **RL nudge optimizer** (after nudge layer is live + A/B data exists)
  - Reward = driver behavior improvement after receiving nudge
  - Learns: which message content + timing maximizes positive change

---

## 3. Architecture: How Data Flows in Production

```
Evify Scooter (BMS + GPS/IMEI)
        ↓ every 2–3 seconds
   MQTT Message Broker
        ↓
   Node.js / Python Consumer
        ↓                        ↓
TimescaleDB (history)       Redis (live state)
   ↓                              ↓
AI model retraining          Live dashboard reads
Fleet analytics              AI inference engine reads
Driver scorecard             Nudge engine reads
        ↓
  APIs Called on Demand (per incoming message):
  - OpenWeatherMap → ambient_temp_c
  - Google Elevation → elevation_delta_m
  - Google Traffic → traffic_index
  - Google Places → nearest_charger (when SOC alert triggers)
```

---

## 4. What to Ask Evify Right Now

**The single most important conversation to have:**

> *"We need 5 additional fields added to your telemetry JSON to enable the next phase of the Trickee intelligence layer. All 5 are fields your system already has — we just need them included in the API output. This unlocks per-driver range personalization, opportunistic charging alerts, and trip-level route intelligence."*

| Field | Why It's Needed | When Needed |
|---|---|---|
| `driver_id` | Driver twin, behavioral features, scorecards | V5-A — immediate |
| `lat` | GPS-based charging alerts, elevation API, traffic API | V5-B — immediate |
| `lng` | Same as above | V5-B — immediate |
| `trip_id` | Group telemetry into trips for digital twin | V6 |
| `planned_destination` | Pre-trip route scoring and charging stop prediction | V5-C |

---

## 5. Priority Order (What to Do First)

| Priority | Task | Effort | Impact |
|---|---|---|---|
| 🔴 **1** | Request `driver_id` + `lat/lng` from Evify | 1 conversation | Unblocks V5/V6 |
| 🔴 **2** | Build opportunistic charging alert (ignition + GPS + SOC) | 1 week | High driver value, quick win |
| 🟠 **3** | Add driver behavioral features, retrain V5-A model | 2 weeks | MAE drops to ~0.28% |
| 🟠 **4** | Integrate Google Traffic API for live route scoring | 1 week | Replaces static traffic profiles |
| 🟡 **5** | Build departure nudge pipeline → push notification | 2 weeks | Core product differentiator |
| 🟡 **6** | Integrate OpenWeatherMap + Elevation APIs for V5-B | 1 week | MAE drops to ~0.20% |
| 🟢 **7** | Driver scorecard for fleet operator dashboard | 2 weeks | Fleet operator moat |
| 🟢 **8** | Driver embeddings (V6) | 4+ weeks | < 0.15% MAE for seen drivers |
| 🔵 **9** | RL nudge optimizer | After A/B data | Long-term behavioral coaching |

---

## 6. Quick Reference — Key Files

| File | Role |
|---|---|
| `aicodeold/model_training/v4/train_model_v4.1.py` | Source of truth for feature engineering and model training |
| `aicodeold/model_training/v4/battery_model_v4_1.pth` | Trained model weights |
| `comparison_features/evify_2.0/evify_predictive_dashboard.py` | Live inference dashboard |
| `comparison_features/evify_2.0/evify_dashboard.py` | Fleet overview dashboard |
| `interview/route_intelligence.py` | Route scoring + nudge engine prototype |
| `interview/streamlit_dashboard.py` | Route intelligence dashboard prototype |
| `analysis/competitor_matrix.md` | Full competitor comparison |
| `analysis/trickee_next_stage_analysis.md` | Deep next-stage analysis |

---

*Trickee — Current State & Roadmap | April 2026*
