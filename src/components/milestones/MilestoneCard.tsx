"use client";

import { Flag, CheckCircle2, Circle, Clock } from "lucide-react";
import type { MilestoneWithDetails } from "@/types/milestone";

interface MilestoneCardProps {
  milestone: MilestoneWithDetails;
  onClick: () => void;
}

export function MilestoneCard({ milestone, onClick }: MilestoneCardProps) {
  const progress = milestone.totalCount > 0 
    ? Math.round((milestone.completedCount / milestone.totalCount) * 100) 
    : 0;

  const getStatusIcon = () => {
    switch (milestone.status) {
      case "Completed":
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case "In Progress":
        return <Clock className="w-5 h-5 text-amber-500" />;
      default:
        return <Circle className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusColor = () => {
    switch (milestone.status) {
      case "Completed":
        return "bg-green-50 text-green-700 border-green-200";
      case "In Progress":
        return "bg-amber-50 text-amber-700 border-amber-200";
      default:
        return "bg-gray-50 text-gray-600 border-gray-200";
    }
  };

  return (
    <div
      onClick={onClick}
      className="bg-white border border-[var(--color-border)] rounded-lg p-4 hover:border-[var(--color-accent)] cursor-pointer transition-colors"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Flag className="w-5 h-5 text-[var(--color-accent)]" />
          <h3 className="font-medium text-[var(--color-text-primary)]">
            {milestone.title}
          </h3>
        </div>
        <span className={`text-xs px-2 py-1 rounded-full border ${getStatusColor()}`}>
          {milestone.status}
        </span>
      </div>

      {milestone.description && (
        <p className="text-sm text-[var(--color-text-secondary)] mb-3 line-clamp-2">
          {milestone.description}
        </p>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-[var(--color-text-secondary)]">
            {milestone.completedCount} of {milestone.totalCount} completed
          </span>
          <span className="font-medium text-[var(--color-text-primary)]">
            {progress}%
          </span>
        </div>

        <div className="h-2 bg-[var(--color-surface)] rounded-full overflow-hidden">
          <div
            className="h-full bg-[var(--color-accent)] transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex items-center gap-1 text-xs text-[var(--color-text-secondary)]">
          {getStatusIcon()}
          <span>
            {milestone.status === "Completed" 
              ? "All tasks completed" 
              : milestone.status === "In Progress"
              ? "In progress"
              : "Not started yet"}
          </span>
        </div>
      </div>

      {milestone.creator && (
        <div className="mt-3 pt-3 border-t border-[var(--color-border)] text-xs text-[var(--color-text-secondary)]">
          Created by {milestone.creator.name}
        </div>
      )}
    </div>
  );
}
