"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  Activity, AlertTriangle, BarChart3, Bot, BrainCircuit, Building2, Check, ChevronDown, ChevronRight, ClipboardCheck, ClipboardList,
  Database, FileCheck, FileText, FlaskConical, Globe, LayoutDashboard,
  Lock, Map, Microscope, Network, Play, RefreshCw, ScrollText, Search, ShieldAlert, SlidersHorizontal, Sparkles, Stethoscope,
  UserRound, Users, UsersRound, X,
  Bug, GlassWater, Brain, HeartPulse, Droplet,
} from "lucide-react";
import { Brain as PhosphorBrain, FirstAidKit, GitBranch, Robot } from "@phosphor-icons/react";
import { motion } from "framer-motion";

import {
  DISEASES, DISEASE_BY_CODE, FACILITIES, IMPORTED_FOREIGN_ROWS, OUTBREAK_CLUSTERS,
  PATIENTS, REPORTS, encountersFor, fetchDashboardSummary, foreignEncounters,
  generateIncident, generateSystemLogs, originSummary,
  type DashboardSummary, type DiseaseCode, type FacilityStatus, type IncidentEvent,
  type LogEntry, type PatientEncounter, type ReportMeta,
} from "@/lib/surveillance-api";
import {
  DEFAULT_ANALYTICS_FILTERS,
  analyticsFiltersToEncounterLogFilter,
  filterAnalyticsEncounters,
  type AnalyticsFilterState,
  type EncounterLogFilter,
} from "@/lib/analytics-filters";

const SurveillanceMap = dynamic(() => import("@/components/surveillance/SurveillanceMap"), { ssr: false });
const AnalyticsCharts = dynamic(() => import("@/components/surveillance/AnalyticsCharts"), { ssr: false });
const EncounterLog = dynamic(() => import("@/components/surveillance/EncounterLog"), { ssr: false });
const ReportViewer = dynamic(() => import("@/components/surveillance/ReportViewer"), { ssr: false });

type SidebarView = "dashboard" | "map" | "analytics" | "outbreaks" | "patients" | "foreignAudit" | "fetching" | "logging" | "reports";
type IntakeScope = "24h" | "seeded" | "critical" | "foreign";

interface NavItem { id: SidebarView; label: string; icon: React.ComponentType<{ className?: string }>; iconUrl: string }

const NAV_ITEMS: NavItem[] = [
  { id: "dashboard", label: "Command Dashboard", icon: LayoutDashboard, iconUrl: "/icons/3d/computer.png" },
  { id: "map", label: "Maldives Disease Map", icon: Map, iconUrl: "/icons/people/earth.png" },
  { id: "analytics", label: "Interactive Analytics", icon: BarChart3, iconUrl: "/icons/people/chart.png" },
  { id: "outbreaks", label: "Disease Signals", icon: AlertTriangle, iconUrl: "/icons/3d/target.png" },
  { id: "patients", label: "Patient Statistics", icon: Users, iconUrl: "/icons/3d/boy.png" },
  { id: "foreignAudit", label: "All Patient Statistics", icon: FileCheck, iconUrl: "/icons/3d/file-text.png" },
  { id: "fetching", label: "Live Processing", icon: Database, iconUrl: "/icons/3d/wifi.png" },
  { id: "logging", label: "System Logs", icon: ScrollText, iconUrl: "/icons/3d/notebook.png" },
  { id: "reports", label: "AI Reports", icon: FileText, iconUrl: "/icons/3d/folder.png" },
];

const APP_ICON = {
  logo: "/logo-icon.png",
  shield: "/icons/3d/shield.png",
  computer: "/icons/3d/computer.png",
  mapPin: "/icons/3d/map-pin.png",
  chart: "/icons/3d/chart.png",
  target: "/icons/3d/target.png",
  patient: "/icons/3d/boy.png",
  file: "/icons/3d/file-text.png",
  intake: "/icons/3d/wifi.png",
  wifi: "/icons/3d/wifi.png",
  notebook: "/icons/3d/notebook.png",
  folder: "/icons/3d/folder.png",
};

const PEOPLE_ICON = {
  female: "/icons/people/female.png",
  male: "/icons/people/male.png",
  earth: "/icons/people/earth.png",
  chart: "/icons/people/chart.png",
  logoMedallion: "/icons/people/logo-medallion.png",
};

const signalStyles = {
  critical: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200", dot: "bg-red-500", glow: "shadow-red-200/70" },
  moderate: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", dot: "bg-amber-500", glow: "shadow-amber-200/70" },
  watch: { bg: "bg-sky-50", text: "text-sky-700", border: "border-sky-200", dot: "bg-sky-500", glow: "shadow-sky-200/70" },
  stable: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-500", glow: "shadow-emerald-200/70" },
};

const urgencyStyles = {
  critical: "bg-red-50 border-red-200 text-red-800",
  high: "bg-amber-50 border-amber-200 text-amber-800",
  medium: "bg-sky-50 border-sky-200 text-sky-800",
  low: "bg-emerald-50 border-emerald-200 text-emerald-800",
};

const logLevelStyles = {
  critical: "text-red-600 bg-red-50",
  error: "text-red-500 bg-red-50",
  warning: "text-amber-600 bg-amber-50",
  info: "text-blue-600 bg-blue-50",
};

interface EncounterLogRequest {
  disease: DiseaseCode | "all";
  filter?: EncounterLogFilter;
  label?: string;
}

function formatMvtTime() {
  const date = new Date();
  const calendar = date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const clock = `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}:${date.getSeconds().toString().padStart(2, "0")}`;
  return `${calendar} · ${clock}`;
}

export default function SurveillancePortal({ aiPaused = false }: { aiPaused?: boolean }) {
  const [view, setView] = useState<SidebarView>("dashboard");
  const [summary] = useState<DashboardSummary | null>(() => fetchDashboardSummary());
  const [incidents, setIncidents] = useState<IncidentEvent[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [currentTime, setCurrentTime] = useState("--:--:--");
  const [selectedFacility, setSelectedFacility] = useState<FacilityStatus | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [encounterLog, setEncounterLog] = useState<EncounterLogRequest | null>(null);
  const [selectedReport, setSelectedReport] = useState<ReportMeta | null>(null);
  const [analyticsFilters, setAnalyticsFilters] = useState<AnalyticsFilterState>(DEFAULT_ANALYTICS_FILTERS);

  useEffect(() => {
    setCurrentTime(formatMvtTime());
    setIncidents(Array.from({ length: 14 }, () => generateIncident()));
    setLogs(generateSystemLogs());

    const id = setInterval(() => {
      setCurrentTime(formatMvtTime());
    }, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setIncidents((prev) => [generateIncident(), ...prev].slice(0, 60));
    }, 6000);
    return () => clearInterval(id);
  }, []);

  const liveEncounters = useMemo(() => {
    if (view !== "analytics") return encountersFor("all");
    return filterAnalyticsEncounters(encountersFor(analyticsFilters.diagnosis as DiseaseCode | "all"), analyticsFilters);
  }, [view, analyticsFilters]);

  const headerStats = useMemo(() => {
    if (view === "analytics") {
      const active = liveEncounters.filter((item) => item.outcome === "active").length;
      const critical = liveEncounters.filter((item) => item.severity === "critical").length;
      const foreign = liveEncounters.filter((item) => item.origin === "foreign").length;
      return {
        episodes: liveEncounters.length,
        active,
        critical,
        foreign,
      };
    }
    return null;
  }, [view, liveEncounters]);

  if (!summary) return null;

  const showEncounters = (disease: DiseaseCode | "all", filter?: EncounterLogFilter, label?: string) => {
    const mergedFilter = view === "analytics"
      ? { ...analyticsFiltersToEncounterLogFilter(analyticsFilters), ...(filter ?? {}) }
      : filter;
    setEncounterLog({ disease, filter: mergedFilter, label });
  };

  return (
    <>
      {/* AI PAUSED BANNER — fixed top bar, does not affect layout */}
      {aiPaused && (
        <div className="fixed top-0 inset-x-0 z-[100] flex items-center justify-center gap-2.5 bg-amber-400/97 backdrop-blur-sm px-4 py-2 text-amber-950 text-sm font-semibold border-b border-amber-500/60">
          <Lock className="h-4 w-4 shrink-0" />
          <span>AI analysis is paused — add a valid <code className="font-mono bg-amber-950/10 px-1 rounded">OPENROUTER_API_KEY</code> to <code className="font-mono bg-amber-950/10 px-1 rounded">.env.local</code> to enable AI reports and episode analysis.</span>
        </div>
      )}
      <div className={`portal-network-bg h-screen w-screen overflow-hidden text-slate-900 flex relative bg-[#eef4fb] ${aiPaused ? "pt-10" : ""}`}>
      <div className="pointer-events-none absolute inset-0 opacity-45" style={{ background: "linear-gradient(135deg, rgba(248,251,255,0.76) 0%, rgba(234,241,249,0.58) 48%, rgba(240,253,250,0.62) 100%)" }} />
      <div className="pointer-events-none absolute inset-0 opacity-[0.24]" style={{ backgroundImage: "linear-gradient(rgba(15,23,42,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.05) 1px, transparent 1px)", backgroundSize: "38px 38px" }} />

      <aside className={`relative z-10 shrink-0 flex flex-col overflow-hidden bg-[#0b1f37]/95 text-white backdrop-blur-xl border-r border-cyan-300/18 shadow-[18px_0_60px_rgba(15,23,42,0.34)] transition-all duration-500 ease-out ${sidebarCollapsed ? "w-20" : "w-80"}`}>
        <div className="pointer-events-none absolute inset-0 opacity-95" style={{ background: "radial-gradient(circle at 12% 5%, rgba(56,189,248,0.32), transparent 22%), radial-gradient(circle at 95% 18%, rgba(37,99,235,0.32), transparent 28%), linear-gradient(180deg, rgba(255,255,255,0.08), transparent 30%), linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)", backgroundSize: "auto, auto, auto, 28px 28px, 28px 28px" }} />
        <div className="relative flex items-center gap-3 px-4 py-4 border-b border-cyan-200/14 bg-slate-950/20">
          <div className="mv-sidebar-brand-icon flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl">
            <LogoMedallion className="h-12 w-12" />
          </div>
          {!sidebarCollapsed && (
            <div className="overflow-hidden">
              <p className="text-lg font-black tracking-tight text-white truncate">MV-AIHA</p>
              <p className="text-[11px] text-cyan-100/70 truncate">Enterprise Disease Intelligence</p>
            </div>
          )}
          <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan-200/15 bg-white/8 text-cyan-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_12px_26px_rgba(2,6,23,0.22)] hover:bg-cyan-300/14 hover:text-white transition-all duration-300 cursor-pointer" title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}>
            <ChevronRight className={`h-4 w-4 transition-transform duration-300 ${sidebarCollapsed ? "" : "rotate-180"}`} />
          </button>
        </div>
        <nav className="relative flex-1 py-4 px-3 space-y-2 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const isActive = view === item.id;
            return (
              <button key={item.id} onClick={() => setView(item.id)} className={`group w-full flex items-center gap-4 rounded-2xl px-3 py-3 text-left text-[14px] font-black transition-all duration-300 ease-out cursor-pointer ${isActive ? "bg-gradient-to-r from-blue-600/95 via-cyan-500/85 to-sky-400/75 text-white shadow-[0_18px_38px_rgba(14,165,233,0.24)] ring-1 ring-cyan-100/35" : "text-slate-200 hover:bg-white/9 hover:text-white hover:translate-x-1"} ${sidebarCollapsed ? "justify-center" : ""}`} title={sidebarCollapsed ? item.label : undefined}>
                <span className={`mv-nav-icon relative flex h-12 w-12 shrink-0 items-center justify-center transition-all duration-300 ${isActive ? "is-active" : ""}`}>
                  <img src={item.iconUrl} alt="" className="relative z-10 h-11 w-11 object-contain drop-shadow-[0_10px_12px_rgba(2,6,23,0.28)] transition-transform duration-300 group-hover:scale-110" />
                  <item.icon className="sr-only" />
                  {isActive && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-emerald-300 shadow-[0_0_14px_rgba(110,231,183,0.9)]" />}
                </span>
                {!sidebarCollapsed && <span className="leading-tight drop-shadow-sm">{item.label}</span>}
              </button>
            );
          })}
        </nav>
        <div className="relative px-4 py-3 border-t border-cyan-200/14 bg-slate-950/24">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.8)]" />
            {!sidebarCollapsed && <span suppressHydrationWarning className="text-[10px] leading-tight text-cyan-100/70 font-mono">{currentTime} MVT</span>}
          </div>
        </div>
      </aside>

      <div className="relative z-10 flex-1 flex flex-col overflow-hidden">
        <header className="shrink-0 flex items-center justify-between px-6 py-4 bg-white/55 backdrop-blur-xl border-b border-white/70">
          <div>
            <h1 className="text-xl font-black text-slate-950 tracking-tight">{NAV_ITEMS.find((item) => item.id === view)?.label ?? "Command Dashboard"}</h1>
            <p className="text-xs text-slate-500">Ministry of Health - Maldives disease identification and surveillance</p>
          </div>
          <div className="hidden xl:flex items-center gap-2 animate-fadeIn">
            {headerStats ? (
              <>
                <Chip label="Episodes" value={headerStats.episodes.toLocaleString()} color="text-blue-700" />
                <Chip label="Active" value={headerStats.active.toLocaleString()} color="text-teal-600" />
                <Chip label="Critical" value={headerStats.critical.toLocaleString()} color="text-rose-600" />
                <Chip label="Foreign" value={headerStats.foreign.toLocaleString()} color="text-fuchsia-700" />
              </>
            ) : (
              <>
                <Chip label="Patients" value={summary.totalPatients} color="text-blue-700" />
                <Chip label="Episodes" value={summary.totalEpisodes.toLocaleString()} color="text-slate-900" />
                <Chip label="Foreign" value={summary.foreignEpisodes.toLocaleString()} color="text-fuchsia-700" />
                <Chip label="24h signals" value={`+${summary.newCasesLast24h}`} color="text-red-600" />
              </>
            )}
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-5">
          {view === "dashboard" && <DashboardView summary={summary} incidents={incidents} facilities={FACILITIES} onFacilityClick={setSelectedFacility} onShowEncounters={showEncounters} />}
          {view === "map" && <MapView facilities={FACILITIES} onFacilityClick={setSelectedFacility} />}
          {view === "analytics" && (
            <AnalyticsCharts
              onShowEncounters={showEncounters}
              filters={analyticsFilters}
              onFiltersChange={setAnalyticsFilters}
            />
          )}
          {view === "outbreaks" && <OutbreaksView onShowEncounters={showEncounters} />}
          {view === "patients" && <PatientSummaryView onShowEncounters={showEncounters} />}
          {view === "foreignAudit" && <PatientStatisticsView onShowEncounters={showEncounters} />}
          {view === "fetching" && <LiveFetchingView onShowEncounters={showEncounters} />}
          {view === "logging" && <LoggingView logs={logs} />}
          {view === "reports" && <ReportsView onOpen={setSelectedReport} analyticsFilters={analyticsFilters} aiPaused={aiPaused} />}
        </main>
      </div>

      {selectedFacility && <FacilityOverlay facility={selectedFacility} onClose={() => setSelectedFacility(null)} onShowEncounters={showEncounters} />}
      {encounterLog && <EncounterLog disease={encounterLog.disease} filter={encounterLog.filter} label={encounterLog.label} onClose={() => setEncounterLog(null)} />}
      {selectedReport && <ReportViewer meta={selectedReport} onClose={() => setSelectedReport(null)} />}
    </div>{/* end portal-network-bg */}
    </> 
  );
}

function IconTile({ icon: Icon, tone = "blue", compact = false, imageUrl }: { icon: React.ComponentType<{ className?: string }>; tone?: "blue" | "emerald" | "amber" | "rose" | "violet" | "slate"; compact?: boolean; imageUrl?: string }) {
  if (imageUrl) {
    return (
      <div className={`mv-pure-3d-icon ${compact ? "h-10 w-10" : "h-12 w-12"} shrink-0 relative flex items-center justify-center`}>
        <img src={imageUrl} alt="" className={`${compact ? "h-10 w-10" : "h-12 w-12"} relative z-10 object-contain drop-shadow-[0_16px_18px_rgba(15,23,42,0.2)]`} />
      </div>
    );
  }

  return (
    <div className={`mv-skeuo-icon mv-skeuo-${tone} ${compact ? "h-10 w-10" : "h-12 w-12"} shrink-0 rounded-2xl relative overflow-hidden flex items-center justify-center`}>
      <Icon className={`${compact ? "h-5 w-5" : "h-6 w-6"} text-white relative z-10 drop-shadow`} />
    </div>
  );
}

function FlatCategoryIcon({ icon: Icon, tone = "blue", compact = false }: { icon: React.ComponentType<{ className?: string }>; tone?: "blue" | "emerald" | "amber" | "rose" | "violet" | "slate"; compact?: boolean }) {
  const tones = {
    blue: "bg-blue-50 text-blue-700 border-blue-100",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
    amber: "bg-amber-50 text-amber-700 border-amber-100",
    rose: "bg-rose-50 text-rose-700 border-rose-100",
    violet: "bg-violet-50 text-violet-700 border-violet-100",
    slate: "bg-slate-100 text-slate-700 border-slate-200",
  };
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-2xl border ${tones[tone]} ${compact ? "h-10 w-10" : "h-12 w-12"}`}>
      <Icon className={compact ? "h-5 w-5" : "h-6 w-6"} />
    </span>
  );
}

function LogoMedallion({ className = "h-10 w-10" }: { className?: string }) {
  return <img src={PEOPLE_ICON.logoMedallion} alt="" aria-hidden="true" className={`${className} object-contain shrink-0 drop-shadow-[0_14px_18px_rgba(15,23,42,0.22)]`} />;
}

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-white/70 bg-white/72 backdrop-blur-xl shadow-[0_18px_50px_rgba(15,23,42,0.08)] ${className}`}>{children}</div>;
}

function Chip({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-white/75 rounded-xl border border-white/80 shadow-sm">
      <span className="text-[10px] text-slate-500 uppercase tracking-wide font-bold">{label}</span>
      <span className={`text-sm font-black font-mono ${color}`}>{value}</span>
    </div>
  );
}

function StatCard({ label, value, sub, icon, tone, imageUrl }: { label: string; value: string | number; sub?: string; icon: React.ComponentType<{ className?: string }>; tone: "blue" | "emerald" | "amber" | "rose" | "violet" | "slate"; imageUrl?: string }) {
  return (
    <Panel className="stat-glass-card p-4 hover:-translate-y-0.5 transition-transform duration-300">
      <div className="flex items-center gap-3">
        <IconTile icon={icon} tone={tone} imageUrl={imageUrl} />
        <div className="min-w-0">
          <p className="text-xs text-slate-500 font-semibold">{label}</p>
          <p className="text-2xl font-black font-mono text-slate-950">{value}</p>
          {sub && <p className="text-[11px] text-slate-500 truncate">{sub}</p>}
        </div>
      </div>
    </Panel>
  );
}

function FacilityOverlay({ facility, onClose, onShowEncounters }: { facility: FacilityStatus; onClose: () => void; onShowEncounters: (d: DiseaseCode | "all", filter?: Partial<PatientEncounter>, label?: string) => void }) {
  const style = signalStyles[facility.status];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[88vh] overflow-y-auto" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between p-6 border-b border-slate-100 bg-gradient-to-br from-white to-slate-50">
          <div className="flex items-start gap-3">
            <IconTile icon={Stethoscope} tone={facility.status === "critical" ? "rose" : facility.status === "moderate" ? "amber" : "blue"} />
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={`h-2.5 w-2.5 rounded-full ${style.dot}`} />
                <span className={`text-xs font-black uppercase ${style.text}`}>{facility.status} disease signal</span>
                <span className="text-[10px] uppercase text-slate-400">{facility.type}</span>
              </div>
              <h2 className="text-xl font-black text-slate-950">{facility.name}</h2>
              <p className="text-xs text-slate-500">{facility.island} - {facility.atoll} Atoll</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 cursor-pointer"><X className="h-5 w-5" /></button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-5">
          <MiniStat label="Disease episodes" value={facility.activeCases} tone="blue" />
          <MiniStat label="Same-day signals" value={facility.conditions.reduce((sum, item) => sum + item.last24h, 0)} tone={facility.status === "critical" ? "rose" : "amber"} />
          <MiniStat label="Tracked diseases" value={facility.conditions.length} tone="emerald" />
        </div>
        {facility.alerts.length > 0 && (
          <div className="px-5 pb-4">
            <p className="text-xs font-black text-slate-700 mb-2 uppercase tracking-wide">Disease alerts</p>
            <div className="space-y-2">
              {facility.alerts.map((alert, index) => (
                <div key={index} className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />{alert}
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="px-5 pb-5">
          <p className="text-xs font-black text-slate-700 mb-2 uppercase tracking-wide">Diseases - click to review de-identified patients</p>
          <div className="space-y-2">
            {facility.conditions.map((item) => {
              const itemStyle = signalStyles[item.signal];
              return (
                <button key={item.code} onClick={() => onShowEncounters(item.code, { facilityId: facility.id }, `${DISEASE_BY_CODE[item.code].name} - ${facility.shortName}`)} className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 cursor-pointer border border-slate-100 text-left">
                  <div className="flex items-center gap-3">
                    <span className={`h-8 w-8 rounded-xl ${itemStyle.bg} ${itemStyle.text} flex items-center justify-center text-[10px] font-black border ${itemStyle.border}`}>{DISEASE_BY_CODE[item.code].icd10}</span>
                    <div>
                      <p className="text-sm font-bold text-slate-800">{DISEASE_BY_CODE[item.code].name}</p>
                      <p className="text-[11px] text-slate-500">{item.last24h} same-day cases - {item.signal} threshold</p>
                    </div>
                  </div>
                  <span className="text-lg font-black font-mono text-slate-950">{item.count}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string | number; tone: "blue" | "emerald" | "amber" | "rose" }) {
  const tones = {
    blue: "from-blue-50 to-cyan-50 text-blue-700 border-blue-100",
    emerald: "from-emerald-50 to-teal-50 text-emerald-700 border-emerald-100",
    amber: "from-amber-50 to-orange-50 text-amber-700 border-amber-100",
    rose: "from-rose-50 to-red-50 text-red-700 border-red-100",
  };
  return (
    <div className={`rounded-2xl border bg-gradient-to-br p-4 ${tones[tone]}`}>
      <p className="text-[10px] uppercase tracking-wide font-bold opacity-70">{label}</p>
      <p className="text-2xl font-black font-mono">{value}</p>
    </div>
  );
}

function OriginComparison({ disease = "all", onShowEncounters }: { disease?: DiseaseCode | "all"; onShowEncounters: (d: DiseaseCode | "all", filter?: Partial<PatientEncounter>, label?: string) => void }) {
  const rows = originSummary(disease);
  const max = Math.max(1, ...rows.map((row) => row.count));
  const roots = [
    { gender: "F" as const, label: "Female", icon: PEOPLE_ICON.female, accent: "from-rose-500 to-fuchsia-500", soft: "from-rose-50/88 to-white/82", countTone: "text-rose-700" },
    { gender: "M" as const, label: "Male", icon: PEOPLE_ICON.male, accent: "from-blue-600 to-cyan-500", soft: "from-blue-50/88 to-white/82", countTone: "text-blue-700" },
  ].map((root) => ({
    ...root,
    local: rows.find((row) => row.gender === root.gender && row.origin === "local"),
    foreign: rows.find((row) => row.gender === root.gender && row.origin === "foreign"),
  }));
  return (
    <Panel className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-black text-slate-800">Male and female origin intelligence</p>
          <p className="text-xs text-slate-500">Gender is the root layer; local and foreign cohorts sit underneath each branch.</p>
        </div>
        <img src={PEOPLE_ICON.earth} alt="" className="h-10 w-10 object-contain drop-shadow-[0_12px_14px_rgba(15,23,42,0.18)]" />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {roots.map((root) => {
          const total = (root.local?.count ?? 0) + (root.foreign?.count ?? 0);
          const branches = [
            { row: root.local, label: "Local", description: "Maldivian resident records", tone: "bg-blue-50 text-blue-700 border-blue-100" },
            { row: root.foreign, label: "Foreign", description: "Passport/work-permit records", tone: "bg-teal-50 text-teal-700 border-teal-100" },
          ];
          return (
            <div key={root.gender} className={`overflow-hidden rounded-[26px] border border-white/80 bg-gradient-to-br ${root.soft} p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.76),0_16px_34px_rgba(15,23,42,0.06)]`}>
              <div className="flex items-center gap-4">
                <div className="flex h-28 w-24 shrink-0 items-center justify-center">
                  <img src={root.icon} alt="" className="max-h-28 max-w-24 object-contain drop-shadow-[0_18px_20px_rgba(15,23,42,0.14)]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Primary cohort</p>
                  <h3 className="text-2xl font-black tracking-tight text-slate-950">{root.label}</h3>
                  <p className={`mt-1 font-mono text-3xl font-black ${root.countTone}`}>{total.toLocaleString()}</p>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/80">
                    <div className={`h-full rounded-full bg-gradient-to-r ${root.accent}`} style={{ width: `${Math.max(7, (total / (max * 2)) * 100)}%` }} />
                  </div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                {branches.map(({ row, label, description, tone }) => row && (
                  <button key={`${root.gender}-${label}`} onClick={() => onShowEncounters(disease, { origin: row.origin as PatientEncounter["origin"], gender: row.gender as PatientEncounter["gender"] }, `${root.label} / ${label} - ${disease === "all" ? "all diseases" : DISEASE_BY_CODE[disease].name}`)} className="group text-left rounded-2xl border border-white/80 bg-white/74 p-3 transition-all hover:-translate-y-0.5 hover:bg-white/95 hover:shadow-[0_16px_30px_rgba(15,23,42,0.08)] cursor-pointer">
                    <div className="flex items-center justify-between gap-3">
                      <span className={`rounded-xl border px-2 py-1 text-[10px] font-black uppercase ${tone}`}>{label}</span>
                      <ChevronRight className="h-4 w-4 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-blue-500" />
                    </div>
                    <p className="mt-2 text-[11px] font-semibold text-slate-500">{description}</p>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className={`h-full rounded-full bg-gradient-to-r ${root.accent}`} style={{ width: `${Math.max(7, (row.count / max) * 100)}%` }} />
                    </div>
                    <p className="mt-2 font-mono text-2xl font-black text-slate-950">{row.count.toLocaleString()}</p>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function DashboardView({ summary, incidents, facilities, onFacilityClick, onShowEncounters }: { summary: DashboardSummary; incidents: IncidentEvent[]; facilities: FacilityStatus[]; onFacilityClick: (f: FacilityStatus) => void; onShowEncounters: (d: DiseaseCode | "all", filter?: Partial<PatientEncounter>, label?: string) => void }) {
  return (
    <div className="space-y-5">
      <Panel className="overflow-hidden">
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_520px] min-h-[300px]">
          <div className="p-6 flex flex-col justify-between bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 text-white relative overflow-hidden">
            <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "radial-gradient(circle at 20% 20%, rgba(56,189,248,0.5), transparent 25%), radial-gradient(circle at 90% 10%, rgba(16,185,129,0.35), transparent 24%)" }} />
            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/15 px-3 py-1 text-xs font-bold text-blue-100 mb-4">
                <img src={APP_ICON.shield} alt="" className="h-7 w-7 object-contain drop-shadow-[0_12px_18px_rgba(15,23,42,0.2)]" /> AI disease surveillance engine
              </div>
              <h2 className="max-w-2xl text-3xl font-black tracking-tight">Maldives disease signals, patient statistics, and facility alerts in one command surface.</h2>
              <p className="mt-3 max-w-xl text-sm text-blue-100/80">This portal observes safe feeds from connected systems. It does not upload patient files or store source records.</p>
            </div>
            <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
              <HeroMetric label="Patients" value={summary.totalPatients} />
              <HeroMetric label="Episodes" value={summary.totalEpisodes.toLocaleString()} />
              <HeroMetric label="Foreign episodes" value={summary.foreignEpisodes.toLocaleString()} />
              <HeroMetric label="Critical signals" value={summary.criticalFacilities} />
            </div>
          </div>
          <div className="min-h-[300px]"><SurveillanceMap facilities={facilities} onFacilityClick={onFacilityClick} height="100%" /></div>
        </div>
      </Panel>

      <OriginComparison onShowEncounters={onShowEncounters} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Active episodes" value={summary.totalActiveCases.toLocaleString()} icon={Activity} tone="rose" sub="De-identified only" />
        <StatCard label="New disease signals" value={`+${summary.newCasesLast24h}`} icon={AlertTriangle} tone="amber" sub="Same-day facility counts" />
        <StatCard label="Recovery rate" value={`${summary.recoveryRate}%`} icon={FileCheck} tone="emerald" sub="Episode outcomes" />
        <StatCard label="Facilities" value={summary.totalFacilities} icon={Building2} tone="blue" sub="Maldives network" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-4">
        <Panel className="overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/70">
            <div className="flex items-center gap-2"><IconTile icon={Globe} tone="blue" compact /><span className="text-sm font-black text-slate-800">Disease map - Maldives only</span></div>
            <span className="text-[10px] text-slate-500 font-mono">{facilities.length} verified pins</span>
          </div>
          <SurveillanceMap facilities={facilities} onFacilityClick={onFacilityClick} height="430px" />
        </Panel>
        <div className="space-y-4">
          <FacilityList facilities={facilities} onFacilityClick={onFacilityClick} />
          <LiveFeed incidents={incidents} onShowEncounters={onShowEncounters} />
        </div>
      </div>
    </div>
  );
}

function HeroMetric({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-2xl bg-white/10 border border-white/15 p-3"><p className="text-[10px] uppercase text-blue-100/70 font-bold">{label}</p><p className="text-2xl font-black font-mono text-white">{value}</p></div>;
}

function FacilityList({ facilities, onFacilityClick }: { facilities: FacilityStatus[]; onFacilityClick: (f: FacilityStatus) => void }) {
  return (
    <Panel className="overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/70"><IconTile icon={Building2} tone="blue" compact /><span className="text-sm font-black text-slate-800">Facilities</span></div>
      <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
        {facilities.map((facilityItem) => {
          const style = signalStyles[facilityItem.status];
          const topDisease = [...facilityItem.conditions].sort((a, b) => b.last24h - a.last24h)[0];
          return (
            <button key={facilityItem.id} onClick={() => onFacilityClick(facilityItem)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/70 transition-colors cursor-pointer text-left">
              <div className="flex items-center gap-2 min-w-0"><span className={`h-2.5 w-2.5 rounded-full ${style.dot}`} /><div className="min-w-0"><p className="text-sm font-bold text-slate-800 truncate">{facilityItem.shortName}</p><p className="text-[11px] text-slate-500 truncate">{DISEASE_BY_CODE[topDisease.code].name} - {topDisease.last24h} today</p></div></div>
              <span className={`px-2 py-1 rounded-lg text-[10px] font-black ${style.bg} ${style.text}`}>{facilityItem.status}</span>
            </button>
          );
        })}
      </div>
    </Panel>
  );
}

function LiveFeed({ incidents, onShowEncounters }: { incidents: IncidentEvent[]; onShowEncounters: (d: DiseaseCode | "all", filter?: Partial<PatientEncounter>, label?: string) => void }) {
  return (
    <Panel className="overflow-hidden flex flex-col max-h-[360px]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/70 shrink-0">
        <div className="flex items-center gap-2"><IconTile icon={Activity} tone="rose" compact /><span className="text-sm font-black text-slate-800">Live disease feed</span></div>
        <span className="text-[10px] text-slate-500 font-mono">{incidents.length}</span>
      </div>
      <div className="overflow-y-auto divide-y divide-slate-100">
        {incidents.slice(0, 15).map((incident) => (
          <button key={incident.id} onClick={() => onShowEncounters(incident.diseaseCode, { facilityId: incident.facilityId }, `${incident.diseaseName} - ${incident.facilityName}`)} className={`w-full text-left px-3 py-2 text-xs border-l-2 hover:bg-white/70 cursor-pointer ${urgencyStyles[incident.urgency]}`}>
            <div className="flex items-center justify-between"><span className="font-mono text-slate-500">[{incident.timestamp}]</span><span className="font-black text-[10px] uppercase">{incident.urgency}</span></div>
            <p className="mt-0.5"><span className="font-bold">{incident.facilityName}</span> - {incident.description}</p>
          </button>
        ))}
      </div>
    </Panel>
  );
}

function MapView({ facilities, onFacilityClick }: { facilities: FacilityStatus[]; onFacilityClick: (f: FacilityStatus) => void }) {
  return <Panel className="overflow-hidden h-full"><SurveillanceMap facilities={facilities} onFacilityClick={onFacilityClick} height="100%" /></Panel>;
}

function OutbreaksView({ onShowEncounters }: { onShowEncounters: (d: DiseaseCode | "all", filter?: Partial<PatientEncounter>, label?: string) => void }) {
  return (
    <div className="space-y-4">
      {OUTBREAK_CLUSTERS.map((cluster) => (
        <Panel key={cluster.id} className="p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <IconTile icon={AlertTriangle} tone={cluster.severity === "critical" ? "rose" : cluster.severity === "high" ? "amber" : "blue"} />
              <div>
                <div className="flex items-center gap-2 mb-1"><span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase ${urgencyStyles[cluster.severity]}`}>{cluster.severity}</span><span className="text-[10px] font-mono text-slate-500">{cluster.id}</span></div>
                <h3 className="text-lg font-black text-slate-950">{cluster.name}</h3>
                  <p className="text-sm text-slate-500">{DISEASE_BY_CODE[cluster.diseaseCode].name} - {cluster.affectedFacilities.length} facilities reviewed</p>
              </div>
            </div>
            <div className="text-right"><p className="text-3xl font-black font-mono text-red-600">+{cluster.newCasesLast24h}</p><p className="text-[10px] text-slate-500 uppercase font-bold">same-day cases</p></div>
          </div>
          <button onClick={() => onShowEncounters(cluster.diseaseCode, undefined, `${cluster.name} - de-identified patient log`)} className="mt-4 inline-flex items-center gap-2 text-xs font-black text-blue-700 hover:text-blue-900 cursor-pointer">Open patient history <ChevronRight className="h-3.5 w-3.5" /></button>
        </Panel>
      ))}
    </div>
  );
}

function PatientSummaryView({ onShowEncounters }: { onShowEncounters: (d: DiseaseCode | "all", filter?: Partial<PatientEncounter>, label?: string) => void }) {
  const [filterDisease, setFilterDisease] = useState<DiseaseCode | "all">("all");
  const list = encountersFor(filterDisease);
  const critical = list.filter((item) => item.severity === "critical").length;
  const foreign = list.filter((item) => item.origin === "foreign").length;
  const manualReview = list.filter((item) => item.aiConfidence < 0.82 || item.source === "manual_review").length;
  const diseases = DISEASES.map((disease) => ({ disease, count: encountersFor(disease.code).length })).sort((a, b) => b.count - a.count);

  const diseaseIcons: Record<string, React.ComponentType<{ className?: string }>> = {
    ili: Stethoscope,
    dengue: Bug,
    gastro: GlassWater,
    febrile_seizure: Brain,
    chest_pain: HeartPulse,
    dehydration: Droplet,
    influenza: Stethoscope,
    pneumonia: Stethoscope,
    diarrhea: GlassWater,
    hfmd: Stethoscope,
  };

  const diseaseTones: Record<string, "blue" | "emerald" | "amber" | "rose" | "violet" | "slate"> = {
    ili: "blue",
    dengue: "rose",
    gastro: "amber",
    febrile_seizure: "violet",
    chest_pain: "rose",
    dehydration: "slate",
    influenza: "blue",
    pneumonia: "violet",
    diarrhea: "emerald",
    hfmd: "amber",
  };

  return (
    <div className="space-y-4">
      <Panel className="p-4 flex items-center gap-3 flex-wrap">
        <span className="text-xs font-black text-slate-700 uppercase tracking-wide">Disease filter</span>
        <PatientDiseaseMenu value={filterDisease} onChange={setFilterDisease} />
        <button onClick={() => onShowEncounters(filterDisease, undefined, filterDisease === "all" ? "All patient episodes" : `${DISEASE_BY_CODE[filterDisease].name} - all episodes`)} className="ml-auto text-xs font-black text-white bg-blue-600 hover:bg-blue-500 rounded-xl px-3 py-2 cursor-pointer">Open encounter log</button>
      </Panel>
      <OriginComparison disease={filterDisease} onShowEncounters={onShowEncounters} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Episodes" value={list.length.toLocaleString()} icon={ClipboardList} tone="blue" sub={`${PATIENTS.length} patient histories`} />
        <StatCard label="Foreign episodes" value={foreign.toLocaleString()} icon={UsersRound} tone="amber" />
        <StatCard label="Critical severity" value={critical.toLocaleString()} icon={AlertTriangle} tone="rose" />
        <StatCard label="Manual review" value={manualReview.toLocaleString()} icon={Search} tone="violet" />
      </div>
      <Panel className="overflow-hidden">
        <div className="px-4 py-3 border-b border-white/70"><span className="text-sm font-black text-slate-800">Disease breakdown - click for patient history</span></div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 p-4 animate-fadeIn">
          {diseases.map((row) => {
            const IconComponent = diseaseIcons[row.disease.code] || Stethoscope;
            const tone = diseaseTones[row.disease.code] || "blue";
            return (
              <button key={row.disease.code} onClick={() => onShowEncounters(row.disease.code, undefined, `${row.disease.name} - all de-identified episodes`)} className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white/70 p-3 hover:shadow-md transition-shadow text-left cursor-pointer">
                <div className="flex items-center gap-3">
                  <FlatCategoryIcon icon={IconComponent} tone={tone} compact />
                  <div>
                    <p className="text-sm font-black text-slate-800">{row.disease.name}</p>
                    <p className="text-[11px] text-slate-500">{row.disease.icd10} - {row.disease.category}</p>
                  </div>
                </div>
                <p className="text-xl font-black font-mono text-slate-950">{row.count.toLocaleString()}</p>
              </button>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}

function PatientDiseaseMenu({ value, onChange }: { value: DiseaseCode | "all"; onChange: (value: DiseaseCode | "all") => void }) {
  const [open, setOpen] = useState(false);
  const selected = value === "all" ? null : DISEASE_BY_CODE[value];
  return (
    <div className="relative min-w-[280px]">
      <button onClick={() => setOpen((current) => !current)} className="modern-menu-button w-full cursor-pointer">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-600"><Search className="h-5 w-5" /></span>
        <span className="min-w-0 flex-1 text-left">
          <span className="block text-[9px] font-black uppercase tracking-wider text-blue-600">Diagnosis</span>
          <span className="block truncate text-sm font-black text-slate-800">{selected?.name ?? "All diseases"}</span>
        </span>
        <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="modern-menu-popover left-0 top-[calc(100%+10px)] w-[420px]">
          <button onClick={() => { onChange("all"); setOpen(false); }} className={`modern-menu-choice ${value === "all" ? "is-selected" : ""}`}>
            <span><strong>All diseases</strong><small>National patient episode library</small></span>{value === "all" && <Check className="h-4 w-4" />}
          </button>
          {DISEASES.map((disease) => (
            <button key={disease.code} onClick={() => { onChange(disease.code); setOpen(false); }} className={`modern-menu-choice ${value === disease.code ? "is-selected" : ""}`}>
              <span><strong>{disease.name}</strong><small>{disease.icd10} - {disease.category}</small></span>{value === disease.code && <Check className="h-4 w-4" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PatientStatisticsView({ onShowEncounters }: { onShowEncounters: (d: DiseaseCode | "all", filter?: Partial<PatientEncounter>, label?: string) => void }) {
  const foreignList = foreignEncounters();
  const allEpisodes = encountersFor("all");
  const dengueForeign = foreignList.filter((item) => item.diseaseCode === "dengue");
  const localEpisodes = allEpisodes.filter((item) => item.origin === "local");
  const severe = allEpisodes.filter((item) => item.severity === "severe" || item.severity === "critical");
  const sourceRows = ["vinavi", "aasandha", "foreign_portal", "manual_review"].map((source) => ({
    source,
    label: source === "vinavi" ? "Vinavi consultations" : source === "aasandha" ? "Aasandha links" : source === "foreign_portal" ? "Foreign portal feed" : "Manual review",
    count: source === "vinavi" ? allEpisodes.length : source === "aasandha" ? PATIENTS.length : source === "foreign_portal" ? foreignList.length : allEpisodes.filter((item) => item.source === "manual_review").length,
  }));
  return (
    <div className="space-y-4">
      <Panel className="p-5 bg-gradient-to-br from-white/85 to-blue-50/80">
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-5 items-center">
          <div>
            <div className="flex items-center gap-2 mb-2"><IconTile icon={UsersRound} tone="emerald" /><div><p className="text-lg font-black text-slate-950">All Patient Statistics</p><p className="text-xs text-slate-500">Read-only view of local, foreign, and source-linked patient counts</p></div></div>
            <p className="text-sm text-slate-600 max-w-3xl">This portal does not upload or store patient files. It observes safe feeds from Vinavi, Aasandha, and the future foreign-patient portal, then shows simple totals for the surveillance team.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <MiniStat label="All episodes" value={allEpisodes.length.toLocaleString()} tone="blue" />
            <MiniStat label="Patients" value={PATIENTS.length.toLocaleString()} tone="emerald" />
          </div>
        </div>
      </Panel>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Local episodes" value={localEpisodes.length.toLocaleString()} icon={Users} tone="blue" sub="From local patient feeds" />
        <StatCard label="Foreign episodes" value={foreignList.length.toLocaleString()} icon={Globe} tone="amber" sub="From foreign portal feed" />
        <StatCard label="Foreign dengue" value={dengueForeign.length.toLocaleString()} icon={Bug} tone="rose" sub="Watch cohort" />
        <StatCard label="Severe / critical" value={severe.length.toLocaleString()} icon={AlertTriangle} tone="rose" sub="Needs review" />
      </div>

      <OriginComparison disease="dengue" onShowEncounters={onShowEncounters} />

      <Panel className="overflow-hidden">
        <div className="px-4 py-3 border-b border-white/70 flex items-center gap-2"><FileCheck className="h-4 w-4 text-blue-600" /><span className="text-sm font-black text-slate-800">Observed foreign-portal classifications</span></div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-white/50 text-left text-[10px] uppercase tracking-wide text-slate-500 font-black"><tr><th className="px-4 py-3">Source</th><th className="px-4 py-3">Safe token</th><th className="px-4 py-3">Age/Sex</th><th className="px-4 py-3">Clinical summary</th><th className="px-4 py-3">Disease</th><th className="px-4 py-3">Action</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {IMPORTED_FOREIGN_ROWS.slice(0, 8).map((row) => (
                <tr key={row.row} className="hover:bg-white/60">
                  <td className="px-4 py-3 font-bold text-slate-700">Foreign portal</td>
                  <td className="px-4 py-3 font-mono text-slate-600">FP-{row.row.toString().padStart(4, "0")}<br /><span className="text-[10px] text-slate-400">identifier kept outside this portal</span></td>
                  <td className="px-4 py-3 text-slate-700">{row.age} / {row.gender}</td>
                  <td className="px-4 py-3 text-slate-600 max-w-xs">{row.diagnosisText}</td>
                  <td className="px-4 py-3"><span className="px-2 py-1 rounded-lg bg-red-50 text-red-700 font-black">{DISEASE_BY_CODE[row.diseaseCode].name}</span><br /><span className="text-[10px] text-slate-400">conf. {row.aiConfidence.toFixed(2)}</span></td>
                  <td className="px-4 py-3"><span className={`px-2 py-1 rounded-lg font-black ${row.action === "auto-classified" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{row.action}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel className="p-4">
        <p className="text-sm font-black text-slate-800 mb-3">Connected source summary</p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {sourceRows.map((row) => <MiniStat key={row.source} label={row.label} value={row.count.toLocaleString()} tone={row.source === "manual_review" ? "rose" : row.source === "foreign_portal" ? "amber" : "blue"} />)}
        </div>
      </Panel>
    </div>
  );
}

interface SeededConsultationLite {
  id: string;
  patientId: string;
  aasandhaNo?: string;
  episodeId: string;
  diagnosis: string;
  facility: string;
  sourcePortal?: "Vinavi" | "Aasandha";
  sourceAction?: "patient-linked" | "episode-closed" | "claim-verified";
  createdAt: string;
  status: "queued" | "reading" | "done";
  stage: "received" | "privacy-check" | "clinical-read" | "anomaly-check" | "briefing" | "ready";
  assignedAgent: "Raw Ingestion Buffer" | "Analytical Synthesizer" | "Strategic Briefing Engine" | "MV-AIHA Router";
  priority: "routine" | "watch" | "urgent";
  confidence: number;
  progress: number;
  interactions: string[];
  assessment?: string[];
}

interface SeededQueueSummary {
  totalQueued: number;
  visible: number;
  reading: number;
  done: number;
  urgent: number;
  agents: { agent: string; count: number }[];
}

function LiveFetchingView({ onShowEncounters }: { onShowEncounters: (d: DiseaseCode | "all", filter?: Partial<PatientEncounter>, label?: string) => void }) {
  const [running, setRunning] = useState(true);
  const [step, setStep] = useState(0);
  const [scope, setScope] = useState<IntakeScope>("24h");
  const [manualNote, setManualNote] = useState("Add operator context here, for example: school cluster reported in Hulhumale, verify dengue trend before alert.");
  const [seeded, setSeeded] = useState<SeededConsultationLite[]>([]);
  const [seedSummary, setSeedSummary] = useState<SeededQueueSummary | null>(null);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [selectedSeed, setSelectedSeed] = useState<SeededConsultationLite | null>(null);
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [pipelineResult, setPipelineResult] = useState<{ paused?: boolean; purgeSummary?: { recordCount: number; removedFieldCount: number; scrubbedTextSpans: number }; briefing?: { briefing: string; priorityLevel: string; recommendedActions: string[] }; error?: string } | null>(null);

  const bots = useMemo(() => [
    { name: "Raw Ingestion Buffer", icon: FirstAidKit, task: "cleans incoming batches", model: "DeepSeek V4 Flash" },
    { name: "Analytical Synthesizer", icon: PhosphorBrain, task: "checks spikes and baselines", model: "Nemotron 3 Super" },
    { name: "Strategic Briefing", icon: Robot, task: "writes final health brief", model: "GPT-OSS 120B" },
    { name: "MV-AIHA Router", icon: GitBranch, task: "releases only safe totals", model: "local guard" },
  ], []);

  const visibleSeeded = seeded.filter((item) => {
    if (scope === "critical") return item.priority === "urgent";
    if (scope === "foreign") return item.sourcePortal === "Aasandha";
    return true;
  });
  const queueSize = visibleSeeded.length;
  const completed = Math.min(queueSize, step + visibleSeeded.filter((item) => item.status === "done").length);

  const loadSeededQueue = async () => {
    try {
      const response = await fetch("/api/seed-consultations", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      setSeeded((payload.consultations ?? []) as SeededConsultationLite[]);
      setSeedSummary((payload.summary ?? null) as SeededQueueSummary | null);
      setQueueError(null);
    } catch (error) {
      setQueueError(error instanceof Error ? error.message : "Seed queue unavailable");
      setSeeded([]);
    }
  };

  const seedConsultations = async (amount: number) => {
    setSeeding(true);
    setQueueError(null);
    try {
      const response = await fetch("/api/seed-consultations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      await loadSeededQueue();
      setScope("seeded");
    } catch (error) {
      setQueueError(error instanceof Error ? error.message : "Could not seed consultations");
    } finally {
      setSeeding(false);
    }
  };

  const clearQueue = async () => {
    setQueueError(null);
    try {
      const response = await fetch("/api/seed-consultations", { method: "DELETE" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setSeeded([]);
      setSeedSummary(null);
      setSelectedSeed(null);
      setPipelineResult(null);
    } catch (error) {
      setQueueError(error instanceof Error ? error.message : "Could not clear queue");
    }
  };

  const runPipeline = async () => {
    setPipelineRunning(true);
    setPipelineResult(null);
    const logs = visibleSeeded.slice(0, 40).map((item) => ({
      sourcePortal: item.sourcePortal ?? "Vinavi",
      sourceAction: item.sourceAction ?? "episode-closed",
      patientToken: item.patientId,
      aasandhaToken: item.aasandhaNo,
      episodeId: item.episodeId,
      facility: item.facility,
      diagnosis: item.diagnosis,
      priority: item.priority,
      stage: item.stage,
      operatorContext: manualNote,
    }));
    try {
      const response = await fetch("/api/ai/surveillance-feed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logs }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? `HTTP ${response.status}`);
      setPipelineResult(payload.analysis ?? payload);
    } catch (error) {
      setPipelineResult({ error: error instanceof Error ? error.message : "Pipeline failed" });
    } finally {
      setPipelineRunning(false);
    }
  };

  useEffect(() => {
    loadSeededQueue();
  }, []);

  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(loadSeededQueue, 4500);
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => setStep((current) => (current + 1) % 12), 1200);
    return () => clearInterval(id);
  }, [running]);

  return (
    <div className="space-y-4">
      <Panel className="p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3"><FlatCategoryIcon icon={Bot} tone="emerald" /><div><p className="text-lg font-black text-slate-950">Live Processing</p><p className="text-sm text-slate-500">Watch safe feeds from Vinavi and Aasandha move through AI review.</p></div></div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => seedConsultations(500)} disabled={seeding} className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-2 text-xs font-black text-white hover:bg-blue-500 disabled:opacity-60 cursor-pointer"><Database className="h-4 w-4" />{seeding ? "Seeding..." : "Seed 500 consultations"}</button>
            <button onClick={clearQueue} className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-600 hover:text-slate-950 cursor-pointer">Clear queue</button>
            <button onClick={() => setRunning(!running)} className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2 text-xs font-black text-white hover:bg-slate-800 cursor-pointer"><Play className="h-4 w-4" />{running ? "Pause" : "Start"}</button>
          </div>
        </div>
      </Panel>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-4">
        <Panel className="p-5">
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <div><p className="text-sm font-black text-slate-800">Processing queue</p><p className="text-xs text-slate-500">Only API-seeded feed items appear here. Static history is hidden.</p></div>
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={loadSeededQueue} className="inline-flex items-center gap-2 rounded-2xl border border-white/80 bg-white/80 px-3 py-2 text-[10px] font-black text-slate-600 hover:text-slate-950 cursor-pointer"><RefreshCw className="h-3.5 w-3.5" />Sync API</button>
              <div className="flex flex-wrap gap-1 rounded-2xl border border-white/80 bg-white/70 p-1">
                {(["24h", "seeded", "critical", "foreign"] as IntakeScope[]).map((item) => <button key={item} onClick={() => setScope(item)} className={`rounded-xl px-3 py-1.5 text-[10px] font-black uppercase cursor-pointer ${scope === item ? "bg-blue-600 text-white" : "text-slate-500 hover:text-slate-950"}`}>{item === "foreign" ? "source" : item}</button>)}
              </div>
            </div>
          </div>
          {queueError && <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-800">Seed queue API fallback active: {queueError}</div>}

          <div className="grid grid-cols-2 xl:grid-cols-4 gap-2 mb-4">
            {bots.map((bot, index) => {
              const Icon = bot.icon;
              const active = index === step % bots.length;
              return <motion.div key={bot.name} animate={{ y: active ? -2 : 0 }} transition={{ type: "spring", stiffness: 260, damping: 22 }} className={`rounded-2xl border p-3 transition-all ${active ? "bg-blue-50 border-blue-200 shadow-[0_12px_24px_rgba(37,99,235,0.12)]" : "bg-white/70 border-slate-100"}`}><div className="flex items-center gap-2"><Icon weight="duotone" className={`h-5 w-5 ${active ? "text-blue-600" : "text-slate-400"}`} /><span className="truncate text-[10px] font-black uppercase text-slate-400">{bot.model}</span></div><p className="mt-1 text-xs font-black text-slate-900">{bot.name}</p><p className="mt-0.5 text-[11px] leading-snug text-slate-500">{bot.task}</p></motion.div>;
            })}
          </div>

          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
            {visibleSeeded.length === 0 && <div className="rounded-3xl border border-dashed border-slate-200 bg-white/60 p-8 text-center"><p className="text-sm font-black text-slate-700">No fetched episodes are showing.</p><p className="mt-1 text-xs text-slate-500">Press Seed 500 consultations to simulate Vinavi and Aasandha sending safe feed events.</p></div>}
            {visibleSeeded.map((item, index) => <IntakeSeedRow key={item.id} item={item} done={item.status === "done" || index < step} onOpen={() => setSelectedSeed(item)} />)}
          </div>
        </Panel>

        <div className="space-y-4">
          <StatCard label="Queue size" value={queueSize.toLocaleString()} icon={ClipboardList} tone="blue" sub="Visible filtered workload" />
          <StatCard label="Done this cycle" value={completed.toLocaleString()} icon={ClipboardCheck} tone="emerald" sub="Marked after bot review" />
          <StatCard label="Seeded feed" value={(seedSummary?.totalQueued ?? seeded.length).toLocaleString()} icon={Database} tone="amber" sub="Vinavi + Aasandha test load" />
          <Panel className="p-4">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">Queue distribution</p>
            <div className="mt-3 grid gap-2">
              {(seedSummary?.agents ?? []).map((row) => <div key={row.agent} className="flex items-center justify-between rounded-xl bg-white/70 px-3 py-2 text-xs"><span className="font-black text-slate-600">{row.agent}</span><span className="font-mono font-black text-blue-700">{row.count}</span></div>)}
              {!seedSummary && <p className="text-xs text-slate-500">Seed from Vinavi to populate the API queue.</p>}
            </div>
          </Panel>
          <button onClick={() => onShowEncounters("all", undefined, "All surveillance episodes") } className="w-full rounded-2xl bg-slate-950 text-white px-4 py-4 text-sm font-black hover:bg-slate-800 cursor-pointer shadow-xl">Open patient episode log</button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Panel className="p-5">
          <div className="flex items-center gap-2 mb-3"><SlidersHorizontal className="h-4 w-4 text-blue-600" /><p className="text-sm font-black text-slate-800">Add context for this run</p></div>
          <textarea value={manualNote} onChange={(event) => setManualNote(event.target.value)} className="min-h-28 w-full resize-none rounded-3xl border border-slate-100 bg-white/80 px-4 py-3 text-sm leading-relaxed text-slate-700 outline-none focus:border-blue-200" />
          <button onClick={runPipeline} disabled={pipelineRunning || visibleSeeded.length === 0} className="mt-3 inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-2.5 text-xs font-black text-white hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"><Sparkles className="h-4 w-4" />{pipelineRunning ? "Running AI pipeline..." : "Run 3-stage AI review"}</button>
        </Panel>
        <Panel className="p-5">
          <div className="flex items-center gap-2 mb-3"><FlaskConical className="h-4 w-4 text-blue-600" /><p className="text-sm font-black text-slate-800">Final answer</p></div>
          {!pipelineResult && <p className="text-sm text-slate-500">Run the review to see the generated briefing. If the API key is not added yet, the system still shows the local privacy purge result.</p>}
          {pipelineResult?.error && <p className="rounded-2xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{pipelineResult.error}</p>}
          {pipelineResult?.purgeSummary && <div className="rounded-2xl bg-emerald-50 p-3 text-xs font-bold text-emerald-800">Privacy purge checked {pipelineResult.purgeSummary.recordCount} records. Removed {pipelineResult.purgeSummary.removedFieldCount} identity field(s) and scrubbed {pipelineResult.purgeSummary.scrubbedTextSpans} text span(s).</div>}
          {pipelineResult?.paused && <p className="mt-3 rounded-2xl bg-amber-50 p-3 text-xs font-bold text-amber-800">AI is paused until OPENROUTER_API_KEY is added to .env.local.</p>}
          {pipelineResult?.briefing && <div className="mt-3 space-y-2"><p className="text-sm font-black text-slate-900">{pipelineResult.briefing.briefing}</p><p className="text-xs font-bold uppercase text-blue-700">Priority: {pipelineResult.briefing.priorityLevel}</p>{pipelineResult.briefing.recommendedActions?.map((action) => <p key={action} className="rounded-xl bg-white/75 px-3 py-2 text-xs text-slate-600">{action}</p>)}</div>}
        </Panel>
      </div>
      {selectedSeed && <IntakeAssessmentOverlay item={selectedSeed} onClose={() => setSelectedSeed(null)} />}
    </div>
  );
}

function IntakeSeedRow({ item, done, onOpen }: { item: SeededConsultationLite; done: boolean; onOpen: () => void }) {
  return (
    <motion.button layout onClick={onOpen} className="w-full rounded-2xl border border-slate-100 bg-white/80 px-4 py-3 text-left shadow-[0_10px_24px_rgba(15,23,42,0.04)] transition-all hover:border-blue-200 hover:bg-white hover:shadow-[0_18px_34px_rgba(37,99,235,0.10)] cursor-pointer">
      <div className="flex items-center gap-3">
        <span className={`h-10 w-10 rounded-2xl flex items-center justify-center text-xs font-black ${done ? "bg-emerald-500 text-white" : item.priority === "urgent" ? "bg-rose-100 text-rose-700" : "bg-blue-100 text-blue-700"}`}>{done ? "OK" : "AI"}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black text-slate-800">{item.episodeId} · {item.diagnosis}</p>
          <p className="text-[11px] text-slate-500">{item.sourcePortal ?? "Vinavi"} · {item.patientId} · {item.facility} · {item.assignedAgent} · {item.stage.replace("-", " ")}</p>
        </div>
        <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${item.priority === "urgent" ? "bg-rose-50 text-rose-700" : item.priority === "watch" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500"}`}>{item.priority}</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-400" style={{ width: `${Math.min(100, Math.max(4, item.progress))}%` }} />
      </div>
      <div className="mt-3 grid gap-1">
        {item.interactions.slice(0, 3).map((interaction) => <p key={interaction} className="text-[11px] font-semibold text-slate-500">- {interaction}</p>)}
      </div>
    </motion.button>
  );
}

function IntakeAssessmentOverlay({ item, onClose }: { item: SeededConsultationLite; onClose: () => void }) {
  const trace = item.assessment?.length ? item.assessment : item.interactions;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 bg-blue-50/70 p-5">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-blue-700">Assessment trace</p>
            <h3 className="mt-1 text-xl font-black text-slate-950">{item.episodeId}</h3>
            <p className="mt-1 text-sm text-slate-500">{item.sourcePortal ?? "Vinavi"} feed · {item.facility} · {item.diagnosis}</p>
          </div>
          <button onClick={onClose} className="rounded-2xl p-2 text-slate-400 hover:bg-white hover:text-slate-700 cursor-pointer"><X className="h-5 w-5" /></button>
        </div>
        <div className="grid gap-3 p-5">
          {trace.map((line, index) => (
            <div key={`${line}-${index}`} className="flex gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-black text-white">{index + 1}</span>
              <p className="text-sm leading-relaxed text-slate-700">{line}</p>
            </div>
          ))}
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-800">
            <span className="font-black">Privacy note:</span> this screen shows an explainable assessment summary, not hidden chain-of-thought or patient identifiers.
          </div>
        </div>
      </div>
    </div>
  );
}

function LiveOpenRouterProbe() {
  type ProbeResult = {
    redacted?: Record<string, unknown>;
    audit?: { removedFields: string[]; sourceHash: string; redactedTextSpans: number };
    ensemble?: { diagnosis: string; confidence: number; severity: string; agreement: number; modelCount: number; flaggedForReview: boolean; votes: Array<{ model: string; diagnosis: string | null; confidence: number | null; latencyMs: number; error: string | null }> };
    error?: string;
  };
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ProbeResult | null>(null);

  const runProbe = async () => {
    setRunning(true);
    setResult(null);
    const encounter = encountersFor("all")[0];
    // Synthesize PHI-shaped fields onto the encounter so the redactor has something to strip.
    const raw = {
      ...encounter,
      name: "REDACT_ME Patient Name",
      nationalId: "A123456",
      dateOfBirth: "1988-03-12",
      phone: "+960 7771234",
      address: "Maa. Sample Villa, Male",
      clinicianNotes: `Mr. REDACT_ME Patient Name (DOB: 1988-03-12, phone +960 7771234) presented with ${encounter.symptoms.join(", ")}. Plan: ${encounter.prescriptionSignals.join("; ")}.`,
      nationality: encounter.origin === "foreign" ? "Foreign" : "Maldivian",
    };
    try {
      const response = await fetch("/api/ai/analyze-episode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ episode: raw }),
      });
      const payload = await response.json();
      setResult(payload);
    } catch (caught) {
      setResult({ error: caught instanceof Error ? caught.message : "Probe failed" });
    } finally {
      setRunning(false);
    }
  };

  return (
    <Panel className="p-4">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-emerald-600" /><p className="text-sm font-black text-slate-800">Live OpenRouter probe</p></div>
        <button onClick={runProbe} disabled={running} className="rounded-xl bg-emerald-600 px-3 py-1.5 text-[11px] font-black text-white hover:bg-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer">{running ? "Running…" : "Run on 1 episode"}</button>
      </div>
      <p className="text-[11px] text-slate-500 mb-2">Pulls one Vinavi episode, applies irreversible suppression plus local k-anonymity generalization, runs the three OpenRouter layers, and shows which fields were stripped.</p>
      {result?.error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-[11px] font-bold text-rose-700">{result.error}</p>}
      {result?.audit && (
        <div className="space-y-2 text-[11px]">
          <div className="rounded-xl bg-emerald-50 px-3 py-2 text-emerald-800">
            <p className="font-black">PHI stripped: {result.audit.removedFields.length} field(s), {result.audit.redactedTextSpans} free-text span(s)</p>
            <p className="text-emerald-700 font-mono break-all">audit hash {result.audit.sourceHash}</p>
            <p className="text-emerald-700">removed: {result.audit.removedFields.join(", ") || "—"}</p>
          </div>
          {result.ensemble && (
            <div className="rounded-xl bg-slate-50 px-3 py-2">
              <p className="font-black text-slate-900">Ensemble diagnosis: {result.ensemble.diagnosis}</p>
              <p className="text-slate-600">severity {result.ensemble.severity} · confidence {(result.ensemble.confidence * 100).toFixed(0)}% · agreement {(result.ensemble.agreement * 100).toFixed(0)}% · {result.ensemble.modelCount} models · {result.ensemble.flaggedForReview ? "manual review" : "auto-promote"}</p>
              <div className="mt-2 space-y-1">
                {result.ensemble.votes.map((vote) => (
                  <div key={vote.model} className="flex items-center justify-between gap-2">
                    <span className="font-mono text-slate-500 truncate">{vote.model.split("/").pop()}</span>
                    <span className={`font-black ${vote.error ? "text-rose-600" : "text-slate-800"}`}>{vote.error ? "err" : vote.diagnosis ?? "—"}</span>
                    <span className="text-slate-400">{vote.latencyMs}ms</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}

function LoggingView({ logs }: { logs: LogEntry[] }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total logs" value={logs.length} icon={ScrollText} tone="blue" />
        <StatCard label="Critical" value={logs.filter((log) => log.level === "critical").length} icon={AlertTriangle} tone="rose" />
        <StatCard label="Warnings" value={logs.filter((log) => log.level === "warning").length} icon={Activity} tone="amber" />
        <StatCard label="Info" value={logs.filter((log) => log.level === "info").length} icon={Database} tone="emerald" />
      </div>
      <Panel className="overflow-hidden">
        <div className="px-4 py-3 border-b border-white/70 flex items-center gap-2"><ScrollText className="h-4 w-4 text-slate-500" /><span className="text-sm font-black text-slate-800">System Event Log</span></div>
        <div className="divide-y divide-slate-100 max-h-[65vh] overflow-y-auto">
          {logs.map((log) => { const ts = new Date(log.timestamp); return (
            <div key={log.id} className="flex items-start gap-3 px-4 py-3 hover:bg-white/60">
              <span className={`shrink-0 text-[10px] font-black uppercase px-2 py-1 rounded-lg ${logLevelStyles[log.level]}`}>{log.level}</span>
              <div className="min-w-0 flex-1"><div className="flex items-center gap-2 text-[11px] text-slate-500"><span className="font-mono">{ts.getHours().toString().padStart(2, "0")}:{ts.getMinutes().toString().padStart(2, "0")}</span><span>-</span><span className="font-bold text-slate-600">{log.source}</span>{log.facility && <><span>-</span><span className="text-blue-600">{log.facility}</span></>}</div><p className="text-sm text-slate-700 mt-0.5">{log.message}</p></div>
            </div>
          ); })}
        </div>
      </Panel>
    </div>
  );
}

function ReportsView({ onOpen, analyticsFilters, aiPaused }: { onOpen: (report: ReportMeta) => void; analyticsFilters: AnalyticsFilterState; aiPaused: boolean }) {
  type GeneratedRun = {
    meta: ReportMeta;
    markdown: string;
    ensembleSummary: { sampled: number; averageAgreement: number; averageConfidence: number; flaggedForReview: number; totalRedactedFields: number };
    ensembleRuns: Array<{ episodeRef?: string; diagnosis?: string; confidence?: number; severity?: string; agreement?: number; flaggedForReview?: boolean; modelCount?: number; audit: { removedFields: string[]; sourceHash: string; redactedTextSpans: number } }>;
  };
  const [generated, setGenerated] = useState<GeneratedRun[]>([]);
  const [generating, setGenerating] = useState(false);
  const [template, setTemplate] = useState<"daily" | "weekly" | "outbreak" | "facility" | "foreign">("weekly");
  const [error, setError] = useState<string | null>(null);
  const [openMd, setOpenMd] = useState<GeneratedRun | null>(null);

  const modelChain = [
    { name: "Raw Ingestion Buffer", role: "deepseek/deepseek-v4-flash:free — parses messy 12-hour clinic sync payloads into a clean surveillance JSON array", icon: Stethoscope, tone: "emerald" as const },
    { name: "Analytical Synthesizer", role: "nvidia/nemotron-3-super-120b-a12b:free — cross-checks the normalized feed against expected baselines and flags outbreak spikes", icon: BrainCircuit, tone: "blue" as const },
    { name: "Strategic Briefing Engine", role: "openai/gpt-oss-120b:free — converts verified anomaly signals into a concise ministerial tactical brief", icon: Microscope, tone: "violet" as const },
    { name: "MV-AIHS Guard Rail", role: "destructive purge, negative prompting, regex privacy killswitch, and release control", icon: Bot, tone: "amber" as const },
  ];

  const handleGenerate = async () => {
    setError(null);
    setGenerating(true);
    try {
      const response = await fetch("/api/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template,
          diseaseCode: analyticsFilters.diagnosis,
          facilityId: analyticsFilters.facilities[0],
          sampleSize: 4,
        }),
      });
      if (!response.ok) throw new Error(`Generator returned HTTP ${response.status}`);
      const payload = await response.json() as GeneratedRun;
      setGenerated((prev) => [payload, ...prev].slice(0, 8));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const downloadMarkdown = (run: GeneratedRun) => {
    const blob = new Blob([run.markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${run.meta.id}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Library reports" value={REPORTS.length} icon={FileText} tone="blue" />
        <StatCard label="Live ensemble runs" value={generated.length} icon={Sparkles} tone="emerald" />
        <StatCard label="Pages on file" value={REPORTS.reduce((sum, report) => sum + report.pageCount, 0).toLocaleString()} icon={ClipboardList} tone="violet" />
        <StatCard label="Manual review (live)" value={generated.reduce((sum, run) => sum + (run.ensembleSummary?.flaggedForReview ?? 0), 0)} icon={ShieldAlert} tone="amber" />
      </div>

      <Panel className="p-5 modern-menu-shell">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-wider text-blue-700">Live generator</p>
            <h2 className="text-xl font-black tracking-tight text-slate-950">Generate a privacy-safe surveillance report</h2>
            <p className="text-xs text-slate-500 max-w-xl">Pulls live signal from {analyticsFilters.diagnosis === "all" ? "all 10 tracked diseases" : (DISEASE_BY_CODE[analyticsFilters.diagnosis as DiseaseCode]?.name ?? analyticsFilters.diagnosis)}{analyticsFilters.facilities[0] ? ` at ${FACILITIES.find((facility) => facility.id === analyticsFilters.facilities[0])?.shortName}` : ""}, redacts every patient through <code className="rounded bg-slate-100 px-1 py-0.5 text-[10px]">src/lib/redact.ts</code>, then sends only de-identified clinical text into the three-layer OpenRouter stack configured for MV-AIHS.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(["daily", "weekly", "outbreak", "facility", "foreign"] as const).map((option) => (
              <button key={option} onClick={() => setTemplate(option)} className={`rounded-2xl px-3 py-2 text-[11px] font-black capitalize transition-all cursor-pointer ${template === option ? "bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-[0_14px_28px_rgba(37,99,235,0.22)]" : "bg-white text-slate-600 border border-slate-200 hover:text-slate-900"}`}>{option}</button>
            ))}
            <button onClick={handleGenerate} disabled={generating || aiPaused} className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2.5 text-xs font-black text-white shadow-[0_14px_28px_rgba(16,185,129,0.26)] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer">
              {aiPaused ? <Lock className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}{aiPaused ? "AI paused" : generating ? "Generating…" : "Generate report"}
            </button>
          </div>
        </div>
        {error && <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">{error}</p>}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          {modelChain.map((model) => <div key={model.name} className="rounded-2xl border border-slate-100 bg-white/75 p-3"><IconTile icon={model.icon} tone={model.tone} compact /><p className="mt-2 text-sm font-black text-slate-900">{model.name}</p><p className="text-xs leading-relaxed text-slate-500">{model.role}</p></div>)}
        </div>
      </Panel>

      {generated.length > 0 && (
        <Panel className="p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div><p className="text-sm font-black text-slate-900">Live generated reports</p><p className="text-xs text-slate-500">Each report is built from a fresh ensemble run on de-identified episodes.</p></div>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase text-emerald-700">openrouter live</span>
          </div>
          <div className="space-y-2">
            {generated.map((run) => (
              <div key={run.meta.id} className="rounded-2xl border border-slate-100 bg-white/80 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-slate-950 truncate">{run.meta.title}</p>
                    <p className="text-[11px] text-slate-500 truncate">{run.meta.id} · sampled {run.ensembleSummary.sampled} · agreement {(run.ensembleSummary.averageAgreement * 100).toFixed(0)}% · confidence {(run.ensembleSummary.averageConfidence * 100).toFixed(0)}% · redacted {run.ensembleSummary.totalRedactedFields} field instances</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => setOpenMd(run)} className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-black text-slate-700 hover:text-slate-950 cursor-pointer">Preview</button>
                    <button onClick={() => downloadMarkdown(run)} className="rounded-xl bg-blue-600 px-3 py-1.5 text-[11px] font-black text-white hover:bg-blue-500 cursor-pointer">Download .md</button>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
                  {run.ensembleRuns.map((row) => (
                    <div key={row.episodeRef} className="rounded-xl bg-slate-50 px-3 py-2">
                      <p className="font-black text-slate-800 truncate">{row.diagnosis ?? "n/a"}</p>
                      <p className="text-slate-500">Ref {row.episodeRef} · {row.modelCount ?? 0} models · {(row.agreement ? row.agreement * 100 : 0).toFixed(0)}% agree</p>
                      <p className="text-slate-400 truncate">redacted {row.audit.removedFields.length} fields · hash {row.audit.sourceHash.slice(0, 8)}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      <Panel className="report-lagoon-panel overflow-hidden bg-white/54">
        <div className="relative z-10 px-4 py-3 border-b border-white/70 flex items-center justify-between gap-3 bg-white/38 backdrop-blur-xl">
          <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-blue-600" /><span className="text-sm font-black text-slate-800">Library reports</span></div>
          <div className="hidden md:flex items-center gap-2 rounded-2xl border border-white/80 bg-white/70 px-3 py-2 text-xs text-slate-500"><Search className="h-3.5 w-3.5" />Search</div>
        </div>
        <div className="relative z-10 p-3 space-y-2">
          {REPORTS.map((report) => (
            <button key={report.id} onClick={() => onOpen(report)} className="group report-glass-row w-full flex items-center justify-between gap-4 rounded-2xl border border-white/80 bg-white/70 px-4 py-4 shadow-[0_10px_26px_rgba(15,23,42,0.06)] hover:-translate-y-0.5 hover:bg-white/90 hover:shadow-[0_18px_42px_rgba(15,23,42,0.10)] transition-all duration-300 cursor-pointer text-left">
              <div className="flex min-w-0 items-center gap-4">
                <IconTile icon={FileText} tone={report.status === "Ready" ? "emerald" : report.status === "In Progress" ? "amber" : "slate"} compact imageUrl={APP_ICON.folder} />
                <div className="min-w-0"><p className="text-sm font-black text-slate-950 truncate">{report.title}</p><p className="text-[11px] text-slate-500 truncate">{report.id} - {report.type} - {report.author} - {report.date} - {report.pageCount} pages</p></div>
              </div>
              <span className={`shrink-0 text-[10px] font-black px-3 py-1.5 rounded-full shadow-inner ${report.status === "Ready" ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100" : report.status === "In Progress" ? "bg-amber-50 text-amber-700 ring-1 ring-amber-100" : "bg-slate-100 text-slate-500"}`}>{report.status}</span>
            </button>
          ))}
        </div>
      </Panel>

      {openMd && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 backdrop-blur-md p-4" onClick={() => setOpenMd(null)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[88vh] overflow-hidden flex flex-col" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-slate-100">
              <div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-wider text-blue-700">Markdown preview</p><h3 className="text-lg font-black text-slate-950 truncate">{openMd.meta.title}</h3></div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => downloadMarkdown(openMd)} className="rounded-xl bg-blue-600 px-3 py-1.5 text-[11px] font-black text-white hover:bg-blue-500 cursor-pointer">Download .md</button>
                <button onClick={() => setOpenMd(null)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 cursor-pointer"><X className="h-5 w-5" /></button>
              </div>
            </div>
            <pre className="px-6 py-4 overflow-auto text-[12px] leading-relaxed whitespace-pre-wrap text-slate-800 font-mono">{openMd.markdown}</pre>
          </div>
        </div>
      )}
    </div>
  );
}
