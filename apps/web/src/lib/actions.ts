'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { hashPassword, verifyPassword, generateApiToken, needsRehash } from '@vacti/auth';
import { Role, Permission, isRoleName } from '@vacti/core';
import { isSector } from '@vacti/threat-intel';
import { users, projects, projectMembers, apiTokens } from '@vacti/db';
import { getDb } from './db';
import { createSession, destroySession, getCurrentUser, userCount } from './session';
import { requirePermission } from './authz';
import { recordAudit } from './audit';
import { setActiveProjectCookie } from './active-project';

export async function createAdminAction(formData: FormData) {
  if ((await userCount()) > 0) redirect('/login');
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');
  if (!email || password.length < 8) redirect('/login?error=weak');
  const [user] = await getDb()
    .insert(users)
    .values({ email, passwordHash: await hashPassword(password), isSysAdmin: true, role: Role.SysAdmin })
    .returning();
  await createSession(user!.id);
  redirect('/dashboard');
}

export async function loginAction(formData: FormData) {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');
  const [user] = await getDb().select().from(users).where(eq(users.email, email));
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    redirect('/login?error=invalid');
  }
  // Transparently upgrade legacy scrypt hashes to argon2id on successful login.
  if (needsRehash(user.passwordHash)) {
    await getDb()
      .update(users)
      .set({ passwordHash: await hashPassword(password) })
      .where(eq(users.id, user.id));
  }
  await createSession(user.id);
  // Land on the default project (if one is flagged) so login always opens the chosen workspace.
  const [def] = await getDb().select({ id: projects.id }).from(projects).where(eq(projects.isDefault, true)).limit(1);
  if (def) await setActiveProjectCookie(def.id);
  redirect('/dashboard');
}

export async function logoutAction() {
  await destroySession();
  redirect('/login');
}

/** Self-service: the logged-in user changes their OWN password (verifies the current one first). */
export async function changeOwnPasswordAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const current = String(formData.get('current') ?? '');
  const next = String(formData.get('next') ?? '');
  const confirm = String(formData.get('confirm') ?? '');
  if (!(await verifyPassword(current, user.passwordHash))) redirect('/settings/account?error=current');
  if (next.length < 8) redirect('/settings/account?error=weak');
  if (next !== confirm) redirect('/settings/account?error=mismatch');
  await getDb()
    .update(users)
    .set({ passwordHash: await hashPassword(next), updatedAt: new Date() })
    .where(eq(users.id, user.id));
  await recordAudit({ actorId: user.id, action: 'user.password_change', resource: `user:${user.id}` });
  redirect('/settings/account?ok=1');
}

export async function createProjectAction(formData: FormData) {
  const user = await requirePermission(Permission.ModifyTargets);
  const name = String(formData.get('name') ?? '').trim();
  const slug = String(formData.get('slug') ?? '').trim();
  if (!name || !/^[a-z][a-z0-9-]*$/.test(slug)) redirect('/projects?error=invalid');
  const db = getDb();
  const [project] = await db.insert(projects).values({ name, slug }).returning();
  await db.insert(projectMembers).values({ projectId: project!.id, userId: user!.id, role: Role.SysAdmin });
  await recordAudit({
    actorId: user.id,
    action: 'project.create',
    resource: `project:${project!.id}`,
    projectId: project!.id,
    metadata: { slug },
  });
  revalidatePath('/projects');
}

/** Edit a project's name, sector, and (optionally) slug. Requires ModifyTargets + audit. */
export async function editProjectAction(formData: FormData) {
  const actor = await requirePermission(Permission.ModifyTargets);
  const id = String(formData.get('id') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  const sector = String(formData.get('sector') ?? '');
  const slug = String(formData.get('slug') ?? '').trim();
  if (!id || !name || !isSector(sector)) redirect('/projects?error=invalid');
  const set: { name: string; sector: string; updatedAt: Date; slug?: string } = {
    name,
    sector,
    updatedAt: new Date(),
  };
  // Only touch the slug when a (valid) one is supplied; blank keeps the current slug.
  if (slug) {
    if (!/^[a-z][a-z0-9-]*$/.test(slug)) redirect('/projects?error=invalid');
    set.slug = slug;
  }
  await getDb().update(projects).set(set).where(eq(projects.id, id));
  await recordAudit({ actorId: actor.id, action: 'project.update', resource: `project:${id}`, projectId: id });
  revalidatePath('/projects');
}

/** Delete a project and all its scoped data (cascades via FK). Requires ModifyTargets + audit. */
export async function deleteProjectAction(formData: FormData) {
  const actor = await requirePermission(Permission.ModifyTargets);
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  await getDb().delete(projects).where(eq(projects.id, id));
  await recordAudit({ actorId: actor.id, action: 'project.delete', resource: `project:${id}`, projectId: id });
  revalidatePath('/projects');
}

/** Mark a project as the default workspace (shown on login). At most one project is default. */
export async function setDefaultProjectAction(formData: FormData) {
  const actor = await requirePermission(Permission.ModifyTargets);
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const db = getDb();
  // Single default: clear the flag everywhere, then set it on the chosen project.
  await db.update(projects).set({ isDefault: false }).where(eq(projects.isDefault, true));
  await db.update(projects).set({ isDefault: true }).where(eq(projects.id, id));
  await setActiveProjectCookie(id);
  await recordAudit({ actorId: actor.id, action: 'project.set_default', resource: `project:${id}`, projectId: id });
  revalidatePath('/projects');
}

/** Create a user (email + password + role). SysAdmin-only; deduped by email; audited. */
export async function addUserAction(formData: FormData) {
  const actor = await requirePermission(Permission.ModifySystemConfig);
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase();
  const password = String(formData.get('password') ?? '');
  const role = String(formData.get('role') ?? Role.PenetrationTester);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || password.length < 8 || !isRoleName(role)) {
    redirect('/settings/users?error=invalid');
  }
  const db = getDb();
  const [existing] = await db.select().from(users).where(eq(users.email, email));
  if (existing) redirect('/settings/users?error=exists');
  const [u] = await db
    .insert(users)
    .values({ email, passwordHash: await hashPassword(password), role, isSysAdmin: role === Role.SysAdmin })
    .returning();
  await recordAudit({ actorId: actor.id, action: 'user.create', resource: `user:${u!.id}`, metadata: { role } });
  revalidatePath('/settings/users');
}

/** Delete a user. SysAdmin-only; never self or the last SysAdmin; audited. */
export async function deleteUserAction(formData: FormData) {
  const actor = await requirePermission(Permission.ModifySystemConfig);
  const id = String(formData.get('id') ?? '');
  if (!id || id === actor.id) return; // never delete yourself
  const db = getDb();
  const [target] = await db.select().from(users).where(eq(users.id, id));
  if (!target) return;
  if (target.role === Role.SysAdmin) {
    const admins = (await db.select().from(users).where(eq(users.role, Role.SysAdmin))).length;
    if (admins <= 1) return; // keep at least one SysAdmin
  }
  await db.delete(users).where(eq(users.id, id));
  await recordAudit({ actorId: actor.id, action: 'user.delete', resource: `user:${id}` });
  revalidatePath('/settings/users');
}

/** SysAdmin-only: reset another user's password (no current-password check). Audited. */
export async function resetUserPasswordAction(formData: FormData) {
  const actor = await requirePermission(Permission.ModifySystemConfig);
  const id = String(formData.get('id') ?? '');
  const password = String(formData.get('password') ?? '');
  if (!id || password.length < 8) redirect('/settings/users?error=weak');
  await getDb()
    .update(users)
    .set({ passwordHash: await hashPassword(password), updatedAt: new Date() })
    .where(eq(users.id, id));
  await recordAudit({ actorId: actor.id, action: 'user.password_reset', resource: `user:${id}` });
  revalidatePath('/settings/users');
}

export async function createTokenAction(_prev: unknown, formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const label = String(formData.get('label') ?? '').trim() || 'token';
  const { plaintext, hash } = generateApiToken();
  await getDb().insert(apiTokens).values({ userId: user!.id, label, tokenHash: hash });
  revalidatePath('/settings/tokens');
  return { token: plaintext };
}

export async function revokeTokenAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const id = String(formData.get('id') ?? '');
  await getDb()
    .delete(apiTokens)
    .where(and(eq(apiTokens.id, id), eq(apiTokens.userId, user!.id)));
  revalidatePath('/settings/tokens');
}

/** SysAdmin-only: change a user's global RBAC role. */
export async function changeUserRoleAction(formData: FormData) {
  const actor = await requirePermission(Permission.ModifySystemConfig);
  const id = String(formData.get('id') ?? '');
  const role = String(formData.get('role') ?? '');
  if (!id || !isRoleName(role)) return;
  // Don't let an admin demote themselves out of the last SysAdmin seat.
  if (id === actor.id && role !== Role.SysAdmin) {
    const admins = (await getDb().select().from(users).where(eq(users.role, Role.SysAdmin))).length;
    if (admins <= 1) return;
  }
  await getDb()
    .update(users)
    .set({ role, isSysAdmin: role === Role.SysAdmin, updatedAt: new Date() })
    .where(eq(users.id, id));
  await recordAudit({ actorId: actor.id, action: 'user.role_change', resource: `user:${id}`, metadata: { role } });
  revalidatePath('/settings/users');
}
