// User-facing day states are deliberately plain. Soupz's visual identity lives
// in its wordmark, bowls, motion and palette; understanding progress never
// depends on interpreting that visual metaphor.
export function dayProgressLabel(completed, total) {
  if (total === 0) return 'Rest day';
  if (completed === 0) return 'Ready for today';
  if (completed >= total) return 'Day complete';
  return 'In progress';
}
