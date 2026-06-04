import { boolean, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { projects } from './schema';

const id = () => uuid('id').primaryKey().defaultRandom();
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

export const manualIndicators = pgTable('manual_indicators', {
  id: id(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  type: text('type').notNull(), // domain | subdomain | ip
  value: text('value').notNull(),
  note: text('note'),
  createdAt: createdAt(),
});

export const otxThreatData = pgTable('otx_threat_data', {
  id: id(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  indicator: text('indicator').notNull(),
  pulses: integer('pulses').notNull().default(0),
  malwareCount: integer('malware_count').notNull().default(0),
  reputation: integer('reputation').notNull().default(0), // 0..100, higher = worse
  passiveDns: jsonb('passive_dns'),
  urls: jsonb('urls'),
  fetchedAt: createdAt(),
});

export const leakcheckData = pgTable('leakcheck_data', {
  id: id(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  domain: text('domain').notNull(),
  source: text('source'),
  identifier: text('identifier'), // email/username (display)
  hashMd5: text('hash_md5').notNull(),
  type: text('type').notNull().default('domain'), // domain | origin (stealer log)
  checked: boolean('checked').notNull().default(false), // legacy; superseded by status
  // Leak triage status (new|investigating|confirmed|remediated|false_positive|ignored).
  status: text('status').notNull().default('new'),
  createdAt: createdAt(),
});

export const threatIntelStatus = pgTable(
  'threat_intel_status',
  {
    id: id(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    state: text('state').notNull().default('idle'), // idle | running | completed | failed
    progress: integer('progress').notNull().default(0),
    message: text('message'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ uniqProject: uniqueIndex('threat_intel_status_project_uniq').on(t.projectId) }),
);

export const threatIntelReportSetting = pgTable(
  'threat_intel_report_setting',
  {
    id: id(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    logoUrl: text('logo_url'),
    brandColor: text('brand_color'),
    docNumber: text('doc_number'),
    classification: text('classification'),
    signatory: text('signatory'),
    createdAt: createdAt(),
  },
  (t) => ({ uniqProject: uniqueIndex('ti_report_setting_project_uniq').on(t.projectId) }),
);

export const threatIntelSchema = {
  manualIndicators,
  otxThreatData,
  leakcheckData,
  threatIntelStatus,
  threatIntelReportSetting,
};
