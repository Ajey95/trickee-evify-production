# Google Startups Submission Scope (Google-Tech-First)

## Flagship Workflow
- **Driver Copilot + Fleet Intelligence** is the single judged workflow.
- Flow: voice transcript -> Gemini intent + grounded tools -> route/charge/coaching actions -> fleet dashboard impact.

## In Scope
- Gemini-first assistant responses.
- Agent orchestration with specialist agents:
  - Route Optimization Agent
  - Charging Decision Agent
  - Driver Coaching Agent
  - Battery Guard Agent
- Voice copilot path on mobile.
- Grounded evidence for every assistant reply from telemetry/trips/wait/fleet data.
- Deterministic fallback behavior when LLM/provider fails.

## Out of Scope (for submission)
- Broad all-feature MVP walkthroughs.
- Non-critical UI expansions unrelated to flagship workflow.

## Success Criteria
- End-to-end voice-to-action demo runs live.
- Failure mode and deterministic fallback are shown.
- Quantified outcomes are reported: ETA quality, wait reduction, charging efficiency.
