export class CloudStore {
  constructor(db) { this.db = db; }
  async get(id) {
    const row = await this.db.prepare('SELECT state FROM game_sessions WHERE id = ?').bind(id).first();
    return row ? JSON.parse(row.state) : undefined;
  }
  async create(session, visitor) {
    await this.db.prepare('INSERT INTO game_sessions (id, version, visitor, state, updated_at) VALUES (?, ?, ?, ?, ?)')
      .bind(session.id, session.version, visitor, JSON.stringify(session), Date.now()).run();
  }
  async lease(id, version, leaseId) {
    return this.db.prepare('UPDATE game_sessions SET lease_id = ?, lease_until = ? WHERE id = ? AND version = ? AND (lease_until IS NULL OR lease_until < ?) RETURNING id')
      .bind(leaseId, Date.now() + 90000, id, version, Date.now()).first();
  }
  async commit(session, leaseId) {
    return this.db.prepare('UPDATE game_sessions SET state = ?, version = ?, updated_at = ?, lease_id = NULL, lease_until = NULL WHERE id = ? AND lease_id = ? RETURNING id')
      .bind(JSON.stringify(session), session.version, Date.now(), session.id, leaseId).first();
  }
  async release(id, leaseId) {
    await this.db.prepare('UPDATE game_sessions SET lease_id = NULL, lease_until = NULL WHERE id = ? AND lease_id = ?').bind(id, leaseId).run();
  }
  async consume(bucket, maximum, expiresAt) {
    const row = await this.db.prepare(`INSERT INTO usage_buckets (bucket, used, expires_at) VALUES (?, 1, ?)
      ON CONFLICT(bucket) DO UPDATE SET used = usage_buckets.used + 1 WHERE usage_buckets.used < ? RETURNING used`)
      .bind(bucket, expiresAt, maximum).first();
    return !!row;
  }
  async cleanup() { await this.db.prepare('DELETE FROM usage_buckets WHERE expires_at < ?').bind(Date.now() - 86400000).run(); }
}
