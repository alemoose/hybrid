import { pollRecCounts } from "@/lib/rec-queries";

// Called every 30 minutes by a cron-job.org job (and .github/workflows/rec-sample.yml
// as a backup, since GitHub drops many scheduled runs) so the rec center's
// usual quiet times fill in without opening the app. It needs no login (src/proxy.ts
// lets it through): it only saves the public headcounts, at most once every 10 minutes.
export async function POST() {
  return Response.json(await pollRecCounts());
}
