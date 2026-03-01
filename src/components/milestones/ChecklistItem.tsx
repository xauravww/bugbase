"use client";

import { Square, CheckSquare, Sparkles } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

interface ChecklistItemProps {
  id: number;
  content: string;
  completed: boolean;
  notes?: string;
  onToggle: (id: number, completed: boolean) => void;
  onNotesChange: (id: number, notes: string) => void;
  disabled?: boolean;
}

export function ChecklistItem({
  id,
  content,
  completed,
  notes,
  onToggle,
  onNotesChange,
  disabled = false
}: ChecklistItemProps) {
  const { token } = useAuth();
  const [isRefining, setIsRefining] = useState(false);

  const toggleCompletion = () => {
    if (!disabled) {
      onToggle(id, !completed);
    }
  };

  const handleRefine = async () => {
    if (!notes) return;
    setIsRefining(true);
    try {
      const res = await fetch("/api/ai/refine", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content: notes, field: "checklist_notes" }),
      });

      if (res.ok) {
        const data = await res.json();
        onNotesChange(id, data.refinedContent);
      } else {
        const data = await res.json();
        alert(data.error || "Failed to refine notes");
      }
    } catch (error) {
      console.error("AI Refine Error:", error);
      alert("Failed to refine notes");
    } finally {
      setIsRefining(false);
    }
  };

  return (
    <div className="p-3 border border-[var(--color-border)] rounded-lg bg-white mb-2">
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={toggleCompletion}
          disabled={disabled}
          className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded border flex items-center justify-center ${completed
            ? "bg-[var(--color-accent)] border-[var(--color-accent)] text-white"
            : "border-[var(--color-border)] text-transparent hover:border-[var(--color-accent)]"
            } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
        >
          {completed && <CheckSquare className="w-3 h-3" />}
        </button>

        <div className="flex-grow min-w-0">
          <div className="text-sm font-medium text-[var(--color-text-primary)]">
            {content}
          </div>

          <div className="mt-2 relative">
            <Input
              id={`notes-${id}`}
              label="Notes"
              placeholder="Add notes about this task..."
              value={notes || ""}
              onChange={(e) => onNotesChange(id, e.target.value)}
              disabled={disabled}
              className="text-sm pr-10"
            />
            {notes && (
              <button
                type="button"
                onClick={handleRefine}
                disabled={disabled || isRefining}
                className="absolute right-2 top-9 p-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] disabled:opacity-50 touch-target z-10"
                title="AI Refine"
              >
                <Sparkles className={`w-4 h-4 ${isRefining ? "animate-pulse" : ""}`} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
