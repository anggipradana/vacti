'use client';
import { Plus } from 'lucide-react';
import { Button } from './ui/button';
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
            Runs subfinder → httpx → naabu → nuclei (+ WordPress checks on detected hosts).
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
          <Button type="submit" data-testid="start-scan" className="w-full">
            Start scan
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
