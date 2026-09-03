import JsonView from "./JsonView.jsx";

// "The query that produced this result": shows the pipeline/filter the service sent to Mongo.
export default function PipelineViewer({ report, label = "View the aggregation pipeline", method = "aggregate" }) {
  if (!report?.pipeline) return null;
  const collection = report.collection || "encounters";
  return (
    <details className="pipeline">
      <summary>{label}</summary>
      {report.description && <div className="meta">{report.description}</div>}
      <div className="meta">
        db.<b>{collection}</b>.{method}(...) · {report.pipeline.length} stage{report.pipeline.length === 1 ? "" : "s"}
        {report.tookMs != null && <> · executed in <b>{report.tookMs} ms</b></>}
      </div>
      <JsonView data={report.pipeline} />
    </details>
  );
}
