import { NextRequest, NextResponse } from "next/server";
import { storageGet, storageSet } from "@/lib/storage";

const KEY = "match-overrides";

async function readOverrides(): Promise<Record<string, string>> {
  return (await storageGet<Record<string, string>>(KEY)) ?? {};
}

async function writeOverrides(data: Record<string, string>) {
  await storageSet<Record<string, string>>(KEY, data);
}

export async function GET() {
  const overrides = await readOverrides();
  return NextResponse.json(overrides);
}

export async function POST(req: NextRequest) {
  const { clickupId, squareId } = await req.json();
  if (!clickupId || typeof clickupId !== "string") {
    return NextResponse.json({ error: "clickupId required" }, { status: 400 });
  }
  const overrides = await readOverrides();
  if (squareId) {
    overrides[clickupId] = squareId;
  } else {
    // Store sentinel "__none__" to force "no match" and prevent auto-matching from re-linking
    overrides[clickupId] = "__none__";
  }
  await writeOverrides(overrides);
  return NextResponse.json({ ok: true });
}
