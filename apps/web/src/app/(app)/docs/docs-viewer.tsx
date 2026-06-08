'use client';

import * as React from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import { cn } from '../../../lib/cn';

export interface Doc {
  slug: string;
  title: string;
  markdown: string;
}

// Tailwind-styled renderers for each markdown element (no typography plugin needed).
const components = {
  h1: (p: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h1 {...p} className="mb-3 mt-2 scroll-mt-20 font-display text-2xl font-bold tracking-tight" />
  ),
  h2: (p: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2 {...p} className="mb-2 mt-7 scroll-mt-20 border-b border-border pb-1 font-display text-lg font-semibold" />
  ),
  h3: (p: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h3
      {...p}
      className="mb-1 mt-5 scroll-mt-20 font-display text-sm font-semibold uppercase tracking-wider text-fg-subtle"
    />
  ),
  p: (p: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p {...p} className="my-2.5 text-sm leading-relaxed text-fg-muted" />
  ),
  a: ({ href, children, ...p }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
    // Only external (http) links and in-page heading anchors (#…) navigate. Repo-relative links
    // (e.g. ../planning/foo.md) are not web routes, so render them as plain text to avoid 404s.
    if (href && (href.startsWith('http') || href.startsWith('#'))) {
      return (
        <a
          {...p}
          href={href}
          target={href.startsWith('http') ? '_blank' : undefined}
          rel="noopener noreferrer"
          className="text-accent hover:underline"
        >
          {children}
        </a>
      );
    }
    return <span className="text-fg">{children}</span>;
  },
  ul: (p: React.HTMLAttributes<HTMLUListElement>) => (
    <ul {...p} className="my-2.5 ml-5 list-disc space-y-1 text-sm text-fg-muted" />
  ),
  ol: (p: React.HTMLAttributes<HTMLOListElement>) => (
    <ol {...p} className="my-2.5 ml-5 list-decimal space-y-1 text-sm text-fg-muted" />
  ),
  li: (p: React.HTMLAttributes<HTMLLIElement>) => <li {...p} className="leading-relaxed" />,
  strong: (p: React.HTMLAttributes<HTMLElement>) => <strong {...p} className="font-semibold text-fg" />,
  blockquote: (p: React.HTMLAttributes<HTMLQuoteElement>) => (
    <blockquote {...p} className="my-3 border-l-2 border-accent/40 pl-3 text-sm italic text-fg-subtle" />
  ),
  code: ({ className, ...p }: React.HTMLAttributes<HTMLElement>) =>
    className?.includes('language-') ? (
      <code {...p} className={cn(className, 'font-mono text-[12px]')} />
    ) : (
      <code {...p} className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[12px] text-fg" />
    ),
  pre: (p: React.HTMLAttributes<HTMLPreElement>) => (
    <pre
      {...p}
      className="my-3 overflow-auto rounded-md border border-border bg-bg-subtle p-3 text-[12px] leading-snug"
    />
  ),
  table: (p: React.HTMLAttributes<HTMLTableElement>) => (
    <div className="my-3 overflow-auto">
      <table {...p} className="w-full border-collapse text-sm" />
    </div>
  ),
  th: (p: React.HTMLAttributes<HTMLTableCellElement>) => (
    <th {...p} className="border border-border bg-surface-2 px-2 py-1 text-left font-semibold" />
  ),
  td: (p: React.HTMLAttributes<HTMLTableCellElement>) => (
    <td {...p} className="border border-border px-2 py-1 align-top" />
  ),
  hr: () => <hr className="my-5 border-border" />,
};

/** Documentation reader: a sidebar of doc pages + a styled markdown content pane. */
export function DocsViewer({ docs }: { docs: Doc[] }) {
  const [active, setActive] = React.useState(docs[0]?.slug ?? '');
  const current = docs.find((d) => d.slug === active) ?? docs[0];

  return (
    <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
      <nav className="lg:sticky lg:top-20 lg:self-start">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-fg-subtle">Guides</div>
        <ul className="space-y-0.5">
          {docs.map((d) => (
            <li key={d.slug}>
              <button
                type="button"
                onClick={() => setActive(d.slug)}
                className={cn(
                  'w-full rounded-md px-2.5 py-1.5 text-left text-sm transition-colors',
                  d.slug === current?.slug
                    ? 'bg-accent/10 font-medium text-accent'
                    : 'text-fg-muted hover:bg-surface-2 hover:text-fg',
                )}
              >
                {d.title}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <article className="min-w-0 rounded-lg border border-border bg-surface p-6">
        <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSlug]} components={components}>
          {current?.markdown ?? ''}
        </Markdown>
      </article>
    </div>
  );
}
