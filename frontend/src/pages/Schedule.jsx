import { Fragment, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { Badge, Card, Empty, ErrorBox, Loading, useLoad } from "../components/ui.jsx";
import { CIRCUIT_LABEL, fmtDateTime, STATUS_LABEL, STATUS_TONE } from "../lib/format.js";

const SPECIALTIES = ["Cardiology", "General Practice", "Dermatology", "Endocrinology", "Gynecology", "Ophthalmology", "Orthopedics", "Pediatrics", "Psychiatry"];
// The appointment-service (Java) keeps its Portuguese status enum; the UI shows English labels.
const NEXT = { AGENDADA: ["CONFIRMADA"], CONFIRMADA: ["REALIZADA"], REALIZADA: [], CANCELADA: [] };

function defaultWhen() {
  const d = new Date(Date.now() + 2 * 24 * 3600 * 1000);
  d.setHours(10, 0, 0, 0);
  return d.toISOString().slice(0, 16);
}

export default function Schedule() {
  const appts = useLoad(() => api.appointments.list());
  const patients = useLoad(() => api.patients.list());
  const circuit = useLoad(() => api.appointments.circuit().catch(() => null));
  const [status, setStatus] = useState("");
  const [form, setForm] = useState({ patientId: "", doctorName: "Dr. Helio Vasconcelos", specialty: "Cardiology", scheduledAt: defaultWhen(), notes: "" });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState(null);

  const list = useMemo(() => (appts.data || []).filter((a) => !status || a.status === status).sort((a, b) => new Date(b.scheduledAt) - new Date(a.scheduledAt)), [appts.data, status]);

  async function act(fn) {
    setError(null);
    try { await fn(); appts.reload(); circuit.reload(); } catch (err) { setError(err); }
  }

  async function create(e) {
    e.preventDefault();
    setBusy(true); setError(null); setCreated(null);
    try {
      const r = await api.appointments.create({ ...form, patientId: Number(form.patientId) });
      setCreated(r);
      appts.reload(); circuit.reload();
    } catch (err) { setError(err); } finally { setBusy(false); }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Schedule</h1>
          <p>Appointments live in the <b>appointment-service</b> (PostgreSQL). When scheduling, it calls the <b>patient-service</b> through OpenFeign to confirm the patient, protected by timeout, circuit breaker and fallback.</p>
        </div>
        <div className="row">
          {circuit.data && <Badge tone={circuit.data.estado === "CLOSED" ? "ok" : circuit.data.estado === "HALF_OPEN" ? "warn" : "danger"} title={circuit.data.descricaoDoEstado}>patient-service circuit: {circuit.data.estado}</Badge>}
          <button className="btn sm" onClick={() => act(() => api.appointments.reconcile())}>Reconcile pending</button>
        </div>
      </div>

      <div className="grid cols-3" style={{ marginBottom: 16 }}>
        <Card title="New appointment" className="span-2" actions={<Badge tone="pg">appointment-service → patient-service</Badge>}>
          <form className="form cols-2" onSubmit={create}>
            <div className="field full"><label>Patient</label>
              <select required value={form.patientId} onChange={(e) => setForm({ ...form, patientId: e.target.value })}>
                <option value="">Select...</option>
                {(patients.data || []).map((p) => <option key={p.id} value={p.id}>#{p.id} · {p.fullName}</option>)}
              </select>
            </div>
            <div className="field"><label>Doctor</label><input required value={form.doctorName} onChange={(e) => setForm({ ...form, doctorName: e.target.value })} /></div>
            <div className="field"><label>Specialty</label><select value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })}>{SPECIALTIES.map((s) => <option key={s}>{s}</option>)}</select></div>
            <div className="field"><label>Date and time (future)</label><input required type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} /></div>
            <div className="field"><label>Notes</label><input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            <div className="field full"><button className="btn primary" disabled={busy}>{busy ? "Scheduling..." : "Schedule"}</button></div>
          </form>
          {created && (
            <div className={`alert ${created.patientDataConfirmed ? "info" : "warn"}`} style={{ marginTop: 10 }}>
              Appointment #{created.id} created for <b>{created.patientName}</b>. Patient data {created.patientDataConfirmed ? "confirmed by the patient-service." : "NOT confirmed: the circuit breaker fallback accepted the appointment in degraded mode."}
            </div>
          )}
        </Card>
        <Card title="Resilience" subtitle="Circuit breaker state, appointment-service → patient-service">
          {circuit.data ? (
            <dl className="kv">
              {Object.entries(circuit.data).map(([k, v]) => <Fragment key={k}><dt>{CIRCUIT_LABEL[k] || k}</dt><dd>{typeof v === "object" ? JSON.stringify(v) : String(v)}</dd></Fragment>)}
            </dl>
          ) : <p className="muted small">Resilience endpoint unavailable.</p>}
          <p className="muted small" style={{ marginTop: 10 }}>To simulate an outage: <code>POST /api/patients/simulation/latency?millis=6000</code> and schedule 4 appointments.</p>
        </Card>
      </div>

      <ErrorBox error={error} />

      <Card title={`${list.length} appointments`} actions={<select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option>{Object.keys(NEXT).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select>}>
        {appts.loading ? <Loading /> : appts.error ? <ErrorBox error={appts.error} onRetry={appts.reload} /> : list.length === 0 ? <Empty>No appointments.</Empty> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>#</th><th>When</th><th>Patient</th><th>Doctor</th><th>Specialty</th><th>Status</th><th>Notes</th><th></th></tr></thead>
              <tbody>
                {list.map((a) => (
                  <tr key={a.id}>
                    <td className="muted">{a.id}</td>
                    <td>{fmtDateTime(a.scheduledAt)}</td>
                    <td><Link to={`/patients/${a.patientId}`}>{a.patientName}</Link>{!a.patientDataConfirmed && <Badge tone="warn" title="Circuit breaker fallback">not confirmed</Badge>}</td>
                    <td>{a.doctorName}</td>
                    <td>{a.specialty}</td>
                    <td><Badge tone={STATUS_TONE[a.status]}>{STATUS_LABEL[a.status] || a.status}</Badge></td>
                    <td className="small">{a.notes}</td>
                    <td className="row" style={{ justifyContent: "flex-end" }}>
                      {NEXT[a.status].map((s) => <button key={s} className="btn sm" onClick={() => act(() => api.appointments.changeStatus(a.id, s))}>→ {STATUS_LABEL[s]}</button>)}
                      {["AGENDADA", "CONFIRMADA"].includes(a.status) && <button className="btn sm danger" onClick={() => act(() => api.appointments.cancel(a.id))}>Cancel</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
