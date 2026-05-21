import { NextRequest, NextResponse } from "next/server";
import { analyzeSurveillanceBatch } from "@/lib/openrouter";

export const runtime = "nodejs";

/**
 * POST /api/ai/surveillance-feed
 * Body: { logs: Array<object> }
 *
 * Pipeline:
 *   1. Destructive purge in local TypeScript before any model sees the payload.
 *   2. Sequential 3-model OpenRouter chain.
 *   3. Post-inference structural privacy verification before response release.
 */
export async function POST(request: NextRequest) {
  let body: { logs?: Record<string, unknown>[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!Array.isArray(body?.logs)) {
    return NextResponse.json({ error: "Missing 'logs' array in body" }, { status: 400 });
  }

  try {
    const analysis = await analyzeSurveillanceBatch(body.logs);
    return NextResponse.json({ analysis });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Surveillance pipeline failed" },
      { status: 502 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    name: "MV-AIHA surveillance feed analyzer",
    description: "POST { logs } - destructively purges identity markers, runs the 3-stage OpenRouter surveillance chain, and blocks unsafe output.",
    models: {
      stage1: "deepseek/deepseek-v4-flash:free",
      stage2: "nvidia/nemotron-3-super-120b-a12b:free",
      stage3: "openai/gpt-oss-120b:free",
    },
    requiredEnv: ["OPENROUTER_API_KEY"],
  });
}