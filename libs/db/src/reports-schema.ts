import { integer, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { projects } from './schema';

const id = () => uuid('id').primaryKey().defaultRandom();
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

export const reportSettings = pgTable(
  'report_settings',
  {
    id: id(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull().default('va'), // va | ti
    primaryColor: text('primary_color').notNull().default('#069ec6'),
    secondaryColor: text('secondary_color').notNull().default('#08222b'),
    companyName: text('company_name'),
    companyAddress: text('company_address'),
    companyEmail: text('company_email'),
    companyWebsite: text('company_website'),
    documentNumber: text('document_number'),
    classification: text('classification'),
    footerText: text('footer_text'),
    language: text('language').notNull().default('en'),
    createdAt: createdAt(),
  },
  (t) => ({ uniqKind: uniqueIndex('report_settings_project_kind_uniq').on(t.projectId, t.kind) }),
);

export const reportSignatories = pgTable('report_signatories', {
  id: id(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  role: text('role').notNull(), // prepared | reviewed | approved
  name: text('name').notNull(),
  position: text('position').notNull().default(''),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: createdAt(),
});

export const reportsSchema = { reportSettings, reportSignatories };
