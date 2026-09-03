import { useState } from "react";
import { api } from "../api.js";
import { Badge, Card, ErrorBox, Loading, Tabs, useLoad } from "../components/ui.jsx";
import JsonView from "../components/JsonView.jsx";
import { fmtNum } from "../lib/format.js";

const INVALID_DOC = `{
  "patientId": "seven",
  "recordType": "SURGERY",
  "specialty": "X",
  "occurredAt": "yesterday",
  "clinicalData": "loose text",
  "createdAt": { "$date": "2026-09-02T12:00:00Z" }
}`;

function Overview() {
  const ov = useLoad(() => api.admin.overview());
  if (ov.loading) return <Loading />;
  if (ov.error) return <ErrorBox error={ov.error} onRetry={ov.reload} />;
  const d = ov.data;
  return (
    <div className="stack">
      <div className="row">
        <Badge tone="mongo">MongoDB {d.server.version}</Badge>
        <Badge tone={d.server.atlas ? "mongo" : "warn"}>{d.server.atlas ? "Atlas" : "local instance"}</Badge>
        <Badge>database {d.server.database}</Badge>
        <Badge tone={d.atlasSearch.available ? "ok" : d.atlasSearch.available === false ? "warn" : ""}>Atlas Search: {d.atlasSearch.available == null ? "not used yet" : d.atlasSearch.available ? "active" : d.atlasSearch.reason}</Badge>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Collection</th><th className="num">Documents</th><th className="num">Avg. size (bytes)</th><th className="num">Data (KB)</th><th className="num">On disk (KB)</th><th className="num">Indexes</th><th className="num">Indexes (KB)</th></tr></thead>
          <tbody>{d.collections.map((c) => <tr key={c.collection}><td><b>{c.collection}</b></td><td className="num">{fmtNum(c.documents)}</td><td className="num">{fmtNum(c.avgObjectBytes)}</td><td className="num">{fmtNum(c.dataKb)}</td><td className="num">{fmtNum(c.storageKb)}</td><td className="num">{c.indexes}</td><td className="num">{fmtNum(c.indexesKb)}</td></tr>)}</tbody>
        </table>
      </div>
      <p className="muted small">Source: the <code>$collStats</code> stage. The size on disk is smaller than the data size because of WiredTiger compression.</p>
    </div>
  );
}

function Explain() {
  const [field, setField] = useState("patientId");
  const [value, setValue] = useState("7");
  const [runs, setRuns] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  async function run() {
    setBusy(true); setError(null);
    try {
      const [without, withIdx] = await Promise.all([api.admin.explain({ field, value, index: false }), api.admin.explain({ field, value, index: true })]);
      setRuns({ without, withIdx });
    } catch (err) { setError(err); } finally { setBusy(false); }
  }
  const Box = ({ title, r, tone }) => (
    <div className={`box ${tone}`}>
      <h3>{title}</h3>
      <div className="row" style={{ margin: "6px 0" }}>{r.summary.stages.map((s, i) => <Badge key={i} tone={s.stage === "COLLSCAN" ? "danger" : s.stage === "IXSCAN" ? "ok" : ""}>{s.stage}{s.indexName ? ` (${s.indexName})` : ""}</Badge>)}</div>
      <dl className="kv">
        <dt>documents examined</dt><dd className="big">{fmtNum(r.summary.docsExamined)}</dd>
        <dt>index keys examined</dt><dd>{fmtNum(r.summary.keysExamined)}</dd>
        <dt>documents returned</dt><dd>{fmtNum(r.summary.docsReturned)}</dd>
        <dt>server time</dt><dd>{r.summary.serverTimeMs} ms</dd>
      </dl>
      <details className="pipeline"><summary>Full plan (winningPlan)</summary><JsonView data={r.winningPlan} maxHeight={300} /></details>
    </div>
  );
  return (
    <div className="stack">
      <p className="muted">The same query twice: forcing a full scan (<code>hint({"{"} $natural: 1 {"}"})</code>) and letting the planner choose the index. Compare how many documents the server had to read.</p>
      <div className="row">
        <select className="input" style={{ width: "auto" }} value={field} onChange={(e) => setField(e.target.value)}>
          {["patientId", "specialty", "recordType", "tags", "diagnosis.icd10", "unit"].map((f) => <option key={f}>{f}</option>)}
        </select>
        <input className="input" style={{ width: 200 }} value={value} onChange={(e) => setValue(e.target.value)} placeholder="value" />
        <span className="muted small">sort {"{"} occurredAt: -1 {"}"}</span>
        <button className="btn primary" disabled={busy} onClick={run}>{busy ? "Running..." : "Compare plans"}</button>
      </div>
      <ErrorBox error={error} />
      {runs && <div className="compare"><Box title="Without index (forced COLLSCAN)" r={runs.without} tone="bad" /><Box title="With index (planner's choice)" r={runs.withIdx} tone="good" /></div>}
    </div>
  );
}

function Indexes() {
  const idx = useLoad(() => api.admin.indexes());
  if (idx.loading) return <Loading />;
  if (idx.error) return <ErrorBox error={idx.error} onRetry={idx.reload} />;
  return (
    <div className="grid cols-2">
      {Object.entries(idx.data.existing).map(([col, list]) => (
        <div key={col}>
          <h3 style={{ marginBottom: 6 }}>{col}</h3>
          <table><thead><tr><th>Name</th><th>Key</th><th>Type</th></tr></thead>
            <tbody>{list.map((i) => <tr key={i.name}><td><code>{i.name}</code>{i.unique && <Badge tone="brand">unique</Badge>}</td><td><code>{JSON.stringify(i.key)}</code></td><td>{i.type}</td></tr>)}</tbody></table>
        </div>
      ))}
    </div>
  );
}

function Schema() {
  const sc = useLoad(() => api.admin.schema());
  const [collection, setCollection] = useState("encounters");
  const [doc, setDoc] = useState(INVALID_DOC);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  async function test() {
    setError(null); setResult(null);
    try {
      const body = JSON.parse(doc);
      setResult(await api.admin.validationDemo(body, collection));
    } catch (err) { setError(err.status ? err : { message: "Invalid JSON: " + err.message }); }
  }
  return (
    <div className="grid cols-2">
      <div>
        <h3 style={{ marginBottom: 6 }}>Collection validators ($jsonSchema)</h3>
        <p className="muted small" style={{ marginBottom: 8 }}>Flexible schema is not the absence of a schema: the server validates the invariants (types, enums, GeoJSON, ICD-10) and leaves clinicalData free.</p>
        {sc.loading ? <Loading /> : sc.error ? <ErrorBox error={sc.error} /> : <JsonView data={sc.data} maxHeight={560} />}
      </div>
      <div className="stack">
        <h3>Test the validation</h3>
        <p className="muted small">Send a document: if it is rejected, Mongo returns exactly which rules failed. Valid documents are inserted and then removed.</p>
        <div className="row"><select className="input" style={{ width: "auto" }} value={collection} onChange={(e) => setCollection(e.target.value)}><option>encounters</option><option>medical_records</option></select><button className="btn primary" onClick={test}>Try to insert</button><button className="btn sm ghost" onClick={() => setDoc(INVALID_DOC)}>restore example</button></div>
        <textarea className="input" style={{ minHeight: 180, fontFamily: "monospace", fontSize: 12.5 }} value={doc} onChange={(e) => setDoc(e.target.value)} />
        <ErrorBox error={error} />
        {result && (
          <div>
            <div className={`alert ${result.rejected ? "error" : "info"}`}>{result.rejected ? `Rejected (error ${result.code}): ${result.message}` : result.message}</div>
            {result.details && <JsonView data={result.details} maxHeight={360} />}
          </div>
        )}
      </div>
    </div>
  );
}

function Sample() {
  const [collection, setCollection] = useState("encounters");
  const [specialty, setSpecialty] = useState("");
  const s = useLoad(() => api.admin.sample(collection, { specialty }), [collection, specialty]);
  return (
    <div className="stack">
      <div className="row">
        <select className="input" style={{ width: "auto" }} value={collection} onChange={(e) => setCollection(e.target.value)}><option>encounters</option><option>medical_records</option></select>
        {collection === "encounters" && <select className="input" style={{ width: "auto" }} value={specialty} onChange={(e) => setSpecialty(e.target.value)}><option value="">any specialty</option>{["Cardiology", "Ophthalmology", "Orthopedics", "Psychiatry", "Endocrinology", "Dermatology", "Pediatrics", "General Practice", "Gynecology", "Clinical Laboratory", "Diagnostic Imaging", "Immunization", "General Surgery"].map((x) => <option key={x}>{x}</option>)}</select>}
        <button className="btn sm" onClick={s.reload}>Another document ($sample)</button>
      </div>
      {s.loading ? <Loading /> : s.error ? <ErrorBox error={s.error} /> : <JsonView data={s.data} maxHeight={600} />}
    </div>
  );
}

function SearchIndexes() {
  const si = useLoad(() => api.admin.searchIndexes());
  const [msg, setMsg] = useState(null);
  return (
    <div className="stack">
      <div className="row"><button className="btn" onClick={() => api.admin.createSearchIndexes().then((r) => { setMsg(r); si.reload(); })}>Create Atlas Search indexes (if missing)</button>{si.data && <Badge tone={si.data.atlas ? "mongo" : "warn"}>{si.data.atlas ? "Atlas cluster" : "not Atlas: no Search"}</Badge>}</div>
      {msg && <JsonView data={msg} maxHeight={200} />}
      {si.loading ? <Loading /> : si.error ? <ErrorBox error={si.error} /> : <JsonView data={si.data.indexes} maxHeight={500} />}
    </div>
  );
}

function Seed() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  async function reseed() {
    if (!window.confirm("This deletes medical records and encounters on Atlas and reloads the 120 demo patients. Continue?")) return;
    setBusy(true); setError(null);
    try { setResult(await api.admin.seed(true)); } catch (err) { setError(err); } finally { setBusy(false); }
  }
  return (
    <div className="stack">
      <p className="muted">Recreates the (deterministic) initial load from infra/seed/patients.json. Useful to return to the original state after a demo.</p>
      <div className="row"><button className="btn danger" disabled={busy} onClick={reseed}>{busy ? "Reloading..." : "Reload demo data (force)"}</button></div>
      <ErrorBox error={error} />
      {result && <JsonView data={result} maxHeight={240} />}
    </div>
  );
}

export default function MongoLab() {
  const [tab, setTab] = useState("overview");
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Behind the scenes of MongoDB</h1>
          <p>What Atlas does underneath the screens: execution plan with and without an index, declared indexes, schema validation in action, raw documents and the state of the search indexes.</p>
        </div>
        <Badge tone="mongo">medical-record-service · /admin</Badge>
      </div>
      <Card>
        <Tabs active={tab} onChange={setTab} tabs={[{ id: "overview", label: "Overview" }, { id: "explain", label: "Explain: with vs. without index" }, { id: "indexes", label: "Indexes" }, { id: "schema", label: "Schema validation" }, { id: "sample", label: "Raw document" }, { id: "search", label: "Atlas Search" }, { id: "seed", label: "Seed" }]} />
        {tab === "overview" && <Overview />}
        {tab === "explain" && <Explain />}
        {tab === "indexes" && <Indexes />}
        {tab === "schema" && <Schema />}
        {tab === "sample" && <Sample />}
        {tab === "search" && <SearchIndexes />}
        {tab === "seed" && <Seed />}
      </Card>
    </>
  );
}
