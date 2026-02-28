"use client";

import { Square, CheckSquare } from "lucide-react";
import { Button, Input } from "@/components/ui";

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
  const toggleCompletion = () => {
    if (!disabled) {
      onToggle(id, !completed);
    }
  };

  return (
    <div className="p-3 border border-[var(--color-border)] rounded-lg bg-white mb-2">
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={toggleCompletion}
          disabled={disabled}
          className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded border flex items-center justify-center ${
            completed
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
          
          <div className="mt-2">
            <Input
              id={`notes-${id}`}
              label="Notes"
              placeholder="Add notes about this task..."
              value={notes || ""}
              onChange={(e) => onNotesChange(id, e.target.value)}
              disabled={disabled}
              className="text-sm"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
