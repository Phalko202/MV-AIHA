/* ------------------------------------------------------------------ */
/*  MOCK DATA — Vinavi Patient Portal                                  */
/* ------------------------------------------------------------------ */

export interface VitalSign {
  timestamp: string;
  bp: string;
  heartRate: number;
  temp: number;
  spo2: number;
  respRate: number;
}

export interface SectionEntry {
  id: string;
  type: "complaint" | "advice" | "prescription" | "service" | "vital";
  title: string;
  content: string;
  createdAt: string;
  createdBy: string;
}

export interface Episode {
  id: string;
  date: string;
  doctor: string;
  specialty: string;
  diagnosis: string;
  status: "active" | "closed";
  sections: SectionEntry[];
  vitals: VitalSign[];
}

export interface Patient {
  id: string;
  name: string;
  nationalId: string;
  dob: string;
  age: number;
  gender: "Male" | "Female";
  bloodType: string;
  phone: string;
  atoll: string;
  island: string;
  allergies: string[];
  conditions: string[];
  hospital: string;
  episodes: Episode[];
  registeredAt: string;
}

export interface HospitalLocation {
  name: string;
  lat: number;
  lng: number;
  status: "operational" | "busy" | "critical";
  beds: number;
  occupancy: number;
}

/* ------------------------------------------------------------------ */
/*  HOSPITALS                                                          */
/* ------------------------------------------------------------------ */
export const HOSPITALS: HospitalLocation[] = [
  { name: "IGMH (Indira Gandhi Memorial Hospital)", lat: 4.1755, lng: 73.5093, status: "busy", beds: 500, occupancy: 87 },
  { name: "ADK Hospital", lat: 4.1718, lng: 73.5089, status: "operational", beds: 300, occupancy: 62 },
  { name: "Hulhumalé Hospital", lat: 4.2118, lng: 73.5433, status: "critical", beds: 150, occupancy: 95 },
  { name: "Tree Top Hospital", lat: 4.2225, lng: 73.5427, status: "operational", beds: 210, occupancy: 45 },
  { name: "Vilingili Regional Hospital", lat: -0.7533, lng: 73.4333, status: "operational", beds: 80, occupancy: 38 },
];

/* ------------------------------------------------------------------ */
/*  PATIENTS                                                           */
/* ------------------------------------------------------------------ */
const BASE_PATIENTS: Patient[] = [
  {
    id: "patient12312",
    name: "Ahmed Rasheed",
    nationalId: "A283746",
    dob: "1985-03-15",
    age: 41,
    gender: "Male",
    bloodType: "O+",
    phone: "+960 7721234",
    atoll: "Kaafu",
    island: "Malé",
    allergies: ["Penicillin", "Sulfa drugs"],
    conditions: ["Type 2 Diabetes", "Hypertension"],
    hospital: "IGMH",
    registeredAt: "2024-01-10T08:30:00Z",
    episodes: [
      {
        id: "EP-2026-0451",
        date: "2026-05-18",
        doctor: "Dr. Aminath Shafia",
        specialty: "Internal Medicine",
        diagnosis: "Acute Respiratory Infection",
        status: "active",
        sections: [
          { id: "s1", type: "complaint", title: "Chief Complaint", content: "Patient presents with persistent cough for 5 days, mild fever (38.2°C), and shortness of breath on exertion. Reports worsening symptoms over the last 48 hours.", createdAt: "2026-05-18T09:15:00Z", createdBy: "Dr. Aminath Shafia" },
          { id: "s2", type: "advice", title: "Medical Advice", content: "Rest for 7 days. Increase fluid intake. Monitor temperature every 6 hours. Return immediately if SpO2 drops below 94% or fever exceeds 39.5°C.", createdAt: "2026-05-18T09:30:00Z", createdBy: "Dr. Aminath Shafia" },
          { id: "s3", type: "prescription", title: "Prescription", content: "1. Amoxicillin 500mg — 1 tablet TID × 7 days\n2. Paracetamol 500mg — 1 tablet PRN (max 4/day)\n3. Salbutamol inhaler — 2 puffs PRN for wheeze", createdAt: "2026-05-18T09:35:00Z", createdBy: "Dr. Aminath Shafia" },
          { id: "s4", type: "service", title: "Lab Services", content: "CBC with differential — ORDERED\nChest X-ray PA — ORDERED\nCOVID-19 PCR — ORDERED", createdAt: "2026-05-18T09:40:00Z", createdBy: "Dr. Aminath Shafia" },
        ],
        vitals: [
          { timestamp: "2026-05-18T09:10:00Z", bp: "138/88", heartRate: 92, temp: 38.2, spo2: 96, respRate: 22 },
          { timestamp: "2026-05-18T12:00:00Z", bp: "135/85", heartRate: 88, temp: 37.8, spo2: 97, respRate: 20 },
          { timestamp: "2026-05-18T18:00:00Z", bp: "130/82", heartRate: 84, temp: 37.4, spo2: 97, respRate: 18 },
        ],
      },
      {
        id: "EP-2026-0389",
        date: "2026-04-02",
        doctor: "Dr. Ibrahim Naseer",
        specialty: "Cardiology",
        diagnosis: "Hypertension Follow-up",
        status: "closed",
        sections: [
          { id: "s5", type: "complaint", title: "Chief Complaint", content: "Routine follow-up for hypertension management. Patient reports occasional dizziness when standing up quickly.", createdAt: "2026-04-02T10:00:00Z", createdBy: "Dr. Ibrahim Naseer" },
          { id: "s6", type: "advice", title: "Medical Advice", content: "Continue current medication. Reduce sodium intake. Monitor BP at home twice daily. Follow up in 3 months.", createdAt: "2026-04-02T10:20:00Z", createdBy: "Dr. Ibrahim Naseer" },
          { id: "s7", type: "prescription", title: "Prescription", content: "1. Amlodipine 5mg — 1 tablet OD\n2. Metformin 500mg — 1 tablet BID", createdAt: "2026-04-02T10:25:00Z", createdBy: "Dr. Ibrahim Naseer" },
        ],
        vitals: [
          { timestamp: "2026-04-02T09:55:00Z", bp: "145/92", heartRate: 78, temp: 36.8, spo2: 98, respRate: 16 },
        ],
      },
      {
        id: "EP-2025-1204",
        date: "2025-12-15",
        doctor: "Dr. Fathimath Latheef",
        specialty: "Endocrinology",
        diagnosis: "Diabetes Review",
        status: "closed",
        sections: [
          { id: "s8", type: "complaint", title: "Chief Complaint", content: "Annual diabetes review. HbA1c trending up from 6.8 to 7.4 over 6 months.", createdAt: "2025-12-15T11:00:00Z", createdBy: "Dr. Fathimath Latheef" },
          { id: "s9", type: "prescription", title: "Prescription", content: "1. Metformin 500mg → increased to 850mg BID\n2. Gliclazide 30mg — 1 tablet OD (NEW)", createdAt: "2025-12-15T11:30:00Z", createdBy: "Dr. Fathimath Latheef" },
        ],
        vitals: [
          { timestamp: "2025-12-15T10:50:00Z", bp: "140/88", heartRate: 76, temp: 36.6, spo2: 98, respRate: 16 },
        ],
      },
    ],
  },
  {
    id: "patient45678",
    name: "Mariyam Nisha",
    nationalId: "A198234",
    dob: "1992-07-22",
    age: 33,
    gender: "Female",
    bloodType: "B+",
    phone: "+960 7894561",
    atoll: "Kaafu",
    island: "Hulhumalé",
    allergies: ["Aspirin"],
    conditions: ["Asthma"],
    hospital: "Hulhumalé Hospital",
    registeredAt: "2023-06-18T14:20:00Z",
    episodes: [
      {
        id: "EP-2026-0503",
        date: "2026-05-20",
        doctor: "Dr. Ali Waheed",
        specialty: "Pulmonology",
        diagnosis: "Acute Asthma Exacerbation",
        status: "active",
        sections: [
          { id: "s10", type: "complaint", title: "Chief Complaint", content: "Severe wheezing and chest tightness since early morning. Used rescue inhaler 4 times without adequate relief. Reports exposure to construction dust near residence.", createdAt: "2026-05-20T07:30:00Z", createdBy: "Dr. Ali Waheed" },
          { id: "s11", type: "prescription", title: "Prescription", content: "1. Nebulized Salbutamol 2.5mg — STAT then Q4H\n2. Prednisolone 40mg — 1 tablet OD × 5 days\n3. Montelukast 10mg — 1 tablet ON", createdAt: "2026-05-20T07:45:00Z", createdBy: "Dr. Ali Waheed" },
          { id: "s12", type: "service", title: "Services", content: "Peak flow measurement — DONE (280 L/min, predicted 420)\nSpirometry — ORDERED\nChest X-ray — ORDERED", createdAt: "2026-05-20T07:50:00Z", createdBy: "Dr. Ali Waheed" },
        ],
        vitals: [
          { timestamp: "2026-05-20T07:25:00Z", bp: "125/78", heartRate: 108, temp: 37.0, spo2: 93, respRate: 28 },
          { timestamp: "2026-05-20T08:30:00Z", bp: "120/75", heartRate: 96, temp: 36.9, spo2: 95, respRate: 24 },
        ],
      },
    ],
  },
  {
    id: "patient78901",
    name: "Hassan Manik",
    nationalId: "A342891",
    dob: "1978-11-03",
    age: 47,
    gender: "Male",
    bloodType: "A-",
    phone: "+960 7553210",
    atoll: "Addu",
    island: "Hithadhoo",
    allergies: [],
    conditions: ["Chronic Back Pain", "Hyperlipidemia"],
    hospital: "ADK Hospital",
    registeredAt: "2022-03-05T09:00:00Z",
    episodes: [
      {
        id: "EP-2026-0498",
        date: "2026-05-19",
        doctor: "Dr. Mohamed Shifan",
        specialty: "Orthopedics",
        diagnosis: "Lumbar Disc Herniation",
        status: "active",
        sections: [
          { id: "s13", type: "complaint", title: "Chief Complaint", content: "Worsening lower back pain radiating to left leg for 2 weeks. Pain rated 8/10. Difficulty walking and sitting for prolonged periods.", createdAt: "2026-05-19T14:00:00Z", createdBy: "Dr. Mohamed Shifan" },
          { id: "s14", type: "advice", title: "Medical Advice", content: "Avoid heavy lifting. Physiotherapy referral — 3 sessions/week. MRI lumbar spine ordered. Follow up in 1 week with results.", createdAt: "2026-05-19T14:20:00Z", createdBy: "Dr. Mohamed Shifan" },
          { id: "s15", type: "prescription", title: "Prescription", content: "1. Naproxen 500mg — 1 tablet BID × 10 days\n2. Pregabalin 75mg — 1 capsule ON\n3. Muscle relaxant (Tizanidine 2mg) — 1 tablet TID PRN", createdAt: "2026-05-19T14:25:00Z", createdBy: "Dr. Mohamed Shifan" },
          { id: "s16", type: "service", title: "Imaging Services", content: "MRI Lumbar Spine — ORDERED (scheduled 2026-05-22)\nX-ray Lumbar Spine AP/LAT — COMPLETED", createdAt: "2026-05-19T14:30:00Z", createdBy: "Dr. Mohamed Shifan" },
        ],
        vitals: [
          { timestamp: "2026-05-19T13:55:00Z", bp: "148/94", heartRate: 82, temp: 36.7, spo2: 98, respRate: 16 },
        ],
      },
    ],
  },
];

const FIRST_NAMES = ["Ahmed", "Mariyam", "Hassan", "Aminath", "Ibrahim", "Fathimath", "Mohamed", "Aishath", "Ali", "Noora", "Yusuf", "Leena"];
const FAMILY_NAMES = ["Rasheed", "Naseer", "Hameed", "Shareef", "Waheed", "Latheef", "Saeed", "Zahir", "Hassan", "Manik", "Faiz", "Jaleel"];
const ISLANDS = ["Male", "Hulhumale", "Villingili", "Thimarafushi", "Kulhudhuffushi", "Ungoofaaru", "Gan", "Hithadhoo"];
const ATOLLS = ["Kaafu", "Kaafu", "Kaafu", "Thaa", "Haa Dhaalu", "Raa", "Laamu", "Addu"];
const HOSPITAL_NAMES = ["IGMH", "Hulhumalé Hospital", "Tree Top Hospital", "ADK Hospital"];
const EPISODE_TEMPLATES = [
  { diagnosis: "Acute Respiratory Infection", specialty: "Internal Medicine", complaint: "Fever, cough, sore throat, and body aches reported for three days.", prescription: "Paracetamol 500mg PRN, oral fluids, and review if fever persists.", service: "CBC and influenza rapid test ordered." },
  { diagnosis: "Dengue Fever Review", specialty: "General Medicine", complaint: "High fever with headache, myalgia, and reduced appetite.", prescription: "Paracetamol only, avoid NSAIDs, repeat CBC in 24 hours.", service: "CBC, platelet count, and dengue NS1 requested." },
  { diagnosis: "Acute Gastroenteritis", specialty: "Family Medicine", complaint: "Vomiting, abdominal cramps, and loose stools after recent meal exposure.", prescription: "ORS, zinc, and antiemetic as needed.", service: "Stool test if symptoms continue beyond 48 hours." },
  { diagnosis: "Asthma Follow-up", specialty: "Pulmonology", complaint: "Intermittent wheeze and cough worse at night after dust exposure.", prescription: "Salbutamol inhaler PRN and inhaled corticosteroid continuation.", service: "Peak flow reading and inhaler technique review completed." },
  { diagnosis: "Hypertension Follow-up", specialty: "Cardiology", complaint: "Routine blood pressure review with occasional dizziness.", prescription: "Continue antihypertensive medicine and home BP monitoring.", service: "Renal profile and ECG review planned." },
  { diagnosis: "Issue of Medical Certificate", specialty: "Outpatient", complaint: "Administrative medical certificate request after outpatient review.", prescription: "No new medicine prescribed.", service: "Medical certificate prepared and verified." },
];

function makeEpisode(patientIndex: number, episodeIndex: number, patientName: string): Episode {
  const template = EPISODE_TEMPLATES[(patientIndex + episodeIndex) % EPISODE_TEMPLATES.length];
  const day = 1 + ((patientIndex * 3 + episodeIndex) % 28);
  const month = 1 + (episodeIndex % 5);
  const date = `2026-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
  const doctor = ["Dr. Aminath Shafia", "Dr. Muhammad Haris Ilyas", "Dr. Aya Gamal", "Dr. Imran Hassan", "Dr. Fathimath Saeena"][(patientIndex + episodeIndex) % 5];
  return {
    id: `EP-2026-${(patientIndex + 1).toString().padStart(3, "0")}-${(episodeIndex + 1).toString().padStart(2, "0")}`,
    date,
    doctor,
    specialty: template.specialty,
    diagnosis: template.diagnosis,
    status: episodeIndex % 11 === 0 ? "active" : "closed",
    sections: [
      { id: `s-${patientIndex}-${episodeIndex}-complaint`, type: "complaint", title: "Clinical Details", content: template.complaint, createdAt: `${date}T08:30:00Z`, createdBy: doctor },
      { id: `s-${patientIndex}-${episodeIndex}-advice`, type: "advice", title: "Advice", content: `Counselled ${patientName.split(" ")[0]} on warning signs, hydration, and follow-up timing.`, createdAt: `${date}T08:42:00Z`, createdBy: doctor },
      { id: `s-${patientIndex}-${episodeIndex}-prescription`, type: "prescription", title: "Prescription", content: template.prescription, createdAt: `${date}T08:48:00Z`, createdBy: doctor },
      { id: `s-${patientIndex}-${episodeIndex}-service`, type: "service", title: "Service", content: template.service, createdAt: `${date}T08:55:00Z`, createdBy: doctor },
    ],
    vitals: [
      { timestamp: `${date}T08:25:00Z`, bp: `${112 + ((patientIndex + episodeIndex) % 28)}/${70 + ((patientIndex + episodeIndex) % 18)}`, heartRate: 72 + ((patientIndex + episodeIndex) % 38), temp: +(36.4 + ((episodeIndex % 18) / 10)).toFixed(1), spo2: 93 + ((patientIndex + episodeIndex) % 6), respRate: 16 + ((patientIndex + episodeIndex) % 8) },
    ],
  };
}

function withFiftyEpisodes(patient: Patient, patientIndex: number): Patient {
  const episodes = [...patient.episodes];
  for (let episodeIndex = episodes.length; episodeIndex < 50; episodeIndex += 1) {
    episodes.push(makeEpisode(patientIndex, episodeIndex, patient.name));
  }
  return { ...patient, episodes };
}

function makePatient(patientIndex: number): Patient {
  const name = `${FIRST_NAMES[patientIndex % FIRST_NAMES.length]} ${FAMILY_NAMES[(patientIndex * 5) % FAMILY_NAMES.length]}`;
  const age = 18 + ((patientIndex * 7) % 62);
  const gender: Patient["gender"] = patientIndex % 2 === 0 ? "Male" : "Female";
  const island = ISLANDS[patientIndex % ISLANDS.length];
  const atoll = ATOLLS[patientIndex % ATOLLS.length];
  const patient: Patient = {
    id: `patient${(patientIndex + 1).toString().padStart(5, "0")}`,
    name,
    nationalId: `A${(200000 + patientIndex * 791).toString().padStart(6, "0")}`,
    dob: `${2026 - age}-${(1 + (patientIndex % 12)).toString().padStart(2, "0")}-${(1 + (patientIndex % 27)).toString().padStart(2, "0")}`,
    age,
    gender,
    bloodType: ["O+", "A+", "B+", "AB+", "O-", "A-"][patientIndex % 6],
    phone: `+960 7${(200000 + patientIndex * 137).toString().padStart(6, "0")}`,
    atoll,
    island,
    allergies: patientIndex % 5 === 0 ? ["Penicillin"] : patientIndex % 7 === 0 ? ["Aspirin"] : [],
    conditions: patientIndex % 4 === 0 ? ["Hypertension"] : patientIndex % 6 === 0 ? ["Asthma"] : [],
    hospital: HOSPITAL_NAMES[patientIndex % HOSPITAL_NAMES.length],
    registeredAt: `2024-${(1 + (patientIndex % 12)).toString().padStart(2, "0")}-10T08:30:00Z`,
    episodes: [],
  };
  return withFiftyEpisodes(patient, patientIndex);
}

export const MOCK_PATIENTS: Patient[] = Array.from({ length: 100 }, (_, patientIndex) => (
  patientIndex < BASE_PATIENTS.length ? withFiftyEpisodes(BASE_PATIENTS[patientIndex], patientIndex) : makePatient(patientIndex)
));

/** Find a patient by any partial match on id, name, or nationalId */
export function searchPatients(query: string): Patient[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  return MOCK_PATIENTS.filter(
    (p) =>
      p.id.toLowerCase().includes(q) ||
      p.name.toLowerCase().includes(q) ||
      p.nationalId.toLowerCase().includes(q)
  );
}

/** Find a single patient by exact ID */
export function getPatient(patientId: string): Patient | undefined {
  return MOCK_PATIENTS.find((p) => p.id === patientId);
}

/** Find a single episode within a patient */
export function getEpisode(patientId: string, episodeId: string): { patient: Patient; episode: Episode } | undefined {
  const patient = getPatient(patientId);
  if (!patient) return undefined;
  const episode = patient.episodes.find((e) => e.id === episodeId);
  if (!episode) return undefined;
  return { patient, episode };
}
