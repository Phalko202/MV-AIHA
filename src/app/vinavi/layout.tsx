"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  FileText,
  HeartPulse,
  Search,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";
import { searchPatients } from "@/lib/mock-data";
import { log } from "@/lib/logger";

const INTERNAL_ITEMS = [
  {
    href: "/vinavi",
    label: "Patient Search",
    icon: Search,
    isActive: (pathname: string) => pathname === "/vinavi",
  },
  {
    href: "/vinavi",
    label: "Clinical Records",
    icon: FileText,
    isActive: (pathname: string) => pathname.startsWith("/vinavi/") && pathname.split("/").length === 3,
  },
  {
    href: "/vinavi",
    label: "Care Episodes",
    icon: Stethoscope,
    isActive: (pathname: string) => pathname.split("/").length > 3,
  },
];



export default function VinaviLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [dateLabel, setDateLabel] = useState("");

  useEffect(() => {
    const updateDateLabel = () => {
      setDateLabel(
        new Intl.DateTimeFormat("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
        }).format(new Date())
      );
    };

    updateDateLabel();
    const intervalId = window.setInterval(updateDateLabel, 60000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    setQuery("");
  }, [pathname]);

  const matches = query.trim() ? searchPatients(query).slice(0, 5) : [];

  const handleSearchSubmit = () => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      return;
    }

    log("GLOBAL_SEARCH", "VinaviLayout", { query: trimmedQuery, resultsCount: matches.length });

    if (matches.length === 1) {
      router.push(`/vinavi/${matches[0].id}`);
      return;
    }

    router.push(`/vinavi?query=${encodeURIComponent(trimmedQuery)}`);
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#f5f7fb] text-slate-900 flex">
      <aside className="hidden lg:flex lg:w-[288px] shrink-0 flex-col border-r border-slate-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.06)]">
        <div className="border-b border-slate-200 px-6 py-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-[0_12px_24px_rgba(239,68,68,0.28)]">
              <HeartPulse className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-rose-500">
                MV-AIHA
              </p>
              <h1 className="text-lg font-bold text-slate-900">Vinavi EMR</h1>
              <p className="text-xs text-slate-500">Government Clinical Records</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto px-4 py-5">
          <div className="mb-4 px-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
            Clinical Workspace
          </div>
          <nav className="space-y-1.5">
            {INTERNAL_ITEMS.map((item) => {
              const active = item.isActive(pathname);
              return (
                <button
                  key={item.label}
                  onClick={() => router.push(item.href)}
                  className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all cursor-pointer ${
                    active
                      ? "bg-rose-50 text-rose-600 shadow-[inset_0_0_0_1px_rgba(244,63,94,0.16)]"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <item.icon className="h-4.5 w-4.5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>


        </div>

        <div className="border-t border-slate-200 px-6 py-5">
          <div className="rounded-3xl bg-gradient-to-br from-slate-50 to-white p-4 shadow-[inset_0_0_0_1px_rgba(226,232,240,0.9)]">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Secure Government Access</p>
                <p className="text-xs text-slate-500">Doctor session workspace</p>
              </div>
            </div>
          </div>

        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="shrink-0 border-b border-slate-200 bg-white/90 px-4 py-4 backdrop-blur-xl sm:px-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative min-w-0 flex-1 lg:max-w-2xl">
              <div className="flex items-center rounded-2xl border border-slate-200 bg-[#f8fafc] px-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] focus-within:border-rose-300 focus-within:bg-white focus-within:shadow-[0_12px_30px_rgba(244,63,94,0.08)]">
                <Search className="h-4.5 w-4.5 shrink-0 text-slate-400" />
                <input
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      handleSearchSubmit();
                    }
                  }}
                  placeholder="Search patient by name, ID, or national ID"
                  className="w-full bg-transparent px-3 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400"
                />
                <button
                  onClick={handleSearchSubmit}
                  className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-rose-500"
                >
                  Search
                </button>
              </div>
              {query.trim() && matches.length > 0 && (
                <div className="absolute inset-x-0 top-[calc(100%+8px)] z-50 rounded-3xl border border-slate-200 bg-white p-2 shadow-[0_24px_60px_rgba(15,23,42,0.12)]">
                  {matches.map((patient) => (
                    <button
                      key={patient.id}
                      onClick={() => router.push(`/vinavi/${patient.id}`)}
                      className="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left transition-colors hover:bg-slate-50"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{patient.name}</p>
                        <p className="text-xs text-slate-500">
                          {patient.id} · {patient.nationalId} · {patient.hospital}
                        </p>
                      </div>
                      <ArrowUpRight className="h-4 w-4 text-slate-300" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700 sm:flex sm:items-center sm:gap-2">
                <Activity className="h-4 w-4" />
                Government clinical system online
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-right shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Today</p>
                <p className="text-sm font-semibold text-slate-700">{dateLabel || "Government EMR"}</p>
              </div>
            </div>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-auto bg-[radial-gradient(circle_at_top_left,rgba(244,63,94,0.08),transparent_30%),linear-gradient(180deg,#f8fafc_0%,#f4f6fb_100%)]">
          {children}
        </main>
      </div>
    </div>
  );
}
