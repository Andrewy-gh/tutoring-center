'use server';

import { sessionProgressService, type ProgressReportFormData } from './session-progress-service';

export type { ProgressReportFormData } from './session-progress-service';

export async function submitProgressReport(formData: ProgressReportFormData) {
  return sessionProgressService.submitProgressReport(formData);
}
