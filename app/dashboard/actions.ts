'use server';

import { getParentDashboardData, type DateRange } from '@/lib/data/dashboard';

export async function fetchParentDashboardData(
  dateRange?: DateRange,
  subject?: string
) {
  return getParentDashboardData(dateRange, subject);
}
