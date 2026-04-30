"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Folder, FileText, Check, Save, RefreshCw, Clipboard } from "lucide-react";
import type { TreeNode, TreemapPathRow } from "./types";

interface Props {
  projectId: number;
  token: string | null;
  isAdmin: boolean;
}

const TREE_CMD = "tree -L 5 -I 'node_modules|.git|.next|dist|build|.cache' -a";

export function TreemapViewer({ projectId, token, isAdmin }: Props) {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [paths, setPaths] = useState<Record<string, TreemapPathRow>>({});
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const refresh = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/treemap`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTree(data.tree || []);
        const map: Record<string, TreemapPathRow> = {};
        for (const p of data.paths || []) map[p.path] = p;
        setPaths(map);
        setUpdatedAt(data.entry?.updatedAt || null);

        // Auto-expand all directories for better visibility
        const allPaths = new Set<string>();
        const walk = (nodes: TreeNode[]) => {
          for (const node of nodes) {
            if (node.isDir) allPaths.add(node.path);
            walk(node.children);
          }
        };
        walk(data.tree || []);
        setExpanded(allPaths);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, [projectId, token]); // eslint-disable-line react-hooks/exhaustive-deps

  const stats = useMemo(() => {
    const all = Object.values(paths);
    const tested = all.filter((p) => p.tested).length;
    return { total: all.length, tested, untested: all.length - tested };
  }, [paths]);

  const toggleExpand = (p: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  };

  const togglePathTested = async (path: string, tested: boolean) => {
    if (!token) return;
    setPaths((prev) => ({
      ...prev,
      [path]: {
        ...(prev[path] || { id: 0, projectId, path, notes: null, lastTestedAt: null, updatedAt: new Date().toISOString() }),
        tested,
        lastTestedAt: tested ? new Date().toISOString() : null,
      } as TreemapPathRow,
    }));
    try {
      await fetch(`/api/projects/${projectId}/treemap/path`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ path, tested }),
      });
    } catch {}
  };

  const handlePaste = async () => {
    if (!pasteText.trim() || !token) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/treemap`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ body: pasteText, title: "Codebase treemap" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to save treemap");
      } else {
        setPasteText("");
        setShowPaste(false);
        await refresh();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const renderNode = (node: TreeNode) => {
    const matchesSearch = !search || node.path.toLowerCase().includes(search.toLowerCase());
    const childMatches = node.children.some((c) => {
      const walk = (n: TreeNode): boolean =>
        n.path.toLowerCase().includes(search.toLowerCase()) || n.children.some(walk);
      return walk(c);
    });
    if (search && !matchesSearch && !childMatches) return null;

    const isOpen = expanded.has(node.path) || !!search;
    const row = paths[node.path];
    const tested = !!row?.tested;
    const indent = (node.depth - 1) * 14;

    return (
      <div key={node.path}>
        <div
          className="group flex items-center gap-1.5 py-1 px-1 rounded-md hover:bg-[#f7f6f3]"
          style={{ paddingLeft: indent + 4 }}
        >
          {node.isDir && node.children.length > 0 ? (
            <button onClick={() => toggleExpand(node.path)} className="p-0.5">
              <ChevronRight
                className="w-3.5 h-3.5 transition-transform"
                style={{
                  transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
                  color: "#555a6a",
                }}
              />
            </button>
          ) : (
            <span className="w-4" />
          )}
          {node.isDir ? (
            <Folder className="w-3.5 h-3.5" style={{ color: "#a5a8b5" }} />
          ) : (
            <FileText className="w-3.5 h-3.5" style={{ color: "#a5a8b5" }} />
          )}
          <span
            className="text-xs flex-1 truncate"
            style={{
              color: tested ? "#187574" : "#1c1c1e",
              fontFamily: "DM Sans, sans-serif",
              fontWeight: tested ? 500 : 400,
            }}
            title={node.path}
          >
            {node.name}
          </span>
          <button
            onClick={() => togglePathTested(node.path, !tested)}
            className="opacity-60 group-hover:opacity-100 inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-md transition-all"
            style={{
              background: tested ? "#c3faf5" : "#f7f6f3",
              color: tested ? "#187574" : "#555a6a",
              border: "1px solid " + (tested ? "#c3faf5" : "#e9e9e9"),
              fontFamily: "DM Sans, sans-serif",
            }}
            title={tested ? "Mark untested" : "Mark tested"}
          >
            {tested ? <Check className="w-3 h-3" /> : null}
            {tested ? "Tested" : "Untested"}
          </button>
        </div>
        {isOpen && node.children.length > 0 && <div>{node.children.map(renderNode)}</div>}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-3 text-xs" style={{ color: "#555a6a", fontFamily: "DM Sans, sans-serif" }}>
          <span>
            <strong style={{ color: "#1c1c1e" }}>{stats.total}</strong> paths
          </span>
          <span>
            <strong style={{ color: "#187574" }}>{stats.tested}</strong> tested
          </span>
          <span>
            <strong style={{ color: "#a3324a" }}>{stats.untested}</strong> untested
          </span>
          {updatedAt && <span>· Updated {new Date(updatedAt).toLocaleString()}</span>}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            className="p-1.5 rounded-md hover:bg-[#f7f6f3]"
            title="Refresh"
          >
            <RefreshCw className="w-3.5 h-3.5" style={{ color: "#555a6a" }} />
          </button>
          {isAdmin && (
            <button
              onClick={() => setShowPaste((v) => !v)}
              className="px-3 py-1.5 text-xs font-medium rounded-md"
              style={{ background: "#c3faf5", color: "#187574", fontFamily: "DM Sans, sans-serif" }}
            >
              {showPaste ? "Cancel paste" : "Paste new tree"}
            </button>
          )}
        </div>
      </div>

      {showPaste && (
        <div
          className="rounded-xl p-4"
          style={{ background: "#fafafa", border: "1px solid #e9e9e9" }}
        >
          <div
            className="flex items-center justify-between gap-2 mb-2 px-3 py-2 rounded-md"
            style={{ background: "#1c1c1e", color: "#f7f6f3", fontFamily: "ui-monospace, SF Mono, Menlo, monospace" }}
          >
            <code className="text-xs">{TREE_CMD}</code>
            <button
              onClick={() => navigator.clipboard.writeText(TREE_CMD)}
              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded-md"
              style={{ background: "#2a2a2e", color: "#c3faf5" }}
            >
              <Clipboard className="w-3 h-3" /> Copy
            </button>
          </div>
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={12}
            placeholder="Paste raw output of `tree` command here..."
            className="w-full px-3 py-2 text-xs rounded-md outline-none focus:ring-2 resize-y"
            style={{
              background: "#ffffff",
              border: "1px solid #e9e9e9",
              fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
            }}
          />
          {error && (
            <div className="mt-2 text-xs" style={{ color: "#a3324a", fontFamily: "DM Sans, sans-serif" }}>
              {error}
            </div>
          )}
          <div className="flex justify-end mt-2">
            <button
              onClick={handlePaste}
              disabled={saving || !pasteText.trim()}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md disabled:opacity-50"
              style={{ background: "#c3faf5", color: "#187574", fontFamily: "DM Sans, sans-serif" }}
            >
              <Save className="w-3.5 h-3.5" /> {saving ? "Saving..." : "Save treemap"}
            </button>
          </div>
        </div>
      )}

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Filter paths..."
        className="w-full px-3 py-2 text-sm rounded-md outline-none focus:ring-2"
        style={{ background: "#fafafa", border: "1px solid #e9e9e9", fontFamily: "DM Sans, sans-serif" }}
      />

      <div
        className="rounded-xl p-2 max-h-[600px] overflow-auto"
        style={{ background: "#ffffff", border: "1px solid #e9e9e9" }}
      >
        {loading ? (
          <div className="text-xs p-4 text-center" style={{ color: "#a5a8b5", fontFamily: "DM Sans, sans-serif" }}>
            Loading...
          </div>
        ) : tree.length === 0 ? (
          <div className="text-xs p-6 text-center" style={{ color: "#a5a8b5", fontFamily: "DM Sans, sans-serif" }}>
            No treemap saved yet. {isAdmin ? "Paste one to begin." : "Ask an admin to add one."}
          </div>
        ) : (
          tree.map(renderNode)
        )}
      </div>
    </div>
  );
}
