import fs from 'fs';
import path from 'path';

/**
 * Configuración por ambiente (ADR-001 §2.8).
 * TEST_ENV elige el archivo e2e/.env.<TEST_ENV> (por defecto e2e/.env si existe).
 * Las variables de entorno del proceso tienen prioridad sobre el archivo.
 */
function cargarEnv(): Record<string, string> {
  const nombre = process.env.TEST_ENV ? `.env.${process.env.TEST_ENV}` : '.env';
  const archivo = path.join(__dirname, '..', nombre);
  if (!fs.existsSync(archivo)) return {};
  const vars: Record<string, string> = {};
  for (const linea of fs.readFileSync(archivo, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(linea);
    if (m && m[2] !== '') vars[m[1]] = m[2];
  }
  return vars;
}

const archivo = cargarEnv();
const leer = (clave: string, porDefecto: string): string => process.env[clave] ?? archivo[clave] ?? porDefecto;

export const env = {
  BASE_URL: leer('BASE_URL', 'http://localhost:5173'),
  API_URL: leer('API_URL', 'http://localhost:3000/api'),
  /** Contraseña de los usuarios que crean las factories (8+ caracteres, letra y número). */
  TEST_USER_PASSWORD: leer('TEST_USER_PASSWORD', 'Passw0rd1'),
  /** Zona horaria de navegador y servidor: BUG-03 solo aparece al oeste de UTC. */
  TIMEZONE: leer('TEST_TIMEZONE', 'America/Montevideo'),
};
