import { boolean, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { projects } from './schema';

const id = () => uuid('id').primaryKey().defaultRandom();
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

export const webhooks = pgTable('webhooks', {
  id: id(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  channel: text('channel').notNull(), // discord | slack | telegram | google_chat | generic
  label: text('label'),
  url: text('url'),
  telegramToken: text('telegram_token'),
  telegramChatId: text('telegram_chat_id'),
  events: text('events').array().notNull().default([]), // empty = all
  enabled: boolean('enabled').notNull().default(true),
  createdAt: createdAt(),
});

export const aiSettings = pgTable('ai_settings', {
  id: id(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' })
    .unique(),
  provider: text('provider').notNull().default('anthropic'), // anthropic | openai | ollama
  model: text('model').notNull().default('claude-sonnet-4-6'),
  // Optional override endpoint for Anthropic/OpenAI-compatible gateways (e.g. a local proxy,
  // LiteLLM, claude-code-router). Blank = the provider's default cloud endpoint.
  baseUrl: text('base_url'),
  createdAt: createdAt(),
});

export const aiCache = pgTable('ai_cache', {
  id: id(),
  hash: text('hash').notNull().unique(),
  kind: text('kind').notNull(),
  output: text('output').notNull(),
  createdAt: createdAt(),
});

export const integrationsSchema = { webhooks, aiSettings, aiCache };
