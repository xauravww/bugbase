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
    <div
      onClick={onClick}
      className="bg-white border border-[var(--color-border)] rounded-lg p-4 hover:border-[var(--color-accent)] cursor-pointer transition-all hover:shadow-sm group"
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <Flag className="w-4 h-4 text-[var(--color-accent)] shrink-0" />
          <h3 className="font-medium text-sm text-[var(--color-text-primary)] truncate group-hover:text-[var(--color-accent)] transition-colors">
            {milestone.title}
          </h3>
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded-full border shrink-0 ml-2 ${getStatusColor()}`}>
          {milestone.status}
        </span>
      </div>

      {milestone.description && (
        <p className="text-xs text-[var(--color-text-secondary)] mb-3 line-clamp-2">
          {milestone.description}
        </p>
      )}

      {/* Progress */}
      <div className="space-y-1.5">
        <div className="h-1.5 bg-[var(--color-surface)] rounded-full overflow-hidden">
          <div className={`h-full ${getProgressColor()} transition-all duration-500 rounded-full`}
            style={{ width: `${progress}%` }} />
        </div>
        <div className="flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
          <div className="flex items-center gap-1">
            {getStatusIcon()}
            <span>{milestone.completedCount}/{milestone.totalCount} tested</span>
          </div>
          <span className="font-medium text-[var(--color-text-primary)]">{progress}%</span>
        </div>
      </div>
    </div>
  );
}
