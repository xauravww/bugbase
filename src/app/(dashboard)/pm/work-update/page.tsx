"use client";

import { useCallback, useEffect, useState } from "react";
import { Sparkles, ClipboardCopy, Check, RefreshCw, ArrowRight } from "lucide-react";
import { Header } from "@/components/layout";
import { Button, Card, PageLoader, Select } from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils/cn";

interface ProjectOption {
  id: number;
  name: string;
  key: string;
}

export default function WorkUpdatePage() {
  const { token } = useAuth();
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [selectedProject, setSelectedProject] = useState("");
  const [mode, setMode] = useState<"done" | "left">("done");
  const [update, setUpdate] = useState("");
  const [loading, setLoading] = useState(false);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [generatedAt, setGeneratedAt] = useState("");

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await fetch("/api/projects", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          const list = (data.projects || data || []).map(
            (p: { id: number; name: string; key: string }) => ({
              id: p.id,
              name: p.name,
              key: p.key,
            })
          );
          setProjects(list);
          if (list.length === 1) setSelectedProject(String(list[0].id));
        }
      } finally {
        setProjectsLoading(false);
      }
    })();
  }, [token]);

  const generate = useCallback(async () => {
    if (!selectedProject || !token) return;
    setLoading(true);
    setUpdate("");
    try {
      const res = await fetch("/api/ai/work-update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ projectId: Number(selectedProject), mode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate update");
      setUpdate(data.update);
      setGeneratedAt(
        new Date(data.generatedAt).toLocaleTimeString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
        })
      );
    } catch (e) {
      setUpdate(
        `Could not generate update: ${e instanceof Error ? e.message : "Unknown error"}`
      );
    } finally {
      setLoading(false);
    }
  }, [selectedProject, mode, token]);

  const handleCopy = async () => {
    if (!update) return;
    try {
      await navigator.clipboard.writeText(update);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const ta = document.createElement("textarea");
      ta.value = update;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (projectsLoading) {
    return (
      <>
        <Header title="Work Update" hideSearch />
        <PageLoader />
      </>
    );
  }

  const projName = projects.find((p) => String(p.id) === selectedProject);

  return (
    <>
      <Header title="Work Update" hideSearch />
      <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6">
        {/* Header section */}
        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-fg">
            Generate Work Update
          </h1>
          <p className="text-sm text-fg-muted leading-relaxed">
            Select a project and choose what to share with your manager. AI will
            summarize everything in easy, plain language you can copy-paste
            directly.
          </p>
        </div>

        {/* Controls */}
        <Card variant="default" className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Project"
              value={selectedProject}
              onChange={(e) => {
                setSelectedProject(e.target.value);
                setUpdate("");
              }}
              options={projects.map((p) => ({
                value: String(p.id),
                label: `${p.key} · ${p.name}`,
              }))}
              placeholder="Select a project"
              searchable
            />

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-fg">
                What to report
              </label>
              <div className="flex rounded-lg border border-border overflow-hidden">
                <button
                  onClick={() => {
                    setMode("done");
                    setUpdate("");
                  }}
                  className={cn(
                    "flex-1 px-4 py-2.5 text-sm font-medium transition-all cursor-pointer",
                    mode === "done"
                      ? "bg-success/15 text-success border-r border-border"
                      : "bg-surface text-fg-muted hover:bg-bg-hover border-r border-border"
                  )}
                >
                  ✅ What&apos;s Done
                </button>
                <button
                  onClick={() => {
                    setMode("left");
                    setUpdate("");
                  }}
                  className={cn(
                    "flex-1 px-4 py-2.5 text-sm font-medium transition-all cursor-pointer",
                    mode === "left"
                      ? "bg-warning/15 text-warning"
                      : "bg-surface text-fg-muted hover:bg-bg-hover"
                  )}
                >
                  📋 What&apos;s Left
                </button>
              </div>
            </div>
          </div>

          <Button
            variant="primary"
            onClick={generate}
            loading={loading}
            disabled={!selectedProject || loading}
            leftIcon={Sparkles}
            className="w-full sm:w-auto"
          >
            {loading ? "Generating..." : "Generate Update"}
          </Button>
        </Card>

        {/* Output */}
        {update && (
          <Card variant="default" className="p-0 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-bg-subtle">
              <div className="flex items-center gap-2 text-sm">
                <Sparkles className="w-4 h-4 text-accent" />
                <span className="font-medium text-fg">
                  {mode === "done" ? "Done Today" : "Remaining Work"} —{" "}
                  {projName?.name}
                </span>
                {generatedAt && (
                  <span className="text-fg-subtle text-xs">
                    · {generatedAt}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={generate}
                  disabled={loading}
                  className="p-1.5 rounded-md hover:bg-bg-hover text-fg-muted transition-colors cursor-pointer"
                  title="Regenerate"
                >
                  <RefreshCw
                    className={cn(
                      "w-3.5 h-3.5",
                      loading && "animate-spin"
                    )}
                  />
                </button>
                <button
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-accent-subtle text-accent hover:bg-accent hover:text-accent-fg transition-colors cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-3 h-3" /> Copied!
                    </>
                  ) : (
                    <>
                      <ClipboardCopy className="w-3 h-3" /> Copy
                    </>
                  )}
                </button>
              </div>
            </div>
            <div className="px-5 py-4">
              <pre className="whitespace-pre-wrap text-sm text-fg leading-relaxed font-sans">
                {update}
              </pre>
            </div>
          </Card>
        )}

        {/* Empty state when no update yet */}
        {!update && !loading && selectedProject && (
          <div className="text-center py-12 space-y-3">
            <div className="w-12 h-12 rounded-full bg-accent-subtle flex items-center justify-center mx-auto">
              <ArrowRight className="w-5 h-5 text-accent" />
            </div>
            <p className="text-sm text-fg-muted">
              Click &quot;Generate Update&quot; to get your summary
            </p>
          </div>
        )}
      </div>
    </>
  );
}
