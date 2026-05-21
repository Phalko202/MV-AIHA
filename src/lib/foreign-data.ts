export interface ForeignConsultation {
  id: string;
  date: string;
  facilityId: string;
  diagnosis: string;
  icd10Code: string;
  sectionCount: number;
  hasVitals: boolean;
}

export interface ForeignPatient {
  id: string;
  displayName: string;
  passportRef: string;
  ageBand: string;
  gender: "Male" | "Female";
  nationalityGroup: string;
  consultations: ForeignConsultation[];
}

const NATIONALITY_GROUPS = ["South Asian", "South-East Asian", "Middle Eastern", "European", "Other"];
const AGE_BANDS = ["18-24", "25-34", "35-44", "45-54", "55-64"];
const FACILITIES = ["hulhumale", "hulhumale_gp2", "treetop", "igmh"];
const DIAGNOSES = [
  { diagnosis: "Dengue fever review", icd10Code: "A90" },
  { diagnosis: "Acute gastroenteritis", icd10Code: "A09" },
  { diagnosis: "Influenza-like illness", icd10Code: "J11" },
  { diagnosis: "Community-acquired pneumonia", icd10Code: "J18" },
  { diagnosis: "Hand-foot-mouth disease watch", icd10Code: "B08.4" },
  { diagnosis: "Medical certificate review", icd10Code: "Z02.7" },
];

function makeConsultation(patientIndex: number, consultationIndex: number): ForeignConsultation {
  const disease = DIAGNOSES[(patientIndex + consultationIndex) % DIAGNOSES.length];
  const month = 1 + (consultationIndex % 5);
  const day = 1 + ((patientIndex * 2 + consultationIndex) % 28);
  return {
    id: `FOR-EP-${(patientIndex + 1).toString().padStart(3, "0")}-${(consultationIndex + 1).toString().padStart(2, "0")}`,
    date: `2026-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`,
    facilityId: FACILITIES[(patientIndex + consultationIndex) % FACILITIES.length],
    diagnosis: disease.diagnosis,
    icd10Code: disease.icd10Code,
    sectionCount: 3 + ((patientIndex + consultationIndex) % 5),
    hasVitals: (patientIndex + consultationIndex) % 2 === 0,
  };
}

function makeForeignPatient(patientIndex: number): ForeignPatient {
  return {
    id: `foreign${(patientIndex + 1).toString().padStart(5, "0")}`,
    displayName: `Foreign patient ${(patientIndex + 1).toString().padStart(3, "0")}`,
    passportRef: `FP-${(700000 + patientIndex * 379).toString()}`,
    ageBand: AGE_BANDS[patientIndex % AGE_BANDS.length],
    gender: patientIndex % 2 === 0 ? "Male" : "Female",
    nationalityGroup: NATIONALITY_GROUPS[patientIndex % NATIONALITY_GROUPS.length],
    consultations: Array.from({ length: 50 }, (_, consultationIndex) => makeConsultation(patientIndex, consultationIndex)),
  };
}

export const FOREIGN_PATIENTS: ForeignPatient[] = Array.from({ length: 100 }, (_, patientIndex) => makeForeignPatient(patientIndex));

export const FOREIGN_CONSULTATION_COUNT = FOREIGN_PATIENTS.reduce((sum, patient) => sum + patient.consultations.length, 0);
