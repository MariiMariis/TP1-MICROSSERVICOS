// "New encounter" forms: each specialty has its own fields, which become the document's
// clinicalData. No migration is needed to add a specialty here - just describe the fields.
export const TEMPLATES = {
  Cardiology: {
    recordType: "CONSULTATION",
    fields: [
      { path: "bloodPressure.systolic", label: "Systolic BP (mmHg)", type: "number", value: 130 },
      { path: "bloodPressure.diastolic", label: "Diastolic BP (mmHg)", type: "number", value: 85 },
      { path: "bloodPressure.unit", label: "Unit", type: "hidden", value: "mmHg" },
      { path: "heartRate", label: "Heart rate (bpm)", type: "number", value: 72 },
      { path: "ecg.rhythm", label: "ECG rhythm", type: "select", options: ["sinus", "atrial fibrillation", "sinus tachycardia"], value: "sinus" },
      { path: "ejectionFraction", label: "Ejection fraction (%)", type: "number", value: 60 },
      { path: "cardiovascularRisk", label: "Cardiovascular risk", type: "select", options: ["low", "moderate", "high"], value: "moderate" },
    ],
  },
  Ophthalmology: {
    recordType: "CONSULTATION",
    fields: [
      { path: "visualAcuity.rightEye", label: "Visual acuity, right eye", type: "text", value: "20/30" },
      { path: "visualAcuity.leftEye", label: "Visual acuity, left eye", type: "text", value: "20/25" },
      { path: "intraocularPressure.rightEye", label: "IOP right eye (mmHg)", type: "number", value: 15 },
      { path: "intraocularPressure.leftEye", label: "IOP left eye (mmHg)", type: "number", value: 14 },
      { path: "refraction.rightEye.sphere", label: "Refraction right eye, sphere", type: "number", value: -1.25, step: 0.25 },
      { path: "refraction.leftEye.sphere", label: "Refraction left eye, sphere", type: "number", value: -1.0, step: 0.25 },
      { path: "fundus", label: "Fundus", type: "text", value: "no abnormalities" },
    ],
  },
  Orthopedics: {
    recordType: "CONSULTATION",
    fields: [
      { path: "joint", label: "Joint", type: "select", options: ["lumbar spine", "cervical spine", "knee", "shoulder", "ankle", "hip"], value: "knee" },
      { path: "side", label: "Side", type: "select", options: ["right", "left", "n/a"], value: "right" },
      { path: "painScale", label: "Pain scale (0-10)", type: "number", value: 5, min: 0, max: 10 },
      { path: "rangeOfMotion", label: "Range of motion", type: "select", options: ["preserved", "reduced", "severely reduced"], value: "reduced" },
      { path: "plan", label: "Plan", type: "text", value: "physiotherapy twice a week" },
    ],
  },
  Psychiatry: {
    recordType: "CONSULTATION",
    fields: [
      { path: "scales.GAD7", label: "GAD-7 (0-21)", type: "number", value: 8, min: 0, max: 21 },
      { path: "scales.PHQ9", label: "PHQ-9 (0-27)", type: "number", value: 6, min: 0, max: 27 },
      { path: "mentalStatusExam.mood", label: "Mood", type: "select", options: ["euthymic", "anxious", "depressed", "irritable"], value: "anxious" },
      { path: "mentalStatusExam.sleep", label: "Sleep", type: "select", options: ["preserved", "initial insomnia", "terminal insomnia"], value: "initial insomnia" },
      { path: "psychotherapy", label: "In psychotherapy?", type: "select", options: ["true", "false"], value: "true", cast: "boolean" },
    ],
  },
  Endocrinology: {
    recordType: "CONSULTATION",
    fields: [
      { path: "fastingGlucose.value", label: "Fasting glucose (mg/dL)", type: "number", value: 98 },
      { path: "fastingGlucose.unit", type: "hidden", value: "mg/dL" },
      { path: "hba1c.value", label: "HbA1c (%)", type: "number", value: 5.6, step: 0.1 },
      { path: "hba1c.unit", type: "hidden", value: "%" },
      { path: "tsh.value", label: "TSH (mIU/L)", type: "number", value: 2.1, step: 0.1 },
      { path: "tsh.unit", type: "hidden", value: "mIU/L" },
      { path: "bmi", label: "BMI", type: "number", value: 26.4, step: 0.1 },
    ],
  },
  Dermatology: {
    recordType: "CONSULTATION",
    fields: [
      { path: "skinType", label: "Fitzpatrick skin type", type: "select", options: ["I", "II", "III", "IV", "V", "VI"], value: "III" },
      { path: "lesions.0.location", label: "Lesion location", type: "text", value: "back" },
      { path: "lesions.0.type", label: "Lesion type", type: "select", options: ["macule", "papule", "plaque", "nevus", "pustule"], value: "nevus" },
      { path: "lesions.0.sizeMm", label: "Lesion size (mm)", type: "number", value: 4 },
      { path: "lesions.0.dermoscopy", label: "Dermoscopy", type: "text", value: "no atypia" },
    ],
  },
  Pediatrics: {
    recordType: "CONSULTATION",
    fields: [
      { path: "weightKg", label: "Weight (kg)", type: "number", value: 18.5, step: 0.1 },
      { path: "heightCm", label: "Height (cm)", type: "number", value: 108 },
      { path: "percentile.weight", label: "Weight percentile", type: "number", value: 50 },
      { path: "percentile.height", label: "Height percentile", type: "number", value: 50 },
      { path: "developmentalMilestones.0", label: "Developmental milestones", type: "text", value: "appropriate for age" },
    ],
  },
  "General Practice": {
    recordType: "CONSULTATION",
    fields: [
      { path: "vitals.bloodPressure.systolic", label: "Systolic BP", type: "number", value: 120 },
      { path: "vitals.bloodPressure.diastolic", label: "Diastolic BP", type: "number", value: 80 },
      { path: "vitals.temperatureC", label: "Temperature (°C)", type: "number", value: 36.6, step: 0.1 },
      { path: "vitals.spo2", label: "SpO2 (%)", type: "number", value: 97 },
      { path: "physicalExam", label: "Physical exam", type: "text", value: "unremarkable" },
      { path: "plan", label: "Plan", type: "text", value: "symptomatic treatment, return if needed" },
    ],
  },
  "Clinical Laboratory": {
    recordType: "EXAM",
    fields: [
      { path: "cbc.hemoglobin.value", label: "Hemoglobin (g/dL)", type: "number", value: 13.8, step: 0.1 },
      { path: "cbc.hemoglobin.unit", type: "hidden", value: "g/dL" },
      { path: "cbc.hemoglobin.reference", type: "hidden", value: "12.0-15.5" },
      { path: "chemistry.glucose.value", label: "Glucose (mg/dL)", type: "number", value: 92 },
      { path: "chemistry.glucose.unit", type: "hidden", value: "mg/dL" },
      { path: "chemistry.glucose.reference", type: "hidden", value: "70-99" },
      { path: "chemistry.totalCholesterol.value", label: "Total cholesterol (mg/dL)", type: "number", value: 185 },
      { path: "chemistry.totalCholesterol.unit", type: "hidden", value: "mg/dL" },
      { path: "chemistry.creatinine.value", label: "Creatinine (mg/dL)", type: "number", value: 0.9, step: 0.01 },
      { path: "chemistry.creatinine.unit", type: "hidden", value: "mg/dL" },
      { path: "fastingHours", label: "Fasting (hours)", type: "number", value: 12 },
    ],
  },
  Immunization: {
    recordType: "VACCINE",
    fields: [
      { path: "vaccine", label: "Vaccine", type: "select", options: ["Influenza (flu)", "COVID-19 (bivalent)", "Hepatitis B", "Td (diphtheria and tetanus)", "Yellow fever", "MMR"], value: "Influenza (flu)" },
      { path: "manufacturer", label: "Manufacturer", type: "text", value: "Butantan" },
      { path: "lot", label: "Lot", type: "text", value: "A123456" },
      { path: "dose", label: "Dose", type: "select", options: ["1st dose", "2nd dose", "booster", "single dose", "annual dose"], value: "annual dose" },
      { path: "route", label: "Route", type: "select", options: ["intramuscular", "subcutaneous", "oral"], value: "intramuscular" },
      { path: "adverseReaction", label: "Adverse reaction", type: "text", value: "none" },
    ],
  },
  "Free form": {
    recordType: "CONSULTATION",
    free: true,
    fields: [],
  },
};

export const SPECIALTIES = Object.keys(TEMPLATES);

// Builds the clinicalData object from the filled fields ("a.b.0.c" becomes nested object/array).
export function buildClinicalData(fields, values) {
  const out = {};
  for (const f of fields) {
    let v = values[f.path] ?? f.value;
    if (v === "" || v == null) continue;
    if (f.type === "number") v = Number(v);
    if (f.cast === "boolean") v = v === true || v === "true";
    const parts = f.path.split(".");
    let node = out;
    parts.forEach((part, i) => {
      const last = i === parts.length - 1;
      if (last) { node[part] = v; return; }
      const nextIsIndex = /^\d+$/.test(parts[i + 1]);
      if (node[part] == null) node[part] = nextIsIndex ? [] : {};
      node = node[part];
    });
  }
  return out;
}
