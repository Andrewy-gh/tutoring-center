import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

globalThis.React = React;

const { getSessions } = vi.hoisted(() => ({
  getSessions: vi.fn(async () => [
    {
      id: 101,
      student_name: 'Student One',
      tutor_id: 1,
      tutor_name: 'Tutor One',
      tutor_email: 'tutor1@example.com',
      student_id: 11,
      subject_id: 21,
      subject_name: 'Mathematics',
      scheduled_at: new Date().toISOString(),
      ends_at: new Date().toISOString(),
      hours: 1,
      status: 'Completed',
    },
    {
      id: 102,
      student_name: 'Student Two',
      tutor_id: 2,
      tutor_name: 'Tutor Two',
      tutor_email: 'tutor2@example.com',
      student_id: 12,
      subject_id: 22,
      subject_name: 'Science',
      scheduled_at: new Date().toISOString(),
      ends_at: new Date().toISOString(),
      hours: 1,
      status: 'Pending-Notes',
    },
    {
      id: 103,
      student_name: 'Student Three',
      tutor_id: 3,
      tutor_name: 'Tutor Three',
      tutor_email: 'tutor3@example.com',
      student_id: 13,
      subject_id: 23,
      subject_name: 'Writing',
      scheduled_at: new Date().toISOString(),
      ends_at: new Date().toISOString(),
      hours: 1,
      status: 'Scheduled',
    },
  ]),
}));

vi.mock('@/features/admin-dashboard/admin-dashboard-service', () => ({
  AT_RISK_THRESHOLD: 2,
  getAdminMetrics: vi.fn(async () => ({
    sessionsTodayCount: 1,
    pendingNotesCount: 1,
    pendingNotesCreditsAtRisk: 2,
    atRiskParentsCount: 1,
    creditsCaptured: 4,
    creditsLeaked: 0.5,
    leakageRate: 0.5 / 4.5,
  })),
  getAtRiskParents: vi.fn(async () => [
    { parent_id: 7, name: 'Pat Parent', email: 'pat@example.com', available_minutes: 60, available_hours: '1' },
  ]),
  getDebitSessionIds: vi.fn(async () => new Set([101])),
}));

vi.mock('@/features/sessions/sessions-service', () => ({
  getSessions,
}));

vi.mock('@/features/admin-dashboard/metric-card', () => ({
  MetricCard: ({ label, value }: { label: string; value: string | number }) => (
    <div data-testid='metric-card'>
      {label}:{value}
    </div>
  ),
}));

vi.mock('@/features/admin-dashboard/sessions-today-table', () => ({
  SessionsTodayTable: ({ sessions }: { sessions: Array<{ id: number }> }) => (
    <div data-testid='sessions-today'>sessions:{sessions.length}</div>
  ),
}));

vi.mock('@/features/admin-dashboard/sessions-view', () => ({
  SessionsView: ({
    title,
    sessions,
    withContact,
  }: {
    title: string;
    sessions: Array<{ id: number }>;
    withContact?: boolean;
  }) => (
    <div data-testid='sessions-view'>
      {title}:{sessions.length}:{withContact ? 'contact' : 'plain'}
    </div>
  ),
}));

vi.mock('@/features/admin-dashboard/at-risk-view', () => ({
  AtRiskView: ({ title, parents }: { title: string; parents: Array<{ parent_id: number }> }) => (
    <div data-testid='at-risk-view'>
      {title}:{parents.length}
    </div>
  ),
}));

describe('AdminDashboardContent', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-24T15:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the pending notes detail view for admins', async () => {
    const { AdminDashboardContent } = await import('@/features/admin-dashboard/admin-dashboard-content');
    const { renderToStaticMarkup } = await import('react-dom/server');

    const markup = renderToStaticMarkup(await AdminDashboardContent({ view: 'pending-notes' }));

    expect(markup).toContain('Sessions Today:1');
    expect(markup).toContain('Pending Notes:1:contact');
    expect(markup).toContain('Sessions Billed:4');
  });

  it('keeps same-day pending-note sessions out of the sessions-today view', async () => {
    const { AdminDashboardContent } = await import('@/features/admin-dashboard/admin-dashboard-content');
    const { renderToStaticMarkup } = await import('react-dom/server');

    const markup = renderToStaticMarkup(await AdminDashboardContent({ view: 'sessions-today' }));

    expect(markup).toContain('sessions:1');
  });

  it('renders the at-risk accounts view', async () => {
    const { AdminDashboardContent } = await import('@/features/admin-dashboard/admin-dashboard-content');
    const { renderToStaticMarkup } = await import('react-dom/server');

    const markup = renderToStaticMarkup(await AdminDashboardContent({ view: 'accounts-needing-attention' }));

    expect(markup).toContain('Accounts Needing Attention:1');
  });
});
