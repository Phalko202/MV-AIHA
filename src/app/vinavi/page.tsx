"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  Calendar,
  Clock3,
  FileHeart,
  MapPin,
  Search,
  ShieldAlert,
  User,
} from "lucide-react";
import { MOCK_PATIENTS, searchPatients, type Patient } from "@/lib/mock-data";
import { log } from "@/lib/logger";

const SURVEILLANCE_ORIGIN = process.env.NEXT_PUBLIC_SURVEILLANCE_URL ?? (process.env.NODE_ENV === "development" ? "http://localhost:3000" : "");

function VinaviSearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Patient[]>([]);
  const [searched, setSearched] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("vinavi_recent_searches") || "[]");
      setRecentSearches(saved);
    } catch {
      // noop
    }
  }, []);

  const stats = useMemo(() => {
    const totalEpisodes = MOCK_PATIENTS.reduce((sum, patient) => sum + patient.episodes.length, 0);
    const activeEpisodes = MOCK_PATIENTS.reduce(
      (sum, patient) => sum + patient.episodes.filter((episode) => episode.status === "active").length,
      0
    );
    const allergyFlags = MOCK_PATIENTS.filter((patient) => patient.allergies.length > 0).length;

    return {
      registeredPatients: MOCK_PATIENTS.length,
      totalEpisodes,
      activeEpisodes,
      allergyFlags,
    };
  }, []);

  const handleSearch = (incomingQuery = query) => {
    const trimmedQuery = incomingQuery.trim();
    if (!trimmedQuery) {
      return;
    }

    const found = searchPatients(trimmedQuery);
    setQuery(trimmedQuery);
    setResults(found);
    setSearched(true);
    log("PATIENT_SEARCH", "VinaviSearch", { query: trimmedQuery, resultsCount: found.length });

    const updated = [trimmedQuery, ...recentSearches.filter((item) => item !== trimmedQuery)].slice(0, 5);
    setRecentSearches(updated);
    try {
      localStorage.setItem("vinavi_recent_searches", JSON.stringify(updated));
    } catch {
      // noop
    }
  };

  useEffect(() => {
    const initialQuery = searchParams.get("query");
    if (initialQuery) {
      handleSearch(initialQuery);
    }
  }, [searchParams]);

  const handleSelectPatient = (patient: Patient) => {
    log("PATIENT_SELECT", "VinaviSearch", { patientId: patient.id, name: patient.name });
    router.push(`/vinavi/${patient.id}`);
  };

  return (
    <div className="min-h-full px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="grid gap-6 xl:grid-cols-[1.55fr_0.9fr]">
          <div className="rounded-[18px] border border-slate-200 bg-white px-6 py-7 shadow-[0_18px_42px_rgba(15,23,42,0.08)] sm:px-8">
            <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-rose-500">
                  MV-AIHA / VINAVI
                </p>
                <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
                  National Patient Records Workspace
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                  Search patient histories, open consultation episodes, and continue structured clinical
                  documentation in the government EMR environment.
                </p>
              </div>
              <div className="rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-right">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700">
                  Access State
                </p>
                <p className="mt-1 text-sm font-semibold text-emerald-900">Secure clinical session active</p>
              </div>
            </div>

            <div className="rounded border border-slate-200 bg-white p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] sm:p-5">
              <label className="mb-3 block text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                Patient Search
              </label>
              <div className="flex flex-col gap-3 lg:flex-row">
                <div className="flex flex-1 items-center rounded border border-slate-200 bg-white px-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)] focus-within:border-rose-300">
                  <Search className="h-5 w-5 shrink-0 text-rose-500" />
                  <input
                    type="text"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        handleSearch();
                      }
                    }}
                    placeholder="Search by patient ID, full name, or national ID"
                    className="w-full bg-transparent px-3 py-4 text-sm text-slate-900 outline-none placeholder:text-slate-400"
                  />
                </div>
                <button
                  onClick={() => handleSearch()}
                  className="inline-flex items-center justify-center gap-2 rounded bg-[#e34234] px-6 py-4 text-sm font-semibold text-white transition-colors hover:bg-[#cf3529]"
                >
                  <Search className="h-4.5 w-4.5" />
                  Search Records
                </button>
              </div>

              {recentSearches.length > 0 && (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Recent
                  </span>
                  {recentSearches.map((item) => (
                    <button
                      key={item}
                      onClick={() => handleSearch(item)}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-rose-200 hover:text-rose-600"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-[18px] border border-slate-200 bg-white p-6 shadow-[0_18px_42px_rgba(15,23,42,0.08)]">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
                <Building2 className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-500">
                  API bridge
                </p>
                <h3 className="text-lg font-bold text-slate-900">Consultation sync only</h3>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-500">
              Vinavi stores clinical work here. Completed consultation details are sent through the ingest API for surveillance review; no button here starts AI directly.
            </p>

            <div className="mt-6 rounded-[28px] border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start gap-3">
                <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                <div>
                  <p className="text-sm font-semibold text-amber-900">Government patient history area</p>
                  <p className="mt-1 text-sm leading-6 text-amber-800/80">
                    Vinavi stays focused on consultation history, prescriptions, services, vitals, and
                    clinical documentation. Epidemiology tooling remains in the surveillance portal.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Registered Patients</p>
            <p className="mt-3 text-3xl font-bold text-slate-900">{stats.registeredPatients}</p>
            <p className="mt-2 text-sm text-slate-500">Patient registry available in Vinavi</p>
          </div>
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Consultation Episodes</p>
            <p className="mt-3 text-3xl font-bold text-slate-900">{stats.totalEpisodes}</p>
            <p className="mt-2 text-sm text-slate-500">Patient history episodes available for review</p>
          </div>
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Active Cases</p>
            <p className="mt-3 text-3xl font-bold text-rose-600">{stats.activeEpisodes}</p>
            <p className="mt-2 text-sm text-slate-500">Current open episodes requiring follow-up</p>
          </div>
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Allergy Flags</p>
            <p className="mt-3 text-3xl font-bold text-amber-600">{stats.allergyFlags}</p>
            <p className="mt-2 text-sm text-slate-500">Patients with visible medication risk markers</p>
          </div>
        </section>

        {searched && (
          <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-[0_32px_70px_rgba(15,23,42,0.06)]">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                  Search Results
                </p>
                <h3 className="mt-1 text-xl font-bold text-slate-900">
                  {results.length} patient{results.length !== 1 ? "s" : ""} found
                </h3>
              </div>
              <p className="text-sm text-slate-500">Query: {query}</p>
            </div>

            {results.length === 0 ? (
              <div className="flex flex-col items-center rounded-[28px] border border-dashed border-slate-200 bg-slate-50 px-6 py-14 text-center">
                <AlertCircle className="mb-3 h-8 w-8 text-rose-400" />
                <p className="text-base font-semibold text-slate-800">No patient matched that search</p>
                <p className="mt-2 text-sm text-slate-500">Try patient12312, patient00004, Ahmed, Mariyam, or a national ID.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {results.map((patient) => (
                  <button
                    key={patient.id}
                    onClick={() => handleSelectPatient(patient)}
                    className="group flex w-full items-start gap-4 rounded-[26px] border border-slate-200 bg-white px-5 py-5 text-left shadow-[0_18px_40px_rgba(15,23,42,0.04)] transition-all hover:-translate-y-0.5 hover:border-rose-200 hover:shadow-[0_28px_60px_rgba(15,23,42,0.08)]"
                  >
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 shrink-0">
                      <User className="h-6 w-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-lg font-semibold text-slate-900 transition-colors group-hover:text-rose-600">
                          {patient.name}
                        </h4>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500">
                          {patient.id}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-500">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="h-4 w-4 text-slate-400" /> {patient.age}y, {patient.gender}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <MapPin className="h-4 w-4 text-slate-400" /> {patient.island}, {patient.atoll}
                        </span>
                        <span className="font-mono text-slate-600">{patient.nationalId}</span>
                        <span>{patient.hospital}</span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
                          {patient.episodes.length} episode{patient.episodes.length !== 1 ? "s" : ""}
                        </span>
                        {patient.allergies.length > 0 && (
                          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                            Allergies: {patient.allergies.join(", ")}
                          </span>
                        )}
                      </div>
                    </div>
                    <ArrowRight className="mt-1 h-5 w-5 shrink-0 text-slate-300 transition-colors group-hover:text-rose-500" />
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {!searched && (
          <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-[0_32px_70px_rgba(15,23,42,0.06)]">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                    Recent Patient Profiles
                  </p>
                  <h3 className="mt-1 text-xl font-bold text-slate-900">Continue a clinical record</h3>
                </div>
                <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600">
                  Quick access
                </span>
              </div>
              <div className="space-y-3">
                {MOCK_PATIENTS.map((patient) => (
                  <button
                    key={patient.id}
                    onClick={() => handleSelectPatient(patient)}
                    className="group flex w-full items-center gap-4 rounded-[24px] border border-slate-200 bg-[#fbfcff] px-5 py-4 text-left transition-all hover:border-rose-200 hover:bg-white"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 shrink-0">
                      <User className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900">{patient.name}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {patient.id} · {patient.hospital} · {patient.episodes.length} episodes
                      </p>
                    </div>
                    <ArrowRight className="h-4.5 w-4.5 text-slate-300 transition-colors group-hover:text-rose-500" />
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-[0_32px_70px_rgba(15,23,42,0.06)]">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
                  <FileHeart className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-violet-500">
                    Clinical Focus
                  </p>
                  <h3 className="text-lg font-bold text-slate-900">Structured episode workflow</h3>
                </div>
              </div>

              <div className="mt-5 space-y-4 text-sm text-slate-500">
                <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                  <p className="font-semibold text-slate-800">1. Search patient</p>
                  <p className="mt-1 leading-6">Open the patient profile by ID, national ID, or full name.</p>
                </div>
                <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                  <p className="font-semibold text-slate-800">2. Open an episode</p>
                  <p className="mt-1 leading-6">Choose any consultation episode to review prior complaints, advice, and prescriptions.</p>
                </div>
                <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                  <p className="font-semibold text-slate-800">3. Continue documentation</p>
                  <p className="mt-1 leading-6">Use modal forms to append new complaint, advice, prescription, service, or vitals data into the document view.</p>
                </div>
                <div className="rounded-[24px] border border-slate-200 bg-[#fff8f6] p-4 text-slate-600">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <Clock3 className="h-4 w-4 text-rose-500" />
                    Audit logging enabled
                  </div>
                  <p className="mt-1 leading-6">Searches, patient opens, episode opens, and document additions are written into the local audit log.</p>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

export default function VinaviSearchPage() {
  return (
    <Suspense fallback={<div className="min-h-full" />}>
      <VinaviSearchContent />
    </Suspense>
  );
}
