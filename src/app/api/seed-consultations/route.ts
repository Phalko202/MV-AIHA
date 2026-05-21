import { NextRequest, NextResponse } from "next/server";

interface SeededConsultation {
  id: string;
  patientId: string;
  aasandhaNo: string;
  episodeId: string;
  diagnosis: string;
  facility: string;
  sourcePortal: "Vinavi" | "Aasandha";
  sourceAction: "patient-linked" | "episode-closed" | "claim-verified";
  createdAt: string;
  status: "queued" | "reading" | "done";
  stage: "received" | "privacy-check" | "clinical-read" | "anomaly-check" | "briefing" | "ready";
  assignedAgent: "Raw Ingestion Buffer" | "Analytical Synthesizer" | "Strategic Briefing Engine" | "MV-AIHA Router";
  priority: "routine" | "watch" | "urgent";
  confidence: number;
  progress: number;
  interactions: string[];
  assessment: string[];
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
const stages: SeededConsultation["stage"][] = ["received", "privacy-check", "clinical-read", "anomaly-check", "briefing", "ready"];
const agents: SeededConsultation["assignedAgent"][] = ["Raw Ingestion Buffer", "Analytical Synthesizer", "Strategic Briefing Engine", "MV-AIHA Router"];
const sourceActions: SeededConsultation["sourceAction"][] = ["patient-linked", "episode-closed", "claim-verified"];

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

export async function DELETE() {
  const queue = getQueue();
  queue.splice(0, queue.length);
  return NextResponse.json({ cleared: true, totalQueued: 0 }, { headers: corsHeaders() });
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
    const sourcePortal = sequence % 3 === 0 ? "Aasandha" : "Vinavi";
    const sourceAction = sourceActions[sequence % sourceActions.length];
    const priority = sequence % 11 === 0 ? "urgent" : sequence % 4 === 0 ? "watch" : "routine";
    const status = stage === "ready" ? "done" : stage === "received" ? "queued" : "reading";
    const progress = status === "done" ? 100 : status === "queued" ? 12 + (sequence % 18) : 38 + (sequence % 52);
    const diagnosis = diagnoses[sequence % diagnoses.length];
    const facility = facilities[sequence % facilities.length];
    const patientOrdinal = ((sequence % 100) + 1).toString().padStart(3, "0");
    const aasandhaToken = 880000 + (sequence % 90000);
    const privacyLine = "Identity stays in the source system; surveillance receives only safe clinical fields.";
    return {
      id: `SEED-${sequence.toString().padStart(6, "0")}`,
      patientId: `P-${patientOrdinal}`,
      aasandhaNo: `ASD-${aasandhaToken}`,
      episodeId: `VIN-${new Date(now).getFullYear()}-${sequence.toString().padStart(5, "0")}`,
      diagnosis,
      facility,
      sourcePortal,
      sourceAction,
      createdAt: new Date(now + index * 220).toISOString(),
      status,
      stage,
      assignedAgent,
      priority,
      confidence: Number((0.72 + ((sequence % 24) / 100)).toFixed(2)),
      progress,
      interactions: [
        `${sourcePortal} sent ${sourceAction.replace("-", " ")} event for consultation ${sequence.toString().padStart(5, "0")}`,
        privacyLine,
        `${assignedAgent} assigned for ${stage.replace("-", " ")}`,
        priority === "urgent" ? `Escalated ${diagnosis} at ${facility} for human review` : `Queued ${diagnosis} for batched surveillance review`,
      ],
      assessment: [
        `Source link: ${sourcePortal} patient ${patientOrdinal} matched to Aasandha eligibility token ${aasandhaToken}.`,
        `Clinical signal: ${diagnosis} from ${facility}; priority set to ${priority}.`,
        `Safety check: ${privacyLine}`,
        status === "done" ? "Release decision: aggregate counters updated; no patient record stored in this portal." : "Release decision: waiting for staged review before dashboard counters move.",
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
    "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}