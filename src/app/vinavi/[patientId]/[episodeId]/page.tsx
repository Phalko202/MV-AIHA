"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Bed, ChevronLeft, FileText, HeartPulse, MessageSquare, Pill, Printer, Stethoscope, Wrench } from "lucide-react";
import { getEpisode, type SectionEntry } from "@/lib/mock-data";
import { log } from "@/lib/logger";

const SECTION_TABS = [
  { label: "CLINICAL DETAILS", icon: FileText },
  { label: "COMPLAINS", icon: MessageSquare },
  { label: "ADVICE", icon: MessageSquare },
  { label: "VITALS", icon: HeartPulse },
  { label: "DIAGNOSIS", icon: Stethoscope },
  { label: "PRESCRIPTION", icon: Pill },
  { label: "SERVICE", icon: Bed },
];

function formatDate(value: string) {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function sectionOf(sections: SectionEntry[], type: SectionEntry["type"]) {
  return sections.filter((section) => section.type === type);
}

function cleanDoctor(value: string) {
  return value.replace(/^Dr\.\s*/, "");
}

export default function EpisodePage({ params }: { params: Promise<{ patientId: string; episodeId: string }> }) {
  const { patientId, episodeId } = use(params);
  const router = useRouter();
  const result = getEpisode(patientId, episodeId);

  useEffect(() => {
    if (result) log("EPISODE_VIEW", "EpisodePage", { patientId, episodeId, doctor: result.episode.doctor });
  }, [patientId, episodeId, result]);

  if (!result) {
    return (
      <div className="flex min-h-full items-center justify-center p-6">
        <div className="w-full max-w-md border border-slate-200 bg-white p-8 text-center shadow">
          <AlertTriangle className="mx-auto h-10 w-10 text-rose-500" />
          <h2 className="mt-4 text-2xl font-semibold text-slate-900">Episode Not Found</h2>
          <p className="mt-2 text-sm text-slate-500">Patient {patientId} has no episode {episodeId}.</p>
          <button onClick={() => router.push(`/vinavi/${patientId}`)} className="mt-6 bg-[#e34234] px-5 py-3 text-sm font-semibold text-white">Back to Patient</button>
        </div>
      </div>
    );
  }

  const { patient, episode } = result;
  const prescriptionSections = sectionOf(episode.sections, "prescription");
  const complaintSections = sectionOf(episode.sections, "complaint");
  const adviceSections = sectionOf(episode.sections, "advice");
  const serviceSections = sectionOf(episode.sections, "service");
  const prescriptionLines = prescriptionSections.flatMap((section) => section.content.split("\n").filter(Boolean));
  const date = new Date(`${episode.date}T00:00:00Z`);

  return (
    <div className="min-h-full bg-[#f5f5f5] px-5 py-6 text-[#333]">
      <div className="mx-auto max-w-[1120px]">
        <button onClick={() => router.push(`/vinavi/${patient.id}`)} className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-[#4655c6]"><ChevronLeft className="h-4 w-4" />Patient View</button>

        <section className="border border-[#d7d7d7] bg-white shadow-sm">
          <div className="flex h-[74px] items-center bg-[#4354c2] px-6 text-white">
            <h1 className="text-2xl font-normal">Episode History <span className="text-lg opacity-80">· Outpatient</span></h1>
            <div className="ml-auto flex h-full items-center gap-10 text-sm font-semibold uppercase tracking-wide opacity-90">
              <span>PATIENT VIEW</span><span>NDR FORM</span><span>REFERRAL FORM</span><span>CREATE ADMISSION</span><span>EEV</span>
            </div>
          </div>

          <div className="grid gap-8 px-8 py-8 md:grid-cols-4">
            <div><p className="font-bold text-[#333]">{patient.name}</p><p className="font-bold text-[#333]">{patient.nationalId}</p><p className="text-sm font-bold text-[#333]">{formatDate(patient.dob)} ({patient.age}y)</p></div>
            <div><p className="text-lg text-[#444]">{cleanDoctor(episode.doctor)}</p><p className="font-semibold text-[#777]">Professional</p></div>
            <div><p className="text-lg text-[#444]">{patient.hospital}</p><p className="font-semibold text-[#777]">Service Provider</p></div>
            <div><p className="text-lg text-[#444]">{formatDate(episode.date)}</p><p className="font-semibold text-[#777]">Episode Expiry</p></div>
          </div>

          <div className="flex flex-wrap items-center gap-x-9 gap-y-3 border-t border-[#ededed] px-8 py-5 text-sm font-bold text-[#555]">
            {SECTION_TABS.map((tab) => {
              const Icon = tab.icon;
              return <span key={tab.label} className="inline-flex items-center gap-2"><Icon className="h-5 w-5 text-[#777]" />{tab.label}</span>;
            })}
          </div>
        </section>

        <section className="mt-5 grid grid-cols-[90px_1fr] gap-6 border-t border-[#d7d7d7] pt-3">
          <aside className="pt-6 text-center">
            <p className="text-4xl font-normal text-[#333]">{date.getUTCDate().toString().padStart(2, "0")}</p>
            <p className="text-base text-[#333]">{date.toLocaleDateString("en-GB", { weekday: "short" })}</p>
            <p className="text-base text-[#333]">{date.toLocaleDateString("en-GB", { month: "short", year: "numeric" })}</p>
          </aside>

          <div className="space-y-3">
            <article className="border border-[#d8d8d8] bg-white">
              <div className="flex h-[64px] items-center bg-[#48ad4d] px-6 text-white">
                <Pill className="mr-4 h-6 w-6" />
                <h2 className="text-2xl font-normal">Prescription - PR/{episode.id.replace(/\D/g, "").slice(-6)}/2026/{(patient.episodes.indexOf(episode) + 1).toString().padStart(4, "0")}</h2>
                <Printer className="ml-auto h-6 w-6" />
              </div>
              <div className="px-6 py-6">
                <p className="font-bold text-[#555]">{cleanDoctor(episode.doctor)}</p>
                <p className="text-sm font-semibold text-[#777]">Prescribed By</p>
                <div className="mt-8 overflow-x-auto">
                  <table className="min-w-full text-left text-sm text-[#777]">
                    <thead><tr><th className="py-3">Code</th><th>Name</th><th>Strength</th><th>Preparation</th><th>Diagnosis</th><th>Instructions</th></tr></thead>
                    <tbody>
                      {(prescriptionLines.length ? prescriptionLines : ["No medicine prescribed"]).map((line, index) => (
                        <tr key={`${line}-${index}`} className="border-t border-[#ededed]"><td className="py-4">{index + 1}</td><td className="pr-4 font-semibold text-[#444]">{line.replace(/^\d+\.\s*/, "").split("—")[0]}</td><td>As charted</td><td>Tablet</td><td>{episode.diagnosis}</td><td>{line.includes("—") ? line.split("—").slice(1).join("—") : "As directed"}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </article>

            <article className="border border-[#d8d8d8] bg-white">
              <div className="flex h-[64px] items-center bg-[#638391] px-6 text-white">
                <Stethoscope className="mr-4 h-6 w-6" />
                <h2 className="text-2xl font-normal">Diagnosis</h2>
                <span className="ml-auto text-sm">{formatDate(episode.date)}</span>
              </div>
              <div className="px-6 py-7">
                <p className="font-bold text-[#555]">{cleanDoctor(episode.doctor)}</p>
                <p className="text-sm font-semibold text-[#777]">Diagnosed By</p>
                <p className="mt-8 text-base text-[#444]">{episode.diagnosis}</p>
              </div>
            </article>

            <article className="border border-[#d8d8d8] bg-white">
              <div className="flex h-[58px] items-center bg-[#f7f7f7] px-6 text-[#444]"><MessageSquare className="mr-4 h-5 w-5" /><h2 className="text-xl font-semibold">Clinical Details</h2></div>
              <div className="grid gap-4 px-6 py-6 md:grid-cols-2">
                <ClinicalBlock title="Complaints" rows={complaintSections} />
                <ClinicalBlock title="Advice" rows={adviceSections} />
                <ClinicalBlock title="Service" rows={serviceSections} />
                <div className="border border-[#ededed] p-4">
                  <p className="font-bold text-[#555]">Vitals</p>
                  <div className="mt-3 space-y-2 text-sm text-[#555]">
                    {episode.vitals.map((vital) => <p key={vital.timestamp}>{vital.timestamp.slice(11, 16)} · BP {vital.bp} · HR {vital.heartRate} · Temp {vital.temp}C · SpO2 {vital.spo2}%</p>)}
                  </div>
                </div>
              </div>
            </article>
          </div>
        </section>
      </div>
    </div>
  );
}

function ClinicalBlock({ title, rows }: { title: string; rows: SectionEntry[] }) {
  return (
    <div className="border border-[#ededed] p-4">
      <p className="font-bold text-[#555]">{title}</p>
      <div className="mt-3 space-y-3 text-sm leading-6 text-[#555]">
        {rows.length === 0 && <p>No entries.</p>}
        {rows.map((row) => <p key={row.id}>{row.content}</p>)}
      </div>
    </div>
  );
}
