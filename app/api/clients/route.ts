import { NextResponse } from "next/server";
import { getAllClients, computeMetrics } from "@/lib/getClients";

export const dynamic = "force-dynamic";
export const revalidate = 300; // 5 minutes

export async function GET() {
  try {
    const clients = await getAllClients();
    const metrics = computeMetrics(clients);
    return NextResponse.json({ clients, metrics });
  } catch (err) {
    console.error("Failed to fetch clients:", err);
    return NextResponse.json(
      { error: "Failed to fetch client data", details: String(err) },
      { status: 500 }
    );
  }
}
