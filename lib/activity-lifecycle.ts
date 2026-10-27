export const ACTIVITY_END_DELAY_MS = 5 * 60_000;

export function activityEndAt(fullyReportedAt: Date | null) {
  return fullyReportedAt
    ? new Date(fullyReportedAt.getTime() + ACTIVITY_END_DELAY_MS)
    : null;
}

export function activityEndRetryAt(lastAttempt: Date | null, attempts: number) {
  if (!lastAttempt) return null;
  const delay = Math.min(
    15 * 60_000,
    60_000 * 2 ** Math.min(Math.max(0, attempts - 1), 4),
  );
  return new Date(lastAttempt.getTime() + delay);
}
