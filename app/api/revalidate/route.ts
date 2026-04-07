import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

export async function POST() {
  revalidateTag("clickup-tasks");
  revalidateTag("square-customers");
  revalidateTag("square-subs");
  revalidateTag("square-invoices");
  return NextResponse.json({ revalidated: true, at: new Date().toISOString() });
}
