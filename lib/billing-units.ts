const MINUTES_PER_HOUR = 60;
const MINUTES_PER_SLOT = 30;

function trimTrailingZero(value: string) {
  return value.endsWith('.0') ? value.slice(0, -2) : value;
}

export function creditsToMinutes(credits: number) {
  return credits * MINUTES_PER_HOUR;
}

export function minutesToCredits(minutes: number) {
  return minutes / MINUTES_PER_HOUR;
}

export function slotUnitsToMinutes(slotUnits: number) {
  return slotUnits * MINUTES_PER_SLOT;
}

export function minutesToSlotUnits(minutes: number) {
  return minutes / MINUTES_PER_SLOT;
}

export function minutesToHours(minutes: number) {
  return minutes / MINUTES_PER_HOUR;
}

export function slotUnitsToHours(slotUnits: number) {
  return minutesToHours(slotUnitsToMinutes(slotUnits));
}

export function hoursToSlotUnits(hours: number) {
  return minutesToSlotUnits(creditsToMinutes(hours));
}

export function formatHours(value: number) {
  if (!Number.isFinite(value)) {
    return '0';
  }

  return trimTrailingZero(value.toFixed(1));
}
