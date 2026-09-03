import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard.jsx";
import Pacientes from "./pages/Pacientes.jsx";
import PacienteDetalhe from "./pages/PacienteDetalhe.jsx";
import Agenda from "./pages/Agenda.jsx";
import Busca from "./pages/Busca.jsx";
import Mapa from "./pages/Mapa.jsx";
import MongoLab from "./pages/MongoLab.jsx";

const NAV = [
  { section: "Clinica" },
  { to: "/dashboard", label: "Dashboard", icon: "📊" },
  { to: "/pacientes", label: "Pacientes", icon: "🧑‍⚕️" },
  { to: "/agenda", label: "Agenda", icon: "📅" },
  { section: "MongoDB Atlas" },
  { to: "/busca", label: "Busca (Atlas Search)", icon: "🔎" },
  { to: "/mapa", label: "Mapa (geoespacial)", icon: "🗺️" },
  { to: "/mongo", label: "Bastidores do Mongo", icon: "🍃" },
];

export default function App() {
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="logo">
          <span style={{ fontSize: 26 }}>🩺</span>
          <div>
            <b>MedFlow</b>
            <small>Gestao clinica distribuida</small>
          </div>
        </div>
        {NAV.map((item, i) =>
          item.section ? (
            <div key={i} className="section">{item.section}</div>
          ) : (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? "active" : "")}>
              <span>{item.icon}</span> {item.label}
            </NavLink>
          ),
        )}
        <div className="foot">
          Front-end React → api-gateway :8080 → Eureka → patient-service (PostgreSQL), appointment-service (PostgreSQL), medical-record-service (Node.js + MongoDB Atlas)
        </div>
      </aside>
      <main className="main">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/pacientes" element={<Pacientes />} />
          <Route path="/pacientes/:id" element={<PacienteDetalhe />} />
          <Route path="/agenda" element={<Agenda />} />
          <Route path="/busca" element={<Busca />} />
          <Route path="/mapa" element={<Mapa />} />
          <Route path="/mongo" element={<MongoLab />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  );
}
