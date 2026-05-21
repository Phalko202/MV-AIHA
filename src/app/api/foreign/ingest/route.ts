import { NextRequest, NextResponse } from "next/server";
import { FOREIGN_CONSULTATION_COUNT, FOREIGN_PATIENTS } from "@/lib/foreign-data";

interface ForeignFeedEvent {
  episodeId: string;
  facilityId: string;
  diagnosis: string | null;
  icd10Code: string | null;
  status: "ready" | "pending";
  receivedAt: string;
  pendingUntil: string | null;
  sectionCount: number;
  hasVitals: boolean;
  origin: "foreign";
  ageBand: string;
  gender: "Male" | "Female";
}

const store = globalThis as typeof globalThis & { mvAihsForeignEvents?: ForeignFeedEvent[] };

function queue() {
  if (!store.mvAihsForeignEvents) store.mvAihsForeignEvents = [];
  return store.mvAihsForeignEvents;
}

function summary() {
  const items = queue();
  const readyEvents = items.filter((item) => item.status === "ready").slice(-100).reverse();
  const pendingEvents = items.filter((item) => item.status === "pending").slice(-50).reverse();
  return {
    total: items.length,
    ready: readyEvents.length,
    pending: pendingEvents.length,
    sourcePatients: FOREIGN_PATIENTS.length,
    sourceConsultations: FOREIGN_CONSULTATION_COUNT,
    readyEvents,
    pendingEvents,
    updatedAt: new Date().toISOString(),
  };
}

export async function GET() {
  return NextResponse.json(summary(), { headers: corsHeaders() });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({})) as { amount?: number };
  const amount = Math.max(1, Math.min(500, Math.floor(Number(body.amount) || 25)));
  const items = queue();
  const now = Date.now();
  for (let index = 0; index < amount; index += 1) {
    const sequence = items.length;
    const patient = FOREIGN_PATIENTS[Math.floor(sequence / 50) % FOREIGN_PATIENTS.length];
    const consultation = patient.consultations[sequence % patient.consultations.length];
    items.push({
      episodeId: `${consultation.id}-${items.length + 1}`,
      facilityId: consultation.facilityId,
      diagnosis: consultation.diagnosis,
      icd10Code: consultation.icd10Code,
      status: "ready",
      receivedAt: new Date(now + index * 300).toISOString(),
      pendingUntil: null,
      sectionCount: consultation.sectionCount,
      hasVitals: consultation.hasVitals,
      origin: "foreign",
      ageBand: patient.ageBand,
      gender: patient.gender,
    });
  }
  if (items.length > 2000) items.splice(0, items.length - 2000);
  return NextResponse.json({ accepted: amount, ...summary() }, { headers: corsHeaders() });
}

export async function DELETE() {
  queue().splice(0);
  return NextResponse.json({ cleared: true, ...summary() }, { headers: corsHeaders() });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
