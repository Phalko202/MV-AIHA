"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CalendarDays, Eye, MapPin, Phone, UserRound } from "lucide-react";
import { getPatient, type Episode } from "@/lib/mock-data";
import { log } from "@/lib/logger";

const TABS = ["CONSULTATIONS", "ADMISSIONS", "CASES", "MEDICAL CHECKUPS"] as const;
type PatientTab = typeof TABS[number];

function formatDate(value: string) {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function memoNumber(episode: Episode) {
  return episode.id.replace(/\D/g, "").slice(-7).padStart(7, "0");
}

export default function PatientPage({ params }: { params: Promise<{ patientId: string }> }) {
  const { patientId } = use(params);
  const router = useRouter();
  const patient = getPatient(patientId);
  const [activeTab, setActiveTab] = useState<PatientTab>("CONSULTATIONS");

  useEffect(() => {
    if (patient) log("PATIENT_VIEW", "PatientPage", { patientId, name: patient.name });
  }, [patient, patientId]);

  if (!patient) {
    return (
      <div className="flex min-h-full items-center justify-center p-6">
        <div className="w-full max-w-md border border-slate-200 bg-white p-8 text-center shadow">
          <AlertTriangle className="mx-auto h-10 w-10 text-rose-500" />
          <h2 className="mt-4 text-2xl font-semibold text-slate-900">Patient Not Found</h2>
          <p className="mt-2 text-sm text-slate-500">No clinical profile matched {patientId}.</p>
          <button onClick={() => router.push("/vinavi")} className="mt-6 bg-[#e34234] px-5 py-3 text-sm font-semibold text-white">Back to Search</button>
        </div>
      </div>
    );
  }

  const visibleEpisodes = activeTab === "ADMISSIONS" || activeTab === "MEDICAL CHECKUPS" ? [] : patient.episodes;

  return (
    <div className="min-h-full bg-[#f5f5f5] px-5 py-6 text-[#333]">
      <div className="mx-auto max-w-[1500px] space-y-5">
        <section className="border border-[#d7d7d7] bg-white shadow-sm">
          <div className="grid gap-8 px-6 py-8 lg:grid-cols-[260px_1fr]">
            <div>
              <h1 className="text-3xl font-normal text-[#333]">{patient.name}</h1>
              <p className="mt-5 text-lg text-[#444]">{patient.age} years</p>
              <p className="mt-4 text-lg text-[#444]">{patient.nationalId}</p>
              <div className="mt-2 h-[210px] w-[210px] border-[5px] border-red-600 bg-black" />
            </div>
            <div className="flex items-center">
              <div className="grid w-full max-w-2xl gap-7 text-lg text-[#444]">
                <div className="flex items-center gap-10"><UserRound className="h-6 w-6 text-[#777]" /><span>{patient.gender}</span></div>
                <div className="flex items-center gap-10"><CalendarDays className="h-6 w-6 text-[#777]" /><span>{formatDate(patient.dob)}</span></div>
                <div className="flex items-center gap-10"><MapPin className="h-6 w-6 text-[#777]" /><span>{patient.island}, {patient.atoll}</span></div>
                <div className="flex items-center gap-10"><Phone className="h-6 w-6 text-[#777]" /><span>{patient.phone}</span></div>
              </div>
            </div>
          </div>
        </section>

        <section className="border border-[#dedede] bg-white shadow-sm">
          <div className="flex h-[64px] items-center border-b border-[#ececec] bg-[#fafafa]">
            {TABS.map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`h-full px-8 text-lg font-semibold ${activeTab === tab ? "border-b-4 border-[#b7c5d0] text-[#4655c6]" : "text-[#777]"}`}>{tab}</button>
            ))}
            <Eye className="ml-auto mr-10 h-7 w-7 text-[#777]" />
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-base">
              <thead className="h-[96px] text-[#777]">
                <tr>
                  <th className="px-10 font-semibold">Created Date</th>
                  <th className="px-10 font-semibold">Memo #</th>
                  <th className="px-10 font-semibold">Doctor</th>
                  <th className="px-10 font-semibold">Visited On</th>
                  <th className="px-10 font-semibold">Status</th>
                  <th className="px-10 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e6e6e6]">
                {visibleEpisodes.map((episode) => (
                  <tr key={episode.id} className="h-[76px] hover:bg-[#fafafa]">
                    <td className="px-10 text-[#444]">{formatDate(episode.date)}</td>
                    <td className="px-10 text-[#444]">{memoNumber(episode)}</td>
                    <td className="px-10 text-[#444]">{episode.doctor.replace(/^Dr\.\s*/, "")}</td>
                    <td className="px-10 text-[#444]">{activeTab === "CASES" ? formatDate(episode.date) : "N/A"}</td>
                    <td className="px-10 text-[#444] capitalize">{episode.status}</td>
                    <td className="px-10">
                      <button onClick={() => {
                        log("EPISODE_SELECT", "PatientPage", { patientId, episodeId: episode.id });
                        router.push(`/vinavi/${patient.id}/${episode.id}`);
                      }} className="font-semibold text-[#4655c6] hover:text-[#2330a4]">OPEN</button>
                    </td>
                  </tr>
                ))}
                {visibleEpisodes.length === 0 && (
                  <tr><td colSpan={6} className="px-10 py-16 text-center text-[#777]">No {activeTab.toLowerCase()} records.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex h-[64px] items-center justify-end gap-10 border-t border-[#ececec] px-10 text-base text-[#777]">
            <span>Page: 1</span>
            <span>items: 1 - {Math.min(visibleEpisodes.length, 50)} of {visibleEpisodes.length}</span>
          </div>
        </section>
      </div>
    </div>
  );
}
