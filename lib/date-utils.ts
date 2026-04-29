import { addDays, format, startOfDay, startOfWeek } from 'date-fns';

const NY_TZ = 'America/New_York';

export function getWeekStart(today: Date) {
  return startOfDay(startOfWeek(today, { weekStartsOn: 1 }));
}

export function getNextWeekStart(today: Date) {
  return addDays(getWeekStart(today), 7);
}

export function formatWeekRange(weekStart: Date) {
  const sunday = addDays(weekStart, 6);
  return `${format(weekStart, 'MMM d')} – ${format(sunday, 'd')}`;
}

export function formatDateLabel(date: Date) {
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export function formatIsoDate(date: Date) {
  return format(date, 'yyyy-MM-dd');
}

export function formatSessionTime(date: Date) {
  return date.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: NY_TZ });
}

export function formatSessionDay(date: Date) {
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: NY_TZ });
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
    timeZone: NY_TZ,
  });
}
