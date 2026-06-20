# Judge-Ready Demo Script

## Live Scenario
1. Driver asks via voice: battery + destination question.
2. Orchestrator routes to specialist agent.
3. Grounded response is shown with evidence.
4. Fleet dashboard reflects actionable recommendation.

## Failure Scenario
1. Temporarily disable model key/provider.
2. Repeat driver query.
3. Show deterministic fallback response and safety continuity.

## Recovery Scenario
1. Re-enable provider.
2. Repeat query with another context.
3. Show normal Gemini-grounded response recovery.

## Impact Metrics to Read Out
- ETA improvement
- Wait-time reduction
- Charging efficiency gain
- Number of grounded responses vs fallback responses
