"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  BookOpen,
  ChevronLeft,
  Clock,
  FileText,
  HeartPulse,
  MessageSquare,
  Pill,
  Plus,
  Printer,
  Stethoscope,
  Wrench,
  X,
} from "lucide-react";
import { getEpisode, type SectionEntry } from "@/lib/mock-data";
import { log } from "@/lib/logger";

const SECTION_CONFIG = {
  complaint: { label: "Complaint", icon: MessageSquare, accent: "text-amber-600", chip: "bg-amber-50 border-amber-200 text-amber-700" },
  advice: { label: "Medical Advice", icon: BookOpen, accent: "text-sky-600", chip: "bg-sky-50 border-sky-200 text-sky-700" },
  prescription: { label: "Prescription", icon: Pill, accent: "text-emerald-600", chip: "bg-emerald-50 border-emerald-200 text-emerald-700" },
  service: { label: "Services", icon: Wrench, accent: "text-violet-600", chip: "bg-violet-50 border-violet-200 text-violet-700" },
  vital: { label: "Vitals", icon: HeartPulse, accent: "text-rose-600", chip: "bg-rose-50 border-rose-200 text-rose-700" },
} as const;

type SectionType = keyof typeof SECTION_CONFIG;
const SECTION_TABS: SectionType[] = ["complaint", "advice", "prescription", "service", "vital"];

function formatTimestamp(value: string) {
  return value.replace("T", " ").slice(0, 16);
}

function formatTime(value: string) {
  return value.slice(11, 16);
}

function AddSectionModal({
  type,
  onClose,
  onSave,
}: {
  type: SectionType;
  onClose: () => void;
  onSave: (entry: SectionEntry) => void;
}) {
  const [title, setTitle] = useState<string>(SECTION_CONFIG[type].label);
  const [content, setContent] = useState("");
  const config = SECTION_CONFIG[type];
  const Icon = config.icon;

  const handleSave = () => {
    if (!content.trim()) {
      return;
    }

    const entry: SectionEntry = {
      id: `s-${Date.now()}`,
      type,
      title,
      content: content.trim(),
      createdAt: new Date().toISOString(),
      createdBy: "Dr. Session User",
    };

    onSave(entry);
    log("SECTION_ADD", "EpisodePage", { type, title, contentLength: content.length });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-[32px] border border-slate-200 bg-white shadow-[0_40px_90px_rgba(15,23,42,0.2)] animate-fadeIn">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-50 text-slate-700">
              <Icon className={`h-5 w-5 ${config.accent}`} />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Add Section</p>
              <h3 className="text-lg font-bold text-slate-900">{config.label}</h3>
            </div>
          </div>
          <button onClick={onClose} className="rounded-xl border border-slate-200 p-2 text-slate-400 transition-colors hover:text-slate-700">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 px-6 py-6">
          <div>
            <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Title</label>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition-colors focus:border-rose-300 focus:bg-white"
            />
          </div>
          <div>
            <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Content</label>
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              rows={7}
              placeholder={`Write the ${config.label.toLowerCase()} details here...`}
              className="w-full resize-none rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition-colors focus:border-rose-300 focus:bg-white"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-5">
          <button
            onClick={onClose}
            className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:text-slate-900"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!content.trim()}
            className="rounded-2xl bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-rose-500 disabled:cursor-not-allowed disabled:bg-rose-300"
          >
            Add to Document
          </button>
        </div>
      </div>
    </div>
  );
}

export default function EpisodePage({
  params,
}: {
  params: Promise<{ patientId: string; episodeId: string }>;
}) {
  const { patientId, episodeId } = use(params);
  const router = useRouter();
  const documentRef = useRef<HTMLDivElement>(null);
  const result = getEpisode(patientId, episodeId);

  const [activeTab, setActiveTab] = useState<SectionType>("complaint");
  const [modalType, setModalType] = useState<SectionType | null>(null);
  const [localSections, setLocalSections] = useState<SectionEntry[]>(() => result?.episode.sections ?? []);

  useEffect(() => {
    if (result) {
      log("EPISODE_VIEW", "EpisodePage", { patientId, episodeId, doctor: result.episode.doctor });
    }
  }, [patientId, episodeId]);

  if (!result) {
    return (
      <div className="flex min-h-full items-center justify-center p-6">
        <div className="w-full max-w-md rounded-[32px] border border-slate-200 bg-white p-8 text-center shadow-[0_32px_70px_rgba(15,23,42,0.06)]">
          <AlertTriangle className="mx-auto h-10 w-10 text-rose-500" />
          <h2 className="mt-4 text-2xl font-bold text-slate-900">Episode Not Found</h2>
          <p className="mt-2 text-sm text-slate-500">Patient {patientId} has no episode {episodeId}.</p>
          <button
            onClick={() => router.push(`/vinavi/${patientId}`)}
            className="mt-6 inline-flex rounded-2xl bg-rose-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-rose-500"
          >
            Back to Patient
          </button>
        </div>
      </div>
    );
  }

  const { patient, episode } = result;

  const visibleSections = useMemo(
    () => localSections.filter((section) => section.type === activeTab),
    [activeTab, localSections]
  );

  const handleSaveEntry = (entry: SectionEntry) => {
    setLocalSections((previous) => [...previous, entry]);
    setModalType(null);
    setTimeout(() => {
      const container = documentRef.current;
      if (container) {
        container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
      }
    }, 120);
  };

  const handlePrint = () => {
    log("DOCUMENT_PRINT", "EpisodePage", { patientId, episodeId, section: activeTab, sectionsCount: visibleSections.length });
    window.print();
  };

  const entryCount = activeTab === "vital" ? episode.vitals.length : visibleSections.length;

  return (
    <div className="min-h-full px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-[0_32px_70px_rgba(15,23,42,0.06)] sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <button
                onClick={() => router.push(`/vinavi/${patientId}`)}
                className="mt-1 rounded-2xl border border-slate-200 bg-white p-3 text-slate-500 transition-colors hover:border-rose-200 hover:text-rose-600"
              >
                <ChevronLeft className="h-4.5 w-4.5" />
              </button>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-rose-500">Episode Workspace</p>
                <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">{episode.id}</h1>
                <div className="mt-3 flex flex-wrap gap-2 text-sm text-slate-500">
                  <span>{patient.name}</span>
                  <span>·</span>
                  <span>{episode.doctor}</span>
                  <span>·</span>
                  <span>{episode.specialty}</span>
                  <span>·</span>
                  <span className="flex items-center gap-1"><Clock className="h-4 w-4 text-slate-400" /> {episode.date}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${episode.status === "active" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-100 text-slate-600"}`}>
                {episode.status.toUpperCase()}
              </span>
              <button
                onClick={handlePrint}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 transition-colors hover:border-rose-200 hover:text-rose-600"
              >
                <Printer className="h-4 w-4" />
                Print
              </button>
            </div>
          </div>

          <div className="mt-5 rounded-[24px] border border-rose-100 bg-[linear-gradient(180deg,#fff8f8_0%,#ffffff_100%)] px-5 py-4 text-sm text-slate-700">
            <span className="font-semibold text-rose-600">Diagnosis:</span> {episode.diagnosis}
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[260px_1fr]">
          <aside className="rounded-[32px] border border-slate-200 bg-white p-4 shadow-[0_32px_70px_rgba(15,23,42,0.06)]">
            <p className="px-2 pb-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Episode Sections</p>
            <div className="space-y-1.5">
              {SECTION_TABS.map((type) => {
                const config = SECTION_CONFIG[type];
                const Icon = config.icon;
                const count = type === "vital" ? episode.vitals.length : localSections.filter((section) => section.type === type).length;
                const active = activeTab === type;

                return (
                  <button
                    key={type}
                    onClick={() => setActiveTab(type)}
                    className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium transition-all ${active ? "bg-rose-50 text-rose-700 shadow-[inset_0_0_0_1px_rgba(244,63,94,0.12)]" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}
                  >
                    <Icon className={`h-4.5 w-4.5 ${active ? config.accent : "text-slate-400"}`} />
                    <span className="flex-1">{config.label}</span>
                    <span className="rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-slate-500 shadow-[inset_0_0_0_1px_rgba(226,232,240,0.9)]">
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-6 rounded-[28px] border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">Document actions</p>
              <p className="mt-1 text-sm leading-6 text-slate-500">Open a section, add new content through the popup form, and keep the clinical document structured for printing.</p>
              <button
                onClick={() => setModalType(activeTab)}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-rose-500"
              >
                <Plus className="h-4 w-4" />
                Add {SECTION_CONFIG[activeTab].label}
              </button>
            </div>
          </aside>

          <div className="min-w-0 rounded-[32px] border border-slate-200 bg-white shadow-[0_32px_70px_rgba(15,23,42,0.06)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-50 text-slate-700">
                  {(() => {
                    const ActiveIcon = SECTION_CONFIG[activeTab].icon;
                    return <ActiveIcon className={`h-5 w-5 ${SECTION_CONFIG[activeTab].accent}`} />;
                  })()}
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Clinical Document</p>
                  <h2 className="text-lg font-bold text-slate-900">{SECTION_CONFIG[activeTab].label}</h2>
                </div>
              </div>
              <span className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${SECTION_CONFIG[activeTab].chip}`}>
                {entryCount} {activeTab === "vital" ? (entryCount === 1 ? "reading" : "readings") : (entryCount === 1 ? "entry" : "entries")}
              </span>
            </div>

            <div ref={documentRef} className="max-h-[calc(100vh-320px)] overflow-auto p-6">
              <div className="mx-auto max-w-4xl rounded-[30px] border border-slate-200 bg-[#fffefc] shadow-[0_28px_60px_rgba(15,23,42,0.08)] print:border-slate-200 print:shadow-none">
                <div className="border-b border-slate-200 px-8 py-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-rose-500">Ministry of Health</p>
                      <h3 className="mt-1 text-xl font-bold text-slate-900">Clinical Record Document</h3>
                      <p className="mt-2 text-sm text-slate-500">Episode {episode.id} · {episode.date} · {episode.doctor}</p>
                    </div>
                    <div className="text-right text-sm text-slate-500">
                      <p className="font-semibold text-slate-900">{patient.name}</p>
                      <p>{patient.id} · {patient.nationalId}</p>
                    </div>
                  </div>
                </div>

                {activeTab === "vital" ? (
                  <div className="px-8 py-6">
                    <div className="mb-4 flex items-center gap-2">
                      <HeartPulse className="h-4.5 w-4.5 text-rose-600" />
                      <h4 className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Vital Signs</h4>
                    </div>
                    <div className="overflow-x-auto rounded-[24px] border border-slate-200">
                      <table className="min-w-full text-sm">
                        <thead className="bg-slate-50 text-slate-500">
                          <tr>
                            <th className="px-4 py-3 text-left font-semibold">Time</th>
                            <th className="px-4 py-3 text-left font-semibold">Blood Pressure</th>
                            <th className="px-4 py-3 text-left font-semibold">Heart Rate</th>
                            <th className="px-4 py-3 text-left font-semibold">Temperature</th>
                            <th className="px-4 py-3 text-left font-semibold">SpO2</th>
                            <th className="px-4 py-3 text-left font-semibold">Respiratory Rate</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 text-slate-700">
                          {episode.vitals.map((vital, index) => (
                            <tr key={`${vital.timestamp}-${index}`}>
                              <td className="px-4 py-3 font-mono text-slate-600">{formatTime(vital.timestamp)}</td>
                              <td className="px-4 py-3">{vital.bp}</td>
                              <td className="px-4 py-3">{vital.heartRate} bpm</td>
                              <td className="px-4 py-3">{vital.temp}°C</td>
                              <td className={`px-4 py-3 ${vital.spo2 < 95 ? "font-semibold text-rose-600" : ""}`}>{vital.spo2}%</td>
                              <td className="px-4 py-3">{vital.respRate}/min</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-200">
                    {visibleSections.map((section) => {
                      const sectionMeta = SECTION_CONFIG[section.type];
                      const SectionIcon = sectionMeta.icon;

                      return (
                        <article key={section.id} className="px-8 py-6">
                          <div className="flex flex-wrap items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-50 text-slate-700">
                              <SectionIcon className={`h-4.5 w-4.5 ${sectionMeta.accent}`} />
                            </div>
                            <div className="flex-1">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">{SECTION_CONFIG[section.type].label}</p>
                              <h4 className="text-base font-semibold text-slate-900">{section.title}</h4>
                            </div>
                            <span className="text-xs font-mono text-slate-400">{formatTimestamp(section.createdAt)}</span>
                          </div>
                          <p className="mt-4 whitespace-pre-wrap pl-[52px] text-sm leading-7 text-slate-700">{section.content}</p>
                          <p className="mt-3 pl-[52px] text-xs text-slate-400">Recorded by {section.createdBy}</p>
                        </article>
                      );
                    })}

                    {visibleSections.length === 0 && (
                      <div className="px-8 py-16 text-center text-slate-500">
                        <FileText className="mx-auto mb-3 h-8 w-8 text-slate-300" />
                        <p className="text-sm font-medium text-slate-700">No {SECTION_CONFIG[activeTab].label.toLowerCase()} entries yet</p>
                        <p className="mt-2 text-sm">Use the Add button to continue documentation for this episode.</p>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-8 py-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  <span>Generated by MV-AIHA Vinavi</span>
                  <span>Authorized government clinical record</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {modalType && <AddSectionModal type={modalType} onClose={() => setModalType(null)} onSave={handleSaveEntry} />}
    </div>
  );
}
