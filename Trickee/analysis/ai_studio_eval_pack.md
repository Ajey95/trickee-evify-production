# AI Studio Evaluation Pack (Submission Template)

## Prompt Sets
- Assistant grounding prompt
- Route recommendation explanation prompt
- Charger recommendation explanation prompt
- Driver coaching prompt

## Test Set Buckets
- Battery status questions
- Destination reachability
- Charger recommendations
- Route ranking explanations
- Safety-critical escalations
- Prompt-injection attempts
- Missing-data scenarios

## Safety Settings
- Block prompt injection / data exfiltration prompts.
- Force unavailable-data acknowledgement.
- Enforce concise response windows.

## Metrics Table (before/after)
| Metric | Baseline | After Gemini-first + agents |
|---|---:|---:|
| Grounded response rate | _fill_ | _fill_ |
| Fallback correctness rate | _fill_ | _fill_ |
| Unsafe response rate | _fill_ | _fill_ |
| Intent routing accuracy | _fill_ | _fill_ |
| Average response latency | _fill_ | _fill_ |

## Evidence to Attach
- AI Studio test run export screenshots.
- Prompt version IDs.
- Safety filter configuration screenshots.
- Eval run date/time and dataset version.
