"use client";

import { X, Download, BookOpen, Sparkles, FileText, ListChecks, FlaskConical } from "lucide-react";
import { reportDetail, DISEASE_BY_CODE, type ReportMeta } from "@/lib/surveillance-api";

export default function ReportViewer({ meta, onClose }: { meta: ReportMeta; onClose: () => void }) {
  const detail = reportDetail(meta.id);
  if (!detail) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 backdrop-blur-md p-4" onClick={onClose}>
      <div className="w-full max-w-5xl max-h-[92vh] overflow-hidden rounded-[34px] border border-white/80 bg-white/92 shadow-[0_40px_120px_rgba(15,23,42,0.34)] backdrop-blur-xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="relative flex items-start justify-between gap-4 overflow-hidden border-b border-white/80 bg-gradient-to-br from-white via-blue-50/80 to-cyan-50/70 px-6 py-5 shrink-0">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_0%,rgba(37,99,235,0.18),transparent_28%),radial-gradient(circle_at_94%_24%,rgba(20,184,166,0.16),transparent_30%)]" />
          <div>
            <div className="relative flex items-center gap-2 mb-1">
              <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-[0_14px_28px_rgba(37,99,235,0.25)]"><BookOpen className="h-4 w-4" /></span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">{detail.type}</span>
              <span className="text-[10px] font-mono text-slate-400">{detail.id}</span>
            </div>
            <h2 className="relative text-xl font-black tracking-tight text-slate-950">{detail.title}</h2>
            <p className="relative text-xs text-slate-500 mt-0.5">
              {detail.author} · {detail.date} · {detail.pageCount} pages
              {detail.diseaseCode && detail.diseaseCode !== "all" && (
                <span> · ICD-10 {DISEASE_BY_CODE[detail.diseaseCode].icd10}</span>
              )}
            </p>
          </div>
          <div className="relative flex items-center gap-2 shrink-0">
            <button className="flex items-center gap-1.5 rounded-2xl border border-white/80 bg-white/82 px-3 py-2 text-xs font-black text-slate-700 shadow-sm hover:text-slate-950 cursor-pointer">
              <Download className="h-3.5 w-3.5" /> PDF
            </button>
            <button onClick={onClose} className="p-2 rounded-2xl hover:bg-white text-slate-400 hover:text-slate-700 cursor-pointer">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto bg-slate-50/70 px-6 py-6 space-y-4">
          {/* Executive summary */}
          <section className="rounded-[26px] bg-gradient-to-br from-blue-50 via-white to-emerald-50 border border-white/90 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.86),0_18px_44px_rgba(15,23,42,0.07)]">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-blue-600" />
              <span className="text-[11px] font-bold uppercase tracking-wide text-blue-700">Executive Summary</span>
            </div>
            <p className="text-sm leading-relaxed text-slate-700">{detail.executiveSummary}</p>
          </section>

          {/* Sections */}
          {detail.sections.map((section) => (
            <section key={section.heading} className="rounded-[24px] border border-white/80 bg-white/82 p-4 shadow-[0_12px_30px_rgba(15,23,42,0.05)] space-y-2">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <FileText className="h-3.5 w-3.5 text-slate-400" />
                {section.heading}
              </h3>
              <p className="text-sm leading-relaxed text-slate-600 pl-6">{section.body}</p>
            </section>
          ))}

          {/* Recommendations */}
          <section className="rounded-[26px] bg-cyan-50/80 border border-cyan-100 p-5 shadow-[0_16px_34px_rgba(14,165,233,0.08)]">
            <div className="flex items-center gap-2 mb-3">
              <ListChecks className="h-4 w-4 text-blue-600" />
              <span className="text-[11px] font-bold uppercase tracking-wide text-blue-700">Recommendations</span>
            </div>
            <ol className="space-y-2 pl-5 list-decimal text-sm text-slate-700">
              {detail.recommendations.map((r, i) => <li key={i}>{r}</li>)}
            </ol>
          </section>

          {/* Methodology */}
          <section className="rounded-[24px] border border-white/80 bg-white/82 p-4 shadow-[0_12px_30px_rgba(15,23,42,0.05)] space-y-2">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <FlaskConical className="h-3.5 w-3.5 text-slate-400" />
              Methodology
            </h3>
            <p className="text-sm leading-relaxed text-slate-600 pl-6">{detail.methodology}</p>
          </section>

          {/* Citations */}
          <section className="rounded-[24px] border border-white/80 bg-white/82 p-4 shadow-[0_12px_30px_rgba(15,23,42,0.05)] space-y-2">
            <h3 className="text-sm font-bold text-slate-800">References</h3>
            <ul className="space-y-1 pl-6 text-xs text-slate-500 list-disc">
              {detail.citations.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
