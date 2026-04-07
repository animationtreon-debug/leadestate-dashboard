import { NextResponse } from "next/server";
import { fetchAllCustomers } from "@/lib/square/fetchCustomers";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const customers = await fetchAllCustomers();
    return NextResponse.json(
      customers.map((c) => ({
        id: c.id,
        name: [c.givenName, c.familyName].filter(Boolean).join(" ") || c.companyName || c.id,
      }))
    );
  } catch (err) {
    return NextResponse.json(
      { error: String(err) },
      { status: 500 }
    );
  }
}
