// Generates the MongoDB documents from infra/seed/patients.json:
//   - medical_records : 1 document per patient (embedded data)
//   - encounters      : N documents per patient, each with clinicalData in the specialty's shape
//
// Deterministic (same seed, same data), so the demo is reproducible.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { UNITS } from "../config.js";

const SEED = 20260903;
const TODAY = new Date("2026-09-02T12:00:00Z");
const DAY = 24 * 3600 * 1000;

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let rnd = mulberry32(SEED);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const int = (min, max) => Math.floor(rnd() * (max - min + 1)) + min;
const dec = (min, max, places = 1) => +(min + rnd() * (max - min)).toFixed(places);
const chance = (p) => rnd() < p;
const unitCodes = UNITS.map((u) => u.code);

export function loadPatients() {
  // SEED_FILE allows pointing to another path (e.g. inside the Docker container).
  const file = process.env.SEED_FILE || join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "infra", "seed", "patients.json");
  return JSON.parse(readFileSync(file, "utf8"));
}

// ---------------------------------------------------------------- Professionals
const PROFESSIONALS = {
  Cardiology: [["Dr. Helio Vasconcelos", "CRM-SP 45871"], ["Dr. Luciana Prado", "CRM-SP 78234"]],
  Ophthalmology: [["Dr. Renata Camargo", "CRM-SP 66120"], ["Dr. Paulo Tanaka", "CRM-SP 51987"]],
  Orthopedics: [["Dr. Marcos Vilela", "CRM-SP 39012"], ["Dr. Carla Bittencourt", "CRM-SP 82345"]],
  Psychiatry: [["Dr. Fernanda Sales", "CRM-SP 71230"], ["Dr. Rodrigo Menezes", "CRM-SP 60456"]],
  Endocrinology: [["Dr. Patricia Yamamoto", "CRM-SP 55678"]],
  Dermatology: [["Dr. Andre Figueiredo", "CRM-SP 48901"]],
  Pediatrics: [["Dr. Camila Rezende", "CRM-SP 90123"], ["Dr. Felipe Aragao", "CRM-SP 87654"]],
  "General Practice": [["Dr. Joao Batista Lemos", "CRM-SP 33456"], ["Dr. Sonia Marques", "CRM-SP 41234"]],
  Gynecology: [["Dr. Isabela Furtado", "CRM-SP 69870"]],
  "Clinical Laboratory": [["Dr. Regina Alencar", "CRBM-SP 12345"]],
  "Diagnostic Imaging": [["Dr. Otavio Brandao", "CRM-SP 52345"]],
  Immunization: [["Nurse Marcia Coutinho", "COREN-SP 234567"], ["Nurse Tiago Nogueira", "COREN-SP 345678"]],
  "General Surgery": [["Dr. Eduardo Sampaio", "CRM-SP 47890"]],
};
const professional = (specialty) => { const [name, license] = pick(PROFESSIONALS[specialty]); return { name, license }; };

// ---------------------------------------------------------------- Acute diagnoses by specialty
const ACUTE = {
  "General Practice": [["J06.9", "Acute upper respiratory infection"], ["A09", "Infectious gastroenteritis"], ["R51", "Headache"], ["M79.1", "Myalgia"], ["N39.0", "Urinary tract infection"], ["K29.7", "Gastritis"], ["Z00.0", "General medical examination"]],
  Pediatrics: [["J06.9", "Acute upper respiratory infection"], ["H66.9", "Otitis media"], ["A09", "Infectious gastroenteritis"], ["J21.9", "Acute bronchiolitis"], ["Z00.1", "Routine child health examination"], ["L20.9", "Atopic dermatitis"]],
  Cardiology: [["I10", "Essential hypertension"], ["R00.0", "Tachycardia"], ["I25.1", "Atherosclerotic heart disease"], ["Z01.3", "Blood pressure examination"]],
  Ophthalmology: [["H52.1", "Myopia"], ["H52.4", "Presbyopia"], ["H10.9", "Conjunctivitis"], ["H40.9", "Glaucoma"], ["H25.9", "Senile cataract"]],
  Orthopedics: [["M54.5", "Low back pain"], ["S93.4", "Ankle sprain"], ["M17.9", "Knee osteoarthritis"], ["M75.1", "Rotator cuff syndrome"], ["M54.2", "Cervicalgia"]],
  Psychiatry: [["F41.1", "Generalized anxiety disorder"], ["F32.1", "Moderate depressive episode"], ["F51.0", "Insomnia"], ["F43.2", "Adjustment disorder"]],
  Endocrinology: [["E11", "Type 2 diabetes mellitus"], ["E78.5", "Hyperlipidemia"], ["E03.9", "Hypothyroidism"], ["E66.9", "Obesity"]],
  Dermatology: [["L70.0", "Acne vulgaris"], ["L20.9", "Atopic dermatitis"], ["B35.4", "Tinea corporis"], ["D22.9", "Melanocytic nevus"], ["L40.0", "Psoriasis vulgaris"]],
  Gynecology: [["Z01.4", "Routine gynecological examination"], ["N76.0", "Acute vaginitis"], ["N92.0", "Excessive menstruation"], ["Z30.0", "Contraception counseling"]],
};

// Medications prescribed during consultations. Some intentionally match recorded allergies
// (Dipyrone, Ibuprofen, Amoxicillin, Aspirin) so the dashboard $lookup finds real conflicts.
const PRESCRIPTIONS = {
  analgesic: [["Dipyrone", "500mg", "every 6h", 5], ["Paracetamol", "750mg", "every 8h", 5], ["Ibuprofen", "400mg", "every 8h", 5]],
  antibiotic: [["Amoxicillin", "500mg", "every 8h", 7], ["Azithromycin", "500mg", "once daily", 3], ["Nitrofurantoin", "100mg", "every 6h", 7]],
  cardio: [["Losartan", "50mg", "once daily", 30], ["Aspirin", "100mg", "once daily", 30], ["Amlodipine", "5mg", "once daily", 30]],
  psych: [["Sertraline", "50mg", "once daily", 30], ["Escitalopram", "10mg", "once daily", 30], ["Zolpidem", "10mg", "at bedtime", 15]],
  endo: [["Metformin", "850mg", "twice daily", 30], ["Simvastatin", "20mg", "at night", 30], ["Levothyroxine", "50mcg", "once daily, fasting", 30]],
  derm: [["Adapalene gel", "0.1%", "at night", 60], ["Hydrocortisone cream", "1%", "twice daily", 7], ["Ketoconazole cream", "2%", "twice daily", 14]],
};
const rx = (group, n = 1) => {
  const out = [];
  while (out.length < n) {
    const [name, dose, frequency, days] = pick(PRESCRIPTIONS[group]);
    if (!out.some((p) => p.name === name)) out.push({ name, dose, frequency, days });
  }
  return out;
};

const has = (p, code) => p.chronicConditions.some((c) => c.icd10 === code);
const ageAt = (p, date) => Math.floor((date - new Date(p.birthDate)) / (365.25 * DAY));

// ---------------------------------------------------------------- clinicalData generators
const COMPLAINTS = {
  Cardiology: ["Follow-up for blood pressure control", "Palpitations on exertion", "Atypical chest pain for 2 weeks", "Hypertension follow-up", "Shortness of breath when climbing stairs"],
  "General Practice": ["Sore throat and fever for 3 days", "Diarrhea and vomiting for 2 days", "Frequent headaches", "Annual check-up", "Pain when urinating", "Body aches and runny nose", "Heartburn after meals"],
  Pediatrics: ["Fever and cough for 2 days", "Well-child visit", "Ear pain", "Itchy rash on the skin", "Wheezing at night", "Vomiting and diarrhea"],
  Ophthalmology: ["Difficulty seeing at a distance", "Red, watery eyes", "Prescription review", "Blurred vision when reading", "Headache at the end of the day"],
  Orthopedics: ["Low back pain for 3 weeks", "Sprained ankle playing football", "Knee pain when climbing stairs", "Shoulder pain when lifting the arm", "Neck pain and tingling in the arm"],
  Psychiatry: ["Anxiety and trouble sleeping", "Persistent sadness and low energy", "Follow-up for medication adjustment", "Panic attacks", "Work-related stress"],
  Endocrinology: ["Diabetes control", "Thyroid follow-up", "Weight gain and fatigue", "Cholesterol test results", "Excessive thirst and frequent urination"],
  Dermatology: ["Pimples on the face and back", "Dark spot on the back that has grown", "Itching and scaling on the elbow", "Red patches on the trunk", "Mole check"],
  Gynecology: ["Routine visit and Pap smear", "Discharge and itching", "Very heavy periods", "Contraception counseling", "Severe menstrual cramps"],
};

function vitals(p, date) {
  const age = ageAt(p, date);
  const hyper = has(p, "I10");
  return {
    bloodPressure: { systolic: hyper ? int(130, 165) : int(105, 130), diastolic: hyper ? int(84, 100) : int(65, 84), unit: "mmHg" },
    heartRate: int(58, 96),
    temperatureC: dec(35.8, 37.4),
    spo2: int(94, 99),
    weightKg: age < 13 ? int(6, 45) : p.weightKg + int(-3, 3),
  };
}

const CLINICAL = {
  Cardiology: (p, date, idx) => {
    const hyper = has(p, "I10");
    const controlled = p.chronicConditions.find((c) => c.icd10 === "I10")?.controlled;
    // Trend: controlled patients improve over consultations.
    const drift = controlled ? -idx * 4 : 0;
    return {
      bloodPressure: { systolic: (hyper ? int(140, 168) : int(108, 128)) + drift, diastolic: (hyper ? int(86, 102) : int(66, 82)) + Math.round(drift / 2), unit: "mmHg" },
      heartRate: int(56, 98),
      ecg: { rhythm: has(p, "I48") ? "atrial fibrillation" : "sinus", findings: chance(0.3) ? [pick(["left ventricular hypertrophy", "right bundle branch block", "isolated extrasystoles"])] : [] },
      ejectionFraction: dec(52, 68),
      cardiovascularRisk: pick(["low", "moderate", "high"]),
      currentMedications: p.medications.map((m) => `${m.name} ${m.dose}`),
    };
  },
  Ophthalmology: () => ({
    visualAcuity: { rightEye: pick(["20/20", "20/25", "20/30", "20/40", "20/60"]), leftEye: pick(["20/20", "20/25", "20/30", "20/40", "20/60"]) },
    intraocularPressure: { rightEye: int(11, 21), leftEye: int(11, 21), unit: "mmHg" },
    refraction: {
      rightEye: { sphere: dec(-4, 1, 2), cylinder: dec(-1.5, 0, 2), axis: int(0, 180) },
      leftEye: { sphere: dec(-4, 1, 2), cylinder: dec(-1.5, 0, 2), axis: int(0, 180) },
    },
    fundus: pick(["no abnormalities", "no abnormalities", "increased cup-to-disc ratio", "macular drusen"]),
  }),
  Orthopedics: () => {
    const joint = pick(["lumbar spine", "ankle", "knee", "shoulder", "cervical spine"]);
    return {
      joint,
      side: joint.includes("spine") ? "n/a" : pick(["right", "left"]),
      painScale: int(2, 9),
      rangeOfMotion: pick(["preserved", "reduced", "severely reduced"]),
      findings: [pick(["muscle contracture", "swelling", "crepitus", "ligament instability", "tenderness on palpation"])],
      plan: pick(["physiotherapy twice a week", "immobilization for 10 days", "anti-inflammatory and rest", "joint injection", "referred for MRI"]),
    };
  },
  Psychiatry: (p, date, idx) => ({
    scales: { GAD7: Math.max(0, int(6, 18) - idx * 2), PHQ9: Math.max(0, int(4, 16) - idx * 2) },
    mentalStatusExam: { mood: pick(["anxious", "depressed", "euthymic", "irritable"]), affect: pick(["congruent", "blunted", "labile"]), thought: pick(["logical", "racing", "slowed"]), sleep: pick(["initial insomnia", "terminal insomnia", "preserved"]) },
    suicideRisk: "absent",
    psychotherapy: chance(0.6),
  }),
  Endocrinology: (p) => {
    const dm = has(p, "E11");
    return {
      fastingGlucose: { value: dm ? int(110, 190) : int(78, 99), unit: "mg/dL" },
      hba1c: { value: dm ? dec(6.5, 9.2) : dec(4.8, 5.6), unit: "%" },
      tsh: { value: has(p, "E03.9") ? dec(4.5, 12) : dec(0.8, 4.0, 2), unit: "mIU/L" },
      bmi: dec(19, 36),
      waistCircumference: { value: int(72, 118), unit: "cm" },
    };
  },
  Dermatology: () => ({
    skinType: pick(["II", "III", "IV", "V"]),
    lesions: [{ location: pick(["face", "back", "forearm", "scalp", "lower limbs"]), type: pick(["papule", "macule", "plaque", "nevus", "pustule"]), sizeMm: int(2, 18), dermoscopy: pick(["typical reticular pattern", "no atypia", "globular pattern", "mild asymmetry"]) }],
    sunProtection: chance(0.5) ? "advised" : "in use",
  }),
  Pediatrics: (p, date) => {
    const age = ageAt(p, date);
    return {
      weightKg: dec(3 + age * 3, 5 + age * 3.5),
      heightCm: int(50 + age * 6, 55 + age * 7),
      headCircumferenceCm: age < 3 ? int(34, 50) : undefined,
      percentile: { weight: pick([10, 25, 50, 75, 90]), height: pick([10, 25, 50, 75, 90]) },
      developmentalMilestones: age < 6 ? [pick(["appropriate for age", "speaks in sentences", "walks unassisted", "toilet trained"])] : ["appropriate for age"],
      breastfeeding: age < 2 ? pick(["exclusive", "mixed", "weaning"]) : undefined,
    };
  },
  "General Practice": (p, date) => ({
    vitals: vitals(p, date),
    history: pick(["denies comorbidities beyond those recorded", "smoker, 10 cigarettes/day", "sedentary", "exercises regularly", "social drinker"]),
    physicalExam: pick(["unremarkable", "erythematous oropharynx", "abdominal tenderness on palpation", "clear lung sounds"]),
    plan: pick(["symptomatic treatment, return if needed", "lab tests ordered", "referred to specialist", "advice and rest"]),
  }),
  Gynecology: () => ({
    lastMenstrualPeriod: new Date(TODAY - int(1, 40) * DAY),
    regularCycle: chance(0.75),
    contraception: pick(["none", "oral contraceptive", "copper IUD", "hormonal IUD", "condom"]),
    papSmear: { collected: chance(0.6), previousResult: pick(["negative for lesion", "ASC-US", "negative for lesion"]) },
    obstetricHistory: { G: int(0, 3), P: int(0, 2), A: int(0, 1) },
  }),
};

function stripUndefined(obj) {
  for (const k of Object.keys(obj)) if (obj[k] === undefined) delete obj[k];
  return obj;
}

// Lab tests: dozens of analytes, each with value, unit and reference range.
function labExam(p) {
  const dm = has(p, "E11");
  const analyte = (value, unit, reference) => ({ value, unit, reference });
  return {
    cbc: {
      hemoglobin: analyte(p.sex === "F" ? dec(11.5, 15.2) : dec(13, 17), "g/dL", p.sex === "F" ? "12.0-15.5" : "13.5-17.5"),
      hematocrit: analyte(dec(36, 50), "%", "36-50"),
      leukocytes: analyte(int(4200, 10800), "/mm3", "4000-11000"),
      platelets: analyte(int(150000, 410000), "/mm3", "150000-450000"),
    },
    chemistry: {
      glucose: analyte(dm ? int(105, 185) : int(75, 99), "mg/dL", "70-99"),
      totalCholesterol: analyte(int(150, 260), "mg/dL", "<190"),
      hdl: analyte(int(35, 70), "mg/dL", ">40"),
      ldl: analyte(int(80, 180), "mg/dL", "<130"),
      triglycerides: analyte(int(70, 260), "mg/dL", "<150"),
      creatinine: analyte(has(p, "N18.3") ? dec(1.5, 2.4, 2) : dec(0.6, 1.2, 2), "mg/dL", "0.6-1.2"),
      urea: analyte(int(18, 48), "mg/dL", "15-45"),
      ast: analyte(int(15, 45), "U/L", "<40"),
      alt: analyte(int(12, 55), "U/L", "<41"),
    },
    fastingHours: 12,
    laboratory: "MedFlow Clinical Laboratory",
  };
}

function imagingExam() {
  const modality = pick(["X-ray", "Ultrasound", "MRI", "CT scan"]);
  const region = pick(["chest", "lumbar spine", "right knee", "abdomen", "left shoulder", "head"]);
  return {
    modality,
    region,
    contrast: modality === "CT scan" || modality === "MRI" ? chance(0.4) : false,
    findings: [pick(["no significant abnormalities", "signs of spondylosis", "mild joint effusion", "mild hepatic steatosis", "consolidation in the right lower lobe", "L4-L5 disc protrusion"])],
    report: "Examination performed with standard technique. Correlate with clinical findings.",
    radiologist: "Dr. Otavio Brandao",
  };
}

const VACCINES = [
  ["Influenza (flu)", "Butantan", "intramuscular", "left deltoid"],
  ["COVID-19 (bivalent)", "Pfizer", "intramuscular", "right deltoid"],
  ["Hepatitis B", "Butantan", "intramuscular", "left deltoid"],
  ["Td (diphtheria and tetanus)", "Butantan", "intramuscular", "right deltoid"],
  ["Yellow fever", "Bio-Manguinhos", "subcutaneous", "left arm"],
  ["MMR", "Bio-Manguinhos", "subcutaneous", "right arm"],
  ["Pneumococcal 23", "MSD", "intramuscular", "left deltoid"],
];
function vaccine(p, date) {
  const age = ageAt(p, date);
  const [name, manufacturer, route, site] = age < 13 ? pick(VACCINES.slice(2, 6)) : age >= 60 ? pick([VACCINES[0], VACCINES[1], VACCINES[6]]) : pick(VACCINES);
  return {
    vaccine: name, manufacturer, route, site,
    lot: `${pick(["A", "B", "C"])}${int(100000, 999999)}`,
    dose: pick(["1st dose", "2nd dose", "booster", "single dose", "annual dose"]),
    expiresAt: new Date(date.getTime() + int(180, 720) * DAY),
    nextDose: chance(0.5) ? new Date(date.getTime() + int(30, 365) * DAY) : null,
    adverseReaction: chance(0.08) ? "local pain and low-grade fever" : "none",
  };
}

function procedure() {
  const name = pick(["Hand laceration suture", "Nevus excision", "Knee injection", "Wart cauterization", "Abscess drainage", "Ingrown toenail surgery"]);
  return {
    procedure: name,
    anesthesia: pick(["local", "local with sedation"]),
    durationMin: int(15, 60),
    sentToPathology: name.includes("Nevus"),
    complications: chance(0.1) ? "minor bleeding, controlled" : "none",
    team: [{ role: "surgeon", name: "Dr. Eduardo Sampaio" }, { role: "scrub nurse", name: "Rosana Lima" }],
    dressing: "review in 7 days",
  };
}

function admission(p, date) {
  const days = int(2, 9);
  const reason = has(p, "I10") || has(p, "I48") ? pick(["Hypertensive crisis", "Decompensated heart failure"]) : pick(["Community-acquired pneumonia", "Dehydration due to gastroenteritis", "Pyelonephritis", "Asthma attack"]);
  return {
    reason,
    bed: `${int(2, 6)}${String.fromCharCode(65 + int(0, 3))}-${int(1, 12)}`,
    admittedAt: date,
    dischargedAt: new Date(date.getTime() + days * DAY),
    daysAdmitted: days,
    dailyNotes: Array.from({ length: Math.min(days, 4) }, (_, i) => ({ day: i + 1, note: pick(["stable, plan maintained", "clinical improvement", "afebrile, tolerating diet", "oxygen weaning started"]) })),
    proceduresPerformed: [pick(["intravenous antibiotics", "intravenous hydration", "oxygen therapy", "cardiac monitoring"])],
    outcome: "discharged, improved",
  };
}

// ---------------------------------------------------------------- Assembly
function baseDoc(p, recordType, specialty, date, unit) {
  return {
    patientId: p.id,
    patientName: p.fullName,
    recordType,
    specialty,
    unit,
    professional: professional(specialty),
    occurredAt: date,
    createdAt: date,
    tags: [],
    attachments: [],
  };
}

function billingFor(p, recordType) {
  const base = { CONSULTATION: int(180, 420), EXAM: int(90, 900), PROCEDURE: int(350, 1800), ADMISSION: int(4000, 18000), VACCINE: int(60, 220) }[recordType];
  return { amount: p.healthPlan.startsWith("SUS") ? 0 : base, payer: p.healthPlan, currency: "BRL" };
}

function consultation(p, specialty, date, unit, idx, acuteOnly = false) {
  const doc = baseDoc(p, "CONSULTATION", specialty, date, unit);
  doc.durationMin = int(15, 50);
  doc.chiefComplaint = pick(COMPLAINTS[specialty]);
  doc.clinicalData = stripUndefined(CLINICAL[specialty](p, date, idx));
  doc.diagnosis = [];
  const chronicForSpecialty = { Cardiology: ["I10", "I48"], Endocrinology: ["E11", "E78.5", "E03.9"], Psychiatry: ["F41.1", "F32.1"], Ophthalmology: ["H52.1"], Orthopedics: ["M54.5"], Pediatrics: ["J45"], "General Practice": ["J45", "K21.0", "G43"] }[specialty] || [];
  for (const code of chronicForSpecialty) {
    const c = p.chronicConditions.find((x) => x.icd10 === code);
    if (c && !acuteOnly) doc.diagnosis.push({ icd10: c.icd10, description: c.description });
  }
  if (doc.diagnosis.length === 0 || chance(0.3)) {
    const [icd10, description] = pick(ACUTE[specialty]);
    if (!doc.diagnosis.some((d) => d.icd10 === icd10)) doc.diagnosis.push({ icd10, description });
  }
  doc.tags = [...new Set([specialty.toLowerCase().replace(/ /g, "-"), ...doc.diagnosis.map((d) => d.description.split(" ")[0].toLowerCase()), idx > 0 ? "follow-up" : "first-visit"])];
  doc.notes = `${doc.chiefComplaint}. ${pick(["Patient counseled about the treatment.", "Complementary tests ordered.", "Current medication maintained.", "Return in 30 days.", "Referred for follow-up.", "Good response to previous treatment."])}`;
  const rxGroup = { Cardiology: "cardio", Psychiatry: "psych", Endocrinology: "endo", Dermatology: "derm", Orthopedics: "analgesic", "General Practice": chance(0.5) ? "analgesic" : "antibiotic", Pediatrics: chance(0.6) ? "analgesic" : "antibiotic", Gynecology: "antibiotic", Ophthalmology: null }[specialty];
  doc.prescriptions = rxGroup && chance(0.75) ? rx(rxGroup, chance(0.3) ? 2 : 1) : [];
  doc.billing = billingFor(p, "CONSULTATION");
  return doc;
}

function exam(p, date, unit, lab) {
  const specialty = lab ? "Clinical Laboratory" : "Diagnostic Imaging";
  const doc = baseDoc(p, "EXAM", specialty, date, unit);
  doc.durationMin = lab ? 10 : int(20, 45);
  doc.clinicalData = lab ? labExam(p) : imagingExam();
  doc.diagnosis = lab ? [{ icd10: "Z01.7", description: "Laboratory examination" }] : [{ icd10: "Z01.8", description: "Imaging examination" }];
  doc.tags = lab ? ["exam", "laboratory", "blood"] : ["exam", "imaging", doc.clinicalData.modality.toLowerCase().split(" ")[0]];
  doc.notes = lab ? "Sample collected while fasting. Results released the same day." : `${doc.clinicalData.modality} of the ${doc.clinicalData.region}: ${doc.clinicalData.findings[0]}.`;
  doc.attachments = [{ fileName: lab ? `lab-report-${date.toISOString().slice(0, 10)}.pdf` : `imaging-report-${date.toISOString().slice(0, 10)}.pdf`, contentType: "application/pdf", url: `/reports/${p.id}/${date.getTime()}.pdf`, sizeKb: int(120, 2400) }];
  doc.billing = billingFor(p, "EXAM");
  return doc;
}

function vaccination(p, date, unit) {
  const doc = baseDoc(p, "VACCINE", "Immunization", date, unit);
  doc.durationMin = 5;
  doc.clinicalData = vaccine(p, date);
  doc.diagnosis = [{ icd10: "Z23", description: "Need for immunization" }];
  doc.tags = ["vaccine", doc.clinicalData.vaccine.split(" ")[0].toLowerCase()];
  doc.notes = `Administered ${doc.clinicalData.vaccine}, ${doc.clinicalData.dose}. No complications.`;
  doc.billing = billingFor(p, "VACCINE");
  return doc;
}

function procedureDoc(p, date, unit) {
  const doc = baseDoc(p, "PROCEDURE", "General Surgery", date, unit);
  doc.clinicalData = procedure();
  doc.durationMin = doc.clinicalData.durationMin + 20;
  doc.diagnosis = [pick([["L91.8", "Skin lesion"], ["S61.0", "Finger wound"], ["L60.0", "Ingrown nail"], ["D22.9", "Melanocytic nevus"]])].map(([icd10, description]) => ({ icd10, description }));
  doc.tags = ["procedure", "outpatient"];
  doc.notes = `${doc.clinicalData.procedure} under ${doc.clinicalData.anesthesia} anesthesia. Complications: ${doc.clinicalData.complications}.`;
  doc.prescriptions = rx("analgesic", 1);
  doc.billing = billingFor(p, "PROCEDURE");
  return doc;
}

function admissionDoc(p, date, unit) {
  const doc = baseDoc(p, "ADMISSION", "General Practice", date, unit);
  doc.clinicalData = admission(p, date);
  doc.durationMin = doc.clinicalData.daysAdmitted * 24 * 60;
  const r = doc.clinicalData.reason;
  doc.diagnosis = [{ icd10: r.startsWith("Community") ? "J18.9" : r.startsWith("Hypertensive") ? "I10" : r.startsWith("Decompensated") ? "I50.0" : r.startsWith("Pyelo") ? "N10" : r.startsWith("Asthma") ? "J45.9" : "A09", description: r }];
  doc.tags = ["admission", "emergency"];
  doc.notes = `Admitted for ${r.toLowerCase()}, ${doc.clinicalData.daysAdmitted} days of stay. Outcome: ${doc.clinicalData.outcome}.`;
  doc.prescriptions = rx("antibiotic", 1);
  doc.billing = billingFor(p, "ADMISSION");
  return doc;
}

const randomDate = (maxDaysAgo = 1095, minDaysAgo = 1) => new Date(TODAY.getTime() - int(minDaysAgo, maxDaysAgo) * DAY - int(0, 9) * 3600 * 1000);
const unitFor = (p) => (chance(0.8) ? p.preferredUnit : pick(unitCodes));

export function generateEncounters(patients) {
  rnd = mulberry32(SEED);
  const all = [];
  for (const p of patients) {
    const age = ageAt(p, TODAY);
    const docs = [];
    const specialties = new Set();

    if (age < 13) {
      specialties.add("Pediatrics");
    } else {
      specialties.add("General Practice");
      if (has(p, "I10") || has(p, "I48")) specialties.add("Cardiology");
      if (has(p, "E11") || has(p, "E78.5") || has(p, "E03.9")) specialties.add("Endocrinology");
      if (has(p, "F41.1") || has(p, "F32.1")) specialties.add("Psychiatry");
      if (has(p, "H52.1") || (age >= 45 && chance(0.4))) specialties.add("Ophthalmology");
      if (has(p, "M54.5") || chance(0.2)) specialties.add("Orthopedics");
      if (chance(0.25)) specialties.add("Dermatology");
      if (p.sex === "F" && age >= 16 && age <= 65 && chance(0.6)) specialties.add("Gynecology");
      if (age >= 60 && chance(0.5)) specialties.add("Cardiology");
    }

    for (const specialty of specialties) {
      const n = ["Cardiology", "Endocrinology", "Psychiatry", "Pediatrics"].includes(specialty) ? int(2, 4) : int(1, 2);
      const dates = Array.from({ length: n }, () => randomDate()).sort((a, b) => a - b);
      dates.forEach((date, idx) => docs.push(consultation(p, specialty, date, unitFor(p), idx)));
    }

    // Exams: patients with chronic conditions have more blood tests.
    const labs = p.chronicConditions.length ? int(1, 3) : chance(0.6) ? 1 : 0;
    for (let i = 0; i < labs; i++) docs.push(exam(p, randomDate(), unitFor(p), true));
    if (specialties.has("Orthopedics") || chance(0.2)) docs.push(exam(p, randomDate(), unitFor(p), false));

    // Vaccines: children and the elderly get more shots.
    const shots = age < 13 ? int(2, 4) : age >= 60 ? int(1, 3) : chance(0.7) ? 1 : 0;
    for (let i = 0; i < shots; i++) docs.push(vaccination(p, randomDate(), unitFor(p)));

    if (chance(0.10)) docs.push(procedureDoc(p, randomDate(), unitFor(p)));
    if (chance(0.06) || (age >= 70 && chance(0.2))) docs.push(admissionDoc(p, randomDate(), unitFor(p)));

    // Guarantees recent activity so the dashboard has "last 30 days".
    if (chance(0.35)) docs.push(consultation(p, age < 13 ? "Pediatrics" : "General Practice", randomDate(28, 1), unitFor(p), 1, true));

    all.push(...docs);
  }
  all.sort((a, b) => a.occurredAt - b.occurredAt);
  return all;
}

export function buildRecord(p, encounters) {
  const mine = encounters.filter((e) => e.patientId === p.id);
  const last = mine[mine.length - 1];
  const now = new Date();
  return {
    patientId: p.id,
    cpf: p.cpf,
    fullName: p.fullName,
    birthDate: new Date(p.birthDate + "T00:00:00Z"),
    sex: p.sex,
    email: p.email,
    phone: p.phone,
    healthPlan: p.healthPlan,
    bloodType: p.bloodType,
    heightCm: p.heightCm,
    weightKg: p.weightKg,
    address: p.address,
    preferredUnit: p.preferredUnit,
    allergies: p.allergies,
    chronicConditions: p.chronicConditions.map((c) => ({ ...c, since: new Date(c.since + "T00:00:00Z") })),
    medications: p.medications,
    emergencyContact: p.emergencyContact,
    summary: {
      totalEncounters: mine.length,
      lastEncounterAt: last?.occurredAt ?? null,
      lastSpecialty: last?.specialty ?? null,
      specialties: [...new Set(mine.map((e) => e.specialty))],
      byType: mine.reduce((acc, e) => ({ ...acc, [e.recordType]: (acc[e.recordType] || 0) + 1 }), {}),
    },
    createdAt: now,
    updatedAt: now,
  };
}
