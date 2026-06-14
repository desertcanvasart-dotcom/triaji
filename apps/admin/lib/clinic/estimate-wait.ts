export function estimateWaitMinutes(
  positionInQueue: number,
  minutesPerPatient: number,
  currentPatientStartedAt?: Date | null
): number {
  const currentElapsed = currentPatientStartedAt
    ? Math.floor((Date.now() - currentPatientStartedAt.getTime()) / 60000)
    : 0;
  const remainingForCurrent = Math.max(0, minutesPerPatient - currentElapsed);
  return remainingForCurrent + (positionInQueue * minutesPerPatient);
}
