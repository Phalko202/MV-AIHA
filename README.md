# MV-AIHA

MV-AIHA is a Maldives AI Health Analytics portal for disease surveillance, facility-level signal monitoring, external-patient intelligence, and de-identified patient cohort review.

## Team And Track

- Team: MV-AIHA
- Track: Healthcare / Public Health Intelligence
- Repository: https://github.com/Phalko202/MV-AIHA

## Problem

Public health teams need a fast way to monitor disease signals across Maldives facilities, distinguish local and external-patient patterns, review AI-assisted classifications, and present de-identified insights without exposing patient names or identifiers.

## Features

- Command dashboard for national disease signals.
- Maldives-only facility map with corrected hospital coordinates where verified.
- Interactive analytics with disease filtering, contextual insight cards, and modern graph surfaces.
- Patient cohort summaries using de-identified episodes.
- External patient intelligence for non-local signal review.
- Live surveillance intake simulation for demo workflows.
- AI-assisted reports with privacy controls and methodology sections.
- Vinavi EMR demo route for patient-history exploration.

## Install And Run

```bash
npm install
npm run dev
```

Open http://localhost:3000 for the surveillance portal.

Vinavi can be run separately on port 3001:

```bash
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

Only the **de-identified clinical signal** required for triage leaves the perimeter:

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

### Ensemble inference (anti-hallucination)

We do not trust a single model. Each redacted episode is dispatched in parallel to 5+ free medical-capable models on OpenRouter (configurable via the `MV_AIHA_MODELS` environment variable; defaults include Meta Llama 3.3 70B, DeepSeek R1, Qwen 2.5 72B, Google Gemma 2 9B, Mistral 7B, Nous Hermes 3 405B, and Microsoft Phi-3 Mini 128K — all `:free` variants).

The orchestrator:

- Runs all calls in parallel with a per-call timeout of 18 seconds.
- Discards any response that does not return strict JSON in the agreed schema.
- Majority-votes the diagnosis text (normalised to lowercase alphanumerics).
- Averages confidence across models that agreed with the majority.
- Computes an **agreement ratio** — fraction of responding models that voted for the winning diagnosis.
- **Flags the episode for manual clinician review** when agreement is below 60%, average confidence is below 55%, or fewer than two models responded successfully.

This majority-vote design is what suppresses single-model hallucination at scale. A single confident-but-wrong model cannot promote a public health signal on its own.

### Configuration

Put your OpenRouter API key in `.env.local` at the project root:

```env
OPENROUTER_API_KEY=sk-or-v1-...
# optional — override the model list (comma-separated OpenRouter model IDs)
MV_AIHA_MODELS=meta-llama/llama-3.3-70b-instruct:free,deepseek/deepseek-r1:free,qwen/qwen-2.5-72b-instruct:free,google/gemma-2-9b-it:free,mistralai/mistral-7b-instruct:free
# optional — overrides the referrer reported to OpenRouter
MV_AIHA_SITE_URL=https://your-deployment.example
```

If `OPENROUTER_API_KEY` is missing, the ensemble returns `INSUFFICIENT_DATA` with confidence 0 and the request is flagged for manual review. The portal continues to function and never silently uses a fallback that could leak data.

### Endpoints

- `POST /api/ai/analyze-episode` — body `{ episode }`. Redacts, runs the ensemble, returns `{ redacted, audit, ensemble }`. The unredacted episode is never echoed back.
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
