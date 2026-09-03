// /api/medical-records/geo - geospatial queries over the 2dsphere index on address.location.
import { Router } from "express";
import { records } from "../db.js";
import { UNITS } from "../config.js";
import { badRequest, notFound } from "../errors.js";

export const geoRouter = Router();

const PATIENT_PROJECTION = { _id: 0, patientId: 1, fullName: 1, healthPlan: 1, preferredUnit: 1, "address.neighborhood": 1, "address.location": 1, allergies: 1, chronicConditions: 1 };

function nearPipeline(coordinates, maxKm, limit, extraMatch = {}) {
  return [
    {
      $geoNear: {
        near: { type: "Point", coordinates },
        key: "address.location",
        distanceField: "distanceM",
        maxDistance: maxKm * 1000,
        spherical: true,
        query: extraMatch,
      },
    },
    { $limit: limit },
    { $project: { ...PATIENT_PROJECTION, distanceKm: { $round: [{ $divide: ["$distanceM", 1000] }, 2] } } },
  ];
}

geoRouter.get("/units", (req, res) => res.json(UNITS));

geoRouter.get("/patients", async (req, res) => {
  res.json(await records().find({}, { projection: PATIENT_PROJECTION }).toArray());
});

async function respondNear(res, coordinates, req, origin) {
  const maxKm = Math.min(50, Math.max(0.1, Number(req.query.maxKm ?? 3)));
  const limit = Math.min(200, Math.max(1, Number(req.query.limit ?? 50)));
  const extraMatch = {};
  if (req.query.icd10) extraMatch["chronicConditions.icd10"] = String(req.query.icd10).toUpperCase();
  if (req.query.allergy) extraMatch["allergies.substance"] = String(req.query.allergy);
  const pipeline = nearPipeline(coordinates, maxKm, limit, extraMatch);
  const started = Date.now();
  const result = await records().aggregate(pipeline).toArray();
  res.json({ origin, maxKm, tookMs: Date.now() - started, total: result.length, pipeline, result });
}

// ?lng=-46.66&lat=-23.56&maxKm=3
geoRouter.get("/near", async (req, res) => {
  const lng = Number(req.query.lng);
  const lat = Number(req.query.lat);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) throw badRequest("Provide lng and lat");
  await respondNear(res, [lng, lat], req, { type: "Point", coordinates: [lng, lat] });
});

geoRouter.get("/near-unit/:code", async (req, res) => {
  const unit = UNITS.find((u) => u.code === req.params.code.toUpperCase());
  if (!unit) throw notFound(`Unit ${req.params.code} does not exist`);
  await respondNear(res, unit.location.coordinates, req, unit);
});

// Coverage: how many patients live within 1, 2, 5 and 10 km of each unit.
geoRouter.get("/coverage", async (req, res) => {
  const started = Date.now();
  const pipelineFor = (unit) => [
    { $geoNear: { near: unit.location, key: "address.location", distanceField: "distanceM", spherical: true } },
    {
      $bucket: {
        groupBy: "$distanceM",
        boundaries: [0, 1000, 2000, 5000, 10000, 1_000_000],
        default: "far",
        output: { patients: { $sum: 1 }, avgDistanceKm: { $avg: { $divide: ["$distanceM", 1000] } } },
      },
    },
    { $project: { _id: 0, withinKm: { $switch: { branches: [{ case: { $eq: ["$_id", 0] }, then: 1 }, { case: { $eq: ["$_id", 1000] }, then: 2 }, { case: { $eq: ["$_id", 2000] }, then: 5 }, { case: { $eq: ["$_id", 5000] }, then: 10 }], default: 999 } }, patients: 1, avgDistanceKm: { $round: ["$avgDistanceKm", 2] } } },
  ];
  const result = await Promise.all(UNITS.map(async (unit) => ({ unit: unit.code, name: unit.name, bands: await records().aggregate(pipelineFor(unit)).toArray() })));
  res.json({ tookMs: Date.now() - started, pipelineExample: pipelineFor(UNITS[0]), result });
});
