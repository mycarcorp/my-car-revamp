import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { checkContentTopic, type TopicOverlap } from "@/lib/content-agent.functions";
import {
  FACT_CHECKLIST,
  STAGES,
  TOPIC_BACKLOG,
  auditEntry,
  briefToMarkdown,
  buildBrief,
  canTransition,
  precheckDraft,
  type AuditEntry,
  type Stage,
  type WorkItem,
} from "@/lib/seo-content-agent";

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-background p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* SEO content plan (draft and review only)                                    */
/* -------------------------------------------------------------------------- */

export function ContentAgentPanel({ accessToken, userLabel }: { accessToken: string; userLabel: string }) {
  const check = useServerFn(checkContentTopic);
  const [topicId, setTopicId] = useState(TOPIC_BACKLOG[0]!.id);
  const topic = TOPIC_BACKLOG.find((t) => t.id === topicId)!;
  const brief = useMemo(() => buildBrief(topic), [topic]);
  const [overlaps, setOverlaps] = useState<TopicOverlap[] | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [checked, setChecked] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [author, setAuthor] = useState("");
  const [stage, setStage] = useState<Stage>("suggested");
  const [log, setLog] = useState<AuditEntry[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const findings = useMemo(() => precheckDraft(draft), [draft]);

  const item: WorkItem = { topicId, stage, author: author.trim() || null, reviewer: stage === "in_review" || stage === "approved" || stage === "publish_authorized" ? userLabel : null, authorizedBy: stage === "publish_authorized" ? userLabel : null, checked, openFindings: findings.length, duplicateOf: overlaps?.[0]?.title ?? null };

  function pick(id: string) {
    setTopicId(id); setOverlaps(null); setCheckError(null); setChecked([]); setDraft(""); setStage("suggested"); setLog([]); setMessage(null);
  }

  async function runCheck() {
    setChecking(true); setCheckError(null);
    try {
      const result = await check({ data: { accessToken, title: topic.title, keywords: topic.keywordTheme } });
      setOverlaps(result.overlaps);
    } catch {
      setOverlaps(null);
      setCheckError("The duplicate check could not run. Nothing was assumed.");
    } finally { setChecking(false); }
  }

  const next = STAGES[STAGES.indexOf(stage) + 1];
  const offered = next && STAGES.indexOf(next) <= STAGES.indexOf("publish_authorized") ? next : null;

  function advance() {
    if (!offered) return;
    const result = canTransition(item, offered, userLabel);
    if (!result.ok) { setMessage(result.reason); return; }
    setLog((l) => [...l, auditEntry(item, offered, userLabel)]);
    setStage(offered); setMessage(null);
  }

  return (
    <div className="space-y-6 py-5">
      <div className="rounded-lg border border-border bg-background p-4 text-xs text-muted-foreground">
        Draft and review only. Nothing is saved, scheduled or published from this page. Approved articles are written and published in the Blog workspace,
        which applies the existing quality checks, sanitization and sitemap update.
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Card title="Topic suggestions">
          <ul className="space-y-1">
            {TOPIC_BACKLOG.map((t) => (
              <li key={t.id}>
                <button type="button" onClick={() => pick(t.id)} aria-pressed={t.id === topicId} className={`w-full rounded-md border px-3 py-2 text-left text-sm ${t.id === topicId ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
                  <span className="font-medium">{t.title}</span>
                  <span className="block text-xs text-muted-foreground">{t.cluster} · {t.keywordTheme} · {t.intent}</span>
                </button>
              </li>
            ))}
          </ul>
        </Card>

        <div className="space-y-4">
          <Card title="Duplicate check">
            <Button variant="outline" size="sm" onClick={() => void runCheck()} disabled={checking}>
              {checking && <Loader2 className="size-3.5 animate-spin" />}Check against published articles
            </Button>
            {checkError && <p role="alert" className="mt-2 text-xs text-destructive">{checkError}</p>}
            {overlaps && (overlaps.length ? (
              <div className="mt-2 text-xs"><p className="font-semibold">This topic overlaps published articles:</p><ul className="mt-1 list-disc pl-5">{overlaps.map((o) => <li key={o.slug}>{o.title} <a className="text-primary underline" href={`/blog/${encodeURIComponent(o.slug)}`} target="_blank" rel="noreferrer">view</a></li>)}</ul><p className="mt-1 text-muted-foreground">Choose a different topic, or update that article instead.</p></div>
            ) : <p className="mt-2 text-xs text-muted-foreground">No overlap found with published articles by search intent.</p>)}
          </Card>

          <Card title="Brief">
            <p className="text-xs"><span className="font-semibold">H1:</span> {brief.h1}</p>
            <p className="mt-1 text-xs"><span className="font-semibold">Title:</span> {brief.suggestedTitle}</p>
            <p className="mt-1 text-xs"><span className="font-semibold">Description:</span> {brief.suggestedDescriptionPrompt}</p>
            <ul className="mt-2 text-xs">{brief.outline.map((h, i) => <li key={i} className={h.level === "h3" ? "ml-4 text-muted-foreground" : "font-medium"}>{h.level.toUpperCase()} · {h.text}</li>)}</ul>
            <p className="mt-2 text-xs font-semibold">Internal links</p>
            <ul className="text-xs text-muted-foreground">{brief.internalLinks.map((l) => <li key={l.to}>{l.label} → {l.to}</li>)}</ul>
            <p className="mt-2 text-xs font-semibold">Images</p>
            <ul className="list-disc pl-5 text-xs text-muted-foreground">{brief.imageGuidance.map((g) => <li key={g}>{g}</li>)}</ul>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => void navigator.clipboard?.writeText(briefToMarkdown(topic, brief))}><Copy className="size-3.5" />Copy brief</Button>
          </Card>

          <Card title="Draft pre-check">
            <textarea className="h-28 w-full rounded-md border border-input bg-background p-2 text-sm" placeholder="Paste draft text to flag risky claims (not saved)" value={draft} onChange={(e) => setDraft(e.target.value)} />
            {findings.length > 0 ? <ul className="mt-2 text-xs text-destructive">{findings.map((f) => <li key={f.reason}>{f.reason}: “{f.excerpt}”</li>)}</ul> : draft && <p className="mt-2 text-xs text-muted-foreground">No risky phrases found. This is not a fact check.</p>}
          </Card>

          <Card title="Fact-check checklist">
            <ul className="space-y-1.5">
              {FACT_CHECKLIST.map((c) => (
                <li key={c}><label className="flex items-start gap-2 text-xs"><input type="checkbox" className="mt-0.5" checked={checked.includes(c)} onChange={(e) => setChecked((l) => e.target.checked ? [...l, c] : l.filter((x) => x !== c))} />{c}</label></li>
              ))}
            </ul>
          </Card>

          <Card title="Editorial workflow">
            <ol className="flex flex-wrap gap-1 text-[11px]">{STAGES.map((s) => <li key={s} className={`rounded-full border px-2 py-0.5 ${s === stage ? "border-primary bg-primary/10 font-semibold" : "border-border text-muted-foreground"}`}>{s.replace("_", " ")}</li>)}</ol>
            <label className="mt-3 block text-xs"><span className="mb-1 block font-medium">Author (name of the person writing)</span><Input value={author} onChange={(e) => setAuthor(e.target.value)} /></label>
            <p className="mt-2 text-xs text-muted-foreground">Approval needs a reviewer other than the author, a complete checklist, no open findings and no duplicate. Publishing needs a separate authorization. Later steps (publish, monitor) happen in the Blog workspace.</p>
            <div className="mt-2 flex items-center gap-2"><Button size="sm" disabled={!offered} onClick={advance}>{offered ? `Move to ${offered.replace("_", " ")}` : "Continue in the Blog workspace"}</Button></div>
            {message && <p role="alert" className="mt-2 text-xs text-destructive">{message}</p>}
            {log.length > 0 && <ul className="mt-2 text-[11px] text-muted-foreground">{log.map((e, i) => <li key={i}>{e.at} · {e.actor}: {e.from} → {e.to}</li>)}</ul>}
            <p className="mt-2 text-[11px] text-muted-foreground">This record lives only in this page and is lost on reload. A saved audit trail needs a database table, which needs approval.</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
