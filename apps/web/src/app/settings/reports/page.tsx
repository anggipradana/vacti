import { redirect } from 'next/navigation';
import { desc, eq } from 'drizzle-orm';
import { AppShell } from '../../../components/shell/app-shell';
import { PageHeader } from '../../../components/ui/page-header';
import { SettingsTabs } from '../../../components/settings-tabs';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Textarea } from '../../../components/ui/textarea';
import { Label } from '../../../components/ui/label';
import { Select } from '../../../components/ui/select';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { projects, reportSettings, reportSignatories } from '@vacti/db';
import { getDb } from '../../../lib/db';
import { getCurrentUser } from '../../../lib/session';
import { saveReportSettingsAction, addSignatoryAction, deleteSignatoryAction } from '../../../lib/report-actions';
import { generateExecSummaryAction } from '../../../lib/ai-actions';

export const dynamic = 'force-dynamic';

const FIELDS: { name: string; label: string }[] = [
  { name: 'companyName', label: 'Company name' },
  { name: 'companyAddress', label: 'Address' },
  { name: 'companyWebsite', label: 'Website' },
  { name: 'companyEmail', label: 'Email' },
  { name: 'documentNumber', label: 'Document number' },
];

export default async function ReportSettingsPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const db = getDb();
  const projectRows = await db.select().from(projects).orderBy(desc(projects.createdAt));
  const sp = await searchParams;
  const projectId = sp.project ?? projectRows[0]?.id;

  if (!projectId) {
    return (
      <AppShell user={{ email: user.email, isSysAdmin: user.isSysAdmin }}>
        <PageHeader title="Settings" />
        <SettingsTabs active="/settings/reports" isSysAdmin={user.isSysAdmin} />
        <p className="text-sm text-fg-muted">Create a project first.</p>
      </AppShell>
    );
  }

  const [allSettings, signatories] = await Promise.all([
    db.select().from(reportSettings).where(eq(reportSettings.projectId, projectId)),
    db.select().from(reportSignatories).where(eq(reportSignatories.projectId, projectId)),
  ]);
  const get = (kind: string) => allSettings.find((s) => s.kind === kind);

  const brandingForm = (kind: 'va' | 'ti') => {
    const s = get(kind);
    return (
      <Card>
        <CardHeader>
          <CardTitle>{kind === 'va' ? 'VA report branding' : 'TI report branding'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={saveReportSettingsAction} className="space-y-3">
            <input type="hidden" name="projectId" value={projectId} />
            <input type="hidden" name="kind" value={kind} />
            {FIELDS.map((f) => (
              <div key={f.name} className="space-y-1">
                <Label htmlFor={`${kind}-${f.name}`}>{f.label}</Label>
                <Input
                  id={`${kind}-${f.name}`}
                  name={f.name}
                  defaultValue={(s?.[f.name as keyof typeof s] as string) ?? ''}
                />
              </div>
            ))}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label htmlFor={`${kind}-primary`}>Primary (teal)</Label>
                <Input
                  id={`${kind}-primary`}
                  name="primaryColor"
                  type="color"
                  className="h-9 p-1"
                  defaultValue={s?.primaryColor ?? '#069ec6'}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`${kind}-secondary`}>Cover (navy)</Label>
                <Input
                  id={`${kind}-secondary`}
                  name="secondaryColor"
                  type="color"
                  className="h-9 p-1"
                  defaultValue={s?.secondaryColor ?? '#08222b'}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`${kind}-lang`}>Language</Label>
                <Select id={`${kind}-lang`} name="language" defaultValue={s?.language ?? 'en'}>
                  <option value="en">English</option>
                  <option value="id">Indonesia</option>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${kind}-classif`}>Classification</Label>
              <Input
                id={`${kind}-classif`}
                name="classification"
                defaultValue={s?.classification ?? 'CONFIDENTIAL — FOR INTERNAL USE ONLY'}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${kind}-footer`}>Footer text</Label>
              <Input id={`${kind}-footer`} name="footerText" defaultValue={s?.footerText ?? 'CONFIDENTIAL'} />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${kind}-logo`}>Company logo (cover)</Label>
              {s?.companyLogo ? (
                <div className="flex items-center gap-3">
                  <img
                    src={s.companyLogo}
                    alt="logo"
                    className="h-9 max-w-[120px] rounded border border-border object-contain"
                  />
                  <label className="flex items-center gap-1.5 text-xs text-fg-muted">
                    <input type="checkbox" name="removeLogo" /> Remove
                  </label>
                </div>
              ) : null}
              <Input id={`${kind}-logo`} name="companyLogoFile" type="file" accept="image/*" className="h-9 py-1.5" />
              <p className="text-xs text-fg-subtle">PNG/SVG/JPG, ≤ 600 KB. Falls back to a monogram.</p>
            </div>
            {kind === 'va' ? (
              <div className="space-y-2 rounded-md border border-border p-3">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    name="showExecutiveSummary"
                    defaultChecked={s?.showExecutiveSummary ?? false}
                  />
                  Use custom executive summary
                </label>
                <p className="text-xs text-fg-subtle">
                  Placeholders: {'{company_name}'} {'{target_name}'} {'{subdomain_count}'} {'{vulnerability_count}'}{' '}
                  {'{critical_count}'} {'{high_count}'} {'{active_count}'} {'{scan_date}'}
                </p>
                <Textarea
                  name="executiveSummary"
                  rows={4}
                  placeholder="Executive summary (English)…"
                  defaultValue={s?.executiveSummary ?? ''}
                />
                <Textarea
                  name="executiveSummaryId"
                  rows={4}
                  placeholder="Ringkasan eksekutif (Indonesia)…"
                  defaultValue={s?.executiveSummaryId ?? ''}
                />
              </div>
            ) : null}
            <Button type="submit">Save</Button>
          </form>
          {kind === 'va' ? (
            <form action={generateExecSummaryAction} className="mt-3 border-t border-border pt-3">
              <input type="hidden" name="projectId" value={projectId} />
              <Button type="submit" variant="outline" size="sm">
                Generate executive summary with AI
              </Button>
              <p className="mt-1 text-xs text-fg-subtle">
                Uses the latest scan + configured AI provider; fills both EN/ID and enables the custom summary.
              </p>
            </form>
          ) : null}
        </CardContent>
      </Card>
    );
  };

  return (
    <AppShell user={{ email: user.email, isSysAdmin: user.isSysAdmin }}>
      <PageHeader title="Settings" description="Report branding, signatories, and document control." />
      <SettingsTabs active="/settings/reports" isSysAdmin={user.isSysAdmin} />
      <div className="grid gap-4 lg:grid-cols-2">
        {brandingForm('va')}
        {brandingForm('ti')}
      </div>

      <h2 className="mb-3 mt-8 font-display text-sm font-semibold uppercase tracking-wider text-fg-subtle">
        Signatories (Prepared / Reviewed / Approved)
      </h2>
      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <Card>
          <CardContent className="pt-5">
            <form action={addSignatoryAction} className="space-y-3">
              <input type="hidden" name="projectId" value={projectId} />
              <div className="space-y-1">
                <Label htmlFor="role">Role</Label>
                <Select id="role" name="role">
                  <option value="prepared">Prepared By</option>
                  <option value="reviewed">Reviewed By</option>
                  <option value="approved">Approved By</option>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="signame">Name</Label>
                <Input id="signame" name="name" required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="sigpos">Position</Label>
                <Input id="sigpos" name="position" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="sigimg">Signature image</Label>
                <Input id="sigimg" name="signatureImageFile" type="file" accept="image/*" className="h-9 py-1.5" />
              </div>
              <Button type="submit" className="w-full">
                Add signatory
              </Button>
            </form>
          </CardContent>
        </Card>
        <div className="space-y-2">
          {signatories.length === 0 ? (
            <Card>
              <CardContent className="py-5 text-sm text-fg-muted">No signatories yet.</CardContent>
            </Card>
          ) : (
            signatories
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((s) => (
                <Card key={s.id}>
                  <CardContent className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      {s.signatureImage ? (
                        <img src={s.signatureImage} alt="" className="h-8 max-w-[80px] object-contain" />
                      ) : null}
                      <div>
                        <span className="font-medium">{s.name}</span>{' '}
                        <span className="text-fg-subtle">{s.position}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="accent">{s.role}</Badge>
                      <form action={deleteSignatoryAction}>
                        <input type="hidden" name="id" value={s.id} />
                        <Button type="submit" variant="ghost" size="sm" className="text-danger hover:bg-danger/10">
                          Remove
                        </Button>
                      </form>
                    </div>
                  </CardContent>
                </Card>
              ))
          )}
        </div>
      </div>
    </AppShell>
  );
}
