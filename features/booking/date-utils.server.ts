import 'server-only';
import type { WeekDay } from '@/db/types';
import { TIMEZONE } from '@/lib/constants';

const WEEKDAY_NAME_BY_INDEX: WeekDay[] = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function parseIsoDateParts(dateStr: string): [number, number, number] {
  const [year = '0', month = '0', day = '0'] = dateStr.split('-');
  return [Number(year), Number(month), Number(day)];
}

function getTzOffsetMs(utcDate: Date, timezone = TIMEZONE) {
  const dtParts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(utcDate);

  const get = (type: string) => {
    const val = Number(dtParts.find(part => part.type === type)?.value ?? '0');
    return type === 'hour' && val === 24 ? 0 : val;
  };

  const tzComponentsAsUtcMs = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second')
  );

  return utcDate.getTime() - tzComponentsAsUtcMs;
}

export function tzDateTimeToUtcIso(dateStr: string, hour: number, minute: number, timezone = TIMEZONE) {
  const [year, month, day] = parseIsoDateParts(dateStr);
  const unadjustedMs = Date.UTC(year, month - 1, day, hour, minute);

  return new Date(unadjustedMs + getTzOffsetMs(new Date(unadjustedMs), timezone)).toISOString();
}

export function tzDateToUtcIso(dateStr: string, timezone = TIMEZONE) {
  return tzDateTimeToUtcIso(dateStr, 0, 0, timezone);
}

export function getIsoDateWeekday(dateStr: string) {
  const [year, month, day] = parseIsoDateParts(dateStr);
  return WEEKDAY_NAME_BY_INDEX[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
}

export function isoDatesInRange(from: string, to: string) {
  const [fromYear, fromMonth, fromDay] = parseIsoDateParts(from);
  const [toYear, toMonth, toDay] = parseIsoDateParts(to);
  const toMs = Date.UTC(toYear, toMonth - 1, toDay);
  const days: string[] = [];

  for (let currentMs = Date.UTC(fromYear, fromMonth - 1, fromDay); currentMs < toMs; currentMs += 86_400_000) {
    const date = new Date(currentMs);
    const yyyy = date.getUTCFullYear();
    const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(date.getUTCDate()).padStart(2, '0');
    days.push(`${yyyy}-${mm}-${dd}`);
  }

  return days;
}
