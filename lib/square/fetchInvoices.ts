import { getSquareClient, getLocationId } from "./client";
import { SquareInvoiceSummary } from "../types/client";

type RawInvoice = {
  id?: string;
  status?: string;
  title?: string;
  updatedAt?: string;
  scheduledAt?: string;
  primaryRecipient?: { customerId?: string };
  paymentRequests?: Array<{
    dueDate?: string;
    computedAmountMoney?: { amount?: bigint | number };
    totalCompletedAmountMoney?: { amount?: bigint | number };
  }>;
};

function parseInvoice(inv: RawInvoice): SquareInvoiceSummary {
  let totalAmountCents = 0;
  let dueDate: string | null = null;

  for (const req of inv.paymentRequests ?? []) {
    totalAmountCents += Number(req.computedAmountMoney?.amount ?? 0);
    if (req.dueDate && !dueDate) dueDate = req.dueDate;
  }

  const paidAt =
    inv.status === "PAID" || inv.status === "PARTIALLY_PAID"
      ? (inv.updatedAt ?? inv.scheduledAt ?? null)
      : null;

  return {
    id: inv.id ?? "",
    status: inv.status ?? "UNKNOWN",
    dueDate,
    amount: totalAmountCents,
    paidAt,
    title: inv.title ?? null,
  };
}

export async function fetchInvoicesForCustomers(
  customerIds: string[]
): Promise<Map<string, SquareInvoiceSummary[]>> {
  if (!customerIds.length) return new Map();

  const client = getSquareClient();
  const locationId = getLocationId();
  const resultMap = new Map<string, SquareInvoiceSummary[]>();

  // Square invoice search only allows 1 customer ID at a time
  await Promise.all(
    customerIds.map(async (customerId) => {
      const invoices: SquareInvoiceSummary[] = [];
      let cursor: string | undefined = undefined;

      do {
        const response = (await client.invoices.search({
          query: {
            filter: {
              locationIds: [locationId],
              customerIds: [customerId],
            },
            sort: { field: "INVOICE_SORT_DATE", order: "DESC" },
          },
          limit: 200,
          cursor,
        })) as { invoices?: RawInvoice[]; cursor?: string };

        for (const inv of response.invoices ?? []) {
          invoices.push(parseInvoice(inv));
        }
        cursor = response.cursor ?? undefined;
      } while (cursor);

      if (invoices.length > 0) {
        resultMap.set(customerId, invoices);
      }
    })
  );

  return resultMap;
}

export function lastPaymentDateFromInvoices(invoices: SquareInvoiceSummary[]): string | null {
  const paid = invoices.filter((i) => i.paidAt).sort((a, b) =>
    (b.paidAt ?? "").localeCompare(a.paidAt ?? "")
  );
  return paid[0]?.paidAt ?? null;
}

// MRR fallback: use most recent non-cancelled invoice amount as monthly rate
export function computeMrrFromInvoices(invoices: SquareInvoiceSummary[]): number {
  const valid = invoices.filter(
    (i) => i.status !== "CANCELED" && i.status !== "REFUNDED" && i.amount > 0
  );
  if (!valid.length) return 0;
  const sorted = [...valid].sort((a, b) =>
    (b.dueDate ?? "").localeCompare(a.dueDate ?? "")
  );
  return sorted[0].amount;
}
