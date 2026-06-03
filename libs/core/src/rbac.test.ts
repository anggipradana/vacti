import { describe, it, expect } from 'vitest';
import { Role, Permission, hasPermission } from './rbac';

describe('RBAC matrix', () => {
  it('SysAdmin has every permission', () => {
    for (const p of Object.values(Permission)) {
      expect(hasPermission(Role.SysAdmin, p)).toBe(true);
    }
  });

  it('PenetrationTester has all except system config', () => {
    expect(hasPermission(Role.PenetrationTester, Permission.ModifySystemConfig)).toBe(false);
    expect(hasPermission(Role.PenetrationTester, Permission.InitiateScans)).toBe(true);
    expect(hasPermission(Role.PenetrationTester, Permission.ModifyTargets)).toBe(true);
  });

  it('Auditor is read + report only', () => {
    expect(hasPermission(Role.Auditor, Permission.ModifyReport)).toBe(true);
    expect(hasPermission(Role.Auditor, Permission.InitiateScans)).toBe(false);
    expect(hasPermission(Role.Auditor, Permission.ModifyScanResults)).toBe(false);
    expect(hasPermission(Role.Auditor, Permission.ModifyTargets)).toBe(false);
    expect(hasPermission(Role.Auditor, Permission.ModifySystemConfig)).toBe(false);
  });
});
