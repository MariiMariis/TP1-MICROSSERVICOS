import { useEffect, useState } from "react";

export function Card({ title, subtitle, actions, children, className = "", style }) {
  return (
    <section className={`card ${className}`} style={style}>
      {(title || actions) && (
        <div className="card-head">
          <div>
            {title && <h2>{title}</h2>}
            {subtitle && <p>{subtitle}</p>}
          </div>
          {actions && <div className="card-actions">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Badge({ tone = "", children, title }) {
  return <span className={`badge ${tone}`} title={title}>{children}</span>;
}

export function StatTile({ label, value, hint }) {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

export function Loading({ text = "Carregando..." }) {
  return <div className="loading">{text}</div>;
}

export function Empty({ children }) {
  return <div className="empty">{children}</div>;
}

export function ErrorBox({ error, onRetry }) {
  if (!error) return null;
  const body = error.body;
  return (
    <div className="alert error">
      <b>{error.status ? `HTTP ${error.status}` : "Erro"}</b> — {error.message}
      {body?.path && <span className="muted"> ({body.path})</span>}
      {body?.details && <pre style={{ whiteSpace: "pre-wrap", margin: "6px 0 0", fontSize: 12 }}>{JSON.stringify(body.details, null, 2)}</pre>}
      {onRetry && <div style={{ marginTop: 8 }}><button className="btn sm" onClick={onRetry}>Tentar de novo</button></div>}
    </div>
  );
}

export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="tabs">
      {tabs.map((t) => (
        <button key={t.id} className={active === t.id ? "active" : ""} onClick={() => onChange(t.id)}>{t.label}</button>
      ))}
    </div>
  );
}

// Hook simples para carregar dados: { data, error, loading, reload }
export function useLoad(fn, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    Promise.resolve()
      .then(fn)
      .then((data) => alive && setState({ data, error: null, loading: false }))
      .catch((error) => alive && setState({ data: null, error, loading: false }));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { ...state, reload: () => setTick((t) => t + 1) };
}
