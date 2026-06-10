import { redirect } from 'next/navigation';
import { desc, eq, getTableColumns } from 'drizzle-orm';
import { CalendarClock } from 'lucide-react';
import { Card, CardContent } from '../../../../components/ui/card';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { SubmitButton } from '../../../../components/ui/submit-button';
import { Select } from '../../../../components/ui/select';
import { Badge } from '../../../../components/ui/badge';
import { EmptyState } from '../../../../components/ui/empty-state';
import { userCan, Permission } from '@vacti/core';
import { targets, scanProfiles, scanSchedules, projects } from '@vacti/db';
import { getDb } from '../../../../lib/db';
import { getCurrentUser } from '../../../../lib/session';
import {
  createScheduleAction,
  editScheduleAction,
  toggleScheduleAction,
  deleteScheduleAction,
} from '../../../../lib/recon-actions';
import { ProjectSwitcher } from '../../../../components/project-switcher';
import { getActiveProjectId } from '../../../../lib/active-project';

export const dynamic = 'force-dynamic';

export default async function SchedulesPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const canManage = userCan(user, Permission.InitiateScans);
  const db = getDb();
  const projectRows = await db.select().from(projects).orderBy(desc(projects.createdAt));
  const projectId = await getActiveProjectId((await searchParams).project, projectRows);
  // Schedules have no projectId of their own, so scope them via the active project's targets with an
  // inner join - only this project's schedules are fetched (no load-all + JS filter), and the join also
  // gives us each schedule's target domain for display.
  const [targetRows, profileRows, scheduleJoinRows] = await Promise.all([
    projectId
      ? db.select().from(targets).where(eq(targets.projectId, projectId)).orderBy(desc(targets.createdAt))
      : Promise.resolve([]),
    db.select().from(scanProfiles),
    projectId
      ? db
          .select({ ...getTableColumns(scanSchedules), domain: targets.domain })
          .from(scanSchedules)
          .innerJoin(targets, eq(scanSchedules.targetId, targets.id))
          .where(eq(targets.projectId, projectId))
          .orderBy(desc(scanSchedules.createdAt))
      : Promise.resolve([]),
  ]);
  const scheduleRows = scheduleJoinRows;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-fg-muted">
          Recurring scans via a lightweight cron tick. Times are WIB (Asia/Jakarta).
        </p>
        <ProjectSwitcher projects={projectRows} current={projectId} basePath="/settings/schedules" />
      </div>

      {canManage ? (
        <Card className="mb-6">
          <CardContent className="pt-5">
            <form action={createScheduleAction} className="grid items-end gap-3 sm:grid-cols-3 lg:grid-cols-6">
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
                <Label htmlFor="profileId">Profile</Label>
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
                <Label htmlFor="freq">Frequency</Label>
                <Select id="freq" name="freq" defaultValue="daily">
                  <option value="hourly">Hourly</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="time">Time</Label>
                <Input id="time" name="time" type="time" defaultValue="02:00" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="dow">Day (weekly)</Label>
                <Select id="dow" name="dow" defaultValue="1">
                  {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((d, i) => (
                    <option key={d} value={i}>
                      {d}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="dom">Date (monthly)</Label>
                <Select id="dom" name="dom" defaultValue="1">
                  {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </Select>
              </div>
              <SubmitButton pendingText="Adding…" className="lg:col-span-6">
                Add schedule
              </SubmitButton>
            </form>
            <p className="mt-2 text-xs text-fg-subtle">
              Pick a frequency and time. Day applies to Weekly; Date applies to Monthly. Times are WIB (Asia/Jakarta).
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
              <CardContent className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="font-mono text-sm">{s.domain ?? s.targetId.slice(0, 8)}</span>
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
                          <SubmitButton variant="outline" size="sm">
                            {s.enabled ? 'Pause' : 'Enable'}
                          </SubmitButton>
                        </form>
                        <form action={deleteScheduleAction}>
                          <input type="hidden" name="id" value={s.id} />
                          <SubmitButton variant="ghost" size="sm" className="text-danger hover:bg-danger/10">
                            Delete
                          </SubmitButton>
                        </form>
                      </>
                    ) : null}
                  </div>
                </div>
                {canManage ? (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs text-fg-muted hover:text-fg">Edit</summary>
                    <form action={editScheduleAction} className="mt-3 grid items-end gap-3 sm:grid-cols-3">
                      <input type="hidden" name="id" value={s.id} />
                      <div className="space-y-1">
                        <Label htmlFor={`cron-${s.id}`}>Cron (5-field)</Label>
                        <Input id={`cron-${s.id}`} name="cron" defaultValue={s.cron} className="font-mono" required />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`profileId-${s.id}`}>Profile</Label>
                        <Select id={`profileId-${s.id}`} name="profileId" defaultValue={s.profileId ?? ''}>
                          <option value="">Default</option>
                          {profileRows.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`enabled-${s.id}`}>Status</Label>
                        <Select id={`enabled-${s.id}`} name="enabled" defaultValue={s.enabled ? '1' : '0'}>
                          <option value="1">Enabled</option>
                          <option value="0">Paused</option>
                        </Select>
                      </div>
                      <SubmitButton size="sm" pendingText="Saving…" className="sm:col-span-3">
                        Save changes
                      </SubmitButton>
                    </form>
                  </details>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
