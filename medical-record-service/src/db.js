// MongoDB Atlas connection, collection schema validation, indexes and Atlas Search indexes.
//
// Everything the database "knows" about the domain is declared here: the document-world
// equivalent of a relational DDL, except optional and evolutionary.
import dns from "node:dns";
import { MongoClient } from "mongodb";
import { config, COLLECTIONS, RECORD_TYPES, UNITS } from "./config.js";

let client;
let db;

// Atlas Search state: null = not tried yet, true/false after the first query.
export const searchState = { available: null, reason: null };

export function isAtlas() {
  return /mongodb\.net/i.test(config.mongoUri);
}

// mongodb+srv:// depends on a DNS SRV lookup. On some networks the system resolver (e.g. an
// IPv6 link-local router) does not answer SRV queries for Node, and the connection fails with
// "querySrv ECONNREFUSED" even though the internet works. In that case we use public resolvers.
async function ensureSrvResolvable(uri) {
  if (!uri.startsWith("mongodb+srv://")) return;
  const host = new URL(uri).hostname;
  try {
    await dns.promises.resolveSrv(`_mongodb._tcp.${host}`);
  } catch (err) {
    const servers = (process.env.DNS_SERVERS || "8.8.8.8,1.1.1.1").split(",").map((s) => s.trim()).filter(Boolean);
    console.warn(`[db] system DNS resolver (${dns.getServers().join(", ")}) did not answer the SRV query (${err.code}); using ${servers.join(", ")}`);
    dns.setServers(servers);
  }
}

export async function connect() {
  await ensureSrvResolvable(config.mongoUri);
  client = new MongoClient(config.mongoUri, {
    serverSelectionTimeoutMS: 10_000,
    appName: config.appName,
  });
  await client.connect();
  db = client.db(config.mongoDb);
  await db.command({ ping: 1 });
  return db;
}

export function getDb() {
  if (!db) throw new Error("Database not connected yet");
  return db;
}

export const records = () => getDb().collection(COLLECTIONS.records);
export const encounters = () => getDb().collection(COLLECTIONS.encounters);

export async function close() {
  await client?.close();
}

// ------------------------------------------------------------------ Schema validation
//
// MongoDB is "flexible schema", not "schemaless": a collection can declare a $jsonSchema
// that the server enforces on every write. Here we validate what is invariant (patient
// identity, types, enums, GeoJSON) and leave free exactly what varies by specialty (clinicalData).

const GEO_POINT = {
  bsonType: "object",
  required: ["type", "coordinates"],
  properties: {
    type: { enum: ["Point"] },
    coordinates: {
      bsonType: "array",
      minItems: 2,
      maxItems: 2,
      items: { bsonType: ["double", "int"] },
      description: "[longitude, latitude] - the order required by GeoJSON",
    },
  },
};

export const RECORD_SCHEMA = {
  $jsonSchema: {
    bsonType: "object",
    title: "Patient medical record",
    required: ["patientId", "cpf", "fullName", "birthDate", "sex", "address", "createdAt"],
    properties: {
      patientId: { bsonType: ["int", "long"], minimum: 1, description: "patient id in patient-service (PostgreSQL). No FK: a logical cross-service reference." },
      cpf: { bsonType: "string", pattern: "^[0-9]{11}$" },
      fullName: { bsonType: "string", minLength: 3, maxLength: 150 },
      birthDate: { bsonType: "date" },
      sex: { enum: ["F", "M", "O"] },
      bloodType: { enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] },
      heightCm: { bsonType: ["int", "double"], minimum: 30, maximum: 250 },
      weightKg: { bsonType: ["int", "double"], minimum: 1, maximum: 400 },
      healthPlan: { bsonType: "string" },
      preferredUnit: { enum: UNITS.map((u) => u.code) },
      address: {
        bsonType: "object",
        required: ["city", "location"],
        properties: { city: { bsonType: "string" }, location: GEO_POINT },
      },
      allergies: {
        bsonType: "array",
        items: {
          bsonType: "object",
          required: ["substance", "severity"],
          properties: { substance: { bsonType: "string" }, reaction: { bsonType: "string" }, severity: { enum: ["MILD", "MODERATE", "SEVERE"] } },
        },
      },
      chronicConditions: {
        bsonType: "array",
        items: {
          bsonType: "object",
          required: ["icd10", "description"],
          properties: { icd10: { bsonType: "string", pattern: "^[A-Z][0-9]{2}(\\.[0-9]{1,2})?$" }, description: { bsonType: "string" }, since: { bsonType: "date" }, controlled: { bsonType: "bool" } },
        },
      },
      medications: {
        bsonType: "array",
        items: { bsonType: "object", required: ["name"], properties: { name: { bsonType: "string" }, dose: { bsonType: "string" }, frequency: { bsonType: "string" }, continuous: { bsonType: "bool" } } },
      },
      summary: { bsonType: "object", description: "Derived fields (computed pattern), updated on every encounter" },
      createdAt: { bsonType: "date" },
      updatedAt: { bsonType: "date" },
    },
  },
};

export const ENCOUNTER_SCHEMA = {
  $jsonSchema: {
    bsonType: "object",
    title: "Encounter (clinical event)",
    required: ["patientId", "recordType", "specialty", "occurredAt", "clinicalData", "createdAt"],
    properties: {
      patientId: { bsonType: ["int", "long"], minimum: 1 },
      patientName: { bsonType: "string" },
      recordType: { enum: RECORD_TYPES },
      specialty: { bsonType: "string", minLength: 3 },
      unit: { enum: UNITS.map((u) => u.code) },
      professional: { bsonType: "object", required: ["name"], properties: { name: { bsonType: "string" }, license: { bsonType: "string" } } },
      occurredAt: { bsonType: "date" },
      durationMin: { bsonType: ["int", "double"], minimum: 0 },
      chiefComplaint: { bsonType: "string" },
      notes: { bsonType: "string" },
      diagnosis: {
        bsonType: "array",
        items: { bsonType: "object", required: ["icd10", "description"], properties: { icd10: { bsonType: "string", pattern: "^[A-Z][0-9]{2}(\\.[0-9]{1,2})?$" }, description: { bsonType: "string" } } },
      },
      tags: { bsonType: "array", items: { bsonType: "string" } },
      clinicalData: { bsonType: "object", description: "Free structure: each specialty stores the fields that make sense for it" },
      prescriptions: { bsonType: "array", items: { bsonType: "object", required: ["name"] } },
      attachments: { bsonType: "array", items: { bsonType: "object", required: ["fileName"] } },
      billing: { bsonType: "object", properties: { amount: { bsonType: ["double", "int"], minimum: 0 }, payer: { bsonType: "string" } } },
      createdAt: { bsonType: "date" },
    },
  },
};

async function ensureCollection(name, validator) {
  const existing = await getDb().listCollections({ name }).toArray();
  if (existing.length === 0) {
    await getDb().createCollection(name, { validator, validationLevel: "strict", validationAction: "error" });
    console.log(`[db] collection ${name} created with schema validation`);
  } else {
    await getDb().command({ collMod: name, validator, validationLevel: "strict", validationAction: "error" });
  }
}

// ------------------------------------------------------------------ Indexes

export const INDEXES = {
  [COLLECTIONS.records]: [
    { key: { patientId: 1 }, options: { name: "uk_patient_id", unique: true } },
    { key: { cpf: 1 }, options: { name: "uk_cpf", unique: true } },
    { key: { fullName: 1 }, options: { name: "idx_full_name" } },
    { key: { "address.location": "2dsphere" }, options: { name: "geo_address_location" } },
    { key: { "allergies.substance": 1 }, options: { name: "idx_allergy_substance" } },
    { key: { "chronicConditions.icd10": 1 }, options: { name: "idx_condition_icd10" } },
    { key: { healthPlan: 1 }, options: { name: "idx_health_plan" } },
  ],
  [COLLECTIONS.encounters]: [
    // The most important index of the service: serves the patient timeline (dominant query).
    { key: { patientId: 1, occurredAt: -1 }, options: { name: "idx_patient_occurred" } },
    { key: { specialty: 1, occurredAt: -1 }, options: { name: "idx_specialty_occurred" } },
    { key: { unit: 1, occurredAt: -1 }, options: { name: "idx_unit_occurred" } },
    { key: { occurredAt: -1 }, options: { name: "idx_occurred" } },
    { key: { recordType: 1 }, options: { name: "idx_record_type" } },
    { key: { tags: 1 }, options: { name: "idx_tags" } },
    { key: { "diagnosis.icd10": 1 }, options: { name: "idx_diagnosis_icd10" } },
  ],
};

// ------------------------------------------------------------------ Atlas Search
//
// Search indexes live in Atlas' Lucene, outside mongod. They are created via the driver
// (createSearchIndexes). If the cluster refuses, the definition below can be pasted into the
// Atlas UI (Search > Create Index > JSON Editor).

// Two analyzers on the same field: the standard one (no stemming) serves fuzzy matching
// ("diabetis" ~ "diabetes"); the English one matches inflections ("headaches" ~ "headache").
const TEXT_EN = { type: "string", analyzer: "lucene.standard", multi: { en: { type: "string", analyzer: "lucene.english" } } };

export const SEARCH_INDEXES = {
  [COLLECTIONS.encounters]: {
    name: "encounters_search",
    definition: {
      mappings: {
        dynamic: false,
        fields: {
          patientName: [
            { type: "string", analyzer: "lucene.standard" },
            { type: "autocomplete", tokenization: "edgeGram", minGrams: 2, maxGrams: 15, foldDiacritics: true },
          ],
          chiefComplaint: TEXT_EN,
          notes: TEXT_EN,
          specialty: [{ type: "string" }, { type: "stringFacet" }],
          recordType: [{ type: "string" }, { type: "stringFacet" }],
          unit: { type: "stringFacet" },
          tags: { type: "string" },
          professional: { type: "document", fields: { name: { type: "string" } } },
          diagnosis: { type: "document", fields: { icd10: { type: "string" }, description: TEXT_EN } },
          occurredAt: { type: "date" },
        },
      },
    },
  },
  [COLLECTIONS.records]: {
    name: "records_search",
    definition: {
      mappings: {
        dynamic: false,
        fields: {
          fullName: [
            { type: "string", analyzer: "lucene.standard" },
            { type: "autocomplete", tokenization: "edgeGram", minGrams: 2, maxGrams: 15, foldDiacritics: true },
          ],
          cpf: { type: "string" },
          healthPlan: { type: "stringFacet" },
          address: { type: "document", fields: { neighborhood: [{ type: "string" }, { type: "stringFacet" }] } },
          allergies: { type: "document", fields: { substance: { type: "string" } } },
          chronicConditions: { type: "document", fields: { description: { type: "string", analyzer: "lucene.english" }, icd10: { type: "string" } } },
          medications: { type: "document", fields: { name: { type: "string" } } },
        },
      },
    },
  },
};

export async function ensureSearchIndexes() {
  const report = [];
  for (const [collection, spec] of Object.entries(SEARCH_INDEXES)) {
    try {
      const existing = await getDb().collection(collection).listSearchIndexes().toArray();
      const current = existing.find((i) => i.name === spec.name);
      if (current) {
        if (JSON.stringify(current.latestDefinition?.mappings) !== JSON.stringify(spec.definition.mappings)) {
          await getDb().collection(collection).updateSearchIndex(spec.name, spec.definition);
          report.push({ collection, name: spec.name, status: "definition updated (reindexing)" });
        } else {
          report.push({ collection, name: spec.name, status: "already existed" });
        }
        continue;
      }
      await getDb().collection(collection).createSearchIndex({ name: spec.name, definition: spec.definition });
      report.push({ collection, name: spec.name, status: "created (takes ~1 min to become active)" });
    } catch (err) {
      report.push({ collection, name: spec.name, status: "not supported here", reason: err.message });
    }
  }
  return report;
}

export async function ensureSchema() {
  await ensureCollection(COLLECTIONS.records, RECORD_SCHEMA);
  await ensureCollection(COLLECTIONS.encounters, ENCOUNTER_SCHEMA);
  for (const [collection, indexes] of Object.entries(INDEXES)) {
    for (const { key, options } of indexes) {
      await getDb().collection(collection).createIndex(key, options);
    }
  }
  console.log("[db] schema validation and indexes ensured");
}

export async function serverInfo() {
  const build = await getDb().admin().command({ buildInfo: 1 });
  return { version: build.version, atlas: isAtlas(), database: config.mongoDb };
}
