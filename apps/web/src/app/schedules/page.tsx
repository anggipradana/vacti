import { redirect } from 'next/navigation';
import { desc, eq } from 'drizzle-orm';
import { CalendarClock } from 'lucide-react';
import { AppShell } from '../../components/shell/app-shell';
import { PageHeader } from '../../components/ui/page-header';
import { Card, CardContent } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Button } from '../../components/ui/button';
import { SubmitButton } from '../../components/ui/submit-button';
import { Select } from '../../components/ui/select';
import { Badge } from '../../components/ui/badge';
import { EmptyState } from '../../components/ui/empty-state';
import { userCan, Permission } from '@vacti/core';
import { targets, scanProfiles, scanSchedules, projects } from '@vacti/db';
import { getDb } from '../../lib/db';
import { getCurrentUser } from '../../lib/session';
import { createScheduleAction, toggleScheduleAction, deleteScheduleAction } from '../../lib/recon-actions';
import { ProjectSwitcher } from '../../components/project-switcher';
import { getActiveProjectId } from '../../lib/active-project';

export const dynamic = 'force-dynamic';

const PRESETS = [
  { label: 'Daily 02:00', cron: '0 2 * * *' },
  { label: 'Weekly (Mon 02:00)', cron: '0 2 * * 1' },
  { label: 'Every 6 hours', cron: '0 */6 * * *' },
  { label: 'Hourly', cron: '0 * * * *' },
];

export default async function SchedulesPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const canManage = userCan(user, Permission.InitiateScans);
  const db = getDb();
  const projectRows = await db.select().from(projects).orderBy(desc(projects.createdAt));
  const projectId = await getActiveProjectId((await searchParams).project, projectRows);
  // Schedules have no projectId of their own, so scope them via the active project's targets.
  const [targetRows, profileRows, allSchedules] = await Promise.all([
    projectId
      ? db.select().from(targets).where(eq(targets.projectId, projectId)).orderBy(desc(targets.createdAt))
      : Promise.resolve([]),
    db.select().from(scanProfiles),
    db.select().from(scanSchedules).orderBy(desc(scanSchedules.createdAt)),
  ]);
  const targetById = new Map(targetRows.map((t) => [t.id, t.domain]));
  const scheduleRows = allSchedules.filter((s) => targetById.has(s.targetId));

  return (
    <AppShell user={{ email: user.email, isSysAdmin: user.isSysAdmin }}>
      <PageHeader
        title="Scheduled scans"
        description="Recurring scans via a lightweight cron tick (local server time)."
        actions={<ProjectSwitcher projects={projectRows} current={projectId} basePath="/schedules" />}
      />

      {canManage ? (
        <Card className="mb-6">
          <CardContent className="pt-5">
            <form action={createScheduleAction} className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_1.2fr_auto]">
              <div className="space-y-1">
                <Label htmlFor="targetId">Target</Label>
                <Select id="targetId" name="targetId" required>
                  {targetRows.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.domain}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="profileId">Profile (optional)</Label>
                <Select id="profileId" name="profileId">
                  <option value="">Default</option>
                  {profileRows.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="cron">Cron (min hour dom mon dow)</Label>
                <Input id="cron" name="cron" defaultValue="0 2 * * *" list="cron-presets" required />
                <datalist id="cron-presets">
                  {PRESETS.map((p) => (
                    <option key={p.cron} value={p.cron}>
                      {p.label}
                    </option>
                  ))}
                </datalist>
              </div>
              <SubmitButton pendingText="Adding…">Add schedule</SubmitButton>
            </form>
            <p className="mt-2 text-xs text-fg-subtle">
              Presets: {PRESETS.map((p) => `${p.label} = ${p.cron}`).join(' · ')}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {scheduleRows.length === 0 ? (
        <EmptyState icon={<CalendarClock />} title="No schedules" description="Add a recurring scan above." />
      ) : (
        <div className="space-y-2">
          {scheduleRows.map((s) => (
            <Card key={s.id} data-testid="schedule-row">
              <CardContent className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <span className="font-mono text-sm">{targetById.get(s.targetId) ?? s.targetId.slice(0, 8)}</span>
                  <span className="ml-3 font-mono text-xs text-fg-muted">{s.cron}</span>
                  {s.lastRunAt ? (
                    <span className="ml-3 text-xs text-fg-subtle">
                      last run {new Date(s.lastRunAt).toISOString().slice(0, 16).replace('T', ' ')}
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={s.enabled ? 'accent' : 'neutral'}>{s.enabled ? 'enabled' : 'paused'}</Badge>
                  {canManage ? (
                    <>
                      <form action={toggleScheduleAction}>
                        <input type="hidden" name="id" value={s.id} />
                        <Button type="submit" variant="outline" size="sm">
                          {s.enabled ? 'Pause' : 'Enable'}
                        </Button>
                      </form>
                      <form action={deleteScheduleAction}>
                        <input type="hidden" name="id" value={s.id} />
                        <Button type="submit" variant="ghost" size="sm" className="text-danger hover:bg-danger/10">
                          Delete
                        </Button>
                      </form>
                    </>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}
