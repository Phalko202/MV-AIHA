import { NextRequest, NextResponse } from "next/server";
import { redactPatientEpisode } from "@/lib/redact";
import { analyzeEpisodeEnsemble } from "@/lib/openrouter";

export const runtime = "nodejs";

/**
 * POST /api/ai/analyze-episode
 * Body: { episode: <raw Vinavi episode object> }
 *
 * Pipeline:
 *   1. redactPatientEpisode()   ← strips PHI, computes ageYears, hashes source
 *   2. analyzeEpisodeEnsemble() ← OpenRouter 3-model stack, privacy guard, majority vote
 *
 * Returns: { redacted, audit, ensemble }
 * The unredacted episode is NEVER logged or echoed back.
 */
export async function POST(request: NextRequest) {
  let body: { episode?: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body?.episode || typeof body.episode !== "object") {
    return NextResponse.json({ error: "Missing 'episode' object in body" }, { status: 400 });
  }

  const { redacted, audit } = redactPatientEpisode(body.episode);

  try {
    const ensemble = await analyzeEpisodeEnsemble(redacted);
    return NextResponse.json({ redacted, audit, ensemble });
  } catch (error) {
    return NextResponse.json({
      redacted,
      audit,
      ensemble: null,
      error: error instanceof Error ? error.message : "Ensemble call failed",
    }, { status: 502 });
  }
}

export async function GET() {
  return NextResponse.json({
    name: "MV-AIHA episode analyzer",
    description: "POST { episode } — redacts PHI then runs the guarded OpenRouter 3-model ensemble.",
    requiredEnv: ["OPENROUTER_API_KEY"],
  });
}
