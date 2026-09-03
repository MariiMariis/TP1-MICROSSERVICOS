// Catalog of aggregation pipelines used by the dashboard.
//
// Each entry describes: which collection it runs on, what it answers and the pipeline itself.
// The API returns the pipeline together with the result, so the front-end can show
// "the query that produced this chart" - the central point of the demo.
import { COLLECTIONS } from "../config.js";

const monthsAgo = (n) => { const d = new Date(); d.setUTCDate(1); d.setUTCHours(0, 0, 0, 0); d.setUTCMonth(d.getUTCMonth() - n); return d; };
const daysAgo = (n) => new Date(Date.now() - n * 24 * 3600 * 1000);

const AGE = { $dateDiff: { startDate: "$birthDate", endDate: "$$NOW", unit: "year" } };

export const ANALYTICS = {
  kpis: {
    title: "Key indicators",
    description: "$facet runs several sub-pipelines in a single pass over the collection.",
    collection: COLLECTIONS.encounters,
    stages: () => [
      {
        $facet: {
          total: [{ $count: "n" }],
          last30Days: [{ $match: { occurredAt: { $gte: daysAgo(30) } } }, { $count: "n" }],
          byType: [{ $group: { _id: "$recordType", total: { $sum: 1 } } }, { $sort: { total: -1 } }],
          byUnit: [{ $group: { _id: "$unit", total: { $sum: 1 } } }, { $sort: { total: -1 } }],
          revenue: [{ $group: { _id: null, total: { $sum: "$billing.amount" }, avg: { $avg: "$billing.amount" } } }],
        },
      },
      {
        $project: {
          totalEncounters: { $ifNull: [{ $arrayElemAt: ["$total.n", 0] }, 0] },
          last30Days: { $ifNull: [{ $arrayElemAt: ["$last30Days.n", 0] }, 0] },
          byType: 1,
          byUnit: 1,
          totalRevenue: { $round: [{ $ifNull: [{ $arrayElemAt: ["$revenue.total", 0] }, 0] }, 2] },
          avgTicket: { $round: [{ $ifNull: [{ $arrayElemAt: ["$revenue.avg", 0] }, 0] }, 2] },
        },
      },
    ],
  },

  ageGroups: {
    title: "Patients by age group",
    description: "$dateDiff computes the age from birthDate at query time; $bucket groups into ranges.",
    collection: COLLECTIONS.records,
    stages: () => [
      { $addFields: { age: AGE } },
      {
        $bucket: {
          groupBy: "$age",
          boundaries: [0, 13, 25, 45, 65, 200],
          default: "unknown",
          output: {
            total: { $sum: 1 },
            female: { $sum: { $cond: [{ $eq: ["$sex", "F"] }, 1, 0] } },
            male: { $sum: { $cond: [{ $eq: ["$sex", "M"] }, 1, 0] } },
            avgAge: { $avg: "$age" },
            withChronicCondition: { $sum: { $cond: [{ $gt: [{ $size: { $ifNull: ["$chronicConditions", []] } }, 0] }, 1, 0] } },
          },
        },
      },
      {
        $project: {
          _id: 0,
          ageGroup: {
            $switch: {
              branches: [
                { case: { $eq: ["$_id", 0] }, then: "0-12" },
                { case: { $eq: ["$_id", 13] }, then: "13-24" },
                { case: { $eq: ["$_id", 25] }, then: "25-44" },
                { case: { $eq: ["$_id", 45] }, then: "45-64" },
                { case: { $eq: ["$_id", 65] }, then: "65+" },
              ],
              default: "?",
            },
          },
          total: 1, female: 1, male: 1, withChronicCondition: 1,
          avgAge: { $round: ["$avgAge", 1] },
        },
      },
    ],
  },

  encountersByMonth: {
    title: "Encounters per month (24 months)",
    description: "$year/$month extract date parts; $group adds up by type with $cond.",
    collection: COLLECTIONS.encounters,
    stages: () => [
      { $match: { occurredAt: { $gte: monthsAgo(23) } } },
      {
        $group: {
          _id: { year: { $year: "$occurredAt" }, month: { $month: "$occurredAt" } },
          total: { $sum: 1 },
          consultations: { $sum: { $cond: [{ $eq: ["$recordType", "CONSULTATION"] }, 1, 0] } },
          exams: { $sum: { $cond: [{ $eq: ["$recordType", "EXAM"] }, 1, 0] } },
          vaccines: { $sum: { $cond: [{ $eq: ["$recordType", "VACCINE"] }, 1, 0] } },
          other: { $sum: { $cond: [{ $in: ["$recordType", ["PROCEDURE", "ADMISSION"]] }, 1, 0] } },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
      {
        $project: {
          _id: 0,
          period: { $dateToString: { format: "%Y-%m", date: { $dateFromParts: { year: "$_id.year", month: "$_id.month" } } } },
          total: 1, consultations: 1, exams: 1, vaccines: 1, other: 1,
        },
      },
    ],
  },

  topDiagnoses: {
    title: "Most frequent diagnoses (ICD-10)",
    description: "$unwind opens the diagnosis array; $addToSet + $size count distinct patients.",
    collection: COLLECTIONS.encounters,
    stages: () => [
      { $unwind: "$diagnosis" },
      { $group: { _id: "$diagnosis.icd10", description: { $first: "$diagnosis.description" }, total: { $sum: 1 }, patients: { $addToSet: "$patientId" } } },
      { $project: { _id: 0, icd10: "$_id", description: 1, total: 1, distinctPatients: { $size: "$patients" } } },
      { $sort: { total: -1 } },
      { $limit: 10 },
    ],
  },

  specialties: {
    title: "Encounters by specialty",
    description: "Count, average duration and distinct patients per specialty.",
    collection: COLLECTIONS.encounters,
    stages: () => [
      { $group: { _id: "$specialty", total: { $sum: 1 }, avgDuration: { $avg: "$durationMin" }, patients: { $addToSet: "$patientId" }, last: { $max: "$occurredAt" } } },
      { $project: { _id: 0, specialty: "$_id", total: 1, avgDurationMin: { $round: ["$avgDuration", 0] }, distinctPatients: { $size: "$patients" }, last: 1 } },
      { $sort: { total: -1 } },
    ],
  },

  topMedications: {
    title: "Most prescribed continuous-use medications",
    description: "Reads the embedded medications array of the record, with no join table.",
    collection: COLLECTIONS.records,
    stages: () => [
      { $unwind: "$medications" },
      { $group: { _id: "$medications.name", patients: { $sum: 1 }, doses: { $addToSet: "$medications.dose" } } },
      { $sort: { patients: -1 } },
      { $limit: 10 },
      { $project: { _id: 0, medication: "$_id", patients: 1, doses: 1 } },
    ],
  },

  healthPlans: {
    title: "Patients by health plan",
    collection: COLLECTIONS.records,
    stages: () => [
      { $group: { _id: "$healthPlan", patients: { $sum: 1 }, avgAge: { $avg: AGE } } },
      { $sort: { patients: -1 } },
      { $project: { _id: 0, healthPlan: "$_id", patients: 1, avgAge: { $round: ["$avgAge", 1] } } },
    ],
  },

  bmi: {
    title: "BMI distribution (adults)",
    description: "Computed field with $divide/$pow and $bucket with the WHO ranges.",
    collection: COLLECTIONS.records,
    stages: () => [
      { $addFields: { age: AGE } },
      { $match: { age: { $gte: 18 }, heightCm: { $gt: 0 }, weightKg: { $gt: 0 } } },
      { $addFields: { bmi: { $divide: ["$weightKg", { $pow: [{ $divide: ["$heightCm", 100] }, 2] }] } } },
      {
        $bucket: {
          groupBy: "$bmi",
          boundaries: [0, 18.5, 25, 30, 35, 100],
          default: "?",
          output: { patients: { $sum: 1 }, avgBmi: { $avg: "$bmi" } },
        },
      },
      {
        $project: {
          _id: 0,
          category: {
            $switch: {
              branches: [
                { case: { $eq: ["$_id", 0] }, then: "Underweight" },
                { case: { $eq: ["$_id", 18.5] }, then: "Normal" },
                { case: { $eq: ["$_id", 25] }, then: "Overweight" },
                { case: { $eq: ["$_id", 30] }, then: "Obesity I" },
                { case: { $eq: ["$_id", 35] }, then: "Obesity II+" },
              ],
              default: "?",
            },
          },
          patients: 1,
          avgBmi: { $round: ["$avgBmi", 1] },
        },
      },
    ],
  },

  allergyConflicts: {
    title: "Prescriptions conflicting with recorded allergies",
    description: "$lookup joins encounters to the patient's record; $filter crosses prescriptions with allergies. A join across collections, with no FK.",
    collection: COLLECTIONS.encounters,
    stages: () => [
      { $match: { "prescriptions.0": { $exists: true } } },
      { $lookup: { from: COLLECTIONS.records, localField: "patientId", foreignField: "patientId", as: "record" } },
      { $unwind: "$record" },
      { $addFields: { conflicts: { $filter: { input: "$prescriptions", as: "p", cond: { $in: ["$$p.name", "$record.allergies.substance"] } } } } },
      { $match: { "conflicts.0": { $exists: true } } },
      { $project: { _id: 1, patientId: 1, patientName: 1, occurredAt: 1, specialty: 1, professional: "$professional.name", conflicts: "$conflicts.name", allergies: "$record.allergies" } },
      { $sort: { occurredAt: -1 } },
    ],
  },

  topPatients: {
    title: "Patients with the most encounters",
    description: "$lookup with a sub-pipeline: for each record, summarizes the encounters from the other collection.",
    collection: COLLECTIONS.records,
    stages: () => [
      {
        $lookup: {
          from: COLLECTIONS.encounters,
          let: { pid: "$patientId" },
          pipeline: [
            { $match: { $expr: { $eq: ["$patientId", "$$pid"] } } },
            { $group: { _id: null, total: { $sum: 1 }, last: { $max: "$occurredAt" }, specialties: { $addToSet: "$specialty" } } },
          ],
          as: "summaryOfEncounters",
        },
      },
      { $unwind: "$summaryOfEncounters" },
      { $project: { _id: 0, patientId: 1, fullName: 1, healthPlan: 1, age: AGE, conditions: { $size: { $ifNull: ["$chronicConditions", []] } }, total: "$summaryOfEncounters.total", last: "$summaryOfEncounters.last", specialties: "$summaryOfEncounters.specialties" } },
      { $sort: { total: -1, fullName: 1 } },
      { $limit: 10 },
    ],
  },

  fieldsBySpecialty: {
    title: "Clinical fields each specialty records",
    description: "$objectToArray turns clinicalData into key/value pairs: proof that the same collection stores different structures.",
    collection: COLLECTIONS.encounters,
    stages: () => [
      { $project: { specialty: 1, fields: { $objectToArray: "$clinicalData" } } },
      { $unwind: "$fields" },
      { $group: { _id: { specialty: "$specialty", field: "$fields.k" }, total: { $sum: 1 } } },
      { $sort: { total: -1 } },
      { $group: { _id: "$_id.specialty", fields: { $push: { field: "$_id.field", encounters: "$total" } } } },
      { $project: { _id: 0, specialty: "$_id", fields: 1 } },
      { $sort: { specialty: 1 } },
    ],
  },

  severeAllergies: {
    title: "Severe allergies by substance",
    collection: COLLECTIONS.records,
    stages: () => [
      { $unwind: "$allergies" },
      { $match: { "allergies.severity": "SEVERE" } },
      { $group: { _id: "$allergies.substance", patients: { $sum: 1 }, names: { $push: "$fullName" } } },
      { $sort: { patients: -1 } },
      { $project: { _id: 0, substance: "$_id", patients: 1, names: 1 } },
    ],
  },

  bloodPressureTrend: {
    title: "Patient blood pressure trend",
    description: "Reads a nested field that only exists in Cardiology/General Practice encounters.",
    collection: COLLECTIONS.encounters,
    params: ["patientId"],
    stages: ({ patientId }) => [
      { $match: { patientId, "clinicalData.bloodPressure": { $exists: true } } },
      { $sort: { occurredAt: 1 } },
      { $project: { _id: 0, date: "$occurredAt", specialty: "$specialty", systolic: "$clinicalData.bloodPressure.systolic", diastolic: "$clinicalData.bloodPressure.diastolic", heartRate: "$clinicalData.heartRate" } },
    ],
  },
};
