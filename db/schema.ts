import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const gameSessions = sqliteTable('game_sessions', {
  id: text('id').primaryKey(), version: integer('version').notNull(), visitor: text('visitor').notNull(),
  state: text('state').notNull(), updatedAt: integer('updated_at').notNull(),
  leaseId: text('lease_id'), leaseUntil: integer('lease_until'),
});
export const usageBuckets = sqliteTable('usage_buckets', {
  bucket: text('bucket').primaryKey(), used: integer('used').notNull(), expiresAt: integer('expires_at').notNull(),
});
