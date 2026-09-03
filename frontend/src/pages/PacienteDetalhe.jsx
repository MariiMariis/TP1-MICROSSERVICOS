import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../api.js";
import { Badge, Card, Empty, ErrorBox, Loading, Tabs, useLoad } from "../components/ui.jsx";
import JsonView from "../components/JsonView.jsx";
import PipelineViewer from "../components/PipelineViewer.jsx";
import { AtlasExplainButton } from "../components/AtlasExplain.jsx";
import { age, cpfMask, fmtBRL, fmtDate, fmtDateTime, SERIES, SEVERITY_TONE, STATUS_TONE, TYPE_LABEL, TYPE_TONE, UNIT_LABEL } from "../lib/format.js";
import { buildClinicalData, SPECIALTIES, TEMPLATES } from "../lib/specialtyTemplates.js";

function Timeline({ items }) {
  const [open, setOpen] = useState({});
  if (!items.length) return <Empty>Nenhum atendimento registrado.</Empty>;
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
              {a.diagnosis?.map((d) => <span key={d.cid10} className="chip" title={d.description}><code>{d.cid10}</code> {d.description}</span>)}
            </div>
            {a.chiefComplaint && <div className="body"><b>Queixa:</b> {a.chiefComplaint}</div>}
            {a.notes && <div className="body">{a.notes}</div>}
            {a.prescriptions?.length > 0 && <div className="body small"><b>Prescricao:</b> {a.prescriptions.map((p) => `${p.name} ${p.dose ?? ""} ${p.frequency ?? ""}`).join("; ")}</div>}
            <div className="row" style={{ marginTop: 6 }}>
              <button className="btn sm ghost" onClick={() => setOpen((o) => ({ ...o, [a._id]: !o[a._id] }))}>{open[a._id] ? "Ocultar" : "Ver"} clinicalData ({Object.keys(a.clinicalData || {}).length} campos)</button>
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

function NovoAtendimento({ patientId, onCreated }) {
  const [specialty, setSpecialty] = useState("Cardiologia");
  const [values, setValues] = useState({});
  const [meta, setMeta] = useState({ professional: "", chiefComplaint: "", notes: "", cid10: "", diagnosisDescription: "", tags: "", freeJson: '{\n  "campoNovo": "qualquer estrutura"\n}' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const tpl = TEMPLATES[specialty];

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError(null); setResult(null);
    try {
      let clinicalData;
      if (tpl.free) {
        clinicalData = JSON.parse(meta.freeJson);
      } else {
        clinicalData = buildClinicalData(tpl.fields, values);
      }
      const body = {
        patientId, recordType: tpl.recordType, specialty, professional: meta.professional || "Profissional nao informado",
        chiefComplaint: meta.chiefComplaint || undefined, notes: meta.notes || undefined,
        diagnosis: meta.cid10 ? [{ cid10: meta.cid10, description: meta.diagnosisDescription || meta.cid10 }] : [],
        tags: meta.tags ? meta.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
        clinicalData,
      };
      const created = await api.records.create(body);
      setResult(created);
      setValues({});
      onCreated?.();
    } catch (err) {
      setError(err.message?.startsWith("Unexpected") ? { message: "JSON invalido: " + err.message } : err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="stack" onSubmit={submit}>
      <div className="form cols-3">
        <div className="field"><label>Especialidade (define os campos)</label><select value={specialty} onChange={(e) => { setSpecialty(e.target.value); setValues({}); }}>{SPECIALTIES.map((s) => <option key={s}>{s}</option>)}</select></div>
        <div className="field"><label>Tipo</label><input value={tpl.recordType} readOnly /></div>
        <div className="field"><label>Profissional</label><input value={meta.professional} onChange={(e) => setMeta({ ...meta, professional: e.target.value })} placeholder="Dr(a). ..." /></div>
        <div className="field"><label>Queixa principal</label><input value={meta.chiefComplaint} onChange={(e) => setMeta({ ...meta, chiefComplaint: e.target.value })} /></div>
        <div className="field"><label>CID-10</label><input value={meta.cid10} onChange={(e) => setMeta({ ...meta, cid10: e.target.value.toUpperCase() })} placeholder="I10" pattern="[A-Z][0-9]{2}(\.[0-9]{1,2})?" /></div>
        <div className="field"><label>Descricao do diagnostico</label><input value={meta.diagnosisDescription} onChange={(e) => setMeta({ ...meta, diagnosisDescription: e.target.value })} /></div>
        <div className="field full"><label>Tags (separadas por virgula)</label><input value={meta.tags} onChange={(e) => setMeta({ ...meta, tags: e.target.value })} placeholder="hipertensao, retorno" /></div>
        <div className="field full"><label>Evolucao / notas</label><textarea value={meta.notes} onChange={(e) => setMeta({ ...meta, notes: e.target.value })} /></div>
      </div>
      <h3>clinicalData de {specialty}</h3>
      {tpl.free ? (
        <div className="field"><label>JSON livre (qualquer estrutura e aceita pela colecao)</label><textarea style={{ minHeight: 140, fontFamily: "monospace" }} value={meta.freeJson} onChange={(e) => setMeta({ ...meta, freeJson: e.target.value })} /></div>
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
      <div className="row"><button className="btn primary" disabled={busy}>{busy ? "Gravando..." : "Registrar atendimento"}</button></div>
      <ErrorBox error={error} />
      {result && (
        <div>
          <div className="alert info">Documento inserido em <b>atendimentos</b> com _id <code>{result._id}</code>. O resumo do prontuario foi atualizado com operadores atomicos ($inc, $max, $addToSet), sem reler os atendimentos.</div>
          <JsonView data={result.mongo?.summaryUpdate} maxHeight={200} />
        </div>
      )}
    </form>
  );
}

function ListaEditavel({ title, items, render, onAdd, onRemove, fields }) {
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
        {items.length === 0 && <span className="muted small">nenhum registro</span>}
        {items.map((it, i) => <span key={i} className="chip">{render(it)}<button type="button" title="Remover ($pull)" onClick={() => onRemove(it)}>×</button></span>)}
      </div>
      <form className="row" onSubmit={add}>
        {fields.map((f) => f.options
          ? <select key={f.name} className="input" style={{ width: "auto" }} value={form[f.name] ?? ""} onChange={(e) => setForm({ ...form, [f.name]: e.target.value })} required={f.required}><option value="">{f.placeholder}</option>{f.options.map((o) => <option key={o}>{o}</option>)}</select>
          : <input key={f.name} className="input" style={{ width: f.width || 150 }} placeholder={f.placeholder} value={form[f.name] ?? ""} onChange={(e) => setForm({ ...form, [f.name]: e.target.value })} required={f.required} />)}
        <button className="btn sm">Adicionar</button>
      </form>
      <ErrorBox error={error} />
    </div>
  );
}

export default function PacienteDetalhe() {
  const { id } = useParams();
  const patientId = Number(id);
  const [tab, setTab] = useState("timeline");
  const [showRaw, setShowRaw] = useState(false);
  const [lastOp, setLastOp] = useState(null);

  const patient = useLoad(() => api.patients.get(patientId), [patientId]);
  const pront = useLoad(() => api.prontuarios.get(patientId), [patientId]);
  const timeline = useLoad(() => api.records.timeline(patientId), [patientId]);
  const appts = useLoad(() => api.appointments.list({ patientId }).catch(() => []), [patientId]);
  const bp = useLoad(() => api.analytics.run("evolucaoPressao", { patientId }), [patientId]);

  const p = pront.data;
  const wrap = (fn) => async (...args) => { const r = await fn(...args); setLastOp(r.mongo); pront.reload(); };

  return (
    <>
      <div className="page-head">
        <div>
          <div className="row" style={{ marginBottom: 4 }}><Link to="/pacientes">← Pacientes</Link></div>
          <h1>{patient.data?.fullName || p?.fullName || `Paciente #${patientId}`}</h1>
          <p className="row">
            {patient.data && <>{cpfMask(patient.data.cpf)} · {age(patient.data.birthDate)} anos · {patient.data.healthPlan}</>}
            {p && <><Badge>{p.bloodType}</Badge><Badge>{UNIT_LABEL[p.preferredUnit]}</Badge><Badge tone="mongo">{p.summary?.totalEncounters ?? 0} atendimentos</Badge></>}
          </p>
        </div>
        <div className="row"><button className="btn sm" onClick={() => setShowRaw((s) => !s)}>{showRaw ? "Ocultar" : "Ver"} documento cru do prontuario</button></div>
      </div>

      {showRaw && p && <Card title="prontuarios → findOne({ patientId })" subtitle="Um unico documento com tudo embutido: endereco GeoJSON, alergias, condicoes, medicamentos e o resumo calculado." style={{ marginBottom: 16 }}><JsonView data={p} maxHeight={520} /></Card>}

      <div className="grid cols-2" style={{ marginBottom: 16 }}>
        <Card title="Cadastro" actions={<Badge tone="pg">patient-service · PostgreSQL</Badge>}>
          {patient.loading ? <Loading /> : patient.error ? <ErrorBox error={patient.error} onRetry={patient.reload} /> : (
            <dl className="kv">
              <dt>Nome</dt><dd>{patient.data.fullName}</dd>
              <dt>CPF</dt><dd>{cpfMask(patient.data.cpf)}</dd>
              <dt>Nascimento</dt><dd>{fmtDate(patient.data.birthDate)} ({age(patient.data.birthDate)} anos)</dd>
              <dt>E-mail</dt><dd>{patient.data.email || "—"}</dd>
              <dt>Telefone</dt><dd>{patient.data.phone || "—"}</dd>
              <dt>Convenio</dt><dd>{patient.data.healthPlan}</dd>
              <dt>Situacao</dt><dd>{patient.data.active ? <Badge tone="ok">ativo</Badge> : <Badge tone="danger">inativo</Badge>}</dd>
            </dl>
          )}
        </Card>

        <Card title="Prontuario" subtitle="Arrays embutidos editados com $addToSet / $push / $pull" actions={<Badge tone="mongo">medical-record-service · MongoDB Atlas</Badge>}>
          {pront.loading ? <Loading /> : pront.error ? <ErrorBox error={pront.error} onRetry={pront.reload} /> : (
            <div className="stack">
              <dl className="kv">
                <dt>Endereco</dt><dd>{p.address?.street}, {p.address?.number} · {p.address?.neighborhood} · <span className="muted small">[{p.address?.location?.coordinates?.join(", ")}]</span></dd>
                <dt>Biometria</dt><dd>{p.heightCm} cm · {p.weightKg} kg{p.heightCm && p.weightKg ? ` · IMC ${(p.weightKg / (p.heightCm / 100) ** 2).toFixed(1)}` : ""}</dd>
                <dt>Contato emergencia</dt><dd>{p.emergencyContact ? `${p.emergencyContact.name} (${p.emergencyContact.relationship}) ${p.emergencyContact.phone}` : "—"}</dd>
              </dl>
              <ListaEditavel title="Alergias" items={p.allergies || []} render={(a) => <><Badge tone={SEVERITY_TONE[a.severity]}>{a.severity}</Badge> {a.substance}{a.reaction ? ` · ${a.reaction}` : ""}</>}
                fields={[{ name: "substance", placeholder: "Substancia", required: true }, { name: "reaction", placeholder: "Reacao" }, { name: "severity", placeholder: "Gravidade", options: ["LEVE", "MODERADA", "GRAVE"], required: true }]}
                onAdd={wrap((f) => api.prontuarios.addAllergy(patientId, f))} onRemove={wrap((a) => api.prontuarios.removeAllergy(patientId, a.substance))} />
              <ListaEditavel title="Condicoes cronicas" items={p.chronicConditions || []} render={(c) => <><code>{c.cid10}</code> {c.description} <span className="muted">desde {fmtDate(c.since)}</span></>}
                fields={[{ name: "cid10", placeholder: "CID-10", width: 90, required: true }, { name: "description", placeholder: "Descricao", width: 220, required: true }, { name: "since", placeholder: "AAAA-MM-DD", width: 120 }]}
                onAdd={wrap((f) => api.prontuarios.addCondition(patientId, f))} onRemove={wrap((c) => api.prontuarios.removeCondition(patientId, c.cid10))} />
              <ListaEditavel title="Medicamentos de uso continuo" items={p.medications || []} render={(m) => <>{m.name} {m.dose} <span className="muted">{m.frequency}</span></>}
                fields={[{ name: "name", placeholder: "Medicamento", required: true }, { name: "dose", placeholder: "Dose", width: 90 }, { name: "frequency", placeholder: "Frequencia", width: 120 }]}
                onAdd={wrap((f) => api.prontuarios.addMedication(patientId, f))} onRemove={wrap((m) => api.prontuarios.removeMedication(patientId, m.name))} />
              {lastOp && <details className="pipeline"><summary>Ultima operacao enviada ao Mongo ({lastOp.operation})</summary><JsonView data={{ filter: lastOp.filter, update: lastOp.update }} maxHeight={220} /></details>}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <Tabs active={tab} onChange={setTab} tabs={[{ id: "timeline", label: `Linha do tempo (${timeline.data?.length ?? "…"})` }, { id: "novo", label: "Novo atendimento" }, { id: "agenda", label: `Agenda (${appts.data?.length ?? "…"})` }, { id: "pressao", label: "Pressao arterial" }]} />
        {tab === "timeline" && (timeline.loading ? <Loading /> : timeline.error ? <ErrorBox error={timeline.error} onRetry={timeline.reload} /> : (
          <>
            <p className="muted small" style={{ marginBottom: 10 }}>db.atendimentos.find({"{"} patientId: {patientId} {"}"}).sort({"{"} occurredAt: -1 {"}"}) — uma unica leitura, atendida pelo indice composto idx_patient_occurred, cada documento com a propria estrutura.</p>
            <Timeline items={timeline.data} />
          </>
        ))}
        {tab === "novo" && <NovoAtendimento patientId={patientId} onCreated={() => { timeline.reload(); pront.reload(); bp.reload(); }} />}
        {tab === "agenda" && (appts.loading ? <Loading /> : (
          !appts.data?.length ? <Empty>Sem consultas agendadas. <Link to="/agenda">Agendar</Link></Empty> : (
            <div className="table-wrap"><table><thead><tr><th>Quando</th><th>Medico</th><th>Especialidade</th><th>Status</th><th>Obs.</th></tr></thead>
              <tbody>{appts.data.map((a) => <tr key={a.id}><td>{fmtDateTime(a.scheduledAt)}</td><td>{a.doctorName}</td><td>{a.specialty}</td><td><Badge tone={STATUS_TONE[a.status]}>{a.status}</Badge></td><td className="small">{a.notes}</td></tr>)}</tbody></table></div>
          )
        ))}
        {tab === "pressao" && (bp.loading ? <Loading /> : bp.error ? <ErrorBox error={bp.error} /> : (
          <>
            {bp.data.result.length === 0 ? <Empty>Nenhum atendimento com pressao arterial registrada em clinicalData.</Empty> : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={bp.data.result.map((d) => ({ ...d, data: fmtDate(d.data) }))} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#eef0f3" />
                  <XAxis dataKey="data" tick={{ fontSize: 12, fill: "#7b8794" }} tickLine={false} axisLine={false} />
                  <YAxis domain={[50, 180]} tick={{ fontSize: 12, fill: "#7b8794" }} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="sistolica" name="Sistolica (mmHg)" stroke={SERIES[0]} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: "#fff" }} />
                  <Line type="monotone" dataKey="diastolica" name="Diastolica (mmHg)" stroke={SERIES[1]} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: "#fff" }} />
                </LineChart>
              </ResponsiveContainer>
            )}
            <div className="row" style={{ marginTop: 10 }}><AtlasExplainButton report={bp.data} params={{ patientId }} /><span className="muted small">Consulta pontual: repare que aqui o servidor usa o indice, ao contrario das analises do dashboard.</span></div>
            <PipelineViewer report={bp.data} />
          </>
        ))}
      </Card>
    </>
  );
}
