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
  const { clickupId, amountCents, nextPaymentDate, active, totalCollectedCents, startDate } = body;
  if (!clickupId || typeof clickupId !== "string") {
    return NextResponse.json({ error: "clickupId required" }, { status: 400 });
  }
  const record: ManualPaymentRecord = {
    amountCents: Number(amountCents),
    nextPaymentDate: String(nextPaymentDate),
    active: Boolean(active),
    totalCollectedCents: Number(totalCollectedCents ?? 0),
    startDate: String(startDate ?? nextPaymentDate),
  };
  await upsertManualPayment(clickupId, record);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const body = await req.json();
  const { clickupId } = body;
  if (!clickupId || typeof clickupId !== "string") {
    return NextResponse.json({ error: "clickupId required" }, { status: 400 });
  }
  await removeManualPayment(clickupId);
  return NextResponse.json({ ok: true });
}
