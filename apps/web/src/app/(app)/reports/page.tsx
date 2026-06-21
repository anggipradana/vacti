import { redirect } from 'next/navigation';

// The standalone Reports hub has been retired: report generation now lives inside each module
// (VA on /scans, CTI on /threat, pentest on /pentest). This redirect keeps old /reports links and
// the command palette resolving. The report renderer routes under /reports/{va,ti,pentest} are
// unaffected - they generate the actual PDFs/HTML and remain linked from those modules.
export const dynamic = 'force-dynamic';

export default function ReportsPage() {
  redirect('/scans');
}
