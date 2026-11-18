import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path';
import fs from 'node:fs';

/** Archivos de src/data que la app puede leer y escribir (patients y therapists solo los edita la vista de Personas). */
const WRITABLE = new Set(["sessions", "coordination", "opt_coordination", "opt_sessions", "patients", "therapists"]);
const READABLE = new Set([...WRITABLE, "patients", "therapists"]);

/** Mapas id -> valor: una entrada por línea (diffs legibles y archivos chicos aunque tengan miles de entradas). */
const stringify = (value: unknown) => {
      if (typeof value !== "object" || value === null || Array.isArray(value)) return JSON.stringify(value, null, 2) + "\n";
      const entries = Object.entries(value);
      if (entries.length === 0) return "{}\n";
      return "{\n" + entries.map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(",\n") + "\n}\n";
};

/**
 * API de persistencia mientras no hay backend: el navegador no puede escribir archivos, así que el servidor de
 * desarrollo expone GET/PUT /api/data/<archivo> sobre src/data/<archivo>.json. Solo funciona con `vite` (dev).
 */
function dataApi(): Plugin {
      const dir = path.resolve(import.meta.dirname, "src/data");
      return {
            name: "serviagenda-data-api",
            configureServer(server) {
                  server.middlewares.use("/api/data", (req, res, next) => {
                        const name = (req.url ?? "").replace(/^\//, "").split("?")[0];
                        const file = path.join(dir, `${name}.json`);
                        const send = (status: number, body: string) => {
                              res.statusCode = status;
                              res.setHeader("Content-Type", "application/json");
                              res.end(body);
                        };

                        if (!READABLE.has(name)) return next();

                        if (req.method === "GET") {
                              const text = fs.existsSync(file) ? fs.readFileSync(file, "utf8").trim() : "";
                              return send(200, text || "{}");
                        }

                        if (req.method === "PUT" && WRITABLE.has(name)) {
                              const chunks: Buffer[] = [];
                              req.on("data", (c) => chunks.push(c));
                              req.on("end", () => {
                                    try {
                                          const value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
                                          fs.writeFileSync(file, stringify(value), "utf8");
                                          send(200, JSON.stringify({ ok: true }));
                                    } catch (e) {
                                          send(400, JSON.stringify({ error: String(e) }));
                                    }
                              });
                              return;
                        }

                        send(405, JSON.stringify({ error: "Método no permitido" }));
                  });
            },
      };
}

export default defineConfig({
      plugins: [react(), tailwindcss(), dataApi()],
      resolve: {
            alias: {
                  '@' : path.resolve(import.meta.dirname, './src/frontend'),
                  '@core' : path.resolve(import.meta.dirname, './src/core'),
                  '@data' : path.resolve(import.meta.dirname, './src/data'),
            },
      },
      server: {
            // El backend Express (pnpm api:dev); /api/data sigue siendo del plugin de arriba (modo VITE_DATA_SOURCE=files)
            proxy: { "^/api/(agenda|users|health)": { target: process.env.API_URL ?? "http://localhost:3001", changeOrigin: true } },
            // Los JSON de src/data los escribe la propia app; no deben recargar la página
            watch: { ignored: ["**/src/data/{sessions,coordination,opt_coordination,opt_sessions}.json"] },
      },
})
