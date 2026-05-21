import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ disabled: true, message: "Seed consultations were replaced by Vinavi and Foreign source feeds." }, { status: 410 });
}

export async function POST() {
  return NextResponse.json({ disabled: true, message: "Use /api/vinavi/ingest or /api/foreign/ingest." }, { status: 410 });
}
