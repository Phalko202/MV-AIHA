"use client";

import { useEffect, useState } from "react";
import { X, Sparkles, RotateCcw, Check } from "lucide-react";
import {
  DISEASES, FACILITIES, ATOLL_POPULATIONS,
  type DiseaseCode,
} from "@/lib/surveillance-api";

/* ------------------------------------------------------------------ */
/*  FILTER STUDIO                                                      */
/*  One huge tabbed modal that owns every surveillance filter.         */
/* ------------------------------------------------------------------ */

export type SeverityKey = "mild" | "moderate" | "severe" | "critical";
export type OriginKey = "local" | "foreign";
export type GenderKey = "M" | "F";

export interface FilterStudioValue {
  diagnosis: DiseaseCode | "all";
  severity: SeverityKey[];
  origin: OriginKey[];
  gender: GenderKey[];
  atolls: string[];
  facilities: string[];
  dateStart: string;
  dateEnd: string;
}

export const EMPTY_FILTERS: FilterStudioValue = {
  diagnosis: "all",
  severity: [],
  origin: [],
  gender: [],
  atolls: [],
  facilities: [],
  dateStart: "",
  dateEnd: "",
};

const TABS = [
  { id: "diagnosis", label: "Diagnosis" },
  { id: "severity", label: "Severity" },
  { id: "origin", label: "Origin & gender" },
  { id: "date", label: "Date range" },
  { id: "atoll", label: "Atoll" },
  { id: "facility", label: "Facility" },
] as const;
type TabId = typeof TABS[number]["id"];

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export default function FilterStudio({
  open,
  value,
  onApply,
  onClose,
}: {
  open: boolean;
  value: FilterStudioValue;
  onApply: (next: FilterStudioValue) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<TabId>("diagnosis");
  const [draft, setDraft] = useState<FilterStudioValue>(value);

  useEffect(() => { if (open) setDraft(value); }, [open, value]);
  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-stretch justify-center bg-slate-950/55 backdrop-blur-md p-4" onClick={onClose}>
      <div className="my-6 w-full max-w-[1280px] flex flex-col rounded-[32px] bg-white shadow-[0_50px_120px_rgba(15,23,42,0.32)] overflow-hidden" onClick={(event) => event.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-slate-100 bg-gradient-to-br from-blue-50 via-white to-cyan-50 shrink-0">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 text-white shadow-[0_14px_28px_rgba(37,99,235,0.28)]"><Sparkles className="h-6 w-6" /></span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-blue-700">Filter studio</p>
              <h2 className="text-xl font-black tracking-tight text-slate-950">Refine surveillance signal</h2>
              <p className="text-xs text-slate-500">Tabbed filters apply across every disease view, encounter log, and report template.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setDraft(EMPTY_FILTERS)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 hover:text-slate-900 cursor-pointer"><RotateCcw className="h-3.5 w-3.5" />Reset</button>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 cursor-pointer"><X className="h-5 w-5" /></button>
          </div>
        </div>

        {/* Body — left rail + right pane */}
        <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] flex-1 min-h-[520px] max-h-[78vh]">
          <nav className="border-r border-slate-100 bg-slate-50/60 p-3 space-y-1 overflow-y-auto">
            {TABS.map((entry) => (
              <button
                key={entry.id}
                onClick={() => setTab(entry.id)}
                className={`w-full text-left rounded-2xl px-4 py-3 text-sm font-black transition-all cursor-pointer ${tab === entry.id ? "bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-[0_14px_28px_rgba(37,99,235,0.18)]" : "text-slate-600 hover:bg-white hover:text-slate-950"}`}
              >
                {entry.label}
                <span className="mt-1 block text-[10px] font-bold uppercase tracking-wider opacity-70">{summarise(entry.id, draft)}</span>
              </button>
            ))}
          </nav>

          <section className="p-6 overflow-y-auto">
            {tab === "diagnosis" && <DiagnosisPane draft={draft} setDraft={setDraft} />}
            {tab === "severity" && <SeverityPane draft={draft} setDraft={setDraft} />}
            {tab === "origin" && <OriginPane draft={draft} setDraft={setDraft} />}
            {tab === "date" && <DatePane draft={draft} setDraft={setDraft} />}
            {tab === "atoll" && <AtollPane draft={draft} setDraft={setDraft} />}
            {tab === "facility" && <FacilityPane draft={draft} setDraft={setDraft} />}
          </section>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/70 shrink-0">
          <p className="text-xs text-slate-500">Filters are applied to every chart, encounter log, and AI report generated below.</p>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-600 hover:text-slate-900 cursor-pointer">Cancel</button>
            <button onClick={() => onApply(draft)} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-5 py-2.5 text-xs font-black text-white shadow-[0_14px_28px_rgba(37,99,235,0.28)] hover:opacity-95 cursor-pointer"><Check className="h-3.5 w-3.5" />Apply filters</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  PANES                                                              */
/* ------------------------------------------------------------------ */

interface PaneProps { draft: FilterStudioValue; setDraft: (next: FilterStudioValue) => void }

function DiagnosisPane({ draft, setDraft }: PaneProps) {
  return (
    <div className="space-y-4">
      <PaneHeader title="Diagnosis" hint="Pick one disease or keep all 10 tracked categories visible." />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <FilterCard
          label="All diseases"
          sub="National library"
          active={draft.diagnosis === "all"}
          onClick={() => setDraft({ ...draft, diagnosis: "all" })}
        />
        {DISEASES.map((disease) => (
          <FilterCard
            key={disease.code}
            label={disease.name}
            sub={`${disease.icd10} · ${disease.category}`}
            active={draft.diagnosis === disease.code}
            onClick={() => setDraft({ ...draft, diagnosis: disease.code })}
          />
        ))}
      </div>
    </div>
  );
}

function SeverityPane({ draft, setDraft }: PaneProps) {
  const options: SeverityKey[] = ["mild", "moderate", "severe", "critical"];
  return (
    <div className="space-y-4">
      <PaneHeader title="Severity" hint="Multi-select. Leave empty to include every severity tier." />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {options.map((option) => (
          <FilterCard key={option} label={option} sub="" active={draft.severity.includes(option)} onClick={() => setDraft({ ...draft, severity: toggle(draft.severity, option) })} />
        ))}
      </div>
    </div>
  );
}

function OriginPane({ draft, setDraft }: PaneProps) {
  return (
    <div className="space-y-6">
      <PaneHeader title="Origin & gender" hint="Cohort buckets only — never specific identifiers." />
      <div>
        <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">Cohort</p>
        <div className="grid grid-cols-2 gap-3">
          {(["local", "foreign"] as OriginKey[]).map((option) => (
            <FilterCard key={option} label={option} sub={option === "local" ? "Maldivian resident records" : "Passport / work-permit records"} active={draft.origin.includes(option)} onClick={() => setDraft({ ...draft, origin: toggle(draft.origin, option) })} />
          ))}
        </div>
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">Gender</p>
        <div className="grid grid-cols-2 gap-3">
          {(["F", "M"] as GenderKey[]).map((option) => (
            <FilterCard key={option} label={option === "F" ? "Female" : "Male"} sub="" active={draft.gender.includes(option)} onClick={() => setDraft({ ...draft, gender: toggle(draft.gender, option) })} />
          ))}
        </div>
      </div>
    </div>
  );
}

function DatePane({ draft, setDraft }: PaneProps) {
  const presets: Array<{ label: string; days: number }> = [
    { label: "Last 7 days", days: 7 },
    { label: "Last 14 days", days: 14 },
    { label: "Last 30 days", days: 30 },
  ];
  const applyPreset = (days: number) => {
    const end = new Date();
    const start = new Date(end.getTime() - (days - 1) * 86400000);
    setDraft({ ...draft, dateStart: start.toISOString().slice(0, 10), dateEnd: end.toISOString().slice(0, 10) });
  };
  return (
    <div className="space-y-4">
      <PaneHeader title="Date range" hint="Onset date bounds. Leave blank to include the full dataset." />
      <div className="flex flex-wrap gap-2">
        {presets.map((preset) => (
          <button key={preset.label} onClick={() => applyPreset(preset.days)} className="rounded-xl bg-blue-50 px-3 py-2 text-xs font-black text-blue-700 hover:bg-blue-100 cursor-pointer">{preset.label}</button>
        ))}
        <button onClick={() => setDraft({ ...draft, dateStart: "", dateEnd: "" })} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-500 hover:text-slate-900 cursor-pointer">Clear</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="rounded-2xl border border-slate-200 bg-white p-3">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">From</span>
          <input type="date" value={draft.dateStart} onChange={(event) => setDraft({ ...draft, dateStart: event.target.value })} className="block w-full mt-1 text-sm font-mono font-bold text-slate-800 outline-none" />
        </label>
        <label className="rounded-2xl border border-slate-200 bg-white p-3">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">To</span>
          <input type="date" value={draft.dateEnd} onChange={(event) => setDraft({ ...draft, dateEnd: event.target.value })} className="block w-full mt-1 text-sm font-mono font-bold text-slate-800 outline-none" />
        </label>
      </div>
    </div>
  );
}

function AtollPane({ draft, setDraft }: PaneProps) {
  const atollEntries = Object.entries(ATOLL_POPULATIONS) as Array<[string, number]>;
  return (
    <div className="space-y-4">
      <PaneHeader title="Atoll" hint="Multi-select. Filters every facility located in the chosen atolls." />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 max-h-[60vh] overflow-y-auto pr-1">
        {atollEntries.map(([atollName, population]) => (
          <FilterCard key={atollName} label={atollName} sub={`${population.toLocaleString()} pop.`} active={draft.atolls.includes(atollName)} onClick={() => setDraft({ ...draft, atolls: toggle(draft.atolls, atollName) })} compact />
        ))}
      </div>
    </div>
  );
}

function FacilityPane({ draft, setDraft }: PaneProps) {
  return (
    <div className="space-y-4">
      <PaneHeader title="Facility" hint="Multi-select hospitals, regional centres, and GP clinics." />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[60vh] overflow-y-auto pr-1">
        {FACILITIES.map((facilityItem) => (
          <FilterCard key={facilityItem.id} label={facilityItem.shortName} sub={`${facilityItem.atoll} · ${facilityItem.type}`} active={draft.facilities.includes(facilityItem.id)} onClick={() => setDraft({ ...draft, facilities: toggle(draft.facilities, facilityItem.id) })} />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  PIECES                                                             */
/* ------------------------------------------------------------------ */

function PaneHeader({ title, hint }: { title: string; hint: string }) {
  return (
    <div>
      <h3 className="text-lg font-black tracking-tight text-slate-950">{title}</h3>
      <p className="text-xs text-slate-500">{hint}</p>
    </div>
  );
}

function FilterCard({ label, sub, active, onClick, compact = false }: { label: string; sub?: string; active: boolean; onClick: () => void; compact?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-2xl border ${compact ? "px-3 py-2" : "px-4 py-3"} transition-all cursor-pointer ${active ? "border-blue-500 bg-gradient-to-br from-blue-50 to-cyan-50 shadow-[0_14px_28px_rgba(37,99,235,0.18)]" : "border-slate-200 bg-white hover:border-slate-300 hover:-translate-y-0.5"}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={`text-sm font-black capitalize ${active ? "text-blue-700" : "text-slate-800"}`}>{label}</span>
        {active && <Check className="h-4 w-4 text-blue-600 shrink-0" />}
      </div>
      {sub && <p className="text-[11px] font-semibold text-slate-500 mt-0.5">{sub}</p>}
    </button>
  );
}

function summarise(tab: TabId, value: FilterStudioValue): string {
  switch (tab) {
    case "diagnosis": return value.diagnosis === "all" ? "All" : "1 selected";
    case "severity": return value.severity.length ? `${value.severity.length} selected` : "Any";
    case "origin": return `${value.origin.length + value.gender.length || "Any"}`;
    case "date": return value.dateStart || value.dateEnd ? `${value.dateStart || "…"} → ${value.dateEnd || "…"}` : "All time";
    case "atoll": return value.atolls.length ? `${value.atolls.length} atolls` : "All atolls";
    case "facility": return value.facilities.length ? `${value.facilities.length} sites` : "All facilities";
    default: return "";
  }
}
