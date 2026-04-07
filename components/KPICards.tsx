import { DashboardMetrics } from "@/lib/types/client";
import { formatCurrency } from "@/lib/mrr/calculate";
import { MetricCard } from "./MetricCard";

function UsersIcon() {
  return (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}
function XIcon() {
  return (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  );
}
function DollarIcon() {
  return (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}
function TrendIcon() {
  return (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  );
}
function AlertIcon() {
  return (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

interface KPICardsProps {
  metrics: DashboardMetrics;
}

export function KPICards({ metrics }: KPICardsProps) {
  const activeRate =
    metrics.totalClients > 0
      ? Math.round((metrics.activeClients / metrics.totalClients) * 100)
      : 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
      <MetricCard
        title="Total Clients"
        value={String(metrics.totalClients)}
        icon={<UsersIcon />}
        accentColor="#4f6ef7"
      />
      <MetricCard
        title="Active Clients"
        value={String(metrics.activeClients)}
        subtitle={`${activeRate}% retention`}
        icon={<CheckIcon />}
        accentColor="#10b981"
        trend={{ value: `${activeRate}%`, positive: activeRate >= 80 }}
      />
      <MetricCard
        title="Cancelled"
        value={String(metrics.cancelledClients)}
        icon={<XIcon />}
        accentColor="#ef4444"
      />
      <MetricCard
        title="Monthly MRR"
        value={formatCurrency(metrics.totalMrrCents)}
        subtitle="Active subscriptions"
        icon={<TrendIcon />}
        accentColor="#8b5cf6"
      />
      <MetricCard
        title="Total Revenue"
        value={formatCurrency(metrics.totalRevenueCents)}
        subtitle="All-time paid"
        icon={<DollarIcon />}
        accentColor="#f59e0b"
      />
      <MetricCard
        title="Overdue"
        value={String(metrics.overdueCount)}
        subtitle="Invoices past due"
        icon={<AlertIcon />}
        accentColor={metrics.overdueCount > 0 ? "#ef4444" : "#10b981"}
      />
    </div>
  );
}
