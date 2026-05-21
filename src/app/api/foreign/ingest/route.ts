import { NextRequest, NextResponse } from "next/server";
import { FOREIGN_CONSULTATION_COUNT, FOREIGN_PATIENTS } from "@/lib/foreign-data";

interface ForeignFeedEvent {
  episodeId: string;
  patientStatId: string;
  episodeSequence: number;
  facilityId: string;
  diagnosis: string | null;
  icd10Code: string | null;
  diseaseCode: string | null;
  status: "ready" | "pending";
  receivedAt: string;
  openedAt: string;
  closedAt: string | null;
  pendingUntil: string | null;
  sectionCount: number;
  hasVitals: boolean;
  origin: "foreign";
  ageBand: string;
  gender: "Male" | "Female";
  clinical: {
    complaints: Array<{ content: string; createdAt: string }>;
    advice: Array<{ content: string; createdAt: string }>;
    prescriptions: Array<{ content: string; createdAt: string }>;
    services: Array<{ content: string; createdAt: string }>;
    vitals: Array<{ timestamp: string; bp?: string; heartRate?: number; temp?: number; spo2?: number; respRate?: number }>;
  };
}

const store = globalThis as typeof globalThis & { mvAihsForeignEvents?: ForeignFeedEvent[] };

function queue() {
  if (!store.mvAihsForeignEvents) store.mvAihsForeignEvents = [];
  return store.mvAihsForeignEvents;
}

function diseaseCodeFromIcd(icd10Code: string | null) {
  const code = (icd10Code ?? "").toUpperCase();
  if (code.startsWith("A90")) return "dengue";
  if (code.startsWith("A09")) return "gastro";
  if (code.startsWith("J11")) return "ili";
  if (code.startsWith("J18")) return "pneumonia";
  if (code.startsWith("B08.4")) return "hfmd";
  return null;
}

function clinicalFor(consultation: { date: string; diagnosis: string; icd10Code: string; hasVitals: boolean }, patientIndex: number, consultationIndex: number) {
  const createdAt = `${consultation.date}T10:15:00Z`;
  const diagnosis = consultation.diagnosis.toLowerCase();
  const complaint = diagnosis.includes("dengue") ? "High fever, headache, myalgia, and reduced oral intake after mosquito exposure."
    : diagnosis.includes("gastro") ? "Watery stools, vomiting, abdominal cramps, and signs of mild dehydration."
      : diagnosis.includes("influenza") ? "Fever, cough, sore throat, myalgia, and fatigue for two days."
        : diagnosis.includes("pneumonia") ? "Cough, fever, pleuritic chest discomfort, and exertional shortness of breath."
          : diagnosis.includes("hand-foot") ? "Fever with oral ulcers and vesicular rash on palms and soles."
            : "Administrative medical certificate review after outpatient consultation.";
  const advice = diagnosis.includes("certificate") ? "Certificate issued after clinical review; return if symptoms change."
    : "Hydration, warning signs explained, and follow-up timing documented for surveillance-safe review.";
  const prescription = diagnosis.includes("dengue") ? "Paracetamol only; avoid NSAIDs; oral fluids; repeat CBC if fever persists."
    : diagnosis.includes("gastro") ? "ORS after every loose stool; zinc; antiemetic if vomiting prevents oral intake."
      : diagnosis.includes("pneumonia") ? "Antibiotic course per local guideline and antipyretic as required."
        : diagnosis.includes("hand-foot") ? "Supportive care, oral analgesic, fluids, and isolation advice."
          : diagnosis.includes("certificate") ? "No new medicine prescribed."
            : "Paracetamol, oral fluids, and review if fever or respiratory symptoms worsen.";
  const service = diagnosis.includes("dengue") ? "CBC, platelet count, dengue NS1/IgM panel requested."
    : diagnosis.includes("gastro") ? "Stool test and electrolytes requested if symptoms persist beyond 48 hours."
      : diagnosis.includes("pneumonia") ? "Chest X-ray and oxygen saturation monitoring completed."
        : diagnosis.includes("hand-foot") ? "Clinical rash review documented; school/work exclusion advice given."
          : diagnosis.includes("certificate") ? "Medical certificate prepared and verified by source facility."
            : "Influenza rapid test and CBC considered based on risk profile.";
  return {
    complaints: [{ content: complaint, createdAt }],
    advice: [{ content: advice, createdAt: `${consultation.date}T10:35:00Z` }],
    prescriptions: [{ content: prescription, createdAt: `${consultation.date}T10:40:00Z` }],
    services: [{ content: service, createdAt: `${consultation.date}T10:45:00Z` }],
    vitals: consultation.hasVitals ? [{
      timestamp: `${consultation.date}T10:05:00Z`,
      bp: `${112 + ((patientIndex + consultationIndex) % 24)}/${70 + ((patientIndex + consultationIndex) % 16)}`,
      heartRate: 76 + ((patientIndex + consultationIndex) % 34),
      temp: +(36.5 + ((patientIndex + consultationIndex) % 17) / 10).toFixed(1),
      spo2: 94 + ((patientIndex + consultationIndex) % 6),
      respRate: 16 + ((patientIndex + consultationIndex) % 9),
    }] : [],
  };
}

function eventSummary(item: ForeignFeedEvent, includeDetails: boolean): ForeignFeedEvent | Omit<ForeignFeedEvent, "clinical"> {
  if (includeDetails) return item;
  const { clinical: _clinical, ...summaryEvent } = item;
  return summaryEvent;
}

function summary(searchParams = new URLSearchParams()) {
  const items = queue();
  const includeDetails = searchParams.get("include") === "details" || searchParams.get("detail") === "full";
  const status = searchParams.get("status") ?? "all";
  const cursor = Math.max(0, Math.floor(Number(searchParams.get("cursor") ?? searchParams.get("offset") ?? 0) || 0));
  const limit = Math.max(1, Math.min(1000, Math.floor(Number(searchParams.get("limit") ?? (includeDetails ? 250 : 100)) || 100)));
  const combined = (status === "ready" ? items.filter((item) => item.status === "ready") : status === "pending" ? items.filter((item) => item.status === "pending") : items)
    .slice()
    .sort((a, b) => Date.parse(b.receivedAt) - Date.parse(a.receivedAt));
  const pageEvents = combined.slice(cursor, cursor + limit).map((item) => eventSummary(item, includeDetails));
  const readyCount = items.filter((item) => item.status === "ready").length;
  const pendingCount = items.filter((item) => item.status === "pending").length;
  return {
    total: items.length,
    filteredTotal: combined.length,
    ready: readyCount,
    pending: pendingCount,
    sourcePatients: FOREIGN_PATIENTS.length,
    sourceConsultations: FOREIGN_CONSULTATION_COUNT,
    patientCount: new Set(items.map((item) => item.patientStatId)).size,
    latestEpisodeSequence: items.at(-1)?.episodeSequence ?? 0,
    page: { cursor, limit, returned: pageEvents.length, nextCursor: cursor + pageEvents.length < combined.length ? cursor + pageEvents.length : null },
    readyEvents: status === "pending" ? [] : pageEvents.filter((item) => item.status === "ready"),
    pendingEvents: status === "ready" ? [] : pageEvents.filter((item) => item.status === "pending"),
    updatedAt: new Date().toISOString(),
  };
}

export async function GET(request: NextRequest) {
  return NextResponse.json(summary(request.nextUrl.searchParams), { headers: corsHeaders() });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({})) as { amount?: number };
  const amount = Math.max(1, Math.min(5000, Math.floor(Number(body.amount) || 25)));
  const items = queue();
  const now = Date.now();
  for (let index = 0; index < amount; index += 1) {
    const sequence = items.length;
    const patientIndex = Math.floor(sequence / 50) % FOREIGN_PATIENTS.length;
    const patient = FOREIGN_PATIENTS[patientIndex];
    const consultationIndex = sequence % patient.consultations.length;
    const consultation = patient.consultations[consultationIndex];
    items.push({
      episodeId: `${consultation.id}-${items.length + 1}`,
      patientStatId: `FOREIGN-STAT-${(patientIndex + 1).toString().padStart(6, "0")}`,
      episodeSequence: items.length + 1,
      facilityId: consultation.facilityId,
      diagnosis: consultation.diagnosis,
      icd10Code: consultation.icd10Code,
      diseaseCode: diseaseCodeFromIcd(consultation.icd10Code),
      status: "ready",
      receivedAt: new Date(now + index * 300).toISOString(),
      openedAt: `${consultation.date}T10:00:00Z`,
      closedAt: `${consultation.date}T10:55:00Z`,
      pendingUntil: null,
      sectionCount: consultation.sectionCount,
      hasVitals: consultation.hasVitals,
      origin: "foreign",
      ageBand: patient.ageBand,
      gender: patient.gender,
      clinical: clinicalFor(consultation, patientIndex, consultationIndex),
    });
  }
  if (items.length > 50000) items.splice(0, items.length - 50000);
  return NextResponse.json({ accepted: amount, acceptedCount: amount, ...summary() }, { headers: corsHeaders() });
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
