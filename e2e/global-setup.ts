import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const SERVER_DIR = path.join(__dirname, '..', 'server');
const DB_DIR = path.join(__dirname, '.tmp');
export const DB_FILE = path.join(DB_DIR, 'e2e.db');

export default function globalSetup(): void {
  fs.rmSync(DB_DIR, { recursive: true, force: true });
  fs.mkdirSync(DB_DIR, { recursive: true });

  execSync('npx prisma db push --skip-generate --accept-data-loss', {
    cwd: SERVER_DIR,
    env: { ...process.env, DATABASE_URL: `file:${DB_FILE}` },
    stdio: 'inherit',
  });
}
