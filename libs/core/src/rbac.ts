/**
 * Role-based access control for vacti, derived from ReNgGinaNg roles.py and the
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
