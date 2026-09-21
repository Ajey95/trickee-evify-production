function canonicalRequestValue(value) {
  if (Array.isArray(value)) return value.map((item) => canonicalRequestValue(item));
  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((result, key) => {
        const item = value[key];
        if (item !== undefined && typeof item !== "function" && typeof item !== "symbol") {
          result[key] = canonicalRequestValue(item);
        }
        return result;
      }, {});
  }
  return value;
}

function requestKey(stepId, payload) {
  return JSON.stringify([stepId, canonicalRequestValue(payload)]);
}

function failedResult(error) {
  return {
    success: false,
    data: null,
    error: error instanceof Error ? error.message : "Decision request failed.",
  };
}

export function createDecisionRunCache() {
  return new Map();
}

export async function runCachedDecisionSteps(cache, steps) {
  const entries = await Promise.all(steps.map(async (step) => {
    const key = requestKey(step.id, step.payload);
    const cachedResult = cache.get(key);
    if (cachedResult) return [step.id, { result: cachedResult, cached: true }];

    let result;
    try {
      result = await step.run();
    } catch (error) {
      result = failedResult(error);
    }
    if (result?.success) cache.set(key, result);
    return [step.id, { result, cached: false }];
  }));

  return Object.fromEntries(entries);
}
