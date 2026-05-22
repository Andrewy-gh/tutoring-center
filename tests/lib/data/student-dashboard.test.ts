import { getStudentDashboardDetails } from '@/lib/data/student-dashboard';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetStudentDashboardDetails } = vi.hoisted(() => ({
  mockGetStudentDashboardDetails: vi.fn(),
}));

vi.mock('@/features/students/student-dashboard-service', () => ({
  studentDashboardDataService: {
    getStudentDashboardDetails: mockGetStudentDashboardDetails,
  },
}));

describe('student dashboard data compatibility wrapper', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('forwards detail lookups to the students feature service', async () => {
    const dashboardDetails = {
      creditHistory: [],
      progressReports: [],
    };
    mockGetStudentDashboardDetails.mockResolvedValueOnce(dashboardDetails);

    await expect(getStudentDashboardDetails(9, 'admin')).resolves.toBe(dashboardDetails);
    expect(mockGetStudentDashboardDetails).toHaveBeenCalledWith(9, 'admin');
  });
});
