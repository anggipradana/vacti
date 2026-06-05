'use client';

import { useMemo, useState } from 'react';
import { Flame } from 'lucide-react';
import type { RansomwareLandscape } from '@vacti/threat-intel';
import { Select } from '../../components/ui/select';

type Victim = RansomwareLandscape['victims'][number];

interface RansomwareFeedProps {
  victims: Victim[];
  countries: RansomwareLandscape['countries'];
  sectors: RansomwareLandscape['sectors'];
  /** Max victims to display after filtering. */
  limit?: number;
}

/**
 * Client-side filterable ransomware victim feed. Filters the passed `victims` array by country and
 * sector (no refetch). Defaults to Indonesia (ID) when present, otherwise all countries.
 */
export function RansomwareFeed({ victims, countries, sectors, limit = 8 }: RansomwareFeedProps) {
  const hasId = countries.some((c) => c.code === 'ID');
  const [country, setCountry] = useState(hasId ? 'ID' : 'ALL');
  const [sector, setSector] = useState('ALL');

  const filtered = useMemo(
    () =>
      victims.filter(
        (v) => (country === 'ALL' || v.country === country) && (sector === 'ALL' || v.activity === sector),
      ),
    [victims, country, sector],
  );

  return (
    <div>
      <div className="mb-2 grid grid-cols-2 gap-2">
        <Select aria-label="Filter by country" value={country} onChange={(e) => setCountry(e.target.value)}>
          <option value="ALL">All countries</option>
          {countries.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code} ({c.count})
            </option>
          ))}
        </Select>
        <Select aria-label="Filter by sector" value={sector} onChange={(e) => setSector(e.target.value)}>
          <option value="ALL">All sectors</option>
          {sectors.map((s) => (
            <option key={s.name} value={s.name}>
              {s.name} ({s.count})
            </option>
          ))}
        </Select>
      </div>
      {filtered.length === 0 ? (
        <p className="py-2 text-sm text-fg-muted">No victims match these filters.</p>
      ) : (
        <ul className="mt-1 divide-y divide-border">
          {filtered.slice(0, limit).map((v, i) => (
            <li key={`${v.title}-${i}`} className="flex items-center justify-between gap-2 py-1.5 text-sm">
              <span className="min-w-0 truncate">
                {v.country === 'ID' ? <Flame className="mr-1 inline size-3 text-danger" /> : null}
                {v.title || v.website || 'unknown'}
              </span>
              <span className="shrink-0 text-xs text-fg-subtle">
                {v.group} · {v.country}
                {v.activity && v.activity !== 'Not Found' ? ` · ${v.activity}` : ''} · {v.discovered.slice(0, 10)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
