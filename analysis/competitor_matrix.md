# Trickee — Competitive Analysis Matrix
**Last Updated:** April 2026  
**Source:** Internal research from `checck.txt` + public competitor documentation

---

## Quick Legend

| Symbol | Meaning |
|---|---|
| ✅ | Strong — clearly addressed in their product |
| ⚠️ | Partial — exists but shallow or requires manual effort |
| ❌ | Not present / not their focus |
| 🎯 | Trickee's primary differentiator in this dimension |

---

## Full Comparison Matrix

| Capability | **Trickee** | Intangles | AutoWiz | Intellicar | Eva2z | Netradyne | TWAICE | ABRP | ChargeMap | Google Routes |
|---|---|---|---|---|---|---|---|---|---|---|
| **Real-time SOC / DTE prediction** | ✅ 🎯 | ✅ (94–96% acc) | ✅ | ✅ | ⚠️ | ❌ | ❌ | ✅ | ⚠️ | ⚠️ |
| **Per-driver personalization** | ✅ 🎯 | ❌ | ❌ | ❌ | ❌ | ⚠️ (safety only) | ❌ | ⚠️ (manual calib) | ⚠️ (manual) | ❌ |
| **Driver behavior scoring** | ✅ 🎯 | ✅ | ✅ | ⚠️ | ⚠️ | ✅ (camera AI) | ❌ | ❌ | ❌ | ❌ |
| **Physics-aware energy model** | ✅ 🎯 | ✅ (multi-param) | ⚠️ | ❌ | ❌ | ❌ | ✅ (cell level) | ✅ | ⚠️ | ⚠️ (eco-route) |
| **Battery health / SOH** | ✅ | ✅ | ✅ | ✅ | ⚠️ | ❌ | ✅ 🏆 (deepest) | ❌ | ❌ | ❌ |
| **Multi-route comparison + ranking** | ✅ 🎯 | ⚠️ | ⚠️ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Personalized departure nudge** | ✅ 🎯 | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ⚠️ | ❌ | ❌ |
| **Dynamic rerouting (live jam)** | ✅ 🎯 | ⚠️ | ⚠️ | ❌ | ❌ | ❌ | ❌ | ✅ | ⚠️ | ✅ |
| **Opportunistic charging alerts** | ✅ 🎯 | ⚠️ | ⚠️ | ❌ | ❌ | ❌ | ❌ | ✅ (route-based) | ✅ | ⚠️ |
| **Fleet operator dashboard** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (OEM/asset) | ❌ | ❌ | ❌ |
| **India-specific EV infra context** | ✅ 🎯 | ✅ | ✅ | ✅ | ✅ | ⚠️ | ❌ | ❌ | ❌ | ⚠️ |
| **Driver-facing gamification / UX** | ✅ 🎯 | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ⚠️ | ⚠️ | ❌ |
| **GPS + elevation + traffic fusion** | ✅ 🎯 | ✅ | ⚠️ | ⚠️ | ⚠️ | ❌ | ❌ | ✅ | ⚠️ | ✅ |
| **Cold-start fallback (no history)** | ✅ 🎯 | ⚠️ | ⚠️ | ❌ | ❌ | ❌ | ❌ | ⚠️ | ❌ | ❌ |
| **Trip digital twin** | 🔜 V6 | ⚠️ | ❌ | ❌ | ❌ | ❌ | ✅ (battery level) | ❌ | ❌ | ❌ |
| **Driver embeddings / AI twin** | 🔜 V5 | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Open API / integrates with others** | 🔜 | ✅ | ✅ | ✅ | ⚠️ | ✅ | ✅ | ⚠️ | ⚠️ | ✅ |

---

## Scoring Summary (out of 17 capabilities)

| Player | ✅ Strong | ⚠️ Partial | ❌ Missing | **Score** |
|---|---|---|---|---|
| **Trickee (V4.1 + V5 planned)** | 13 | 2 | 2 | **🥇 13/17** |
| Intangles | 8 | 5 | 4 | 8/17 |
| AutoWiz | 6 | 6 | 5 | 6/17 |
| ABRP | 7 | 5 | 5 | 7/17 |
| TWAICE | 5 | 1 | 11 | 5/17 |
| Google Routes | 4 | 5 | 8 | 4/17 |
| Intellicar | 4 | 4 | 9 | 4/17 |
| Netradyne | 3 | 2 | 12 | 3/17 |
| Eva2z | 3 | 5 | 9 | 3/17 |
| ChargeMap | 3 | 4 | 10 | 3/17 |

> **Note:** Trickee's score includes V5/V6 planned features. Current V4.1 state scores 10/17.

---

## Where Trickee Is Uniquely Positioned (No Competitor Even Tries)

1. **Per-driver personalization at fleet scale** — every other fleet player is vehicle-centric or fleet-average-centric. Trickee is the only one building a per-driver usage model that persists across sessions and feeds everything from ETA to charging suggestions.

2. **Departure nudge calibrated to driver history** — ABRP does ETA, Google does directions, but nobody tells you *"Leave at 08:34 specifically because YOU take 13% longer than Google Maps on Thursday mornings."*

3. **Driver-facing money + range metrics in B2B context** — fleet tools show fleet KPIs. Consumer apps show routes. Nobody shows a delivery driver *"Your driving style cost you 8 km of range today vs. your team average. Here's what changed."*

4. **Cold-start fallback architecture** — no competitor explicitly designs for the cold-start problem (first 20 min of a trip, no history yet). Trickee's hybrid rule-based + ML approach handles this gracefully.

---

## Where Trickee Must Close the Gap (Catch-Up Required)

| Gap vs. Competitor | Who to Learn From | Priority |
|---|---|---|
| DTE accuracy (Intangles claims 94–96%) | Intangles (multi-parametric forecasting) | High — must match before differentiating |
| Route charging stop planning | ABRP (best-in-class trip planning) | Medium — use Google Routes as baseline, layer Trickee on top |
| Battery digital twin depth | TWAICE (cell-level physics) | Low — not Trickee's primary moat; partner or use simplified model |
| API ecosystem / integrations | Intangles, AutoWiz, Google | Medium — needed for fleet SaaS sales |

---

## Strategic Positioning Statement

> Trickee is not competing with any single player. It is the **intelligence fusion layer** that sits above telematics hardware (AutoWiz/Intellicar hardware feeds), alongside battery analytics (TWAICE for depth), and on top of routing primitives (Google Routes for pathfinding) — combining all three into a **personalized, driver-aware, fleet-accountable AI brain** that none of them individually offer.

---

*Trickee Competitor Matrix | April 2026*
