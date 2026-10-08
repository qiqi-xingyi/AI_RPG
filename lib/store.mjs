import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';

export class SessionStore {
  constructor(directory) { this.directory = directory; this.sessions = new Map(); this.queue = Promise.resolve(); }
  async load() {
    await mkdir(this.directory, { recursive: true });
    try {
      const raw = JSON.parse(await readFile(join(this.directory, 'sessions.json'), 'utf8'));
      if (!Array.isArray(raw)) throw new Error('Invalid session store');
      this.sessions = new Map(raw.map(session => [session.id, session]));
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    return this;
  }
  get(id) { const session = this.sessions.get(id); return session ? structuredClone(session) : undefined; }
  async save(session) {
    const operation = this.queue.then(async () => {
      const next = new Map(this.sessions);
      next.set(session.id, structuredClone(session));
      const temporary = join(this.directory, 'sessions.json.tmp');
      await writeFile(temporary, JSON.stringify([...next.values()]), { mode: 0o600 });
      await rename(temporary, join(this.directory, 'sessions.json'));
      this.sessions = next;
    });
    this.queue = operation.catch(() => {});
    await operation;
  }
}
