import { NextRequest, NextResponse } from "next/server";

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

const diagnoses = [
  { diagnosis: "Dengue fever watch", icd10Code: "A90" },
  { diagnosis: "Acute gastroenteritis", icd10Code: "A09" },
  { diagnosis: "Influenza-like illness", icd10Code: "J11" },
  { diagnosis: "Community-acquired pneumonia", icd10Code: "J18" },
];

const facilities = ["HMH", "HGP2", "TTH", "IGMH"];
const ageBands = ["20-29", "30-39", "40-49", "50-59"];

function summary() {
  const items = queue();
  const readyEvents = items.filter((item) => item.status === "ready").slice(-100).reverse();
  const pendingEvents = items.filter((item) => item.status === "pending").slice(-50).reverse();
  return {
    total: items.length,
    ready: readyEvents.length,
    pending: pendingEvents.length,
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
    const sequence = items.length + 1;
    const disease = diagnoses[sequence % diagnoses.length];
    items.push({
      episodeId: `FOR-${new Date(now).getFullYear()}-${sequence.toString().padStart(5, "0")}`,
      facilityId: facilities[sequence % facilities.length],
      diagnosis: disease.diagnosis,
      icd10Code: disease.icd10Code,
      status: "ready",
      receivedAt: new Date(now + index * 300).toISOString(),
      pendingUntil: null,
      sectionCount: 3 + (sequence % 4),
      hasVitals: sequence % 2 === 0,
      origin: "foreign",
      ageBand: ageBands[sequence % ageBands.length],
      gender: sequence % 2 === 0 ? "Male" : "Female",
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
