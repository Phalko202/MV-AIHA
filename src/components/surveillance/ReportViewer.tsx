"use client";

import { X, Download, BookOpen, Sparkles, FileText, ListChecks, FlaskConical } from "lucide-react";
import { reportDetail, DISEASE_BY_CODE, type ReportMeta } from "@/lib/surveillance-api";

export default function ReportViewer({ meta, onClose }: { meta: ReportMeta; onClose: () => void }) {
  const detail = reportDetail(meta.id);
  if (!detail) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <BookOpen className="h-4 w-4 text-blue-600" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">{detail.type}</span>
              <span className="text-[10px] font-mono text-slate-400">{detail.id}</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900">{detail.title}</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {detail.author} · {detail.date} · {detail.pageCount} pages
              {detail.diseaseCode && detail.diseaseCode !== "all" && (
                <span> · ICD-10 {DISEASE_BY_CODE[detail.diseaseCode].icd10}</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button className="flex items-center gap-1.5 text-xs text-slate-700 hover:text-slate-900 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 cursor-pointer">
              <Download className="h-3.5 w-3.5" /> PDF
            </button>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 cursor-pointer">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {/* Executive summary */}
          <section className="rounded-2xl bg-gradient-to-br from-blue-50 via-white to-emerald-50 border border-blue-100 p-5">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-blue-600" />
              <span className="text-[11px] font-bold uppercase tracking-wide text-blue-700">Executive Summary</span>
            </div>
            <p className="text-sm leading-relaxed text-slate-700">{detail.executiveSummary}</p>
          </section>

          {/* Sections */}
          {detail.sections.map((section) => (
            <section key={section.heading} className="space-y-2">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <FileText className="h-3.5 w-3.5 text-slate-400" />
                {section.heading}
              </h3>
              <p className="text-sm leading-relaxed text-slate-600 pl-6">{section.body}</p>
            </section>
          ))}

          {/* Recommendations */}
          <section className="rounded-2xl bg-cyan-50/70 border border-cyan-100 p-5">
            <div className="flex items-center gap-2 mb-3">
              <ListChecks className="h-4 w-4 text-blue-600" />
              <span className="text-[11px] font-bold uppercase tracking-wide text-blue-700">Recommendations</span>
            </div>
            <ol className="space-y-2 pl-5 list-decimal text-sm text-slate-700">
              {detail.recommendations.map((r, i) => <li key={i}>{r}</li>)}
            </ol>
          </section>

          {/* Methodology */}
          <section className="space-y-2">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <FlaskConical className="h-3.5 w-3.5 text-slate-400" />
              Methodology
            </h3>
            <p className="text-sm leading-relaxed text-slate-600 pl-6">{detail.methodology}</p>
          </section>

          {/* Citations */}
          <section className="space-y-2">
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
