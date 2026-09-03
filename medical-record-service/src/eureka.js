// Cliente Eureka minimo, escrito sobre a API REST do Netflix Eureka.
//
// O servico Node faz exatamente o que o spring-cloud-starter-netflix-eureka-client faz
// nos servicos Java: registra a instancia, envia heartbeat a cada 5s e se remove ao
// encerrar. Assim o api-gateway continua resolvendo lb://medical-record-service sem
// saber (nem precisar saber) que este servico nao e mais Java.
//
// Referencia: https://github.com/Netflix/eureka/wiki/Eureka-REST-operations
import os from "node:os";

function detectIp() {
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    if (/virtual|vethernet|vmware|wsl|docker/i.test(name)) continue;
    for (const a of addrs) if (a.family === "IPv4" && !a.internal) return a.address;
  }
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const a of addrs) if (a.family === "IPv4" && !a.internal) return a.address;
  }
  return "127.0.0.1";
}

export function startEureka({ appName, port, serviceUrl, instanceIp, renewalIntervalSecs, leaseDurationSecs, metadata = {} }) {
  const app = appName.toUpperCase();
  const ip = instanceIp || detectIp();
  const hostName = os.hostname();
  const instanceId = `${ip}:${appName}:${port}`;
  const base = `http://${ip}:${port}`;
  const appsUrl = `${serviceUrl}/apps/${app}`;
  const instanceUrl = `${appsUrl}/${encodeURIComponent(instanceId)}`;

  const body = {
    instance: {
      instanceId,
      hostName: ip,
      app,
      ipAddr: ip,
      vipAddress: appName,
      secureVipAddress: appName,
      status: "UP",
      port: { $: port, "@enabled": "true" },
      securePort: { $: 443, "@enabled": "false" },
      homePageUrl: `${base}/`,
      statusPageUrl: `${base}/actuator/info`,
      healthCheckUrl: `${base}/actuator/health`,
      dataCenterInfo: { "@class": "com.netflix.appinfo.InstanceInfo$DefaultDataCenterInfo", name: "MyOwn" },
      leaseInfo: { renewalIntervalInSecs: renewalIntervalSecs, durationInSecs: leaseDurationSecs },
      metadata: { runtime: `node ${process.version}`, ...metadata },
    },
  };

  const state = { registered: false, instanceId, ip, timer: null, stopped: false };

  async function register() {
    const res = await fetch(appsUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(4000),
    });
    if (res.status !== 204 && res.status !== 200) throw new Error(`Eureka respondeu ${res.status}`);
    state.registered = true;
    console.log(`[eureka] registrado como ${app} (${instanceId}) em ${serviceUrl}`);
  }

  async function heartbeat() {
    if (state.stopped) return;
    try {
      if (!state.registered) {
        await register();
        return;
      }
      const res = await fetch(`${instanceUrl}?status=UP`, { method: "PUT", signal: AbortSignal.timeout(4000) });
      if (res.status === 404) {
        // O Eureka reiniciou ou expirou o lease: registra de novo.
        state.registered = false;
        await register();
      } else if (!res.ok) {
        throw new Error(`heartbeat respondeu ${res.status}`);
      }
    } catch (err) {
      if (state.registered) console.warn(`[eureka] heartbeat falhou: ${err.message}`);
      else console.warn(`[eureka] discovery-server indisponivel em ${serviceUrl} (${err.message}); tentando novamente...`);
      state.registered = false;
    }
  }

  async function deregister() {
    state.stopped = true;
    clearInterval(state.timer);
    if (!state.registered) return;
    try {
      await fetch(instanceUrl, { method: "DELETE", signal: AbortSignal.timeout(3000) });
      console.log("[eureka] instancia removida do registro");
    } catch (err) {
      console.warn(`[eureka] falha ao remover registro: ${err.message}`);
    }
  }

  heartbeat();
  state.timer = setInterval(heartbeat, renewalIntervalSecs * 1000);
  state.timer.unref();

  return { deregister, state };
}
