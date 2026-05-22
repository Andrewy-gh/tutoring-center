import { describe, expect, it } from 'vitest';

describe('admin dashboard data compatibility wrapper', () => {
  it('re-exports the feature-owned admin dashboard service', async () => {
    const wrapper = await import('@/lib/data/admin-dashboard');
    const service = await import('@/features/admin-dashboard/admin-dashboard-service');

    expect(wrapper.AT_RISK_THRESHOLD).toBe(service.AT_RISK_THRESHOLD);
    expect(wrapper.getAdminMetrics).toBe(service.getAdminMetrics);
    expect(wrapper.getAtRiskParents).toBe(service.getAtRiskParents);
    expect(wrapper.getDebitSessionIds).toBe(service.getDebitSessionIds);
  }, 10000);
});
