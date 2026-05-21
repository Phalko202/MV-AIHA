/* ------------------------------------------------------------------ */
/*  OPENROUTER CLIENT + MEDICAL ENSEMBLE                               */
/* ------------------------------------------------------------------ */
/*  Reads OPENROUTER_API_KEY from .env.local. Never logs the           */
/*  unredacted episode. Uses the three OpenRouter models selected      */
/*  for MV-AIHS strategic processing and still cross-checks them       */
/*  before promoting a signal.                                         */
/* ------------------------------------------------------------------ */

import { assertRedacted, type RedactedEpisode } from "@/lib/redact";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

/**
 * OpenRouter models selected for MV-AIHS.
 * Override at runtime with MV_AIHA_MODELS env (comma-separated).
 */
export const MEDICAL_MODELS: string[] = (
  process.env.MV_AIHA_MODELS ??
  [
    "deepseek/deepseek-v4-flash:free",
    "openai/gpt-oss-120b:free",
    "google/gemma-4-31b-it:free",
  ].join(",")
).split(",").map((value) => value.trim()).filter(Boolean);

const PER_CALL_TIMEOUT_MS = 18_000;

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
  agreement: number; // fraction of responding models that agreed
  votes: EnsembleVote[];
  flaggedForReview: boolean;
  modelCount: number;
}

const SYSTEM_PROMPT = `You are a Maldives public-health triage assistant operating inside the MV-AIHS strategic stack. You receive a fully de-identified clinical episode. You will return STRICT JSON only, with this exact schema:
{"diagnosis": string, "icd10": string, "severity": "mild"|"moderate"|"severe"|"critical", "confidence": number between 0 and 1, "recommendedAction": string}
No prose, no markdown, no code fences. If the evidence is insufficient, set diagnosis to "INSUFFICIENT_DATA" and confidence to 0.`;

function buildUserPrompt(episode: RedactedEpisode): string {
  return `Episode (de-identified):\n${JSON.stringify(episode, null, 2)}\n\nReturn the JSON object now.`;
}

async function callOne(model: string, episode: RedactedEpisode, apiKey: string): Promise<EnsembleVote> {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PER_CALL_TIMEOUT_MS);
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
        max_tokens: 320,
        temperature: 0.2,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserPrompt(episode) },
        ],
      }),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return { model, diagnosis: null, confidence: null, severity: null, recommendedAction: null, latencyMs: Date.now() - startedAt, error: `HTTP ${response.status}: ${text.slice(0, 200)}` };
    }
    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const raw = payload.choices?.[0]?.message?.content?.trim() ?? "";
    const parsed = safeParseJson(raw);
    if (!parsed) {
      return { model, diagnosis: null, confidence: null, severity: null, recommendedAction: null, latencyMs: Date.now() - startedAt, error: "Non-JSON response" };
    }
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
  } finally {
    clearTimeout(timer);
  }
}

function safeParseJson(raw: string): Record<string, unknown> | null {
  if (!raw) return null;
  // strip code fences if any model ignored the instruction
  const stripped = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try { return JSON.parse(stripped); } catch {
    // Try to recover the first {...} block
    const match = stripped.match(/\{[\s\S]*\}/);
    if (match) { try { return JSON.parse(match[0]); } catch { /* fall through */ } }
    return null;
  }
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
    if (entry.count > count) { winner = entry.original; count = entry.count; }
  }
  return { winner, count };
}

/**
 * Calls every model in MEDICAL_MODELS in parallel, then majority-votes.
 * Episode MUST already be redacted. The function will re-assert and throw
 * if any forbidden field is present.
 */
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
