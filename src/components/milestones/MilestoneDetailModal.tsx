"use client";

import { useState, useEffect } from "react";
import { Button, Modal, Input, Badge } from "@/components/ui";
import { ChecklistItem } from "./ChecklistItem";
import { MilestoneWithDetails } from "@/types/milestone";
import { Flag, CheckCircle2, Clock, Circle } from "lucide-react";

interface MilestoneDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  milestone: MilestoneWithDetails;
  onUpdate: (data: { title: string; description?: string; status: string }) => void;
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
  // Guard clause in case milestone is null despite conditional rendering
  if (!milestone) {
    return null;
  }
  
  const [localMilestone, setLocalMilestone] = useState({
    title: milestone.title,
    description: milestone.description || "",
    status: milestone.status,
  });
  const [newNote, setNewNote] = useState("");
  const [checklistStates, setChecklistStates] = useState<Record<number, { completed: boolean; notes: string }>>({});

  useEffect(() => {
    if (milestone) {
      setLocalMilestone({
        title: milestone.title,
        description: milestone.description || "",
        status: milestone.status,
      });
      
      // Initialize checklist states
      const initialStates: Record<number, { completed: boolean; notes: string }> = {};
      milestone.checklistItems.forEach(item => {
        initialStates[item.id] = {
          completed: !!item.completion,
          notes: item.completion?.notes || ""
        };
      });
      setChecklistStates(initialStates);
    }
  }, [milestone]);

  const handleChecklistToggle = (itemId: number, completed: boolean) => {
    const item = milestone.checklistItems.find(i => i.id === itemId);
    if (!item) return;
    
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

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdate(localMilestone);
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
    switch (localMilestone.status) {
      case "Completed":
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case "In Progress":
        return <Clock className="w-5 h-5 text-amber-500" />;
      default:
        return <Circle className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusColor = () => {
    switch (localMilestone.status) {
      case "Completed":
        return "bg-green-50 text-green-700 border-green-200";
      case "In Progress":
        return "bg-amber-50 text-amber-700 border-amber-200";
      default:
        return "bg-gray-50 text-gray-600 border-gray-200";
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={milestone.title}>
      <div className="space-y-6">
        {/* Milestone Info */}
        <div className="bg-[var(--color-surface)] rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Flag className="w-5 h-5 text-[var(--color-accent)]" />
            <h3 className="font-medium text-[var(--color-text-primary)]">
              {localMilestone.title}
            </h3>
          </div>
          
          <div className="flex items-center gap-2 mb-3">
            <span className={`text-xs px-2 py-1 rounded-full border ${getStatusColor()}`}>
              {localMilestone.status}
            </span>
          </div>

          <div className="mb-4">
            <p className="text-sm text-[var(--color-text-secondary)]">
              {milestone.description || "No description provided."}
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--color-text-secondary)]">
                {milestone.completedCount} of {milestone.totalCount} completed
              </span>
              <span className="font-medium text-[var(--color-text-primary)]">
                {progress}%
              </span>
            </div>

            <div className="h-2 bg-white rounded-full overflow-hidden">
              <div
                className="h-full bg-[var(--color-accent)] transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="flex items-center gap-1 text-xs text-[var(--color-text-secondary)]">
              {getStatusIcon()}
              <span>
                {localMilestone.status === "Completed" 
                  ? "All tasks completed" 
                  : localMilestone.status === "In Progress"
                  ? "In progress"
                  : "Not started yet"}
              </span>
            </div>
          </div>
        </div>

        {/* Edit Form */}
        {canEdit && (
          <form onSubmit={handleSave} className="space-y-4">
            <Input
              id="title"
              label="Title"
              placeholder="Milestone title"
              value={localMilestone.title}
              onChange={(e) => setLocalMilestone(prev => ({ ...prev, title: e.target.value }))}
              disabled={!canEdit || isUpdating}
            />

            <div>
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
                Description
              </label>
              <textarea
                className="w-full px-3 py-2 text-sm bg-white border border-[var(--color-border)] rounded-md focus:outline-none focus:border-[var(--color-accent)] resize-none"
                placeholder="Describe the milestone..."
                rows={3}
                value={localMilestone.description}
                onChange={(e) => setLocalMilestone(prev => ({ ...prev, description: e.target.value }))}
                disabled={!canEdit || isUpdating}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
                Status
              </label>
              <select
                className="w-full px-3 py-2 text-sm bg-white border border-[var(--color-border)] rounded-md focus:outline-none focus:border-[var(--color-accent)]"
                value={localMilestone.status}
                onChange={(e) => setLocalMilestone(prev => ({ ...prev, status: e.target.value as any }))}
                disabled={!canEdit || isUpdating}
              >
                <option value="Not Started">Not Started</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
              </select>
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={isUpdating}>
                {isUpdating ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        )}

        {/* Checklist */}
        <div>
          <h4 className="font-medium text-[var(--color-text-primary)] mb-3">Checklist</h4>
          <div className="space-y-2">
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
          </div>
        </div>

        {/* Notes Section */}
        <div>
          <h4 className="font-medium text-[var(--color-text-primary)] mb-3">Notes</h4>
          
          <form onSubmit={handleAddNoteSubmit} className="mb-4">
            <div className="flex gap-2">
              <input
                type="text"
                className="flex-grow px-3 py-2 text-sm bg-white border border-[var(--color-border)] rounded-md focus:outline-none focus:border-[var(--color-accent)]"
                placeholder="Add a note..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                disabled={isAddingNote}
              />
              <Button type="submit" disabled={isAddingNote}>
                {isAddingNote ? "Adding..." : "Add"}
              </Button>
            </div>
          </form>

          <div className="space-y-3">
            {milestone.notes?.map((note) => (
              <div key={note.id} className="p-3 bg-white border border-[var(--color-border)] rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-[var(--color-text-primary)]">
                    {note.user?.name}
                  </span>
                  <span className="text-xs text-[var(--color-text-secondary)]">
                    {new Date(note.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="text-sm text-[var(--color-text-secondary)]">{note.content}</p>
              </div>
            ))}
            
            {(!milestone.notes || milestone.notes.length === 0) && (
              <p className="text-sm text-[var(--color-text-secondary)] italic">No notes yet.</p>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
