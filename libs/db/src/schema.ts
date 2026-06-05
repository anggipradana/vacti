import { sql } from 'drizzle-orm';
import { boolean, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

const id = () => uuid('id').primaryKey().defaultRandom();
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();

export const users = pgTable('users', {
  id: id(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  isSysAdmin: boolean('is_sys_admin').notNull().default(false),
  // Global RBAC role (RoleName from @vacti/core). Source of truth for permission checks.
  role: text('role').notNull().default('PenetrationTester'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: createdAt(),
});

export const apiTokens = pgTable('api_tokens', {
  id: id(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  label: text('label').notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  scopes: text('scopes')
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  createdAt: createdAt(),
});

export const projects = pgTable('projects', {
  id: id(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  // Chosen sector for the threat-news feed (SectorName from @vacti/threat-intel).
  sector: text('sector').notNull().default('banking'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** Aggregated sector security-news (RSS), keyed by sector + link. */
export const threatNews = pgTable(
  'threat_news',
  {
    id: id(),
    sector: text('sector').notNull(),
    title: text('title').notNull(),
    link: text('link').notNull(),
    source: text('source').notNull(),
    summary: text('summary'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    // Triage status (NewsStatus from @vacti/core) — preserved across feed refreshes.
    status: text('status').notNull().default('new'),
    fetchedAt: createdAt(),
  },
  (t) => ({ uniqSectorLink: uniqueIndex('threat_news_sector_link_uniq').on(t.sector, t.link) }),
);

// Brand monitoring: public news mentioning a project's brand/domain (per project, triageable).
export const brandNews = pgTable(
  'brand_news',
  {
    id: id(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    link: text('link').notNull(),
    source: text('source').notNull(),
    summary: text('summary'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    // Whether the headline came from the security-biased query (vs a general brand mention).
    security: boolean('security').notNull().default(false),
    // Triage status (NewsStatus from @vacti/core) — preserved across feed refreshes.
    status: text('status').notNull().default('new'),
    fetchedAt: createdAt(),
  },
  (t) => ({ uniqProjectLink: uniqueIndex('brand_news_project_link_uniq').on(t.projectId, t.link) }),
);

export const projectMembers = pgTable(
  'project_members',
  {
    id: id(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // RoleName from @vacti/core (SysAdmin | PenetrationTester | Auditor)
    role: text('role').notNull(),
    createdAt: createdAt(),
  },
  (t) => ({ uniqMember: uniqueIndex('project_members_project_user_uniq').on(t.projectId, t.userId) }),
);

export const apiKeys = pgTable('api_keys', {
  id: id(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  // AES-256-GCM ciphertext (see @vacti/auth vault). Never stored in plaintext.
  ciphertext: text('ciphertext').notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const auditLog = pgTable('audit_log', {
  id: id(),
  actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
  action: text('action').notNull(),
  resource: text('resource').notNull(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
  metadata: jsonb('metadata'),
  createdAt: createdAt(),
});

export const schema = {
  users,
  sessions,
  apiTokens,
  projects,
  projectMembers,
  apiKeys,
  auditLog,
  threatNews,
  brandNews,
};
