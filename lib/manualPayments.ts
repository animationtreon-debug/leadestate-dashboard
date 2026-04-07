import { storageGet, storageSet } from "./storage";

const KEY = "manual-payments";

export interface ManualPaymentRecord {
  amountCents: number;
  nextPaymentDate: string;
  active: boolean;
  totalCollectedCents: number;
  startDate: string;
}

type PaymentsStore = Record<string, ManualPaymentRecord>;

async function readPayments(): Promise<PaymentsStore> {
  return (await storageGet<PaymentsStore>(KEY)) ?? {};
}

async function writePayments(data: PaymentsStore): Promise<void> {
  await storageSet<PaymentsStore>(KEY, data);
}

export async function loadAndProcessManualPayments(): Promise<Map<string, ManualPaymentRecord>> {
  const payments = await readPayments();
  const today = new Date().toISOString().split("T")[0];
  let dirty = false;

  for (const payment of Object.values(payments)) {
    if (!payment.active) continue;
    while (payment.nextPaymentDate <= today) {
      payment.totalCollectedCents += payment.amountCents;
      const d = new Date(payment.nextPaymentDate + "T12:00:00Z");
      d.setUTCDate(d.getUTCDate() + 30);
      payment.nextPaymentDate = d.toISOString().split("T")[0];
      dirty = true;
    }
  }

  if (dirty) await writePayments(payments);
  return new Map(Object.entries(payments));
}

export async function getAllManualPayments(): Promise<PaymentsStore> {
  return readPayments();
}

export async function upsertManualPayment(clickupId: string, record: ManualPaymentRecord): Promise<void> {
  const payments = await readPayments();
  payments[clickupId] = record;
  await writePayments(payments);
}

export async function removeManualPayment(clickupId: string): Promise<void> {
  const payments = await readPayments();
  delete payments[clickupId];
  await writePayments(payments);
}
