"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  Database,
  FileText,
  HeartPulse,
  Search,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";
import { MOCK_PATIENTS, searchPatients } from "@/lib/mock-data";
import { log } from "@/lib/logger";

const SURVEILLANCE_ORIGIN = process.env.NEXT_PUBLIC_SURVEILLANCE_URL ?? (process.env.NODE_ENV === "development" ? "http://localhost:3000" : "");

const INTERNAL_ITEMS = [
  {
    href: "/vinavi",
    label: "Patient Search",
    icon: Search,
    isActive: (pathname: string) => pathname === "/vinavi",
  },
  {
    href: "/vinavi",
    label: "Clinical Records",
    icon: FileText,
    isActive: (pathname: string) => pathname.startsWith("/vinavi/") && pathname.split("/").length === 3,
  },
  {
    href: "/vinavi",
    label: "Care Episodes",
    icon: Stethoscope,
    isActive: (pathname: string) => pathname.split("/").length > 3,
  },
];



export default function VinaviLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [dateLabel, setDateLabel] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [seedAmount, setSeedAmount] = useState("25");
  const [seedStatus, setSeedStatus] = useState("Ready to send consultations.");

  const totalConsultations = MOCK_PATIENTS.reduce((sum, patient) => sum + patient.episodes.length, 0);

  const seedConsultations = async () => {
    const amount = Math.max(1, Math.min(totalConsultations, Number(seedAmount) || 25));
    setSeedStatus("Sending one batched consultation request to surveillance intake...");
    try {
      const episodes = MOCK_PATIENTS.flatMap((patient) => patient.episodes.map((episode) => ({ patient, episode })));
      const batchId = Date.now();
      const consultations = episodes.slice(0, amount).map((item, index) => {
        const diagnosis = item.episode.diagnosis.toLowerCase();
        const icd10Code = diagnosis.includes("dengue") ? "A90"
          : diagnosis.includes("gastro") ? "A09"
            : diagnosis.includes("asthma") ? "J45"
              : diagnosis.includes("hypertension") ? "I10"
                : diagnosis.includes("respiratory") ? "J11"
                  : "Z02.7";
        return {
          episodeId: `${item.episode.id}-DEMO-${batchId}-${index}`,
          patientId: item.patient.id,
          patientAge: item.patient.age,
          patientGender: item.patient.gender,
          patientAtoll: item.patient.atoll,
          patientIsland: item.patient.island,
          facilityId: item.patient.hospital.toLowerCase().includes("hulhum") ? "hulhumale" : item.patient.hospital.toLowerCase().includes("tree") ? "tree-top" : item.patient.hospital.toLowerCase().includes("adk") ? "adk" : "igmh",
          doctorName: "Vinavi clinician",
          specialty: item.episode.specialty,
          openedAt: `${item.episode.date}T08:20:00Z`,
          closedAt: item.episode.status === "closed" ? `${item.episode.date}T09:05:00Z` : null,
          status: item.episode.status,
          diagnosis: item.episode.diagnosis,
          icd10Code,
          sections: item.episode.sections.map((section) => ({ type: section.type, content: section.content, createdAt: section.createdAt })),
          vitals: item.episode.vitals.map((vital) => ({ timestamp: vital.timestamp, bp: vital.bp, heartRate: vital.heartRate, temp: vital.temp, spo2: vital.spo2, respRate: vital.respRate })),
          origin: "local",
        };
      });
      const response = await fetch(`${SURVEILLANCE_ORIGIN}/api/vinavi/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consultations }),
      });
      const result = await response.json().catch(() => null) as { accepted?: number; acceptedCount?: number; patientCount?: number; firstEpisodeSequence?: number; lastEpisodeSequence?: number; error?: string } | null;
      if (!response.ok) throw new Error(result?.error ?? `HTTP ${response.status}`);
      const uniquePatients = new Set(consultations.map((item) => item.patientId)).size;
      setSeedStatus(`${result?.acceptedCount ?? amount} consultations from ${uniquePatients} patient(s) sent in one batch. Sequence ${result?.firstEpisodeSequence ?? "?"}-${result?.lastEpisodeSequence ?? "?"}. Resume Vinavi sync in surveillance.`);
    } catch (error) {
      setSeedStatus(`Send failed: ${error instanceof Error ? error.message : "surveillance API unavailable"}`);
    }
  };

  useEffect(() => {
    const updateDateLabel = () => {
      setDateLabel(
        new Intl.DateTimeFormat("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
        }).format(new Date())
      );
    };

    updateDateLabel();
    const intervalId = window.setInterval(updateDateLabel, 60000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    setQuery("");
  }, [pathname]);

  const matches = query.trim() ? searchPatients(query).slice(0, 5) : [];

  const handleSearchSubmit = () => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      return;
    }

    log("GLOBAL_SEARCH", "VinaviLayout", { query: trimmedQuery, resultsCount: matches.length });

    if (matches.length === 1) {
      router.push(`/vinavi/${matches[0].id}`);
      return;
    }

    router.push(`/vinavi?query=${encodeURIComponent(trimmedQuery)}`);
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#f3f3f3] text-slate-900 flex flex-col">
      <aside className="hidden">
        <div className="border-b border-slate-200 px-6 py-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-[0_12px_24px_rgba(239,68,68,0.28)]">
              <HeartPulse className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-rose-500">
                MV-AIHA
              </p>
              <h1 className="text-lg font-bold text-slate-900">Vinavi EMR</h1>
              <p className="text-xs text-slate-500">Government Clinical Records</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto px-4 py-5">
          <div className="mb-4 px-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
            Clinical Workspace
          </div>
          <nav className="space-y-1.5">
            {INTERNAL_ITEMS.map((item) => {
              const active = item.isActive(pathname);
              return (
                <button
                  key={item.label}
                  onClick={() => router.push(item.href)}
                  className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all cursor-pointer ${
                    active
                      ? "bg-rose-50 text-rose-600 shadow-[inset_0_0_0_1px_rgba(244,63,94,0.16)]"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <item.icon className="h-4.5 w-4.5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>


        </div>

        <div className="border-t border-slate-200 px-6 py-5">
          <div className="rounded-3xl bg-gradient-to-br from-slate-50 to-white p-4 shadow-[inset_0_0_0_1px_rgba(226,232,240,0.9)]">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Secure Government Access</p>
                <p className="text-xs text-slate-500">Doctor session workspace</p>
              </div>
            </div>
          </div>

        </div>
      </aside>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <header className="shrink-0 bg-[#e34234] px-4 py-2 text-white shadow-[0_2px_10px_rgba(0,0,0,0.22)]">
          <div className="flex items-center gap-4">
            <button onClick={() => setMenuOpen((current) => !current)} className="rounded p-2 text-white/95 hover:bg-white/10" aria-label="Menu">
              <span className="block h-0.5 w-5 bg-white" />
              <span className="mt-1 block h-0.5 w-5 bg-white" />
              <span className="mt-1 block h-0.5 w-5 bg-white" />
            </button>
            <button onClick={() => router.push("/vinavi")} className="text-xl font-semibold text-white">Vinavi</button>
            <div className="relative min-w-0 flex-1">
              <div className="flex h-10 items-center bg-white/16 px-4 focus-within:bg-white/22">
                <Search className="h-4.5 w-4.5 shrink-0 text-white" />
                <input
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      handleSearchSubmit();
                    }
                  }}
                  placeholder="Patient Search"
                  className="w-full bg-transparent px-3 py-2 text-sm text-white outline-none placeholder:text-white/85"
                />
                <button
                  onClick={handleSearchSubmit}
                  className="hidden"
                >
                  Search
                </button>
              </div>
              {query.trim() && matches.length > 0 && (
                <div className="absolute inset-x-0 top-[calc(100%+8px)] z-50 rounded-3xl border border-slate-200 bg-white p-2 shadow-[0_24px_60px_rgba(15,23,42,0.12)]">
                  {matches.map((patient) => (
                    <button
                      key={patient.id}
                      onClick={() => router.push(`/vinavi/${patient.id}`)}
                      className="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left transition-colors hover:bg-slate-50"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{patient.name}</p>
                        <p className="text-xs text-slate-500">
                          {patient.id} · {patient.nationalId} · {patient.hospital}
                        </p>
                      </div>
                      <ArrowUpRight className="h-4 w-4 text-slate-300" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="ml-auto flex shrink-0 items-center gap-4 text-right">
              <div>
                <p className="text-sm font-semibold leading-tight">Clinical Session</p>
                <p className="text-xs font-semibold leading-tight text-white/80">Hulhumale' Hospital</p>
              </div>
              <Activity className="h-5 w-5 text-white" />
              <ShieldCheck className="h-5 w-5 text-white" />
            </div>
          </div>
          {menuOpen && (
            <div className="absolute left-4 top-16 z-50 w-[430px] border border-slate-200 bg-white p-4 text-slate-900 shadow-[0_24px_70px_rgba(15,23,42,0.24)]">
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-rose-600">Vinavi operator controls</p>
              <div className="mt-3 divide-y divide-slate-100 rounded border border-slate-200 bg-slate-50">
                <div className="flex items-center justify-between px-4 py-3"><span className="text-sm font-semibold text-slate-500">Patient registry</span><span className="font-mono text-2xl font-black">{MOCK_PATIENTS.length}</span></div>
                <div className="flex items-center justify-between px-4 py-3"><span className="text-sm font-semibold text-slate-500">Consultation episodes</span><span className="font-mono text-2xl font-black">{totalConsultations.toLocaleString()}</span></div>
                <div className="flex items-center justify-between px-4 py-3"><span className="text-sm font-semibold text-slate-500">Sync mode</span><span className="rounded bg-rose-100 px-2 py-1 text-xs font-black text-rose-700">Surveillance intake only</span></div>
              </div>
              <div className="mt-4 rounded border border-rose-100 bg-rose-50 p-3">
                <p className="text-sm font-bold text-rose-800">Send consultation batch</p>
                <p className="mt-1 text-xs leading-5 text-rose-700/80">This only pushes safe records to the surveillance ingest API. It does not start AI.</p>
                <div className="mt-3 flex gap-2">
                  <input value={seedAmount} onChange={(event) => setSeedAmount(event.target.value.replace(/[^0-9]/g, "").slice(0, 4))} className="min-w-0 flex-1 rounded border border-rose-200 bg-white px-3 py-2 text-sm font-bold outline-none" />
                  <button onClick={seedConsultations} className="inline-flex items-center gap-2 rounded bg-rose-600 px-3 py-2 text-sm font-bold text-white"><Database className="h-4 w-4" />Send</button>
                </div>
                <p className="mt-2 text-xs font-semibold text-rose-800">{seedStatus}</p>
              </div>
            </div>
          )}
        </header>

        <main className="min-h-0 flex-1 overflow-auto bg-[#f5f5f5]">
          {children}
        </main>
      </div>
    </div>
  );
}
