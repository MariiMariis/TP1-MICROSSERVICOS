import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../api.js";
import { Badge, Card, Empty, ErrorBox, Loading, Tabs, useLoad } from "../components/ui.jsx";
import JsonView from "../components/JsonView.jsx";
import PipelineViewer from "../components/PipelineViewer.jsx";
import { AtlasExplainButton } from "../components/AtlasExplain.jsx";
import { age, cpfMask, fmtBRL, fmtDate, fmtDateTime, SERIES, SEVERITY_TONE, STATUS_LABEL, STATUS_TONE, TYPE_LABEL, TYPE_TONE, UNIT_LABEL } from "../lib/format.js";
import { buildClinicalData, SPECIALTIES, TEMPLATES } from "../lib/specialtyTemplates.js";

function Timeline({ items }) {
  const [open, setOpen] = useState({});
  if (!items.length) return <Empty>No encounters recorded.</Empty>;
  return (
    <div className="timeline">
      {items.map((a) => (
        <div key={a._id} className="tl-item">
          <div className="when"><b>{fmtDate(a.occurredAt)}</b>{UNIT_LABEL[a.unit] || a.unit}<br />{a.durationMin ? `${a.durationMin} min` : ""}</div>
          <div>
            <div className="title">
              <Badge tone={TYPE_TONE[a.recordType]}>{TYPE_LABEL[a.recordType]}</Badge>
              <b>{a.specialty}</b>
              <span className="muted">{a.professional?.name}</span>
              {a.diagnosis?.map((d) => <span key={d.icd10} className="chip" title={d.description}><code>{d.icd10}</code> {d.description}</span>)}
            </div>
            {a.chiefComplaint && <div className="body"><b>Chief complaint:</b> {a.chiefComplaint}</div>}
            {a.notes && <div className="body">{a.notes}</div>}
            {a.prescriptions?.length > 0 && <div className="body small"><b>Prescription:</b> {a.prescriptions.map((p) => `${p.name} ${p.dose ?? ""} ${p.frequency ?? ""}`).join("; ")}</div>}
            <div className="row" style={{ marginTop: 6 }}>
              <button className="btn sm ghost" onClick={() => setOpen((o) => ({ ...o, [a._id]: !o[a._id] }))}>{open[a._id] ? "Hide" : "View"} clinicalData ({Object.keys(a.clinicalData || {}).length} fields)</button>
              {a.attachments?.length > 0 && <span className="muted small">📎 {a.attachments.map((x) => x.fileName).join(", ")}</span>}
              {a.billing && <span className="muted small">{fmtBRL(a.billing.amount)} · {a.billing.payer}</span>}
            </div>
            {open[a._id] && <div style={{ marginTop: 8 }}><JsonView data={a.clinicalData} maxHeight={320} /></div>}
          </div>
        </div>
      ))}
    </div>
  );
}

function NewEncounter({ patientId, onCreated }) {
  const [specialty, setSpecialty] = useState("Cardiology");
  const [values, setValues] = useState({});
  const [meta, setMeta] = useState({ professional: "", chiefComplaint: "", notes: "", icd10: "", diagnosisDescription: "", tags: "", freeJson: '{\n  "newField": "any structure at all"\n}' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const tpl = TEMPLATES[specialty];

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError(null); setResult(null);
    try {
      const clinicalData = tpl.free ? JSON.parse(meta.freeJson) : buildClinicalData(tpl.fields, values);
      const body = {
        patientId, recordType: tpl.recordType, specialty, professional: meta.professional || "Professional not informed",
        chiefComplaint: meta.chiefComplaint || undefined, notes: meta.notes || undefined,
        diagnosis: meta.icd10 ? [{ icd10: meta.icd10, description: meta.diagnosisDescription || meta.icd10 }] : [],
        tags: meta.tags ? meta.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
        clinicalData,
      };
      const created = await api.encounters.create(body);
      setResult(created);
      setValues({});
      onCreated?.();
    } catch (err) {
      setError(err.message?.startsWith("Unexpected") ? { message: "Invalid JSON: " + err.message } : err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="stack" onSubmit={submit}>
      <div className="form cols-3">
        <div className="field"><label>Specialty (defines the fields)</label><select value={specialty} onChange={(e) => { setSpecialty(e.target.value); setValues({}); }}>{SPECIALTIES.map((s) => <option key={s}>{s}</option>)}</select></div>
        <div className="field"><label>Type</label><input value={tpl.recordType} readOnly /></div>
        <div className="field"><label>Professional</label><input value={meta.professional} onChange={(e) => setMeta({ ...meta, professional: e.target.value })} placeholder="Dr. ..." /></div>
        <div className="field"><label>Chief complaint</label><input value={meta.chiefComplaint} onChange={(e) => setMeta({ ...meta, chiefComplaint: e.target.value })} /></div>
        <div className="field"><label>ICD-10</label><input value={meta.icd10} onChange={(e) => setMeta({ ...meta, icd10: e.target.value.toUpperCase() })} placeholder="I10" pattern="[A-Z][0-9]{2}(\.[0-9]{1,2})?" /></div>
        <div className="field"><label>Diagnosis description</label><input value={meta.diagnosisDescription} onChange={(e) => setMeta({ ...meta, diagnosisDescription: e.target.value })} /></div>
        <div className="field full"><label>Tags (comma separated)</label><input value={meta.tags} onChange={(e) => setMeta({ ...meta, tags: e.target.value })} placeholder="hypertension, follow-up" /></div>
        <div className="field full"><label>Progress notes</label><textarea value={meta.notes} onChange={(e) => setMeta({ ...meta, notes: e.target.value })} /></div>
      </div>
      <h3>clinicalData for {specialty}</h3>
      {tpl.free ? (
        <div className="field"><label>Free JSON (the collection accepts any structure)</label><textarea style={{ minHeight: 140, fontFamily: "monospace" }} value={meta.freeJson} onChange={(e) => setMeta({ ...meta, freeJson: e.target.value })} /></div>
      ) : (
        <div className="form cols-3">
          {tpl.fields.filter((f) => f.type !== "hidden").map((f) => (
            <div className="field" key={f.path}>
              <label>{f.label} <code className="muted">{f.path}</code></label>
              {f.type === "select" ? (
                <select value={values[f.path] ?? f.value} onChange={(e) => setValues({ ...values, [f.path]: e.target.value })}>{f.options.map((o) => <option key={o}>{o}</option>)}</select>
              ) : (
                <input type={f.type} step={f.step} min={f.min} max={f.max} value={values[f.path] ?? f.value} onChange={(e) => setValues({ ...values, [f.path]: e.target.value })} />
              )}
            </div>
          ))}
        </div>
      )}
      <div className="row"><button className="btn primary" disabled={busy}>{busy ? "Saving..." : "Record encounter"}</button></div>
      <ErrorBox error={error} />
      {result && (
        <div>
          <div className="alert info">Document inserted into <b>encounters</b> with _id <code>{result._id}</code>. The record summary was updated with atomic operators ($inc, $max, $addToSet), without re-reading the encounters.</div>
          <JsonView data={result.mongo?.summaryUpdate} maxHeight={200} />
        </div>
      )}
    </form>
  );
}

function EditableList({ title, items, render, onAdd, onRemove, fields }) {
  const [form, setForm] = useState({});
  const [error, setError] = useState(null);
  async function add(e) {
    e.preventDefault(); setError(null);
    try { await onAdd(form); setForm({}); } catch (err) { setError(err); }
  }
  return (
    <div>
      <h3 style={{ marginBottom: 6 }}>{title}</h3>
      <div className="chips" style={{ marginBottom: 8 }}>
        {items.length === 0 && <span className="muted small">none recorded</span>}
        {items.map((it, i) => <span key={i} className="chip">{render(it)}<button type="button" title="Remove ($pull)" onClick={() => onRemove(it)}>×</button></span>)}
      </div>
      <form className="row" onSubmit={add}>
        {fields.map((f) => f.options
          ? <select key={f.name} className="input" style={{ width: "auto" }} value={form[f.name] ?? ""} onChange={(e) => setForm({ ...form, [f.name]: e.target.value })} required={f.required}><option value="">{f.placeholder}</option>{f.options.map((o) => <option key={o}>{o}</option>)}</select>
          : <input key={f.name} className="input" style={{ width: f.width || 150 }} placeholder={f.placeholder} value={form[f.name] ?? ""} onChange={(e) => setForm({ ...form, [f.name]: e.target.value })} required={f.required} />)}
        <button className="btn sm">Add</button>
      </form>
      <ErrorBox error={error} />
    </div>
  );
}

export default function PatientDetail() {
  const { id } = useParams();
  const patientId = Number(id);
  const [tab, setTab] = useState("timeline");
  const [showRaw, setShowRaw] = useState(false);
  const [lastOp, setLastOp] = useState(null);

  const patient = useLoad(() => api.patients.get(patientId), [patientId]);
  const rec = useLoad(() => api.records.get(patientId), [patientId]);
  const timeline = useLoad(() => api.encounters.timeline(patientId), [patientId]);
  const appts = useLoad(() => api.appointments.list({ patientId }).catch(() => []), [patientId]);
  const bp = useLoad(() => api.analytics.run("bloodPressureTrend", { patientId }), [patientId]);

  const r = rec.data;
  const wrap = (fn) => async (...args) => { const res = await fn(...args); setLastOp(res.mongo); rec.reload(); };

  return (
    <>
      <div className="page-head">
        <div>
          <div className="row" style={{ marginBottom: 4 }}><Link to="/patients">← Patients</Link></div>
          <h1>{patient.data?.fullName || r?.fullName || `Patient #${patientId}`}</h1>
          <p className="row">
            {patient.data && <>{cpfMask(patient.data.cpf)} · {age(patient.data.birthDate)} years old · {patient.data.healthPlan}</>}
            {r && <><Badge>{r.bloodType}</Badge><Badge>{UNIT_LABEL[r.preferredUnit]}</Badge><Badge tone="mongo">{r.summary?.totalEncounters ?? 0} encounters</Badge></>}
          </p>
        </div>
        <div className="row"><button className="btn sm" onClick={() => setShowRaw((s) => !s)}>{showRaw ? "Hide" : "View"} raw record document</button></div>
      </div>

      {showRaw && r && <Card title="medical_records → findOne({ patientId })" subtitle="A single document with everything embedded: GeoJSON address, allergies, conditions, medications and the computed summary." style={{ marginBottom: 16 }}><JsonView data={r} maxHeight={520} /></Card>}

      <div className="grid cols-2" style={{ marginBottom: 16 }}>
        <Card title="Registry" actions={<Badge tone="pg">patient-service · PostgreSQL</Badge>}>
          {patient.loading ? <Loading /> : patient.error ? <ErrorBox error={patient.error} onRetry={patient.reload} /> : (
            <dl className="kv">
              <dt>Name</dt><dd>{patient.data.fullName}</dd>
              <dt>CPF</dt><dd>{cpfMask(patient.data.cpf)}</dd>
              <dt>Date of birth</dt><dd>{fmtDate(patient.data.birthDate)} ({age(patient.data.birthDate)} years old)</dd>
              <dt>E-mail</dt><dd>{patient.data.email || "—"}</dd>
              <dt>Phone</dt><dd>{patient.data.phone || "—"}</dd>
              <dt>Health plan</dt><dd>{patient.data.healthPlan}</dd>
              <dt>Status</dt><dd>{patient.data.active ? <Badge tone="ok">active</Badge> : <Badge tone="danger">inactive</Badge>}</dd>
            </dl>
          )}
        </Card>

        <Card title="Medical record" subtitle="Embedded arrays edited with $addToSet / $push / $pull" actions={<Badge tone="mongo">medical-record-service · MongoDB Atlas</Badge>}>
          {rec.loading ? <Loading /> : rec.error ? <ErrorBox error={rec.error} onRetry={rec.reload} /> : (
            <div className="stack">
              <dl className="kv">
                <dt>Address</dt><dd>{r.address?.street}, {r.address?.number} · {r.address?.neighborhood} · <span className="muted small">[{r.address?.location?.coordinates?.join(", ")}]</span></dd>
                <dt>Biometrics</dt><dd>{r.heightCm} cm · {r.weightKg} kg{r.heightCm && r.weightKg ? ` · BMI ${(r.weightKg / (r.heightCm / 100) ** 2).toFixed(1)}` : ""}</dd>
                <dt>Emergency contact</dt><dd>{r.emergencyContact ? `${r.emergencyContact.name} (${r.emergencyContact.relationship}) ${r.emergencyContact.phone}` : "—"}</dd>
              </dl>
              <EditableList title="Allergies" items={r.allergies || []} render={(a) => <><Badge tone={SEVERITY_TONE[a.severity]}>{a.severity}</Badge> {a.substance}{a.reaction ? ` · ${a.reaction}` : ""}</>}
                fields={[{ name: "substance", placeholder: "Substance", required: true }, { name: "reaction", placeholder: "Reaction" }, { name: "severity", placeholder: "Severity", options: ["MILD", "MODERATE", "SEVERE"], required: true }]}
                onAdd={wrap((f) => api.records.addAllergy(patientId, f))} onRemove={wrap((a) => api.records.removeAllergy(patientId, a.substance))} />
              <EditableList title="Chronic conditions" items={r.chronicConditions || []} render={(c) => <><code>{c.icd10}</code> {c.description} <span className="muted">since {fmtDate(c.since)}</span></>}
                fields={[{ name: "icd10", placeholder: "ICD-10", width: 90, required: true }, { name: "description", placeholder: "Description", width: 220, required: true }, { name: "since", placeholder: "YYYY-MM-DD", width: 120 }]}
                onAdd={wrap((f) => api.records.addCondition(patientId, f))} onRemove={wrap((c) => api.records.removeCondition(patientId, c.icd10))} />
              <EditableList title="Continuous-use medications" items={r.medications || []} render={(m) => <>{m.name} {m.dose} <span className="muted">{m.frequency}</span></>}
                fields={[{ name: "name", placeholder: "Medication", required: true }, { name: "dose", placeholder: "Dose", width: 90 }, { name: "frequency", placeholder: "Frequency", width: 120 }]}
                onAdd={wrap((f) => api.records.addMedication(patientId, f))} onRemove={wrap((m) => api.records.removeMedication(patientId, m.name))} />
              {lastOp && <details className="pipeline"><summary>Last operation sent to Mongo ({lastOp.operation})</summary><JsonView data={{ filter: lastOp.filter, update: lastOp.update }} maxHeight={220} /></details>}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <Tabs active={tab} onChange={setTab} tabs={[{ id: "timeline", label: `Timeline (${timeline.data?.length ?? "…"})` }, { id: "new", label: "New encounter" }, { id: "schedule", label: `Appointments (${appts.data?.length ?? "…"})` }, { id: "bp", label: "Blood pressure" }]} />
        {tab === "timeline" && (timeline.loading ? <Loading /> : timeline.error ? <ErrorBox error={timeline.error} onRetry={timeline.reload} /> : (
          <>
            <p className="muted small" style={{ marginBottom: 10 }}>db.encounters.find({"{"} patientId: {patientId} {"}"}).sort({"{"} occurredAt: -1 {"}"}) — a single read, served by the compound index idx_patient_occurred, each document with its own structure.</p>
            <Timeline items={timeline.data} />
          </>
        ))}
        {tab === "new" && <NewEncounter patientId={patientId} onCreated={() => { timeline.reload(); rec.reload(); bp.reload(); }} />}
        {tab === "schedule" && (appts.loading ? <Loading /> : (
          !appts.data?.length ? <Empty>No appointments scheduled. <Link to="/schedule">Schedule one</Link></Empty> : (
            <div className="table-wrap"><table><thead><tr><th>When</th><th>Doctor</th><th>Specialty</th><th>Status</th><th>Notes</th></tr></thead>
              <tbody>{appts.data.map((a) => <tr key={a.id}><td>{fmtDateTime(a.scheduledAt)}</td><td>{a.doctorName}</td><td>{a.specialty}</td><td><Badge tone={STATUS_TONE[a.status]}>{STATUS_LABEL[a.status] || a.status}</Badge></td><td className="small">{a.notes}</td></tr>)}</tbody></table></div>
          )
        ))}
        {tab === "bp" && (bp.loading ? <Loading /> : bp.error ? <ErrorBox error={bp.error} /> : (
          <>
            {bp.data.result.length === 0 ? <Empty>No encounter with blood pressure recorded in clinicalData.</Empty> : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={bp.data.result.map((d) => ({ ...d, date: fmtDate(d.date) }))} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#eef0f3" />
                  <XAxis dataKey="date" tick={{ fontSize: 12, fill: "#7b8794" }} tickLine={false} axisLine={false} />
                  <YAxis domain={[50, 180]} tick={{ fontSize: 12, fill: "#7b8794" }} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="systolic" name="Systolic (mmHg)" stroke={SERIES[0]} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: "#fff" }} />
                  <Line type="monotone" dataKey="diastolic" name="Diastolic (mmHg)" stroke={SERIES[1]} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: "#fff" }} />
                </LineChart>
              </ResponsiveContainer>
            )}
            <div className="row" style={{ marginTop: 10 }}><AtlasExplainButton report={bp.data} params={{ patientId }} /><span className="muted small">Point query: notice that here the server uses the index, unlike the dashboard analyses.</span></div>
            <PipelineViewer report={bp.data} />
          </>
        ))}
      </Card>
    </>
  );
}
