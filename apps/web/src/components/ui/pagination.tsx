import Link from 'next/link';
import { Button } from './button';

/**
 * Prev/next pager for long tables. `makeHref(page)` builds the URL for a target page so the caller
 * can preserve its other search params (project, filters, compare, …). Renders nothing for a single page.
 */
export function Pagination({
  page,
  totalPages,
  total,
  label,
  makeHref,
}: {
  page: number;
  totalPages: number;
  total: number;
  label: string;
  makeHref: (page: number) => string;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-between text-sm">
      <span className="text-fg-subtle">
        Page {page} of {totalPages} · {total} {label}
      </span>
      <div className="flex gap-2">
        <Button asChild variant="outline" size="sm" disabled={page <= 1}>
          <Link href={makeHref(Math.max(1, page - 1))} aria-disabled={page <= 1}>
            Previous
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm" disabled={page >= totalPages}>
          <Link href={makeHref(Math.min(totalPages, page + 1))} aria-disabled={page >= totalPages}>
            Next
          </Link>
        </Button>
      </div>
    </div>
  );
}
