/* ------------------------------------------------------------------ */
/*  OPENROUTER CLIENT + GUARDED SURVEILLANCE PIPELINE                  */
/* ------------------------------------------------------------------ */
/*  Reads OPENROUTER_API_KEY from .env.local. Never logs the           */
/*  unredacted payload. Supports:                                      */
/*    1. Per-episode ensemble review                                   */
/*    2. Three-stage surveillance batch analysis                       */
/*  Both flows enforce destructive purge, negative prompting, and      */
/*  post-inference privacy verification before any output is used.     */
/* ------------------------------------------------------------------ */

import { assertRedacted, type RedactedEpisode } from "@/lib/redact";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const EPISODE_CALL_TIMEOUT_MS = 18_000;
const PIPELINE_CALL_TIMEOUT_MS = 45_000;

/**
 * Episode-review models. Override at runtime with MV_AIHA_MODELS.
 */
export const MEDICAL_MODELS: string[] = (
  process.env.MV_AIHA_MODELS ??
  [
    "deepseek/deepseek-v4-flash:free",
    "nvidia/nemotron-3-super-120b-a12b:free",
    "openai/gpt-oss-120b:free",
  ].join(",")
).split(",").map((value) => value.trim()).filter(Boolean);

/**
 * Dedicated surveillance-pipeline stage models.
 */
export const SURVEILLANCE_PIPELINE_MODELS = {
  ingestionBuffer: process.env.MV_AIHA_INGEST_MODEL ?? "deepseek/deepseek-v4-flash:free",
  analyticalSynthesizer: process.env.MV_AIHA_SYNTH_MODEL ?? "nvidia/nemotron-3-super-120b-a12b:free",
  strategicBriefing: process.env.MV_AIHA_BRIEF_MODEL ?? "openai/gpt-oss-120b:free",
} as const;

function uniqueModels(values: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values.map((item) => item.trim()).filter(Boolean)) {
    if (seen.has(value)) continue;
    seen.add(value);
    output.push(value);
  }
  return output;
}

const SURVEILLANCE_PIPELINE_MODEL_CHAINS = {
  ingestionBuffer: uniqueModels([
    SURVEILLANCE_PIPELINE_MODELS.ingestionBuffer,
    SURVEILLANCE_PIPELINE_MODELS.analyticalSynthesizer,
    SURVEILLANCE_PIPELINE_MODELS.strategicBriefing,
  ]),
  analyticalSynthesizer: uniqueModels([
    SURVEILLANCE_PIPELINE_MODELS.analyticalSynthesizer,
    SURVEILLANCE_PIPELINE_MODELS.strategicBriefing,
    SURVEILLANCE_PIPELINE_MODELS.ingestionBuffer,
  ]),
  strategicBriefing: uniqueModels([
    SURVEILLANCE_PIPELINE_MODELS.strategicBriefing,
    SURVEILLANCE_PIPELINE_MODELS.analyticalSynthesizer,
    SURVEILLANCE_PIPELINE_MODELS.ingestionBuffer,
  ]),
} as const;

const COMPLIANCE_DIRECTIVE = `# CRITICAL COMPLIANCE DIRECTIVE: ZERO-PII MANDATE
You are an aggregate data processor. You are structurally forbidden from extracting, reading, or passing any individual identifiers.

If you detect text patterns that look like human names, phone numbers, passport numbers, national identification metrics, or exact addresses:
1. Replace that span with a [REDACTED] token.
2. Never emit patient-level identifiers or free-text identity markers in your output.
3. Summarize strictly with aggregates, regional buckets, facility tiers, symptom clusters, severity bands, and age brackets.`;

const EPISODE_SYSTEM_PROMPT = `You are a Maldives public-health triage assistant operating inside the MV-AIHS strategic stack. You receive a fully de-identified clinical episode.
${COMPLIANCE_DIRECTIVE}
Return STRICT JSON only, with this exact schema:
{"diagnosis": string, "icd10": string, "severity": "mild"|"moderate"|"severe"|"critical", "confidence": number between 0 and 1, "recommendedAction": string}
No prose, no markdown, no code fences. If the evidence is insufficient, set diagnosis to "INSUFFICIENT_DATA" and confidence to 0.`;

const BATCH_IDENTITY_FIELDS = new Set([
  "patient_name",
  "patientname",
  "name",
  "full_name",
  "fullname",
  "national_id",
  "nationalid",
  "id_card",
  "idcard",
  "phone_number",
  "phonenumber",
  "phone",
  "mobile",
  "street_address",
  "streetaddress",
  "address",
  "house_name",
  "housename",
  "mrn",
  "hospital_number",
  "passport",
  "passport_number",
  "passportnumber",
  "email",
]);

const BATCH_DOB_FIELDS = new Set([
  "date_of_birth",
  "dateofbirth",
  "birth_date",
  "birthdate",
  "dob",
  "birthday",
]);

const PRIVACY_PATTERNS: Array<{ type: string; regex: RegExp }> = [
  { type: "national_id", regex: /\b[A-Za-z]\d{6,9}\b/g },
  { type: "phone", regex: /(\+960\s?)?\b[79]\d{6}\b/g },
  { type: "passport", regex: /\b[A-Z]{1,2}\d{5,9}\b/g },
  { type: "email", regex: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g },
];

export interface EnsembleVote {
  model: string;
  diagnosis: string | null;
  confidence: number | null;
  severity: string | null;
  recommendedAction: string | null;
  latencyMs: number;
  error: string | null;
}

export interface EnsembleResult {
  diagnosis: string;
  confidence: number;
  severity: string;
  recommendedAction: string;
  agreement: number;
  votes: EnsembleVote[];
  flaggedForReview: boolean;
  modelCount: number;
}

export interface PrivacyViolation {
  type: string;
}

export interface PurgedBatchSummary {
  recordCount: number;
  removedFieldCount: number;
  removedFields: string[];
  generalizedDobCount: number;
  scrubbedTextSpans: number;
}

export interface IngestionBufferOutput {
  records: Array<Record<string, unknown>>;
  totals: {
    records: number;
    foreign: number;
    critical: number;
    regions: number;
  };
}

export interface AnomalySynthesisOutput {
  alerts: Array<{
    region: string;
    disease: string;
    signal: string;
    summary: string;
    confidence: number;
  }>;
  nationalSummary: string;
  watchRegions: string[];
}

export interface StrategicBriefingOutput {
  briefing: string;
  priorityLevel: "monitor" | "watch" | "critical";
  recommendedActions: string[];
}

export interface SurveillanceBatchAnalysis {
  paused: boolean;
  pipelineModels: string[];
  purgeSummary: PurgedBatchSummary;
  normalized: IngestionBufferOutput | null;
  anomalies: AnomalySynthesisOutput | null;
  briefing: StrategicBriefingOutput | null;
  verification: {
    safe: boolean;
    stages: string[];
  };
  stageMetrics: {
    ingestionMs: number;
    synthesisMs: number;
    briefingMs: number;
  };
}

interface JsonStageResult<T> {
  model: string;
  latencyMs: number;
  parsed: T;
}

function buildUserPrompt(episode: RedactedEpisode): string {
  return `Episode (de-identified):\n${JSON.stringify(episode, null, 2)}\n\nReturn the JSON object now.`;
}

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function majority<T extends string>(values: Array<T | null>): { winner: T | null; count: number } {
  const counts = new Map<string, { count: number; original: T }>();
  for (const value of values) {
    if (!value) continue;
    const key = normalizeKey(value);
    const entry = counts.get(key);
    if (entry) entry.count++;
    else counts.set(key, { count: 1, original: value });
  }
  let winner: T | null = null;
  let count = 0;
  for (const entry of counts.values()) {
    if (entry.count > count) {
      winner = entry.original;
      count = entry.count;
    }
  }
  return { winner, count };
}

function safeParseJson(raw: string): Record<string, unknown> | null {
  if (!raw) return null;
  const stripped = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    return JSON.parse(stripped);
  } catch {
    const objectMatch = stripped.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      try {
        return JSON.parse(objectMatch[0]);
      } catch {
        return null;
      }
    }
    const arrayMatch = stripped.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      try {
        return { data: JSON.parse(arrayMatch[0]) };
      } catch {
        return null;
      }
    }
    return null;
  }
}

function collectPrivacyViolations(aiResponse: string): PrivacyViolation[] {
  const found = new Set<string>();
  for (const pattern of PRIVACY_PATTERNS) {
    pattern.regex.lastIndex = 0;
    if (pattern.regex.test(aiResponse)) found.add(pattern.type);
  }
  return Array.from(found).map((type) => ({ type }));
}

export function verifyOutputSafety(aiJsonResponseString: string): boolean {
  return collectPrivacyViolations(aiJsonResponseString).length === 0;
}

function assertOutputSafety(value: unknown, stage: string): void {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  const violations = collectPrivacyViolations(text);
  if (violations.length > 0) {
    throw new Error(`Privacy guard rejected ${stage} output (${violations.map((item) => item.type).join(", ")}).`);
  }
}

function scrubSensitiveText(text: string): { text: string; spans: number } {
  let spans = 0;
  let cleaned = text;
  cleaned = cleaned.replace(/\b[A-Za-z]\d{6,9}\b/g, () => {
    spans++;
    return "[REDACTED_ID]";
  });
  cleaned = cleaned.replace(/\b[A-Z]{1,2}\d{5,9}\b/g, () => {
    spans++;
    return "[REDACTED_ID]";
  });
  cleaned = cleaned.replace(/(\+960\s?)?\b[79]\d{6}\b/g, () => {
    spans++;
    return "[REDACTED_PHONE]";
  });
  cleaned = cleaned.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, () => {
    spans++;
    return "[REDACTED_EMAIL]";
  });
  cleaned = cleaned.replace(/\b(Mr|Mrs|Ms|Mx)\.?\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3}/g, () => {
    spans++;
    return "[REDACTED_NAME]";
  });
  return { text: cleaned, spans };
}

function ageBracketForDob(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const ts = Date.parse(value);
  if (Number.isNaN(ts)) return undefined;
  const years = Math.max(0, Math.min(120, Math.floor((Date.now() - ts) / (365.25 * 24 * 60 * 60 * 1000))));
  if (years <= 9) return "0-9";
  if (years <= 19) return "10-19";
  if (years <= 29) return "20-29";
  if (years <= 39) return "30-39";
  if (years <= 49) return "40-49";
  if (years <= 59) return "50-59";
  if (years <= 69) return "60-69";
  return "70+";
}

function purgeUnknownValue(value: unknown, summary: { removedFieldCount: number; removedFields: Set<string>; generalizedDobCount: number; scrubbedTextSpans: number }): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => purgeUnknownValue(item, summary));
  }
  if (!value || typeof value !== "object") {
    if (typeof value === "string") {
      const scrubbed = scrubSensitiveText(value);
      summary.scrubbedTextSpans += scrubbed.spans;
      return scrubbed.text;
    }
    return value;
  }

  const source = value as Record<string, unknown>;
  const next: Record<string, unknown> = {};

  for (const [key, entry] of Object.entries(source)) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]+/g, "");
    if (BATCH_IDENTITY_FIELDS.has(normalizedKey)) {
      summary.removedFieldCount++;
      summary.removedFields.add(key);
      continue;
    }
    if (BATCH_DOB_FIELDS.has(normalizedKey)) {
      const bracket = ageBracketForDob(entry);
      if (bracket && next.age_bracket === undefined) next.age_bracket = bracket;
      summary.removedFieldCount++;
      summary.generalizedDobCount++;
      summary.removedFields.add(key);
      continue;
    }
    next[key] = purgeUnknownValue(entry, summary);
  }

  return next;
}

export function destructivePurge(rawLogs: Record<string, unknown>[]): Record<string, unknown>[] {
  return destructivePurgeBatch(rawLogs).sanitized;
}

export function destructivePurgeBatch(rawLogs: Record<string, unknown>[]): { sanitized: Record<string, unknown>[]; summary: PurgedBatchSummary } {
  const summary = {
    removedFieldCount: 0,
    removedFields: new Set<string>(),
    generalizedDobCount: 0,
    scrubbedTextSpans: 0,
  };
  const sanitized = rawLogs.map((row) => purgeUnknownValue(row, summary) as Record<string, unknown>);
  return {
    sanitized,
    summary: {
      recordCount: rawLogs.length,
      removedFieldCount: summary.removedFieldCount,
      removedFields: Array.from(summary.removedFields).sort(),
      generalizedDobCount: summary.generalizedDobCount,
      scrubbedTextSpans: summary.scrubbedTextSpans,
    },
  };
}

async function callOpenRouter(model: string, apiKey: string, systemPrompt: string, userPrompt: string, maxTokens: number, timeoutMs = EPISODE_CALL_TIMEOUT_MS): Promise<{ raw: string; latencyMs: number }> {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": process.env.MV_AIHA_SITE_URL ?? "https://mv-aiha.local",
        "X-Title": "MV-AIHA Surveillance Portal",
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        temperature: 0.15,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`);
    }
    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    return {
      raw: payload.choices?.[0]?.message?.content?.trim() ?? "",
      latencyMs: Date.now() - startedAt,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function callJsonStage<T>(model: string, apiKey: string, systemPrompt: string, userPrompt: string, maxTokens: number, stage: string, timeoutMs = PIPELINE_CALL_TIMEOUT_MS): Promise<JsonStageResult<T>> {
  const { raw, latencyMs } = await callOpenRouter(model, apiKey, systemPrompt, userPrompt, maxTokens, timeoutMs);
  const parsed = safeParseJson(raw);
  if (!parsed) {
    throw new Error(`${stage} returned non-JSON output.`);
  }
  assertOutputSafety(parsed, stage);
  return { model, latencyMs, parsed: parsed as T };
}

async function callJsonStageWithFallback<T>(models: string[], apiKey: string, systemPrompt: string, userPrompt: string, maxTokens: number, stage: string, timeoutMs = PIPELINE_CALL_TIMEOUT_MS): Promise<JsonStageResult<T>> {
  const failures: string[] = [];
  let cumulativeLatencyMs = 0;

  for (const model of models) {
    const startedAt = Date.now();
    try {
      const result = await callJsonStage<T>(model, apiKey, systemPrompt, userPrompt, maxTokens, stage, timeoutMs);
      cumulativeLatencyMs += Date.now() - startedAt;
      return { ...result, latencyMs: cumulativeLatencyMs };
    } catch (error) {
      cumulativeLatencyMs += Date.now() - startedAt;
      failures.push(`${model}: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  throw new Error(`${stage} failed across all fallback models. ${failures.join(" | ")}`);
}

async function callOne(model: string, episode: RedactedEpisode, apiKey: string): Promise<EnsembleVote> {
  const startedAt = Date.now();
  try {
    const { raw } = await callOpenRouter(model, apiKey, EPISODE_SYSTEM_PROMPT, buildUserPrompt(episode), 320, EPISODE_CALL_TIMEOUT_MS);
    const parsed = safeParseJson(raw);
    if (!parsed) {
      return { model, diagnosis: null, confidence: null, severity: null, recommendedAction: null, latencyMs: Date.now() - startedAt, error: "Non-JSON response" };
    }
    assertOutputSafety(parsed, `${model} episode response`);
    return {
      model,
      diagnosis: typeof parsed.diagnosis === "string" ? parsed.diagnosis.trim() : null,
      confidence: typeof parsed.confidence === "number" ? Math.max(0, Math.min(1, parsed.confidence)) : null,
      severity: typeof parsed.severity === "string" ? parsed.severity : null,
      recommendedAction: typeof parsed.recommendedAction === "string" ? parsed.recommendedAction : null,
      latencyMs: Date.now() - startedAt,
      error: null,
    };
  } catch (error) {
    return { model, diagnosis: null, confidence: null, severity: null, recommendedAction: null, latencyMs: Date.now() - startedAt, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/** True when the OpenRouter key is absent or is the placeholder value. */
export function isAiPaused(): boolean {
  const key = process.env.OPENROUTER_API_KEY;
  return !key || key === "your-api-key-here" || key.startsWith("sk-or-placeholder");
}

export async function analyzeEpisodeEnsemble(episode: RedactedEpisode): Promise<EnsembleResult> {
  assertRedacted(episode);
  if (isAiPaused()) {
    return {
      diagnosis: "AI_PAUSED",
      confidence: 0,
      severity: "mild",
      recommendedAction: "AI analysis is paused. Add a valid OPENROUTER_API_KEY to .env.local to enable.",
      agreement: 0,
      votes: [],
      flaggedForReview: true,
      modelCount: 0,
    };
  }
  const apiKey = process.env.OPENROUTER_API_KEY!;
  const votes = await Promise.all(MEDICAL_MODELS.map((model) => callOne(model, episode, apiKey)));
  const successful = votes.filter((vote) => vote.diagnosis && vote.diagnosis !== "INSUFFICIENT_DATA");
  const { winner: diagnosis, count } = majority(successful.map((vote) => vote.diagnosis));
  const { winner: severity } = majority(successful.map((vote) => vote.severity));
  const confidences = successful.map((vote) => vote.confidence).filter((value): value is number => typeof value === "number");
  const avgConfidence = confidences.length ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length : 0;
  const agreement = successful.length ? count / successful.length : 0;
  const recommendedAction = successful.find((vote) => vote.diagnosis && normalizeKey(vote.diagnosis) === normalizeKey(diagnosis ?? ""))?.recommendedAction ?? "Route to manual clinician review.";

  return {
    diagnosis: diagnosis ?? "INSUFFICIENT_DATA",
    confidence: Number((avgConfidence * agreement).toFixed(2)),
    severity: severity ?? "mild",
    recommendedAction,
    agreement: Number(agreement.toFixed(2)),
    votes,
    flaggedForReview: agreement < 0.6 || avgConfidence < 0.55 || successful.length < 2,
    modelCount: votes.length,
  };
}

export async function analyzeSurveillanceBatch(rawLogs: Record<string, unknown>[]): Promise<SurveillanceBatchAnalysis> {
  const { sanitized, summary } = destructivePurgeBatch(rawLogs);
  if (isAiPaused()) {
    return {
      paused: true,
      pipelineModels: [
        SURVEILLANCE_PIPELINE_MODELS.ingestionBuffer,
        SURVEILLANCE_PIPELINE_MODELS.analyticalSynthesizer,
        SURVEILLANCE_PIPELINE_MODELS.strategicBriefing,
      ],
      purgeSummary: summary,
      normalized: null,
      anomalies: null,
      briefing: null,
      verification: { safe: true, stages: ["destructive-purge-only"] },
      stageMetrics: { ingestionMs: 0, synthesisMs: 0, briefingMs: 0 },
    };
  }

  const apiKey = process.env.OPENROUTER_API_KEY!;

  const stage1 = await callJsonStageWithFallback<IngestionBufferOutput>(
    SURVEILLANCE_PIPELINE_MODEL_CHAINS.ingestionBuffer,
    apiKey,
    `You are the Raw Ingestion Buffer for MV-AIHS. ${COMPLIANCE_DIRECTIVE}\nReturn STRICT JSON only with this schema:\n{"records": Array<object>, "totals": {"records": number, "foreign": number, "critical": number, "regions": number}}\nNormalize keys, keep only surveillance-relevant fields, and preserve only aggregate-safe values.`,
    `Purged 12-hour clinic sync payload:\n${JSON.stringify(sanitized, null, 2)}\n\nReturn the normalized JSON now.`,
    1200,
    "raw ingestion buffer",
  );

  const stage2 = await callJsonStageWithFallback<AnomalySynthesisOutput>(
    SURVEILLANCE_PIPELINE_MODEL_CHAINS.analyticalSynthesizer,
    apiKey,
    `You are the Analytical Synthesizer for MV-AIHS. ${COMPLIANCE_DIRECTIVE}\nReturn STRICT JSON only with this schema:\n{"alerts": [{"region": string, "disease": string, "signal": string, "summary": string, "confidence": number}], "nationalSummary": string, "watchRegions": string[]}\nCross-reference the normalized records against implied national baselines and flag exact regional outbreak spikes.`,
    `Normalized surveillance data:\n${JSON.stringify(stage1.parsed, null, 2)}\n\nReturn the anomaly synthesis JSON now.`,
    900,
    "analytical synthesizer",
  );

  const stage3 = await callJsonStageWithFallback<StrategicBriefingOutput>(
    SURVEILLANCE_PIPELINE_MODEL_CHAINS.strategicBriefing,
    apiKey,
    `You are the Strategic Briefing Engine for MV-AIHS. ${COMPLIANCE_DIRECTIVE}\nReturn STRICT JSON only with this schema:\n{"briefing": string, "priorityLevel": "monitor"|"watch"|"critical", "recommendedActions": string[]}\nThe briefing must be authoritative, tactical, and no more than two sentences.`,
    `Anomaly synthesis:\n${JSON.stringify(stage2.parsed, null, 2)}\n\nReturn the executive briefing JSON now.`,
    320,
    "strategic briefing engine",
  );

  return {
    paused: false,
    pipelineModels: [stage1.model, stage2.model, stage3.model],
    purgeSummary: summary,
    normalized: stage1.parsed,
    anomalies: stage2.parsed,
    briefing: stage3.parsed,
    verification: {
      safe: true,
      stages: ["destructive-purge", "negative-prompting", "post-inference-verification"],
    },
    stageMetrics: {
      ingestionMs: stage1.latencyMs,
      synthesisMs: stage2.latencyMs,
      briefingMs: stage3.latencyMs,
    },
  };
}
