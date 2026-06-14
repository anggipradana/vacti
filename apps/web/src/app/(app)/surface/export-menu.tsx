'use client';

import { Download, ChevronDown } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../components/ui/dropdown-menu';

/**
 * Consolidates the three Attack Surface exports (ZIP, URLs CSV, Findings CSV) into a single
 * dropdown so the page header stays tidy instead of wrapping a row of buttons.
 */
export function SurfaceExportMenu({ projectId }: { projectId: string }) {
  const base = `/surface/export?project=${projectId}`;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="sm">
          <Download className="size-4" /> Export <ChevronDown className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <a href={`${base}&format=zip`} download>
            Everything (ZIP)
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={`${base}&format=csv&resource=urls`} download>
            Discovered URLs (CSV)
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={`${base}&format=csv&resource=findings`} download>
            Exposure findings (CSV)
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
