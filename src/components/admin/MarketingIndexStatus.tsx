import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { inspectMarketingUrl } from "@/lib/marketing.functions";
import type { Inspection } from "@/lib/marketing";

export function MarketingIndexStatus({ inspections, propertySelected, onSaved }: { inspections: Inspection[]; propertySelected: boolean; onSaved: () => Promise<unknown> }) {
  const [url, setUrl] = useState(""), [busy, setBusy] = useState(false);
  const inspect = useServerFn(inspectMarketingUrl);
  async function submit(e: React.FormEvent) { e.preventDefault(); setBusy(true); try { await inspect({ data: { url } }); await onSaved(); toast.success("Google index status saved."); } catch (error) { toast.error(error instanceof Error ? error.message : "Index status unavailable."); } finally { setBusy(false); } }
  return <section className="border-t border-border py-5"><h2 className="font-display text-lg font-bold">Google index status</h2><p className="mt-1 text-xs text-muted-foreground">Google’s indexed version only · not a live test, indexing request or re-crawl</p>
    <form onSubmit={(e) => void submit(e)} className="my-4 space-y-2"><Label htmlFor="inspection-url">My Car page URL</Label><div className="flex flex-wrap gap-2"><Input id="inspection-url" type="url" required placeholder="https://mycarcorp.com/blog/…" value={url} onChange={(e) => setUrl(e.target.value)} className="min-w-0 flex-1 basis-64" /><Button type="submit" variant="outline" disabled={busy || !propertySelected}>{busy ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}Read index status</Button></div>{!propertySelected && <p className="text-xs text-muted-foreground">Choose a verified Search Console property first.</p>}</form>
    {inspections.length ? <div className="divide-y divide-border">{inspections.map((p) => <div key={p.url} className="py-3"><p className="break-all text-sm font-semibold">{p.url}</p><p className="mt-1 text-sm">{p.coverageState ?? "No coverage result"} · {p.verdict ?? "No verdict"}</p><p className="mt-1 text-xs text-muted-foreground">Last crawl: {p.lastCrawlTime ? new Date(p.lastCrawlTime).toLocaleString() : "Not reported"} · Checked: {new Date(p.inspectedAt).toLocaleString()}</p>{p.googleCanonical && <p className="mt-1 break-all text-xs text-muted-foreground">Google canonical: {p.googleCanonical}</p>}</div>)}</div> : <p className="py-5 text-sm text-muted-foreground">No URLs inspected yet. This does not establish the site’s total indexed-page count.</p>}
  </section>;
}