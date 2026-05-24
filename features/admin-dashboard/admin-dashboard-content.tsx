import {
  AT_RISK_THRESHOLD,
  BILLED_SESSIONS_LOOKBACK_DAYS,
  getAdminDashboardSessions,
  getAdminMetrics,
  getAtRiskParents,
} from '@/features/admin-dashboard/admin-dashboard-service';
import { ADMIN_DASHBOARD_VIEW_TITLES, type ViewKey } from '@/features/admin-dashboard/admin-dashboard-views';
import { formatHours } from '@/features/credits/billing-units';
import type { Route } from 'next';
import { AtRiskView } from './at-risk-view';
import { MetricCard } from './metric-card';
import { SessionsTodayTable } from './sessions-today-table';
import { SessionsView } from './sessions-view';

export async function AdminDashboardContent({ view }: { view: ViewKey }) {
  const [metrics, atRiskParents, sessions] = await Promise.all([
    getAdminMetrics(),
    view === 'accounts-needing-attention' ? getAtRiskParents() : Promise.resolve([]),
    getAdminDashboardSessions(view),
  ]);

  const leakagePct = (metrics.leakageRate * 100).toFixed(1);
  const viewUrl = (nextView: ViewKey) => `/dashboard?view=${nextView}` as Route<string>;

  return (
    <div className='space-y-8'>
      <section>
        <p className='text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-3'>Live</p>
        <div className='grid grid-cols-2 gap-4'>
          <MetricCard
            label={ADMIN_DASHBOARD_VIEW_TITLES['sessions-today']}
            value={metrics.sessionsTodayCount}
            sub='scheduled for today'
            href={viewUrl('sessions-today')}
            active={view === 'sessions-today'}
            tooltip='All sessions scheduled for today across all tutors. Mark no-shows or cancellations inline.'
          />
          <MetricCard
            label={ADMIN_DASHBOARD_VIEW_TITLES['accounts-needing-attention']}
            value={metrics.atRiskParentsCount}
            sub={`< ${formatHours(AT_RISK_THRESHOLD)} hours remaining`}
            subColor={metrics.atRiskParentsCount > 0 ? 'text-amber-500' : undefined}
            href={viewUrl('accounts-needing-attention')}
            active={view === 'accounts-needing-attention'}
            tooltip={`Parents with fewer than ${formatHours(AT_RISK_THRESHOLD)} hours remaining.`}
          />
        </div>
      </section>

      <section>
        <p className='text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-3'>Revenue</p>
        <div className='grid grid-cols-3 gap-4'>
          <MetricCard
            label={ADMIN_DASHBOARD_VIEW_TITLES['pending-notes']}
            value={metrics.pendingNotesCount}
            sub={`${formatHours(metrics.pendingNotesCreditsAtRisk)} hour${metrics.pendingNotesCreditsAtRisk === 1 ? '' : 's'} at risk`}
            subColor={metrics.pendingNotesCreditsAtRisk > 0 ? 'text-amber-500' : undefined}
            href={viewUrl('pending-notes')}
            active={view === 'pending-notes'}
            tooltip='Sessions where tutor notes have not been submitted yet.'
          />
          <MetricCard
            label={ADMIN_DASHBOARD_VIEW_TITLES['sessions-billed']}
            value={formatHours(metrics.creditsCaptured)}
            sub={`last ${BILLED_SESSIONS_LOOKBACK_DAYS} days`}
            href={viewUrl('sessions-billed')}
            active={view === 'sessions-billed'}
            tooltip='Credits successfully debited for completed sessions.'
          />
          <MetricCard
            label={ADMIN_DASHBOARD_VIEW_TITLES['sessions-pending-billing']}
            value={formatHours(metrics.creditsLeaked)}
            sub={`${leakagePct}% unbilled rate`}
            subColor={metrics.creditsLeaked > 0 ? 'text-amber-500' : undefined}
            href={viewUrl('sessions-pending-billing')}
            active={view === 'sessions-pending-billing'}
            tooltip='Completed sessions without a matching credit deduction.'
          />
        </div>
      </section>

      <section>
        {view === 'sessions-today' && (
          <>
            <h2 className='text-xl font-semibold mb-4'>{ADMIN_DASHBOARD_VIEW_TITLES['sessions-today']}</h2>
            <SessionsTodayTable sessions={sessions} />
          </>
        )}
        {view === 'pending-notes' && (
          <SessionsView title={ADMIN_DASHBOARD_VIEW_TITLES['pending-notes']} sessions={sessions} withContact />
        )}
        {view === 'sessions-billed' && (
          <SessionsView title={ADMIN_DASHBOARD_VIEW_TITLES['sessions-billed']} sessions={sessions} />
        )}
        {view === 'sessions-pending-billing' && (
          <SessionsView title={ADMIN_DASHBOARD_VIEW_TITLES['sessions-pending-billing']} sessions={sessions} />
        )}
        {view === 'accounts-needing-attention' && (
          <AtRiskView title={ADMIN_DASHBOARD_VIEW_TITLES['accounts-needing-attention']} parents={atRiskParents} />
        )}
      </section>
    </div>
  );
}
