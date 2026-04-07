import { ParsedTask } from "../clickup/fetchTasks";
import { SquareSubscriptionSummary, SquareInvoiceSummary, ClientRecord, ManualPaymentRecord, isActiveStatus } from "../types/client";
import { MatchResult } from "./matchClients";
import { computeMrrFromInvoices } from "../square/fetchInvoices";

export function buildClientRecord(
  task: ParsedTask,
  match: MatchResult,
  subscriptions: SquareSubscriptionSummary[],
  invoices: SquareInvoiceSummary[],
  lastPaymentDate: string | null,
  manualPayment: ManualPaymentRecord | null
): ClientRecord {
  // MRR: prefer active subscriptions with a known price, else fall back to invoice amount, then manual payment
  const activeSubscriptions = subscriptions.filter((s) => s.status === "ACTIVE");
  const subMrr = activeSubscriptions.reduce((sum, s) => sum + s.mrr, 0);
  const invoiceMrr = computeMrrFromInvoices(invoices);
  const squareMrr = subMrr > 0 ? subMrr : invoiceMrr;
  let manualMrr = 0;
  if (manualPayment?.active) {
    if (manualPayment.billingCycle === "yearly") {
      manualMrr = Math.round(manualPayment.amountCents / 12);
    } else if (manualPayment.billingCycle === "monthly") {
      manualMrr = manualPayment.amountCents;
    }
    // one_time: MRR stays 0
  }
  const mrr = squareMrr > 0 ? squareMrr : manualMrr;

  // Total revenue = paid invoices + manual collected
  const invoiceRevenue = invoices
    .filter((i) => i.status === "PAID" || i.status === "PARTIALLY_PAID")
    .reduce((sum, i) => sum + i.amount, 0);
  const totalRevenue = invoiceRevenue + (manualPayment?.totalCollectedCents ?? 0);

  // Next due date: earliest unpaid invoice, else manual payment next date
  const today = new Date().toISOString().split("T")[0];
  const unpaidInvoices = invoices
    .filter((i) => i.status !== "PAID" && i.dueDate && i.dueDate >= today)
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
  const squareNextDue = unpaidInvoices[0]?.dueDate ?? null;
  const nextPaymentDueDate =
    squareNextDue ??
    (manualPayment?.active ? manualPayment.nextPaymentDate : null);

  // Invoice status
  const overdueInvoices = invoices.filter(
    (i) => i.status !== "PAID" && i.dueDate && i.dueDate < today
  );
  let invoiceStatus: "current" | "overdue" | "none" = "none";
  if (overdueInvoices.length > 0) {
    invoiceStatus = "overdue";
  } else if (invoices.some((i) => i.status !== "PAID")) {
    invoiceStatus = "current";
  }

  return {
    id: task.id,
    name: task.name,
    status: task.status.status,
    statusColor: task.status.color,
    statusType: task.status.type,
    onboardingDate: task.onboardingDate,
    clientSuccessSheetUrl: task.clientSuccessSheetUrl,
    eliteContractUrl: task.eliteContractUrl,
    highLevelUrl: task.highLevelUrl,
    onboardingSheetUrl: task.onboardingSheetUrl,
    twilioType: task.twilioType,
    plan: task.plan,
    bestWayToContact: task.bestWayToContact,
    onboardingCall: task.onboardingCall,
    squareCustomerId: match.confidence !== "none" ? match.squareCustomerId : null,
    squareCustomerName: match.confidence !== "none" ? match.squareCustomerName : null,
    squareMatchConfidence: match.confidence,
    subscriptions,
    invoices,
    manualPayment,
    mrr,
    totalRevenue,
    lastPaymentDate,
    nextPaymentDueDate,
    invoiceStatus,
    isActive: isActiveStatus(task.status.status),
  };
}
