import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

function parseAllowedHosts(rawHosts) {
  return rawHosts
    .split(",")
    .map((host) => host.trim())
    .filter(Boolean);
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const allowedHosts = parseAllowedHosts(env.FRONTEND_ALLOWED_HOSTS || "");
  const server = {
    host: "0.0.0.0",
    port: 5173,
  };

  if (allowedHosts.length > 0) {
    server.allowedHosts = allowedHosts;
  }

  return {
    plugins: [react()],
    server,
  };
});
