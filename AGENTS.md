<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# MV-AIHA

## Project Overview
Hackathon demo for the **Maldives Anonymized Integrated Health Surveillance** platform.

This repository serves two distinct portals from the same Next.js app:
- **Surveillance portal** for epidemiologists and command-center monitoring on `http://localhost:3000/`
- **Vinavi clinical portal** for patient records and episode workflows on `http://localhost:3001/vinavi`

## Tech Stack
- **Framework:** Next.js 16 (App Router, Turbopack)
- **Styling:** Tailwind CSS v4 (via `@tailwindcss/postcss`)
- **Icons:** `lucide-react`
- **Language:** TypeScript (strict)
- **Charts:** `recharts`
- **Maps:** `leaflet`, `react-leaflet`

## Commands
- `npm run dev` — Start surveillance mode on port 3000
- `npm run dev:surveillance` — Surveillance portal on port 3000
- `npm run dev:vinavi` — Vinavi portal on port 3001
- `npm run build` — Production build (also validates types)
- `npm run lint` — ESLint

## Architecture
```
src/
├── app/
│   ├── layout.tsx                    # Root layout and metadata
│   ├── page.tsx                      # Surveillance root route
│   ├── network/page.tsx              # Epidemiology research workspace
│   ├── vinavi/layout.tsx             # Vinavi clinical shell
│   ├── vinavi/page.tsx               # Vinavi search workspace
│   ├── vinavi/[patientId]/page.tsx   # Patient summary view
│   ├── vinavi/[patientId]/[episodeId]/page.tsx
│   └── globals.css                   # Tailwind imports and shared globals
├── components/
│   ├── SurveillancePortal.tsx        # Surveillance command center
│   └── vinavi/
│       ├── HospitalMap.tsx           # Facility map used in /network
│       └── VitalsChart.tsx           # Patient vitals visualization
└── lib/
    ├── logger.ts                     # Client-side audit log helpers
    └── mock-data.ts                  # Mock patients, episodes, hospitals
```

## Design Conventions
- **Surveillance UI:** Dark, dense, full-screen command center styling.
- **Vinavi UI:** Light, clinic-inspired patient workspace with a left navigation shell.
- **Route split:** Keep surveillance concerns under `/` and `/network`; keep clinical workflows under `/vinavi`.
- **Mock data:** Patient examples remain anonymized and local to the demo.

## Key Patterns
- Portal separation is controlled by `MV_PORTAL_MODE` plus middleware redirects.
- Separate `distDir` values are required so surveillance and Vinavi can run concurrently in dev.
- Surveillance live incident data is generated client-side to avoid hydration drift.
- Vinavi search, patient pages, and episode pages are interactive client workflows with local audit logging.
- The surveillance portal links out to Vinavi via the configured public Vinavi URL instead of in-app same-origin routing.

## Pitfalls
- Tailwind v4 uses `@theme inline` blocks, not `theme.extend` in config.
- `useSearchParams()` consumers must stay under a `Suspense` boundary in App Router builds.
- `next/dynamic(..., { ssr: false })` must only be used from client components.
- The `"use client"` directive is required for any component using hooks or browser APIs.
