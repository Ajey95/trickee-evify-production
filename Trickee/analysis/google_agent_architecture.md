# Google-Tech-First Architecture

## Core Positioning
- Gemini is the primary model interface for AI composition.
- FastAPI and Next.js are runtime/execution layers for grounded tools and UX.

## Agent Topology
- **Driver Copilot Orchestrator**
  - Classifies driver intent.
  - Dispatches to specialist agent.
  - Returns grounded evidence and fallback-safe response.

- **Specialist Agents**
  - Route Optimization Agent -> route scoring and ranked options.
  - Charging Decision Agent -> nearest charger ranking and recommendation narrative.
  - Driver Coaching Agent -> behavior summary and coaching narrative.
  - Battery Guard Agent -> battery/risk interpretation.

## Grounding Inputs
- Telemetry
- Prediction history
- Trip history
- Wait events
- Fleet live status

## Reliability Controls
- Prompt-injection detection on assistant input.
- Strict tool-grounded response policy.
- Deterministic fallback text when Gemini/provider fails.

## Voice Flow
1. Driver speaks transcript.
2. Mobile voice copilot endpoint resolves destination hints.
3. Transcript is routed through orchestrator + specialist agent.
4. Grounded response returned with evidence.
