// Configuracao externalizada, no mesmo espirito do ${VARIAVEL:padrao} dos servicos Java.
import "dotenv/config";

const bool = (value, fallback) => (value === undefined || value === "" ? fallback : value === "true");

export const config = {
  appName: process.env.APP_NAME || "medical-record-service",
  port: Number(process.env.PORT || 8083),

  mongoUri: process.env.MONGODB_URI || "mongodb://medflow:medflow@localhost:27017/?authSource=admin",
  mongoDb: process.env.MONGODB_DB || "medflow_medical_records",

  eureka: {
    enabled: bool(process.env.EUREKA_ENABLED, true),
    serviceUrl: (process.env.EUREKA_SERVICE_URL || "http://localhost:8761/eureka/").replace(/\/+$/, ""),
    instanceIp: process.env.EUREKA_INSTANCE_IP || "",
    renewalIntervalSecs: 5,
    leaseDurationSecs: 10,
  },

  seedOnStartup: bool(process.env.SEED_ON_STARTUP, true),
};

export const COLLECTIONS = {
  prontuarios: "prontuarios",
  atendimentos: "atendimentos",
};

// Unidades da rede MedFlow em Sao Paulo (GeoJSON usa [longitude, latitude]).
export const UNITS = [
  { code: "PINHEIROS", name: "MedFlow Pinheiros", address: "Rua dos Pinheiros, 1000 - Pinheiros", location: { type: "Point", coordinates: [-46.6917, -23.5646] } },
  { code: "MOEMA", name: "MedFlow Moema", address: "Av. Ibirapuera, 2300 - Moema", location: { type: "Point", coordinates: [-46.6650, -23.6010] } },
  { code: "TATUAPE", name: "MedFlow Tatuape", address: "Rua Tuiuti, 500 - Tatuape", location: { type: "Point", coordinates: [-46.5760, -23.5400] } },
];

export const RECORD_TYPES = ["CONSULTA", "EXAME", "PROCEDIMENTO", "INTERNACAO", "VACINA"];
