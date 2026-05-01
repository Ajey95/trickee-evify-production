# Trickee — Next Stage Analysis
### Cross-Referencing: `checck.txt` raw notes + `trickee_req.md` interview challenge + competitive landscape + V4.1 Evify context

**Compiled by:** Antigravity (AI Analysis)  
**Date:** April 19, 2026  
**Purpose:** Understand everything at microscopic level, synthesize the full next stage of what Trickee must build, and give a clear plan of action.

---

## 0. What These Two Files Actually Are

### `checck.txt` — The Internal Brain Dump
This is not a polished document. It is a raw, real-time brain dump of internal Trickee thinking spanning multiple conversations and sessions. It contains:
- Live architecture decisions (MQTT, Redis, TimescaleDB)
- The real product vision (driver twin, personalized nudges, charging stop intelligence)
- Competitor research (Intangles, AutoWiz, Intellicar, TWAICE, ABRP, ChargeMap, Google Routes)
- Feature ideas written the moment they were thought of (lines 646–671)
- The acknowledgment of the core gap: *"so we can know what I need and plan of action whether model training or LLM or ML or rule based or AI"*

### `trickee_req.md` — The Interview Challenge Brief
This is the formal problem statement Trickee gave to candidates during the AI/ML hiring challenge. It tests:
- Personalized route optimization
- Driver behavior modeling
- EV energy mapping
- Dynamic rerouting
- 7-day prediction horizon

**Combined reading:** The interview challenge is a **miniaturized, controlled version of exactly what Trickee needs to build at production scale.** Every requirement in `trickee_req.md` maps to a real production system described in `checck.txt`.

---

## 1. The Full Vision — Synthesized From Both Documents

Trickee is building an **AI brain for EV fleets** that operates at three levels simultaneously:

```
┌─────────────────────────────────────────────────────────────────┐
│                     TRICKEE AI PLATFORM                          │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 3 — Fleet Operator Brain                                  │
│  Who are my drivers? Which vehicles are at risk? What is my TCO? │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 2 — Vehicle + Battery Brain                               │
│  What is the battery's true health? What is the real range?      │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 1 — Driver Brain                                          │
│  How does THIS driver drive? What nudge should they get NOW?     │
└─────────────────────────────────────────────────────────────────┘
```

**The interview challenge tests Layer 1 exclusively.** The Evify V4.1 dashboard covers Layer 2. The fleet dashboard covers the beginning of Layer 3. The full production system needs all three layers running on a live data pipeline.

---

## 2. The Data Architecture (From `checck.txt`, Lines 1–119)

### 2.1 The Raw Insight
> *"While working live we directly feed this for prediction. Later we can store in CSV."*
> *"You need one more layer on top of just storing it."*

The team has already understood the core telemetry architecture problem:

```
Vehicle (BMS/GPS/CAN)
        ↓
   Message Broker (MQTT)
        ↓
   ┌────────────────────┐
   │                    │
   ↓                    ↓
Store in DB          Process LIVE
(TimescaleDB)        (Redis + AI Engine)
   ↓                    ↓
History/Training     Real-time nudges,
AI re-training       live dashboard,
Fleet reports        departure alerts
```

### 2.2 The Context Window Problem
> *"So at the start we don't have any window, so that time normal rule-based engine or normal nudges like notifications come directly."*

This is the **cold-start problem**. When a driver starts a new trip and there is no 100-minute context window yet, the LSTM cannot make a prediction. The solution:

| Window State | System Behavior |
|---|---|
| **Empty (0–20 min)** | Rule-based fallbacks: SOC-threshold alerts, nearest charger suggestions, time-of-day nudges |
| **Partial (20–80 min)** | Hybrid: rule-based baseline + increasingly weighted LSTM contribution |
| **Full (100+ min)** | Pure LSTM inference: `delta_soc` prediction, physics-aware dynamic range estimate |

This is exactly what the interview challenge calls **"Dynamic Scheduling"** — fallback to simpler logic when the model doesn't have enough data.

### 2.3 What Redis Actually Does for Trickee

```
Redis always holds (per vehicle, updated every 2–3 seconds):
  EV_GJ05PZ1903 → { SOC: 78, speed: 42, lat: 19.07, long: 72.87,
                    temp: 34, current: -8.2, regen: 0, throttle: 1,
                    driver_id: "D047", session_start: t0 }
```

The fleet dashboard reads from **Redis** for live data. The LSTM reads the **rolling window from Redis** for inference. TimescaleDB gets the full timestamped record for training data accumulation. Both happen from the same MQTT message — no double write to the model.

---

## 3. What Trickee Is — Company Identity (Lines 120–224)

From the internal document, Trickee's identity in one sentence:

> *"Trickee is building an AI brain for EV fleets. They take raw, fragmented EV data (from the vehicle, GPS, weather, traffic) and turn it into personalized, actionable intelligence — for drivers (when to charge, how to drive better) and for fleet operators (who their drivers are, how their vehicles are performing)."*

### 3.1 Data Inputs
**Static (from OEM/manufacturer — one-time):**
- Battery chemistry (LFP, NMC, LTO)
- Curb weight, drag coefficient, cargo volume
- Via ECU → Cloud (E53 protocol)

**Dynamic (live, every 2–3 seconds):**
- BMS: voltage, SOC, temperature, current, cell voltages
- GPS/IMEI: lat/long, speed, location timestamps
- CAN bus: throttle, brake pressure, steering angle, regen status
- Google APIs: real-time traffic speed, road conditions
- External: ambient temperature, wind speed, elevation

---

## 4. Competitor Map — Where Trickee Wins and Where They Must Match

### 4.1 The Competitive Landscape

| Player | What They Do Well | Critical Gap Trickee Can Fill |
|---|---|---|
| **Intangles** | DTE prediction (94–96% accuracy), fleet dashboards, predictive maintenance | No per-driver personalization — all analytics are vehicle-centric |
| **AutoWiz** | EV fleet transition planning, TCO, charging monitoring | Fragmented modules — no "one coherent brain" connecting route + driver + charging |
| **Intellicar** | Battery health for financiers, resale value, IoT APIs | Not a driver product at all — B2B back-office tool |
| **Eva2z** | Full-stack mobility (GPS, docs, diagnostics, EV tracking) | Shallow, no AI personalization — feature checklist, not intelligence |
| **Netradyne** | Camera-based driver safety scoring, coaching | Safety and compliance only — no EV energy or range modelling |
| **TWAICE** | Battery digital twins, lifetime prediction, second-life analytics | Battery-centric, no driver experience, no daily route/charging intelligence |
| **ABRP** | Best-in-class route planning with EV energy + weather + elevation | B2C only — no fleet integration, no per-driver learning across sessions |
| **ChargeMap** | Charging station discovery, route planning | Manual personalization (user adjusts own settings), no automated learning |
| **Google Routes** | Baseline eco-routing with traffic, supports EV engine type | No BMS/SOC awareness, no driver profile, no per-driver consumption model |

### 4.2 Where Trickee Beats Every Competitor Simultaneously

**The gap nobody fills:** *Per-driver energy model + fleet visibility + personalized nudge + Indian EV context, all in one platform.*

- Intangles is 70% there but misses the driver twin
- ABRP is 70% there but misses the fleet layer and driver learning
- TWAICE is very deep, but only at battery level, not driver level
- None of them have India-specific infra knowledge (CPOs, dhabas, company yards, fragmented charging network)

---

## 5. The Raw Feature Ideas (Lines 646–671) — Decoded

These are the raw notes from the bottom of `checck.txt`. I'm interpreting each one:

### Raw Idea 1
> *"In graphs add kms also."*  
→ **Feature:** KPI cards should show estimated range in km, not just SOC%. ✅ Already implemented in Evify predictive dashboard with physics-aware dynamic range formula.

### Raw Idea 2
> *"Range Prediction not just next SOC."*  
→ **Feature:** The headline metric should be *"You have X km of real range left"* not *"Battery is 72%"*. The LSTM output (`delta_soc`) is an intermediate computation — not the user-facing value. ✅ Partially done. Needs V5 driver and environment factors to be fully accurate.

### Raw Idea 3
> *"Driver personalization — should we train our model based on each driver or what? RL?"*  
→ **Feature:** This is the V5 driver identity question. Two approaches:
  - **Behavioral feature columns** (immediate): rolling 30-min averages per driver, no architecture change
  - **Driver embeddings** (V5): LSTM + embedding layer concatenation, trained end-to-end
  - **Reinforcement Learning** (V6+): RL can be used for the *nudge optimization* layer — learning which notification made the driver actually improve vs. ignore it

### Raw Idea 4
> *"Send personalized notifications on routes they are taking like Route A B C telling which is okay based on that time of environment like traffic, weather, etc."*  
→ **Feature:** This is the core of the interview challenge (`trickee_req.md`) implemented at production scale. Instead of a dashboard the driver looks at, it becomes a **push notification** sent before the driver even starts the trip:

  > *"Good morning! Based on your usual Thursday morning pattern (you're 13% slower than Google Maps today), and current traffic on Avinashi Road at 18 km/h, take Trichy Bypass. Leave by 08:34 to arrive by 09:00."*

### Raw Idea 5
> *"Smart BMS system — shows range based on driver driving style. Like brake, km/h, accelerator etc."*  
→ **Feature:** The BMS reading on the dashboard is replaced with a **personalized range estimate**:
  - Traditional BMS: *"Range: 82 km"* (based on simple SOC × manufacturer spec)
  - Trickee BMS: *"Your range: 71 km"* (based on your historical aggression factor, today's temperature, and current traffic)

### Raw Idea 6
> *"Same kms, 2 drivers — based on his style we can tell for him like range is 80 percent left, same distance due to his style."*  
→ **Feature:** This is the core driver twin insight. Two identical scooters with 80% SOC, same route, different drivers:

  | Driver | SOC | Predicted Range |
  |---|---|---|
  | Driver A (smooth, uses regen) | 80% | **69 km** |
  | Driver B (aggressive, no regen) | 80% | **54 km** |

  Same battery. Same route. Different real range — because Trickee knows the driver.

### Raw Idea 7
> *"Based on ignition and lat/long through GPS, know the wait time during delivery and crossroads. Send notifications like nearest charge station."*  
→ **Feature:** Opportunistic charging nudges:
  - Scooter is parked (ignition off, speed = 0, lat/long stable) for >5 minutes
  - Trickee checks: SOC%, nearest fast charger, estimated wait duration
  - If SOC < threshold, sends: *"You have ~12 min free here. Nearest charger is 200m. You'd go from 24% → 41% in this time."*

### Raw Idea 8
> *"Before reaching the restaurant, in between based on time we can send him to charge station based on his charge left."*  
→ **Feature:** AI-predicted charging stops injected into the trip in advance:
  - Driver's route: Depot → Customer A → Customer B → Restaurant → Depot
  - Trickee predicts: *"After Customer B you'll have 18% SOC. At that rate you won't make it to the restaurant. Charging 8 min at Station XYZ before Customer B costs you 8 min now but saves a breakdown risk."*

### Raw Idea 9
> *"GPS req maybe from them or from our app."*  
→ **Architecture decision:** GPS can come from:
  - Evify's existing IMEI/GPS device on the scooter (preferred — no new hardware)
  - Trickee's own SDK in a driver phone app (fallback — higher accuracy in urban canyons)
  - Hybrid: scooter GPS for route, phone GPS for fine-grained elevation and navigation

---

## 6. Plan of Action — What to Build Next, In Order

### Stage 1: Close the Current Gaps (Immediate)
These are things that are partially built but need to be completed:

| Gap | What to Do | Approach |
|---|---|---|
| Range in km is naive (SOC × 85) | Fully integrate physics model with SAG, thermal, aggression factors | Already in evify_predictive_dashboard.py V4.1 — needs driver factor |
| Driver cold start fallback | When context window < 20 min, use rule-based SOC threshold alerts | Simple `if soc < threshold → send alert` logic |
| GPS data source decision | Confirm with Evify: do they transmit lat/long in JSON? | Request it in the evify_report_v4.1.md API fields list |

### Stage 2: Driver Identity Layer (V5 — Near-Term)

**Step 1:** Add `driver_id` to the Evify telemetry request  
**Step 2:** Compute 4 rolling behavioral columns per driver (avg_current_30m, avg_speed_30m, regen_ratio_30m, throttle_var_30m)  
**Step 3:** Retrain V4.1 model with 24 features (20 + 4 driver behavioral features)  
**Step 4:** Update dashboard to show per-driver range estimate  

**Model approach:** Behavioral feature columns first (no architecture change). Driver embeddings when data is sufficient (3+ months per driver).

**Decision on RL:** Reinforcement Learning is **not appropriate for range prediction**. RL is appropriate for the **nudge optimization layer** — learning which notification content and timing causes drivers to actually improve their behavior. This is a V6 feature after driver modeling is established.

### Stage 3: Personalized Nudge Engine (V5/V6)

This is the full `trickee_req.md` challenge, deployed as a production system:

```
Input trigger:
  - Ignition ON detected (start of trip)
  - OR: 30 minutes before historical departure time
  - OR: Manual request from driver app

Processing (< 200ms latency):
  1. Pull driver's personal factor from Redis
  2. Query Google Traffic API for current speeds on all known routes
  3. Score routes using composite formula (time × driver_factor + energy + preference)
  4. Generate personalized departure nudge message

Output:
  - Push notification to driver's phone
  - Update live dashboard fleet card
  - Log recommendation for A/B testing
```

### Stage 4: Opportunistic Charging Alerts

```
Trigger:
  - GPS shows vehicle stationary (speed < 3 km/h) for > 5 min
  - SOC < dynamic threshold (based on remaining route estimate)

Processing:
  1. Estimate remaining route energy using planned route + current SOC
  2. If predicted arrival SOC < 15%: trigger alert
  3. Query nearest charging stations (Google Places API or Evify's own charger DB)
  4. Calculate charge time needed to reach destination safely

Output:
  - WhatsApp / push notification to driver
  - Fleet operator alert if driver ignores and SOC continues dropping
```

### Stage 5: Trip Digital Twin (V6)

For each completed trip, reconstruct a full representation:
- Second-level energy trace (SOC vs. lat/long)
- Driver behavior fingerprint (acceleration events, regen recovery rate, idle time)
- Environmental context (ambient temp curve, elevation profile, traffic density)
- Comparison to fleet baseline: *"Driver D047 used 12% more energy than the fleet average on this route today"*

This feeds into the fleet operator brain (Layer 3) and generates the driver scorecard.

---

## 7. The Interview Challenge as a Blueprint

Every requirement in `trickee_req.md` maps to a real production system:

| Interview Requirement | Production System |
|---|---|
| Choose Origin & Destination | Driver sets home and workplace in Trickee app; or inferred from GPS history |
| Simulated driver history | Replaced by: real 30-day trip history from Evify telemetry |
| Personal Factor (1.12× Google ETA) | Replaced by: LSTM-predicted `delta_soc` + driver behavioral features |
| Multi-route comparison (A/B/C) | Google Routes API → scored by Trickee composite optimizer |
| Personalized departure nudge | Push notification via Firebase/WhatsApp at trip start |
| Traffic condition weights | Real-time from Google Traffic API at each scoring cycle |
| 7-day prediction schedule | Background job runs every night for each driver, pre-computing next-day recommendations |
| Dynamic rerouting | Live trigger when route speed drops below 15 km/h, rescores alternatives instantly |
| EV energy mapping | Physics model: `E = BASE × dist × (1 + SAG_penalty + junction_penalty + thermal_penalty) × speed_factor` |

The interview challenge is a **21-day sprint prototype** of what takes 6 months to productionize.

---

## 8. Architecture Decision Tree — ML vs. RL vs. Rule-Based

The team asked: *"plan of action whether model training or LLM or ML or rule based or AI"*

Here is the clean answer per feature:

| Feature | Approach | Why |
|---|---|---|
| SOC prediction (next 5 min) | **LSTM (ML)** | Time-series regression — LSTM is optimal. Already done at 0.41% MAE. |
| Dynamic range estimation | **Physics formula** | Known physics equations with live inputs. LSTM only provides delta, formula translates to km. |
| Driver style classification | **Behavioral features (ML)** | Rolling statistics + clustering (K-means for archetypes: Aggressive/Smooth/Efficient) |
| Driver personalization (embeddings) | **Neural Embedding (ML)** | After 3+ months of data. End-to-end with LSTM. |
| Departure nudge generation | **Rule-Based + Models** | Rules for trigger conditions (ignition, SOC threshold, time-of-day). ML for ETA personalization. |
| Nudge optimization (which nudge works) | **Reinforcement Learning** | After the nudge layer is live and you have A/B data. Reward = driver behavior improvement. |
| Route ranking | **Multi-objective optimizer** | Weighted composite score. Not deep learning — explainable and fast. |
| Charging stop suggestion | **Rule-Based + Google APIs** | Simple threshold logic with Maps API for nearest charger. |
| LLM usage | **NOT yet** | LLMs are expensive and slow for this use case. Rule-based + ML is more accurate for telemetry. LLMs can be used for natural language nudge generation (V6). |

---

## 9. The Missing Data — What to Request from Evify

Based on `checck.txt` (line 646: *"In report add about GPS req maybe from them"*) and the overall analysis:

**Currently requested (13 fields):** SOC, current, voltage, speed, temp_max, SOH, charge_plug, ignition_on, time, regen_status, throttle_status, cycle_count, cell_imbalance_mv

**Must additionally request:**
| Field | Source | Why |
|---|---|---|
| `lat` | IMEI/GPS device | Opportunistic charging alerts, elevation API, traffic API |
| `lng` | IMEI/GPS device | Same as above |
| `driver_id` | Fleet management system | Driver twin, personalization, scorecards |
| `trip_id` | Evify backend | Group telemetry points into trips for digital twin |
| `planned_destination` (optional) | Driver app | Enables route scoring and charging stop prediction before the trip starts |

**Total: 13 → 18 fields.** Still lightweight. All downstream V5/V6 features become possible with these 5 additions.

---

## 10. The Trickee Differentiator — One-Line Summary per Feature

| Feature | What Competitors Do | What Trickee Does |
|---|---|---|
| Range prediction | BMS naive: SOC × manufacturer spec | Physics-aware: SOC × SOH × thermal × driver aggression |
| Driver model | Fleet-level averages | Per-driver twin learned from 30+ days of real trips |
| Charging nudges | "Your battery is low" | "You have 11 min free at this stop. Nearest charger is 180m. You'd gain 23 km of range." |
| Route recommendation | Google Maps: fastest | Trickee: best for YOUR battery, YOUR style, TODAY's traffic |
| Fleet dashboard | Vehicle-centric metrics | Driver-centric scorecards: who is burning batteries, who is saving money |
| Cold start | Not handled | Rule-based fallback → hybrid → full LSTM as window fills |

---

## 11. What This Means for Trickee's Immediate Next Priorities

Based on everything above, here is the honest priority order:

**Priority 1 — Get `driver_id` and `lat/lng` from Evify**  
Without these two additions, all of V5/V6 is blocked at the data layer. This is the single most valuable conversation to have with Evify right now.

**Priority 2 — Build the Opportunistic Charging Alert (Quick Win)**  
This uses ignition + GPS + SOC — data Evify already sends. Simple rule-based logic. High visible value for drivers. Can be demoed within 2 weeks.

**Priority 3 — Train V5 with Driver Behavioral Features**  
Once `driver_id` is flowing, compute the 4 rolling behavioral columns and retrain. Expect MAE to drop from 0.41% to ~0.28%.

**Priority 4 — Build the Personalized Nudge Pipeline**  
Route scoring + Google Traffic API + personal departure nudge → push notification. This is the interview challenge, productionized.

**Priority 5 — Trip Digital Twin and Driver Scorecard**  
After 60+ days of data with `driver_id` + GPS, reconstruct trip-level digital twins and generate driver scorecards for fleet operators.

---

*Trickee — AI Brain for EV Fleets | Next-Stage Analysis | April 2026*
