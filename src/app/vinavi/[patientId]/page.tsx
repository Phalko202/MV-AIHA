"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  Clock,
  Droplets,
  FileText,
  MapPin,
  Phone,
  Stethoscope,
  User,
} from "lucide-react";
import { getPatient } from "@/lib/mock-data";
import { log } from "@/lib/logger";

export default function PatientPage({ params }: { params: Promise<{ patientId: string }> }) {
  const { patientId } = use(params);
  const router = useRouter();
  const patient = getPatient(patientId);

  useEffect(() => {
    if (patient) {
      log("PATIENT_VIEW", "PatientPage", { patientId, name: patient.name });
    }
  }, [patient, patientId]);

  if (!patient) {
    return (
      <div className="flex min-h-full items-center justify-center p-6">
        <div className="w-full max-w-md rounded-[32px] border border-slate-200 bg-white p-8 text-center shadow-[0_32px_70px_rgba(15,23,42,0.06)]">
          <AlertTriangle className="mx-auto h-10 w-10 text-rose-500" />
          <h2 className="mt-4 text-2xl font-bold text-slate-900">Patient Not Found</h2>
          <p className="mt-2 text-sm text-slate-500">No clinical profile matched {patientId}.</p>
          <button
            onClick={() => router.push("/vinavi")}
            className="mt-6 inline-flex rounded-2xl bg-rose-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-rose-500"
          >
            Back to Search
          </button>
        </div>
      </div>
    );
  }

  const latestEpisode = patient.episodes[0];
  const activeEpisodes = patient.episodes.filter((episode) => episode.status === "active").length;

  return (
    <div className="min-h-full px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-[0_32px_70px_rgba(15,23,42,0.06)] sm:p-8">
          <div className="grid gap-6 xl:grid-cols-[1.45fr_0.9fr]">
            <div>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-[0_18px_32px_rgba(239,68,68,0.24)]">
                    <User className="h-7 w-7" />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-rose-500">Patient Profile</p>
                    <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">{patient.name}</h1>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                        {patient.id}
                      </span>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                        {patient.nationalId}
                      </span>
                      <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600">
                        {patient.hospital}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => router.push("/vinavi")}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 transition-colors hover:border-rose-200 hover:text-rose-600"
                >
                  Back to Search
                </button>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Demographics</p>
                  <p className="mt-3 flex items-center gap-2 text-sm text-slate-700"><Calendar className="h-4 w-4 text-slate-400" /> {patient.age}y, {patient.gender}</p>
                  <p className="mt-2 flex items-center gap-2 text-sm text-slate-700"><Droplets className="h-4 w-4 text-slate-400" /> Blood type {patient.bloodType}</p>
                </div>
                <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Location</p>
                  <p className="mt-3 flex items-center gap-2 text-sm text-slate-700"><MapPin className="h-4 w-4 text-slate-400" /> {patient.island}, {patient.atoll}</p>
                  <p className="mt-2 flex items-center gap-2 text-sm text-slate-700"><Phone className="h-4 w-4 text-slate-400" /> {patient.phone}</p>
                </div>
                <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4 sm:col-span-2 xl:col-span-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Clinical Markers</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {patient.allergies.length > 0 ? (
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                        Allergies: {patient.allergies.join(", ")}
                      </span>
                    ) : (
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                        No allergy flags
                      </span>
                    )}
                    {patient.conditions.map((condition) => (
                      <span key={condition} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
                        {condition}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <div className="rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,#fff8f8_0%,#ffffff_100%)] p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Open Episodes</p>
                <p className="mt-3 text-4xl font-bold text-rose-600">{activeEpisodes}</p>
                <p className="mt-2 text-sm text-slate-500">Episodes currently requiring clinician follow-up</p>
              </div>
              <div className="rounded-[28px] border border-slate-200 bg-white p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Latest Visit</p>
                <p className="mt-3 text-xl font-bold text-slate-900">{latestEpisode?.date}</p>
                <p className="mt-2 text-sm text-slate-500">{latestEpisode?.diagnosis}</p>
              </div>
              <div className="rounded-[28px] border border-slate-200 bg-white p-5 sm:col-span-2 xl:col-span-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Registered Since</p>
                <p className="mt-3 text-xl font-bold text-slate-900">{patient.registeredAt.slice(0, 10)}</p>
                <p className="mt-2 text-sm text-slate-500">Profile anchored to {patient.hospital}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-[0_32px_70px_rgba(15,23,42,0.06)]">
            <div className="mb-4 flex items-center gap-2">
              <FileText className="h-4.5 w-4.5 text-rose-500" />
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Care Summary</p>
                <h2 className="text-lg font-bold text-slate-900">Patient overview at a glance</h2>
              </div>
            </div>

            <div className="space-y-4 text-sm text-slate-600">
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                <p className="font-semibold text-slate-900">Primary hospital</p>
                <p className="mt-1 leading-6">{patient.hospital} is the main facility recorded against this patient profile.</p>
              </div>
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                <p className="font-semibold text-slate-900">Chronic conditions</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {patient.conditions.map((condition) => (
                    <span key={condition} className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-[inset_0_0_0_1px_rgba(226,232,240,0.9)]">
                      {condition}
                    </span>
                  ))}
                </div>
              </div>
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                <p className="font-semibold text-slate-900">Episode workflow</p>
                <p className="mt-1 leading-6">Open any episode below to continue complaints, advice, prescriptions, services, or vitals documentation.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-[0_32px_70px_rgba(15,23,42,0.06)]">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Consultation Episodes</p>
              <h2 className="text-xl font-bold text-slate-900">Patient history timeline</h2>
            </div>
            <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600">
              {patient.episodes.length} total episodes
            </span>
          </div>

          <div className="space-y-3">
            {patient.episodes.map((episode) => {
              const statusClassName =
                episode.status === "active"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 bg-slate-100 text-slate-600";

              return (
                <button
                  key={episode.id}
                  onClick={() => {
                    log("EPISODE_SELECT", "PatientPage", { patientId, episodeId: episode.id });
                    router.push(`/vinavi/${patient.id}/${episode.id}`);
                  }}
                  className="group flex w-full items-start gap-4 rounded-[28px] border border-slate-200 bg-[#fbfcff] px-5 py-5 text-left shadow-[0_18px_40px_rgba(15,23,42,0.04)] transition-all hover:-translate-y-0.5 hover:border-rose-200 hover:bg-white"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 shrink-0">
                    <Stethoscope className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-slate-900 transition-colors group-hover:text-rose-600">
                        {episode.id}
                      </h3>
                      <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusClassName}`}>
                        {episode.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-500">
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-4 w-4 text-slate-400" /> {episode.date}
                      </span>
                      <span>{episode.doctor}</span>
                      <span>{episode.specialty}</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-700">{episode.diagnosis}</p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                      <span className="rounded-full border border-slate-200 bg-white px-3 py-1">{episode.sections.length} sections</span>
                      <span className="rounded-full border border-slate-200 bg-white px-3 py-1">{episode.vitals.length} vitals</span>
                    </div>
                  </div>
                  <ArrowRight className="mt-1 h-5 w-5 shrink-0 text-slate-300 transition-colors group-hover:text-rose-500" />
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
