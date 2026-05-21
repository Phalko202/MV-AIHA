"use client";

import { useMemo, useState } from "react";
import { Activity, ArrowLeft, CalendarDays, Check, ChevronDown, Download, FileText, Filter, MapPin, Search, ShieldCheck, UserRound, X } from "lucide-react";
import {
  DISEASE_BY_CODE,
  encountersFor,
  FACILITIES,
  type DiseaseCode,
  type PatientEncounter,
} from "@/lib/surveillance-api";

const severityColor = {
  mild: "bg-emerald-50 text-emerald-700 border-emerald-200",
  moderate: "bg-amber-50 text-amber-700 border-amber-200",
  severe: "bg-orange-50 text-orange-700 border-orange-200",
  critical: "bg-red-50 text-red-700 border-red-200",
};

const outcomeColor = {
  recovered: "text-emerald-600 bg-emerald-50 border-emerald-100",
  active: "text-blue-600 bg-blue-50 border-blue-100",
  referred: "text-amber-600 bg-amber-50 border-amber-100",
  deceased: "text-red-700 bg-red-50 border-red-100",
};

type SeverityFilter = "all" | PatientEncounter["severity"];
type OriginFilter = "all" | PatientEncounter["origin"];

interface Props {
  disease: DiseaseCode | "all";
  filter?: Partial<PatientEncounter>;
  label?: string;
  onClose: () => void;
}

const PAGE = 18;

export default function EncounterLog({ disease, filter, label, onClose }: Props) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState<SeverityFilter>("all");
  const [origin, setOrigin] = useState<OriginFilter>("all");
  const [selected, setSelected] = useState<PatientEncounter | null>(null);

  const all = useMemo(() => {
    let list = encountersFor(disease);
    if (filter) {
      list = list.filter((encounter) => matchesPartialFilter(encounter, filter));
    }
    return list;
  }, [disease, filter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter((encounter) => {
      if (severity !== "all" && encounter.severity !== severity) return false;
      if (origin !== "all" && encounter.origin !== origin) return false;
      if (!q) return true;
      return searchableText(encounter).includes(q);
    });
  }, [all, search, severity, origin]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const slice = filtered.slice((page - 1) * PAGE, page * PAGE);

  const facById = (id: string) => FACILITIES.find((facility) => facility.id === id)?.shortName ?? id;
  const activeTitle = label ?? (disease === "all" ? "All encounters" : DISEASE_BY_CODE[disease].name);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-md p-4" onClick={onClose}>
      <div className="relative flex max-h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-[28px] border border-white/80 bg-white/90 shadow-[0_34px_90px_rgba(15,23,42,0.24)]" onClick={(event) => event.stopPropagation()}>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_12%_10%,rgba(37,99,235,0.16),transparent_30%),radial-gradient(circle_at_88%_18%,rgba(20,184,166,0.16),transparent_28%)]" />

        <div className="relative flex items-start justify-between gap-4 border-b border-white/80 bg-white/75 px-6 py-4 backdrop-blur-xl">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-600" />
              <span className="text-[10px] font-black uppercase tracking-wider text-blue-600">Patient Encounter Reader</span>
              {selected && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-black text-blue-700">Case sheet</span>}
            </div>
            <h2 className="truncate text-xl font-black tracking-tight text-slate-950">{selected ? selected.episodeId : activeTitle}</h2>
            <p className="text-xs text-slate-500">
              {filtered.length.toLocaleString()} de-identified encounter{filtered.length === 1 ? "" : "s"} · no PII shown
              {disease !== "all" && ` · ICD-10 ${DISEASE_BY_CODE[disease].icd10}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {selected && (
              <button onClick={() => setSelected(null)} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-700 shadow-sm hover:bg-slate-50 cursor-pointer">
                <ArrowLeft className="h-4 w-4" /> Back to log
              </button>
            )}
            <button onClick={onClose} className="rounded-2xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {selected ? (
          <EncounterDetail encounter={selected} facilityName={facById(selected.facilityId)} />
        ) : (
          <>
            <div className="relative grid grid-cols-1 gap-3 border-b border-white/80 bg-slate-50/62 px-6 py-4 xl:grid-cols-[1fr_auto_auto_auto]">
              <label className="flex min-h-12 items-center gap-2 rounded-2xl border border-white/80 bg-white/90 px-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.82),0_10px_24px_rgba(15,23,42,0.04)]">
                <Search className="h-4 w-4 text-blue-500" />
                <input
                  value={search}
                  onChange={(event) => { setSearch(event.target.value); setPage(1); }}
                  placeholder="Search patient key, episode, disease, origin, atoll, facility, symptoms, prescription..."
                  className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-400"
                />
              </label>
              <EncounterFilterMenu
                icon={Filter}
                label="Severity"
                value={severity}
                options={[
                  { value: "all", label: "All severity", detail: "Every triage level" },
                  { value: "mild", label: "Mild", detail: "Low acuity records" },
                  { value: "moderate", label: "Moderate", detail: "Watch-list records" },
                  { value: "severe", label: "Severe", detail: "High acuity records" },
                  { value: "critical", label: "Critical", detail: "Immediate review records" },
                ]}
                onChange={(next) => { setSeverity(next as SeverityFilter); setPage(1); }}
              />
              <EncounterFilterMenu
                icon={UserRound}
                label="Origin"
                value={origin}
                options={[
                  { value: "all", label: "All origin", detail: "Local and foreign records" },
                  { value: "local", label: "Local", detail: "Maldivian resident records" },
                  { value: "foreign", label: "Foreign", detail: "Passport/work-permit records" },
                ]}
                onChange={(next) => { setOrigin(next as OriginFilter); setPage(1); }}
              />
              <button className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/80 bg-white/90 px-4 py-3 text-xs font-black text-slate-600 shadow-sm hover:text-slate-950 cursor-pointer">
                <Download className="h-4 w-4" /> Export CSV
              </button>
            </div>

            <div className="relative flex-1 overflow-auto bg-white/45">
              <table className="w-full min-w-[1180px] text-xs">
                <thead className="sticky top-0 z-10 bg-white/95 backdrop-blur-xl">
                  <tr className="text-left text-[10px] font-black uppercase tracking-wide text-slate-500">
                    <th className="px-5 py-3">Patient / Episode</th>
                    <th className="px-4 py-3">Disease</th>
                    <th className="px-4 py-3">Dates</th>
                    <th className="px-4 py-3">Age / Sex</th>
                    <th className="px-4 py-3">Origin</th>
                    <th className="px-4 py-3">Location</th>
                    <th className="px-4 py-3">Symptoms</th>
                    <th className="px-4 py-3">Prescription signal</th>
                    <th className="px-4 py-3">Severity</th>
                    <th className="px-4 py-3">Outcome</th>
                    <th className="px-4 py-3">AI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/70">
                  {slice.map((encounter) => (
                    <tr key={encounter.id} onClick={() => setSelected(encounter)} className="group cursor-pointer bg-white/50 transition-all hover:bg-blue-50/50">
                      <td className="px-5 py-3 font-mono text-slate-800"><span className="font-black text-slate-950">{encounter.patientKey}</span><br /><span className="text-[10px] text-blue-600">{encounter.episodeId}</span></td>
                      <td className="px-4 py-3"><span className="font-black text-slate-800">{DISEASE_BY_CODE[encounter.diseaseCode].name}</span><br /><span className="text-[10px] text-slate-400">{DISEASE_BY_CODE[encounter.diseaseCode].icd10}</span></td>
                      <td className="px-4 py-3 text-slate-600"><span className="font-bold">Onset {encounter.onsetDate}</span><br /><span className="text-[10px] text-slate-400">Admit {encounter.admissionDate}</span></td>
                      <td className="px-4 py-3 text-slate-700"><span className="font-black">{encounter.ageBracket}</span><br /><span className="text-[10px] text-slate-400">{encounter.gender}</span></td>
                      <td className="px-4 py-3 capitalize text-slate-700"><span className="font-black">{encounter.origin}</span><br /><span className="text-[10px] text-slate-400">{encounter.identifierKind}</span></td>
                      <td className="px-4 py-3 text-slate-700"><span className="font-black">{encounter.atoll}</span><br /><span className="text-[10px] text-blue-600">{facById(encounter.facilityId)}</span></td>
                      <td className="max-w-[210px] px-4 py-3 leading-relaxed text-slate-600">{encounter.symptoms.join(", ")}</td>
                      <td className="max-w-[220px] px-4 py-3 leading-relaxed text-slate-600">{encounter.prescriptionSignals.join(", ")}</td>
                      <td className="px-4 py-3"><span className={`rounded-lg border px-2 py-1 text-[10px] font-black ${severityColor[encounter.severity]}`}>{encounter.severity}</span></td>
                      <td className="px-4 py-3"><span className={`rounded-lg border px-2 py-1 text-[10px] font-black capitalize ${outcomeColor[encounter.outcome]}`}>{encounter.outcome}</span></td>
                      <td className="px-4 py-3 font-mono text-slate-600"><span className="font-black text-slate-950">{encounter.aiConfidence.toFixed(2)}</span><br /><span className="text-[10px] text-slate-400">read</span></td>
                    </tr>
                  ))}
                  {slice.length === 0 && (
                    <tr><td colSpan={11} className="px-4 py-12 text-center text-slate-400">No encounters match this filter.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="relative flex items-center justify-between border-t border-white/80 bg-slate-50/70 px-6 py-3">
              <span className="text-xs font-semibold text-slate-500">
                Page {page} of {totalPages} · {filtered.length.toLocaleString()} total · click any row to read the case sheet
              </span>
              <div className="flex items-center gap-2">
                <button disabled={page === 1} onClick={() => setPage(page - 1)} className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-700 disabled:cursor-not-allowed disabled:opacity-40 hover:bg-slate-50 cursor-pointer">Previous</button>
                <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-700 disabled:cursor-not-allowed disabled:opacity-40 hover:bg-slate-50 cursor-pointer">Next</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function EncounterFilterMenu({
  icon: Icon,
  label,
  value,
  options,
  onChange,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  options: { value: string; label: string; detail: string }[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value) ?? options[0];
  return (
    <div className="relative min-w-[190px]">
      <button onClick={() => setOpen((current) => !current)} className="modern-menu-button w-full cursor-pointer">
        <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-blue-50 text-blue-600"><Icon className="h-4 w-4" /></span>
        <span className="min-w-0 flex-1 text-left">
          <span className="block text-[9px] font-black uppercase tracking-wider text-blue-600">{label}</span>
          <span className="block truncate text-xs font-black text-slate-800">{selected.label}</span>
        </span>
        <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="modern-menu-popover right-0 top-[calc(100%+10px)] w-[260px]">
          {options.map((option) => (
            <button key={option.value} onClick={() => { onChange(option.value); setOpen(false); }} className={`modern-menu-choice ${option.value === value ? "is-selected" : ""}`}>
              <span><strong>{option.label}</strong><small>{option.detail}</small></span>{option.value === value && <Check className="h-4 w-4" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function EncounterDetail({ encounter, facilityName }: { encounter: PatientEncounter; facilityName: string }) {
  const disease = DISEASE_BY_CODE[encounter.diseaseCode];
  const [judgement, setJudgement] = useState("Review exposure context, prescription evidence, and whether the case should remain watch-listed before escalation.");
  return (
    <div className="relative flex-1 overflow-y-auto bg-slate-50/70 p-6">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-[26px] border border-white/80 bg-white/85 p-5 shadow-[0_18px_44px_rgba(15,23,42,0.07)]">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-blue-600">Clinical signal</p>
              <h3 className="mt-1 text-2xl font-black tracking-tight text-slate-950">{disease.name}</h3>
              <p className="text-xs text-slate-500">{disease.icd10} · {disease.category} · source {encounter.source.replaceAll("_", " ")}</p>
            </div>
            <span className={`rounded-2xl border px-3 py-2 text-xs font-black ${severityColor[encounter.severity]}`}>{encounter.severity}</span>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <DetailMetric icon={UserRound} label="Patient key" value={encounter.patientKey} />
            <DetailMetric icon={FileText} label="Episode" value={encounter.episodeId} />
            <DetailMetric icon={CalendarDays} label="Onset" value={encounter.onsetDate} />
            <DetailMetric icon={Activity} label="AI confidence" value={encounter.aiConfidence.toFixed(2)} />
          </div>
          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            <ReadBlock title="Symptoms" items={encounter.symptoms} tone="blue" />
            <ReadBlock title="Prescription evidence" items={encounter.prescriptionSignals} tone="emerald" />
            <ReadBlock title="Comorbidities" items={encounter.comorbidities} tone="violet" />
            <ReadBlock title="Outcome" items={[encounter.outcome, `${encounter.lengthOfStayDays} day stay`]} tone="amber" />
          </div>
        </section>

        <section className="rounded-[26px] border border-white/80 bg-white/85 p-5 shadow-[0_18px_44px_rgba(15,23,42,0.07)]">
          <div className="mb-4 flex items-center gap-3">
            <MapPin className="h-5 w-5 text-blue-600" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-blue-600">Facility and identity audit</p>
              <h3 className="text-lg font-black text-slate-950">{facilityName} · {encounter.atoll}</h3>
            </div>
          </div>
          <div className="space-y-3">
            <AuditRow label="Origin" value={`${encounter.origin} / ${encounter.nationalityGroup}`} />
            <AuditRow label="Identifier class" value={encounter.identifierKind} />
            <AuditRow label="Demographics" value={`${encounter.ageBracket} · ${encounter.gender}`} />
            <AuditRow label="Admission date" value={encounter.admissionDate} />
            <AuditRow label="Vaccinated" value={encounter.vaccinated === undefined ? "Not applicable" : encounter.vaccinated ? "Yes" : "No"} />
          </div>
          <div className="mt-5 rounded-3xl border border-blue-100 bg-blue-50/70 p-4">
            <div className="mb-2 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-blue-700" />
              <p className="text-xs font-black uppercase tracking-wide text-blue-700">Readable audit note</p>
            </div>
            <p className="text-sm leading-relaxed text-slate-700">
              This de-identified case links clinical symptoms, prescription evidence, facility context, and identifier class into a single readable surveillance record. It can be reviewed without exposing names, passport numbers, or national identifiers.
            </p>
          </div>
        </section>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <section className="rounded-[26px] border border-white/80 bg-white/85 p-5 shadow-[0_18px_44px_rgba(15,23,42,0.07)]">
          <p className="text-[10px] font-black uppercase tracking-wider text-blue-600">Manual judgement and AI discussion</p>
          <textarea value={judgement} onChange={(event) => setJudgement(event.target.value)} className="mt-3 min-h-28 w-full resize-none rounded-3xl border border-slate-100 bg-slate-50/80 px-4 py-3 text-sm leading-relaxed text-slate-700 outline-none focus:border-blue-200" />
          <div className="mt-3 grid gap-2">
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3 text-sm text-slate-700"><span className="font-black text-emerald-700">OpenRouter clinical AI:</span> clinical evidence supports {disease.name.toLowerCase()} classification with prescription corroboration.</div>
            <div className="rounded-2xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-sm text-slate-700"><span className="font-black text-blue-700">DeepSeek:</span> manual judgement added as a reasoning constraint before alert escalation.</div>
          </div>
        </section>
        <section className="rounded-[26px] border border-white/80 bg-white/85 p-5 shadow-[0_18px_44px_rgba(15,23,42,0.07)]">
          <p className="text-[10px] font-black uppercase tracking-wider text-blue-600">Research workbench</p>
          <div className="mt-3 space-y-2">
            {["WHO case definition", "Maldives notification threshold", "Medication evidence pattern", "Similar facility cluster"].map((item, index) => <div key={item} className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3"><span className="text-sm font-black text-slate-700">{item}</span><span className={`rounded-full px-2 py-1 text-[10px] font-black ${index < 2 ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"}`}>{index < 2 ? "ready" : "research"}</span></div>)}
          </div>
        </section>
      </div>
    </div>
  );
}

function DetailMetric({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-3">
      <Icon className="mb-2 h-4 w-4 text-blue-600" />
      <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 truncate text-sm font-black text-slate-900">{value}</p>
    </div>
  );
}

function ReadBlock({ title, items, tone }: { title: string; items: string[]; tone: "blue" | "emerald" | "violet" | "amber" }) {
  const toneClass = {
    blue: "bg-blue-50 text-blue-700 border-blue-100",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
    violet: "bg-violet-50 text-violet-700 border-violet-100",
    amber: "bg-amber-50 text-amber-700 border-amber-100",
  }[tone];
  return (
    <div>
      <p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">{title}</p>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => <span key={item} className={`rounded-xl border px-3 py-1.5 text-xs font-black ${toneClass}`}>{item}</span>)}
      </div>
    </div>
  );
}

function AuditRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3">
      <span className="text-xs font-black uppercase tracking-wide text-slate-400">{label}</span>
      <span className="text-right text-sm font-black capitalize text-slate-800">{value.replaceAll("_", " ")}</span>
    </div>
  );
}

function matchesPartialFilter(encounter: PatientEncounter, filter: Partial<PatientEncounter>) {
  return Object.entries(filter).every(([key, value]) => {
    if (value === undefined) return true;
    if (key === "onsetDate" && typeof value === "string" && value.includes("|")) {
      const [start, end] = value.split("|");
      if (start !== "..." && encounter.onsetDate < start) return false;
      if (end !== "..." && encounter.onsetDate > end) return false;
      return true;
    }
    return (encounter as unknown as Record<string, unknown>)[key] === value;
  });
}

function searchableText(encounter: PatientEncounter) {
  return [
    encounter.id,
    encounter.patientKey,
    encounter.episodeId,
    DISEASE_BY_CODE[encounter.diseaseCode].name,
    DISEASE_BY_CODE[encounter.diseaseCode].icd10,
    encounter.origin,
    encounter.nationalityGroup,
    encounter.identifierKind,
    encounter.atoll,
    encounter.facilityId,
    encounter.onsetDate,
    encounter.admissionDate,
    encounter.ageBracket,
    encounter.gender,
    encounter.severity,
    encounter.outcome,
    encounter.symptoms.join(" "),
    encounter.prescriptionSignals.join(" "),
  ].join(" ").toLowerCase();
}