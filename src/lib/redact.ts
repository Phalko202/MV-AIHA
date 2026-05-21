/* ------------------------------------------------------------------ */
/*  PHI / PII REDACTION                                                */
/* ------------------------------------------------------------------ */
/*  All patient episodes MUST pass through redactPatientEpisode()      */
/*  before they leave the MV-AIHA perimeter for any third-party AI     */
/*  model (OpenRouter, etc.). The function:                            */
/*    - Drops direct identifiers (name, address, phone, IDs, DOB)      */
/*    - Converts dateOfBirth → ageYears, then deletes dateOfBirth      */
/*    - Sweeps clinician free-text for common identifier patterns       */
/*    - Returns an audit record (removedFields + sha256 hash of raw)   */
/* ------------------------------------------------------------------ */

import { createHash } from "crypto";

const DIRECT_IDENTIFIER_FIELDS = [
  "name",
  "nameDhivehi",
  "fullName",
  "givenName",
  "familyName",
  "address",
  "street",
  "houseName",
  "postalCode",
  "idCard",
  "nationalId",
  "passport",
  "passportNumber",
  "permitNumber",
  "workPermit",
  "phone",
  "phoneNumber",
  "mobile",
  "email",
  "nextOfKin",
  "guardianName",
  "guardianPhone",
  "emergencyContact",
  "emergencyContactPhone",
  "hospitalNumber",
  "mrn",
  "patientName",
];

const DOB_FIELDS = ["dateOfBirth", "dob", "birthDate", "birthday"];

const COHORT_KEEP: Record<string, "local" | "foreign"> = {
  Maldivian: "local",
  maldivian: "local",
  Local: "local",
  local: "local",
  Foreign: "foreign",
  foreign: "foreign",
  Expatriate: "foreign",
  expatriate: "foreign",
};

export interface RedactionAudit {
  removedFields: string[];
  redactedTextSpans: number;
  sourceHash: string;
  redactedAt: string;
}

export interface RedactedEpisode {
  ageYears?: number;
  gender?: string;
  cohort?: "local" | "foreign";
  atoll?: string;
  facilityId?: string;
  facilityType?: string;
  onsetDate?: string;
  admissionDate?: string;
  episodeRef?: string; // synthetic short token, not the real ID
  diagnosis?: string;
  symptoms?: unknown;
  vitals?: unknown;
  prescriptions?: unknown;
  clinicianNotes?: string;
  source?: string;
  severity?: string;
  outcome?: string;
  [key: string]: unknown;
}

export interface RedactionResult {
  redacted: RedactedEpisode;
  audit: RedactionAudit;
}

function calcAgeYears(dob: string): number | undefined {
  const ts = Date.parse(dob);
  if (Number.isNaN(ts)) return undefined;
  const diffMs = Date.now() - ts;
  if (diffMs < 0) return undefined;
  return Math.floor(diffMs / (365.25 * 24 * 60 * 60 * 1000));
}

/**
 * Redact identifier-shaped substrings out of clinician free text.
 * Returns the cleaned string and number of redactions performed.
 */
function redactFreeText(text: string): { text: string; spans: number } {
  if (!text || typeof text !== "string") return { text: text ?? "", spans: 0 };
  let spans = 0;
  let cleaned = text;

  // Maldivian national ID: A + 6-9 digits
  cleaned = cleaned.replace(/\b[Aa]\d{6,9}\b/g, () => { spans++; return "[REDACTED_ID]"; });

  // Passport-like: 1-2 letters + 5-9 digits
  cleaned = cleaned.replace(/\b[A-Z]{1,2}\d{5,9}\b/g, () => { spans++; return "[REDACTED_ID]"; });

  // Phone numbers (Maldives +960 or 7/9 digit local)
  cleaned = cleaned.replace(/\+?960[-\s]?\d{3}[-\s]?\d{4}/g, () => { spans++; return "[REDACTED_PHONE]"; });
  cleaned = cleaned.replace(/\b\d{7}\b/g, () => { spans++; return "[REDACTED_PHONE]"; });

  // Email
  cleaned = cleaned.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, () => { spans++; return "[REDACTED_EMAIL]"; });

  // Dates of birth-like ISO dates near "DOB"/"born"
  cleaned = cleaned.replace(/\b(DOB|D\.O\.B\.?|born)[:\s]+\d{1,4}[-/]\d{1,2}[-/]\d{1,4}/gi, () => { spans++; return "[REDACTED_DOB]"; });

  // "Mr./Mrs./Ms./Dr. Firstname Lastname" patterns (very simple — keep Dr. titles but strip the personal name)
  cleaned = cleaned.replace(/\b(Mr|Mrs|Ms|Mx)\.?\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3}/g, () => { spans++; return "[REDACTED_NAME]"; });

  return { text: cleaned, spans };
}

function bucketCohort(value: unknown): "local" | "foreign" | undefined {
  if (typeof value !== "string") return undefined;
  if (COHORT_KEEP[value]) return COHORT_KEEP[value];
  // anything else with passport/foreign hint
  if (/foreign|expat|tourist|passport/i.test(value)) return "foreign";
  if (/maldiv|local|resident/i.test(value)) return "local";
  return undefined;
}

/**
 * Strip patient PHI from an episode object before sending to any external
 * model. Keeps clinical signal + age (years) + gender + cohort + atoll.
 */
export function redactPatientEpisode(episode: Record<string, unknown>): RedactionResult {
  const removed: string[] = [];
  const out: RedactedEpisode = {};
  let textSpans = 0;

  // SHA-256 of the raw input for audit chain (does NOT leave the server)
  const sourceHash = createHash("sha256")
    .update(JSON.stringify(episode))
    .digest("hex")
    .slice(0, 32);

  // 1. Direct identifiers — drop entirely
  for (const field of DIRECT_IDENTIFIER_FIELDS) {
    if (field in episode) removed.push(field);
  }

  // 2. DOB → ageYears
  for (const dobField of DOB_FIELDS) {
    if (dobField in episode) {
      const age = calcAgeYears(String(episode[dobField] ?? ""));
      if (age !== undefined && out.ageYears === undefined) out.ageYears = age;
      removed.push(dobField);
    }
  }
  // If an explicit ageYears/age is already present, prefer it but cap at sane range
  if (typeof episode.ageYears === "number") out.ageYears = Math.max(0, Math.min(120, episode.ageYears));
  else if (typeof episode.age === "number" && out.ageYears === undefined) out.ageYears = Math.max(0, Math.min(120, episode.age));

  // 3. Gender — keep (per user spec)
  if (typeof episode.gender === "string") out.gender = episode.gender;

  // 4. Nationality/origin → coarse cohort only
  const cohort = bucketCohort(episode.nationality) ?? bucketCohort(episode.origin);
  if (cohort) out.cohort = cohort;

  // 5. Clinical signal — keep
  const passthrough = [
    "atoll", "facilityId", "facilityType", "onsetDate", "admissionDate",
    "diagnosis", "diseaseCode", "icd10", "symptoms", "vitals", "prescriptions",
    "severity", "outcome", "source", "aiConfidence",
  ];
  for (const key of passthrough) {
    if (episode[key] !== undefined && episode[key] !== null) out[key] = episode[key];
  }

  // 6. Episode ID — replace with synthetic short token (last 6 chars hashed)
  if (typeof episode.id === "string" || typeof episode.episodeId === "string") {
    const rawRef = String(episode.episodeId ?? episode.id);
    out.episodeRef = createHash("sha256").update(rawRef).digest("hex").slice(0, 8).toUpperCase();
    if ("id" in episode && episode.id !== out.episodeRef) removed.push("id");
    if ("episodeId" in episode) removed.push("episodeId");
  }

  // 7. Clinician notes — sweep free text
  if (typeof episode.clinicianNotes === "string") {
    const swept = redactFreeText(episode.clinicianNotes);
    out.clinicianNotes = swept.text;
    textSpans += swept.spans;
  }
  // Walk nested sections array for chief-complaint style entries
  if (Array.isArray(episode.sections)) {
    out.symptoms = (episode.sections as Array<{ type?: string; content?: string }>).map((section) => {
      if (typeof section?.content === "string") {
        const swept = redactFreeText(section.content);
        textSpans += swept.spans;
        return { type: section.type, content: swept.text };
      }
      return { type: section?.type };
    });
  }

  return {
    redacted: out,
    audit: {
      removedFields: Array.from(new Set(removed)),
      redactedTextSpans: textSpans,
      sourceHash,
      redactedAt: new Date().toISOString(),
    },
  };
}

/**
 * Final guard: asserts the payload is safe to send to a third-party model.
 * Throws if any forbidden field slipped through. Use immediately before
 * the network call.
 */
export function assertRedacted(payload: unknown): void {
  if (!payload || typeof payload !== "object") throw new Error("Redaction guard: payload is not an object");
  const obj = payload as Record<string, unknown>;
  const forbidden = [...DIRECT_IDENTIFIER_FIELDS, ...DOB_FIELDS];
  for (const field of forbidden) {
    if (field in obj) {
      throw new Error(`Redaction guard rejected payload — forbidden field '${field}' present.`);
    }
  }
}
