import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { Badge, Card, Empty, ErrorBox, Loading, useLoad } from "../components/ui.jsx";
import JsonView from "../components/JsonView.jsx";
import PipelineViewer from "../components/PipelineViewer.jsx";
import { fmtDate, TYPE_LABEL, TYPE_TONE } from "../lib/format.js";

const EXAMPLES = ["headaches", "hypertension", "palpitations", "Losartan", "insomnia", "Vasconcelos", "sprained ankle", "diabetis"];

// Converts the Atlas Search highlight format into JSX with <mark>.
function Highlight({ h }) {
  return <span>{h.texts.map((t, i) => (t.type === "hit" ? <mark key={i}>{t.value}</mark> : <span key={i}>{t.value}</span>))}</span>;
}

export default function Search() {
  const [q, setQ] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [type, setType] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [suggest, setSuggest] = useState([]);
  const [showSuggest, setShowSuggest] = useState(false);
  const timer = useRef(null);
  const status = useLoad(() => api.search.status());

  async function run(term = q, sp = specialty, tp = type) {
    if (term.trim().length < 2) return;
    setBusy(true); setError(null); setShowSuggest(false);
    try { setResult(await api.search.query(term, { specialty: sp || undefined, type: tp || undefined })); } catch (err) { setError(err); } finally { setBusy(false); }
  }

  useEffect(() => {
    clearTimeout(timer.current);
    if (q.trim().length < 2) { setSuggest([]); return; }
    timer.current = setTimeout(() => api.search.autocomplete(q).then((r) => setSuggest(r.results)).catch(() => setSuggest([])), 180);
    return () => clearTimeout(timer.current);
  }, [q]);

  const facetButtons = (name, key, current, setter) => {
    const buckets = result?.facets?.facet?.[name]?.buckets || [];
    if (!buckets.length) return null;
    return (
      <div>
        <h3 style={{ marginBottom: 4 }}>{name}</h3>
        <div className="facets">
          {buckets.map((b) => <button key={b._id} className={current === b._id ? "active" : ""} onClick={() => { const v = current === b._id ? "" : b._id; setter(v); run(q, key === "specialty" ? v : specialty, key === "type" ? v : type); }}><span>{b._id}</span><span className="muted">{b.count}</span></button>)}
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Medical record search</h1>
          <p>Atlas Search: full-text in English with typo tolerance (fuzzy), name autocomplete and facets. When the index is unavailable, the service falls back to $regex and says so - compare the two.</p>
        </div>
        <div className="row">
          {status.data && Object.values(status.data).map((s) => <Badge key={s.name} tone={s.queryable ? "mongo" : "warn"} title={s.reason || s.status}>{s.name}: {s.queryable ? "ready" : s.status}</Badge>)}
        </div>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <form className="row" onSubmit={(e) => { e.preventDefault(); run(); }}>
          <div className="autocomplete" style={{ flex: 1, minWidth: 280 }}>
            <input className="input" placeholder="Symptom, diagnosis, medication, professional or patient name..." value={q} onChange={(e) => { setQ(e.target.value); setShowSuggest(true); }} onFocus={() => setShowSuggest(true)} onBlur={() => setTimeout(() => setShowSuggest(false), 150)} />
            {showSuggest && suggest.length > 0 && (
              <ul>
                {suggest.map((s) => <li key={s.patientId} onMouseDown={() => { window.location.assign(`/patients/${s.patientId}`); }}><span>{s.fullName}</span><span className="muted small">#{s.patientId} · {s.healthPlan}</span></li>)}
                <li className="muted small" style={{ cursor: "default" }}>autocomplete (edgeGram) over medical_records.fullName</li>
              </ul>
            )}
          </div>
          <button className="btn primary" disabled={busy}>{busy ? "Searching..." : "Search"}</button>
        </form>
        <div className="row" style={{ marginTop: 10 }}>
          <span className="muted small">Try:</span>
          {EXAMPLES.map((ex) => <button key={ex} className="btn sm ghost" onClick={() => { setQ(ex); run(ex); }}>{ex}</button>)}
        </div>
      </Card>

      <ErrorBox error={error} />

      {result && (
        <div className="grid" style={{ gridTemplateColumns: "220px 1fr" }}>
          <Card title="Facets" subtitle="$searchMeta counts per category">
            <div className="stack">
              {facetButtons("specialty", "specialty", specialty, setSpecialty)}
              {facetButtons("type", "type", type, setType)}
              {facetButtons("unit", "unit", "", () => {})}
              {!result.facets && <p className="muted small">Facets only exist in Atlas Search.</p>}
              {(specialty || type) && <button className="btn sm" onClick={() => { setSpecialty(""); setType(""); run(q, "", ""); }}>Clear filters</button>}
            </div>
          </Card>
          <Card
            title={`${result.total} result${result.total === 1 ? "" : "s"} for "${result.q}"`}
            subtitle={result.engine === "atlas-search" ? "Sorted by relevance (searchScore), with highlighted snippets." : `Regular-expression fallback: ${result.reason || "Atlas Search unavailable"}. No ranking, no fuzzy, no highlights.`}
            actions={<><Badge tone={result.engine === "atlas-search" ? "mongo" : "warn"}>{result.engine}</Badge><Badge>{result.tookMs} ms</Badge></>}
          >
            {result.results.length === 0 ? <Empty>Nothing found.</Empty> : (
              <div className="timeline">
                {result.results.map((r) => (
                  <div key={r._id} className="tl-item">
                    <div className="when"><b>{fmtDate(r.occurredAt)}</b>{r.score != null && <span title="searchScore">score {r.score.toFixed(2)}</span>}</div>
                    <div>
                      <div className="title"><Badge tone={TYPE_TONE[r.recordType]}>{TYPE_LABEL[r.recordType]}</Badge><Link to={`/patients/${r.patientId}`}><b>{r.patientName}</b></Link><span className="muted">{r.specialty} · {r.professional?.name}</span></div>
                      {r.highlights?.length ? r.highlights.slice(0, 3).map((h, i) => <div key={i} className="body"><span className="muted small">{h.path}: </span><Highlight h={h} /></div>) : (
                        <>{r.chiefComplaint && <div className="body">{r.chiefComplaint}</div>}{r.notes && <div className="body small">{r.notes}</div>}</>
                      )}
                      {r.diagnosis?.length > 0 && <div className="chips" style={{ marginTop: 4 }}>{r.diagnosis.map((d) => <span key={d.icd10} className="chip"><code>{d.icd10}</code> {d.description}</span>)}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <PipelineViewer report={{ ...result, collection: "encounters" }} label={result.engine === "atlas-search" ? "View the $search pipeline" : "View the $regex filter used in the fallback"} />
          </Card>
        </div>
      )}

      {!result && status.data && (
        <Card title="Atlas Search index definitions" subtitle="Created by the service through createSearchIndexes(); if the cluster refuses, paste the definition in the Atlas UI (Search > Create Index > JSON Editor).">
          <div className="grid cols-2">
            {Object.entries(status.data).map(([col, s]) => <div key={col}><h3>{col} → {s.name} <Badge tone={s.queryable ? "ok" : "warn"}>{s.status}</Badge></h3><JsonView data={s.definition || s.expectedDefinition} maxHeight={360} /></div>)}
          </div>
        </Card>
      )}
      {!result && status.loading && <Loading />}
    </>
  );
}
