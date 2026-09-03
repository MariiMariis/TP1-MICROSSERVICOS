import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { Badge, Card, ErrorBox, Loading, useLoad } from "../components/ui.jsx";
import JsonView from "../components/JsonView.jsx";
import { age, cpfMask, fmtDate, SEVERITY_TONE, UNIT_LABEL } from "../lib/format.js";

const EMPTY = { cpf: "", fullName: "", birthDate: "", sex: "F", email: "", phone: "", healthPlan: "Unimed", bloodType: "O+", heightCm: "", weightKg: "", street: "", number: "", neighborhood: "Pinheiros", zipCode: "", latitude: "-23.5646", longitude: "-46.6917", preferredUnit: "PINHEIROS" };

export default function Patients() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saveLog, setSaveLog] = useState(null);

  // Two sources: the registry in PostgreSQL (patient-service) and the medical record in Mongo (medical-record-service).
  const patients = useLoad(() => api.patients.list());
  const records = useLoad(() => api.records.list({ size: 200 }));

  const byId = useMemo(() => Object.fromEntries((records.data?.content || []).map((p) => [p.patientId, p])), [records.data]);
  const filtered = useMemo(() => {
    const list = patients.data || [];
    const term = q.trim().toLowerCase();
    return term ? list.filter((p) => p.fullName.toLowerCase().includes(term) || p.cpf.includes(term)) : list;
  }, [patients.data, q]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function save(e) {
    e.preventDefault();
    setSaving(true); setSaveError(null); setSaveLog(null);
    const log = [];
    try {
      // 1) registry: the patient's source of truth (PostgreSQL)
      const created = await api.patients.create({ cpf: form.cpf, fullName: form.fullName, birthDate: form.birthDate, email: form.email || null, phone: form.phone || null, healthPlan: form.healthPlan });
      log.push({ step: "patient-service (PostgreSQL)", request: "POST /api/patients", result: created });
      // 2) medical record: Mongo document with the clinical data and the geolocated address
      const rec = await api.records.upsert(created.id, {
        cpf: form.cpf, fullName: form.fullName, birthDate: form.birthDate, sex: form.sex, email: form.email, phone: form.phone, healthPlan: form.healthPlan,
        bloodType: form.bloodType, heightCm: form.heightCm || undefined, weightKg: form.weightKg || undefined, preferredUnit: form.preferredUnit,
        address: { street: form.street, number: form.number ? Number(form.number) : null, neighborhood: form.neighborhood, zipCode: form.zipCode, latitude: Number(form.latitude), longitude: Number(form.longitude) },
      });
      log.push({ step: "medical-record-service (MongoDB Atlas)", request: `PUT /api/medical-records/patients/${created.id}`, result: rec.mongo });
      setSaveLog(log);
      setForm(EMPTY);
      patients.reload(); records.reload();
    } catch (err) {
      setSaveError(err);
      if (log.length) setSaveLog(log);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Patients</h1>
          <p>The registry comes from the <b>patient-service</b> (PostgreSQL); the clinical columns come from the medical record in the <b>medical-record-service</b> (MongoDB). The front-end joins the two sources by patient id, with no join in the database.</p>
        </div>
        <button className="btn primary" onClick={() => setShowForm((s) => !s)}>{showForm ? "Close" : "+ New patient"}</button>
      </div>

      {showForm && (
        <Card title="New patient" subtitle="One registration, two databases: the front-end calls the patient-service and, with the returned id, creates the medical record in Mongo." style={{ marginBottom: 16 }}>
          <form className="form cols-3" onSubmit={save}>
            <div className="field"><label>CPF (11 digits)</label><input required pattern="\d{11}" value={form.cpf} onChange={set("cpf")} /></div>
            <div className="field"><label>Full name</label><input required minLength={3} value={form.fullName} onChange={set("fullName")} /></div>
            <div className="field"><label>Date of birth</label><input required type="date" value={form.birthDate} onChange={set("birthDate")} /></div>
            <div className="field"><label>Sex</label><select value={form.sex} onChange={set("sex")}><option value="F">Female</option><option value="M">Male</option><option value="O">Other</option></select></div>
            <div className="field"><label>E-mail</label><input type="email" value={form.email} onChange={set("email")} /></div>
            <div className="field"><label>Phone</label><input value={form.phone} onChange={set("phone")} /></div>
            <div className="field"><label>Health plan</label><select value={form.healthPlan} onChange={set("healthPlan")}>{["SUS (public)", "Unimed", "Amil", "Bradesco Saude", "SulAmerica", "Private", "Porto Seguro Saude", "NotreDame Intermedica"].map((p) => <option key={p}>{p}</option>)}</select></div>
            <div className="field"><label>Blood type</label><select value={form.bloodType} onChange={set("bloodType")}>{["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((p) => <option key={p}>{p}</option>)}</select></div>
            <div className="field"><label>Preferred unit</label><select value={form.preferredUnit} onChange={set("preferredUnit")}>{Object.entries(UNIT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
            <div className="field"><label>Height (cm)</label><input type="number" value={form.heightCm} onChange={set("heightCm")} /></div>
            <div className="field"><label>Weight (kg)</label><input type="number" value={form.weightKg} onChange={set("weightKg")} /></div>
            <div className="field"><label>Neighborhood</label><input value={form.neighborhood} onChange={set("neighborhood")} /></div>
            <div className="field"><label>Street</label><input value={form.street} onChange={set("street")} /></div>
            <div className="field"><label>Number</label><input type="number" value={form.number} onChange={set("number")} /></div>
            <div className="field"><label>ZIP code</label><input value={form.zipCode} onChange={set("zipCode")} /></div>
            <div className="field"><label>Latitude</label><input type="number" step="0.000001" value={form.latitude} onChange={set("latitude")} /></div>
            <div className="field"><label>Longitude</label><input type="number" step="0.000001" value={form.longitude} onChange={set("longitude")} /></div>
            <div className="field" style={{ justifyContent: "flex-end" }}><button className="btn primary" disabled={saving}>{saving ? "Saving..." : "Register in both services"}</button></div>
          </form>
          <div style={{ marginTop: 12 }}>
            <ErrorBox error={saveError} />
            {saveLog && (
              <div className="stack" style={{ marginTop: 8 }}>
                {saveLog.map((l, i) => (
                  <div key={i}>
                    <div className="row"><Badge tone={i === 0 ? "pg" : "mongo"}>{i + 1}. {l.step}</Badge><code>{l.request}</code></div>
                    <JsonView data={l.result} maxHeight={200} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}

      <Card
        title={`${filtered.length} patients`}
        actions={<><Badge tone="pg">PostgreSQL: registry</Badge><Badge tone="mongo">MongoDB: medical record</Badge></>}
      >
        <div className="toolbar">
          <input className="input" placeholder="Filter by name or CPF" value={q} onChange={(e) => setQ(e.target.value)} />
          {records.error && <span className="badge danger" title={records.error.message}>medical records unavailable</span>}
        </div>
        {patients.loading ? <Loading /> : patients.error ? <ErrorBox error={patients.error} onRetry={patients.reload} /> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>#</th><th>Name</th><th>CPF</th><th className="num">Age</th><th>Health plan</th><th>Unit</th><th>Allergies</th><th>Chronic conditions</th><th className="num">Encounters</th><th>Last</th></tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const r = byId[p.id];
                  return (
                    <tr key={p.id} className="click" onClick={() => navigate(`/patients/${p.id}`)}>
                      <td className="muted">{p.id}</td>
                      <td><b>{p.fullName}</b>{!p.active && <Badge tone="danger">inactive</Badge>}</td>
                      <td className="muted">{cpfMask(p.cpf)}</td>
                      <td className="num">{age(p.birthDate)}</td>
                      <td>{p.healthPlan}</td>
                      <td>{r ? UNIT_LABEL[r.preferredUnit] : <span className="muted">—</span>}</td>
                      <td>{r?.allergies?.length ? r.allergies.map((a) => <Badge key={a.substance} tone={SEVERITY_TONE[a.severity]}>{a.substance}</Badge>) : <span className="muted">none</span>}</td>
                      <td className="small">{r?.chronicConditions?.length ? r.chronicConditions.map((c) => c.icd10).join(", ") : <span className="muted">—</span>}</td>
                      <td className="num">{r?.summary?.totalEncounters ?? <span className="muted">no record</span>}</td>
                      <td className="small">{r?.summary?.lastEncounterAt ? `${fmtDate(r.summary.lastEncounterAt)} · ${r.summary.lastSpecialty}` : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
