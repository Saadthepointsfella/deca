// backend/src/shared/time.ts
export function now(): Date {
  return new Date();
}

export function minutesBetween(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / 1000 / 60;
}
