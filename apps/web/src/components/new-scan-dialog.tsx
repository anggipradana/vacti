'use client';
import { Plus } from 'lucide-react';
import { Button } from './ui/button';
import { SubmitButton } from './ui/submit-button';
import { Select } from './ui/select';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from './ui/dialog';
import { startScanAction } from '../lib/recon-actions';

export function NewScanDialog({
  targets,
  profiles = [],
}: {
  targets: { id: string; domain: string }[];
  profiles?: { id: string; name: string }[];
}) {
  const disabled = targets.length === 0;
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button disabled={disabled} data-testid="new-scan-trigger">
          <Plus /> New scan
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start a scan</DialogTitle>
          <DialogDescription>
            Active runs subfinder → httpx → naabu → nuclei. Passive pulls OSINT (VirusTotal + Wayback) for
            URLs/IPs/exposures with no traffic to the target. Full does both.
          </DialogDescription>
        </DialogHeader>
        <form action={startScanAction} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="targetId">Target</Label>
            <Select id="targetId" name="targetId" data-testid="scan-target" required>
              {targets.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.domain}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mode">Mode</Label>
            <Select id="mode" name="mode" data-testid="scan-mode" defaultValue="active">
              <option value="active">Active (binary recon pipeline)</option>
              <option value="passive">Passive (OSINT only - no traffic to target)</option>
              <option value="full">Full (passive discovery → active)</option>
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="deepScan" value="1" data-testid="scan-deep" />
            Deep-fetch discovered URLs (passive/full) - fetches bodies (SSRF-guarded) to scan for secrets
          </label>
          {profiles.length ? (
            <div className="space-y-1.5">
              <Label htmlFor="profileId">Scan profile</Label>
              <Select id="profileId" name="profileId" defaultValue="">
                <option value="">Default (all stages)</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}
          <SubmitButton data-testid="start-scan" className="w-full" pendingText="Starting…">
            Start scan
          </SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}
