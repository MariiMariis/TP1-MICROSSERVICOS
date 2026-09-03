import { useState } from "react";
import { Link } from "react-router-dom";
import { Circle, CircleMarker, MapContainer, Popup, TileLayer, Tooltip, useMapEvents } from "react-leaflet";
import { api } from "../api.js";
import { Badge, Card, ErrorBox, Loading, useLoad } from "../components/ui.jsx";
import PipelineViewer from "../components/PipelineViewer.jsx";
import { UNIT_COLOR, UNIT_LABEL } from "../lib/format.js";

const CENTER = [-23.565, -46.64];

function ClickCatcher({ onClick }) {
  useMapEvents({ click: (e) => onClick(e.latlng) });
  return null;
}

export default function Mapa() {
  const units = useLoad(() => api.geo.units());
  const patients = useLoad(() => api.geo.patients());
  const coverage = useLoad(() => api.geo.coverage());
  const [origin, setOrigin] = useState({ kind: "unit", code: "PINHEIROS" });
  const [maxKm, setMaxKm] = useState(2);
  const [cid10, setCid10] = useState("");
  const [allergy, setAllergy] = useState("");
  const near = useLoad(() => (origin.kind === "unit" ? api.geo.nearUnit(origin.code, { maxKm, cid10, allergy, limit: 200 }) : api.geo.near(origin.lng, origin.lat, { maxKm, cid10, allergy, limit: 200 })), [origin, maxKm, cid10, allergy]);

  const originPoint = near.data?.origin?.location?.coordinates || near.data?.origin?.coordinates;
  const nearIds = new Set((near.data?.result || []).map((p) => p.patientId));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Mapa de pacientes</h1>
          <p>O endereco de cada prontuario e um ponto GeoJSON indexado com <b>2dsphere</b>. O estagio <code>$geoNear</code> devolve os pacientes ordenados por distancia de uma unidade (ou de qualquer ponto: clique no mapa), calculada na esfera.</p>
        </div>
        <Badge tone="mongo">$geoNear · 2dsphere</Badge>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "300px 1fr" }}>
        <div className="stack">
          <Card title="Consulta">
            <div className="stack">
              <div className="field"><label>Origem</label>
                <select value={origin.kind === "unit" ? origin.code : "click"} onChange={(e) => setOrigin({ kind: "unit", code: e.target.value })}>
                  {(units.data || []).map((u) => <option key={u.code} value={u.code}>{u.name}</option>)}
                  {origin.kind === "point" && <option value="click">Ponto clicado ({origin.lat.toFixed(4)}, {origin.lng.toFixed(4)})</option>}
                </select>
              </div>
              <div className="field"><label>Raio maximo: <b>{maxKm} km</b></label><input type="range" min={0.5} max={10} step={0.5} value={maxKm} onChange={(e) => setMaxKm(Number(e.target.value))} /></div>
              <div className="field"><label>Filtrar por condicao (CID-10)</label>
                <select value={cid10} onChange={(e) => setCid10(e.target.value)}><option value="">Todas</option>{["I10", "E11", "E78.5", "J45", "F41.1", "H52.1", "M54.5", "I48"].map((c) => <option key={c}>{c}</option>)}</select>
              </div>
              <div className="field"><label>Filtrar por alergia</label>
                <select value={allergy} onChange={(e) => setAllergy(e.target.value)}><option value="">Todas</option>{["Dipirona", "Penicilina", "Amoxicilina", "Ibuprofeno", "Latex", "Contraste iodado", "Amendoim"].map((c) => <option key={c}>{c}</option>)}</select>
              </div>
              <p className="muted small">Dica: clique em qualquer ponto do mapa para usar como origem.</p>
            </div>
          </Card>
          <Card title={near.data ? `${near.data.total} pacientes a ate ${maxKm} km` : "Resultado"} actions={near.data && <Badge>{near.data.tookMs} ms</Badge>}>
            {near.loading ? <Loading /> : near.error ? <ErrorBox error={near.error} /> : (
              <div className="table-wrap" style={{ maxHeight: 320, overflowY: "auto" }}>
                <table>
                  <thead><tr><th>Paciente</th><th>Bairro</th><th className="num">km</th></tr></thead>
                  <tbody>{near.data.result.map((p) => <tr key={p.patientId}><td><Link to={`/pacientes/${p.patientId}`}>{p.fullName}</Link></td><td className="small">{p.address?.neighborhood}</td><td className="num">{p.distanciaKm}</td></tr>)}</tbody>
                </table>
              </div>
            )}
            <PipelineViewer report={{ ...near.data, collection: "prontuarios" }} />
          </Card>
        </div>

        <div className="stack">
          <Card>
            {patients.loading ? <Loading /> : patients.error ? <ErrorBox error={patients.error} onRetry={patients.reload} /> : (
              <div className="map">
                <MapContainer center={CENTER} zoom={12} style={{ height: "100%", width: "100%" }}>
                  <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <ClickCatcher onClick={(ll) => setOrigin({ kind: "point", lat: ll.lat, lng: ll.lng })} />
                  {originPoint && <Circle center={[originPoint[1], originPoint[0]]} radius={maxKm * 1000} pathOptions={{ color: "#0f6b5c", weight: 1.5, fillOpacity: 0.06, dashArray: "6 4" }} />}
                  {(units.data || []).map((u) => (
                    <CircleMarker key={u.code} center={[u.location.coordinates[1], u.location.coordinates[0]]} radius={11} pathOptions={{ color: "#fff", weight: 2, fillColor: UNIT_COLOR[u.code], fillOpacity: 1 }} eventHandlers={{ click: () => setOrigin({ kind: "unit", code: u.code }) }}>
                      <Tooltip permanent direction="top" offset={[0, -10]}>{u.name}</Tooltip>
                    </CircleMarker>
                  ))}
                  {patients.data.map((p) => {
                    const [lng, lat] = p.address.location.coordinates;
                    const hit = nearIds.has(p.patientId);
                    return (
                      <CircleMarker key={p.patientId} center={[lat, lng]} radius={hit ? 6 : 4} pathOptions={{ color: hit ? "#14171a" : "#fff", weight: hit ? 1.5 : 1, fillColor: UNIT_COLOR[p.preferredUnit], fillOpacity: hit ? 0.95 : 0.55 }}>
                        <Popup><b>{p.fullName}</b><br />{p.address.neighborhood} · unidade {UNIT_LABEL[p.preferredUnit]}<br />{p.chronicConditions?.map((c) => c.cid10).join(", ") || "sem condicoes cronicas"}<br /><Link to={`/pacientes/${p.patientId}`}>abrir prontuario</Link></Popup>
                      </CircleMarker>
                    );
                  })}
                </MapContainer>
              </div>
            )}
            <div className="legend-note row">{Object.entries(UNIT_LABEL).map(([k, v]) => <span key={k} className="row"><span style={{ width: 10, height: 10, borderRadius: 5, background: UNIT_COLOR[k], display: "inline-block" }} /> unidade preferida {v}</span>)}<span>· pontos destacados = dentro do raio</span></div>
          </Card>

          <Card title="Cobertura por unidade" subtitle="Um $geoNear por unidade, seguido de $bucket pela distancia: quantos pacientes moram a ate 1, 2, 5 e 10 km.">
            {coverage.loading ? <Loading /> : coverage.error ? <ErrorBox error={coverage.error} /> : (
              <div className="grid cols-3">
                {coverage.data.result.map((u) => (
                  <div key={u.unit}>
                    <h3 style={{ color: UNIT_COLOR[u.unit], marginBottom: 6 }}>{u.name}</h3>
                    <table><thead><tr><th>ate</th><th className="num">pacientes</th><th className="num">dist. media</th></tr></thead>
                      <tbody>{u.faixas.map((f) => <tr key={f.ateKm}><td>{f.ateKm === 999 ? "> 10 km" : `${f.ateKm} km`}</td><td className="num">{f.pacientes}</td><td className="num">{f.distanciaMediaKm} km</td></tr>)}</tbody></table>
                  </div>
                ))}
              </div>
            )}
            {coverage.data && <PipelineViewer report={{ pipeline: coverage.data.pipelineExample, collection: "prontuarios", tookMs: coverage.data.tookMs }} />}
          </Card>
        </div>
      </div>
    </>
  );
}
