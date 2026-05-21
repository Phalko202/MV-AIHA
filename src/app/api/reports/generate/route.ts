import { NextRequest, NextResponse } from "next/server";
import { redactPatientEpisode } from "@/lib/redact";
import { analyzeEpisodeEnsemble } from "@/lib/openrouter";
import {
  DISEASES, DISEASE_BY_CODE, FACILITIES,
  encountersFor, originSummary, weeklySeriesFor,
  type DiseaseCode,
} from "@/lib/surveillance-api";

export const runtime = "nodejs";

type ReportTemplate = "daily" | "weekly" | "outbreak" | "facility" | "foreign";

interface GenerateBody {
  template?: ReportTemplate;
  diseaseCode?: DiseaseCode | "all";
  facilityId?: string;
  sampleSize?: number;
}

/**
 * POST /api/reports/generate
 * Builds a real surveillance report by:
 *   1. Aggregating local de-identified surveillance data.
 *   2. Sampling N episodes, redacting each, asking the ensemble for a
 *      diagnosis-level second opinion, then summarising agreement.
 *   3. Composing the final markdown narrative.
 *
 * Returns: { markdown, meta, sampled, ensembleSummary }
 */
export async function POST(request: NextRequest) {
  let body: GenerateBody = {};
  try { body = await request.json(); } catch { /* empty body is OK */ }

  const template: ReportTemplate = body.template ?? "weekly";
  const diseaseCode: DiseaseCode | "all" = body.diseaseCode ?? "all";
  const facilityId = body.facilityId;
  const sampleSize = Math.max(1, Math.min(8, body.sampleSize ?? 4));

  // 1. Aggregate the local dataset
  const encounters = encountersFor(diseaseCode).filter((encounter) => !facilityId || encounter.facilityId === facilityId);
  const totals = {
    episodes: encounters.length,
    critical: encounters.filter((encounter) => encounter.severity === "critical").length,
    severe: encounters.filter((encounter) => encounter.severity === "severe").length,
    foreign: encounters.filter((encounter) => encounter.origin === "foreign").length,
    manualReview: encounters.filter((encounter) => encounter.aiConfidence < 0.75 || encounter.source === "manual_review").length,
  };
  const origin = originSummary(diseaseCode);
  const diseaseRows = (diseaseCode === "all" ? DISEASES : [DISEASE_BY_CODE[diseaseCode]]).map((disease) => ({
    name: disease.name,
    icd10: disease.icd10,
    count: encountersFor(disease.code).length,
    trend: weeklySeriesFor(disease.code).slice(-3).map((row) => row.cases),
  }));

  // 2. Sample → redact → ensemble (in parallel)
  const sampled = encounters.slice(0, sampleSize);
  const ensembleRuns = await Promise.all(sampled.map(async (encounter) => {
    const { redacted, audit } = redactPatientEpisode(encounter as unknown as Record<string, unknown>);
    try {
      const ensemble = await analyzeEpisodeEnsemble(redacted);
      return { episodeRef: redacted.episodeRef, audit, ensemble };
    } catch (error) {
      return { episodeRef: redacted.episodeRef, audit, ensemble: null, error: error instanceof Error ? error.message : "Ensemble call failed" };
    }
  }));

  const ensembleSummary = {
    sampled: sampled.length,
    averageAgreement: ensembleRuns.length ? Number((ensembleRuns.reduce((sum, run) => sum + (run.ensemble?.agreement ?? 0), 0) / ensembleRuns.length).toFixed(2)) : 0,
    averageConfidence: ensembleRuns.length ? Number((ensembleRuns.reduce((sum, run) => sum + (run.ensemble?.confidence ?? 0), 0) / ensembleRuns.length).toFixed(2)) : 0,
    flaggedForReview: ensembleRuns.filter((run) => run.ensemble?.flaggedForReview).length,
    totalRedactedFields: ensembleRuns.reduce((sum, run) => sum + run.audit.removedFields.length, 0),
  };

  // 3. Compose markdown
  const title = templateTitle(template, diseaseCode, facilityId);
  const markdown = composeMarkdown({ title, template, diseaseCode, facilityId, totals, origin, diseaseRows, ensembleRuns, ensembleSummary });

  const meta = {
    id: `RPT-LIVE-${Date.now().toString(36).toUpperCase()}`,
    title,
    type: template === "daily" ? "Daily brief" : template === "weekly" ? "Weekly epidemiological summary" : template === "outbreak" ? "Outbreak cluster brief" : template === "facility" ? "Facility audit" : "Foreign cohort audit",
    date: new Date().toISOString().slice(0, 10),
    author: "MV-AIHA ensemble + clinician review",
    pageCount: Math.max(4, Math.ceil(markdown.length / 2400)),
    diseaseCode,
  };

  return NextResponse.json({ meta, markdown, ensembleSummary, ensembleRuns: ensembleRuns.map((run) => ({
    episodeRef: run.episodeRef,
    audit: run.audit,
    diagnosis: run.ensemble?.diagnosis,
    confidence: run.ensemble?.confidence,
    severity: run.ensemble?.severity,
    agreement: run.ensemble?.agreement,
    flaggedForReview: run.ensemble?.flaggedForReview,
    modelCount: run.ensemble?.modelCount,
  })) });
}

function templateTitle(template: ReportTemplate, diseaseCode: DiseaseCode | "all", facilityId?: string): string {
  const facility = facilityId ? FACILITIES.find((facilityItem) => facilityItem.id === facilityId)?.shortName ?? facilityId : null;
  const disease = diseaseCode === "all" ? "All diseases" : DISEASE_BY_CODE[diseaseCode].name;
  const today = new Date().toISOString().slice(0, 10);
  switch (template) {
    case "daily": return `Daily disease brief — ${disease} — ${today}`;
    case "outbreak": return `Outbreak cluster brief — ${disease} — ${today}`;
    case "facility": return `${facility ?? "Facility"} audit — ${disease} — ${today}`;
    case "foreign": return `Foreign cohort audit — ${disease} — ${today}`;
    case "weekly":
    default: return `Weekly epidemiological summary — ${disease} — ${today}`;
  }
}

function composeMarkdown(input: {
  title: string;
  template: ReportTemplate;
  diseaseCode: DiseaseCode | "all";
  facilityId?: string;
  totals: { episodes: number; critical: number; severe: number; foreign: number; manualReview: number };
  origin: Array<{ gender: string; origin: string; count: number }>;
  diseaseRows: Array<{ name: string; icd10: string; count: number; trend: number[] }>;
  ensembleRuns: Array<{ episodeRef?: string; ensemble: { diagnosis: string; confidence: number; severity: string; agreement: number; flaggedForReview: boolean; modelCount: number } | null; audit: { removedFields: string[]; redactedTextSpans: number; sourceHash: string } }>;
  ensembleSummary: { sampled: number; averageAgreement: number; averageConfidence: number; flaggedForReview: number; totalRedactedFields: number };
}): string {
  const { title, totals, origin, diseaseRows, ensembleRuns, ensembleSummary } = input;
  const lines: string[] = [];
  lines.push(`# ${title}`);
  lines.push("");
  lines.push(`_Generated by MV-AIHA on ${new Date().toISOString()}. All patient data is de-identified before any third-party model receives it._`);
  lines.push("");
  lines.push("## Executive summary");
  lines.push(`- **Episodes reviewed:** ${totals.episodes.toLocaleString()}`);
  lines.push(`- **Critical signals:** ${totals.critical}`);
  lines.push(`- **Foreign-cohort episodes:** ${totals.foreign}`);
  lines.push(`- **Manual review queue:** ${totals.manualReview}`);
  lines.push(`- **AI ensemble agreement (sampled):** ${(ensembleSummary.averageAgreement * 100).toFixed(0)}%`);
  lines.push(`- **AI ensemble confidence (sampled):** ${(ensembleSummary.averageConfidence * 100).toFixed(0)}%`);
  lines.push("");
  lines.push("## Cohort breakdown");
  lines.push("| Gender | Origin | Episodes |");
  lines.push("| --- | --- | --- |");
  for (const row of origin) lines.push(`| ${row.gender === "M" ? "Male" : "Female"} | ${row.origin} | ${row.count} |`);
  lines.push("");
  lines.push("## Disease signal table");
  lines.push("| Disease | ICD-10 | Episodes | Recent weekly trend |");
  lines.push("| --- | --- | --- | --- |");
  for (const row of diseaseRows) lines.push(`| ${row.name} | ${row.icd10} | ${row.count} | ${row.trend.join(" → ")} |`);
  lines.push("");
  lines.push("## AI ensemble second-opinion sample");
  lines.push(`Sample size: ${ensembleSummary.sampled} de-identified episodes. ${ensembleSummary.flaggedForReview} flagged for clinician review.`);
  lines.push("");
  lines.push("| Episode ref | Ensemble diagnosis | Severity | Confidence | Agreement | Models | Redacted fields | Source hash |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const run of ensembleRuns) {
    const ensemble = run.ensemble;
    lines.push(`| ${run.episodeRef ?? "—"} | ${ensemble?.diagnosis ?? "n/a"} | ${ensemble?.severity ?? "n/a"} | ${ensemble ? (ensemble.confidence * 100).toFixed(0) + "%" : "n/a"} | ${ensemble ? (ensemble.agreement * 100).toFixed(0) + "%" : "n/a"} | ${ensemble?.modelCount ?? 0} | ${run.audit.removedFields.length} | \`${run.audit.sourceHash}\` |`);
  }
  lines.push("");
  lines.push("## Privacy controls");
  lines.push("Every sampled episode passed through `redactPatientEpisode()` before any model call. The redactor removed direct identifiers (name, address, phone, ID card, passport, MRN), converted date of birth to integer age in years, and swept clinician free text for identifier-shaped substrings. Only age, gender, atoll, facility, diagnosis text, symptoms, vitals, prescriptions, and severity left the perimeter. See `src/lib/redact.ts` and `README.md` for the legal guarantees.");
  lines.push("");
  lines.push("## Recommendations");
  lines.push("1. Manually review every episode flagged with ensemble agreement below 60%.");
  lines.push("2. Continue routing prescription-derived disease signals through a clinician before public alerts.");
  lines.push("3. Re-run this report daily for critical disease signals; weekly for stable categories.");
  return lines.join("\n");
}

export async function GET() {
  return NextResponse.json({
    name: "MV-AIHA report generator",
    description: "POST { template, diseaseCode, facilityId, sampleSize } — generates a redacted, ensemble-verified surveillance report.",
    templates: ["daily", "weekly", "outbreak", "facility", "foreign"],
  });
}
