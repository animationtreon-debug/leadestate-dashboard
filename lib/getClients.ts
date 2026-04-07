import { fetchAllTasks } from "./clickup/fetchTasks";
import { fetchAllCustomers } from "./square/fetchCustomers";
import { fetchSubscriptionsForCustomers } from "./square/fetchSubscriptions";
import { fetchInvoicesForCustomers, lastPaymentDateFromInvoices } from "./square/fetchInvoices";
import { matchClientsToSquare } from "./merge/matchClients";
import { buildClientRecord } from "./merge/buildClientRecord";
import { loadAndProcessManualPayments } from "./manualPayments";
import { ClientRecord, DashboardMetrics } from "./types/client";

export async function getAllClients(): Promise<ClientRecord[]> {
  const [tasks, squareCustomers, manualPaymentsMap] = await Promise.all([
    fetchAllTasks(),
    fetchAllCustomers().catch((err) => {
      console.error("Square customers fetch failed:", err);
      return [];
    }),
    loadAndProcessManualPayments().catch(() => new Map()),
  ]);

  // Match ClickUp tasks to Square customers
  const matchMap = await matchClientsToSquare(tasks, squareCustomers);

  // Collect matched Square customer IDs
  const matchedCustomerIds = [...matchMap.values()]
    .filter((m) => m.confidence !== "none" && m.squareCustomerId)
    .map((m) => m.squareCustomerId);
  const uniqueCustomerIds = [...new Set(matchedCustomerIds)];

  // Fetch Square data in parallel for all matched customers
  const [subscriptionsMap, invoicesMap] = await Promise.all([
    fetchSubscriptionsForCustomers(uniqueCustomerIds).catch((err) => {
      console.error("Square subscriptions fetch failed:", err);
      return new Map();
    }),
    fetchInvoicesForCustomers(uniqueCustomerIds).catch((err) => {
      console.error("Square invoices fetch failed:", err);
      return new Map();
    }),
  ]);

  // Derive last payment dates from invoices (no extra API call needed)
  const lastPaymentMap = new Map<string, string | null>();
  for (const id of uniqueCustomerIds) {
    const invoices = invoicesMap.get(id) ?? [];
    lastPaymentMap.set(id, lastPaymentDateFromInvoices(invoices));
  }

  // Build client records
  const records: ClientRecord[] = tasks.map((task) => {
    const match = matchMap.get(task.id) ?? { squareCustomerId: "", squareCustomerName: "", confidence: "none" as const };
    const squareId = match.squareCustomerId;
    const subscriptions = squareId ? (subscriptionsMap.get(squareId) ?? []) : [];
    const invoices = squareId ? (invoicesMap.get(squareId) ?? []) : [];
    const lastPaymentDate = squareId ? (lastPaymentMap.get(squareId) ?? null) : null;
    const manualPayment = manualPaymentsMap.get(task.id) ?? null;

    return buildClientRecord(task, match, subscriptions, invoices, lastPaymentDate, manualPayment);
  });

  // Sort by pipeline stage order, then alphabetically within each stage
  const STAGE_PRIORITY: Record<string, number> = {
    "open": 1,
    "first app show": 2,
    "appointment book": 3,
    "first cc": 4,
    "work to do": 5,
    "review": 6,
    "management": 7,
  };
  function stagePriority(status: string): number {
    const key = status.toLowerCase().trim();
    return STAGE_PRIORITY[key] ?? (STAGE_PRIORITY[key.replace(/[^a-z ]/g, "")] ?? 99);
  }

  return records.sort((a, b) => {
    const pa = stagePriority(a.status);
    const pb = stagePriority(b.status);
    if (pa !== pb) return pa - pb;
    return a.name.localeCompare(b.name);
  });
}

export function computeMetrics(clients: ClientRecord[]): DashboardMetrics {
  const pipelineStages: Record<string, { count: number; color: string; mrrCents: number }> = {};

  for (const c of clients) {
    const key = c.status;
    if (!pipelineStages[key]) {
      pipelineStages[key] = { count: 0, color: c.statusColor, mrrCents: 0 };
    }
    pipelineStages[key].count++;
    pipelineStages[key].mrrCents += c.mrr;
  }

  return {
    totalClients: clients.length,
    activeClients: clients.filter((c) => c.isActive).length,
    cancelledClients: clients.filter((c) => !c.isActive).length,
    totalMrrCents: clients.filter((c) => c.isActive).reduce((sum, c) => sum + c.mrr, 0),
    totalRevenueCents: clients.reduce((sum, c) => sum + c.totalRevenue, 0),
    overdueCount: clients.filter((c) => c.invoiceStatus === "overdue").length,
    pipelineStages,
    lastSynced: new Date().toISOString(),
  };
}
