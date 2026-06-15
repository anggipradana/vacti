/**
 * Role-based access control for vacti: a standard three-role model defined in the
 * platform-foundation epic (task 005). Enforcement happens server-side.
 */
export const Role = {
  SysAdmin: 'SysAdmin',
  PenetrationTester: 'PenetrationTester',
  Auditor: 'Auditor',
} as const;

export type RoleName = (typeof Role)[keyof typeof Role];

export const Permission = {
  ModifySystemConfig: 'modify_system_config',
  ModifyScanConfig: 'modify_scan_config',
  ModifyScanResults: 'modify_scan_results',
  ModifyReport: 'modify_report',
  InitiateScans: 'initiate_scans',
  ModifyTargets: 'modify_targets',
} as const;

export type PermissionName = (typeof Permission)[keyof typeof Permission];

const ALL: PermissionName[] = Object.values(Permission);

/** Permission matrix. SysAdmin = all; PenTester = all but system config; Auditor = report only (+ implicit read). */
export const ROLE_PERMISSIONS: Record<RoleName, ReadonlySet<PermissionName>> = {
  [Role.SysAdmin]: new Set(ALL),
  [Role.PenetrationTester]: new Set(ALL.filter((p) => p !== Permission.ModifySystemConfig)),
  [Role.Auditor]: new Set<PermissionName>([Permission.ModifyReport]),
};

export function hasPermission(role: RoleName, permission: PermissionName): boolean {
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}

export function isRoleName(s: unknown): s is RoleName {
  return typeof s === 'string' && (Object.values(Role) as string[]).includes(s);
}

/** Resolve a user's effective global role: explicit `role` wins, else legacy `isSysAdmin`. */
export function roleFromUser(user: { role?: string | null; isSysAdmin?: boolean | null } | null | undefined): RoleName {
  if (user && isRoleName(user.role)) return user.role;
  return user?.isSysAdmin ? Role.SysAdmin : Role.PenetrationTester;
}

/** Does this user hold a permission? */
export function userCan(
  user: { role?: string | null; isSysAdmin?: boolean | null } | null | undefined,
  permission: PermissionName,
): boolean {
  if (!user) return false;
  return hasPermission(roleFromUser(user), permission);
}

/** Human labels for the UI. */
export const ROLE_LABEL: Record<RoleName, string> = {
  [Role.SysAdmin]: 'System Admin',
  [Role.PenetrationTester]: 'Penetration Tester',
  [Role.Auditor]: 'Auditor (read-only)',
};
