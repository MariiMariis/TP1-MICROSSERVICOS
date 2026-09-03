// /api/medical-records/patients - the "medical record" document (1 per patient).
//
// Shows the embedded-array update operators ($addToSet, $push, $pull) and upsert.
// Every write response also returns the operation sent to Mongo.
import { Router } from "express";
import { records } from "../db.js";
import { badRequest, notFound } from "../errors.js";
import { UNITS } from "../config.js";

export const recordsRouter = Router();

const LIST_PROJECTION = { _id: 1, patientId: 1, cpf: 1, fullName: 1, birthDate: 1, sex: 1, healthPlan: 1, bloodType: 1, preferredUnit: 1, "address.neighborhood": 1, allergies: 1, chronicConditions: 1, summary: 1 };

function parsePatientId(raw) {
  const id = Number(raw);
  if (!Number.isInteger(id) || id < 1) throw badRequest(`Invalid patientId: ${raw}`);
  return id;
}

async function loadOr404(patientId) {
  const doc = await records().findOne({ patientId });
  if (!doc) throw notFound(`Medical record for patient ${patientId} not found`);
  return doc;
}

recordsRouter.get("/", async (req, res) => {
  const page = Math.max(0, Number(req.query.page ?? 0));
  const size = Math.min(200, Math.max(1, Number(req.query.size ?? 20)));
  const filter = {};
  if (req.query.q) filter.fullName = { $regex: String(req.query.q), $options: "i" };
  if (req.query.healthPlan) filter.healthPlan = String(req.query.healthPlan);
  if (req.query.unit) filter.preferredUnit = String(req.query.unit).toUpperCase();
  if (req.query.allergy) filter["allergies.substance"] = String(req.query.allergy);
  if (req.query.icd10) filter["chronicConditions.icd10"] = String(req.query.icd10).toUpperCase();
  if (req.query.neighborhood) filter["address.neighborhood"] = String(req.query.neighborhood);

  const [content, total] = await Promise.all([
    records().find(filter, { projection: LIST_PROJECTION }).sort({ fullName: 1 }).skip(page * size).limit(size).toArray(),
    records().countDocuments(filter),
  ]);
  res.json({ content, page, size, total, totalPages: Math.ceil(total / size), filter });
});

recordsRouter.get("/:patientId", async (req, res) => {
  res.json(await loadOr404(parsePatientId(req.params.patientId)));
});

// Creates or updates the record (used by the front-end right after registering the patient in patient-service).
recordsRouter.put("/:patientId", async (req, res) => {
  const patientId = parsePatientId(req.params.patientId);
  const b = req.body || {};
  for (const f of ["cpf", "fullName", "birthDate", "sex"]) if (!b[f]) throw badRequest(`Required field: ${f}`);
  if (!/^\d{11}$/.test(String(b.cpf))) throw badRequest("cpf must have 11 digits");
  const birthDate = new Date(b.birthDate);
  if (Number.isNaN(birthDate.getTime())) throw badRequest("Invalid birthDate");

  const address = b.address || {};
  const lng = Number(address.longitude ?? address.location?.coordinates?.[0]);
  const lat = Number(address.latitude ?? address.location?.coordinates?.[1]);
  const location = Number.isFinite(lng) && Number.isFinite(lat) ? { type: "Point", coordinates: [lng, lat] } : UNITS[0].location;

  const now = new Date();
  const update = {
    $set: {
      cpf: String(b.cpf), fullName: b.fullName, birthDate, sex: b.sex,
      email: b.email ?? null, phone: b.phone ?? null, healthPlan: b.healthPlan ?? "Private",
      ...(b.bloodType ? { bloodType: b.bloodType } : {}),
      ...(b.heightCm ? { heightCm: Number(b.heightCm) } : {}),
      ...(b.weightKg ? { weightKg: Number(b.weightKg) } : {}),
      address: {
        street: address.street ?? null, number: address.number ?? null, neighborhood: address.neighborhood ?? null,
        city: address.city ?? "Sao Paulo", state: address.state ?? "SP", zipCode: address.zipCode ?? null, location,
      },
      preferredUnit: b.preferredUnit ?? UNITS[0].code,
      updatedAt: now,
    },
    $setOnInsert: { patientId, allergies: [], chronicConditions: [], medications: [], summary: { totalEncounters: 0, lastEncounterAt: null, lastSpecialty: null, specialties: [], byType: {} }, createdAt: now },
  };
  const result = await records().findOneAndUpdate({ patientId }, update, { upsert: true, returnDocument: "after" });
  res.status(201).json({ record: result, mongo: { operation: "findOneAndUpdate(upsert)", filter: { patientId }, update } });
});

async function mutate(res, patientId, update, operation = "updateOne") {
  await loadOr404(patientId);
  const result = await records().findOneAndUpdate({ patientId }, { ...update, $set: { ...(update.$set || {}), updatedAt: new Date() } }, { returnDocument: "after" });
  res.json({ record: result, mongo: { operation, filter: { patientId }, update } });
}

recordsRouter.post("/:patientId/allergies", async (req, res) => {
  const { substance, reaction, severity } = req.body || {};
  if (!substance || !severity) throw badRequest("Provide substance and severity (MILD, MODERATE or SEVERE)");
  await mutate(res, parsePatientId(req.params.patientId), { $addToSet: { allergies: { substance, reaction: reaction ?? null, severity } } });
});

recordsRouter.delete("/:patientId/allergies/:substance", async (req, res) => {
  await mutate(res, parsePatientId(req.params.patientId), { $pull: { allergies: { substance: req.params.substance } } });
});

recordsRouter.post("/:patientId/medications", async (req, res) => {
  const { name, dose, frequency, continuous } = req.body || {};
  if (!name) throw badRequest("Provide name");
  await mutate(res, parsePatientId(req.params.patientId), { $push: { medications: { name, dose: dose ?? null, frequency: frequency ?? null, continuous: continuous !== false } } });
});

recordsRouter.delete("/:patientId/medications/:name", async (req, res) => {
  await mutate(res, parsePatientId(req.params.patientId), { $pull: { medications: { name: req.params.name } } });
});

recordsRouter.post("/:patientId/conditions", async (req, res) => {
  const { icd10, description, since, controlled } = req.body || {};
  if (!icd10 || !description) throw badRequest("Provide icd10 and description");
  const condition = { icd10: String(icd10).toUpperCase(), description, since: since ? new Date(since) : new Date(), controlled: controlled === true };
  await mutate(res, parsePatientId(req.params.patientId), { $addToSet: { chronicConditions: condition } });
});

recordsRouter.delete("/:patientId/conditions/:icd10", async (req, res) => {
  await mutate(res, parsePatientId(req.params.patientId), { $pull: { chronicConditions: { icd10: req.params.icd10.toUpperCase() } } });
});
