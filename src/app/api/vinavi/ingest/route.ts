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
  getReadyConsultations,
  getPendingConsultations,
  storeSize,
  type VinaviConsultationPayload,
} from "@/lib/consultation-store";

export const runtime = "nodejs";

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
          };
        })
      : undefined,
    origin: b.origin === "local" || b.origin === "foreign" ? b.origin : undefined,
  };

  return { ok: true, payload };
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = validatePayload(body);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 422 });
  }

  const record = upsertConsultation(validation.payload);
  const status = record.pendingUntil ? "pending" : "ready";

  return NextResponse.json({
    accepted: true,
    episodeId: record.payload.episodeId,
    status,
    pendingUntil: record.pendingUntil ?? null,
    message: status === "pending"
      ? `Episode held pending until ${record.pendingUntil} (blank episode grace period). Re-POST with content to release early.`
      : "Episode accepted and ready for surveillance analytics.",
  }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = validatePayload(body);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 422 });
  }

  const record = upsertConsultation(validation.payload);
  const status = record.pendingUntil ? "pending" : "ready";

  return NextResponse.json({
    updated: true,
    episodeId: record.payload.episodeId,
    status,
    pendingUntil: record.pendingUntil ?? null,
  });
}

/** GET /api/vinavi/ingest — returns store summary (non-sensitive) */
export async function GET() {
  return NextResponse.json({
    total: storeSize(),
    ready: getReadyConsultations().length,
    pending: getPendingConsultations().length,
  });
}
