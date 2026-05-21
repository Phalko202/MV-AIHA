"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  Activity, AlertTriangle, BarChart3, Bot, BrainCircuit, Building2, ChevronRight, ClipboardCheck, ClipboardList,
  Database, FileCheck, FileText, FlaskConical, Globe, Image, LayoutDashboard,
  Map, Microscope, Network, Play, RefreshCw, ScrollText, Search, ShieldAlert, SlidersHorizontal, Sparkles, Stethoscope,
  UploadCloud, UserRound, Users, UsersRound, X,
  Thermometer, Bug, GlassWater, Flame, Brain, HeartPulse, Droplet, Dna,
} from "lucide-react";

import {
  DISEASES, DISEASE_BY_CODE, FACILITIES, IMPORTED_FOREIGN_ROWS, OUTBREAK_CLUSTERS,
  PATIENTS, REPORTS, encountersFor, fetchDashboardSummary, foreignEncounters,
  generateIncident, generateSystemLogs, originSummary,
  type DashboardSummary, type DiseaseCode, type FacilityStatus, type IncidentEvent,
  type LogEntry, type PatientEncounter, type ReportMeta,
} from "@/lib/surveillance-api";

const SurveillanceMap = dynamic(() => import("@/components/surveillance/SurveillanceMap"), { ssr: false });
const AnalyticsCharts = dynamic(() => import("@/components/surveillance/AnalyticsCharts"), { ssr: false });
const EncounterLog = dynamic(() => import("@/components/surveillance/EncounterLog"), { ssr: false });
const ReportViewer = dynamic(() => import("@/components/surveillance/ReportViewer"), { ssr: false });

type SidebarView = "dashboard" | "map" | "analytics" | "outbreaks" | "patients" | "foreignAudit" | "fetching" | "logging" | "reports";
type IntakeScope = "24h" | "seeded" | "critical" | "foreign";

interface NavItem { id: SidebarView; label: string; icon: React.ComponentType<{ className?: string }>; iconUrl: string }

const NAV_ITEMS: NavItem[] = [
  { id: "dashboard", label: "Command Dashboard", icon: LayoutDashboard, iconUrl: "/icons/3d/computer.png" },
  { id: "map", label: "Maldives Disease Map", icon: Map, iconUrl: "/icons/3d/map-pin.png" },
  { id: "analytics", label: "Interactive Analytics", icon: BarChart3, iconUrl: "/icons/3d/chart.png" },
  { id: "outbreaks", label: "Disease Signals", icon: AlertTriangle, iconUrl: "/icons/3d/target.png" },
  { id: "patients", label: "Patient Cohorts", icon: Users, iconUrl: "/icons/3d/boy.png" },
  { id: "foreignAudit", label: "External Patient Intelligence", icon: FileCheck, iconUrl: "/icons/3d/file-text.png" },
  { id: "fetching", label: "Live Surveillance Intake", icon: Database, iconUrl: "/icons/3d/wifi.png" },
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
  filter?: Partial<PatientEncounter>;
  label?: string;
}

function formatMvtTime() {
  const date = new Date();
  return `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}:${date.getSeconds().toString().padStart(2, "0")}`;
}

export default function SurveillancePortal() {
  const [view, setView] = useState<SidebarView>("dashboard");
  const [summary] = useState<DashboardSummary | null>(() => fetchDashboardSummary());
  const [incidents, setIncidents] = useState<IncidentEvent[]>(() => Array.from({ length: 14 }, () => generateIncident()));
  const [logs] = useState<LogEntry[]>(() => generateSystemLogs());
  const [currentTime, setCurrentTime] = useState("--:--:--");
  const [selectedFacility, setSelectedFacility] = useState<FacilityStatus | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [encounterLog, setEncounterLog] = useState<EncounterLogRequest | null>(null);
  const [selectedReport, setSelectedReport] = useState<ReportMeta | null>(null);
  const [analyticsDisease, setAnalyticsDisease] = useState<DiseaseCode | "all">("all");

  useEffect(() => {
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
    return encountersFor(view === "analytics" ? analyticsDisease : "all");
  }, [view, analyticsDisease]);

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

  const showEncounters = (disease: DiseaseCode | "all", filter?: Partial<PatientEncounter>, label?: string) => {
    setEncounterLog({ disease, filter, label });
  };

  return (
    <div className="portal-network-bg h-screen w-screen overflow-hidden text-slate-900 flex relative bg-[#eef4fb]">
      <div className="pointer-events-none absolute inset-0 opacity-45" style={{ background: "radial-gradient(circle at 12% 8%, rgba(37,99,235,0.24), transparent 26%), radial-gradient(circle at 90% 12%, rgba(20,184,166,0.2), transparent 25%), radial-gradient(circle at 55% 105%, rgba(244,63,94,0.1), transparent 36%), linear-gradient(135deg, rgba(248,251,255,0.72) 0%, rgba(234,241,249,0.58) 40%, rgba(247,250,247,0.66) 100%)" }} />
      <div className="pointer-events-none absolute inset-0 opacity-[0.24]" style={{ backgroundImage: "linear-gradient(rgba(15,23,42,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.05) 1px, transparent 1px)", backgroundSize: "38px 38px" }} />
      <div className="pointer-events-none absolute left-[250px] top-5 h-28 w-[520px] rounded-full bg-white/55 blur-3xl" />

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
            {!sidebarCollapsed && <span suppressHydrationWarning className="text-[10px] text-cyan-100/70 font-mono">{currentTime} MVT</span>}
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
              disease={analyticsDisease}
              setDisease={setAnalyticsDisease}
            />
          )}
          {view === "outbreaks" && <OutbreaksView onShowEncounters={showEncounters} />}
          {view === "patients" && <PatientSummaryView onShowEncounters={showEncounters} />}
          {view === "foreignAudit" && <ForeignAuditView onShowEncounters={showEncounters} />}
          {view === "fetching" && <LiveFetchingView onShowEncounters={showEncounters} />}
          {view === "logging" && <LoggingView logs={logs} />}
          {view === "reports" && <ReportsView onOpen={setSelectedReport} />}
        </main>
      </div>

      {selectedFacility && <FacilityOverlay facility={selectedFacility} onClose={() => setSelectedFacility(null)} onShowEncounters={showEncounters} />}
      {encounterLog && <EncounterLog disease={encounterLog.disease} filter={encounterLog.filter} label={encounterLog.label} onClose={() => setEncounterLog(null)} />}
      {selectedReport && <ReportViewer meta={selectedReport} onClose={() => setSelectedReport(null)} />}
    </div>
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

function LogoMedallion({ className = "h-10 w-10" }: { className?: string }) {
  return <span aria-hidden="true" className={`mv-logo-medallion ${className}`} />;
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
  const tones: Record<string, "blue" | "emerald" | "amber" | "rose"> = { LF: "rose", LM: "blue", FF: "amber", FM: "emerald" };
  return (
    <Panel className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-black text-slate-800">Local vs Foreign Patient Comparison</p>
          <p className="text-xs text-slate-500">Differentiated by origin and gender for disease classification</p>
        </div>
        <Sparkles className="h-4 w-4 text-blue-500" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {rows.map((row) => (
          <button key={row.group} onClick={() => onShowEncounters(disease, { origin: row.origin as PatientEncounter["origin"], gender: row.gender as PatientEncounter["gender"] }, `${row.group} - ${disease === "all" ? "all diseases" : DISEASE_BY_CODE[disease].name}`)} className="text-left rounded-2xl border border-slate-100 bg-white/80 p-3 hover:shadow-lg transition-all cursor-pointer">
            <div className="flex items-center gap-3 mb-3">
              <IconTile icon={row.origin === "foreign" ? UsersRound : UserRound} tone={tones[row.icon]} compact />
              <div>
                <p className="text-sm font-black text-slate-800">{row.group}</p>
                <p className="text-[11px] text-slate-500">{row.origin} - {row.gender === "F" ? "female" : "male"}</p>
              </div>
            </div>
            <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400" style={{ width: `${Math.max(7, (row.count / max) * 100)}%` }} />
            </div>
            <p className="mt-2 text-xl font-black font-mono text-slate-950">{row.count.toLocaleString()}</p>
          </button>
        ))}
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
                <LogoMedallion className="h-7 w-7" /> AI disease surveillance engine
              </div>
              <h2 className="max-w-2xl text-3xl font-black tracking-tight">Maldives disease signals, external-patient intelligence, and facility-level classification in one command surface.</h2>
              <p className="mt-3 max-w-xl text-sm text-blue-100/80">Markers are triggered by same-disease daily case thresholds, not beds or ventilators. More than 10 same-day cases becomes moderate; more than 20 becomes critical.</p>
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
    ili: Thermometer,
    dengue: Bug,
    gastro: GlassWater,
    febrile_seizure: Brain,
    chest_pain: HeartPulse,
    dehydration: Droplet,
    influenza: Dna,
    pneumonia: ShieldAlert,
    diarrhea: Flame,
    hfmd: Sparkles,
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
        <select value={filterDisease} onChange={(event) => setFilterDisease(event.target.value as DiseaseCode | "all")} className="text-sm bg-white/80 border border-slate-200 rounded-xl px-3 py-2 font-semibold text-slate-700 cursor-pointer focus:outline-none focus:border-blue-400">
          <option value="all">All diseases</option>
          {DISEASES.map((disease) => <option key={disease.code} value={disease.code}>{disease.name} ({disease.icd10})</option>)}
        </select>
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
                  <IconTile icon={IconComponent} tone={tone} compact />
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

function ForeignAuditView({ onShowEncounters }: { onShowEncounters: (d: DiseaseCode | "all", filter?: Partial<PatientEncounter>, label?: string) => void }) {
  const foreignList = foreignEncounters();
  const dengueForeign = foreignList.filter((item) => item.diseaseCode === "dengue");
  const sourceRows = ["registry_feed", "prescription_image", "ehr", "manual_review"].map((source) => ({
    source,
    count: source === "registry_feed"
      ? foreignList.filter((item) => item.source === "facility_registry").length
      : foreignList.filter((item) => item.source === source).length,
  }));
  const sourceLabel = (source: string) => ({
    registry_feed: "Clinic registry",
    prescription_image: "Prescription image",
    ehr: "EHR feed",
    manual_review: "Manual review",
  }[source] ?? source.replace("_", " "));
  return (
    <div className="space-y-4">
      <Panel className="p-5 bg-gradient-to-br from-white/85 to-blue-50/80">
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-5 items-center">
          <div>
            <div className="flex items-center gap-2 mb-2"><IconTile icon={FileCheck} tone="emerald" /><div><p className="text-lg font-black text-slate-950">External Patient Intelligence</p><p className="text-xs text-slate-500">Secure facility intake and prescription-image review for non-local disease signals</p></div></div>
            <p className="text-sm text-slate-600 max-w-3xl">The audit separates local IDs from passport, hospital-number, unknown foreign, and mixed-format identifiers. The AI uses diagnosis text, symptom evidence, facility context, and prescription clues to classify disease without storing patient names in reports.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <MiniStat label="Foreign episodes" value={foreignList.length.toLocaleString()} tone="amber" />
            <MiniStat label="Foreign dengue" value={dengueForeign.length.toLocaleString()} tone="rose" />
          </div>
        </div>
      </Panel>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <UploadCard icon={FileCheck} title="Secure registry intake" sub="Facility line-list connector" />
        <UploadCard icon={Database} title="Connect clinical source" sub="EHR or approved API feed" />
        <UploadCard icon={Image} title="Review prescription image" sub="OCR-assisted medication clues" />
      </div>

      <OriginComparison disease="dengue" onShowEncounters={onShowEncounters} />

      <Panel className="overflow-hidden">
        <div className="px-4 py-3 border-b border-white/70 flex items-center gap-2"><FileCheck className="h-4 w-4 text-blue-600" /><span className="text-sm font-black text-slate-800">Imported row classification preview</span></div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-white/50 text-left text-[10px] uppercase tracking-wide text-slate-500 font-black"><tr><th className="px-4 py-3">Source channel</th><th className="px-4 py-3">Identifier pattern</th><th className="px-4 py-3">Age/Sex</th><th className="px-4 py-3">Clinical text</th><th className="px-4 py-3">AI disease</th><th className="px-4 py-3">Prescription signal</th><th className="px-4 py-3">Action</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {IMPORTED_FOREIGN_ROWS.map((row) => (
                <tr key={row.row} className="hover:bg-white/60">
                  <td className="px-4 py-3 font-bold text-slate-700">{sourceLabel(row.source)}</td>
                  <td className="px-4 py-3 font-mono text-slate-600">{row.identifierSample}<br /><span className="text-[10px] text-slate-400">{row.identifierKind}</span></td>
                  <td className="px-4 py-3 text-slate-700">{row.age} / {row.gender}</td>
                  <td className="px-4 py-3 text-slate-600 max-w-xs">{row.diagnosisText}</td>
                  <td className="px-4 py-3"><span className="px-2 py-1 rounded-lg bg-red-50 text-red-700 font-black">{DISEASE_BY_CODE[row.diseaseCode].name}</span><br /><span className="text-[10px] text-slate-400">conf. {row.aiConfidence.toFixed(2)}</span></td>
                  <td className="px-4 py-3 text-slate-600 max-w-xs">{row.prescriptionText}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-1 rounded-lg font-black ${row.action === "auto-classified" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{row.action}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel className="p-4">
        <p className="text-sm font-black text-slate-800 mb-3">Source mix</p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {sourceRows.map((row) => <MiniStat key={row.source} label={sourceLabel(row.source)} value={row.count.toLocaleString()} tone={row.source === "prescription_image" ? "rose" : row.source === "registry_feed" ? "emerald" : "blue"} />)}
        </div>
      </Panel>
    </div>
  );
}

function UploadCard({ icon, title, sub }: { icon: React.ComponentType<{ className?: string }>; title: string; sub: string }) {
  return (
    <Panel className="p-4 hover:-translate-y-0.5 transition-transform duration-300">
      <div className="flex items-center gap-3 mb-3"><IconTile icon={icon} tone="blue" /><div><p className="text-sm font-black text-slate-800">{title}</p><p className="text-xs text-slate-500">{sub}</p></div></div>
      <label className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-blue-200 bg-blue-50/60 px-4 py-6 text-xs font-black text-blue-700 cursor-pointer hover:bg-blue-50">
        <UploadCloud className="h-4 w-4" /> Choose file or connect source
        <input type="file" className="hidden" accept=".csv,.xlsx,.xls,image/*" />
      </label>
    </Panel>
  );
}

interface SeededConsultationLite {
  id: string;
  patientId: string;
  episodeId: string;
  diagnosis: string;
  facility: string;
  createdAt: string;
  status: "queued" | "reading" | "done";
}

function LiveFetchingView({ onShowEncounters }: { onShowEncounters: (d: DiseaseCode | "all", filter?: Partial<PatientEncounter>, label?: string) => void }) {
  const [running, setRunning] = useState(true);
  const [step, setStep] = useState(0);
  const [scope, setScope] = useState<IntakeScope>("24h");
  const [manualNote, setManualNote] = useState("possible workplace dengue exposure; review foreign-worker cluster logic before public alert");
  const [seeded, setSeeded] = useState<SeededConsultationLite[]>([]);

  const bots = useMemo(() => [
    { name: "MedGemma clinical reader", icon: Stethoscope, task: "reads symptoms, vitals, prescriptions, and clinician notes", model: "medgemma-local" },
    { name: "DeepSeek reasoning agent", icon: BrainCircuit, task: "checks inconsistencies, travel context, and manual judgement", model: "deepseek-r1" },
    { name: "Epi research synthesizer", icon: Microscope, task: "matches guidance, citations, thresholds, and report evidence", model: "epidemiology-rag" },
    { name: "MV-AIHA orchestrator", icon: Network, task: "batches high-load consultations without blocking the queue", model: "router" },
  ], []);

  const baseQueue = useMemo(() => encountersFor("all").slice(0, 18), []);
  const filteredBaseQueue = baseQueue.filter((encounter) => {
    if (scope === "critical") return encounter.severity === "critical" || encounter.severity === "severe";
    if (scope === "foreign") return encounter.origin === "foreign";
    if (scope === "seeded") return false;
    return encounter.onsetDate >= "2026-05-14";
  });
  const visibleSeeded = scope === "seeded" || scope === "24h" ? seeded.slice(0, 12) : [];
  const queueSize = filteredBaseQueue.length + visibleSeeded.length;
  const completed = Math.min(queueSize, step + Math.floor(queueSize * 0.38));

  useEffect(() => {
    fetch("/api/seed-consultations")
      .then((response) => response.ok ? response.json() : { consultations: [] })
      .then((payload) => setSeeded((payload.consultations ?? []) as SeededConsultationLite[]))
      .catch(() => setSeeded([]));
  }, []);

  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => setStep((current) => (current + 1) % 12), 1200);
    return () => clearInterval(id);
  }, [running]);

  return (
    <div className="space-y-4">
      <Panel className="p-5 bg-gradient-to-br from-slate-950 to-blue-950 text-white overflow-hidden relative">
        <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "radial-gradient(circle at 15% 25%, rgba(56,189,248,0.6), transparent 24%), radial-gradient(circle at 90% 0%, rgba(16,185,129,0.42), transparent 28%)" }} />
        <div className="relative z-10 flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3"><IconTile icon={Bot} tone="emerald" /><div><p className="text-xl font-black">Live Surveillance Intake</p><p className="text-sm text-blue-100/75 max-w-3xl">Shows every 24-hour episode batch, seeded Vinavi consultations, bot interactions, manual judgement, and research synthesis before signals are promoted.</p></div></div>
          <button onClick={() => setRunning(!running)} className="inline-flex items-center gap-2 rounded-xl bg-white text-slate-950 px-4 py-2 text-xs font-black cursor-pointer hover:bg-blue-50"><Play className="h-4 w-4" />{running ? "Pause bot queue" : "Start bot queue"}</button>
        </div>
      </Panel>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-4">
        <Panel className="p-5">
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <div><p className="text-sm font-black text-slate-800">Agentic episode processing</p><p className="text-xs text-slate-500">Batching 100s of consultations per hour through staged AI readers</p></div>
            <div className="flex flex-wrap gap-1 rounded-2xl border border-white/80 bg-white/70 p-1">
              {(["24h", "seeded", "critical", "foreign"] as IntakeScope[]).map((item) => <button key={item} onClick={() => setScope(item)} className={`rounded-xl px-3 py-1.5 text-[10px] font-black uppercase cursor-pointer ${scope === item ? "bg-blue-600 text-white" : "text-slate-500 hover:text-slate-950"}`}>{item}</button>)}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 mb-4">
            {bots.map((bot, index) => {
              const Icon = bot.icon;
              const active = index === step % bots.length;
              return <div key={bot.name} className={`rounded-3xl border p-4 transition-all ${active ? "bg-blue-50 border-blue-200 shadow-[0_18px_38px_rgba(37,99,235,0.14)]" : "bg-white/70 border-slate-100"}`}><div className="flex items-center gap-2"><Icon className={`h-5 w-5 ${active ? "text-blue-600" : "text-slate-400"}`} /><span className="text-[10px] font-black uppercase text-slate-400">{bot.model}</span></div><p className="mt-2 text-sm font-black text-slate-900">{bot.name}</p><p className="mt-1 text-xs leading-relaxed text-slate-500">{bot.task}</p></div>;
            })}
          </div>

          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
            {visibleSeeded.map((item, index) => <IntakeSeedRow key={item.id} item={item} done={item.status === "done" || index < step} />)}
            {filteredBaseQueue.map((encounter, index) => <IntakeEpisodeRow key={encounter.id} encounter={encounter} index={index} done={index < completed} />)}
          </div>
        </Panel>

        <div className="space-y-4">
          <StatCard label="Queue size" value={queueSize.toLocaleString()} icon={ClipboardList} tone="blue" sub="Visible filtered workload" />
          <StatCard label="Done this cycle" value={completed.toLocaleString()} icon={ClipboardCheck} tone="emerald" sub="Marked after bot review" />
          <StatCard label="Seeded from Vinavi" value={seeded.length.toLocaleString()} icon={Database} tone="amber" sub="API-backed consultation load" />
          <button onClick={() => onShowEncounters("all", undefined, "Fetched surveillance episodes - all sources")} className="w-full rounded-2xl bg-slate-950 text-white px-4 py-4 text-sm font-black hover:bg-slate-800 cursor-pointer shadow-xl">Open fetched encounter log</button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Panel className="p-5">
          <div className="flex items-center gap-2 mb-3"><SlidersHorizontal className="h-4 w-4 text-blue-600" /><p className="text-sm font-black text-slate-800">Manual judgement loop</p></div>
          <textarea value={manualNote} onChange={(event) => setManualNote(event.target.value)} className="min-h-28 w-full resize-none rounded-3xl border border-slate-100 bg-white/80 px-4 py-3 text-sm leading-relaxed text-slate-700 outline-none focus:border-blue-200" />
          <div className="mt-3 rounded-3xl border border-blue-100 bg-blue-50/70 p-4 text-sm leading-relaxed text-slate-700"><span className="font-black text-blue-700">DeepSeek + MedGemma response:</span> judgement accepted as contextual evidence. The orchestrator will down-rank automatic public alerting until facility exposure, travel, and prescription evidence agree.</div>
        </Panel>
        <Panel className="p-5">
          <div className="flex items-center gap-2 mb-3"><FlaskConical className="h-4 w-4 text-blue-600" /><p className="text-sm font-black text-slate-800">Research synthesis</p></div>
          <div className="grid gap-3">
            {["WHO outbreak thresholds", "Maldives notifiable disease guidance", "Facility prescription evidence", "Foreign-worker cluster literature"].map((item, index) => <div key={item} className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white/75 px-4 py-3"><span className="text-sm font-bold text-slate-700">{item}</span><span className={`rounded-full px-2 py-1 text-[10px] font-black ${index < 3 ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"}`}>{index < 3 ? "linked" : "queued"}</span></div>)}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function IntakeSeedRow({ item, done }: { item: SeededConsultationLite; done: boolean }) {
  return <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white/75 px-4 py-3"><span className={`h-9 w-9 rounded-2xl flex items-center justify-center text-xs font-black ${done ? "bg-emerald-500 text-white" : "bg-blue-100 text-blue-700"}`}>{done ? "OK" : "AI"}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-black text-slate-800">{item.episodeId} · {item.diagnosis}</p><p className="text-[11px] text-slate-500">{item.patientId} · {item.facility} · {new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p></div><span className="text-[10px] font-black uppercase text-slate-400">{item.status}</span></div>;
}

function IntakeEpisodeRow({ encounter, index, done }: { encounter: PatientEncounter; index: number; done: boolean }) {
  const bot = ["MedGemma", "DeepSeek", "Research", "Router"][index % 4];
  return <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white/75 px-4 py-3"><span className={`h-9 w-9 rounded-2xl flex items-center justify-center text-xs font-black ${done ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-500"}`}>{done ? "OK" : index + 1}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-black text-slate-800">{encounter.episodeId} · {DISEASE_BY_CODE[encounter.diseaseCode].name}</p><p className="text-[11px] text-slate-500">{bot} reading {encounter.source.replace("_", " ")} · {encounter.origin} · {encounter.onsetDate}</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-black ${done ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{done ? "done" : "reading"}</span></div>;
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

function ReportsView({ onOpen }: { onOpen: (report: ReportMeta) => void }) {
  const modelChain = [
    { name: "MedGemma", role: "clinical extraction", icon: Stethoscope, tone: "emerald" as const },
    { name: "DeepSeek", role: "reasoning and contradiction checks", icon: BrainCircuit, tone: "blue" as const },
    { name: "Research RAG", role: "WHO/MOH evidence and citations", icon: Microscope, tone: "violet" as const },
    { name: "MV-AIHA Router", role: "final synthesis, risk language, privacy guard", icon: Bot, tone: "amber" as const },
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Reports" value={REPORTS.length} icon={FileText} tone="blue" />
        <StatCard label="Ready" value={REPORTS.filter((report) => report.status === "Ready").length} icon={FileCheck} tone="emerald" />
        <StatCard label="Pages" value={REPORTS.reduce((sum, report) => sum + report.pageCount, 0).toLocaleString()} icon={ClipboardList} tone="violet" />
        <StatCard label="Facility-specific" value="13" icon={Building2} tone="amber" />
      </div>
      <Panel className="p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div><p className="text-sm font-black text-slate-800">Agentic report factory</p><p className="text-xs text-slate-500">Reports combine clinical model reading, reasoning, research retrieval, and privacy-safe final drafting.</p></div>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-[10px] font-black uppercase text-blue-700">broad synthesis</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {modelChain.map((model) => <div key={model.name} className="rounded-2xl border border-slate-100 bg-white/75 p-3"><IconTile icon={model.icon} tone={model.tone} compact /><p className="mt-2 text-sm font-black text-slate-900">{model.name}</p><p className="text-xs leading-relaxed text-slate-500">{model.role}</p></div>)}
        </div>
      </Panel>
      <Panel className="report-lagoon-panel overflow-hidden bg-white/54">
        <div className="relative z-10 px-4 py-3 border-b border-white/70 flex items-center justify-between gap-3 bg-white/38 backdrop-blur-xl">
          <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-blue-600" /><span className="text-sm font-black text-slate-800">AI-assisted reports</span></div>
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
    </div>
  );
}
