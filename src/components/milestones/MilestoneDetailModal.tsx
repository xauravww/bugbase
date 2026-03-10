"use client";

import { useState, useEffect } from "react";
import { Button, Modal, Input } from "@/components/ui";
import { ChecklistItem } from "./ChecklistItem";
import { MilestoneWithDetails } from "@/types/milestone";
import { Flag, CheckCircle2, Clock, Circle, Sparkles, Plus, Trash2, Pencil } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface MilestoneDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  milestone: MilestoneWithDetails;
  onUpdate: (data: { title: string; description?: string; status: string; checklistItems?: { id?: number; content: string }[] }) => void;
  onToggleChecklistItem: (itemId: number, completed: boolean, notes: string) => void;
  onAddNote: (content: string) => void;
  canEdit: boolean;
  isUpdating?: boolean;
  isAddingNote?: boolean;
}

export function MilestoneDetailModal({
  isOpen,
  onClose,
  milestone,
  onUpdate,
  onToggleChecklistItem,
  onAddNote,
  canEdit,
  isUpdating = false,
  isAddingNote = false,
}: MilestoneDetailModalProps) {
  if (!milestone) return null;

  const [isEditing, setIsEditing] = useState(false);
  const [localMilestone, setLocalMilestone] = useState<{
    title: string;
    description: string;
    status: "Not Started" | "In Progress" | "Completed";
    checklistItems: { id?: number; content: string }[];
  }>({
    title: milestone.title,
    description: milestone.description || "",
    status: milestone.status as any,
    checklistItems: milestone.checklistItems.map(item => ({ id: item.id, content: item.content }))
  });
  const [newNote, setNewNote] = useState("");
  const [checklistStates, setChecklistStates] = useState<Record<number, { completed: boolean; notes: string }>>({});
  const [refiningField, setRefiningField] = useState<string | null>(null);
  const [showNotes, setShowNotes] = useState(false);
  const { token } = useAuth();

  useEffect(() => {
    if (milestone) {
      setLocalMilestone({
        title: milestone.title,
        description: milestone.description || "",
        status: milestone.status,
        checklistItems: milestone.checklistItems.map(item => ({ id: item.id, content: item.content }))
      });

      const initialStates: Record<number, { completed: boolean; notes: string }> = {};
      milestone.checklistItems.forEach(item => {
        initialStates[item.id] = {
          completed: !!item.completion,
          notes: item.completion?.notes || ""
        };
      });
      setChecklistStates(initialStates);
      setIsEditing(false);
    }
  }, [milestone]);

  const handleChecklistToggle = (itemId: number, completed: boolean) => {
    const notes = checklistStates[itemId]?.notes || "";
    onToggleChecklistItem(itemId, completed, notes);
    setChecklistStates(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], completed }
    }));
  };

  const handleNotesChange = (itemId: number, notes: string) => {
    setChecklistStates(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], notes }
    }));
  };

  const handleRefine = async (field: "title" | "description" | "newNote") => {
    const content = field === "newNote" ? newNote : localMilestone[field];
    if (!content) return;
    setRefiningField(field);
    try {
      const res = await fetch("/api/ai/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content, field: field === "newNote" ? "milestone_note" : `milestone_${field}` }),
      });
      if (res.ok) {
        const data = await res.json();
        if (field === "newNote") setNewNote(data.refinedContent);
        else setLocalMilestone(prev => ({ ...prev, [field]: data.refinedContent }));
      }
    } catch (error) {
      console.error("AI Refine Error:", error);
    } finally {
      setRefiningField(null);
    }
  };

  const handleAddTask = () => {
    setLocalMilestone(prev => ({
      ...prev,
      checklistItems: [...prev.checklistItems, { content: "" }]
    }));
  };

  const handleRemoveTask = (index: number) => {
    setLocalMilestone(prev => ({
      ...prev,
      checklistItems: prev.checklistItems.filter((_, i) => i !== index)
    }));
  };

  const handleTaskContentChange = (index: number, content: string) => {
    setLocalMilestone(prev => {
      const newItems = [...prev.checklistItems];
      newItems[index] = { ...newItems[index], content };
      return { ...prev, checklistItems: newItems };
    });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdate(localMilestone);
    setIsEditing(false);
  };

  const handleAddNoteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newNote.trim()) {
      onAddNote(newNote);
      setNewNote("");
    }
  };

  const progress = milestone.totalCount > 0
    ? Math.round((milestone.completedCount / milestone.totalCount) * 100)
    : 0;

  const getStatusIcon = () => {
    switch (milestone.status) {
      case "Completed": return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case "In Progress": return <Clock className="w-4 h-4 text-amber-500" />;
      default: return <Circle className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = () => {
    switch (milestone.status) {
      case "Completed": return "bg-green-50 text-green-700 border-green-200";
      case "In Progress": return "bg-amber-50 text-amber-700 border-amber-200";
      default: return "bg-gray-50 text-gray-600 border-gray-200";
    }
  };

  const getProgressColor = () => {
    if (progress === 100) return "bg-green-500";
    if (progress >= 50) return "bg-amber-500";
    return "bg-[var(--color-accent)]";
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="">
      <div className="space-y-5">
        {/* Header with progress ring */}
        <div className="flex items-start gap-4">
          {/* Mini progress ring */}
          <div className="relative w-14 h-14 shrink-0">
            <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
              <circle cx="28" cy="28" r="24" fill="none" stroke="var(--color-border)" strokeWidth="4" />
              <circle cx="28" cy="28" r="24" fill="none" stroke={progress === 100 ? "#22c55e" : progress >= 50 ? "#f59e0b" : "var(--color-accent)"}
                strokeWidth="4" strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 24}`}
                strokeDashoffset={`${2 * Math.PI * 24 * (1 - progress / 100)}`}
                className="transition-all duration-500"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-[var(--color-text-primary)]">
              {progress}%
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Flag className="w-4 h-4 text-[var(--color-accent)] shrink-0" />
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)] truncate">
                {milestone.title}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-0.5 rounded-full border ${getStatusColor()}`}>
                {milestone.status}
              </span>
              <span className="text-xs text-[var(--color-text-secondary)]">
                {milestone.completedCount} of {milestone.totalCount} tested
              </span>
            </div>
          </div>

          {canEdit && !isEditing && (
            <button onClick={() => setIsEditing(true)}
              className="p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] hover:bg-[var(--color-surface)] rounded-lg transition-colors shrink-0"
              title="Edit">
              <Pencil className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Description */}
        {milestone.description && !isEditing && (
          <p className="text-sm text-[var(--color-text-secondary)] bg-[var(--color-surface)] rounded-lg px-4 py-3">
            {milestone.description}
          </p>
        )}

        {/* Progress bar */}
        <div>
          <div className="h-2 bg-[var(--color-surface)] rounded-full overflow-hidden">
            <div className={`h-full ${getProgressColor()} transition-all duration-500 rounded-full`}
              style={{ width: `${progress}%` }} />
          </div>
        </div>

        {/* Edit Mode */}
        {isEditing && canEdit && (
          <form onSubmit={handleSave} className="space-y-4 bg-[var(--color-surface)] rounded-lg p-4">
            <div className="relative">
              <Input id="edit-title" label="Title" value={localMilestone.title}
                onChange={(e) => setLocalMilestone(prev => ({ ...prev, title: e.target.value }))} disabled={isUpdating} />
              {localMilestone.title && !isUpdating && (
                <button type="button" onClick={() => handleRefine("title")} disabled={refiningField === "title"}
                  className="absolute right-2 top-9 p-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] disabled:opacity-50 z-10" title="AI Refine">
                  <Sparkles className={`w-4 h-4 ${refiningField === "title" ? "animate-pulse" : ""}`} />
                </button>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-[var(--color-text-primary)]">Description</label>
                {localMilestone.description && !isUpdating && (
                  <button type="button" onClick={() => handleRefine("description")} disabled={refiningField === "description"}
                    className="flex items-center gap-1 text-xs text-[var(--color-accent)] hover:underline disabled:opacity-50">
                    <Sparkles className={`w-3 h-3 ${refiningField === "description" ? "animate-pulse" : ""}`} />
                    {refiningField === "description" ? "Refining..." : "AI Refine"}
                  </button>
                )}
              </div>
              <textarea className="w-full px-3 py-2 text-sm bg-white border border-[var(--color-border)] rounded-md focus:outline-none focus:border-[var(--color-accent)] resize-none"
                rows={2} value={localMilestone.description}
                onChange={(e) => setLocalMilestone(prev => ({ ...prev, description: e.target.value }))} disabled={isUpdating} />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">Status</label>
              <select className="w-full px-3 py-2 text-sm bg-white border border-[var(--color-border)] rounded-md focus:outline-none focus:border-[var(--color-accent)]"
                value={localMilestone.status} onChange={(e) => setLocalMilestone(prev => ({ ...prev, status: e.target.value as any }))} disabled={isUpdating}>
                <option value="Not Started">Not Started</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">Test Steps</label>
              <div className="space-y-2">
                {localMilestone.checklistItems.map((item, index) => (
                  <div key={index} className="flex gap-2">
                    <span className="flex items-center justify-center w-6 text-xs text-[var(--color-text-secondary)]">{index + 1}.</span>
                    <input type="text"
                      className="flex-grow px-3 py-2 text-sm bg-white border border-[var(--color-border)] rounded-md focus:outline-none focus:border-[var(--color-accent)]"
                      placeholder={`Test step ${index + 1}...`} value={item.content}
                      onChange={(e) => handleTaskContentChange(index, e.target.value)} disabled={isUpdating}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddTask(); } }}
                    />
                    <button type="button" onClick={() => handleRemoveTask(index)}
                      className="px-2 py-2 text-[var(--color-text-secondary)] hover:text-[var(--color-danger)] rounded-md transition-colors" disabled={isUpdating}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button type="button" onClick={handleAddTask}
                  className="w-full flex items-center justify-center gap-2 py-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] border border-dashed border-[var(--color-border)] rounded-md hover:border-[var(--color-accent)] transition-colors">
                  <Plus className="w-4 h-4" /> Add step
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setIsEditing(false)}>Cancel</Button>
              <Button type="submit" disabled={isUpdating}>
                {isUpdating ? "Saving..." : "Save"}
              </Button>
            </div>
          </form>
        )}

        {/* Checklist - the main event */}
        {!isEditing && (
          <div>
            <h4 className="text-sm font-medium text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[var(--color-accent)]" />
              What to Test
            </h4>
            <div className="space-y-1">
              {milestone.checklistItems.map((item) => (
                <ChecklistItem
                  key={item.id}
                  id={item.id}
                  content={item.content}
                  completed={!!item.completion}
                  notes={item.completion?.notes || checklistStates[item.id]?.notes || ""}
                  onToggle={handleChecklistToggle}
                  onNotesChange={handleNotesChange}
                  disabled={!canEdit && !!item.completion}
                />
              ))}
              {milestone.checklistItems.length === 0 && (
                <p className="text-sm text-[var(--color-text-secondary)] italic text-center py-6">
                  No test steps added yet. {canEdit ? "Click the edit button to add some." : ""}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Notes Toggle */}
        <div>
          <button onClick={() => setShowNotes(!showNotes)}
            className="text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] flex items-center gap-1 transition-colors">
            {showNotes ? "Hide" : "Show"} Notes
            {milestone.notes?.length > 0 && (
              <span className="text-xs bg-[var(--color-surface)] px-1.5 py-0.5 rounded-full">
                {milestone.notes.length}
              </span>
            )}
          </button>

          {showNotes && (
            <div className="mt-3 space-y-3">
              <form onSubmit={handleAddNoteSubmit}>
                <div className="flex gap-2">
                  <div className="flex-grow relative">
                    <input type="text"
                      className="w-full px-3 py-2 text-sm bg-white border border-[var(--color-border)] rounded-md focus:outline-none focus:border-[var(--color-accent)] pr-10"
                      placeholder="Add a note..." value={newNote} onChange={(e) => setNewNote(e.target.value)} disabled={isAddingNote} />
                    {newNote && !isAddingNote && (
                      <button type="button" onClick={() => handleRefine("newNote")} disabled={refiningField === "newNote"}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] disabled:opacity-50 z-10" title="AI Refine">
                        <Sparkles className={`w-4 h-4 ${refiningField === "newNote" ? "animate-pulse" : ""}`} />
                      </button>
                    )}
                  </div>
                  <Button type="submit" disabled={isAddingNote || !newNote.trim()}>
                    {isAddingNote ? "..." : "Add"}
                  </Button>
                </div>
              </form>

              {milestone.notes?.map((note) => (
                <div key={note.id} className="p-3 bg-[var(--color-surface)] rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-[var(--color-text-primary)]">{note.user?.name}</span>
                    <span className="text-xs text-[var(--color-text-secondary)]">{new Date(note.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="text-sm text-[var(--color-text-secondary)]">{note.content}</p>
                </div>
              ))}

              {(!milestone.notes || milestone.notes.length === 0) && (
                <p className="text-xs text-[var(--color-text-secondary)] italic">No notes yet.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
