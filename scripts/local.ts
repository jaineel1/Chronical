// Runs Chronicle as a local laptop app: pulls the latest code from GitHub, rebuilds, and serves the build
// at http://chronicle.localhost (Edge and Chrome send every *.localhost name to this machine, no setup).
// Keep the name and PORT fixed: the browser keys Chronicle's IndexedDB data to that exact address, so a
// different one is a different, empty app. Install the page once from Edge/Chrome (Install app); the
// installed app then works offline, and each run of this script delivers the latest pushed code to it.
// Usage: npm run local
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { connect } from 'node:net';
import { fileURLToPath } from 'node:url';

const PORT = 80;
const URL_NAME = 'http://chronicle.localhost/';
const root = fileURLToPath(new URL('..', import.meta.url));

function run(command: string): void {
  console.log(`\n> ${command}`);
  const result = spawnSync(command, { cwd: root, stdio: 'inherit', shell: true });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`"${command}" failed with exit code ${result.status}`);
}

function read(command: string): string {
  const result = spawnSync(command, { cwd: root, encoding: 'utf8', shell: true });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`"${command}" failed: ${result.stderr.trim()}`);
  return result.stdout.trim();
}

function portInUse(port: number): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const socket = connect({ port, host: 'localhost' });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'ECONNREFUSED') resolve(false);
      else reject(err);
    });
  });
}

if (await portInUse(PORT)) {
  throw new Error(`Port ${PORT} is already in use. Chronicle is probably running already; close that window and run this again.`);
}

const lockBefore = read('git rev-parse HEAD:package-lock.json');
run('git pull --ff-only');
const lockAfter = read('git rev-parse HEAD:package-lock.json');

if (lockBefore !== lockAfter || !existsSync(new URL('../node_modules', import.meta.url))) {
  run('npm ci');
}

// Tests before the build: if they fail, dist/ keeps the last good version and the installed app,
// which runs from its offline cache, keeps working as it was.
try {
  run('npm test');
} catch (e) {
  throw new Error('Tests failed, so this update was not installed. The installed app keeps the previous version.', { cause: e });
}
run('npm run build');
run(`npx vite preview --port ${PORT} --strictPort --open ${URL_NAME}`);
