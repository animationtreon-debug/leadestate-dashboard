export interface ClickUpStatus {
  status: string;
  color: string;
  type: string;
}

export interface SquareSubscriptionSummary {
  id: string;
  planVariationId: string;
  planName: string;
  status: string;
  mrr: number; // monthly cents, normalized
  cadence: string;
  chargedThroughDate: string | null;
  canceledDate: string | null;
  startDate: string | null;
}

export interface SquareInvoiceSummary {
  id: string;
  status: string;
  dueDate: string | null;
  amount: number; // cents
  paidAt: string | null;
  title: string | null;
}

export interface ManualPaymentRecord {
  amountCents: number;
  nextPaymentDate: string;
  active: boolean;
  totalCollectedCents: number;
  startDate: string;
}

export interface ClientRecord {
  // Identity
  id: string;
  name: string;

  // ClickUp pipeline
  status: string;
  statusColor: string;
  statusType: string;

  // ClickUp custom fields
  onboardingDate: string | null;
  clientSuccessSheetUrl: string | null;
  eliteContractUrl: string | null;
  highLevelUrl: string | null;
  onboardingSheetUrl: string | null;
  twilioType: string | null;

  // Square identity
  squareCustomerId: string | null;
  squareCustomerName: string | null;
  squareMatchConfidence: "exact" | "company" | "fuzzy" | "override" | "none";

  // Square financial data
  subscriptions: SquareSubscriptionSummary[];
  invoices: SquareInvoiceSummary[];

  // Manual payment tracking
  manualPayment: ManualPaymentRecord | null;

  // Computed
  mrr: number; // monthly cents
  totalRevenue: number; // all-time cents from paid invoices + manual collected
  lastPaymentDate: string | null;
  nextPaymentDueDate: string | null;
  invoiceStatus: "current" | "overdue" | "none";
  isActive: boolean;
}

export interface DashboardMetrics {
  totalClients: number;
  activeClients: number;
  cancelledClients: number;
  totalMrrCents: number;
  totalRevenueCents: number;
  overdueCount: number;
  pipelineStages: Record<string, { count: number; color: string; mrrCents: number }>;
  lastSynced: string;
}

// Status strings that are considered "inactive/cancelled"
export const INACTIVE_STATUSES = new Set([
  "cancelled",
  "canceled",
  "churned",
  "inactive",
  "closed",
  "lost",
  "terminated",
  "complete",
  "completed",
]);

export function isActiveStatus(status: string): boolean {
  return !INACTIVE_STATUSES.has(status.toLowerCase().trim());
}
