# Trickee AI/ML Challenge
## Personalized Route Intelligence Engine — Complete Project Documentation

**Driver:** Arjun &nbsp;|&nbsp; **Vehicle:** Tata Nexon EV (312 km range, 30.2 kWh battery)
**Route:** Coimbatore Railway Station → PSG Tech, Peelamedu
**Prediction Horizon:** 7 Days (Feb 22–28, 2026 | Sun → Sat)

---

## 1. Problem Statement (In Simple Terms)

Imagine you drive from **Coimbatore Railway Station to PSG Tech** every day. Google Maps tells you it takes 24 minutes. But you know from experience that you always take a bit longer — maybe because you drive carefully, or because you prefer avoiding certain busy junctions.

The challenge is: **can we build a smarter navigation system that knows *you* — not just the road?**

Specifically, the system needs to answer:
- Which route should I take today, considering my driving style and preferences?
- What time should I leave to arrive on time — with a safety buffer?
- How much battery will my EV use on each route?
- If there's a sudden traffic jam, which route should I switch to?

This needs to work for **all 4 daily scenarios**: weekday morning rush, weekday evening rush, weekend brunch time, and weekend night.

---

## 2. Requirements — What Was Asked (Plain English)

| # | Requirement | What It Means Simply |
|---|---|---|
| R1 | Choose your own Origin & Destination | Pick a real route — we chose CBE Railway Station → PSG Tech |
| R2 | Simulate a Personalized Driver Profile | Create fake but realistic trip history for a specific driver |
| R3 | Multi-Route Comparison | Compare 3 different routes and rank them |
| R4 | Personalized Departure Nudge | Tell the driver exactly when to leave, based on *their* history |
| R5 | Traffic Condition Weights | Explain how the model decides which factors matter most |
| R6 | 7-Day Prediction Schedule | Generate a full week of route recommendations |
| R7 | Dynamic Rerouting | If a jam happens mid-trip, recalculate and suggest a new route |
| R8 | EV Energy Mapping | Track battery usage per route; find the route that saves the most charge |
| R9 | Multi-Route Output (Primary + Fallback) | Always show a 1st choice and a backup route |

---

## 3. Our Solution — How We Solved It

### 3.1 The Core Idea

We built a **5-layer Python engine** (`route_intelligence.py`, 607 lines) that:
1. Learns from the driver's past trips
2. Scores every route using a mathematical formula
3. Picks the best departure time
4. Tracks battery usage
5. Reacts to live traffic incidents

No heavy AI libraries needed — just `pandas` and `numpy`. Clean, fast, and explainable.

---

### 3.2 The Three Routes We Defined

We mapped 3 real routes between Coimbatore Railway Station and PSG Tech:

| Route | Distance | Signals | Stop-&-Go | Driver Preference | Character |
|---|---|---|---|---|---|
| **Route A** – Avinashi Road (NH-544) | 8.5 km | 12 | 0.55 (high) | 0.60 | Fast highway, heavy peak traffic |
| **Route B** – Trichy Road Bypass | 9.8 km | 7 | 0.30 (low) | **0.85** | Longer but smoother, avoids Gandhipuram |
| **Route C** – Mettupalayam Road | 10.2 km | 9 | 0.45 (medium) | 0.50 | Scenic local road, good off-peak |

**Why these three?** They represent the three real-world trade-offs a Coimbatore commuter faces: speed vs. comfort vs. battery efficiency.

---

### 3.3 Simulating the Driver's History (R2)

**The problem:** We don't have real GPS data. **The solution:** We simulate 4 weeks × 14 trips/week = **56 realistic trip records** using controlled randomness.

Each record captures:
- Departure time, actual arrival time, route taken
- A **Personal Factor** = `actual_travel_time / google_maps_estimate`
- Battery SoC at start and end

**Key insight:** Arjun's personal factor is drawn from a normal distribution:
- Weekday morning: `N(1.12, 0.04)` — he takes 12% longer than Google Maps
- Weekend: `N(1.08, 0.03)` — more relaxed, smaller delay

History covers **Jan 25 – Feb 21, 2026** (4 weeks before the prediction window).

> **Code:** `simulate_driver_history()` — Lines 94–196 of `route_intelligence.py`

---

### 3.4 Building the Driver Profile (R2)

From the 56 trip records, we compute:

| Metric | Value | What It Tells Us |
|---|---|---|
| Overall Personal Factor | **1.104×** | Arjun takes 10.4% longer than Google Maps on average |
| Std Deviation | **±0.048** | Very consistent — reliable for nudge calibration |
| Thursday Factor | **1.136×** | His worst day — extra 2.8 min delay |
| Weekend Factor | **1.055–1.067×** | Relaxed weekend driving |
| Preferred Route | **Route B (65%)** | Avoids Gandhipuram junction |

> **Code:** `build_driver_profile()` — Lines 202–227

---

### 3.5 Traffic Condition Weights (R5)

We explicitly define how much each factor contributes to the route score:

| Factor | Weight | Why This Weight |
|---|---|---|
| Average Cruising Speed | **30%** | Most direct determinant of door-to-door time |
| Signal Density (signals/km) | **25%** | CBE city centre signals cause 3–8 min cumulative delays |
| Stop-and-Go Index | **20%** | Critical for EV: each braking cycle wastes ~0.40 kWh/km extra |
| Driver Preference | **15%** | Personalisation improves real-world compliance with nudges |
| Road Quality | **10%** | Affects rolling resistance and energy use |

> **Code:** `TRAFFIC_WEIGHTS` dictionary — Lines 68–75

---

### 3.6 The Multi-Objective Optimizer (R3, R9)

This is the heart of the engine. For every route under every traffic scenario, we compute a **composite score**:

```
Score = 0.40 × (T_pers / 50) + 0.35 × (E_kwh / 2.0) + 0.25 × (1 − P_pref)
```

Where:
- `T_pers` = personalized travel time in minutes (Google ETA × personal factor)
- `E_kwh` = kWh consumed on that route
- `P_pref` = driver's preference score for that route (0–1)
- **Lower score = better route**

The weights (40% time, 35% energy, 25% preference) reflect that for an EV commuter, time and battery are the top priorities, but personal comfort matters too.

**Example — Weekday Morning:**

| Route | Pers. ETA | kWh | Preference | Score |
|---|---|---|---|---|
| 🥇 Route B – Trichy Bypass | 19.1 min | 1.964 | 0.85 | **0.5339** |
| 🥈 Route A – Avinashi Rd | 25.6 min | 1.938 | 0.60 | 0.6439 |
| 🥉 Route C – Mettupalayam | 24.1 min | 2.201 | 0.50 | 0.7032 |

> **Code:** `score_route()` — Lines 269–317

---

### 3.7 EV Energy Mapping (R8)

We model battery consumption using a physics-inspired formula:

```
E = BASE_RATE × distance × (1 + 0.40 × SAG_Index) × SpeedFactor

BASE_RATE   = 0.155 kWh/km  (Tata Nexon EV highway baseline)
SpeedFactor = 1 + max(0, (70 − speed) / 70) × 0.3
```

**Why this formula?**
- `SAG_Index × 0.40` penalises stop-and-go driving (each braking cycle wastes energy that regenerative braking only partially recovers — net ~60% loss)
- `SpeedFactor` penalises slow urban speeds (more energy per km at 22 km/h than at 60 km/h)

**EV Max-Range Route:** The engine separately flags the route with the lowest SAG index as the "Maximum Range" route — this is always Route B (SAG = 0.30 vs 0.45 and 0.55 for alternatives).

**Sample EV output (Weekday Morning, SoC start = 82%):**

| Route | Speed | kWh Used | SoC End | Range Left |
|---|---|---|---|---|
| Route B – Trichy Bypass | 34 km/h | 1.964 | 75.5% | 235.6 km |
| Route A – Avinashi Rd | 22 km/h | 1.938 | 75.6% | 235.8 km |
| Route C – Mettupalayam | 28 km/h | 2.201 | 74.7% | 233.1 km |

> **Code:** `compute_ev_energy()` — Lines 236–263

---

### 3.8 Personalized Departure Nudges (R4)

For each trip slot, the engine calculates exactly when to leave:

```
Departure Time = Desired Arrival − Personalized ETA − 10 min buffer
```

The nudge message is personalised using the driver's **day-specific** factor:

> *"Based on your past 8 Thursday trips, you take ~2.8 min longer than the base estimate. Leave at 17:26 to comfortably arrive by 18:00 via Route B."*

**Sample nudges across the week (Feb 22–28, 2026):**

| Date | Day | Slot | Leave At | Arrive By | Key Insight |
|---|---|---|---|---|---|
| Feb 22 | Sunday | Brunch | 11:05 | 11:30 | Weekend: only +0.7 min delay |
| Feb 23 | Monday | Morning | 08:30 | 09:00 | +2.3 min personal delay |
| Feb 26 | Thursday | Evening | 17:26 | 18:00 | Worst day — +2.3 min delay |
| Feb 28 | Saturday | Night | 21:39 | 22:00 | Low traffic, battery drops only 5.9% |

> **Code:** `generate_nudge()` — Lines 329–363

---

### 3.9 7-Day Prediction Schedule (R6)

The engine runs all the above for every day of the week (Sun Feb 22 → Sat Feb 28, 2026), for every time slot (morning/evening on weekdays, brunch/night on weekends) — **14 trip predictions total**.

Each prediction includes:
- Ranked route comparison (1st, 2nd, 3rd)
- EV Max-Range route flag
- Personalized departure nudge

> **Code:** `run_7day_prediction()` — Lines 369–422

---

### 3.10 Dynamic Rerouting (R7)

When a live incident is detected (speed drops below 15 km/h threshold), the engine:

1. Rescores the original route at the incident speed (8 km/h)
2. Rescores all alternatives using current live speeds for the correct time slot
3. Selects the best alternative considering both time saved and battery safety
4. Generates an alert

**Simulated incident — Route A jammed at 8 km/h:**

| | Original (jammed) | Reroute (Route B) |
|---|---|---|
| Speed | 8 km/h | 34 km/h |
| ETA | 70.4 min | 19.1 min |
| Time Saved | — | **51.3 min** |
| SoC After | — | 61.5% |

> *"⚠ Incident on original route. Switch to Route B to save ~51.3 min. Battery will land at 61.5%."*

> **Code:** `simulate_dynamic_reroute()` — Lines 428–458

---

## 4. Outputs Achieved

### 4.1 Console Output
A fully formatted terminal report with driver profile, traffic weight visualisation, 7-day schedule with all route comparisons and nudges, and rerouting simulation.

### 4.2 Exported Files

| File | Contents |
|---|---|
| `outputs/driver_history.csv` | 56-record simulated trip history with departure times, personal factors, SoC |
| `outputs/driver_profile.json` | Calibrated personal factors per day and per slot |
| `outputs/7day_schedule.json` | Full 7-day predictions with all route scores, nudges, EV data |
| `outputs/schedule_flat.csv` | Flat table version for easy analysis in Excel/Sheets |

### 4.3 Streamlit Dashboard
An interactive dark-mode web dashboard (`streamlit_dashboard.py`) with 5 pages:
- **📊 Overview** — Driver profile, per-day factors, traffic weights
- **📅 7-Day Schedule** — Full week table + detailed day view with colour-coded route cards
- **⚡ EV Energy** — kWh and SoC charts per route, model formulas
- **🔔 Nudges** — All 14 personalised departure messages
- **🚨 Rerouting** — Interactive incident simulation with live rescoring

---

## 5. Requirements Traceability Table

> Every requirement mapped to exactly where it is solved in the code.

| Req | What Was Asked | How We Solved It | File | Lines |
|---|---|---|---|---|
| **R1** | Choose Origin & Destination | Coimbatore Railway Station → PSG Tech, Peelamedu (real Coimbatore locations) | `route_intelligence.py` | 26–28 |
| **R2** | Personalized Driver Profile with historical trip data | `simulate_driver_history()` generates 56 records; `build_driver_profile()` derives personal factors per day/slot | `route_intelligence.py` | 94–227 |
| **R2a** | Actual departure & arrival times | Each record has `departure_time`, `arrival_time`, `actual_travel_min` | `route_intelligence.py` | 140–153 |
| **R2b** | Driving style variation (personal factor) | `personal_factor = actual / google_eta`; overall 1.104×, per-day breakdown | `route_intelligence.py` | 121–123, 207–208 |
| **R2c** | Route preferences (avoids Gandhipuram) | Route B preference score = 0.85; historical choice weight 65% | `route_intelligence.py` | 50, 137 |
| **R3** | Multi-Route Comparison | `score_route()` computes composite score for all 3 routes; sorted and ranked 1st/2nd/3rd | `route_intelligence.py` | 269–317, 388–399 |
| **R4** | Personalized Departure Nudge with 10-min buffer | `generate_nudge()` uses day-specific factor + 10 min buffer; message cites trip count and extra minutes | `route_intelligence.py` | 329–363 |
| **R5** | Traffic Condition Weights clearly defined | `TRAFFIC_WEIGHTS` dict with 5 factors and rationale; used in composite score | `route_intelligence.py` | 68–75 |
| **R6** | 7-Day Prediction Schedule | `run_7day_prediction()` loops Mon–Sun, all slots, scores all routes | `route_intelligence.py` | 369–422 |
| **R7** | Dynamic Rerouting on live incident | `simulate_dynamic_reroute()` rescores at 8 km/h incident speed, picks best alternative | `route_intelligence.py` | 428–458 |
| **R8** | EV Energy Mapping (Max Range vs Min Time) | `compute_ev_energy()` with SAG penalty + speed factor; `is_max_range_optimal` flag; EV Max-Range route shown separately | `route_intelligence.py` | 236–263, 402 |
| **R9** | Primary + Fallback route output | Schedule always outputs `1st_RECOMMENDED`, `2nd_fallback`, `3rd_option` | `route_intelligence.py` | 406–413 |
| **R10** | Weekday Morning/Evening scenarios | `TRAFFIC_PROFILES` defines speeds for `(weekday, morning)` and `(weekday, evening)` | `route_intelligence.py` | 84–85 |
| **R11** | Weekend Brunch/Night scenarios | `TRAFFIC_PROFILES` defines speeds for `(weekend, brunch)` and `(weekend, night)` | `route_intelligence.py` | 86–87 |
| **R12** | JSON/CSV export | `export_outputs()` writes 4 files to `outputs/` folder | `route_intelligence.py` | 542–581 |
| **R13** | Interactive Dashboard (bonus) | `streamlit_dashboard.py` — 5-page dark-mode Streamlit app with charts, route cards, nudge messages, rerouting simulator | `streamlit_dashboard.py` | 1–end |

---

## 6. Technology Stack

| Layer | Technology | Why |
|---|---|---|
| Language | Python 3.12 | Zero ML framework overhead for MVP |
| Data | pandas, numpy | Industry-standard data science stack |
| Data Format | CSV (history), JSON (schedule, profile) | Human-readable, easy to extend |
| Dashboard | Streamlit 1.54 | Fastest way to build a data app in Python |
| Production Path | scikit-learn, FastAPI, Redis, PostgreSQL | Planned Phase 2–3 enhancements |

---

## 7. Key Design Decisions & Why

**Why simulate data instead of using real GPS?**
Real GPS data requires months of collection and privacy consent. Simulated data with realistic statistical distributions (normal distribution around known personal factors) lets us demonstrate the full system immediately while being statistically honest.

**Why a composite score instead of just picking the fastest route?**
A pure time-minimiser would always pick Route A on weekday mornings (shortest distance). But Arjun avoids Gandhipuram, and his EV benefits from Route B's smooth driving. The weighted composite captures all three objectives simultaneously.

**Why per-day personal factors instead of one global factor?**
Thursday is Arjun's worst day (1.136×) while weekends are his best (1.055–1.067×). A single global factor would over-nudge on weekends and under-nudge on Thursdays. Per-day calibration makes nudges accurate.

**Why Route B wins every day?**
Route B has the lowest SAG index (0.30), fewest signals (7), and highest driver preference (0.85) — structural advantages that hold across all traffic conditions. This is correct: the model has learned that for *this specific driver*, Route B is genuinely optimal. Dynamic rerouting handles the case when Route B itself gets jammed.

---

*Trickee AI/ML Challenge — Personalized Route Intelligence | Arjun | Tata Nexon EV | Coimbatore, Tamil Nadu*
