"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Send, RefreshCw, Sparkles, FileText, FileSpreadsheet, Wrench, Trash2, User,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Button, Card, Select, useToast } from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils/cn";

interface ProjectOption { id: number; name: string; key: string }

/** A download button the agent asked us to render. */
interface ExportProposal {
  modules: string[];
  format: "pdf" | "excel" | "both";
  label: string;
}

interface ChatTurn {
  role: "user" | "assistant";
  content: string;
  exports?: ExportProposal[];
  toolsUsed?: string[];
  failed?: boolean;
}

/** Openers that map onto what the agent's tools can actually answer. */
const STARTERS = [
  "What is the current status and what is still left?",
  "What is blocking us right now?",
  "What is overdue or unassigned?",
  "Who is carrying the most work?",
  "What are the upcoming goals and risks?",
  "Build me a report I can send to my manager.",
];

/** Session-scoped history so switching tabs does not wipe the conversation. */
const STORAGE_KEY = "bugbase.ask.history.v1";

export function ProjectAskPanel({
  projects,
  projectId,
  onProjectChange,
}: {
  projects: ProjectOption[];
  projectId: string;
  onProjectChange: (id: string) => void;
}) {
  const { token } = useAuth();
  const toast = useToast();
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Conversations are per project — restoring another project's answers would
  // show numbers that do not belong to the selected project.
  useEffect(() => {
    if (!projectId) { setTurns([]); return; }
    try {
      const raw = sessionStorage.getItem(`${STORAGE_KEY}.${projectId}`);
      setTurns(raw ? (JSON.parse(raw) as ChatTurn[]) : []);
    } catch {
      setTurns([]);
    }
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    try {
      sessionStorage.setItem(`${STORAGE_KEY}.${projectId}`, JSON.stringify(turns.slice(-40)));
    } catch {
      // A full or unavailable sessionStorage must not break the chat.
    }
  }, [turns, projectId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, busy]);

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy || !projectId || !token) return;

    // Only completed exchanges are replayed, so a failed turn cannot poison context.
    const history = turns
      .filter((t) => !t.failed)
      .slice(-12)
      .map((t) => ({ role: t.role, content: t.content }));

    setTurns((prev) => [...prev, { role: "user", content: trimmed }]);
    setInput("");
    setBusy(true);

    try {
      const res = await fetch("/api/ai/project-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ projectId: Number(projectId), message: trimmed, history }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
      setTurns((prev) => [
        ...prev,
        { role: "assistant", content: data.reply, exports: data.exports ?? [], toolsUsed: data.toolsUsed ?? [] },
      ]);
    } catch (err) {
      setTurns((prev) => [
        ...prev,
        {
          role: "assistant",
          content: err instanceof Error ? err.message : "Something went wrong. Try again.",
          failed: true,
        },
      ]);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }, [busy, projectId, token, turns]);

  const runExport = async (proposal: ExportProposal, format: "pdf" | "excel") => {
    if (!token || !projectId) return;
    const tag = `${proposal.label}:${format}`;
    setExporting(tag);
    try {
      const params = new URLSearchParams({ projectId, format });
      // "all" means every module — the export route defaults to that when the
      // modules param is absent, so we simply omit it.
      if (!proposal.modules.includes("all")) params.set("modules", proposal.modules.join(","));

      const res = await fetch(`/api/pm/export?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const msg = await res.json().catch(() => null);
        throw new Error(msg?.error || `Export failed (${res.status})`);
      }
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = /filename="?([^"]+)"?/.exec(disposition);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = match?.[1] || `report.${format === "pdf" ? "pdf" : "xlsx"}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(format === "pdf" ? "PDF downloaded" : "Excel workbook downloaded");
    } catch (err) {
      toast.error("Export failed", {
        description: err instanceof Error ? err.message : "Please try again",
      });
    } finally {
      setExporting(null);
    }
  };

  const clear = () => {
    setTurns([]);
    try {
      sessionStorage.removeItem(`${STORAGE_KEY}.${projectId}`);
    } catch {
      // Nothing to recover from — the in-memory history is already cleared.
    }
  };

  const projOptions = projects.map((p) => ({ value: String(p.id), label: `${p.key} · ${p.name}` }));
  const activeProject = projects.find((p) => String(p.id) === projectId);

  return (
    <div className="space-y-4">
      <Card variant="default" className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="flex-1 min-w-0">
            <Select
              label="Project"
              value={projectId}
              onChange={(e) => onProjectChange(e.target.value)}
              options={projOptions}
              placeholder="Select a project to ask about"
              searchable
            />
          </div>
          {turns.length > 0 && (
            <Button variant="ghost" size="sm" leftIcon={Trash2} onClick={clear}>
              Clear chat
            </Button>
          )}
        </div>
        <p className="mt-2 text-xs text-fg-subtle">
          Answers are computed from this project&apos;s live data — issues, tasks, all workspace
          modules, milestones and risks. Counts are exact, not sampled.
        </p>
      </Card>

      {!projectId ? (
        <Card variant="default" className="p-10 text-center">
          <Sparkles className="w-8 h-8 mx-auto mb-3 text-accent" />
          <p className="text-sm font-medium text-fg">Pick a project to start</p>
          <p className="text-sm text-fg-muted mt-1">
            Then ask anything about what is done, what is left, and what is at risk.
          </p>
        </Card>
      ) : (
        <>
          {turns.length === 0 && (
            <Card variant="default" className="p-6 space-y-4">
              <div className="text-center">
                <Sparkles className="w-7 h-7 mx-auto mb-2 text-accent" />
                <p className="text-sm font-medium text-fg">
                  Ask about {activeProject?.name ?? "this project"}
                </p>
                <p className="text-sm text-fg-muted mt-1">
                  I read the live data before answering, and I can build a PDF or Excel report.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {STARTERS.map((q) => (
                  <button
                    key={q}
                    onClick={() => send(q)}
                    disabled={busy}
                    className="px-3 py-1.5 text-xs rounded-full border border-border bg-surface text-fg-muted hover:border-accent hover:text-fg transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </Card>
          )}

          {turns.length > 0 && (
            <div className="space-y-3">
              {turns.map((t, i) => (
                <div key={i} className={cn("flex", t.role === "user" ? "justify-end" : "justify-start")}>
                  {t.role === "user" ? (
                    <div className="max-w-[85%] px-4 py-2.5 rounded-2xl rounded-br-sm bg-accent text-accent-fg text-sm">
                      <div className="flex items-start gap-2">
                        <User className="w-3.5 h-3.5 mt-0.5 shrink-0 opacity-70" />
                        <p className="whitespace-pre-wrap">{t.content}</p>
                      </div>
                    </div>
                  ) : (
                    <div
                      className={cn(
                        "max-w-[92%] w-full rounded-2xl rounded-bl-sm border px-4 py-3",
                        t.failed
                          ? "border-danger/40 bg-danger/5"
                          : "border-border bg-bg-subtle"
                      )}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className={cn("w-3.5 h-3.5", t.failed ? "text-danger" : "text-accent")} />
                        <span className="text-xs font-medium text-fg-muted">
                          {t.failed ? "Could not answer" : "Project analyst"}
                        </span>
                        {!!t.toolsUsed?.length && (
                          <span
                            className="inline-flex items-center gap-1 text-[11px] text-fg-subtle"
                            title={`Data read: ${[...new Set(t.toolsUsed)].join(", ")}`}
                          >
                            <Wrench className="w-3 h-3" />
                            {new Set(t.toolsUsed).size} source
                            {new Set(t.toolsUsed).size === 1 ? "" : "s"}
                          </span>
                        )}
                      </div>

                      <div className="text-sm text-fg leading-relaxed [&_p]:my-1.5 [&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mt-3 [&_h2]:mb-1 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-2 [&_strong]:font-semibold">
                        <ReactMarkdown>{t.content}</ReactMarkdown>
                      </div>

                      {!!t.exports?.length && (
                        <div className="mt-3 pt-3 border-t border-border space-y-2">
                          {t.exports.map((ex, k) => (
                            <div key={k} className="flex flex-wrap items-center gap-2">
                              <span className="text-xs text-fg-muted mr-1">{ex.label}:</span>
                              {(ex.format === "pdf" || ex.format === "both") && (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  leftIcon={FileText}
                                  loading={exporting === `${ex.label}:pdf`}
                                  disabled={!!exporting}
                                  onClick={() => runExport(ex, "pdf")}
                                >
                                  PDF
                                </Button>
                              )}
                              {(ex.format === "excel" || ex.format === "both") && (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  leftIcon={FileSpreadsheet}
                                  loading={exporting === `${ex.label}:excel`}
                                  disabled={!!exporting}
                                  onClick={() => runExport(ex, "excel")}
                                >
                                  Excel
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {busy && (
                <div className="flex justify-start">
                  <div className="rounded-2xl rounded-bl-sm border border-border bg-bg-subtle px-4 py-3">
                    <div className="flex items-center gap-2">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-accent" />
                      <span className="text-xs text-fg-muted">Reading project data…</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={endRef} />
            </div>
          )}

          <Card variant="default" className="p-3">
            <div className="flex gap-2 items-end">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                rows={1}
                placeholder="Ask about this project… (Enter to send, Shift+Enter for a new line)"
                disabled={busy}
                className="flex-1 resize-none px-3 py-2.5 text-sm rounded-lg border border-border bg-surface text-fg placeholder:text-fg-subtle focus:outline-none focus:ring-1 focus:ring-accent max-h-32 disabled:opacity-60"
              />
              <Button
                variant="primary"
                onClick={() => send(input)}
                disabled={busy || !input.trim()}
                loading={busy}
                leftIcon={busy ? undefined : Send}
              >
                Ask
              </Button>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
