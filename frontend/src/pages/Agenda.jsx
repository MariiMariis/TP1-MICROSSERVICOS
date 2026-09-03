import { Fragment, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { Badge, Card, Empty, ErrorBox, Loading, useLoad } from "../components/ui.jsx";
import { fmtDateTime, STATUS_TONE } from "../lib/format.js";

const SPECIALTIES = ["Cardiologia", "Clinica Geral", "Dermatologia", "Endocrinologia", "Ginecologia", "Oftalmologia", "Ortopedia", "Pediatria", "Psiquiatria"];
const NEXT = { AGENDADA: ["CONFIRMADA"], CONFIRMADA: ["REALIZADA"], REALIZADA: [], CANCELADA: [] };

function defaultWhen() {
  const d = new Date(Date.now() + 2 * 24 * 3600 * 1000);
  d.setHours(10, 0, 0, 0);
  return d.toISOString().slice(0, 16);
}

export default function Agenda() {
  const appts = useLoad(() => api.appointments.list());
  const patients = useLoad(() => api.patients.list());
  const circuit = useLoad(() => api.appointments.circuit().catch(() => null));
  const [status, setStatus] = useState("");
  const [form, setForm] = useState({ patientId: "", doctorName: "Dr. Helio Vasconcelos", specialty: "Cardiologia", scheduledAt: defaultWhen(), notes: "" });
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
          <h1>Agenda</h1>
          <p>Consultas vivem no <b>appointment-service</b> (PostgreSQL). Ao agendar, ele chama o <b>patient-service</b> via OpenFeign para confirmar o paciente, protegido por timeout, circuit breaker e fallback.</p>
        </div>
        <div className="row">
          {circuit.data && <Badge tone={circuit.data.estado === "CLOSED" ? "ok" : circuit.data.estado === "HALF_OPEN" ? "warn" : "danger"} title={circuit.data.descricaoDoEstado}>circuito patient-service: {circuit.data.estado}</Badge>}
          <button className="btn sm" onClick={() => act(() => api.appointments.reconcile())}>Reconciliar pendentes</button>
        </div>
      </div>

      <div className="grid cols-3" style={{ marginBottom: 16 }}>
        <Card title="Nova consulta" className="span-2" actions={<Badge tone="pg">appointment-service → patient-service</Badge>}>
          <form className="form cols-2" onSubmit={create}>
            <div className="field full"><label>Paciente</label>
              <select required value={form.patientId} onChange={(e) => setForm({ ...form, patientId: e.target.value })}>
                <option value="">Selecione...</option>
                {(patients.data || []).map((p) => <option key={p.id} value={p.id}>#{p.id} · {p.fullName}</option>)}
              </select>
            </div>
            <div className="field"><label>Medico</label><input required value={form.doctorName} onChange={(e) => setForm({ ...form, doctorName: e.target.value })} /></div>
            <div className="field"><label>Especialidade</label><select value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })}>{SPECIALTIES.map((s) => <option key={s}>{s}</option>)}</select></div>
            <div className="field"><label>Data e hora (futura)</label><input required type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} /></div>
            <div className="field"><label>Observacoes</label><input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            <div className="field full"><button className="btn primary" disabled={busy}>{busy ? "Agendando..." : "Agendar"}</button></div>
          </form>
          {created && (
            <div className={`alert ${created.patientDataConfirmed ? "info" : "warn"}`} style={{ marginTop: 10 }}>
              Consulta #{created.id} criada para <b>{created.patientName}</b>. Dados do paciente {created.patientDataConfirmed ? "confirmados pelo patient-service." : "NAO confirmados: o fallback do circuit breaker aceitou o agendamento em modo degradado."}
            </div>
          )}
        </Card>
        <Card title="Resiliencia" subtitle="Estado do circuit breaker appointment-service → patient-service">
          {circuit.data ? (
            <dl className="kv">
              {Object.entries(circuit.data).map(([k, v]) => <Fragment key={k}><dt>{k}</dt><dd>{typeof v === "object" ? JSON.stringify(v) : String(v)}</dd></Fragment>)}
            </dl>
          ) : <p className="muted small">Endpoint de resiliencia indisponivel.</p>}
          <p className="muted small" style={{ marginTop: 10 }}>Para simular a queda: <code>POST /api/patients/simulation/latency?millis=6000</code> e agende 4 consultas.</p>
        </Card>
      </div>

      <ErrorBox error={error} />

      <Card title={`${list.length} consultas`} actions={<select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Todos os status</option>{Object.keys(NEXT).map((s) => <option key={s}>{s}</option>)}</select>}>
        {appts.loading ? <Loading /> : appts.error ? <ErrorBox error={appts.error} onRetry={appts.reload} /> : list.length === 0 ? <Empty>Nenhuma consulta.</Empty> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>#</th><th>Quando</th><th>Paciente</th><th>Medico</th><th>Especialidade</th><th>Status</th><th>Obs.</th><th></th></tr></thead>
              <tbody>
                {list.map((a) => (
                  <tr key={a.id}>
                    <td className="muted">{a.id}</td>
                    <td>{fmtDateTime(a.scheduledAt)}</td>
                    <td><Link to={`/pacientes/${a.patientId}`}>{a.patientName}</Link>{!a.patientDataConfirmed && <Badge tone="warn" title="Fallback do circuit breaker">nao confirmado</Badge>}</td>
                    <td>{a.doctorName}</td>
                    <td>{a.specialty}</td>
                    <td><Badge tone={STATUS_TONE[a.status]}>{a.status}</Badge></td>
                    <td className="small">{a.notes}</td>
                    <td className="row" style={{ justifyContent: "flex-end" }}>
                      {NEXT[a.status].map((s) => <button key={s} className="btn sm" onClick={() => act(() => api.appointments.changeStatus(a.id, s))}>→ {s}</button>)}
                      {["AGENDADA", "CONFIRMADA"].includes(a.status) && <button className="btn sm danger" onClick={() => act(() => api.appointments.cancel(a.id))}>Cancelar</button>}
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
