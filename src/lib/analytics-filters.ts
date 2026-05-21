import {
  encountersFor,
  type DiseaseCode,
  type PatientEncounter,
} from "@/lib/surveillance-api";

export type DatePreset = "all" | "last7" | "last14" | "last30" | "custom";

export interface AnalyticsDateFilter {
  preset: DatePreset;
  start: string;
  end: string;
}

export interface AnalyticsFilterState {
  diagnosis: DiseaseCode | "all" | (string & Record<never, never>);
  diagnoses: string[];
  date: AnalyticsDateFilter;
  severity: PatientEncounter["severity"][];
  origin: PatientEncounter["origin"][];
  gender: PatientEncounter["gender"][];
  atolls: string[];
  facilities: string[];
  outcomes: PatientEncounter["outcome"][];
}

export type EncounterLogFilter = Record<string, unknown>;

export const DEFAULT_ANALYTICS_FILTERS: AnalyticsFilterState = {
  diagnosis: "all",
  diagnoses: [],
  date: { preset: "all", start: "", end: "" },
  severity: [],
  origin: [],
  gender: [],
  atolls: [],
  facilities: [],
  outcomes: [],
};

export function analyticsDateBounds(filter: AnalyticsDateFilter) {
  if (filter.preset === "all") return { start: "", end: "" };
  if (filter.preset === "custom") return { start: filter.start, end: filter.end };
  const latestDate = encountersFor("all").reduce((latest, encounter) => encounter.onsetDate > latest ? encounter.onsetDate : latest, "2026-05-20");
  const latest = new Date(`${latestDate}T00:00:00Z`);
  const days = filter.preset === "last7" ? 7 : filter.preset === "last14" ? 14 : 30;
  const start = new Date(latest.getTime() - (days - 1) * 86400000);
  return { start: start.toISOString().slice(0, 10), end: latest.toISOString().slice(0, 10) };
}

export function isDateInAnalyticsBounds(date: string, filter: AnalyticsDateFilter) {
  const bounds = analyticsDateBounds(filter);
  if (bounds.start && date < bounds.start) return false;
  if (bounds.end && date > bounds.end) return false;
  return true;
}

export function matchesAnalyticsFilters(encounter: PatientEncounter, filters: AnalyticsFilterState) {
  const selectedDiagnoses = filters.diagnoses.length > 0 ? filters.diagnoses : filters.diagnosis !== "all" ? [filters.diagnosis] : [];
  if (selectedDiagnoses.length > 0 && !selectedDiagnoses.includes(encounter.diseaseCode)) return false;
  if (!isDateInAnalyticsBounds(encounter.onsetDate, filters.date)) return false;
  if (filters.severity.length > 0 && !filters.severity.includes(encounter.severity)) return false;
  if (filters.origin.length > 0 && !filters.origin.includes(encounter.origin)) return false;
  if (filters.gender.length > 0 && !filters.gender.includes(encounter.gender)) return false;
  if (filters.atolls.length > 0 && !filters.atolls.includes(encounter.atoll)) return false;
  if (filters.facilities.length > 0 && !filters.facilities.includes(encounter.facilityId)) return false;
  if (filters.outcomes.length > 0 && !filters.outcomes.includes(encounter.outcome)) return false;
  return true;
}

export function filterAnalyticsEncounters(list: PatientEncounter[], filters: AnalyticsFilterState) {
  return list.filter((encounter) => matchesAnalyticsFilters(encounter, filters));
}

export function analyticsFiltersToEncounterLogFilter(filters: AnalyticsFilterState): EncounterLogFilter {
  const out: EncounterLogFilter = {};
  if (filters.date.preset !== "all") {
    const bounds = analyticsDateBounds(filters.date);
    out.onsetDate = `${bounds.start || "..."}|${bounds.end || "..."}`;
  }
  if (filters.severity.length > 0) out.severity = [...filters.severity];
  if (filters.origin.length > 0) out.origin = [...filters.origin];
  if (filters.gender.length > 0) out.gender = [...filters.gender];
  if (filters.atolls.length > 0) out.atoll = [...filters.atolls];
  if (filters.facilities.length > 0) out.facilityId = [...filters.facilities];
  if (filters.outcomes.length > 0) out.outcome = [...filters.outcomes];
  return out;
}

export function countAnalyticsFilters(filters: AnalyticsFilterState) {
  let count = 0;
  count += filters.diagnoses.length > 0 ? filters.diagnoses.length : filters.diagnosis !== "all" ? 1 : 0;
  if (filters.date.preset !== "all" || filters.date.start || filters.date.end) count++;
  count += filters.severity.length;
  count += filters.origin.length;
  count += filters.gender.length;
  count += filters.atolls.length;
  count += filters.facilities.length;
  count += filters.outcomes.length;
  return count;
}