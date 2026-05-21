/**
 * POST /api/vinavi/ingest
 *
 * Receives a completed or in-progress consultation from the Vinavi portal.
 * Blank episodes (no diagnosis, no section content, still active) are held in
 * a 20-minute pending window before they appear in surveillance analytics.
 *
 * PATCH /api/vinavi/ingest
 *
 * Updates an existing episode (e.g. doctor finished writing). Clears the
 * pending hold if the updated payload is no longer blank.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  upsertConsultation,
  upsertConsultations,
  getReadyConsultations,
  getPendingConsultations,
  latestEpisodeSequence,
  maxStoreSize,
  patientCount,
  storeSize,
  type PendingConsultation,
  type VinaviConsultationPayload,
} from "@/lib/consultation-store";

export const runtime = "nodejs";
const MAX_BATCH_SIZE = 5000;

function validatePayload(body: unknown): { ok: true; payload: VinaviConsultationPayload } | { ok: false; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Request body must be a JSON object." };
  }
  const b = body as Record<string, unknown>;
  if (typeof b.episodeId !== "string" || !b.episodeId.trim()) return { ok: false, error: "Missing required field: episodeId" };
  if (typeof b.patientId !== "string" || !b.patientId.trim()) return { ok: false, error: "Missing required field: patientId" };
  if (typeof b.facilityId !== "string" || !b.facilityId.trim()) return { ok: false, error: "Missing required field: facilityId" };
  if (typeof b.openedAt !== "string" || !b.openedAt.trim()) return { ok: false, error: "Missing required field: openedAt" };
  if (b.status !== "active" && b.status !== "closed") return { ok: false, error: "status must be 'active' or 'closed'" };
  if (!Array.isArray(b.sections)) return { ok: false, error: "sections must be an array" };

  // Input-sanitise string fields to prevent stored XSS
  const clean = (value: unknown, maxLen = 500): string =>
    typeof value === "string" ? value.slice(0, maxLen).replace(/[<>"'`]/g, "") : "";

  const payload: VinaviConsultationPayload = {
    episodeId: clean(b.episodeId, 128),
    patientId: clean(b.patientId, 128),
    patientNationalId: b.patientNationalId ? clean(b.patientNationalId, 64) : undefined,
    patientAge: typeof b.patientAge === "number" && b.patientAge >= 0 && b.patientAge <= 130 ? Math.floor(b.patientAge) : undefined,
    patientGender: b.patientGender === "Male" || b.patientGender === "Female" ? b.patientGender : undefined,
    patientAtoll: b.patientAtoll ? clean(b.patientAtoll, 64) : undefined,
    patientIsland: b.patientIsland ? clean(b.patientIsland, 64) : undefined,
    facilityId: clean(b.facilityId, 64),
    doctorName: clean(b.doctorName ?? "", 256),
    specialty: clean(b.specialty ?? "", 128),
    openedAt: clean(b.openedAt, 64),
    closedAt: b.closedAt ? clean(b.closedAt as string, 64) : null,
    status: b.status as "active" | "closed",
    diagnosis: clean(b.diagnosis ?? "", 512),
    icd10Code: b.icd10Code ? clean(b.icd10Code as string, 16) : undefined,
    sections: (b.sections as unknown[]).slice(0, 50).map((s) => {
      const sec = (typeof s === "object" && s !== null ? s : {}) as Record<string, unknown>;
      return {
        type: clean(sec.type ?? "", 64),
        content: clean(sec.content ?? "", 8000),
        createdAt: clean(sec.createdAt ?? "", 64),
      };
    }),
    vitals: Array.isArray(b.vitals)
      ? (b.vitals as unknown[]).slice(0, 100).map((v) => {
          const vit = (typeof v === "object" && v !== null ? v : {}) as Record<string, unknown>;
          return {
            timestamp: clean(vit.timestamp ?? "", 64),
            bp: vit.bp ? clean(vit.bp as string, 16) : undefined,
            heartRate: typeof vit.heartRate === "number" ? Math.max(0, Math.min(300, vit.heartRate)) : undefined,
            temp: typeof vit.temp === "number" ? Math.max(30, Math.min(45, vit.temp)) : undefined,
            spo2: typeof vit.spo2 === "number" ? Math.max(0, Math.min(100, vit.spo2)) : undefined,
            respRate: typeof vit.respRate === "number" ? Math.max(0, Math.min(80, vit.respRate)) : undefined,
          };
        })
      : undefined,
    origin: b.origin === "local" || b.origin === "foreign" ? b.origin : undefined,
  };

  return { ok: true, payload };
}

function validatePayloadList(body: unknown): { ok: true; payloads: VinaviConsultationPayload[] } | { ok: false; error: string } {
  const candidate = body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : null;
  const list = Array.isArray(body) ? body : Array.isArray(candidate?.records) ? candidate.records : Array.isArray(candidate?.consultations) ? candidate.consultations : null;
  if (!list) {
    const single = validatePayload(body);
    return single.ok ? { ok: true, payloads: [single.payload] } : { ok: false, error: single.error };
  }
  if (list.length === 0) return { ok: false, error: "Batch must contain at least one consultation." };
  if (list.length > MAX_BATCH_SIZE) return { ok: false, error: `Batch too large. Send at most ${MAX_BATCH_SIZE} consultations per request.` };
  const payloads: VinaviConsultationPayload[] = [];
  for (let index = 0; index < list.length; index += 1) {
    const validation = validatePayload(list[index]);
    if (!validation.ok) return { ok: false, error: `records[${index}]: ${validation.error}` };
    payloads.push(validation.payload);
  }
  return { ok: true, payloads };
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400, headers: corsHeaders() });
  }

  const validation = validatePayloadList(body);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 422, headers: corsHeaders() });
  }

  const records = upsertConsultations(validation.payloads);
  const ready = records.filter((record) => !record.pendingUntil).length;
  const pending = records.length - ready;

  return NextResponse.json({
    ok: true,
    accepted: records.length,
    acceptedCount: records.length,
    ready,
    pending,
    firstEpisodeId: records[0]?.payload.episodeId ?? null,
    lastEpisodeId: records.at(-1)?.payload.episodeId ?? null,
    firstEpisodeSequence: records[0]?.episodeSequence ?? null,
    lastEpisodeSequence: records.at(-1)?.episodeSequence ?? null,
    storeSize: storeSize(),
    maxStoreSize: maxStoreSize(),
    patientCount: patientCount(),
    message: `${records.length} consultation${records.length === 1 ? "" : "s"} accepted for surveillance intake.`,
  }, { status: 201, headers: corsHeaders() });
}

export async function PATCH(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400, headers: corsHeaders() });
  }

  const validation = validatePayload(body);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 422, headers: corsHeaders() });
  }

  const record = upsertConsultation(validation.payload);
  const status = record.pendingUntil ? "pending" : "ready";

  return NextResponse.json({
    updated: true,
    episodeId: record.payload.episodeId,
    patientStatId: record.patientStatId,
    episodeSequence: record.episodeSequence,
    status,
    pendingUntil: record.pendingUntil ?? null,
  }, { headers: corsHeaders() });
}

function ageBand(age?: number) {
  if (typeof age !== "number") return "unknown";
  if (age < 5) return "0-4";
  if (age < 10) return "5-9";
  if (age < 20) return "10-19";
  if (age < 30) return "20-29";
  if (age < 40) return "30-39";
  if (age < 50) return "40-49";
  if (age < 60) return "50-59";
  if (age < 70) return "60-69";
  return "70+";
}

function diseaseCodeFromIcd(icd10?: string | null) {
  const code = (icd10 ?? "").toUpperCase();
  if (code.startsWith("A90")) return "dengue";
  if (code.startsWith("A09") || code.startsWith("K52")) return "gastro";
  if (code.startsWith("J10")) return "influenza";
  if (code.startsWith("J11")) return "ili";
  if (code.startsWith("J18")) return "pneumonia";
  if (code.startsWith("B08.4")) return "hfmd";
  if (code.startsWith("R07")) return "chest_pain";
  if (code.startsWith("E86")) return "dehydration";
  if (code.startsWith("R56.0")) return "febrile_seizure";
  return null;
}

function sectionContent(payload: VinaviConsultationPayload, type: string) {
  return payload.sections.filter((section) => section.type === type && section.content.trim()).map((section) => ({ content: section.content, createdAt: section.createdAt }));
}

function toSafeEvent(record: PendingConsultation, status: "ready" | "pending", includeDetails = false) {
  const payload = record.payload;
  const base = {
    episodeId: payload.episodeId,
    patientStatId: record.patientStatId,
    episodeSequence: record.episodeSequence,
    facilityId: payload.facilityId,
    diagnosis: payload.diagnosis?.trim() || null,
    icd10Code: payload.icd10Code ?? null,
    diseaseCode: diseaseCodeFromIcd(payload.icd10Code),
    status,
    receivedAt: record.receivedAt,
    openedAt: payload.openedAt,
    closedAt: payload.closedAt ?? null,
    pendingUntil: status === "pending" ? record.pendingUntil : null,
    sectionCount: payload.sections.filter((section) => section.content.trim()).length,
    hasVitals: Boolean(payload.vitals?.length),
    origin: payload.origin ?? "local",
    ageBand: ageBand(payload.patientAge),
    gender: payload.patientGender ?? null,
    atoll: payload.patientAtoll ?? null,
  };
  if (!includeDetails) return base;
  return {
    ...base,
    clinical: {
      complaints: sectionContent(payload, "complaint"),
      advice: sectionContent(payload, "advice"),
      prescriptions: sectionContent(payload, "prescription"),
      services: sectionContent(payload, "service"),
      vitals: payload.vitals ?? [],
    },
  };
}

/** GET /api/vinavi/ingest — returns non-sensitive API sync summary and event tokens */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const includeDetails = searchParams.get("include") === "details" || searchParams.get("detail") === "full";
  const status = searchParams.get("status") ?? "all";
  const cursor = Math.max(0, Math.floor(Number(searchParams.get("cursor") ?? searchParams.get("offset") ?? 0) || 0));
  const limit = Math.max(1, Math.min(1000, Math.floor(Number(searchParams.get("limit") ?? (includeDetails ? 250 : 100)) || 100)));
  const requestedPatientStatId = searchParams.get("patientStatId");
  const ready = getReadyConsultations().filter((record) => !requestedPatientStatId || record.patientStatId === requestedPatientStatId);
  const pending = getPendingConsultations().filter((record) => !requestedPatientStatId || record.patientStatId === requestedPatientStatId);
  const combined = (status === "ready" ? ready : status === "pending" ? pending : [...ready, ...pending])
    .sort((a, b) => Date.parse(b.receivedAt) - Date.parse(a.receivedAt));
  const page = combined.slice(cursor, cursor + limit);
  const pageEvents = page.map((record) => toSafeEvent(record, record.pendingUntil ? "pending" : "ready", includeDetails));
  return NextResponse.json({
    total: storeSize(),
    filteredTotal: combined.length,
    maxStoreSize: maxStoreSize(),
    patientCount: patientCount(),
    latestEpisodeSequence: latestEpisodeSequence(),
    ready: ready.length,
    pending: pending.length,
    page: { cursor, limit, returned: pageEvents.length, nextCursor: cursor + pageEvents.length < combined.length ? cursor + pageEvents.length : null },
    readyEvents: status === "pending" ? [] : pageEvents.filter((event) => event.status === "ready"),
    pendingEvents: status === "ready" ? [] : pageEvents.filter((event) => event.status === "pending"),
    updatedAt: new Date().toISOString(),
  }, { headers: corsHeaders() });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
