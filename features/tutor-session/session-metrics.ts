'use server';

import { sessionMetricsService, type SessionMetricsFormData } from './session-metrics-service';

export async function submitSessionMetrics(formData: SessionMetricsFormData) {
  return sessionMetricsService.submitSessionMetrics(formData);
}
