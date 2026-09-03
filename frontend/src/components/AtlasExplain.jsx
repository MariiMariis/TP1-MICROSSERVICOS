import { useEffect, useState } from "react";
import { api } from "../api.js";
import { Badge, ErrorBox, Loading } from "./ui.jsx";
import JsonView from "./JsonView.jsx";
import { explainStage, PLAN_STAGES } from "../lib/stageExplainer.js";
import { fmtNum } from "../lib/format.js";

// "How Atlas processed it" button + side panel with the explained pipeline and the real explain.
export function AtlasExplainButton({ report, params }) {
  const [open, setOpen] = useState(false);
  if (!report?.key) return null;
  return (
    <>
      <button className="btn sm atlas" onClick={() => setOpen(true)} title="Shows the explained pipeline and the real execution plan of this query">🍃 How Atlas processed it</button>
      {open && <AtlasExplainDrawer report={report} params={params} onClose={() => setOpen(false)} />}
    </>
  );
}

function Metric({ label, value, hint }) {
  return (
    <div className="metric">
      <div className="label">{label}</div>
      <div className="value">{value ?? "—"}</div>
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

export function AtlasExplainDrawer({ report, params, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState("pipeline");

  useEffect(() => {
    let alive = true;
    api.analytics.explain(report.key, params).then((d) => alive && setData(d)).catch((e) => alive && setError(e));
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { alive = false; window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [report.key, params, onClose]);

  const pipeline = report.pipeline || data?.pipeline || [];
  const s = data?.summary;

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <header className="drawer-head">
          <div>
            <div className="row"><Badge tone="mongo">MongoDB Atlas</Badge><span className="muted small">db.{report.collection}.aggregate(...)</span></div>
            <h2 style={{ marginTop: 6 }}>{report.title}</h2>
            {report.description && <p className="muted small" style={{ marginTop: 4 }}>{report.description}</p>}
          </div>
          <button className="btn ghost" onClick={onClose} aria-label="Close">✕</button>
        </header>

        {error && <ErrorBox error={error} />}
        {!data && !error && <Loading text="Running explain('executionStats') on Atlas..." />}

        {data && (
          <>
            <div className="metrics">
              <Metric label="Executed on node" value={data.server?.host?.split(".")[0] ?? "?"} hint={data.server ? `MongoDB ${data.server.version} · ${data.server.host?.split(".").slice(1).join(".")}` : null} />
              <Metric label="Documents read from the collection" value={fmtNum(s.docsExamined)} hint={s.fullCollectionScan ? "full scan (COLLSCAN)" : "read through an index"} />
              <Metric label="Index keys read" value={fmtNum(s.keysExamined)} hint={s.indexesUsed.length ? `indexes involved: ${s.indexesUsed.join(", ")}` : "no index"} />
              <Metric label="Documents returned" value={fmtNum(s.docsReturned)} hint={`${s.stagesExecuted} stage${s.stagesExecuted === 1 ? "" : "s"} executed`} />
              <Metric label="Server time" value={`${s.serverTimeMs} ms`} hint={`${data.roundTripMs} ms round trip to here`} />
            </div>
            {s.fullCollectionScan && (
              <div className="alert info small" style={{ marginTop: 10 }}>
                This analysis aggregates the whole collection, so the full scan is the correct plan: an index would only help with a selective $match at the start. Compare with the <b>Explain</b> tab in Behind the scenes, where the point query by patient reads 14 documents instead of {fmtNum(s.docsExamined)}.
              </div>
            )}

            <div className="tabs" style={{ marginTop: 14 }}>
              <button className={tab === "pipeline" ? "active" : ""} onClick={() => setTab("pipeline")}>1. What we asked for ({pipeline.length} stages)</button>
              <button className={tab === "exec" ? "active" : ""} onClick={() => setTab("exec")}>2. What the server did ({data.stages.length})</button>
              <button className={tab === "raw" ? "active" : ""} onClick={() => setTab("raw")}>3. Raw explain()</button>
            </div>

            {tab === "pipeline" && (
              <ol className="steps">
                {pipeline.map((stage, i) => {
                  const name = Object.keys(stage)[0];
                  const ex = explainStage(stage);
                  return (
                    <li key={i} className="step">
                      <div className="step-head"><span className="step-n">{i + 1}</span><code className="step-name">{name}</code><b>{ex.title}</b></div>
                      <p>{ex.text}</p>
                      {ex.detail && <p className="muted small">{ex.detail}</p>}
                      <details><summary className="muted small">view the stage as sent</summary><JsonView data={stage} maxHeight={220} /></details>
                    </li>
                  );
                })}
              </ol>
            )}

            {tab === "exec" && (
              <div className="stack">
                <p className="muted small">The optimizer reorganizes the pipeline: leading $match, $sort and $project become the collection read ($cursor) and, in recent versions, whole stages are compiled into the execution engine. That is why this list can be shorter than the pipeline sent.</p>
                <ol className="steps">
                  {data.stages.map((st, i) => (
                    <li key={i} className="step">
                      <div className="step-head"><span className="step-n">{i + 1}</span><code className="step-name">{st.stage}</code>
                        {st.nReturned != null && <Badge>{fmtNum(st.nReturned)} doc{st.nReturned === 1 ? "" : "s"} out</Badge>}
                        {st.ms != null && <Badge>{st.ms} ms</Badge>}
                        {st.docsExamined != null && <Badge tone="warn">{fmtNum(st.docsExamined)} docs read</Badge>}
                        {st.keysExamined != null && st.keysExamined > 0 && <Badge tone="ok">{fmtNum(st.keysExamined)} index keys</Badge>}
                        {st.usedDisk && <Badge tone="danger">used disk</Badge>}
                        {st.memoryBytes != null && <Badge>{fmtNum(Math.round(st.memoryBytes / 1024))} KB in memory</Badge>}
                      </div>
                      {st.description && <p className="muted small">{st.description}</p>}
                      {st.filter && <p className="small">Filter applied on read: <code>{JSON.stringify(st.filter)}</code></p>}
                      {st.indexesUsed?.length > 0 && <p className="small">Indexes used in the join: {st.indexesUsed.join(", ")}</p>}
                      {st.plan?.length > 0 && (
                        <div className="plan">
                          {[...st.plan].reverse().map((p, j) => {
                            const info = PLAN_STAGES[p.stage] || { label: p.stage, text: "", tone: "" };
                            return (
                              <div key={j} className="plan-node">
                                <Badge tone={info.tone}>{p.stage}</Badge>
                                <div><b>{info.label}</b>{p.indexName && <> · <code>{p.indexName}</code></>}<div className="muted small">{info.text}</div></div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </li>
                  ))}
                </ol>
                {data.engine && <p className="muted small">Query engine: <code>{data.engine}</code></p>}
              </div>
            )}

            {tab === "raw" && <JsonView data={data.raw} maxHeight={640} />}
          </>
        )}
      </aside>
    </div>
  );
}
