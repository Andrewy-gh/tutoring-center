const SESSION_TIMEZONE = 'America/New_York';

export function formatSessionTime(date: Date) {
  return date.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: SESSION_TIMEZONE });
}

export function formatSessionDay(date: Date) {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: SESSION_TIMEZONE,
  });
}

export function formatSessionDateTime(date: Date) {
  return date.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: SESSION_TIMEZONE,
  });
}
