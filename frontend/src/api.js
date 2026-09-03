// Front-end HTTP client. Everything goes through the api-gateway (port 8080): in development
// Vite proxies /api, in production just point VITE_API_BASE at the gateway.
const BASE = import.meta.env.VITE_API_BASE || "/api";

export class ApiError extends Error {
  constructor(status, body, path) {
    super(body?.message || body?.error || `HTTP ${status}`);
    this.status = status;
    this.body = body;
    this.path = path;
  }
}

async function request(path, { method = "GET", body, params } = {}) {
  const url = new URL(BASE + path, window.location.origin);
  if (params) for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
  const res = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined });
  if (res.status === 204) return null;
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { message: text }; }
  if (!res.ok) throw new ApiError(res.status, data, path);
  return data;
}

const get = (path, params) => request(path, { params });
const post = (path, body, params) => request(path, { method: "POST", body, params });
const put = (path, body) => request(path, { method: "PUT", body });
const patch = (path, params) => request(path, { method: "PATCH", params });
const del = (path) => request(path, { method: "DELETE" });

const MR = "/medical-records";

export const api = {
  // patient-service (PostgreSQL)
  patients: {
    list: (name) => get("/patients", { name }),
    get: (id) => get(`/patients/${id}`),
    create: (body) => post("/patients", body),
    update: (id, body) => put(`/patients/${id}`, body),
    deactivate: (id) => del(`/patients/${id}`),
  },
  // appointment-service (PostgreSQL) - calls patient-service with a circuit breaker
  appointments: {
    list: (params) => get("/appointments", params),
    create: (body) => post("/appointments", body),
    changeStatus: (id, status) => patch(`/appointments/${id}/status`, { status }),
    cancel: (id) => patch(`/appointments/${id}/cancel`),
    reconcile: () => post("/appointments/reconcile"),
    circuit: () => get("/appointments/resilience/circuit-breaker"),
  },
  // medical-record-service (MongoDB Atlas)
  encounters: {
    list: (params) => get(MR, params),
    get: (id) => get(`${MR}/${id}`),
    timeline: (patientId, type) => get(`${MR}/patient/${patientId}`, { type }),
    create: (body) => post(MR, body),
    remove: (id) => del(`${MR}/${id}`),
  },
  records: {
    list: (params) => get(`${MR}/patients`, params),
    get: (patientId) => get(`${MR}/patients/${patientId}`),
    upsert: (patientId, body) => put(`${MR}/patients/${patientId}`, body),
    addAllergy: (patientId, body) => post(`${MR}/patients/${patientId}/allergies`, body),
    removeAllergy: (patientId, substance) => del(`${MR}/patients/${patientId}/allergies/${encodeURIComponent(substance)}`),
    addMedication: (patientId, body) => post(`${MR}/patients/${patientId}/medications`, body),
    removeMedication: (patientId, name) => del(`${MR}/patients/${patientId}/medications/${encodeURIComponent(name)}`),
    addCondition: (patientId, body) => post(`${MR}/patients/${patientId}/conditions`, body),
    removeCondition: (patientId, icd10) => del(`${MR}/patients/${patientId}/conditions/${encodeURIComponent(icd10)}`),
  },
  search: {
    query: (q, params) => get(`${MR}/search`, { q, ...params }),
    autocomplete: (q) => get(`${MR}/search/autocomplete`, { q }),
    status: () => get(`${MR}/search/status`),
  },
  analytics: {
    dashboard: () => get(`${MR}/analytics/dashboard`),
    list: () => get(`${MR}/analytics`),
    run: (key, params) => get(`${MR}/analytics/${key}`, params),
    explain: (key, params) => get(`${MR}/analytics/${key}/explain`, params),
  },
  geo: {
    units: () => get(`${MR}/geo/units`),
    patients: () => get(`${MR}/geo/patients`),
    near: (lng, lat, params) => get(`${MR}/geo/near`, { lng, lat, ...params }),
    nearUnit: (code, params) => get(`${MR}/geo/near-unit/${code}`, params),
    coverage: () => get(`${MR}/geo/coverage`),
  },
  admin: {
    overview: () => get(`${MR}/admin/overview`),
    indexes: () => get(`${MR}/admin/indexes`),
    schema: () => get(`${MR}/admin/schema`),
    explain: (params) => get(`${MR}/admin/explain`, params),
    validationDemo: (body, collection) => post(`${MR}/admin/validation-demo`, body, { collection }),
    seed: (force) => post(`${MR}/admin/seed`, undefined, { force }),
    sample: (collection, params) => get(`${MR}/admin/sample/${collection}`, params),
    searchIndexes: () => get(`${MR}/admin/search-indexes`),
    createSearchIndexes: () => post(`${MR}/admin/search-indexes`),
  },
};
