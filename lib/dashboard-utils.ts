import type {
  ConfidenceDataPoint,
  PerformanceDataPoint,
  StudentProgressData,
} from '@/features/parent-dashboard/parent-dashboard-service';

export type DateRangeOption = 'all' | '30d' | '3m' | '6m';

export const DATE_RANGE_OPTIONS: { value: DateRangeOption; label: string }[] = [
  { value: 'all', label: 'All time' },
  { value: '30d', label: 'Last 30 days' },
  { value: '3m', label: 'Last 3 months' },
  { value: '6m', label: 'Last 6 months' },
];

export function getUniqueSubjectsFromStudentData(data: StudentProgressData) {
  const subjects = new Map<string, string>();

  for (const p of data.performance) {
    if (p.subjectSlug && p.subjectSlug !== 'unknown' && p.subject) {
      subjects.set(p.subjectSlug, p.subject);
    }
  }
  for (const c of data.confidence) {
    if (c.subjectSlug && c.subjectSlug !== 'unknown' && c.subject) {
      subjects.set(c.subjectSlug, c.subject);
    }
  }
  for (const h of data.homework) {
    if (h.subjectSlug && h.subjectSlug !== 'unknown' && h.subject) {
      subjects.set(h.subjectSlug, h.subject);
    }
  }

  return Array.from(subjects.entries())
    .map(([slug, name]) => ({ slug, name }))
    .sort((left, right) => left.name.localeCompare(right.name) || left.slug.localeCompare(right.slug));
}

export function averagePerformanceByDate(items: PerformanceDataPoint[]) {
  const byDate = new Map<string, { scores: number[]; original: PerformanceDataPoint[] }>();

  for (const item of items) {
    const dateKey = item.date.split('T')[0];
    if (!byDate.has(dateKey)) {
      byDate.set(dateKey, { scores: [], original: [] });
    }
    const entry = byDate.get(dateKey)!;
    entry.scores.push(item.score);
    entry.original.push(item);
  }

  const result: PerformanceDataPoint[] = [];
  const sortedDates = Array.from(byDate.keys()).sort();

  for (const dateKey of sortedDates) {
    const entry = byDate.get(dateKey)!;
    const avg = entry.scores.reduce((a, b) => a + b, 0) / entry.scores.length;
    result.push({ date: entry.original[0].date, score: avg, sessionId: 0, subject: '', subjectSlug: '' });
  }

  return result;
}

export function averageConfidenceByDate(items: ConfidenceDataPoint[]) {
  const byDate = new Map<string, { scores: number[]; original: ConfidenceDataPoint[] }>();

  for (const item of items) {
    const dateKey = item.date.split('T')[0];
    if (!byDate.has(dateKey)) {
      byDate.set(dateKey, { scores: [], original: [] });
    }
    const entry = byDate.get(dateKey)!;
    entry.scores.push(item.score);
    entry.original.push(item);
  }

  const result: ConfidenceDataPoint[] = [];
  const sortedDates = Array.from(byDate.keys()).sort();

  for (const dateKey of sortedDates) {
    const entry = byDate.get(dateKey)!;
    const avg = entry.scores.reduce((a, b) => a + b, 0) / entry.scores.length;
    result.push({ date: entry.original[0].date, score: avg, sessionId: 0, subject: '', subjectSlug: '' });
  }

  return result;
}
