# MV-AIHA

MV-AIHA is a Maldives AI Health Analytics portal for disease surveillance, facility-level signal monitoring, external-patient intelligence, and de-identified patient cohort review.

## Team And Track

- Team: MV-AIHA
- Chosen direction: Track A - Healthcare / Public Health Intelligence
- Repository: https://github.com/Phalko202/MV-AIHA

## Problem

Public health teams need a fast way to monitor disease signals across Maldives facilities, distinguish local and external-patient patterns, review AI-assisted classifications, and present de-identified insights without exposing patient names or identifiers.

## Features

- Command dashboard for national disease signals.
- Maldives-only facility map with corrected hospital coordinates where verified.
- Interactive analytics with disease filtering, contextual insight cards, and modern graph surfaces.
- Patient cohort summaries using de-identified episodes.
- External patient intelligence for non-local signal review.
- Live surveillance intake from Vinavi and Foreign source APIs with paused-by-default receiver controls.
- Batched, paged consultation intake with safe patient stat IDs and full complaints, advice, services, prescriptions, and vitals details.
- AI-assisted reports with privacy controls and methodology sections.
- Vinavi EMR demo route for patient-history exploration.

## Install And Run

```bash
cd mv-aihs-portal
npm install
npm run dev
```

Open http://localhost:3000 for the surveillance portal.

Vinavi can be run separately on port 3001:

```bash
cd mv-aihs-portal
npm run dev:vinavi
```

Open http://localhost:3001/vinavi.

## Build

```bash
npm run build
```

## Services And APIs Used

- Next.js and React for the portal UI.
- Recharts for analytics visualizations.
- Leaflet and React Leaflet for the disease map.
- ArcGIS World Imagery and OpenStreetMap tiles for map layers.
- OpenStreetMap Nominatim and Photon were used during development to verify available public facility coordinates.
- 3dicons assets are used for local 3D-style interface icons.

## AI Tools Used

- GitHub Copilot was used for code generation, UI iteration, debugging, and repository documentation.

## Data privacy and PII redaction (read this first)

This is the most important section in the repository. MV-AIHA is built so that **no patient PHI ever leaves the server perimeter** when the portal calls an external large language model. The legal and ethical guarantees below are enforced by code, not by policy:

### What we send to third-party models

Every Vinavi episode that is about to be analysed by a third-party model is first passed through `redactPatientEpisode()` in [src/lib/redact.ts](src/lib/redact.ts). The redactor:

1. **Removes direct identifiers** — `name`, `nameDhivehi`, `address`, `street`, `houseName`, `postalCode`, `idCard`, `nationalId`, `passport`, `passportNumber`, `permitNumber`, `workPermit`, `phone`, `phoneNumber`, `mobile`, `email`, `nextOfKin`, `guardianName`, `guardianPhone`, `emergencyContact`, `emergencyContactPhone`, `hospitalNumber`, `mrn`, `patientName`.
2. **Removes date of birth** — `dateOfBirth`, `dob`, `birthDate`, `birthday` are dropped after being converted to an **integer age in years** (clamped to 0–120). The date itself never leaves the server.
3. **Replaces the episode ID** with a synthetic 8-character SHA-256 token (`episodeRef`). The real episode/patient IDs never leave the server.
4. **Sweeps clinician free text** for identifier-shaped substrings: Maldivian national IDs (`A` + 6–9 digits), passport-style codes, Maldives phone numbers (`+960` and 7-digit local), email addresses, dates of birth, and `Mr./Mrs./Ms./Mx. Firstname Lastname` patterns. Each hit is replaced with a `[REDACTED_*]` placeholder.
5. **Coarsens nationality** into a two-bucket cohort flag — `"local"` or `"foreign"` — and discards the underlying nationality string.

The redactor returns an audit record containing the list of removed field names, the count of free-text spans scrubbed, a 32-character SHA-256 prefix of the original payload (for audit chain only), and an ISO timestamp.

### What we keep

Only the **de-identified clinical signal** required for research leaves the perimeter:

- `ageYears` (integer)
- `gender`
- `cohort` (`local` | `foreign`)
- `atoll` (region, not address)
- `facilityId`, `facilityType`
- `onsetDate`, `admissionDate`
- `diagnosis`, `diseaseCode`, `icd10`
- `symptoms`, `vitals`, `prescriptions`
- `severity`, `outcome`
- `clinicianNotes` (after the free-text sweep above)

Per the project owner's direction, **age and gender are explicitly kept** because they are required for clinical triage and outbreak stratification. Direct identifiers, addresses, and the date of birth are removed.

### Defence in depth

Before any HTTP call to OpenRouter, [src/lib/openrouter.ts](src/lib/openrouter.ts) calls `assertRedacted()` on the payload. If any forbidden field (any of the 20+ direct identifiers, or any DOB-style field) is still present, the function throws and the network call never happens. This is a hard gate, not a warning.

The unredacted payload is **never logged**. Server-side audit logs only record the SHA-256 prefix returned by the redactor plus the list of removed field names. The original episode object cannot be reconstructed from anything that touches disk.

### Ensemble inference and 3-stage surveillance pipeline

MV-AIHA now uses two AI execution patterns:

- **Episode review ensemble**: three OpenRouter models run in parallel for redacted episode-level second opinions. The default chain is DeepSeek V4 Flash, NVIDIA Nemotron 3 Super 120B, and OpenAI GPT-OSS 120B.
- **Surveillance feed pipeline**: a sequential 3-stage route at `/api/ai/surveillance-feed` that processes raw 12-hour clinic sync batches through:
	1. **Raw Ingestion Buffer** — `deepseek/deepseek-v4-flash:free`
	2. **Analytical Synthesizer** — `nvidia/nemotron-3-super-120b-a12b:free`
	3. **Strategic Briefing Engine** — `openai/gpt-oss-120b:free`

The surveillance route enforces three guardrails in order:

- **Pre-API destructive purge** in TypeScript before any model call.
- **In-context negative prompting** that forces aggregate-only outputs.
- **Post-inference regex verification** that blocks releases if structural identity markers appear.

The episode-review ensemble still majority-votes diagnosis text, averages agreement-weighted confidence, and flags any low-agreement result for manual review.

### Configuration

Copy `.env.example` to `.env.local` at the project root, then add your OpenRouter key:

```env
OPENROUTER_API_KEY=sk-or-v1-...
# optional — override the episode-review model list (comma-separated)
MV_AIHA_MODELS=deepseek/deepseek-v4-flash:free,nvidia/nemotron-3-super-120b-a12b:free,openai/gpt-oss-120b:free
# optional — override the 3-stage surveillance pipeline models individually
MV_AIHA_INGEST_MODEL=deepseek/deepseek-v4-flash:free
MV_AIHA_SYNTH_MODEL=nvidia/nemotron-3-super-120b-a12b:free
MV_AIHA_BRIEF_MODEL=openai/gpt-oss-120b:free
# optional — overrides the referrer reported to OpenRouter
MV_AIHA_SITE_URL=http://localhost:3000
```

If `OPENROUTER_API_KEY` is missing, the ensemble returns `INSUFFICIENT_DATA` with confidence 0 and the request is flagged for manual review. The portal continues to function and never silently uses a fallback that could leak data.

### Endpoints

- `POST /api/vinavi/ingest` — accepts either one consultation object or `{ "consultations": [...] }`. Batches are capped at 5,000 records per request so large demos do not overload the server. The response includes `acceptedCount`, ready/pending totals, safe sequence numbers, store size, and patient count.
- `GET /api/vinavi/ingest?detail=full&limit=250&offset=0` — returns paged, de-identified Vinavi records. Records expose only `patientStatId`, `episodeSequence`, aggregate-safe demographics, diagnosis/ICD data, grouped clinical sections, and vitals including blood pressure, heart rate, temperature, SpO2, and respiratory rate.
- `POST /api/foreign/ingest` — body `{ "amount": 25 }`. Generates a Foreign source batch using the same safe event contract.
- `GET /api/foreign/ingest?detail=full&limit=250&offset=0` — returns paged Foreign source events using the same grouped clinical detail shape as Vinavi.
- `POST /api/ai/analyze-episode` — body `{ episode }`. Redacts, runs the ensemble, returns `{ redacted, audit, ensemble }`. The unredacted episode is never echoed back.
- `POST /api/ai/surveillance-feed` — body `{ logs }`. Runs the destructive purge and then the 3-stage OpenRouter surveillance chain over de-identified feed records.
- `POST /api/reports/generate` — body `{ template, diseaseCode, facilityId, sampleSize }`. Samples episodes, redacts each, runs the ensemble per episode, and composes a markdown surveillance report containing only de-identified figures, the per-episode source hash, and the list of fields that were stripped before any model saw the data.

### Where to verify

If you are reviewing this project for compliance, the four files that implement the privacy controls are:

- [src/lib/redact.ts](src/lib/redact.ts)
- [src/lib/openrouter.ts](src/lib/openrouter.ts)
- [src/app/api/ai/analyze-episode/route.ts](src/app/api/ai/analyze-episode/route.ts)
- [src/app/api/reports/generate/route.ts](src/app/api/reports/generate/route.ts)

Every other surface in the portal (Vinavi EMR, the surveillance dashboard, the live intake view, the encounter log) operates on the local mock dataset and does not transmit any patient data off the server.

## Open-Source Components And Licenses

- Next.js: MIT License.
- React: MIT License.
- Recharts: MIT License.
- Leaflet: BSD-2-Clause License.
- React Leaflet: Hippocratic License 3.0.
- Lucide React: ISC License.
- 3dicons: CC0.

## Privacy And Security Notes

- Reports intentionally exclude patient names, addresses, passport numbers, national identifiers, and hospital numbers.
- Mock data is synthetic and de-identified for hackathon demonstration.
- `.gitignore` excludes `.env*`, certificates, dependency folders, build output, and debug logs.
- Do not commit API keys, passwords, tokens, certificates, sandbox credentials, or production patient data.

## Submission Checklist

- Source code is included.
- README includes project name, team, track, problem, install/run instructions, services and APIs used, AI tools used, and open-source licenses.
- LICENSE file is included.
- `.gitignore` excludes secrets and generated artifacts.
