// /api/medical-records - the encounters (clinical events), keeping the Delivery 1 contract.
import { Router } from "express";
import { ObjectId } from "mongodb";
import { encounters, records } from "../db.js";
import { RECORD_TYPES, UNITS } from "../config.js";
import { badRequest, notFound } from "../errors.js";

export const encountersRouter = Router();

function parseObjectId(raw) {
  if (!ObjectId.isValid(raw) || String(new ObjectId(raw)) !== raw) throw badRequest(`Invalid id: ${raw}`);
  return new ObjectId(raw);
}

function buildFilter(q) {
  const filter = {};
  if (q.patientId) filter.patientId = Number(q.patientId);
  if (q.specialty) filter.specialty = String(q.specialty);
  if (q.type) filter.recordType = String(q.type).toUpperCase();
  if (q.unit) filter.unit = String(q.unit).toUpperCase();
  if (q.tag) filter.tags = String(q.tag);
  if (q.icd10) filter["diagnosis.icd10"] = String(q.icd10).toUpperCase();
  if (q.professional) filter["professional.name"] = { $regex: String(q.professional), $options: "i" };
  // A query only the document model makes natural: "encounters that HAVE a given measurement".
  if (q.clinicalDataKey) filter[`clinicalData.${q.clinicalDataKey}`] = { $exists: true };
  if (q.from || q.to) {
    filter.occurredAt = {};
    if (q.from) filter.occurredAt.$gte = new Date(q.from);
    if (q.to) filter.occurredAt.$lte = new Date(q.to);
  }
  return filter;
}

encountersRouter.get("/", async (req, res) => {
  const page = Math.max(0, Number(req.query.page ?? 0));
  const size = Math.min(200, Math.max(1, Number(req.query.size ?? 20)));
  const filter = buildFilter(req.query);
  const [content, total] = await Promise.all([
    encounters().find(filter).sort({ occurredAt: -1 }).skip(page * size).limit(size).toArray(),
    encounters().countDocuments(filter),
  ]);
  res.json({ content, page, size, total, totalPages: Math.ceil(total / size), filter });
});

// Clinical timeline: the dominant query of the service, served by the {patientId:1, occurredAt:-1} index.
encountersRouter.get("/patient/:patientId", async (req, res) => {
  const patientId = Number(req.params.patientId);
  if (!Number.isInteger(patientId)) throw badRequest("Invalid patientId");
  const filter = { patientId, ...(req.query.type ? { recordType: String(req.query.type).toUpperCase() } : {}) };
  const timeline = await encounters().find(filter).sort({ occurredAt: -1 }).toArray();
  res.json(timeline);
});

encountersRouter.get("/:id", async (req, res) => {
  const doc = await encounters().findOne({ _id: parseObjectId(req.params.id) });
  if (!doc) throw notFound(`Encounter ${req.params.id} not found`);
  res.json(doc);
});

encountersRouter.post("/", async (req, res) => {
  const b = req.body || {};
  const patientId = Number(b.patientId);
  if (!Number.isInteger(patientId) || patientId < 1) throw badRequest("patientId is required");
  const recordType = String(b.recordType || "").toUpperCase();
  if (!RECORD_TYPES.includes(recordType)) throw badRequest(`recordType must be one of: ${RECORD_TYPES.join(", ")}`);
  if (!b.specialty) throw badRequest("specialty is required");
  const occurredAt = b.occurredAt ? new Date(b.occurredAt) : new Date();
  if (Number.isNaN(occurredAt.getTime())) throw badRequest("Invalid occurredAt");
  if (b.clinicalData !== undefined && (typeof b.clinicalData !== "object" || Array.isArray(b.clinicalData))) throw badRequest("clinicalData must be an object");

  const record = await records().findOne({ patientId }, { projection: { fullName: 1, preferredUnit: 1 } });
  const professional = typeof b.professional === "string" ? { name: b.professional } : (b.professional || { name: "Not informed" });
  const unit = String(b.unit || record?.preferredUnit || UNITS[0].code).toUpperCase();

  const doc = {
    patientId,
    patientName: b.patientName || record?.fullName || `Patient #${patientId}`,
    recordType,
    specialty: b.specialty,
    unit,
    professional,
    occurredAt,
    durationMin: b.durationMin != null ? Number(b.durationMin) : undefined,
    chiefComplaint: b.chiefComplaint,
    notes: b.notes,
    diagnosis: Array.isArray(b.diagnosis) ? b.diagnosis.map((d) => ({ icd10: String(d.icd10).toUpperCase(), description: d.description })) : [],
    tags: Array.isArray(b.tags) ? b.tags.map(String) : [],
    clinicalData: b.clinicalData || {},
    prescriptions: Array.isArray(b.prescriptions) ? b.prescriptions : [],
    attachments: Array.isArray(b.attachments) ? b.attachments : [],
    billing: b.billing,
    createdAt: new Date(),
  };
  for (const k of Object.keys(doc)) if (doc[k] === undefined) delete doc[k];

  const { insertedId } = await encounters().insertOne(doc);

  // Computed pattern: the record summary is maintained by atomic operators, without re-reading the encounters.
  const summaryUpdate = {
    $inc: { "summary.totalEncounters": 1, [`summary.byType.${recordType}`]: 1 },
    $max: { "summary.lastEncounterAt": occurredAt },
    $addToSet: { "summary.specialties": doc.specialty },
    $set: { "summary.lastSpecialty": doc.specialty, updatedAt: new Date() },
  };
  if (record) await records().updateOne({ patientId }, summaryUpdate);

  res.status(201).json({ ...doc, _id: insertedId, mongo: { insertedInto: "encounters", summaryUpdate: record ? summaryUpdate : null } });
});

encountersRouter.delete("/:id", async (req, res) => {
  const _id = parseObjectId(req.params.id);
  const doc = await encounters().findOneAndDelete({ _id });
  if (!doc) throw notFound(`Encounter ${req.params.id} not found`);
  await records().updateOne({ patientId: doc.patientId }, { $inc: { "summary.totalEncounters": -1, [`summary.byType.${doc.recordType}`]: -1 }, $set: { updatedAt: new Date() } });
  res.status(204).end();
});
