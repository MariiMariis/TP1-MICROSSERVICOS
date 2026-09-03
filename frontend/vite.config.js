import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Em desenvolvimento o Vite faz proxy de /api para o api-gateway (porta 8080):
// o navegador so fala com uma origem e todas as chamadas passam pelo gateway,
// exatamente como um cliente externo faria.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: process.env.VITE_GATEWAY_URL || "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
});
