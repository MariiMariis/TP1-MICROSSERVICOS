import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../api.js";
import { Badge, Card, ErrorBox, Loading, StatTile, useLoad } from "../components/ui.jsx";
import PipelineViewer from "../components/PipelineViewer.jsx";
import { AtlasExplainButton } from "../components/AtlasExplain.jsx";
import { fmtBRL, fmtDate, fmtNum, SERIES } from "../lib/format.js";

const AXIS = { fontSize: 12, fill: "#7b8794" };
const GRID = "#eef0f3";

function ChartCard({ report, children, subtitle }) {
  return (
    <Card title={report.title} subtitle={subtitle ?? report.description} actions={<AtlasExplainButton report={report} />}>
      {children}
      <PipelineViewer report={report} />
    </Card>
  );
}

export default function Dashboard() {
  const { data, error, loading, reload } = useLoad(() => api.analytics.dashboard());
  if (loading) return <Loading text="Running 12 aggregation pipelines on Atlas..." />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;

  const r = data.reports;
  const kpi = r.kpis.result;
  const byType = Object.fromEntries((kpi.byType || []).map((t) => [t._id, t.total]));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Clinical dashboard</h1>
          <p>Every chart comes from an aggregation pipeline run by the medical-record-service on MongoDB Atlas. Click "How Atlas processed it" on any card to see the exact query and the real execution plan.</p>
        </div>
        <div className="row">
          <Badge tone="mongo">MongoDB Atlas</Badge>
          <Badge>{data.tookMs} ms in total</Badge>
          <button className="btn sm" onClick={reload}>Refresh</button>
        </div>
      </div>

      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <StatTile label="Patients with a medical record" value={fmtNum(data.totalPatients)} hint="medical_records collection" />
        <StatTile label="Encounters recorded" value={fmtNum(kpi.totalEncounters)} hint={`${byType.CONSULTATION ?? 0} consultations · ${byType.EXAM ?? 0} exams · ${byType.VACCINE ?? 0} vaccines`} />
        <StatTile label="Encounters in the last 30 days" value={fmtNum(kpi.last30Days)} hint="$match on occurredAt" />
        <StatTile label="Accumulated revenue" value={fmtBRL(kpi.totalRevenue)} hint={`average ticket ${fmtBRL(kpi.avgTicket)}`} />
      </div>

      <div className="grid cols-2">
        <ChartCard report={r.encountersByMonth}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={r.encountersByMonth.result} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis dataKey="period" tick={AXIS} tickLine={false} axisLine={false} interval={2} />
              <YAxis tick={AXIS} tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="consultations" name="Consultations" stackId="a" fill={SERIES[0]} stroke="#fff" strokeWidth={1} />
              <Bar dataKey="exams" name="Exams" stackId="a" fill={SERIES[1]} stroke="#fff" strokeWidth={1} />
              <Bar dataKey="vaccines" name="Vaccines" stackId="a" fill={SERIES[2]} stroke="#fff" strokeWidth={1} />
              <Bar dataKey="other" name="Procedures and admissions" stackId="a" fill={SERIES[3]} stroke="#fff" strokeWidth={1} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard report={r.ageGroups}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={r.ageGroups.result} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} barGap={2}>
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis dataKey="ageGroup" tick={AXIS} tickLine={false} axisLine={false} />
              <YAxis tick={AXIS} tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="female" name="Female" fill={SERIES[0]} radius={[4, 4, 0, 0]} barSize={22} />
              <Bar dataKey="male" name="Male" fill={SERIES[1]} radius={[4, 4, 0, 0]} barSize={22} />
              <Bar dataKey="withChronicCondition" name="With chronic condition" fill={SERIES[2]} radius={[4, 4, 0, 0]} barSize={22} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard report={r.specialties}>
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={r.specialties.result} layout="vertical" margin={{ top: 4, right: 40, left: 40, bottom: 0 }}>
              <CartesianGrid horizontal={false} stroke={GRID} />
              <XAxis type="number" tick={AXIS} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="specialty" tick={AXIS} tickLine={false} axisLine={false} width={120} />
              <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} formatter={(v, n, p) => [`${v} encounters · ${p.payload.distinctPatients} patients · ${p.payload.avgDurationMin} min on average`, "Encounters"]} />
              <Bar dataKey="total" name="Encounters" fill={SERIES[0]} radius={[0, 4, 4, 0]} barSize={14} label={{ position: "right", fontSize: 11, fill: "#4f5a66" }} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard report={r.topDiagnoses}>
          <div className="table-wrap">
            <table>
              <thead><tr><th>ICD-10</th><th>Description</th><th className="num">Occurrences</th><th className="num">Patients</th></tr></thead>
              <tbody>
                {r.topDiagnoses.result.map((d) => (
                  <tr key={d.icd10}><td><code>{d.icd10}</code></td><td>{d.description}</td><td className="num">{d.total}</td><td className="num">{d.distinctPatients}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>

        <ChartCard report={r.healthPlans}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={r.healthPlans.result} margin={{ top: 8, right: 8, left: -18, bottom: 30 }}>
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis dataKey="healthPlan" tick={{ ...AXIS, fontSize: 11 }} tickLine={false} axisLine={false} angle={-25} textAnchor="end" interval={0} />
              <YAxis tick={AXIS} tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} formatter={(v, n, p) => [`${v} patients · average age ${p.payload.avgAge}`, "Patients"]} />
              <Bar dataKey="patients" name="Patients" fill={SERIES[0]} radius={[4, 4, 0, 0]} barSize={26} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard report={r.bmi}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={r.bmi.result} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis dataKey="category" tick={{ ...AXIS, fontSize: 11 }} tickLine={false} axisLine={false} interval={0} />
              <YAxis tick={AXIS} tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} formatter={(v, n, p) => [`${v} patients · average BMI ${p.payload.avgBmi}`, "Patients"]} />
              <Bar dataKey="patients" name="Patients" fill={SERIES[0]} radius={[4, 4, 0, 0]} barSize={30} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard report={r.allergyConflicts}>
          {r.allergyConflicts.result.length === 0 ? <p className="muted">No conflicts found.</p> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Patient</th><th>Date</th><th>Specialty</th><th>Prescribed</th><th>Recorded allergies</th></tr></thead>
                <tbody>
                  {r.allergyConflicts.result.map((c) => (
                    <tr key={c._id}>
                      <td><Link to={`/patients/${c.patientId}`}>{c.patientName}</Link></td>
                      <td>{fmtDate(c.occurredAt)}</td>
                      <td>{c.specialty}<div className="muted small">{c.professional}</div></td>
                      <td>{c.conflicts.map((n) => <Badge key={n} tone="danger">{n}</Badge>)}</td>
                      <td className="small">{c.allergies.map((a) => `${a.substance} (${a.severity})`).join(", ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ChartCard>

        <ChartCard report={r.topPatients}>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Patient</th><th className="num">Age</th><th>Health plan</th><th className="num">Conditions</th><th className="num">Encounters</th><th>Last</th></tr></thead>
              <tbody>
                {r.topPatients.result.map((p) => (
                  <tr key={p.patientId}>
                    <td><Link to={`/patients/${p.patientId}`}>{p.fullName}</Link><div className="muted small">{p.specialties.join(", ")}</div></td>
                    <td className="num">{p.age}</td><td>{p.healthPlan}</td><td className="num">{p.conditions}</td><td className="num"><b>{p.total}</b></td><td>{fmtDate(p.last)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>

        <ChartCard report={r.topMedications}>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Medication</th><th className="num">Patients</th><th>Doses in use</th></tr></thead>
              <tbody>{r.topMedications.result.map((m) => <tr key={m.medication}><td>{m.medication}</td><td className="num">{m.patients}</td><td className="small">{m.doses.join(", ")}</td></tr>)}</tbody>
            </table>
          </div>
        </ChartCard>

        <ChartCard report={r.severeAllergies}>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Substance</th><th className="num">Patients</th><th>Who</th></tr></thead>
              <tbody>{r.severeAllergies.result.map((a) => <tr key={a.substance}><td><Badge tone="danger">{a.substance}</Badge></td><td className="num">{a.patients}</td><td className="small">{a.names.join(", ")}</td></tr>)}</tbody>
            </table>
          </div>
        </ChartCard>

        <Card className="span-2" title={r.fieldsBySpecialty.title} subtitle={r.fieldsBySpecialty.description} actions={<AtlasExplainButton report={r.fieldsBySpecialty} />}>
          <div className="grid cols-3">
            {r.fieldsBySpecialty.result.map((e) => (
              <div key={e.specialty}>
                <h3 style={{ marginBottom: 6 }}>{e.specialty}</h3>
                <div className="chips">{e.fields.map((c) => <span key={c.field} className="chip"><code>{c.field}</code><span className="muted">{c.encounters}</span></span>)}</div>
              </div>
            ))}
          </div>
          <PipelineViewer report={r.fieldsBySpecialty} />
        </Card>
      </div>
    </>
  );
}
