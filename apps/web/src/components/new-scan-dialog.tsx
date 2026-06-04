'use client';
import { Plus } from 'lucide-react';
import { Button } from './ui/button';
import { Select } from './ui/select';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from './ui/dialog';
import { startScanAction } from '../lib/recon-actions';

export function NewScanDialog({ targets }: { targets: { id: string; domain: string }[] }) {
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
          <Button type="submit" data-testid="start-scan" className="w-full">
            Start scan
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
