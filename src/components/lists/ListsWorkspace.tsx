import React, { useState, useEffect, useCallback, useRef } from "react";
import { Button, Input, DatePicker, Modal, Checkbox, MultiSelectChips, AvatarGroup, useToast } from "@/components/ui";
import { Plus, Trash2, Edit2, ChevronDown, ChevronRight, CheckCircle2, Circle, ListTodo, History, RotateCcw, Undo2, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { contrastingText } from "@/lib/categories";

interface ChecklistItem {
  id: number;
  content: string;
  done: boolean;
  sortOrder: number;
}

interface Subtask {
  id: number;
  title: string;
  description: string | null;
  status: "active" | "completed";
  sortOrder: number;
  checklist: ChecklistItem[];
}

interface UserRef { id: number; name: string }
interface CategoryRef { id: number; name: string; color: string }

interface Task {
  id: number;
  title: string;
  description: string | null;
  status: "active" | "completed";
  priority: "none" | "low" | "medium" | "high";
  completedAt: string | null;
  dueDate: string | null;
  sortOrder: number;
  creator?: UserRef;
  assignees?: { user: UserRef }[];
  completers?: { user: UserRef }[];
  categories?: { category: CategoryRef }[];
  subtasks: Subtask[];
}

interface List {
  id: number;
  name: string;
  description: string | null;
  color: string;
  sortOrder: number;
  archived: boolean;
  tasks: Task[];
}

interface Member { user: UserRef; role: string }

interface ActivityRow {
  id: number;
  action: string;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
  taskId: number | null;
  user?: UserRef;
  task?: { id: number; title: string } | null;
}

type UndoEntry = {
  label: string;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  ts: number;
};

const UNDO_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

const PRIORITY_COLORS: Record<string, string> = {
  none: "#a5a8b5",
  low: "#3b82f6",
  medium: "#f59e0b",
  high: "#ef4444",
};

export function ListsWorkspace({ projectId }: { projectId: string }) {
  const [lists, setLists] = useState<List[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeListId, setActiveListId] = useState<number | null>(null);
  const [expandedTasks, setExpandedTasks] = useState<Set<number>>(new Set());
  const [expandedSubtasks, setExpandedSubtasks] = useState<Set<number>>(new Set());
  const { token, user } = useAuth();
  const toast = useToast();

  const [members, setMembers] = useState<Member[]>([]);
  const [projectCategories, setProjectCategories] = useState<CategoryRef[]>([]);

  // Undo/redo — session stack, 5-min window
  const undoStack = useRef<UndoEntry[]>([]);
  const redoStack = useRef<UndoEntry[]>([]);
  const [, forceRender] = useState(0);
  const bump = () => forceRender(n => n + 1);

  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<ActivityRow[]>([]);

  const [showCreateList, setShowCreateList] = useState(false);
  const [listForm, setListForm] = useState({ name: "", description: "", color: "#5b76fe" });

  const [showCreateTask, setShowCreateTask] = useState(false);
  const [taskForm, setTaskForm] = useState<{ title: string; description: string; priority: string; dueDate: string; assigneeIds: number[]; categoryIds: number[] }>({ title: "", description: "", priority: "none", dueDate: "", assigneeIds: [], categoryIds: [] });

  const [showCreateSubtask, setShowCreateSubtask] = useState<number | null>(null);
  const [subtaskForm, setSubtaskForm] = useState({ title: "", description: "" });

  const [newChecklistContent, setNewChecklistContent] = useState<Record<number, string>>({});

  const [editingList, setEditingList] = useState<number | null>(null);
  const [editListForm, setEditListForm] = useState({ name: "", description: "", color: "" });

  const fetchLists = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/lists`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setLists(data.lists || []);
        if (!activeListId && data.lists?.length > 0) {
          setActiveListId(data.lists[0].id);
        }
      }
    } catch (error) {
      console.error("Failed to fetch lists:", error);
    } finally {
      setIsLoading(false);
    }
  }, [projectId, token, activeListId]);

  useEffect(() => {
    if (token) fetchLists();
  }, [fetchLists, token]);

  // Fetch project members (assignee picker) + categories (labels)
  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const [pRes, cRes] = await Promise.all([
          fetch(`/api/projects/${projectId}`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`/api/projects/${projectId}/categories`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        if (pRes.ok) {
          const d = await pRes.json();
          setMembers(d.project?.members || []);
        }
        if (cRes.ok) {
          const d = await cRes.json();
          setProjectCategories(d.categories || d || []);
        }
      } catch (e) {
        console.error("Failed to fetch members/categories:", e);
      }
    })();
  }, [projectId, token]);

  const api = useCallback((path: string, method: string, body?: unknown) =>
    fetch(path, {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }), [token]);

  // Push an undoable action; show toast with Undo button
  const pushUndo = useCallback((entry: Omit<UndoEntry, "ts">) => {
    undoStack.current.push({ ...entry, ts: Date.now() });
    redoStack.current = [];
    bump();
    const id = toast.info(entry.label, {
      description: "Press Ctrl+Z to undo",
      duration: 6000,
    });
    void id;
  }, [toast]);

  const runUndo = useCallback(async () => {
    // Drop entries older than window
    const now = Date.now();
    undoStack.current = undoStack.current.filter(e => now - e.ts < UNDO_WINDOW_MS);
    const entry = undoStack.current.pop();
    if (!entry) return;
    try {
      await entry.undo();
      redoStack.current.push(entry);
      bump();
      await fetchLists();
      toast.success(`Undone: ${entry.label}`);
    } catch {
      toast.error("Undo failed");
    }
  }, [fetchLists, toast]);

  const runRedo = useCallback(async () => {
    const entry = redoStack.current.pop();
    if (!entry) return;
    try {
      await entry.redo();
      undoStack.current.push({ ...entry, ts: Date.now() });
      bump();
      await fetchLists();
      toast.success(`Redone: ${entry.label}`);
    } catch {
      toast.error("Redo failed");
    }
  }, [fetchLists, toast]);

  // Keyboard: Ctrl+Z undo, Ctrl+Shift+Z / Ctrl+Y redo
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) runRedo(); else runUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        runRedo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [runUndo, runRedo]);

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/task-activity?limit=100`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const d = await res.json();
        setHistory(d.activities || []);
      }
    } catch (e) {
      console.error("Failed to load history:", e);
    }
  }, [projectId, token]);

  // Restore a task/subtask from a delete activity row. Needs list context.
  const handleRestoreFromHistory = useCallback(async (row: ActivityRow) => {
    try {
      if (row.action === "task_deleted" && row.taskId) {
        // find the list containing this task across all lists (deleted tasks not in state) — brute force per list
        for (const l of lists) {
          const r = await api(`/api/projects/${projectId}/lists/${l.id}/tasks/${row.taskId}`, "PATCH", { restore: true });
          if (r.ok) break;
        }
      } else if (row.action === "list_deleted") {
        // list id unknown from row; reload handles nothing — skip (lists restore via undo)
        toast.info("Restore deleted lists via Undo (Ctrl+Z)");
        return;
      } else {
        toast.info("This change can't be restored from history");
        return;
      }
      await fetchLists();
      await loadHistory();
      toast.success("Restored");
    } catch {
      toast.error("Restore failed");
    }
  }, [lists, projectId, api, fetchLists, loadHistory, toast]);

  const activeList = lists.find(l => l.id === activeListId);

  const handleCreateList = async () => {
    if (!listForm.name) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/lists`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(listForm),
      });
      if (res.ok) {
        const data = await res.json();
        setLists(prev => [...prev, { ...data.list, tasks: [] }]);
        setActiveListId(data.list.id);
        setShowCreateList(false);
        setListForm({ name: "", description: "", color: "#5b76fe" });
      }
    } catch (error) {
      console.error("Create list error:", error);
    }
  };

  const handleDeleteList = async (listId: number) => {
    const listName = lists.find(l => l.id === listId)?.name || "list";
    try {
      await api(`/api/projects/${projectId}/lists/${listId}`, "DELETE");
      setLists(prev => prev.filter(l => l.id !== listId));
      if (activeListId === listId) {
        setActiveListId(lists.find(l => l.id !== listId)?.id || null);
      }
      pushUndo({
        label: `Deleted list "${listName}"`,
        undo: async () => { await api(`/api/projects/${projectId}/lists/${listId}`, "PATCH", { restore: true }); },
        redo: async () => { await api(`/api/projects/${projectId}/lists/${listId}`, "DELETE"); },
      });
    } catch (error) {
      console.error("Delete list error:", error);
    }
  };

  const handleCreateTask = async () => {
    if (!taskForm.title || !activeListId) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/lists/${activeListId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(taskForm),
      });
      if (res.ok) {
        await fetchLists();
        setShowCreateTask(false);
        setTaskForm({ title: "", description: "", priority: "none", dueDate: "", assigneeIds: [], categoryIds: [] });
      }
    } catch (error) {
      console.error("Create task error:", error);
    }
  };

  const handleToggleTask = async (task: Task) => {
    const newStatus = task.status === "active" ? "completed" : "active";
    try {
      await fetch(`/api/projects/${projectId}/lists/${activeListId}/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus }),
      });
      setLists(prev => prev.map(l => l.id === activeListId ? {
        ...l,
        tasks: l.tasks.map(t => t.id === task.id ? { ...t, status: newStatus, completedAt: newStatus === "completed" ? new Date().toISOString() : null } : t),
      } : l));
    } catch (error) {
      console.error("Toggle task error:", error);
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    const lid = activeListId;
    const taskName = activeList?.tasks.find(t => t.id === taskId)?.title || "task";
    try {
      await api(`/api/projects/${projectId}/lists/${lid}/tasks/${taskId}`, "DELETE");
      setLists(prev => prev.map(l => l.id === lid ? {
        ...l, tasks: l.tasks.filter(t => t.id !== taskId),
      } : l));
      pushUndo({
        label: `Deleted task "${taskName}"`,
        undo: async () => { await api(`/api/projects/${projectId}/lists/${lid}/tasks/${taskId}`, "PATCH", { restore: true }); },
        redo: async () => { await api(`/api/projects/${projectId}/lists/${lid}/tasks/${taskId}`, "DELETE"); },
      });
    } catch (error) {
      console.error("Delete task error:", error);
    }
  };

  const handleCreateSubtask = async (taskId: number) => {
    if (!subtaskForm.title) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/lists/${activeListId}/tasks/${taskId}/subtasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(subtaskForm),
      });
      if (res.ok) {
        await fetchLists();
        setShowCreateSubtask(null);
        setSubtaskForm({ title: "", description: "" });
      }
    } catch (error) {
      console.error("Create subtask error:", error);
    }
  };

  const handleToggleSubtask = async (taskId: number, subtask: Subtask) => {
    const newStatus = subtask.status === "active" ? "completed" : "active";
    try {
      await fetch(`/api/projects/${projectId}/lists/${activeListId}/tasks/${taskId}/subtasks/${subtask.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus }),
      });
      await fetchLists();
    } catch (error) {
      console.error("Toggle subtask error:", error);
    }
  };

  const handleDeleteSubtask = async (taskId: number, subtaskId: number) => {
    const lid = activeListId;
    const base = `/api/projects/${projectId}/lists/${lid}/tasks/${taskId}/subtasks/${subtaskId}`;
    try {
      await api(base, "DELETE");
      await fetchLists();
      pushUndo({
        label: "Deleted subtask",
        undo: async () => { await api(base, "PATCH", { restore: true }); },
        redo: async () => { await api(base, "DELETE"); },
      });
    } catch (error) {
      console.error("Delete subtask error:", error);
    }
  };

  const handleAddChecklistItem = async (taskId: number, subtaskId: number) => {
    const content = newChecklistContent[subtaskId];
    if (!content) return;
    try {
      await fetch(`/api/projects/${projectId}/lists/${activeListId}/tasks/${taskId}/subtasks/${subtaskId}/checklist`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content }),
      });
      setNewChecklistContent(prev => ({ ...prev, [subtaskId]: "" }));
      await fetchLists();
    } catch (error) {
      console.error("Add checklist error:", error);
    }
  };

  const handleToggleChecklist = async (taskId: number, subtaskId: number, item: ChecklistItem) => {
    try {
      await fetch(`/api/projects/${projectId}/lists/${activeListId}/tasks/${taskId}/subtasks/${subtaskId}/checklist/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ done: !item.done }),
      });
      await fetchLists();
    } catch (error) {
      console.error("Toggle checklist error:", error);
    }
  };

  const handleDeleteChecklist = async (taskId: number, subtaskId: number, itemId: number) => {
    const lid = activeListId;
    const base = `/api/projects/${projectId}/lists/${lid}/tasks/${taskId}/subtasks/${subtaskId}/checklist/${itemId}`;
    try {
      await api(base, "DELETE");
      await fetchLists();
      pushUndo({
        label: "Deleted checklist item",
        undo: async () => { await api(base, "PATCH", { restore: true }); },
        redo: async () => { await api(base, "DELETE"); },
      });
    } catch (error) {
      console.error("Delete checklist error:", error);
    }
  };

  const handleEditList = async () => {
    if (!editingList || !editListForm.name) return;
    try {
      await fetch(`/api/projects/${projectId}/lists/${editingList}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(editListForm),
      });
      setLists(prev => prev.map(l => l.id === editingList ? { ...l, ...editListForm } : l));
      setEditingList(null);
    } catch (error) {
      console.error("Edit list error:", error);
    }
  };

  const handleUpdateTask = async (taskId: number, updates: Record<string, unknown>) => {
    if (!activeListId) return;
    try {
      await fetch(`/api/projects/${projectId}/lists/${activeListId}/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(updates),
      });
      setLists(prev => prev.map(l => l.id === activeListId ? {
        ...l, tasks: l.tasks.map(t => t.id === taskId ? { ...t, ...updates } as Task : t),
      } : l));
    } catch (error) {
      console.error("Update task error:", error);
    }
  };

  const handleUpdateSubtask = async (taskId: number, subtaskId: number, updates: Record<string, unknown>) => {
    if (!activeListId) return;
    try {
      await fetch(`/api/projects/${projectId}/lists/${activeListId}/tasks/${taskId}/subtasks/${subtaskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(updates),
      });
      setLists(prev => prev.map(l => l.id === activeListId ? {
        ...l, tasks: l.tasks.map(t => t.id === taskId ? {
          ...t, subtasks: t.subtasks.map(s => s.id === subtaskId ? { ...s, ...updates } as Subtask : s),
        } : t),
      } : l));
    } catch (error) {
      console.error("Update subtask error:", error);
    }
  };

  const handleUpdateTaskMeta = async (taskId: number, updates: { assigneeIds?: number[]; categoryIds?: number[] }) => {
    if (!activeListId) return;
    setLists(prev => prev.map(l => l.id === activeListId ? {
      ...l, tasks: l.tasks.map(t => {
        if (t.id !== taskId) return t;
        const next = { ...t };
        if (updates.assigneeIds) next.assignees = updates.assigneeIds.map(id => ({ user: members.find(m => m.user.id === id)?.user || { id, name: "?" } }));
        if (updates.categoryIds) next.categories = updates.categoryIds.map(id => projectCategories.find(c => c.id === id)).filter(Boolean).map(c => ({ category: c as CategoryRef }));
        return next;
      }),
    } : l));
    try {
      await api(`/api/projects/${projectId}/lists/${activeListId}/tasks/${taskId}`, "PATCH", updates);
    } catch (error) {
      console.error("Update task meta error:", error);
      await fetchLists();
    }
  };

  const toggleTask = (taskId: number) => {
    setExpandedTasks(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId); else next.add(taskId);
      return next;
    });
  };

  const toggleSubtaskExpand = (subtaskId: number) => {
    setExpandedSubtasks(prev => {
      const next = new Set(prev);
      if (next.has(subtaskId)) next.delete(subtaskId); else next.add(subtaskId);
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-6 h-6 border-2 border-t-transparent rounded-full" style={{ borderColor: "#5b76fe", borderTopColor: "transparent" }} />
      </div>
    );
  }

  const activeTasks = activeList?.tasks.filter(t => t.status === "active") || [];
  const completedTasks = activeList?.tasks.filter(t => t.status === "completed") || [];

  return (
    <div className="flex flex-col md:flex-row gap-4 md:gap-6" style={{ minHeight: 400 }}>
      {/* Left: List Rail — horizontal scroll on mobile, vertical sidebar on desktop */}
      <div className="md:w-56 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold" style={{ color: "#1c1c1e", fontFamily: "DM Sans, sans-serif" }}>Lists</h3>
          <button onClick={() => setShowCreateList(true)} className="p-1 rounded hover:bg-gray-100 transition-colors">
            <Plus className="w-4 h-4" style={{ color: "#5b76fe" }} />
          </button>
        </div>
        <div className="flex md:flex-col gap-1.5 md:gap-1 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0" style={{ scrollbarWidth: "none" }}>
          {lists.map(list => (
            <div
              key={list.id}
              className="group flex items-center gap-2 px-3 py-1.5 md:py-2 rounded-full md:rounded-lg cursor-pointer transition-all flex-shrink-0 md:flex-shrink border-l-0 md:border-l-[3px]"
              style={{
                background: activeListId === list.id ? "#f0f2ff" : "transparent",
                borderLeftColor: activeListId === list.id ? list.color : "transparent",
              }}
              onClick={() => setActiveListId(list.id)}
            >
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: list.color }} />
              <span className="text-sm truncate" style={{ color: activeListId === list.id ? "#1c1c1e" : "#555a6a", fontWeight: activeListId === list.id ? 600 : 400, fontFamily: "DM Sans, sans-serif" }}>
                {list.name}
              </span>
              <span className="text-xs" style={{ color: "#a5a8b5" }}>
                {list.tasks.filter(t => t.status === "active").length}
              </span>
              <div className="hidden group-hover:flex items-center gap-0.5">
                <button onClick={(e) => { e.stopPropagation(); setEditingList(list.id); setEditListForm({ name: list.name, description: list.description || "", color: list.color }); }} className="p-0.5 rounded hover:bg-gray-200">
                  <Edit2 className="w-3 h-3" style={{ color: "#555a6a" }} />
                </button>
                <button onClick={(e) => { e.stopPropagation(); handleDeleteList(list.id); }} className="p-0.5 rounded hover:bg-gray-200">
                  <Trash2 className="w-3 h-3" style={{ color: "#ef4444" }} />
                </button>
              </div>
            </div>
          ))}
          {lists.length === 0 && (
            <p className="text-xs px-3 py-4 text-center" style={{ color: "#a5a8b5" }}>No lists yet</p>
          )}
        </div>
      </div>

      {/* Right: Task Content */}
      <div className="flex-1 min-w-0">
        {activeList ? (
          <>
            <div className="flex items-center justify-between mb-4 gap-3">
              <div className="min-w-0">
                <h2 className="text-base md:text-lg font-semibold truncate" style={{ color: "#1c1c1e", fontFamily: "DM Sans, sans-serif" }}>
                  {activeList.name}
                </h2>
                {activeList.description && (
                  <p className="text-sm mt-0.5 truncate" style={{ color: "#555a6a" }}>{activeList.description}</p>
                )}
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  onClick={runUndo}
                  disabled={undoStack.current.length === 0}
                  title="Undo (Ctrl+Z)"
                  className="p-1.5 rounded-lg transition-colors disabled:opacity-30 hover:bg-gray-100"
                >
                  <Undo2 className="w-4 h-4" style={{ color: "#555a6a" }} />
                </button>
                <button
                  onClick={runRedo}
                  disabled={redoStack.current.length === 0}
                  title="Redo (Ctrl+Shift+Z)"
                  className="p-1.5 rounded-lg transition-colors disabled:opacity-30 hover:bg-gray-100"
                >
                  <RotateCcw className="w-4 h-4 scale-x-[-1]" style={{ color: "#555a6a" }} />
                </button>
                <button
                  onClick={() => { setShowHistory(true); loadHistory(); }}
                  title="Activity history"
                  className="p-1.5 rounded-lg transition-colors hover:bg-gray-100"
                >
                  <History className="w-4 h-4" style={{ color: "#555a6a" }} />
                </button>
                <Button
                  onClick={() => setShowCreateTask(true)}
                  className="flex-shrink-0"
                  style={{ background: "#5b76fe", borderRadius: "8px", fontFamily: "DM Sans, sans-serif" }}
                >
                  <Plus className="w-4 h-4 md:mr-1" /><span className="hidden md:inline"> Add Task</span>
                </Button>
              </div>
            </div>

            {/* Active Tasks */}
            <div className="rounded-xl border" style={{ borderColor: "#e9eaef", background: "#ffffff" }}>
              {activeTasks.map(task => (
                <TaskRow
                  key={task.id}
                  task={task}
                  members={members}
                  projectCategories={projectCategories}
                  expanded={expandedTasks.has(task.id)}
                  expandedSubtasks={expandedSubtasks}
                  onToggle={() => toggleTask(task.id)}
                  onToggleStatus={() => handleToggleTask(task)}
                  onDelete={() => handleDeleteTask(task.id)}
                  onAddSubtask={() => { setShowCreateSubtask(task.id); setSubtaskForm({ title: "", description: "" }); }}
                  onToggleSubtask={(sub) => handleToggleSubtask(task.id, sub)}
                  onDeleteSubtask={(subId) => handleDeleteSubtask(task.id, subId)}
                  onToggleSubtaskExpand={toggleSubtaskExpand}
                  onAddChecklist={(subId) => handleAddChecklistItem(task.id, subId)}
                  onToggleChecklist={(subId, item) => handleToggleChecklist(task.id, subId, item)}
                  onDeleteChecklist={(subId, itemId) => handleDeleteChecklist(task.id, subId, itemId)}
                  onUpdateTask={(updates) => handleUpdateTask(task.id, updates)}
                  onUpdateSubtask={(subtaskId, updates) => handleUpdateSubtask(task.id, subtaskId, updates)}
                  onUpdateMeta={(updates) => handleUpdateTaskMeta(task.id, updates)}
                  newChecklistContent={newChecklistContent}
                  setNewChecklistContent={setNewChecklistContent}
                />
              ))}
            </div>

            {/* Completed Tasks */}
            {completedTasks.length > 0 && (
              <div className="mt-4">
                <h4 className="text-[11px] font-semibold uppercase tracking-wider mb-1.5 px-2" style={{ color: "#b8bbc5" }}>
                  Completed ({completedTasks.length})
                </h4>
                <div className="rounded-xl border" style={{ borderColor: "#e9eaef", background: "#fafbfc" }}>
                  {completedTasks.map(task => (
                    <div key={task.id} className="group flex items-center gap-2 px-2 md:px-3 py-2 border-b last:border-b-0 transition-colors hover:bg-[#f5f6f8]" style={{ borderColor: "#f0f0f2" }}>
                      <button onClick={() => handleToggleTask(task)} className="flex-shrink-0">
                        <CheckCircle2 className="w-[18px] h-[18px]" style={{ color: "#00b473" }} />
                      </button>
                      <span className="text-[13px] line-through flex-1 min-w-0 break-words" style={{ color: "#b8bbc5", fontFamily: "DM Sans, sans-serif" }}>
                        {task.title}
                      </span>
                      <button onClick={() => handleDeleteTask(task.id)} className="p-1 rounded hover:bg-gray-200 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 className="w-3 h-3" style={{ color: "#ef4444" }} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTasks.length === 0 && completedTasks.length === 0 && (
              <div className="text-center py-16">
                <ListTodo className="w-12 h-12 mx-auto mb-3" style={{ color: "#e9eaef" }} />
                <p className="text-sm" style={{ color: "#a5a8b5", fontFamily: "DM Sans, sans-serif" }}>No tasks yet. Add your first task.</p>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-16">
            <ListTodo className="w-12 h-12 mx-auto mb-3" style={{ color: "#e9eaef" }} />
            <p className="text-sm" style={{ color: "#a5a8b5", fontFamily: "DM Sans, sans-serif" }}>Create a list to get started.</p>
          </div>
        )}
      </div>

      {/* Create List Modal */}
      <Modal isOpen={showCreateList} onClose={() => setShowCreateList(false)} title="Create List">
        <div className="space-y-4">
          <Input label="Name" value={listForm.name} onChange={e => setListForm(prev => ({ ...prev, name: e.target.value }))} placeholder="List name" />
          <Input label="Description" value={listForm.description} onChange={e => setListForm(prev => ({ ...prev, description: e.target.value }))} placeholder="Optional description" />
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "#1c1c1e", fontFamily: "DM Sans, sans-serif" }}>Color</label>
            <input type="color" value={listForm.color} onChange={e => setListForm(prev => ({ ...prev, color: e.target.value }))} className="w-10 h-10 rounded cursor-pointer border-0" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowCreateList(false)}>Cancel</Button>
            <Button onClick={handleCreateList} style={{ background: "#5b76fe" }}>Create</Button>
          </div>
        </div>
      </Modal>

      {/* Create Task Modal */}
      <Modal isOpen={showCreateTask} onClose={() => setShowCreateTask(false)} title="Add Task">
        <div className="space-y-4">
          <Input label="Title" value={taskForm.title} onChange={e => setTaskForm(prev => ({ ...prev, title: e.target.value }))} placeholder="Task title" />
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "#1c1c1e", fontFamily: "DM Sans, sans-serif" }}>Description</label>
            <textarea className="w-full px-3 py-2 text-sm rounded-md border focus:outline-none" style={{ borderColor: "#e9eaef" }} rows={3} value={taskForm.description} onChange={e => setTaskForm(prev => ({ ...prev, description: e.target.value }))} placeholder="Optional description" />
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1" style={{ color: "#1c1c1e", fontFamily: "DM Sans, sans-serif" }}>Priority</label>
              <select className="w-full px-3 py-2 text-sm rounded-md border" style={{ borderColor: "#e9eaef" }} value={taskForm.priority} onChange={e => setTaskForm(prev => ({ ...prev, priority: e.target.value }))}>
                <option value="none">None</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1" style={{ color: "#1c1c1e", fontFamily: "DM Sans, sans-serif" }}>Due Date</label>
              <DatePicker value={taskForm.dueDate} onChange={val => setTaskForm(prev => ({ ...prev, dueDate: val }))} />
            </div>
          </div>
          <MultiSelectChips
            label="Assign to"
            options={members.map(m => ({ id: m.user.id, label: m.user.name }))}
            value={taskForm.assigneeIds}
            onChange={ids => setTaskForm(prev => ({ ...prev, assigneeIds: ids }))}
            placeholder="Add assignees"
            emptyMessage="No members"
            searchable
          />
          <MultiSelectChips
            label="Labels"
            options={projectCategories.map(c => ({ id: c.id, label: c.name, color: c.color }))}
            value={taskForm.categoryIds}
            onChange={ids => setTaskForm(prev => ({ ...prev, categoryIds: ids }))}
            placeholder="Add labels"
            emptyMessage="No labels — create in Settings"
            searchable
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowCreateTask(false)}>Cancel</Button>
            <Button onClick={handleCreateTask} style={{ background: "#5b76fe" }}>Add Task</Button>
          </div>
        </div>
      </Modal>

      {/* Create Subtask Modal */}
      <Modal isOpen={showCreateSubtask !== null} onClose={() => setShowCreateSubtask(null)} title="Add Subtask">
        <div className="space-y-4">
          <Input label="Title" value={subtaskForm.title} onChange={e => setSubtaskForm(prev => ({ ...prev, title: e.target.value }))} placeholder="Subtask title" />
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "#1c1c1e", fontFamily: "DM Sans, sans-serif" }}>Description</label>
            <textarea className="w-full px-3 py-2 text-sm rounded-md border focus:outline-none" style={{ borderColor: "#e9eaef" }} rows={2} value={subtaskForm.description} onChange={e => setSubtaskForm(prev => ({ ...prev, description: e.target.value }))} placeholder="Optional" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowCreateSubtask(null)}>Cancel</Button>
            <Button onClick={() => showCreateSubtask && handleCreateSubtask(showCreateSubtask)} style={{ background: "#5b76fe" }}>Add Subtask</Button>
          </div>
        </div>
      </Modal>

      {/* Edit List Modal */}
      <Modal isOpen={editingList !== null} onClose={() => setEditingList(null)} title="Edit List">
        <div className="space-y-4">
          <Input label="Name" value={editListForm.name} onChange={e => setEditListForm(prev => ({ ...prev, name: e.target.value }))} />
          <Input label="Description" value={editListForm.description} onChange={e => setEditListForm(prev => ({ ...prev, description: e.target.value }))} />
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "#1c1c1e", fontFamily: "DM Sans, sans-serif" }}>Color</label>
            <input type="color" value={editListForm.color} onChange={e => setEditListForm(prev => ({ ...prev, color: e.target.value }))} className="w-10 h-10 rounded cursor-pointer border-0" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setEditingList(null)}>Cancel</Button>
            <Button onClick={handleEditList} style={{ background: "#5b76fe" }}>Save</Button>
          </div>
        </div>
      </Modal>

      {/* Activity History Panel */}
      <Modal isOpen={showHistory} onClose={() => setShowHistory(false)} title="Activity History" size="lg">
        <div className="space-y-1 max-h-[60vh] overflow-y-auto">
          {history.length === 0 && (
            <p className="text-sm text-center py-8" style={{ color: "#a5a8b5" }}>No activity yet.</p>
          )}
          {history.map(row => (
            <HistoryRow key={row.id} row={row} onRestore={handleRestoreFromHistory} />
          ))}
        </div>
      </Modal>
    </div>
  );
}

function TaskRow({
  task, members, projectCategories, expanded, expandedSubtasks, onToggle, onToggleStatus, onDelete, onAddSubtask,
  onToggleSubtask, onDeleteSubtask, onToggleSubtaskExpand,
  onAddChecklist, onToggleChecklist, onDeleteChecklist,
  newChecklistContent, setNewChecklistContent,
  onUpdateTask, onUpdateSubtask, onUpdateMeta,
}: {
  task: Task;
  members: Member[];
  projectCategories: CategoryRef[];
  expanded: boolean;
  expandedSubtasks: Set<number>;
  onToggle: () => void;
  onToggleStatus: () => void;
  onDelete: () => void;
  onAddSubtask: () => void;
  onToggleSubtask: (sub: Subtask) => void;
  onDeleteSubtask: (subId: number) => void;
  onToggleSubtaskExpand: (subId: number) => void;
  onAddChecklist: (subId: number) => void;
  onToggleChecklist: (subId: number, item: ChecklistItem) => void;
  onDeleteChecklist: (subId: number, itemId: number) => void;
  newChecklistContent: Record<number, string>;
  setNewChecklistContent: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  onUpdateTask: (updates: Record<string, unknown>) => void;
  onUpdateSubtask: (subtaskId: number, updates: Record<string, unknown>) => void;
  onUpdateMeta: (updates: { assigneeIds?: number[]; categoryIds?: number[] }) => void;
}) {
  const completedSubs = task.subtasks.filter(s => s.status === "completed").length;
  const totalSubs = task.subtasks.length;
  const assignees = task.assignees || [];
  const labels = task.categories || [];

  return (
    <div className="border-b last:border-b-0 transition-all" style={{ borderColor: "#f0f0f2" }}>
      {/* Task Header */}
      <div className="flex items-center gap-2 px-1 md:px-2 py-2 md:py-2.5 group cursor-pointer hover:bg-[#fafbfc] rounded-md transition-colors">
        <button onClick={onToggle} className="flex-shrink-0 p-0.5">
          {expanded ? <ChevronDown className="w-3.5 h-3.5" style={{ color: "#a5a8b5" }} /> : <ChevronRight className="w-3.5 h-3.5" style={{ color: "#a5a8b5" }} />}
        </button>
        <button onClick={onToggleStatus} className="flex-shrink-0">
          <Circle className="w-[18px] h-[18px]" strokeWidth={2} style={{ color: PRIORITY_COLORS[task.priority] }} />
        </button>
        <div className="flex-1 min-w-0" onClick={onToggle}>
          <span className="text-[13px] leading-5 break-words" style={{ color: "#1c1c1e", fontFamily: "DM Sans, sans-serif" }}>
            {task.title}
          </span>
          {totalSubs > 0 && (
            <span className="ml-1.5 text-[11px]" style={{ color: "#b8bbc5" }}>
              {completedSubs}/{totalSubs}
            </span>
          )}
        </div>
        {/* Labels */}
        {labels.length > 0 && (
          <div className="hidden sm:flex items-center gap-1 flex-shrink-0">
            {labels.slice(0, 3).map(({ category: c }) => (
              <span key={c.id} className="text-[10px] px-1.5 py-0.5 rounded font-medium leading-none" style={{ background: c.color, color: contrastingText(c.color) }}>
                {c.name}
              </span>
            ))}
          </div>
        )}
        {/* Assignee avatars */}
        {assignees.length > 0 && (
          <div className="flex-shrink-0">
            <AvatarGroup names={assignees.map(a => a.user.name)} max={3} size="xs" />
          </div>
        )}
        {task.dueDate && (
          <span className="text-[11px] flex-shrink-0" style={{ color: "#a5a8b5" }}>
            {new Date(task.dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </span>
        )}
        <div className="hidden md:group-hover:flex items-center gap-0.5 flex-shrink-0">
          <button onClick={onAddSubtask} className="p-1 rounded hover:bg-gray-100" title="Add subtask">
            <Plus className="w-3.5 h-3.5" style={{ color: "#5b76fe" }} />
          </button>
          <button onClick={onDelete} className="p-1 rounded hover:bg-gray-100" title="Delete">
            <Trash2 className="w-3.5 h-3.5" style={{ color: "#ef4444" }} />
          </button>
        </div>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="pb-2 ml-7 md:ml-8 mr-1 md:mr-2">
          <div className="mb-2">
            <InlineDescription
              value={task.description}
              placeholder="Add a description..."
              onSave={(val) => onUpdateTask({ description: val || null })}
              textSize="text-[13px]"
            />
          </div>

          {/* Assignees + Labels pickers */}
          <div className="flex flex-col sm:flex-row gap-3 mb-3">
            <div className="flex-1 min-w-0">
              <MultiSelectChips
                label="Assignees"
                options={members.map(m => ({ id: m.user.id, label: m.user.name }))}
                value={assignees.map(a => a.user.id)}
                onChange={ids => onUpdateMeta({ assigneeIds: ids })}
                placeholder="Assign members"
                emptyMessage="No members"
                searchable
              />
            </div>
            <div className="flex-1 min-w-0">
              <MultiSelectChips
                label="Labels"
                options={projectCategories.map(c => ({ id: c.id, label: c.name, color: c.color }))}
                value={labels.map(l => l.category.id)}
                onChange={ids => onUpdateMeta({ categoryIds: ids })}
                placeholder="Add labels"
                emptyMessage="No labels — create in Settings"
                searchable
              />
            </div>
          </div>

          {/* Completed-by */}
          {task.completers && task.completers.length > 0 && (
            <div className="flex items-center gap-1.5 mb-2 text-[11px]" style={{ color: "#00b473" }}>
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Completed by {task.completers.map(c => c.user.name).join(", ")}</span>
            </div>
          )}

          {/* Subtasks */}
          <div className="space-y-0.5">
            {task.subtasks.map(sub => (
              <div key={sub.id}>
                <div className="flex items-center gap-1.5 py-1 group/sub rounded hover:bg-[#fafbfc] px-1 transition-colors">
                  <button onClick={() => onToggleSubtaskExpand(sub.id)} className="flex-shrink-0 p-0.5">
                    {expandedSubtasks.has(sub.id) ? <ChevronDown className="w-3 h-3" style={{ color: "#c7cad5" }} /> : <ChevronRight className="w-3 h-3" style={{ color: "#c7cad5" }} />}
                  </button>
                  <button onClick={() => onToggleSubtask(sub)} className="flex-shrink-0">
                    {sub.status === "completed" ? (
                      <CheckCircle2 className="w-[15px] h-[15px]" style={{ color: "#00b473" }} />
                    ) : (
                      <Circle className="w-[15px] h-[15px]" strokeWidth={2} style={{ color: "#d1d4db" }} />
                    )}
                  </button>
                  <span className={`text-[12px] flex-1 min-w-0 ${sub.status === "completed" ? "line-through" : ""}`} style={{ color: sub.status === "completed" ? "#b8bbc5" : "#333", fontFamily: "DM Sans, sans-serif" }}>
                    {sub.title}
                  </span>
                  {sub.checklist.length > 0 && (
                    <span className="text-[10px] flex-shrink-0" style={{ color: "#b8bbc5" }}>
                      {sub.checklist.filter(c => c.done).length}/{sub.checklist.length}
                    </span>
                  )}
                  <button onClick={() => onDeleteSubtask(sub.id)} className="p-0.5 rounded hover:bg-gray-100 flex-shrink-0 opacity-0 group-hover/sub:opacity-100 transition-opacity">
                    <Trash2 className="w-3 h-3" style={{ color: "#ef4444" }} />
                  </button>
                </div>

                {/* Checklist (under subtask) */}
                {expandedSubtasks.has(sub.id) && (
                  <div className="ml-7 space-y-0.5 mt-0.5 mb-1.5">
                    <div className="mb-1.5">
                      <InlineDescription
                        value={sub.description}
                        placeholder="Add a description..."
                        onSave={(val) => onUpdateSubtask(sub.id, { description: val || null })}
                        textSize="text-[11px]"
                      />
                    </div>
                    {sub.checklist.map(item => (
                      <div key={item.id} className="flex items-center gap-1.5 py-0.5 group/check rounded hover:bg-[#fafbfc] px-1 transition-colors">
                        <Checkbox
                          checked={item.done}
                          onCheckedChange={() => onToggleChecklist(sub.id, item)}
                        />
                        <span className={`text-[11px] flex-1 ${item.done ? "line-through" : ""}`} style={{ color: item.done ? "#b8bbc5" : "#555a6a" }}>
                          {item.content}
                        </span>
                        <button onClick={() => onDeleteChecklist(sub.id, item.id)} className="p-0.5 rounded hover:bg-gray-100 flex-shrink-0 opacity-0 group-hover/check:opacity-100 transition-opacity">
                          <Trash2 className="w-2.5 h-2.5" style={{ color: "#ef4444" }} />
                        </button>
                      </div>
                    ))}
                    <div className="flex items-center gap-1.5 mt-1">
                      <input
                        type="text"
                        className="flex-1 px-2 py-1 text-[11px] rounded border-0 outline-none focus:outline-none transition-colors"
                        style={{ background: "#f5f6f8", boxShadow: "none" }}
                        placeholder="Add checklist item..."
                        value={newChecklistContent[sub.id] || ""}
                        onChange={e => setNewChecklistContent(prev => ({ ...prev, [sub.id]: e.target.value }))}
                        onKeyDown={e => { if (e.key === "Enter") onAddChecklist(sub.id); }}
                      />
                      <button onClick={() => onAddChecklist(sub.id)} className="p-1 rounded hover:bg-gray-100">
                        <Plus className="w-3 h-3" style={{ color: "#5b76fe" }} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Add subtask button — always inside expanded */}
          <button onClick={onAddSubtask} className="text-[11px] flex items-center gap-1 py-1 mt-1 px-1 rounded hover:bg-[#f0f2ff] transition-colors" style={{ color: "#5b76fe" }}>
            <Plus className="w-3 h-3" /> Add subtask
          </button>

          {/* Mobile-only actions */}
          <div className="flex md:hidden items-center gap-2 mt-2 pt-2 border-t" style={{ borderColor: "#f5f5f5" }}>
            <button onClick={onDelete} className="text-[11px] flex items-center gap-1 px-2 py-1 rounded hover:bg-red-50 transition-colors" style={{ color: "#ef4444" }}>
              <Trash2 className="w-3 h-3" /> Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function HistoryRow({ row, onRestore }: { row: ActivityRow; onRestore: (row: ActivityRow) => void }) {
  const isDelete = row.action.endsWith("_deleted");
  const label = row.action.replace(/_/g, " ");
  const when = new Date(row.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  return (
    <div className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-[#fafbfc] transition-colors">
      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0`} style={{ background: isDelete ? "#ef4444" : "#5b76fe" }} />
      <div className="flex-1 min-w-0">
        <div className="text-[12px] truncate" style={{ color: "#1c1c1e", fontFamily: "DM Sans, sans-serif" }}>
          <span className="capitalize font-medium">{label}</span>
          {(row.task?.title || row.oldValue || row.newValue) && (
            <span style={{ color: "#555a6a" }}> — {row.task?.title || row.oldValue || row.newValue}</span>
          )}
        </div>
        <div className="text-[10px]" style={{ color: "#a5a8b5" }}>
          {row.user?.name || "Someone"} · {when}
        </div>
      </div>
      {isDelete && row.action === "task_deleted" && (
        <button onClick={() => onRestore(row)} className="text-[11px] flex items-center gap-1 px-2 py-1 rounded hover:bg-[#f0f2ff] transition-colors flex-shrink-0" style={{ color: "#5b76fe" }}>
          <RotateCcw className="w-3 h-3" /> Restore
        </button>
      )}
    </div>
  );
}

function InlineDescription({
  value,
  placeholder,
  onSave,
  textSize,
}: {
  value: string | null;
  placeholder: string;
  onSave: (val: string) => void;
  textSize: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || "");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && textareaRef.current) {
      const ta = textareaRef.current;
      ta.focus();
      ta.selectionStart = ta.value.length;
      ta.style.height = "auto";
      ta.style.height = ta.scrollHeight + "px";
    }
  }, [editing]);

  const save = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed !== (value || "").trim()) {
      onSave(trimmed);
    }
  };

  if (editing) {
    return (
      <textarea
        ref={textareaRef}
        className={`w-full resize-none border-0 outline-none focus:outline-none rounded-md px-2 py-1 ${textSize}`}
        style={{ background: "#f5f6f8", color: "#1c1c1e", fontFamily: "DM Sans, sans-serif", boxShadow: "none" }}
        value={draft}
        onChange={e => {
          setDraft(e.target.value);
          e.target.style.height = "auto";
          e.target.style.height = e.target.scrollHeight + "px";
        }}
        onBlur={save}
        onKeyDown={e => {
          if (e.key === "Escape") { setEditing(false); setDraft(value || ""); }
          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); save(); }
        }}
        rows={1}
      />
    );
  }

  return (
    <div
      className={`cursor-text rounded-md px-2 py-1 transition-colors hover:bg-[#f5f6f8] ${textSize}`}
      style={{ fontFamily: "DM Sans, sans-serif" }}
      onClick={() => { setDraft(value || ""); setEditing(true); }}
    >
      {value ? (
        <span style={{ color: "#555a6a", whiteSpace: "pre-wrap" }}>{value}</span>
      ) : (
        <span style={{ color: "#c7cad5", fontStyle: "italic" }}>{placeholder}</span>
      )}
    </div>
  );
}
