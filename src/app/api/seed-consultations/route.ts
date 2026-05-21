import { NextRequest, NextResponse } from "next/server";

interface SeededConsultation {
  id: string;
  patientId: string;
  episodeId: string;
  diagnosis: string;
  facility: string;
  createdAt: string;
  status: "queued" | "reading" | "done";
  stage: "intake" | "clinical-read" | "reasoning" | "research" | "promotion";
  assignedAgent: "MedGemma" | "DeepSeek" | "Research RAG" | "MV-AIHA Router";
  priority: "routine" | "watch" | "urgent";
  confidence: number;
  progress: number;
  interactions: string[];
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
const stages: SeededConsultation["stage"][] = ["intake", "clinical-read", "reasoning", "research", "promotion"];
const agents: SeededConsultation["assignedAgent"][] = ["MedGemma", "DeepSeek", "Research RAG", "MV-AIHA Router"];

const store = globalThis as typeof globalThis & { mvAihsSeededConsultations?: SeededConsultation[] };

function getQueue() {
  if (!store.mvAihsSeededConsultations) store.mvAihsSeededConsultations = [];
  return store.mvAihsSeededConsultations;
}

export async function GET() {
  const queue = getQueue();
  const consultations = queue.slice(-500).reverse();
  const summary = {
    totalQueued: queue.length,
    visible: consultations.length,
    reading: queue.filter((item) => item.status === "reading").length,
    done: queue.filter((item) => item.status === "done").length,
    urgent: queue.filter((item) => item.priority === "urgent").length,
    agents: agents.map((agent) => ({ agent, count: queue.filter((item) => item.assignedAgent === agent).length })),
  };

  return NextResponse.json({ consultations, summary }, { headers: corsHeaders() });
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text().catch(() => "");
  let requestedAmount: unknown = request.nextUrl.searchParams.get("amount") ?? 100;

  if (rawBody.trim()) {
    try {
      const body = JSON.parse(rawBody) as { amount?: unknown };
      requestedAmount = body.amount ?? requestedAmount;
    } catch {
      const formAmount = new URLSearchParams(rawBody).get("amount");
      requestedAmount = formAmount ?? rawBody.match(/amount\s*[:=]\s*"?(\d+)/i)?.[1] ?? requestedAmount;
    }
  }

  const parsedAmount = Number(requestedAmount);
  const amount = Number.isFinite(parsedAmount) ? Math.max(1, Math.min(5000, Math.floor(parsedAmount))) : 100;
  const queue = getQueue();
  const now = Date.now();
  const created: SeededConsultation[] = Array.from({ length: amount }, (_, index) => {
    const sequence = queue.length + index + 1;
    const stage = stages[sequence % stages.length];
    const assignedAgent = agents[sequence % agents.length];
    const priority = sequence % 11 === 0 ? "urgent" : sequence % 4 === 0 ? "watch" : "routine";
    const status = stage === "promotion" ? "done" : stage === "intake" ? "queued" : "reading";
    const progress = status === "done" ? 100 : status === "queued" ? 12 + (sequence % 18) : 38 + (sequence % 52);
    const diagnosis = diagnoses[sequence % diagnoses.length];
    const facility = facilities[sequence % facilities.length];
    return {
      id: `SEED-${sequence.toString().padStart(6, "0")}`,
      patientId: `P-${((sequence % 100) + 1).toString().padStart(3, "0")}`,
      episodeId: `VIN-${new Date(now).getFullYear()}-${sequence.toString().padStart(5, "0")}`,
      diagnosis,
      facility,
      createdAt: new Date(now + index * 220).toISOString(),
      status,
      stage,
      assignedAgent,
      priority,
      confidence: Number((0.72 + ((sequence % 24) / 100)).toFixed(2)),
      progress,
      interactions: [
        `Received Vinavi consultation ${sequence.toString().padStart(5, "0")}`,
        `${assignedAgent} assigned for ${stage.replace("-", " ")}`,
        priority === "urgent" ? `Escalated ${diagnosis} at ${facility}` : `Queued ${diagnosis} for batched AI review`,
      ],
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