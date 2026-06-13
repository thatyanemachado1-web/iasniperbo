const DEFAULT_FRONTEND_PORT = 5175;
const DEFAULT_SIGNALS_API_PORT = 8787;

function readPort(value: unknown, fallback: number) {
  const port = Number(value);
  return Number.isInteger(port) && port > 0 && port <= 65535 ? port : fallback;
}

export const FRONTEND_PORT = readPort(import.meta.env.VITE_FRONTEND_PORT, DEFAULT_FRONTEND_PORT);
export const SIGNALS_API_PORT = readPort(import.meta.env.VITE_SIGNALS_API_PORT, DEFAULT_SIGNALS_API_PORT);

export const LOCAL_FRONTEND_ORIGIN = `http://127.0.0.1:${FRONTEND_PORT}`;
export const LOCAL_SIGNALS_API_BASE_URL = `http://127.0.0.1:${SIGNALS_API_PORT}`;
