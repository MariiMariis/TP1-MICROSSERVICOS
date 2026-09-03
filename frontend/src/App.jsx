import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard.jsx";
import Patients from "./pages/Patients.jsx";
import PatientDetail from "./pages/PatientDetail.jsx";
import Schedule from "./pages/Schedule.jsx";
import Search from "./pages/Search.jsx";
import Map from "./pages/Map.jsx";
import MongoLab from "./pages/MongoLab.jsx";

const NAV = [
  { section: "Clinic" },
  { to: "/dashboard", label: "Dashboard", icon: "📊" },
  { to: "/patients", label: "Patients", icon: "🧑‍⚕️" },
  { to: "/schedule", label: "Schedule", icon: "📅" },
  { section: "MongoDB Atlas" },
  { to: "/search", label: "Search (Atlas Search)", icon: "🔎" },
  { to: "/map", label: "Map (geospatial)", icon: "🗺️" },
  { to: "/mongo", label: "Behind the scenes", icon: "🍃" },
];

export default function App() {
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="logo">
          <span style={{ fontSize: 26 }}>🩺</span>
          <div>
            <b>MedFlow</b>
            <small>Distributed clinic management</small>
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
          React front-end → api-gateway :8080 → Eureka → patient-service (PostgreSQL), appointment-service (PostgreSQL), medical-record-service (Node.js + MongoDB Atlas)
        </div>
      </aside>
      <main className="main">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/patients" element={<Patients />} />
          <Route path="/patients/:id" element={<PatientDetail />} />
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/search" element={<Search />} />
          <Route path="/map" element={<Map />} />
          <Route path="/mongo" element={<MongoLab />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  );
}
