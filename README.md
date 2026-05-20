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
