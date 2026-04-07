import { NextRequest, NextResponse } from "next/server";
import {
  getAllManualPayments,
  upsertManualPayment,
  removeManualPayment,
  ManualPaymentRecord,
} from "@/lib/manualPayments";

export const dynamic = "force-dynamic";

export async function GET() {
  const payments = await getAllManualPayments();
  return NextResponse.json(payments);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { clickupId, amountCents, nextPaymentDate, active, totalCollectedCents, startDate, currency, billingCycle } = body;
  if (!clickupId || typeof clickupId !== "string") {
    return NextResponse.json({ error: "clickupId required" }, { status: 400 });
  }
  const resolvedCycle = (billingCycle === "yearly" || billingCycle === "one_time") ? billingCycle : "monthly";
  // For one-time payments, the full amount is immediately collected revenue
  const resolvedCollected = resolvedCycle === "one_time"
    ? Number(amountCents)
    : Number(totalCollectedCents ?? 0);

  const record: ManualPaymentRecord = {
    amountCents: Number(amountCents),
    nextPaymentDate: String(nextPaymentDate),
    active: Boolean(active),
    totalCollectedCents: resolvedCollected,
    startDate: String(startDate ?? nextPaymentDate),
    currency: String(currency ?? "USD"),
    billingCycle: resolvedCycle,
  };
  try {
    await upsertManualPayment(clickupId, record);
  } catch (err) {
    console.error("upsertManualPayment failed:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const body = await req.json();
  const { clickupId } = body;
  if (!clickupId || typeof clickupId !== "string") {
    return NextResponse.json({ error: "clickupId required" }, { status: 400 });
  }
  try {
    await removeManualPayment(clickupId);
  } catch (err) {
    console.error("removeManualPayment failed:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
