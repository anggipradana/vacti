import { Select } from './ui/select';
import { Button } from './ui/button';

/**
 * Active-project selector for project-scoped pages (targets, scans). Submits as a GET form so the
 * page re-renders scoped to `?project=`, mirroring the Threat Intelligence page's switcher.
 */
export function ProjectSwitcher({
  projects,
  current,
  basePath,
}: {
  projects: { id: string; name: string }[];
  current?: string;
  basePath: string;
}) {
  if (projects.length === 0) return null;
  return (
    <form method="get" action={basePath} className="flex items-center gap-2">
      <Select name="project" defaultValue={current} aria-label="Active project" className="w-52">
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </Select>
      <Button type="submit" variant="ghost" size="sm">
        Switch
      </Button>
    </form>
  );
}
