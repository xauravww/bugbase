import type { User } from "./user";

export interface Milestone {
  id: number;
  projectId: number;
  title: string;
  description: string | null;
  status: "Not Started" | "In Progress" | "Completed";
  createdBy: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface MilestoneChecklistItem {
  id: number;
  milestoneId: number;
  content: string;
  order: number;
  createdAt: Date;
}

export interface MilestoneChecklistCompletion {
  id: number;
  checklistItemId: number;
  userId: number;
  notes: string | null;
  completedAt: Date;
  user?: User;
}

export interface MilestoneNote {
  id: number;
  milestoneId: number;
  userId: number;
  content: string;
  createdAt: Date;
  user?: User;
}

export interface MilestoneWithDetails extends Milestone {
  checklistItems: (MilestoneChecklistItem & {
    completion?: MilestoneChecklistCompletion | null;
  })[];
  notes: (MilestoneNote & { user: User })[];
  creator?: User;
  completedCount: number;
  totalCount: number;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface MilestonesResponse {
  milestones: MilestoneWithDetails[];
  pagination: Pagination;
}

export interface CreateMilestoneInput {
  title: string;
  description?: string;
  checklistItems: string[];
}

export interface UpdateMilestoneInput {
  title?: string;
  description?: string;
  status?: "Not Started" | "In Progress" | "Completed";
}

export interface CompleteChecklistItemInput {
  notes?: string;
}

export interface AddMilestoneNoteInput {
  content: string;
}
