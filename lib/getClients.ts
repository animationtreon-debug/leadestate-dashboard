import { fetchAllTasks } from "./clickup/fetchTasks";
import { fetchAllCustomers } from "./square/fetchCustomers";
import { fetchSubscriptionsForCustomers } from "./square/fetchSubscriptions";
import { fetchInvoicesForCustomers, fetchLastPaymentDate } from "./square/fetchInvoices";
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

  // Fetch last payment dates in parallel (per customer, limited concurrency)
  const lastPaymentMap = new Map<string, string | null>();
  await Promise.all(
    uniqueCustomerIds.map(async (id) => {
      const date = await fetchLastPaymentDate(id).catch(() => null);
      lastPaymentMap.set(id, date);
    })
  );

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

  // Sort: active first, then by name
  return records.sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
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
