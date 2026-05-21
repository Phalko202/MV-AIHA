"use client";

import { useMemo, useState, useEffect } from "react";
import {
  ResponsiveContainer,
  LineChart, Line,
  BarChart, Bar,
  AreaChart, Area,
  PieChart, Pie, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  Treemap,
} from "recharts";
import { Activity, CalendarDays, Check, ChevronDown, Filter, MapPin, RotateCcw, Search, ShieldCheck, SlidersHorizontal, UserRound, X } from "lucide-react";

import {
  DISEASES,
  DISEASE_BY_CODE,
  FACILITIES,
  ATOLL_POPULATIONS,
  encountersFor,
  weeklySeriesFor,
  type DiseaseCode,
  type PatientEncounter,
} from "@/lib/surveillance-api";
import {
  DEFAULT_ANALYTICS_FILTERS,
  analyticsDateBounds,
  countAnalyticsFilters,
  filterAnalyticsEncounters,
  isDateInAnalyticsBounds,
  type AnalyticsDateFilter,
  type AnalyticsFilterState,
  type DatePreset,
} from "@/lib/analytics-filters";

const PALETTE = ["#2563eb", "#dc2626", "#f59e0b", "#10b981", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316", "#84cc16", "#6366f1"];
const AXIS_TICK = { fontSize: 11, fill: "#64748b", fontWeight: 700 };
const GRID_STROKE = "rgba(148, 163, 184, 0.22)";
const TOOLTIP_STYLE = {
  border: "1px solid rgba(148, 163, 184, 0.24)",
  borderRadius: 14,
  boxShadow: "0 18px 45px rgba(15, 23, 42, 0.12)",
  fontSize: 12,
};

type ChartId =
  | "incidence" | "weekly_trend" | "epi_curve" | "rt" | "doubling"
  | "age_dist" | "gender_split" | "age_gender_heat" | "severity" | "outcome"
  | "comorbidity" | "hospitalization" | "los" | "icu_admission" | "cfr"
  | "atoll_spread" | "atoll_rate" | "facility_load" | "facility_share" | "referrals"
  | "test_positivity" | "test_volume" | "tat" | "time_to_treat" | "readmit"
  | "vaccination" | "cumulative" | "new_vs_recoveries" | "alert_freq" | "compliance";

interface ChartDef {
  id: ChartId;
  label: string;
  group: "Burden" | "Demographics" | "Clinical" | "Geographic" | "Laboratory" | "Prevention";
  // Diseases this chart is meaningful for. If undefined → meaningful for all.
  applicableDiseases?: DiseaseCode[];
  // If true the chart is per-disease only and needs a specific disease selected.
  requiresDisease?: boolean;
  // Reason for filtering (shown if not applicable).
  notApplicableReason?: (d: DiseaseCode) => string | null;
}

const CHARTS: ChartDef[] = [
  // Burden
  { id: "weekly_trend", label: "Weekly Trend (all diseases)", group: "Burden" },
  { id: "incidence", label: "Weekly Incidence", group: "Burden", requiresDisease: true },
  { id: "epi_curve", label: "Epidemic Curve", group: "Burden", requiresDisease: true },
  { id: "rt", label: "Reproduction Number (Rt)", group: "Burden", requiresDisease: true },
  { id: "doubling", label: "Doubling Time", group: "Burden", requiresDisease: true },
  { id: "cumulative", label: "Cumulative Incidence", group: "Burden", requiresDisease: true },
  { id: "new_vs_recoveries", label: "New Cases vs Recoveries", group: "Burden", requiresDisease: true },
  // Demographics
  { id: "age_dist", label: "Age Bracket Distribution", group: "Demographics" },
  { id: "gender_split", label: "Gender Split", group: "Demographics" },
  { id: "age_gender_heat", label: "Age × Gender Heatmap", group: "Demographics" },
  // Clinical
  { id: "severity", label: "Severity Triage", group: "Clinical" },
  { id: "outcome", label: "Outcome Distribution", group: "Clinical" },
  { id: "comorbidity", label: "Comorbidity Prevalence", group: "Clinical" },
  { id: "hospitalization", label: "Hospitalization vs Outpatient", group: "Clinical" },
  { id: "los", label: "Length of Stay", group: "Clinical" },
  { id: "icu_admission", label: "Severe/Critical Disease Share", group: "Clinical" },
  { id: "cfr", label: "Case Fatality Rate by Atoll", group: "Clinical" },
  { id: "readmit", label: "Readmission Rate", group: "Clinical" },
  { id: "time_to_treat", label: "Time to First Treatment", group: "Clinical" },
  // Geographic
  { id: "atoll_spread", label: "Cases by Atoll", group: "Geographic" },
  { id: "atoll_rate", label: "Incidence Rate per 100k by Atoll", group: "Geographic" },
  { id: "facility_load", label: "Facility Caseload", group: "Geographic" },
  { id: "facility_share", label: "Facility Share (Treemap)", group: "Geographic" },
  { id: "referrals", label: "Referral Flow", group: "Geographic" },
  // Laboratory
  { id: "test_positivity", label: "Test Positivity Rate", group: "Laboratory", requiresDisease: true },
  { id: "test_volume", label: "Test Volume", group: "Laboratory", requiresDisease: true },
  { id: "tat", label: "Lab Turnaround Time", group: "Laboratory" },
  // Prevention
  {
    id: "vaccination",
    label: "Vaccination Coverage",
    group: "Prevention",
    requiresDisease: true,
    notApplicableReason: (d) => DISEASE_BY_CODE[d].vaccinePreventable ? null : "Not a vaccine-preventable disease — vaccination coverage is not tracked for this condition.",
  },
  { id: "alert_freq", label: "Outbreak Alert Frequency", group: "Prevention" },
  { id: "compliance", label: "Notifiable Reporting Compliance", group: "Prevention" },
];

const GROUP_ORDER = ["Burden", "Demographics", "Clinical", "Geographic", "Laboratory", "Prevention"] as const;

const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: "all", label: "All dates" },
  { value: "last7", label: "7 days" },
  { value: "last14", label: "14 days" },
  { value: "last30", label: "30 days" },
];

const MENU_ICON = {
  burden: "/icons/people/chart.png",
  demographics: "/icons/3d/boy.png",
  clinical: "/icons/3d/shield.png",
  geographic: "/icons/people/earth.png",
};

interface AnalyticsChartsProps {
  onShowEncounters: (disease: DiseaseCode | "all", filter?: Partial<PatientEncounter>, label?: string) => void;
  filters: AnalyticsFilterState;
  onFiltersChange: (next: AnalyticsFilterState) => void;
}

export default function AnalyticsCharts({ onShowEncounters, filters, onFiltersChange }: AnalyticsChartsProps) {
  const [active, setActive] = useState<ChartId>("weekly_trend");
  const [ready, setReady] = useState(false);
  useEffect(() => { requestAnimationFrame(() => setReady(true)); }, []);

  const chartDef = CHARTS.find((c) => c.id === active)!;
  const selectedDiseaseCode = filters.diagnosis === "all" ? null : filters.diagnosis;
  const selectedDiseaseName = filters.diagnosis === "all" ? "All diseases" : DISEASE_BY_CODE[filters.diagnosis].name;
  const filteredCount = useMemo(() => filterAnalyticsEncounters(encountersFor(filters.diagnosis), filters).length, [filters]);
  const notApplicableReason =
    chartDef.requiresDisease && filters.diagnosis === "all"
      ? "Select a specific disease above to view this chart."
      : chartDef.notApplicableReason && filters.diagnosis !== "all"
        ? chartDef.notApplicableReason(filters.diagnosis)
        : null;

  return (
    <div className="flex gap-4 h-[calc(100vh-128px)] min-h-[560px] analytics-surface">
      {/* Chart selector */}
      <div className="shrink-0 w-64 rounded-3xl border border-white/75 bg-white/68 backdrop-blur-xl p-2.5 overflow-y-auto shadow-[0_18px_48px_rgba(15,23,42,0.08)]">
        {GROUP_ORDER.map((g) => (
          <div key={g} className="mb-2">
            <p className="px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-400">{g}</p>
            <div className="space-y-0.5">
              {CHARTS.filter((c) => c.group === g).map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActive(c.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-2xl text-[12px] font-bold transition-all duration-300 cursor-pointer ${
                    active === c.id ? "bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-[0_12px_24px_rgba(37,99,235,0.22)]" : "text-slate-600 hover:bg-white/80 hover:text-slate-950 hover:translate-x-0.5"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Display */}
      <div className="flex-1 rounded-3xl border border-white/80 bg-white/86 backdrop-blur-xl p-5 overflow-hidden shadow-[0_22px_60px_rgba(15,23,42,0.09)] flex flex-col">
        <div className="analytics-title-block mb-4 rounded-3xl border border-white/80 bg-white/72 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.72),0_16px_36px_rgba(15,23,42,0.07)]">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              <div className="analytics-hero-icon analytics-logo-glyph"><img src={chartDef.group === "Geographic" ? MENU_ICON.geographic : chartDef.group === "Demographics" ? MENU_ICON.demographics : chartDef.group === "Clinical" ? MENU_ICON.clinical : MENU_ICON.burden} alt="" /></div>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-wider text-blue-600">{chartDef.group} intelligence</p>
                <h2 className="text-xl font-black text-slate-950 tracking-tight truncate">{chartDef.label}</h2>
                <p className="text-xs text-slate-500">{selectedDiseaseName} · de-identified signal analytics</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <AnalyticsFilterLauncher filters={filters} onChange={onFiltersChange} />
              {selectedDiseaseCode && (
                <button
                  onClick={() => onShowEncounters(selectedDiseaseCode, dateFilterToEncounterFilter(filters), `${DISEASE_BY_CODE[selectedDiseaseCode].name} — ${filteredCount.toLocaleString()} filtered encounters`)}
                  className="text-xs bg-blue-600 hover:bg-blue-500 text-white rounded-2xl px-4 py-2 font-black transition-all duration-300 cursor-pointer shadow-[0_10px_22px_rgba(37,99,235,0.22)]"
                >
                  View Patient Log
                </button>
              )}
            </div>
          </div>
        </div>

        {!ready ? (
          <div className="flex-1 bg-slate-50 animate-pulse rounded-3xl min-h-[300px]" />
        ) : notApplicableReason ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-10 rounded-3xl border border-dashed border-slate-200 bg-slate-50/50 min-h-[300px]">
            <Activity className="h-8 w-8 text-slate-300 mb-3" />
            <p className="text-sm text-slate-600 max-w-md">{notApplicableReason}</p>
          </div>
        ) : (
          <div key={`${active}-${filters.diagnosis}-${filters.date.preset}-${filters.date.start}-${filters.date.end}-${filters.severity.join("-")}-${filters.origin.join("-")}-${filters.gender.join("-")}-${filters.atolls.join("-")}-${filters.facilities.join("-")}-${filters.outcomes.join("-")}`} className="flex-1 min-h-[360px] analytics-chart-frame animate-chartIn">
            <ChartRenderer chartId={active} filters={filters} onShowEncounters={onShowEncounters} />
          </div>
        )}
      </div>
    </div>
  );
}

function AnalyticsFilterLauncher({ filters, onChange }: { filters: AnalyticsFilterState; onChange: (next: AnalyticsFilterState) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<AnalyticsFilterState>(filters);

  useEffect(() => {
    if (open) setDraft(filters);
  }, [open, filters]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const activeCount = countAnalyticsFilters(filters);
  const selected = filters.diagnosis === "all" ? null : DISEASE_BY_CODE[filters.diagnosis];
  const visibleDiseases = DISEASES.filter((item) => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return true;
    return `${item.name} ${item.icd10} ${item.category}`.toLowerCase().includes(normalized);
  });

  const toggleList = <T extends string,>(list: T[], value: T) => list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
  const dateSummary = formatDateSummary(filters.date);

  return (
    <>
      <button onClick={() => setOpen(true)} className="analytics-filter-pill min-w-[360px] cursor-pointer text-left">
        <span className="analytics-filter-button relative">
          <ShieldCheck className="h-7 w-7 text-blue-600" />
          <Filter className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-blue-600 p-0.5 text-white shadow-lg" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[9px] font-black uppercase tracking-wider text-blue-600">Diagnosis & filters</span>
          <span className="block truncate text-xs font-black text-slate-800">{selected?.name ?? "All diseases"}</span>
          <span className="block truncate text-[10px] font-semibold text-slate-400">{dateSummary}{activeCount > 1 ? ` · ${activeCount - 1} more filters` : ""}</span>
        </span>
        {activeCount > 0 && <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-blue-600 px-1.5 text-[10px] font-black text-white">{activeCount}</span>}
        <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 backdrop-blur-sm p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-6xl max-h-[88vh] overflow-hidden rounded-[32px] border border-white/80 bg-white/96 shadow-[0_40px_120px_rgba(15,23,42,0.26)]" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 bg-gradient-to-br from-white via-blue-50/60 to-cyan-50/50 px-6 py-5">
              <div>
                <div className="mb-1 flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-blue-600"><SlidersHorizontal className="h-3.5 w-3.5" /> Analytics filter popup</div>
                <h3 className="text-2xl font-black tracking-tight text-slate-950">Diagnosis, date, and cohort controls</h3>
                <p className="text-xs text-slate-500">One popup surface for analytics. No side drawer, no leaking header filter button.</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setDraft(DEFAULT_ANALYTICS_FILTERS)} className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-600 hover:text-slate-950 cursor-pointer">Reset</button>
                <button onClick={() => { onChange(draft); setOpen(false); }} className="rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-2 text-xs font-black text-white shadow-[0_14px_28px_rgba(37,99,235,0.24)] cursor-pointer">Apply</button>
                <button onClick={() => setOpen(false)} className="rounded-2xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"><X className="h-5 w-5" /></button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] max-h-[calc(88vh-92px)] overflow-hidden">
              <div className="border-r border-slate-100 bg-slate-50/70 p-5 overflow-y-auto">
                <SectionTitle icon={Search} title="Diagnosis library" detail="Choose one disease focus or leave the full stack visible." />
                <label className="mt-3 flex items-center gap-2 rounded-2xl border border-white/80 bg-white px-3 py-3 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
                  <Search className="h-4 w-4 text-slate-400" />
                  <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search ICD-10, category, disease..." className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-400" />
                </label>
                <div className="mt-3 grid gap-2">
                  <button onClick={() => setDraft({ ...draft, diagnosis: "all" })} className={`analytics-choice ${draft.diagnosis === "all" ? "is-selected" : ""}`}>
                    <span><strong>All diseases</strong><small>National stack across all tracked disease groups</small></span>{draft.diagnosis === "all" && <Check className="h-4 w-4" />}
                  </button>
                  {visibleDiseases.map((item) => (
                    <button key={item.code} onClick={() => setDraft({ ...draft, diagnosis: item.code })} className={`analytics-choice ${draft.diagnosis === item.code ? "is-selected" : ""}`}>
                      <span><strong>{item.name}</strong><small>{item.icd10} · {item.category}</small></span>{draft.diagnosis === item.code && <Check className="h-4 w-4" />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-5 overflow-y-auto">
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-[0_14px_34px_rgba(15,23,42,0.05)]">
                    <SectionTitle icon={CalendarDays} title="Signal window" detail="Choose a recent window or enter a custom date range." />
                    <div className="mt-3 flex flex-wrap gap-2">
                      {DATE_PRESETS.map((preset) => (
                        <button key={preset.value} onClick={() => setDraft({ ...draft, date: { preset: preset.value, start: "", end: "" } })} className={`rounded-full px-3 py-1.5 text-[11px] font-black transition-all cursor-pointer ${draft.date.preset === preset.value ? "bg-blue-600 text-white shadow-[0_8px_16px_rgba(37,99,235,0.22)]" : "bg-slate-100 text-slate-600 hover:text-slate-950"}`}>{preset.label}</button>
                      ))}
                      <button onClick={() => setDraft({ ...draft, date: { ...draft.date, preset: "custom" } })} className={`rounded-full px-3 py-1.5 text-[11px] font-black transition-all cursor-pointer ${draft.date.preset === "custom" ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-600 hover:text-slate-950"}`}>Custom</button>
                    </div>
                    {draft.date.preset === "custom" && (
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <label className="analytics-date-field"><span>From</span><input value={draft.date.start} onChange={(event) => setDraft({ ...draft, date: { ...draft.date, preset: "custom", start: event.target.value } })} placeholder="2026-05-01" /></label>
                        <label className="analytics-date-field"><span>To</span><input value={draft.date.end} onChange={(event) => setDraft({ ...draft, date: { ...draft.date, preset: "custom", end: event.target.value } })} placeholder="2026-05-20" /></label>
                      </div>
                    )}
                  </div>

                  <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-[0_14px_34px_rgba(15,23,42,0.05)]">
                    <SectionTitle icon={ShieldCheck} title="Severity" detail="Multi-select acuity tiers for the analytics cohort." />
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(["mild", "moderate", "severe", "critical"] as PatientEncounter["severity"][]).map((option) => (
                        <FilterToken key={option} active={draft.severity.includes(option)} onClick={() => setDraft({ ...draft, severity: toggleList(draft.severity, option) })}>{option}</FilterToken>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-[0_14px_34px_rgba(15,23,42,0.05)]">
                    <SectionTitle icon={UserRound} title="Origin and gender" detail="Keep the cohort split tidy without fragmenting the layout." />
                    <div className="mt-3 space-y-3">
                      <div>
                        <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-400">Origin</p>
                        <div className="flex flex-wrap gap-2">
                          {(["local", "foreign"] as PatientEncounter["origin"][]).map((option) => (
                            <FilterToken key={option} active={draft.origin.includes(option)} onClick={() => setDraft({ ...draft, origin: toggleList(draft.origin, option) })}>{option}</FilterToken>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-400">Gender</p>
                        <div className="flex flex-wrap gap-2">
                          {(["F", "M"] as PatientEncounter["gender"][]).map((option) => (
                            <FilterToken key={option} active={draft.gender.includes(option)} onClick={() => setDraft({ ...draft, gender: toggleList(draft.gender, option) })}>{option === "F" ? "Female" : "Male"}</FilterToken>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-[0_14px_34px_rgba(15,23,42,0.05)]">
                    <SectionTitle icon={Activity} title="Outcome" detail="Optional post-care state filters for recovery and escalation views." />
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(["active", "recovered", "referred", "deceased"] as PatientEncounter["outcome"][]).map((option) => (
                        <FilterToken key={option} active={draft.outcomes.includes(option)} onClick={() => setDraft({ ...draft, outcomes: toggleList(draft.outcomes, option) })}>{option}</FilterToken>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-[0_14px_34px_rgba(15,23,42,0.05)]">
                    <SectionTitle icon={MapPin} title="Atoll" detail="Apply region filters without dropping into a side drawer." />
                    <div className="mt-3 grid grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
                      {Object.entries(ATOLL_POPULATIONS).map(([atollName, population]) => (
                        <button key={atollName} onClick={() => setDraft({ ...draft, atolls: toggleList(draft.atolls, atollName) })} className={`rounded-2xl border px-3 py-2 text-left transition-all cursor-pointer ${draft.atolls.includes(atollName) ? "border-blue-300 bg-blue-50 text-blue-700" : "border-slate-200 bg-slate-50 text-slate-600 hover:text-slate-950"}`}>
                          <span className="block text-sm font-black">{atollName}</span>
                          <span className="block text-[10px] font-semibold opacity-70">{population.toLocaleString()} pop.</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-[0_14px_34px_rgba(15,23,42,0.05)]">
                    <SectionTitle icon={Activity} title="Facility" detail="Target one or more hospitals or centres." />
                    <div className="mt-3 grid gap-2 max-h-60 overflow-y-auto pr-1">
                      {FACILITIES.map((facility) => (
                        <button key={facility.id} onClick={() => setDraft({ ...draft, facilities: toggleList(draft.facilities, facility.id) })} className={`rounded-2xl border px-3 py-2 text-left transition-all cursor-pointer ${draft.facilities.includes(facility.id) ? "border-blue-300 bg-blue-50 text-blue-700" : "border-slate-200 bg-slate-50 text-slate-600 hover:text-slate-950"}`}>
                          <span className="block text-sm font-black">{facility.shortName}</span>
                          <span className="block text-[10px] font-semibold opacity-70">{facility.atoll} · {facility.type}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function SectionTitle({ icon: Icon, title, detail }: { icon: React.ComponentType<{ className?: string }>; title: string; detail: string }) {
  return (
    <div>
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-blue-600"><Icon className="h-3.5 w-3.5" /> {title}</div>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

function FilterToken({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className={`rounded-full px-3 py-1.5 text-[11px] font-black transition-all cursor-pointer ${active ? "bg-blue-600 text-white shadow-[0_8px_16px_rgba(37,99,235,0.22)]" : "bg-slate-100 text-slate-600 hover:text-slate-950"}`}>{children}</button>;
}

function formatDateSummary(value: AnalyticsDateFilter) {
  if (value.preset === "all") return "All dates";
  if (value.preset === "custom") return `${value.start || "…"} → ${value.end || "…"}`;
  return DATE_PRESETS.find((preset) => preset.value === value.preset)?.label ?? "Date range";
}

function dateFilterToEncounterFilter(filters: AnalyticsFilterState): Partial<PatientEncounter> | undefined {
  const bounds = analyticsDateBounds(filters.date);
  if (!bounds.start && !bounds.end) return undefined;
  return { onsetDate: `${bounds.start || "..."}|${bounds.end || "..."}` } as Partial<PatientEncounter>;
}

function filterWeeklyRows<T extends { week: string }>(rows: T[], filter: AnalyticsDateFilter) {
  const filtered = rows.filter((row) => isDateInAnalyticsBounds(weekToDate(row.week), filter));
  return filtered.length > 0 ? filtered : rows;
}

function weekToDate(week: string) {
  const weekNumber = Number(week.replace("W", ""));
  const date = new Date(Date.UTC(2026, 0, 1 + Math.max(0, weekNumber - 1) * 7));
  return date.toISOString().slice(0, 10);
}

function dateRangeDays(filter: AnalyticsDateFilter) {
  const bounds = analyticsDateBounds(filter);
  if (!bounds.start || !bounds.end) return [];
  const start = new Date(`${bounds.start}T00:00:00Z`);
  const end = new Date(`${bounds.end}T00:00:00Z`);
  const days: string[] = [];
  for (let cursor = start.getTime(); cursor <= end.getTime() && days.length < 45; cursor += 86400000) {
    days.push(new Date(cursor).toISOString().slice(0, 10));
  }
  return days;
}

function buildDailyDiseaseRows(filters: AnalyticsFilterState) {
  const days = dateRangeDays(filters.date);
  if (days.length === 0) return [];
  const scope = filters.diagnosis === "all" ? encountersFor("all") : encountersFor(filters.diagnosis);
  const encounters = filterAnalyticsEncounters(scope, filters);
  return days.map((date) => {
    const row: { date: string; day: string } & Record<string, number | string> = { date, day: date.slice(5) };
    for (const disease of DISEASES.slice(0, 10)) {
      row[disease.name] = encounters.filter((encounter) => encounter.onsetDate === date && encounter.diseaseCode === disease.code).length;
    }
    return row;
  });
}

function buildDailyCaseRows(disease: DiseaseCode, filters: AnalyticsFilterState) {
  const days = dateRangeDays(filters.date);
  if (days.length === 0) return [];
  const encounters = filterAnalyticsEncounters(encountersFor(disease), { ...filters, diagnosis: disease });
  return days.map((date) => {
    const cases = encounters.filter((encounter) => encounter.onsetDate === date).length;
    return { date, day: date.slice(5), cases, newCases: cases };
  });
}

/* ------------------------------------------------------------------ */
/*  CHART RENDERER                                                     */
/* ------------------------------------------------------------------ */
function ChartRenderer({
  chartId,
  filters,
  onShowEncounters,
}: {
  chartId: ChartId;
  filters: AnalyticsFilterState;
  onShowEncounters: (d: DiseaseCode | "all", filter?: Partial<PatientEncounter>, label?: string) => void;
}) {
  const disease = filters.diagnosis;
  const dateFilter = filters.date;
  const encounters = useMemo(() => filterAnalyticsEncounters(encountersFor(disease), filters), [disease, filters]);

  if (chartId === "weekly_trend") {
    const dailyData = buildDailyDiseaseRows(filters);
    if (dailyData.length > 0) {
      return (
        <ResponsiveContainer width="100%" height="100%" minWidth={300}>
          <BarChart data={dailyData} margin={{ top: 14, right: 18, bottom: 8, left: 8 }}>
            <CartesianGrid strokeDasharray="4 8" stroke={GRID_STROKE} />
            <XAxis dataKey="day" tick={AXIS_TICK} axisLine={false} tickLine={false} />
            <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "rgba(37,99,235,0.04)" }} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            {DISEASES.slice(0, 10).map((diseaseItem, index) => (
              <Bar key={diseaseItem.code} dataKey={diseaseItem.name} stackId="daily" fill={PALETTE[index]} radius={index === 9 ? [8, 8, 0, 0] : [0, 0, 0, 0]} maxBarSize={44} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      );
    }

    const data = filterWeeklyRows(["W14", "W15", "W16", "W17", "W18", "W19", "W20"].map((week, i) => {
      const row: { week: string } & Record<string, number | string> = { week };
      for (const d of DISEASES) {
        row[d.name] = weeklySeriesFor(d.code)[i].cases;
      }
      return row;
    }), dateFilter);
    return (
      <ResponsiveContainer width="100%" height="100%" minWidth={300}>
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="week" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip contentStyle={{ fontSize: 12 }} />
          <Legend wrapperStyle={{ fontSize: 10 }} />
          {DISEASES.slice(0, 10).map((d, i) => (
            <Area key={d.code} type="monotone" dataKey={d.name} stackId="1" stroke={PALETTE[i]} fill={PALETTE[i] + "55"} strokeWidth={1.5} />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  if (chartId === "incidence") {
    const dailyData = buildDailyCaseRows(disease as DiseaseCode, filters);
    const data = dailyData.length > 0 ? dailyData : filterWeeklyRows(weeklySeriesFor(disease as DiseaseCode), dateFilter);
    return <SimpleBar data={data} xKey={dailyData.length > 0 ? "day" : "week"} bars={[{ key: "cases", color: "#2563eb", name: "Cases" }, { key: "newCases", color: "#dc2626", name: "New" }]} />;
  }

  if (chartId === "epi_curve") {
    const data = filterWeeklyRows(weeklySeriesFor(disease as DiseaseCode), dateFilter);
    return (
      <ResponsiveContainer width="100%" height="100%" minWidth={300}>
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="week" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip contentStyle={{ fontSize: 12 }} />
          <Area type="monotone" dataKey="cases" stroke="#2563eb" fill="#2563eb33" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  if (chartId === "rt") {
    const data = filterWeeklyRows(weeklySeriesFor(disease as DiseaseCode), dateFilter);
    return (
      <ResponsiveContainer width="100%" height="100%" minWidth={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="week" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} domain={[0, 3]} />
          <Tooltip contentStyle={{ fontSize: 12 }} formatter={(v: unknown) => typeof v === "number" ? v.toFixed(2) : String(v)} />
          <Line type="monotone" dataKey="rt" stroke="#dc2626" strokeWidth={2.5} dot={{ r: 4 }} name="Rt" />
          <Line type="monotone" dataKey={() => 1} stroke="#94a3b8" strokeDasharray="4 4" dot={false} name="Threshold = 1" />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (chartId === "doubling") {
    const data = filterWeeklyRows(weeklySeriesFor(disease as DiseaseCode), dateFilter);
    return <SimpleBar data={data} xKey="week" bars={[{ key: "doublingDays", color: "#f59e0b", name: "Doubling Time (days)" }]} />;
  }

  if (chartId === "cumulative") {
    const data = filterWeeklyRows(weeklySeriesFor(disease as DiseaseCode), dateFilter);
    const cumulated = data.reduce<Array<(typeof data)[number] & { cumulative: number }>>((rows, point) => {
      const previous = rows.at(-1)?.cumulative ?? 0;
      rows.push({ ...point, cumulative: previous + point.cases });
      return rows;
    }, []);
    return (
      <ResponsiveContainer width="100%" height="100%" minWidth={300}>
        <LineChart data={cumulated}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="week" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip contentStyle={{ fontSize: 12 }} />
          <Line type="monotone" dataKey="cumulative" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (chartId === "new_vs_recoveries") {
    const data = filterWeeklyRows(weeklySeriesFor(disease as DiseaseCode), dateFilter);
    return (
      <ResponsiveContainer width="100%" height="100%" minWidth={300}>
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="week" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip contentStyle={{ fontSize: 12 }} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="newCases" fill="#dc2626" radius={[4, 4, 0, 0]} name="New" />
          <Bar dataKey="recoveries" fill="#10b981" radius={[4, 4, 0, 0]} name="Recovered" />
          <Line type="monotone" dataKey="deaths" stroke="#0f172a" strokeWidth={2} name="Deaths" />
        </ComposedChart>
      </ResponsiveContainer>
    );
  }

  if (chartId === "age_dist") {
    const counts: Record<string, number> = {};
    for (const e of encounters) counts[e.ageBracket] = (counts[e.ageBracket] ?? 0) + 1;
    const data = ["0-4", "5-9", "10-19", "20-29", "30-39", "40-49", "50-59", "60-69", "70+"].map((b) => ({ bracket: b, count: counts[b] ?? 0 }));
    return (
      <ResponsiveContainer width="100%" height="100%" minWidth={300}>
        <BarChart data={data} onClick={(e: any) => {
          if (e?.activePayload?.[0]) {
            const bracket = e.activePayload[0].payload.bracket as PatientEncounter["ageBracket"];
            onShowEncounters(disease, { ageBracket: bracket }, `Age ${bracket} — ${disease === "all" ? "All diseases" : DISEASE_BY_CODE[disease].name}`);
          }
        }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="bracket" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip contentStyle={{ fontSize: 12 }} />
          <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} cursor="pointer" />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (chartId === "gender_split") {
    const m = encounters.filter((e) => e.gender === "M").length;
    const f = encounters.filter((e) => e.gender === "F").length;
    const data = [{ name: "Male", value: m }, { name: "Female", value: f }];
    return (
      <ResponsiveContainer width="100%" height="100%" minWidth={300}>
        <PieChart>
          <Pie
            data={data} cx="50%" cy="50%" outerRadius={140} innerRadius={80} dataKey="value"
            label={({ name, percent }: any) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
            onClick={(d: any) => onShowEncounters(disease, { gender: d.name === "Male" ? "M" : "F" }, `${d.name} — ${disease === "all" ? "All diseases" : DISEASE_BY_CODE[disease].name}`)}
          >
            <Cell fill="#2563eb" />
            <Cell fill="#ec4899" />
          </Pie>
          <Tooltip contentStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (chartId === "age_gender_heat") {
    const brackets = ["0-4", "5-9", "10-19", "20-29", "30-39", "40-49", "50-59", "60-69", "70+"];
    const data = brackets.map((b) => ({
      bracket: b,
      male: encounters.filter((e) => e.ageBracket === b && e.gender === "M").length,
      female: encounters.filter((e) => e.ageBracket === b && e.gender === "F").length,
    }));
    return (
      <ResponsiveContainer width="100%" height="100%" minWidth={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="bracket" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip contentStyle={{ fontSize: 12 }} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="male" fill="#2563eb" radius={[4, 4, 0, 0]} name="Male" />
          <Bar dataKey="female" fill="#ec4899" radius={[4, 4, 0, 0]} name="Female" />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (chartId === "severity") {
    const sev = ["mild", "moderate", "severe", "critical"] as const;
    const data = sev.map((s) => ({ name: s, value: encounters.filter((e) => e.severity === s).length }));
    return (
      <ResponsiveContainer width="100%" height="100%" minWidth={300}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" outerRadius={140} dataKey="value" label={({ name, percent }: any) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
            onClick={(d: any) => onShowEncounters(disease, { severity: d.name }, `${d.name} severity — ${disease === "all" ? "All diseases" : DISEASE_BY_CODE[disease].name}`)}>
            <Cell fill="#10b981" /><Cell fill="#f59e0b" /><Cell fill="#f97316" /><Cell fill="#dc2626" />
          </Pie>
          <Tooltip contentStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (chartId === "outcome") {
    const outcomes = ["recovered", "active", "referred", "deceased"] as const;
    const data = outcomes.map((o) => ({ name: o, value: encounters.filter((e) => e.outcome === o).length }));
    return (
      <ResponsiveContainer width="100%" height="100%" minWidth={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip contentStyle={{ fontSize: 12 }} />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} cursor="pointer"
            onClick={(d: any) => onShowEncounters(disease, { outcome: d.name }, `Outcome: ${d.name}`)}>
            {data.map((_, i) => <Cell key={i} fill={["#10b981", "#3b82f6", "#f59e0b", "#0f172a"][i]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (chartId === "comorbidity") {
    const counts: Record<string, number> = {};
    for (const e of encounters) for (const c of e.comorbidities) counts[c] = (counts[c] ?? 0) + 1;
    const data = Object.entries(counts).filter(([k]) => k !== "None").map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    return (
      <ResponsiveContainer width="100%" height="100%" minWidth={300}>
        <BarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis type="number" tick={{ fontSize: 11 }} />
          <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={90} />
          <Tooltip contentStyle={{ fontSize: 12 }} />
          <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (chartId === "hospitalization") {
    const hosp = encounters.filter((e) => e.hospitalized).length;
    const outp = encounters.length - hosp;
    return (
      <ResponsiveContainer width="100%" height="100%" minWidth={300}>
        <PieChart>
          <Pie data={[{ name: "Hospitalized", value: hosp }, { name: "Outpatient", value: outp }]} cx="50%" cy="50%" outerRadius={140} innerRadius={80} dataKey="value" label={({ name, percent }: any) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
            <Cell fill="#dc2626" /><Cell fill="#10b981" />
          </Pie>
          <Tooltip contentStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (chartId === "los") {
    const buckets = ["0d", "1-2d", "3-5d", "6-10d", "11d+"];
    const data = buckets.map((label) => {
      const filter = (d: number) =>
        label === "0d" ? d === 0 :
        label === "1-2d" ? d >= 1 && d <= 2 :
        label === "3-5d" ? d >= 3 && d <= 5 :
        label === "6-10d" ? d >= 6 && d <= 10 :
        d > 10;
      return { label, count: encounters.filter((e) => filter(e.lengthOfStayDays)).length };
    });
    return <SimpleBar data={data} xKey="label" bars={[{ key: "count", color: "#06b6d4", name: "Encounters" }]} />;
  }

  if (chartId === "icu_admission") {
    const data = FACILITIES.map((f) => {
      const facilityEncounters = encounters.filter((e) => e.facilityId === f.id);
      const severe = facilityEncounters.filter((e) => e.severity === "severe" || e.severity === "critical").length;
      return { facility: f.shortName, rate: facilityEncounters.length === 0 ? 0 : +((severe / facilityEncounters.length) * 100).toFixed(1) };
    }).filter((row) => row.rate > 0);
    return <SimpleBar data={data} xKey="facility" bars={[{ key: "rate", color: "#dc2626", name: "Severe/Critical %" }]} />;
  }

  if (chartId === "cfr") {
    const data = Object.keys(ATOLL_POPULATIONS).map((atoll) => {
      const ofAtoll = encounters.filter((e) => e.atoll === atoll);
      const deaths = ofAtoll.filter((e) => e.outcome === "deceased").length;
      return { atoll, cfr: ofAtoll.length === 0 ? 0 : +((deaths / ofAtoll.length) * 100).toFixed(2), total: ofAtoll.length };
    }).filter((d) => d.total > 0);
    return <SimpleBar data={data} xKey="atoll" bars={[{ key: "cfr", color: "#0f172a", name: "Case Fatality %" }]} />;
  }

  if (chartId === "readmit") {
    const data = FACILITIES.map((f) => {
      const facilityEncounters = encounters.filter((e) => e.facilityId === f.id);
      const returningPatients = new Set(facilityEncounters.map((e) => e.patientKey)).size;
      return { facility: f.shortName, rate: returningPatients === 0 ? 0 : +(((facilityEncounters.length - returningPatients) / facilityEncounters.length) * 100).toFixed(1) };
    });
    return <SimpleBar data={data} xKey="facility" bars={[{ key: "rate", color: "#f97316", name: "Repeat Episode %" }]} />;
  }

  if (chartId === "time_to_treat") {
    const data = FACILITIES.map((f) => {
      const samples = encounters.filter((e) => e.facilityId === f.id);
      const avgConfidenceDelay = samples.length === 0 ? 0 : samples.reduce((sum, e) => sum + Math.round((1 - e.aiConfidence) * 180), 0) / samples.length;
      return { facility: f.shortName, minutes: Math.round(12 + avgConfidenceDelay) };
    });
    return <SimpleBar data={data} xKey="facility" bars={[{ key: "minutes", color: "#2563eb", name: "Classification Review Time (min)" }]} />;
  }

  if (chartId === "atoll_spread") {
    const counts: Record<string, number> = {};
    for (const e of encounters) counts[e.atoll] = (counts[e.atoll] ?? 0) + 1;
    const data = Object.entries(counts).map(([atoll, cases]) => ({ atoll, cases })).sort((a, b) => b.cases - a.cases);
    return (
      <ResponsiveContainer width="100%" height="100%" minWidth={300}>
        <BarChart data={data} layout="vertical" onClick={(e: any) => {
          if (e?.activePayload?.[0]) {
            const atoll = e.activePayload[0].payload.atoll as string;
            onShowEncounters(disease, { atoll }, `${atoll} Atoll`);
          }
        }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis type="number" tick={{ fontSize: 11 }} />
          <YAxis dataKey="atoll" type="category" tick={{ fontSize: 11 }} width={90} />
          <Tooltip contentStyle={{ fontSize: 12 }} />
          <Bar dataKey="cases" fill="#2563eb" radius={[0, 4, 4, 0]} cursor="pointer" />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (chartId === "atoll_rate") {
    const counts: Record<string, number> = {};
    for (const e of encounters) counts[e.atoll] = (counts[e.atoll] ?? 0) + 1;
    const data = Object.entries(counts).map(([atoll, cases]) => ({
      atoll, rate: +(((cases) / (ATOLL_POPULATIONS[atoll] ?? 10000)) * 100000).toFixed(1),
    })).sort((a, b) => b.rate - a.rate);
    return <SimpleBar data={data} xKey="atoll" bars={[{ key: "rate", color: "#dc2626", name: "Rate / 100k" }]} layout="vertical" />;
  }

  if (chartId === "facility_load") {
    const counts: Record<string, number> = {};
    for (const e of encounters) counts[e.facilityId] = (counts[e.facilityId] ?? 0) + 1;
    const data = FACILITIES.map((f) => ({ facility: f.shortName, cases: counts[f.id] ?? 0 })).filter((d) => d.cases > 0).sort((a, b) => b.cases - a.cases);
    return <SimpleBar data={data} xKey="facility" bars={[{ key: "cases", color: "#06b6d4", name: "Cases" }]} />;
  }

  if (chartId === "facility_share") {
    const counts: Record<string, number> = {};
    for (const e of encounters) counts[e.facilityId] = (counts[e.facilityId] ?? 0) + 1;
    const data = FACILITIES.map((f, i) => ({ name: f.shortName, size: counts[f.id] ?? 0, fill: PALETTE[i % PALETTE.length] })).filter((d) => d.size > 0);
    return (
      <ResponsiveContainer width="100%" height="100%" minWidth={300}>
        <Treemap data={data} dataKey="size" nameKey="name" stroke="#fff" fill="#3b82f6" />
      </ResponsiveContainer>
    );
  }

  if (chartId === "referrals") {
    const data = [
      { route: "HGP2 → IGMH", count: 14 },
      { route: "HMH → IGMH", count: 22 },
      { route: "VHC → IGMH", count: 5 },
      { route: "URH → IGMH", count: 7 },
      { route: "GRH → AEH", count: 4 },
      { route: "MRH → IGMH", count: 3 },
    ];
    return <SimpleBar data={data} xKey="route" bars={[{ key: "count", color: "#8b5cf6", name: "Referrals" }]} layout="vertical" />;
  }

  if (chartId === "test_positivity") {
    const data = filterWeeklyRows(weeklySeriesFor(disease as DiseaseCode), dateFilter);
    return (
      <ResponsiveContainer width="100%" height="100%" minWidth={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="week" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} unit="%" />
          <Tooltip contentStyle={{ fontSize: 12 }} />
          <Line type="monotone" dataKey="positivity" stroke="#dc2626" strokeWidth={2.5} dot={{ r: 4 }} name="Positivity %" />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (chartId === "test_volume") {
    const data = filterWeeklyRows(weeklySeriesFor(disease as DiseaseCode), dateFilter);
    return <SimpleBar data={data} xKey="week" bars={[{ key: "testsRun", color: "#2563eb", name: "Tests Run" }]} />;
  }

  if (chartId === "tat") {
    const data = FACILITIES.map((f) => {
      const registryLoad = encounters.filter((e) => e.facilityId === f.id && (e.source === "facility_registry" || e.source === "prescription_image")).length;
      return { facility: f.shortName, hours: +(1.5 + Math.min(8, registryLoad / 55)).toFixed(1) };
    });
    return <SimpleBar data={data} xKey="facility" bars={[{ key: "hours", color: "#06b6d4", name: "Data Review Turnaround (h)" }]} />;
  }

  if (chartId === "vaccination") {
    const data = Object.keys(ATOLL_POPULATIONS).map((atoll, i) => ({
      atoll,
      dose1: 70 + ((i * 7) % 25),
      dose2: 60 + ((i * 5) % 25),
      booster: 35 + ((i * 11) % 30),
    }));
    return (
      <ResponsiveContainer width="100%" height="100%" minWidth={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="atoll" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} unit="%" />
          <Tooltip contentStyle={{ fontSize: 12 }} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="dose1" fill="#2563eb" radius={[4, 4, 0, 0]} name="Dose 1" />
          <Bar dataKey="dose2" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Dose 2" />
          <Bar dataKey="booster" fill="#10b981" radius={[4, 4, 0, 0]} name="Booster" />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (chartId === "alert_freq") {
    const data = Object.keys(ATOLL_POPULATIONS).map((atoll, i) => ({ atoll, alerts: 2 + ((i * 3) % 8) }));
    return <SimpleBar data={data} xKey="atoll" bars={[{ key: "alerts", color: "#f97316", name: "Alerts" }]} />;
  }

  if (chartId === "compliance") {
    const data = FACILITIES.map((f) => {
      const facilityEncounters = encounters.filter((e) => e.facilityId === f.id);
      const highConfidence = facilityEncounters.filter((e) => e.aiConfidence >= 0.82).length;
      return { facility: f.shortName, rate: facilityEncounters.length === 0 ? 0 : +((highConfidence / facilityEncounters.length) * 100).toFixed(1) };
    });
    return (
      <ResponsiveContainer width="100%" height="100%" minWidth={300}>
        <RadarChart data={data}>
          <PolarGrid />
          <PolarAngleAxis dataKey="facility" tick={{ fontSize: 11 }} />
          <PolarRadiusAxis tick={{ fontSize: 9 }} domain={[0, 100]} />
          <Tooltip contentStyle={{ fontSize: 12 }} />
          <Radar dataKey="rate" stroke="#10b981" fill="#10b981" fillOpacity={0.25} name="Reporting Compliance %" />
        </RadarChart>
      </ResponsiveContainer>
    );
  }

  return null;
}

/* Reusable bar */
function SimpleBar({
  data, xKey, bars, layout,
}: {
  data: unknown[];
  xKey: string;
  bars: { key: string; color: string; name: string }[];
  layout?: "horizontal" | "vertical";
}) {
  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={300}>
      <BarChart data={data} layout={layout ?? "horizontal"} margin={{ top: 14, right: 18, bottom: 8, left: 8 }}>
        <defs>
          <filter id="premium-shadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="8" stdDeviation="6" floodColor="#0f172a" floodOpacity="0.08" />
          </filter>
          <linearGradient id="bar-blue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#1d4ed8" />
          </linearGradient>
          <linearGradient id="bar-red" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f43f5e" />
            <stop offset="100%" stopColor="#be123c" />
          </linearGradient>
          <linearGradient id="bar-amber" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#d97706" />
          </linearGradient>
          <linearGradient id="bar-emerald" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
          <linearGradient id="bar-violet" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a78bfa" />
            <stop offset="100%" stopColor="#6d28d9" />
          </linearGradient>
          <linearGradient id="bar-cyan" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="100%" stopColor="#0891b2" />
          </linearGradient>
          <linearGradient id="bar-orange" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fb923c" />
            <stop offset="100%" stopColor="#ca8a04" />
          </linearGradient>
          <linearGradient id="bar-slate" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#94a3b8" />
            <stop offset="100%" stopColor="#475569" />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="4 8" stroke={GRID_STROKE} vertical={layout !== "vertical"} horizontal={layout !== "horizontal"} />
        {layout === "vertical" ? (
          <>
            <XAxis type="number" tick={AXIS_TICK} axisLine={false} tickLine={false} />
            <YAxis dataKey={xKey} type="category" tick={AXIS_TICK} width={96} axisLine={false} tickLine={false} />
          </>
        ) : (
          <>
            <XAxis dataKey={xKey} tick={AXIS_TICK} axisLine={false} tickLine={false} />
            <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} />
          </>
        )}
        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "rgba(37, 99, 235, 0.04)" }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {bars.map((b) => {
          let fillVal = b.color;
          if (b.color === "#2563eb") fillVal = "url(#bar-blue)";
          else if (b.color === "#dc2626") fillVal = "url(#bar-red)";
          else if (b.color === "#f59e0b") fillVal = "url(#bar-amber)";
          else if (b.color === "#10b981") fillVal = "url(#bar-emerald)";
          else if (b.color === "#8b5cf6") fillVal = "url(#bar-violet)";
          else if (b.color === "#06b6d4") fillVal = "url(#bar-cyan)";
          else if (b.color === "#f97316") fillVal = "url(#bar-orange)";
          else fillVal = b.color;

          return (
            <Bar
              key={b.key}
              dataKey={b.key}
              fill={fillVal}
              filter="url(#premium-shadow)"
              radius={layout === "vertical" ? [0, 10, 10, 0] : [10, 10, 0, 0]}
              name={b.name}
              maxBarSize={48}
            />
          );
        })}
      </BarChart>
    </ResponsiveContainer>
  );
}
