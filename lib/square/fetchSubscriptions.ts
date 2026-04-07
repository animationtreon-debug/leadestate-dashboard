import { getSquareClient, getLocationId } from "./client";
import { SquareSubscriptionSummary } from "../types/client";
import { normalizeCadenceToMonthly } from "../mrr/calculate";

export async function fetchSubscriptionsForCustomers(
  customerIds: string[]
): Promise<Map<string, SquareSubscriptionSummary[]>> {
  if (!customerIds.length) return new Map();

  const client = getSquareClient();
  const locationId = getLocationId();
  const resultMap = new Map<string, SquareSubscriptionSummary[]>();

  const BATCH_SIZE = 10;
  for (let i = 0; i < customerIds.length; i += BATCH_SIZE) {
    const batch = customerIds.slice(i, i + BATCH_SIZE);
    let cursor: string | undefined = undefined;

    do {
      // v40 SDK: subscriptions.search returns { subscriptions, cursor } directly
      const response = (await client.subscriptions.search({
        cursor,
        query: {
          filter: {
            customerIds: batch,
            locationIds: [locationId],
          },
        },
      })) as { subscriptions?: unknown[]; cursor?: string };

      const subs = (response.subscriptions ?? []) as Array<{
        id?: string;
        customerId?: string;
        status?: string;
        planVariationId?: string;
        priceOverrideMoney?: { amount?: bigint | number };
        phases?: Array<{ pricing?: { priceMoney?: { amount?: bigint | number } } }>;
        chargedThroughDate?: string;
        canceledDate?: string;
        startDate?: string;
      }>;

      for (const sub of subs) {
        const customerId = sub.customerId ?? "";
        if (!customerId) continue;

        let amountCents = 0;
        const cadence = "MONTHLY";

        if (sub.priceOverrideMoney?.amount) {
          amountCents = Number(sub.priceOverrideMoney.amount);
        } else {
          const phase = sub.phases?.[0];
          if (phase?.pricing?.priceMoney?.amount) {
            amountCents = Number(phase.pricing.priceMoney.amount);
          }
        }

        const mrr = normalizeCadenceToMonthly(amountCents, cadence);

        const summary: SquareSubscriptionSummary = {
          id: sub.id ?? "",
          planVariationId: sub.planVariationId ?? "",
          planName: sub.planVariationId ? "Subscription Plan" : "Subscription",
          status: sub.status ?? "UNKNOWN",
          mrr,
          cadence,
          chargedThroughDate: sub.chargedThroughDate ?? null,
          canceledDate: sub.canceledDate ?? null,
          startDate: sub.startDate ?? null,
        };

        const existing = resultMap.get(customerId) ?? [];
        existing.push(summary);
        resultMap.set(customerId, existing);
      }

      cursor = response.cursor ?? undefined;
    } while (cursor);
  }

  return resultMap;
}
