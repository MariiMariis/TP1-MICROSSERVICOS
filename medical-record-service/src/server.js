// medical-record-service - Prontuario eletronico do MedFlow em Node.js + Express + MongoDB Atlas.
//
// Mantem o contrato externo da Entrega 1 (/api/medical-records/**, porta 8083, registro no
// Eureka) e acrescenta as rotas da demonstracao do Atlas: prontuarios, busca, analytics,
// geoespacial e "bastidores" (explain, indices, schema validation).
import cors from "cors";
import express from "express";
import { config } from "./config.js";
import { close, connect, ensureSchema, ensureSearchIndexes, isAtlas, searchState, serverInfo } from "./db.js";
import { errorHandler } from "./errors.js";
import { startEureka } from "./eureka.js";
import { adminRouter } from "./routes/admin.js";
import { analyticsRouter } from "./routes/analytics.js";
import { atendimentosRouter } from "./routes/atendimentos.js";
import { geoRouter } from "./routes/geo.js";
import { prontuariosRouter } from "./routes/prontuarios.js";
import { searchRouter } from "./routes/search.js";
import { seedDatabase } from "./seed/seed.js";

const app = express();
app.disable("x-powered-by");
app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.use((req, res, next) => {
  const started = Date.now();
  res.on("finish", () => console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - started} ms)`));
  next();
});

// Endpoints "actuator", no mesmo formato dos servicos Spring, para o Eureka e para o 00-health.http.
app.get("/actuator/health", async (req, res) => {
  try {
    const info = await serverInfo();
    res.json({ status: "UP", components: { mongo: { status: "UP", details: info }, atlasSearch: searchState } });
  } catch (err) {
    res.status(503).json({ status: "DOWN", components: { mongo: { status: "DOWN", details: { error: err.message } } } });
  }
});
app.get("/actuator/info", (req, res) => {
  res.json({ app: { name: config.appName, responsibility: "Prontuario eletronico do paciente", database: `MongoDB ${isAtlas() ? "Atlas" : "local"} / ${config.mongoDb}`, runtime: `Node.js ${process.version}` } });
});
app.get("/", (req, res) => res.redirect("/actuator/info"));

// Ordem importa: os sub-caminhos vem antes do router que tem /:id.
const base = "/api/medical-records";
app.get(`${base}/info`, (req, res) => res.json({ service: config.appName, port: String(config.port), database: `MongoDB Atlas / ${config.mongoDb}`, runtime: `Node.js ${process.version}` }));
app.use(`${base}/patients`, prontuariosRouter);
app.use(`${base}/search`, searchRouter);
app.use(`${base}/analytics`, analyticsRouter);
app.use(`${base}/geo`, geoRouter);
app.use(`${base}/admin`, adminRouter);
app.use(base, atendimentosRouter);

app.use((req, res) => res.status(404).json({ timestamp: new Date().toISOString(), status: 404, error: "Not Found", message: `Rota ${req.method} ${req.originalUrl} nao existe`, path: req.originalUrl }));
app.use(errorHandler);

// ------------------------------------------------------------------ Boot
let eureka = null;
let server = null;

async function start() {
  await connect();
  const info = await serverInfo();
  console.log(`[db] conectado ao MongoDB ${info.version} (${info.atlas ? "Atlas" : "local"}), database ${info.database}`);
  await ensureSchema();
  if (config.seedOnStartup) await seedDatabase();

  // Indices do Atlas Search sao assincronos e demoram ~1 min: nao seguram a subida do servico.
  ensureSearchIndexes().then((report) => report.forEach((r) => console.log(`[search] ${r.collection}/${r.name}: ${r.status}${r.reason ? " - " + r.reason : ""}`)));

  server = app.listen(config.port, () => {
    console.log(`[http] ${config.appName} ouvindo em http://localhost:${config.port}${base}`);
    if (config.eureka.enabled) {
      eureka = startEureka({
        appName: config.appName,
        port: config.port,
        serviceUrl: config.eureka.serviceUrl,
        instanceIp: config.eureka.instanceIp,
        renewalIntervalSecs: config.eureka.renewalIntervalSecs,
        leaseDurationSecs: config.eureka.leaseDurationSecs,
        metadata: { database: `mongodb-${config.mongoDb}` },
      });
    } else {
      console.log("[eureka] desabilitado (EUREKA_ENABLED=false)");
    }
  });
}

async function shutdown(signal) {
  console.log(`\n[app] ${signal} recebido, encerrando...`);
  try {
    await eureka?.deregister();
    await new Promise((resolve) => (server ? server.close(resolve) : resolve()));
    await close();
  } finally {
    process.exit(0);
  }
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

start().catch((err) => {
  console.error("[app] falha ao iniciar:", err.message);
  if (/ENOTFOUND|ECONNREFUSED|Server selection timed out|authentication failed/i.test(err.message)) {
    console.error("[app] confira MONGODB_URI no arquivo .env e se o IP desta maquina esta liberado no Network Access do Atlas.");
  }
  process.exit(1);
});
