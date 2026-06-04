'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { hashPassword, verifyPassword, generateApiToken, needsRehash } from '@vacti/auth';
import { Role, Permission, isRoleName } from '@vacti/core';
import { users, projects, projectMembers, apiTokens } from '@vacti/db';
import { getDb } from './db';
import { createSession, destroySession, getCurrentUser, userCount } from './session';
import { requirePermission } from './authz';

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
  redirect('/dashboard');
}

export async function logoutAction() {
  await destroySession();
  redirect('/login');
}

export async function createProjectAction(formData: FormData) {
  const user = await requirePermission(Permission.ModifyTargets);
  const name = String(formData.get('name') ?? '').trim();
  const slug = String(formData.get('slug') ?? '').trim();
  if (!name || !/^[a-z][a-z0-9-]*$/.test(slug)) redirect('/projects?error=invalid');
  const db = getDb();
  const [project] = await db.insert(projects).values({ name, slug }).returning();
  await db.insert(projectMembers).values({ projectId: project!.id, userId: user!.id, role: Role.SysAdmin });
  revalidatePath('/projects');
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
  revalidatePath('/settings/users');
}
