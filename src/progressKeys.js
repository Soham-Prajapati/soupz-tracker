export function progressKey(planId, taskId) {
  return JSON.stringify([planId, taskId]);
}

export function parseProgressKey(key) {
  try {
    const value = JSON.parse(key);
    return Array.isArray(value) && value.length === 2 && value.every(item => typeof item === 'string')
      ? { planId: value[0], taskId: value[1] }
      : null;
  } catch {
    return null;
  }
}

export function progressValue(map, planId, taskId) {
  const scoped = progressKey(planId, taskId);
  return Object.hasOwn(map || {}, scoped) ? map[scoped] : map?.[taskId];
}
