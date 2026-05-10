import type { ReactNode } from 'react';
import { HomeworkChart } from '@/components/charts/homework-chart';
import { ConfidenceChart, PerformanceChart } from '@/components/charts/performance-chart';
import type { ConfidenceDataPoint, HomeworkDataPoint, PerformanceDataPoint } from '@/lib/data/dashboard';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: ReactNode }) => <div data-testid='card'>{children}</div>,
  CardHeader: ({ children }: { children: ReactNode }) => <div data-testid='card-header'>{children}</div>,
  CardContent: ({ children }: { children: ReactNode }) => <div data-testid='card-content'>{children}</div>,
  CardTitle: ({ children }: { children: ReactNode }) => <div data-testid='card-title'>{children}</div>,
}));

vi.mock('recharts', () => ({
  LineChart: ({ children }: { children: ReactNode }) => <div data-testid='line-chart'>{children}</div>,
  Line: vi.fn(),
  PieChart: ({ children }: { children: ReactNode }) => <div data-testid='pie-chart'>{children}</div>,
  Pie: ({ children }: { children: ReactNode }) => <div data-testid='pie'>{children}</div>,
  Cell: () => <div data-testid='cell' />,
  ResponsiveContainer: ({ children }: { children: ReactNode }) => (
    <div data-testid='responsive-container'>{children}</div>
  ),
  XAxis: vi.fn(),
  YAxis: vi.fn(),
  Tooltip: vi.fn(),
}));

vi.mock('date-fns', () => ({
  format: vi.fn(() => 'Jan 15'),
}));

const mockPerformanceData: PerformanceDataPoint[] = [
  { date: '2026-01-15T10:00:00Z', score: 3, sessionId: 1, subject: 'Mathematics', subjectSlug: 'mathematics' },
  { date: '2026-02-15T10:00:00Z', score: 4, sessionId: 2, subject: 'Mathematics', subjectSlug: 'mathematics' },
];

const mockConfidenceData: ConfidenceDataPoint[] = [
  { date: '2026-01-15T10:00:00Z', score: 2, sessionId: 1, subject: 'Mathematics', subjectSlug: 'mathematics' },
];

const mockHomeworkData: HomeworkDataPoint[] = [
  { date: '2026-01-15T10:00:00Z', completed: true, sessionId: 1, subject: 'Mathematics', subjectSlug: 'mathematics' },
  { date: '2026-02-15T10:00:00Z', completed: false, sessionId: 2, subject: 'Mathematics', subjectSlug: 'mathematics' },
];

describe('Chart Components', () => {
  it('PerformanceChart exports are valid', () => {
    expect(PerformanceChart).toBeDefined();
    expect(typeof PerformanceChart).toBe('function');
  });

  it('ConfidenceChart exports are valid', () => {
    expect(ConfidenceChart).toBeDefined();
    expect(typeof ConfidenceChart).toBe('function');
  });

  it('HomeworkChart exports are valid', () => {
    expect(HomeworkChart).toBeDefined();
    expect(typeof HomeworkChart).toBe('function');
  });

  it('PerformanceChart renders with data', async () => {
    (globalThis as { React?: unknown }).React = await import('react');
    expect(() => PerformanceChart({ data: mockPerformanceData })).not.toThrow();
  });

  it('PerformanceChart renders empty state', async () => {
    (globalThis as { React?: unknown }).React = await import('react');
    expect(() => PerformanceChart({ data: [] })).not.toThrow();
  });

  it('ConfidenceChart renders with data', async () => {
    (globalThis as { React?: unknown }).React = await import('react');
    expect(() => ConfidenceChart({ data: mockConfidenceData })).not.toThrow();
  });

  it('HomeworkChart renders with data', async () => {
    (globalThis as { React?: unknown }).React = await import('react');
    expect(() => HomeworkChart({ data: mockHomeworkData })).not.toThrow();
  });

  it('HomeworkChart renders empty state', async () => {
    (globalThis as { React?: unknown }).React = await import('react');
    expect(() => HomeworkChart({ data: [] })).not.toThrow();
  });
});
