"use client";

import { useState } from "react";
import { Database, Globe2, Menu, RefreshCw, Search, ShieldCheck, UserRound } from "lucide-react";
import { FOREIGN_CONSULTATION_COUNT, FOREIGN_PATIENTS } from "@/lib/foreign-data";

const SURVEILLANCE_ORIGIN = process.env.NEXT_PUBLIC_SURVEILLANCE_URL ?? (process.env.NODE_ENV === "development" ? "http://localhost:3000" : "");

export default function ForeignPortalPage() {
  const [amount, setAmount] = useState("25");
  const [status, setStatus] = useState("Ready to send foreign consultation feed.");
  const [count, setCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  const seedForeign = async () => {
    const parsed = Math.max(1, Math.min(500, Number(amount) || 25));
    setStatus("Sending foreign portal consultations...");
    try {
      const response = await fetch(`${SURVEILLANCE_ORIGIN}/api/foreign/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: parsed }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      setCount(payload.total ?? payload.accepted ?? parsed);
      setStatus(`${payload.accepted ?? parsed} foreign consultations sent to surveillance intake.`);
    } catch (error) {
      setStatus(`Send failed: ${error instanceof Error ? error.message : "foreign intake unavailable"}`);
    }
  };

  return (
    <div className="min-h-screen bg-[#eef8f2] text-slate-900">
      <header className="relative flex h-16 items-center gap-4 bg-emerald-600 px-5 text-white shadow-md">
        <button onClick={() => setMenuOpen((current) => !current)} className="rounded border border-white/70 p-2"><Menu className="h-6 w-6" /></button>
        <div className="text-2xl font-semibold">Foreign Portal</div>
        <div className="ml-4 flex h-10 flex-1 max-w-4xl items-center bg-white/16 px-4">
          <Search className="h-5 w-5" />
          <input className="w-full bg-transparent px-3 text-white outline-none placeholder:text-white/85" placeholder="Passport / work permit / patient search" />
        </div>
        <div className="ml-auto text-right">
          <p className="text-sm font-semibold">Foreign Health Desk</p>
          <p className="text-xs text-white/80">Hulhumale' Entry Clinic</p>
        </div>
        <ShieldCheck className="h-6 w-6" />
        {menuOpen && (
          <div className="absolute left-5 top-16 z-50 w-[420px] border border-emerald-200 bg-white p-4 text-slate-900 shadow-[0_24px_70px_rgba(15,23,42,0.24)]">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-emerald-700">Foreign pitch controls</p>
            <div className="mt-3 divide-y divide-slate-100 rounded border border-slate-200 bg-slate-50">
              <div className="flex items-center justify-between px-4 py-3"><span className="text-sm font-semibold text-slate-500">Foreign patients</span><span className="font-mono text-2xl font-black">{FOREIGN_PATIENTS.length}</span></div>
              <div className="flex items-center justify-between px-4 py-3"><span className="text-sm font-semibold text-slate-500">Consultation episodes</span><span className="font-mono text-2xl font-black">{FOREIGN_CONSULTATION_COUNT.toLocaleString()}</span></div>
              <div className="flex items-center justify-between px-4 py-3"><span className="text-sm font-semibold text-slate-500">Sent to surveillance</span><span className="font-mono text-2xl font-black text-emerald-700">{count.toLocaleString()}</span></div>
            </div>
            <div className="mt-4 flex gap-2">
              <input value={amount} onChange={(event) => setAmount(event.target.value.replace(/[^0-9]/g, "").slice(0, 3))} className="min-w-0 flex-1 rounded border border-emerald-200 px-3 py-2 text-sm font-bold outline-none" />
              <button onClick={seedForeign} className="inline-flex items-center gap-2 rounded bg-emerald-600 px-4 py-2 text-sm font-bold text-white"><Database className="h-4 w-4" />Send</button>
            </div>
            <p className="mt-2 text-xs font-semibold text-emerald-700">{status}</p>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-6xl space-y-5 px-6 py-8">
        <section className="rounded border border-emerald-100 bg-white p-6 shadow-[0_18px_44px_rgba(15,23,42,0.08)]">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="flex gap-4">
              <div className="flex h-20 w-20 items-center justify-center rounded bg-emerald-600 text-white shadow-lg"><Globe2 className="h-10 w-10" /></div>
              <div>
                <p className="text-[12px] font-bold uppercase tracking-[0.28em] text-emerald-600">Foreign Patient Feed</p>
                <h1 className="mt-2 text-4xl font-bold tracking-tight">Safe consultation transfer</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">This portal represents foreign-patient clinical intake with {FOREIGN_PATIENTS.length} source patients and {FOREIGN_CONSULTATION_COUNT.toLocaleString()} consultation episodes. It sends safe consultation summaries to surveillance, where syncing is paused until the operator resumes it.</p>
              </div>
            </div>
            <div className="rounded border border-emerald-100 bg-emerald-50 px-6 py-4 text-right">
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-700">Sent records</p>
              <p className="mt-1 text-4xl font-black text-emerald-700">{count}</p>
            </div>
          </div>
        </section>

        <section className="grid gap-5 md:grid-cols-[1fr_360px]">
          <div className="rounded border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-lg font-bold">Consultation sender</p>
            <p className="mt-1 text-sm text-slate-500">Use this during the pitch to add foreign consultations, then resume Foreign Portal sync in surveillance.</p>
            <div className="mt-5 flex max-w-md gap-3">
              <input value={amount} onChange={(event) => setAmount(event.target.value.replace(/[^0-9]/g, "").slice(0, 3))} className="min-w-0 flex-1 rounded border border-slate-200 px-4 py-3 text-lg font-semibold outline-none focus:border-emerald-400" />
              <button onClick={seedForeign} className="inline-flex items-center gap-2 rounded bg-emerald-600 px-5 py-3 font-bold text-white hover:bg-emerald-500"><Database className="h-5 w-5" />Send</button>
            </div>
            <p className="mt-3 text-sm font-semibold text-emerald-700">{status}</p>
          </div>
          <div className="rounded border border-slate-200 bg-white p-6 shadow-sm">
            <UserRound className="h-8 w-8 text-emerald-600" />
            <p className="mt-3 text-sm font-bold uppercase tracking-wide text-slate-400">Transfer rule</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">No AI runs in this portal. It only sends safe intake rows to the surveillance listener.</p>
            <button onClick={seedForeign} className="mt-5 inline-flex items-center gap-2 rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700"><RefreshCw className="h-4 w-4" />Send another batch</button>
          </div>
        </section>
      </main>
    </div>
  );
}
