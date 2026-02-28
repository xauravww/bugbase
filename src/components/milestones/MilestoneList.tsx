"use client";

import { MilestoneCard } from "./MilestoneCard";
import type { MilestoneWithDetails } from "@/types/milestone";

interface MilestoneListProps {
  milestones: MilestoneWithDetails[];
  onMilestoneClick: (milestone: MilestoneWithDetails) => void;
}

export function MilestoneList({ milestones, onMilestoneClick }: MilestoneListProps) {
  if (milestones.length === 0) {
    return (
      <div className="text-center py-12 text-[var(--color-text-secondary)]">
        <p>No milestones created yet</p>
        <p className="text-sm mt-1">Create your first milestone to track project progress</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {milestones.map((milestone) => (
        <MilestoneCard
          key={milestone.id}
          milestone={milestone}
          onClick={() => onMilestoneClick(milestone)}
        />
      ))}
    </div>
  );
}
