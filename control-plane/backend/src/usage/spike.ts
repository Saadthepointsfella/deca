// backend/src/usage/spike.ts
type HourPoint = { bucket: string; units: number }; // bucket 'YYYY-MM-DD HH'
function p95(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.floor(0.95 * (sorted.length - 1));
  return sorted[idx];
}

export function computeSpikeScore(currentHourUnits: number, history: HourPoint[]): number {
  const histUnits = history.map(h => Number(h.units || 0)).filter(n => n >= 0);
  const denom = Math.max(1, Math.floor(p95(histUnits)));
  return currentHourUnits / denom; // >= 0
}
