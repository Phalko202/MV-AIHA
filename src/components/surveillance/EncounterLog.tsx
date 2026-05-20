"use client";

import { useMemo, useState } from "react";
import { X, Download, Filter, FileText } from "lucide-react";
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
  recovered: "text-emerald-600",
  active: "text-blue-600",
  referred: "text-amber-600",
  deceased: "text-red-700",
};

interface Props {
  disease: DiseaseCode | "all";
  filter?: Partial<PatientEncounter>;
  label?: string;
  onClose: () => void;
}

const PAGE = 20;

export default function EncounterLog({ disease, filter, label, onClose }: Props) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const all = useMemo(() => {
    let list = encountersFor(disease);
    if (filter) {
      list = list.filter((e) =>
        Object.entries(filter).every(([k, v]) => v === undefined || (e as unknown as Record<string, unknown>)[k] === v)
      );
    }
    return list;
  }, [disease, filter]);

  const filtered = useMemo(() => {
    if (!search.trim()) return all;
    const q = search.toLowerCase();
    return all.filter((e) =>
      e.id.toLowerCase().includes(q) ||
      e.patientKey.toLowerCase().includes(q) ||
      e.episodeId.toLowerCase().includes(q) ||
      e.origin.toLowerCase().includes(q) ||
      e.nationalityGroup.toLowerCase().includes(q) ||
      e.identifierKind.toLowerCase().includes(q) ||
      e.atoll.toLowerCase().includes(q) ||
      e.facilityId.toLowerCase().includes(q) ||
      e.ageBracket.includes(q) ||
      e.severity.includes(q) ||
      e.outcome.includes(q) ||
      e.symptoms.join(" ").toLowerCase().includes(q) ||
      e.prescriptionSignals.join(" ").toLowerCase().includes(q)
    );
  }, [all, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const slice = filtered.slice((page - 1) * PAGE, page * PAGE);

  const facById = (id: string) => FACILITIES.find((f) => f.id === id)?.shortName ?? id;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <FileText className="h-4 w-4 text-blue-600" />
              <span className="text-[10px] uppercase font-bold tracking-wider text-blue-600">Patient Encounter Log</span>
            </div>
            <h2 className="text-lg font-bold text-slate-900">{label ?? (disease === "all" ? "All encounters" : DISEASE_BY_CODE[disease].name)}</h2>
            <p className="text-xs text-slate-500">
              {filtered.length} de-identified encounter{filtered.length === 1 ? "" : "s"} · No PII shown
              {disease !== "all" && ` · ICD-10 ${DISEASE_BY_CODE[disease].icd10}`}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search bar */}
        <div className="flex items-center gap-3 px-6 py-3 border-b border-slate-100 bg-slate-50/50">
          <div className="flex-1 flex items-center gap-2 bg-white rounded-lg border border-slate-200 px-3 py-2">
            <Filter className="h-3.5 w-3.5 text-slate-400" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Filter by ID, origin, foreign/local, symptoms, prescription, facility, severity..."
              className="flex-1 text-sm bg-transparent outline-none placeholder:text-slate-400"
            />
          </div>
          <button className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg px-3 py-2 cursor-pointer">
            <Download className="h-3.5 w-3.5" /> Export CSV
          </button>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 sticky top-0">
              <tr className="text-left text-[10px] font-bold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2.5">Patient / Episode</th>
                <th className="px-4 py-2.5">Age</th>
                <th className="px-4 py-2.5">Sex</th>
                <th className="px-4 py-2.5">Origin</th>
                <th className="px-4 py-2.5">Atoll</th>
                <th className="px-4 py-2.5">Facility</th>
                <th className="px-4 py-2.5">Symptoms</th>
                <th className="px-4 py-2.5">Prescription signal</th>
                <th className="px-4 py-2.5">Severity</th>
                <th className="px-4 py-2.5">Outcome</th>
                <th className="px-4 py-2.5">AI conf.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {slice.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-2 font-mono text-slate-700">{e.patientKey}<br /><span className="text-[10px] text-slate-400">{e.episodeId}</span></td>
                  <td className="px-4 py-2 text-slate-700">{e.ageBracket}</td>
                  <td className="px-4 py-2 text-slate-700">{e.gender}</td>
                  <td className="px-4 py-2 text-slate-700 capitalize">{e.origin}<br /><span className="text-[10px] text-slate-400">{e.identifierKind}</span></td>
                  <td className="px-4 py-2 text-slate-700">{e.atoll}</td>
                  <td className="px-4 py-2 text-slate-700">{facById(e.facilityId)}</td>
                  <td className="px-4 py-2 text-slate-500 max-w-[180px]">{e.symptoms.join(", ")}</td>
                  <td className="px-4 py-2 text-slate-500 max-w-[180px]">{e.prescriptionSignals.join(", ")}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${severityColor[e.severity]}`}>
                      {e.severity}
                    </span>
                  </td>
                  <td className={`px-4 py-2 font-semibold capitalize ${outcomeColor[e.outcome]}`}>{e.outcome}</td>
                  <td className="px-4 py-2 font-mono text-slate-500">{e.aiConfidence.toFixed(2)}</td>
                </tr>
              ))}
              {slice.length === 0 && (
                <tr><td colSpan={12} className="px-4 py-10 text-center text-slate-400">No encounters match this filter.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-100 bg-slate-50/50">
          <span className="text-xs text-slate-500">
            Page {page} of {totalPages} · {filtered.length} total · AI confidence shown (audit threshold ≥ 0.75)
          </span>
          <div className="flex items-center gap-2">
            <button disabled={page === 1} onClick={() => setPage(page - 1)} className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white cursor-pointer">Previous</button>
            <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white cursor-pointer">Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}
