/**
 * consultation-store.ts
 *
 * Module-level singleton that holds consultations received from the Vinavi
 * portal via POST /api/vinavi/ingest.
 *
 * Blank episodes (no diagnosis, no section content, still active) are held in
 * a "pending" state for 20 minutes from their openedAt timestamp. When Vinavi
 * re-sends the same episodeId with content, the record is updated and released.
 *
 * NOTE: This is a bounded in-memory store for the hackathon demo. Data is lost
 * on server restart. For high-volume production use, keep this API contract and
 * replace the Map with PostgreSQL/Redis/queue storage.
 */

export interface VinaviConsultationPayload {
  episodeId: string;
  patientId: string;
  patientNationalId?: string;
  patientAge?: number;
  patientGender?: "Male" | "Female";
  patientAtoll?: string;
  patientIsland?: string;
  facilityId: string;
  doctorName: string;
  specialty: string;
  openedAt: string;          // ISO timestamp
  closedAt?: string | null;  // null = episode still active
  status: "active" | "closed";
  diagnosis: string;
  icd10Code?: string;
  sections: Array<{ type: string; content: string; createdAt: string }>;
  vitals?: Array<{ timestamp: string; bp?: string; heartRate?: number; temp?: number; spo2?: number; respRate?: number }>;
  origin?: "local" | "foreign";
}

export interface PendingConsultation {
  payload: VinaviConsultationPayload;
  receivedAt: string;
  patientStatId: string;
  episodeSequence: number;
  pendingUntil: string | null;  // null = immediately visible in analytics
  processed: boolean;
}

const BLANK_HOLD_MS = 20 * 60 * 1000; // 20 minutes
const MAX_IN_MEMORY_CONSULTATIONS = Math.max(1000, Number(process.env.MV_AIHA_MAX_IN_MEMORY_CONSULTATIONS ?? 50000));

/** Module-level singleton — persists for the lifetime of the Node.js process. */
const store = new Map<string, PendingConsultation>();
const insertionOrder: string[] = [];
const patientStatIds = new Map<string, string>();
let nextPatientStatNumber = 1;
let nextEpisodeSequence = 1;

function patientSourceKey(payload: VinaviConsultationPayload) {
  return `${payload.origin ?? "local"}:${payload.patientId || payload.patientNationalId || "unknown"}`;
}

function getPatientStatId(payload: VinaviConsultationPayload) {
  const key = patientSourceKey(payload);
  const existing = patientStatIds.get(key);
  if (existing) return existing;
  const next = `STAT-${nextPatientStatNumber.toString().padStart(6, "0")}`;
  nextPatientStatNumber += 1;
  patientStatIds.set(key, next);
  return next;
}

function rememberKey(key: string) {
  if (!store.has(key)) insertionOrder.push(key);
}

function enforceBoundedStore() {
  while (store.size > MAX_IN_MEMORY_CONSULTATIONS) {
    const oldest = insertionOrder.shift();
    if (!oldest) return;
    store.delete(oldest);
  }
}

/** Determine whether a payload is a blank (placeholder) episode. */
function isBlankEpisode(payload: VinaviConsultationPayload): boolean {
  const noDiagnosis = !payload.diagnosis || payload.diagnosis.trim() === "";
  const noContent = payload.sections.length === 0 || payload.sections.every((s) => !s.content?.trim());
  const stillActive = payload.status === "active" && !payload.closedAt;
  return noDiagnosis && noContent && stillActive;
}

/**
 * Upsert a consultation.
 * - New blank episode → held pending for 20 minutes.
 * - Updated episode with content → pendingUntil cleared immediately.
 * - Existing non-blank record → updated in place.
 */
export function upsertConsultation(payload: VinaviConsultationPayload): PendingConsultation {
  const existing = store.get(payload.episodeId);
  const now = new Date().toISOString();
  const blank = isBlankEpisode(payload);

  if (existing) {
    // Update existing record
    const pendingUntil = blank
      ? existing.pendingUntil  // keep existing hold if still blank
      : null;                  // clear hold once content arrives
    const updated: PendingConsultation = {
      payload,
      receivedAt: existing.receivedAt,
      patientStatId: existing.patientStatId,
      episodeSequence: existing.episodeSequence,
      pendingUntil,
      processed: !blank,
    };
    store.set(payload.episodeId, updated);
    return updated;
  }

  // New record
  let pendingUntil: string | null = null;
  if (blank) {
    const openedMs = Date.parse(payload.openedAt);
    const releaseMs = (isNaN(openedMs) ? Date.now() : openedMs) + BLANK_HOLD_MS;
    pendingUntil = new Date(releaseMs).toISOString();
  }

  const record: PendingConsultation = {
    payload,
    receivedAt: now,
    patientStatId: getPatientStatId(payload),
    episodeSequence: nextEpisodeSequence,
    pendingUntil,
    processed: !blank,
  };
  nextEpisodeSequence += 1;
  rememberKey(payload.episodeId);
  store.set(payload.episodeId, record);
  enforceBoundedStore();
  return record;
}

export function upsertConsultations(payloads: VinaviConsultationPayload[]): PendingConsultation[] {
  return payloads.map((payload) => upsertConsultation(payload));
}

export function maxStoreSize(): number {
  return MAX_IN_MEMORY_CONSULTATIONS;
}

export function patientCount(): number {
  return patientStatIds.size;
}

export function latestEpisodeSequence(): number {
  return nextEpisodeSequence - 1;
}

/** Returns all consultations that are past their hold window (or were never held). */
export function getReadyConsultations(): PendingConsultation[] {
  const now = Date.now();
  return Array.from(store.values()).filter((c) => {
    if (!c.pendingUntil) return true;
    return Date.parse(c.pendingUntil) <= now;
  });
}

/** Returns every consultation regardless of pending status (for debugging / admin). */
export function getAllConsultations(): PendingConsultation[] {
  return Array.from(store.values());
}

/** Returns just the pending (still-blank) consultations. */
export function getPendingConsultations(): PendingConsultation[] {
  const now = Date.now();
  return Array.from(store.values()).filter((c) => {
    if (!c.pendingUntil) return false;
    return Date.parse(c.pendingUntil) > now;
  });
}

export function getConsultation(episodeId: string): PendingConsultation | undefined {
  return store.get(episodeId);
}

export function storeSize(): number {
  return store.size;
}
