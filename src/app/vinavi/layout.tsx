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
    <div className="h-screen w-screen overflow-hidden bg-[#f3f3f3] text-slate-900 flex flex-col">
      <aside className="hidden">
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

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <header className="shrink-0 bg-[#e34234] px-4 py-2 text-white shadow-[0_2px_10px_rgba(0,0,0,0.22)]">
          <div className="flex items-center gap-4">
            <button className="rounded p-2 text-white/95 hover:bg-white/10" aria-label="Menu">
              <span className="block h-0.5 w-5 bg-white" />
              <span className="mt-1 block h-0.5 w-5 bg-white" />
              <span className="mt-1 block h-0.5 w-5 bg-white" />
            </button>
            <button onClick={() => router.push("/vinavi")} className="text-xl font-semibold text-white">Vinavi</button>
            <div className="relative min-w-0 flex-1">
              <div className="flex h-10 items-center bg-white/16 px-4 focus-within:bg-white/22">
                <Search className="h-4.5 w-4.5 shrink-0 text-white" />
                <input
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      handleSearchSubmit();
                    }
                  }}
                  placeholder="Patient Search"
                  className="w-full bg-transparent px-3 py-2 text-sm text-white outline-none placeholder:text-white/85"
                />
                <button
                  onClick={handleSearchSubmit}
                  className="hidden"
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

            <div className="ml-auto flex shrink-0 items-center gap-4 text-right">
              <div>
                <p className="text-sm font-semibold leading-tight">Muhammad Mujtaba Ur Rehman</p>
                <p className="text-xs font-semibold leading-tight text-white/80">Hulhumale' Hospital</p>
              </div>
              <Activity className="h-5 w-5 text-white" />
              <ShieldCheck className="h-5 w-5 text-white" />
            </div>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-auto bg-[#f5f5f5]">
          {children}
        </main>
      </div>
    </div>
  );
}
