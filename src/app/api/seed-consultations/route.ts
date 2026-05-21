import { NextRequest, NextResponse } from "next/server";

interface SeededConsultation {
  id: string;
  patientId: string;
  episodeId: string;
  diagnosis: string;
  facility: string;
  createdAt: string;
  status: "queued" | "reading" | "done";
}

const diagnoses = [
  "Influenza-like illness",
  "Dengue fever watch",
  "Gastroenteritis",
  "Acute respiratory infection",
  "Hand-foot-mouth disease",
  "Severe dehydration review",
];

const facilities = ["IGMH", "HMH", "HGP2", "ADK", "TTH", "VHC", "MRH"];

const store = globalThis as typeof globalThis & { mvAihsSeededConsultations?: SeededConsultation[] };

function getQueue() {
  if (!store.mvAihsSeededConsultations) store.mvAihsSeededConsultations = [];
  return store.mvAihsSeededConsultations;
}

export async function GET() {
  return NextResponse.json({ consultations: getQueue().slice(-500).reverse() }, { headers: corsHeaders() });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const amount = Math.max(1, Math.min(5000, Number(body.amount ?? 100)));
  const queue = getQueue();
  const now = Date.now();
  const created: SeededConsultation[] = Array.from({ length: amount }, (_, index) => {
    const sequence = queue.length + index + 1;
    return {
      id: `SEED-${sequence.toString().padStart(6, "0")}`,
      patientId: `P-${((sequence % 100) + 1).toString().padStart(3, "0")}`,
      episodeId: `VIN-${new Date(now).getFullYear()}-${sequence.toString().padStart(5, "0")}`,
      diagnosis: diagnoses[sequence % diagnoses.length],
      facility: facilities[sequence % facilities.length],
      createdAt: new Date(now + index * 220).toISOString(),
      status: index % 5 === 0 ? "reading" : index % 3 === 0 ? "done" : "queued",
    };
  });

  queue.push(...created);
  if (queue.length > 10000) queue.splice(0, queue.length - 10000);
  return NextResponse.json({ accepted: created.length, totalQueued: queue.length }, { headers: corsHeaders() });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}