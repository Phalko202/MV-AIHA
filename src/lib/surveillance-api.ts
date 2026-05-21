/* ------------------------------------------------------------------ */
/*  SURVEILLANCE API - disease-only mock data service                  */
/*  No bed, ICU, ventilator, or capacity assumptions are used.          */
/* ------------------------------------------------------------------ */

export type DiseaseCode =
  | "ili"
  | "dengue"
  | "gastro"
  | "febrile_seizure"
  | "chest_pain"
  | "dehydration"
  | "influenza"
  | "pneumonia"
  | "diarrhea"
  | "hfmd";

export type DiseaseSignal = "stable" | "watch" | "moderate" | "critical";
export type CaseOrigin = "local" | "foreign";
export type IdentifierKind = "local_id" | "passport" | "hospital_number" | "unknown_foreign";

export interface Disease {
  code: DiseaseCode;
  name: string;
  icd10: string;
  notifiable: boolean;
  vaccinePreventable: boolean;
  category: "respiratory" | "vector-borne" | "enteric" | "neurological" | "cardiac" | "other";
}

export const DISEASES: Disease[] = [
  { code: "ili", name: "Influenza-like Illness", icd10: "J11", notifiable: true, vaccinePreventable: true, category: "respiratory" },
  { code: "dengue", name: "Dengue Fever", icd10: "A90", notifiable: true, vaccinePreventable: true, category: "vector-borne" },
  { code: "gastro", name: "Gastroenteritis", icd10: "K52", notifiable: true, vaccinePreventable: false, category: "enteric" },
  { code: "febrile_seizure", name: "Febrile Seizure", icd10: "R56.0", notifiable: false, vaccinePreventable: false, category: "neurological" },
  { code: "chest_pain", name: "Acute Chest Pain", icd10: "R07", notifiable: false, vaccinePreventable: false, category: "cardiac" },
  { code: "dehydration", name: "Severe Dehydration", icd10: "E86", notifiable: false, vaccinePreventable: false, category: "other" },
  { code: "influenza", name: "Influenza (confirmed)", icd10: "J10", notifiable: true, vaccinePreventable: true, category: "respiratory" },
  { code: "pneumonia", name: "Community-Acquired Pneumonia", icd10: "J18", notifiable: true, vaccinePreventable: true, category: "respiratory" },
  { code: "diarrhea", name: "Acute Diarrhea", icd10: "A09", notifiable: true, vaccinePreventable: false, category: "enteric" },
  { code: "hfmd", name: "Hand-Foot-Mouth Disease", icd10: "B08.4", notifiable: true, vaccinePreventable: false, category: "enteric" },
];

export const DISEASE_BY_CODE: Record<DiseaseCode, Disease> = DISEASES.reduce((acc, disease) => {
  acc[disease.code] = disease;
  return acc;
}, {} as Record<DiseaseCode, Disease>);

export function diseaseSignalFor(count: number): DiseaseSignal {
  if (count > 20) return "critical";
  if (count > 10) return "moderate";
  if (count > 2) return "watch";
  return "stable";
}

export function signalRank(signal: DiseaseSignal) {
  return signal === "critical" ? 4 : signal === "moderate" ? 3 : signal === "watch" ? 2 : 1;
}

/* ------------------------------------------------------------------ */
/*  FACILITIES - Google Maps-style pins should use these coordinates   */
/* ------------------------------------------------------------------ */
export interface FacilityCondition {
  code: DiseaseCode;
  count: number;
  trend: "up" | "down" | "stable";
  last24h: number;
  signal: DiseaseSignal;
}

export interface FacilityStatus {
  id: string;
  name: string;
  shortName: string;
  type: "tertiary" | "regional" | "atoll" | "clinic";
  lat: number;
  lng: number;
  atoll: string;
  island: string;
  status: DiseaseSignal;
  activeCases: number;
  alerts: string[];
  conditions: FacilityCondition[];
}

function condition(code: DiseaseCode, count: number, trend: FacilityCondition["trend"], last24h: number): FacilityCondition {
  return { code, count, trend, last24h, signal: diseaseSignalFor(last24h) };
}

function facility(input: Omit<FacilityStatus, "status" | "activeCases">): FacilityStatus {
  const status = input.conditions.reduce<DiseaseSignal>((highest, item) => (
    signalRank(item.signal) > signalRank(highest) ? item.signal : highest
  ), "stable");
  return {
    ...input,
    status,
    activeCases: input.conditions.reduce((sum, item) => sum + item.count, 0),
  };
}

export const FACILITIES: FacilityStatus[] = [
  facility({
    id: "igmh", name: "Indira Gandhi Memorial Hospital", shortName: "IGMH", type: "tertiary",
    lat: 4.1733913, lng: 73.5016101, atoll: "Kaafu", island: "Male",
    alerts: ["ILI above daily threshold", "Dengue signal requires vector-control review"],
    conditions: [condition("ili", 48, "up", 24), condition("dengue", 31, "up", 13), condition("gastro", 22, "stable", 7), condition("febrile_seizure", 15, "down", 2), condition("pneumonia", 18, "up", 6), condition("chest_pain", 8, "stable", 1)],
  }),
  facility({
    id: "adk", name: "ADK Hospital", shortName: "ADK", type: "tertiary",
    lat: 4.1749814, lng: 73.5152616, atoll: "Kaafu", island: "Male",
    alerts: ["Dengue cases crossed moderate signal threshold"],
    conditions: [condition("dengue", 24, "up", 12), condition("chest_pain", 18, "stable", 3), condition("dehydration", 12, "down", 2), condition("ili", 13, "stable", 4)],
  }),
  facility({
    id: "treetop", name: "Tree Top Hospital", shortName: "TREE", type: "tertiary",
    lat: 4.2120, lng: 73.5435, atoll: "Kaafu", island: "Hulhumale",
    alerts: [],
    conditions: [condition("ili", 15, "stable", 5), condition("febrile_seizure", 12, "down", 1), condition("chest_pain", 8, "stable", 1), condition("pneumonia", 8, "stable", 3)],
  }),
  facility({
    id: "hulhumale", name: "Hulhumale Hospital", shortName: "HMH", type: "regional",
    lat: 4.2157, lng: 73.5445, atoll: "Kaafu", island: "Hulhumale",
    alerts: ["Dengue daily count above critical threshold", "Foreign-patient dengue cluster under review", "ILI trend rising for three consecutive uploads"],
    conditions: [condition("ili", 38, "up", 18), condition("dengue", 28, "up", 23), condition("gastro", 15, "up", 8), condition("pneumonia", 8, "up", 4)],
  }),
  facility({
    id: "hulhumale_gp2", name: "Hulhumale GP Clinic - Phase 2", shortName: "HGP2", type: "clinic",
    lat: 4.2312, lng: 73.5435, atoll: "Kaafu", island: "Hulhumale Phase 2, Neighbourhood 3",
    alerts: ["GP walk-in registry shows dengue increase among foreign workers"],
    conditions: [condition("dengue", 21, "up", 16), condition("ili", 19, "up", 9), condition("gastro", 8, "stable", 2), condition("hfmd", 7, "up", 1)],
  }),
  facility({
    id: "vilingili_hc", name: "Vilingili Health Centre", shortName: "VHC", type: "clinic",
    lat: 4.1741, lng: 73.4848, atoll: "Kaafu", island: "Villingili",
    alerts: [],
    conditions: [condition("dengue", 5, "stable", 1), condition("gastro", 4, "down", 1)],
  }),
  facility({
    id: "krh", name: "Kulhudhuffushi Regional Hospital", shortName: "KRH", type: "regional",
    lat: 6.6178854, lng: 73.0685214, atoll: "Haa Dhaalu", island: "Kulhudhuffushi",
    alerts: [],
    conditions: [condition("ili", 8, "stable", 2), condition("dengue", 6, "down", 1), condition("diarrhea", 4, "stable", 1)],
  }),
  facility({
    id: "urh", name: "Ungoofaaru Regional Hospital", shortName: "URH", type: "regional",
    lat: 5.6682885, lng: 73.0300959, atoll: "Raa", island: "Ungoofaaru",
    alerts: ["Dengue cluster under investigation"],
    conditions: [condition("dengue", 14, "up", 11), condition("ili", 5, "stable", 2), condition("hfmd", 3, "up", 1)],
  }),
  facility({
    id: "gan_lh", name: "Gan Regional Hospital (Laamu)", shortName: "GRH", type: "regional",
    lat: 1.9215985, lng: 73.5447246, atoll: "Laamu", island: "Gan",
    alerts: [],
    conditions: [condition("gastro", 4, "stable", 1), condition("dehydration", 3, "down", 1), condition("ili", 5, "stable", 1)],
  }),
  facility({
    id: "aeh", name: "Addu Equatorial Hospital", shortName: "AEH", type: "tertiary",
    lat: -0.6213367, lng: 73.0960222, atoll: "Addu", island: "Hithadhoo",
    alerts: [],
    conditions: [condition("ili", 7, "stable", 2), condition("dengue", 4, "down", 1), condition("pneumonia", 3, "stable", 1), condition("chest_pain", 2, "stable", 0)],
  }),
  facility({
    id: "fmh", name: "Fuvahmulah Hospital", shortName: "FMH", type: "regional",
    lat: -0.2957668, lng: 73.4244751, atoll: "Gnaviyani", island: "Fuvahmulah",
    alerts: [],
    conditions: [condition("ili", 4, "stable", 1), condition("gastro", 2, "stable", 0), condition("dengue", 2, "stable", 0)],
  }),
  facility({
    id: "thr", name: "Thinadhoo Regional Hospital", shortName: "TRH", type: "regional",
    lat: 0.5326429, lng: 72.9971416, atoll: "Gaafu Dhaalu", island: "Thinadhoo",
    alerts: [],
    conditions: [condition("ili", 5, "stable", 1), condition("dengue", 3, "down", 1), condition("diarrhea", 3, "stable", 0)],
  }),
  facility({
    id: "muli", name: "Muli Regional Hospital", shortName: "MRH", type: "regional",
    lat: 2.9215, lng: 73.5815, atoll: "Meemu", island: "Muli",
    alerts: [],
    conditions: [condition("ili", 3, "stable", 1), condition("gastro", 2, "stable", 0), condition("dengue", 1, "stable", 0)],
  }),
];

export interface OutbreakCluster {
  id: string;
  name: string;
  severity: "critical" | "high" | "medium" | "low";
  affectedFacilities: string[];
  totalCases: number;
  newCasesLast24h: number;
  startDate: string;
  diseaseCode: DiseaseCode;
}

export const OUTBREAK_CLUSTERS: OutbreakCluster[] = [
  { id: "OC-001", name: "Greater Male Respiratory Signal", severity: "high", affectedFacilities: ["igmh", "hulhumale", "treetop"], totalCases: 101, newCasesLast24h: 28, startDate: "2026-05-14", diseaseCode: "ili" },
  { id: "OC-002", name: "Hulhumale Foreign Worker Dengue Cluster", severity: "critical", affectedFacilities: ["hulhumale", "hulhumale_gp2", "adk"], totalCases: 84, newCasesLast24h: 39, startDate: "2026-05-10", diseaseCode: "dengue" },
  { id: "OC-003", name: "Hulhumale Phase 2 HFMD Watch", severity: "low", affectedFacilities: ["hulhumale_gp2"], totalCases: 10, newCasesLast24h: 2, startDate: "2026-05-17", diseaseCode: "hfmd" },
];

export type Severity = "mild" | "moderate" | "severe" | "critical";
export type Outcome = "active" | "recovered" | "referred" | "deceased";

export interface PatientEncounter {
  id: string;
  patientKey: string;
  episodeId: string;
  diseaseCode: DiseaseCode;
  facilityId: string;
  ageBracket: "0-4" | "5-9" | "10-19" | "20-29" | "30-39" | "40-49" | "50-59" | "60-69" | "70+";
  gender: "M" | "F";
  origin: CaseOrigin;
  nationalityGroup: "Maldivian" | "South Asian" | "South-East Asian" | "Middle Eastern" | "European" | "Other";
  identifierKind: IdentifierKind;
  atoll: string;
  onsetDate: string;
  admissionDate: string;
  severity: Severity;
  outcome: Outcome;
  comorbidities: string[];
  symptoms: string[];
  prescriptionSignals: string[];
  source: "ehr" | "facility_registry" | "prescription_image" | "manual_review";
  vaccinated?: boolean;
  aiConfidence: number;
  lengthOfStayDays: number;
  hospitalized: boolean;
}

export interface PatientProfile {
  patientKey: string;
  origin: CaseOrigin;
  gender: "M" | "F";
  ageBracket: PatientEncounter["ageBracket"];
  nationalityGroup: PatientEncounter["nationalityGroup"];
  identifierKind: IdentifierKind;
  episodeCount: number;
  latestDiseaseCode: DiseaseCode;
  latestFacilityId: string;
}

const AGE_BRACKETS: PatientEncounter["ageBracket"][] = ["0-4", "5-9", "10-19", "20-29", "30-39", "40-49", "50-59", "60-69", "70+"];
const SEVERITIES: Severity[] = ["mild", "moderate", "severe", "critical"];
const COMORBIDITIES = ["Diabetes", "Hypertension", "Asthma", "COPD", "CKD", "Obesity", "Pregnancy", "Immunocompromised", "None"];
const SYMPTOMS: Record<DiseaseCode, string[]> = {
  ili: ["fever", "cough", "sore throat", "myalgia"],
  dengue: ["high fever", "retro-orbital pain", "rash", "platelet drop"],
  gastro: ["vomiting", "abdominal cramps", "loose stools"],
  febrile_seizure: ["fever", "brief seizure", "post-ictal drowsiness"],
  chest_pain: ["chest pressure", "shortness of breath", "radiating pain"],
  dehydration: ["reduced intake", "dry mucosa", "dizziness"],
  influenza: ["fever", "cough", "body ache", "positive rapid test"],
  pneumonia: ["productive cough", "tachypnea", "low oxygen saturation"],
  diarrhea: ["watery stool", "abdominal pain", "dehydration"],
  hfmd: ["mouth ulcers", "palm rash", "sole rash", "fever"],
};
const PRESCRIPTION_SIGNALS: Record<DiseaseCode, string[]> = {
  ili: ["paracetamol", "oral fluids", "oseltamivir if high-risk"],
  dengue: ["paracetamol", "CBC repeat", "avoid NSAIDs"],
  gastro: ["ORS", "zinc", "antiemetic"],
  febrile_seizure: ["antipyretic", "observation", "rescue diazepam if prolonged"],
  chest_pain: ["ECG", "aspirin if indicated", "troponin"],
  dehydration: ["ORS", "IV saline if severe", "electrolytes"],
  influenza: ["oseltamivir", "paracetamol", "isolation advice"],
  pneumonia: ["amoxicillin-clavulanate", "chest x-ray", "oxygen if low saturation"],
  diarrhea: ["ORS", "stool test if persistent", "zinc"],
  hfmd: ["oral analgesic", "hydration", "school exclusion advice"],
};

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeIdentifierKind(origin: CaseOrigin, rand: () => number): IdentifierKind {
  if (origin === "local") return "local_id";
  const roll = rand();
  if (roll < 0.38) return "passport";
  if (roll < 0.72) return "hospital_number";
  return "unknown_foreign";
}

function buildPatientCohort() {
  const rand = mulberry32(20260520);
  const patients: PatientProfile[] = [];
  const encounters: PatientEncounter[] = [];
  const weightedDiseasePool: DiseaseCode[] = ["dengue", "dengue", "ili", "ili", "gastro", "pneumonia", "hfmd", "influenza", "diarrhea", "dehydration", "febrile_seizure", "chest_pain"];
  let episodeCounter = 0;

  for (let p = 0; p < 126; p++) {
    const origin: CaseOrigin = p % 3 === 0 || p % 7 === 0 ? "foreign" : "local";
    const gender: "M" | "F" = rand() > 0.52 ? "F" : "M";
    const ageBracket = AGE_BRACKETS[Math.floor(rand() * AGE_BRACKETS.length)];
    const nationalityGroup: PatientEncounter["nationalityGroup"] = origin === "local"
      ? "Maldivian"
      : (["South Asian", "South-East Asian", "Middle Eastern", "European", "Other"] as PatientEncounter["nationalityGroup"][])[Math.floor(rand() * 5)];
    const identifierKind = makeIdentifierKind(origin, rand);
    const patientKey = `${origin === "local" ? "LOC" : "FOR"}-${(p + 1).toString().padStart(4, "0")}`;
    const episodeCount = 51 + Math.floor(rand() * 9);
    let latestDiseaseCode: DiseaseCode = "ili";
    let latestFacilityId = "igmh";

    for (let episode = 0; episode < episodeCount; episode++) {
      const facilityBias = origin === "foreign" && rand() < 0.62
        ? FACILITIES.filter((item) => item.id === "hulhumale" || item.id === "hulhumale_gp2" || item.id === "adk")
        : FACILITIES;
      const facilityPick = facilityBias[Math.floor(rand() * facilityBias.length)];
      const diseaseCode = origin === "foreign" && rand() < 0.42 ? "dengue" : weightedDiseasePool[Math.floor(rand() * weightedDiseasePool.length)];
      const disease = DISEASE_BY_CODE[diseaseCode];
      const severityRoll = rand();
      const severity: Severity = severityRoll < 0.58 ? "mild" : severityRoll < 0.84 ? "moderate" : severityRoll < 0.96 ? "severe" : "critical";
      const outcomeRoll = rand();
      const outcome: Outcome = outcomeRoll < 0.58 ? "recovered" : outcomeRoll < 0.9 ? "active" : outcomeRoll < 0.985 ? "referred" : "deceased";
      const onset = new Date(2026, 3, 1 + Math.floor(rand() * 50));
      const admit = new Date(onset.getTime() + Math.floor(rand() * 3) * 86400000);
      const como: string[] = [];
      const comoCount = Math.floor(rand() * 3);
      for (let c = 0; c < comoCount; c++) {
        const pick = COMORBIDITIES[Math.floor(rand() * (COMORBIDITIES.length - 1))];
        if (!como.includes(pick)) como.push(pick);
      }
      if (como.length === 0) como.push("None");
      latestDiseaseCode = diseaseCode;
      latestFacilityId = facilityPick.id;
      encounters.push({
        id: `ENC-${(episodeCounter++).toString().padStart(6, "0")}`,
        patientKey,
        episodeId: `EP-${2026}-${(episode + 1).toString().padStart(4, "0")}`,
        diseaseCode,
        facilityId: facilityPick.id,
        ageBracket,
        gender,
        origin,
        nationalityGroup,
        identifierKind,
        atoll: facilityPick.atoll,
        onsetDate: onset.toISOString().slice(0, 10),
        admissionDate: admit.toISOString().slice(0, 10),
        severity,
        outcome,
        comorbidities: como,
        symptoms: SYMPTOMS[diseaseCode].slice(0, 2 + Math.floor(rand() * 2)),
        prescriptionSignals: PRESCRIPTION_SIGNALS[diseaseCode].slice(0, 2 + Math.floor(rand() * 2)),
        source: rand() < 0.58 ? "ehr" : rand() < 0.78 ? "facility_registry" : rand() < 0.94 ? "prescription_image" : "manual_review",
        vaccinated: disease.vaccinePreventable ? rand() > 0.45 : undefined,
        aiConfidence: +(0.76 + rand() * 0.23).toFixed(2),
        lengthOfStayDays: Math.max(0, Math.floor(rand() * (severity === "critical" ? 13 : severity === "severe" ? 7 : 3))),
        hospitalized: severity === "severe" || severity === "critical" || rand() > 0.68,
      });
    }

    patients.push({ patientKey, origin, gender, ageBracket, nationalityGroup, identifierKind, episodeCount, latestDiseaseCode, latestFacilityId });
  }

  return { patients, encounters };
}

const COHORT = buildPatientCohort();
export const PATIENTS: PatientProfile[] = COHORT.patients;
export const PATIENT_ENCOUNTERS: PatientEncounter[] = COHORT.encounters;

export function encountersFor(disease: DiseaseCode | "all"): PatientEncounter[] {
  return disease === "all" ? PATIENT_ENCOUNTERS : PATIENT_ENCOUNTERS.filter((encounter) => encounter.diseaseCode === disease);
}

export function foreignEncounters(): PatientEncounter[] {
  return PATIENT_ENCOUNTERS.filter((encounter) => encounter.origin === "foreign");
}

export function originSummary(disease: DiseaseCode | "all" = "all") {
  const rows = encountersFor(disease);
  return [
    { group: "Local female", origin: "local", gender: "F", count: rows.filter((item) => item.origin === "local" && item.gender === "F").length, icon: "LF" },
    { group: "Local male", origin: "local", gender: "M", count: rows.filter((item) => item.origin === "local" && item.gender === "M").length, icon: "LM" },
    { group: "Foreign female", origin: "foreign", gender: "F", count: rows.filter((item) => item.origin === "foreign" && item.gender === "F").length, icon: "FF" },
    { group: "Foreign male", origin: "foreign", gender: "M", count: rows.filter((item) => item.origin === "foreign" && item.gender === "M").length, icon: "FM" },
  ];
}

export interface ImportedPatientRow {
  row: number;
  source: "Clinic registry" | "Facility portal" | "Prescription image";
  displayName: string;
  age: number;
  gender: "M" | "F";
  identifierSample: string;
  identifierKind: IdentifierKind;
  origin: CaseOrigin;
  diagnosisText: string;
  diseaseCode: DiseaseCode;
  prescriptionText: string;
  facilityId: string;
  aiConfidence: number;
  action: "auto-classified" | "manual-review";
}

export const IMPORTED_FOREIGN_ROWS: ImportedPatientRow[] = [
  { row: 2, source: "Clinic registry", displayName: "Foreign patient 01", age: 31, gender: "M", identifierSample: "PA-793184", identifierKind: "passport", origin: "foreign", diagnosisText: "Fever, rash, retro-orbital pain - probable dengue", diseaseCode: "dengue", prescriptionText: "CBC repeat, paracetamol, avoid NSAIDs", facilityId: "hulhumale", aiConfidence: 0.94, action: "auto-classified" },
  { row: 3, source: "Facility portal", displayName: "Foreign patient 02", age: 27, gender: "F", identifierSample: "MA7782991", identifierKind: "passport", origin: "foreign", diagnosisText: "High fever with platelet drop", diseaseCode: "dengue", prescriptionText: "CBC tomorrow, oral fluids", facilityId: "hulhumale_gp2", aiConfidence: 0.91, action: "auto-classified" },
  { row: 4, source: "Prescription image", displayName: "Foreign patient 03", age: 42, gender: "M", identifierSample: "HUL-OPD-55182", identifierKind: "hospital_number", origin: "foreign", diagnosisText: "Fever/cough, possible ILI", diseaseCode: "ili", prescriptionText: "Paracetamol, oseltamivir if risk factor", facilityId: "adk", aiConfidence: 0.83, action: "manual-review" },
  { row: 5, source: "Clinic registry", displayName: "Foreign patient 04", age: 19, gender: "F", identifierSample: "A00000000", identifierKind: "unknown_foreign", origin: "foreign", diagnosisText: "Vomiting and watery stool", diseaseCode: "gastro", prescriptionText: "ORS, zinc", facilityId: "hulhumale_gp2", aiConfidence: 0.89, action: "auto-classified" },
];

export const ATOLL_POPULATIONS: Record<string, number> = {
  Kaafu: 227000, "Haa Dhaalu": 21000, Raa: 16000, Laamu: 12000, Addu: 34000,
  Gnaviyani: 13000, "Gaafu Dhaalu": 12000, Meemu: 6000,
};

export interface WeeklyPoint {
  week: string;
  cases: number;
  newCases: number;
  hospitalizations: number;
  recoveries: number;
  deaths: number;
  testsRun: number;
  positivity: number;
  rt: number;
  doublingDays: number;
}

export function weeklySeriesFor(disease: DiseaseCode): WeeklyPoint[] {
  const rand = mulberry32(disease.charCodeAt(0) * 73 + disease.length);
  const weeks = ["W14", "W15", "W16", "W17", "W18", "W19", "W20"];
  let base = 18 + Math.floor(rand() * 46);
  const result: WeeklyPoint[] = [];
  let prev = base;
  for (let i = 0; i < weeks.length; i++) {
    const growth = 1 + (rand() - 0.34) * 0.42;
    base = Math.max(5, Math.round(base * growth));
    const hospitalized = Math.round(base * (0.12 + rand() * 0.16));
    const deaths = Math.max(0, Math.round(base * 0.006 * (rand() + 0.35)));
    const tests = base * (8 + Math.floor(rand() * 8));
    const positivity = Math.min(45, (base / tests) * 100 + rand() * 5);
    const rt = 0.72 + growth + (rand() - 0.5) * 0.2;
    result.push({
      week: weeks[i], cases: base, newCases: i === 0 ? base : Math.max(0, base - prev), hospitalizations: hospitalized,
      recoveries: Math.round(base * (0.56 + rand() * 0.24)), deaths, testsRun: tests, positivity: +positivity.toFixed(1),
      rt: +rt.toFixed(2), doublingDays: +(rt > 1 ? 4 + rand() * 6 : 18 + rand() * 12).toFixed(1),
    });
    prev = base;
  }
  return result;
}

export interface DashboardSummary {
  totalActiveCases: number;
  newCasesLast24h: number;
  totalFacilities: number;
  criticalFacilities: number;
  totalDeaths: number;
  recoveryRate: number;
  testingRate: number;
  activeOutbreaks: number;
  responseTeamsDeployed: number;
  totalPatients: number;
  totalEpisodes: number;
  foreignEpisodes: number;
}

export function fetchDashboardSummary(): DashboardSummary {
  const totalActive = PATIENT_ENCOUNTERS.filter((encounter) => encounter.outcome === "active").length;
  const recovered = PATIENT_ENCOUNTERS.filter((encounter) => encounter.outcome === "recovered").length;
  return {
    totalActiveCases: totalActive,
    newCasesLast24h: FACILITIES.reduce((sum, item) => sum + item.conditions.reduce((inner, conditionItem) => inner + conditionItem.last24h, 0), 0),
    totalFacilities: FACILITIES.length,
    criticalFacilities: FACILITIES.filter((facilityItem) => facilityItem.status === "critical").length,
    totalDeaths: PATIENT_ENCOUNTERS.filter((encounter) => encounter.outcome === "deceased").length,
    recoveryRate: +((recovered / PATIENT_ENCOUNTERS.length) * 100).toFixed(1),
    testingRate: 1240,
    activeOutbreaks: OUTBREAK_CLUSTERS.length,
    responseTeamsDeployed: 4,
    totalPatients: PATIENTS.length,
    totalEpisodes: PATIENT_ENCOUNTERS.length,
    foreignEpisodes: foreignEncounters().length,
  };
}

export interface IncidentEvent {
  id: string;
  timestamp: string;
  facilityId: string;
  facilityName: string;
  diseaseCode: DiseaseCode;
  diseaseName: string;
  urgency: "critical" | "high" | "medium" | "low";
  ageBracket: string;
  description: string;
}

export function generateIncident(): IncidentEvent {
  const facilityPick = FACILITIES[Math.floor(Math.random() * FACILITIES.length)];
  const conditionPick = facilityPick.conditions[Math.floor(Math.random() * facilityPick.conditions.length)];
  const disease = DISEASE_BY_CODE[conditionPick.code];
  const urgency: IncidentEvent["urgency"] = conditionPick.signal === "critical" ? "critical" : conditionPick.signal === "moderate" ? "high" : conditionPick.signal === "watch" ? "medium" : "low";
  const date = new Date();
  return {
    id: crypto.randomUUID().slice(0, 8),
    timestamp: `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}:${date.getSeconds().toString().padStart(2, "0")}`,
    facilityId: facilityPick.id,
    facilityName: facilityPick.shortName,
    diseaseCode: conditionPick.code,
    diseaseName: disease.name,
    urgency,
    ageBracket: AGE_BRACKETS[Math.floor(Math.random() * AGE_BRACKETS.length)],
    description: `${disease.name} signal at ${facilityPick.shortName}: ${conditionPick.last24h} same-day cases`,
  };
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: "info" | "warning" | "error" | "critical";
  source: string;
  message: string;
  facility?: string;
}

export function generateSystemLogs(): LogEntry[] {
  const now = new Date();
  const templates: { level: LogEntry["level"]; source: string; message: string; facility?: string }[] = [
    { level: "critical", source: "Disease Signal Engine", message: "Hulhumale dengue same-day count exceeded critical threshold: 23 cases", facility: "HMH" },
    { level: "warning", source: "Foreign Audit", message: "Facility registry detected foreign-patient dengue growth around Hulhumale Phase 2", facility: "HGP2" },
    { level: "info", source: "Prescription OCR", message: "Prescription image parsed: paracetamol + CBC repeat mapped to dengue rule set", facility: "HMH" },
    { level: "info", source: "Lab System", message: "Batch diagnostic results processed: 45 samples completed", facility: "IGMH" },
    { level: "info", source: "AI Engine", message: "6,000+ episodes classified across 126 de-identified patient histories" },
    { level: "warning", source: "Dengue Watch", message: "New dengue cluster detected in Greater Male and Raa Atoll", facility: "URH" },
    { level: "info", source: "Data Sync", message: "Facility registry, EHR, lab, and prescription image queues synchronized" },
    { level: "warning", source: "HFMD Watch", message: "HFMD below alert threshold but rising in Hulhumale Phase 2", facility: "HGP2" },
  ];
  return templates.map((template, index) => ({
    id: `log-${index}`,
    timestamp: new Date(now.getTime() - index * 180000).toISOString(),
    level: template.level,
    source: template.source,
    message: template.message,
    facility: template.facility,
  }));
}

export interface ReportMeta {
  id: string;
  title: string;
  type: string;
  date: string;
  status: "Ready" | "In Progress" | "Draft";
  author: string;
  pageCount: number;
  diseaseCode?: DiseaseCode | "all";
}

export interface ReportSection { heading: string; body: string }

export interface ReportDetail extends ReportMeta {
  executiveSummary: string;
  sections: ReportSection[];
  recommendations: string[];
  methodology: string;
  citations: string[];
}

export const REPORTS: ReportMeta[] = [
  { id: "RPT-001", title: "Weekly Epidemiological Summary - W20/2026", type: "Auto-generated", date: "2026-05-19", status: "Ready", author: "AI Surveillance Engine", pageCount: 118, diseaseCode: "all" },
  { id: "RPT-002", title: "Hulhumale Foreign Worker Dengue Audit", type: "Foreign Patient Audit", date: "2026-05-18", status: "Ready", author: "Dr. A. Shafia + AI Review", pageCount: 104, diseaseCode: "dengue" },
  { id: "RPT-003", title: "Greater Male Dengue Cluster - Facility Investigation", type: "Vector-Borne", date: "2026-05-17", status: "In Progress", author: "Dr. M. Naseer", pageCount: 96, diseaseCode: "dengue" },
  { id: "RPT-004", title: "Hulhumale Phase 2 HFMD Signal Brief", type: "Cluster Brief", date: "2026-05-17", status: "Ready", author: "AI + Dr. F. Hassan", pageCount: 62, diseaseCode: "hfmd" },
  { id: "RPT-005", title: "National Morbidity Episode Audit - April/May 2026", type: "M&M Statistical", date: "2026-05-01", status: "Ready", author: "Statistics Unit", pageCount: 143, diseaseCode: "all" },
  { id: "RPT-006", title: "Influenza Vaccination Applicability and Coverage Q2/2026", type: "Immunization", date: "2026-04-30", status: "Ready", author: "Immunization Programme", pageCount: 88, diseaseCode: "influenza" },
];

export function reportDetail(id: string): ReportDetail | null {
  const meta = REPORTS.find((report) => report.id === id);
  if (!meta) return null;
  const facilityNames = FACILITIES.map((facilityItem) => facilityItem.name).join(", ");
  const sections: ReportSection[] = [
    { heading: "1. Facilities Reviewed", body: `The analysis reviewed de-identified episodes from ${facilityNames}. No patient names, addresses, passport numbers, national identifiers, or hospital numbers are included in this report.` },
    { heading: "2. Case Definition and Source Data", body: "Cases were classified from EHR entries, facility registry feeds, clinician manual entries, laboratory feeds, and prescription images. AI rules used diagnosis text, symptom phrases, prescribed medicines, age, sex, facility, and encounter timing to classify disease category and severity." },
    { heading: "3. Disease-Signal Thresholds", body: "Facility markers are disease-signal based only. One to two same-day cases remain stable, three to ten cases are watch-level, more than ten same-day cases are moderate, and more than twenty same-day cases are critical. The thresholds are not based on beds, ICU, or ventilators." },
    { heading: "4. Foreign Patient Audit", body: "Foreign-patient episodes were separated from local-patient episodes using identifier pattern, facility hospital number, passport-like values, and missing local-ID structure. Hulhumale Hospital and Hulhumale GP Clinic Phase 2 showed the strongest dengue signal among foreign-patient records." },
    { heading: "5. Clinical Symptom Patterns", body: "Dengue-classified records commonly showed high fever, retro-orbital pain, rash, platelet drop, and prescriptions indicating CBC repeat plus avoidance of NSAIDs. Respiratory classifications were supported by cough, sore throat, myalgia, positive rapid tests, and oseltamivir references where appropriate." },
    { heading: "6. Epidemiological Findings", body: "A same-day dengue increase above the critical threshold was observed around Hulhumale and Phase 2. ILI remains elevated in Greater Male but below critical threshold in most facilities. HFMD is currently a watch signal and should not be presented as a national outbreak." },
    { heading: "7. AI Classification Audit", body: "The system classified more than 6,000 de-identified episodes from over 100 patient histories, each with more than 50 recorded episodes for pitch-scale demonstration. Encounters below 0.75 confidence are routed to manual review rather than counted as confirmed signals." },
    { heading: "8. Privacy Controls", body: "Reports intentionally exclude patient names and addresses. Research excerpts may include non-identifying symptom patterns, age bands, gender, local/foreign group, facility, disease class, and anonymized prescription indicators." },
  ];
  return {
    ...meta,
    executiveSummary: "This report provides a facility-specific surveillance review for the Maldives outbreak intelligence platform. It highlights disease signals, foreign-patient audit findings, AI classification logic, and manual-review cases using de-identified patient episodes only.",
    sections,
    recommendations: [
      "Prioritize dengue review at Hulhumale Hospital and Hulhumale GP Clinic Phase 2.",
      "Require facility intake to include age, gender, diagnosis, facility, and encounter date at minimum.",
      "Route unclear foreign identifiers to manual review instead of discarding the patient episode.",
      "Use prescription-image OCR as supporting evidence, not as the only diagnostic source.",
      "Keep vaccination charts visible only for vaccine-preventable diseases.",
      "Review all critical disease signals with an epidemiologist before public reporting.",
    ],
    methodology: "Synthetic pitch dataset generated from de-identified patient histories. Statistical summaries use disease-specific counts, daily thresholds, local/foreign grouping, gender grouping, age-band distribution, and source-channel audit flags. AI classification confidence is simulated for demonstration and must be replaced with audited model output in production.",
    citations: [
      "WHO. Public health surveillance for epidemic-prone infectious diseases.",
      "Maldives Ministry of Health. National Public Health Surveillance Guidelines.",
      "WHO. Dengue guidelines for diagnosis, treatment, prevention and control.",
      "HL7 FHIR. Observation, Condition, DiagnosticReport, and DocumentReference resources.",
    ],
  };
}
