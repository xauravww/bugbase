export interface List {
  id: number;
  projectId: number;
  name: string;
  description: string | null;
  color: string;
  sortOrder: number;
  archived: boolean;
  createdBy: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Task {
  id: number;
  listId: number;
  title: string;
  description: string | null;
  status: "active" | "completed";
  priority: "none" | "low" | "medium" | "high";
  completedAt: Date | null;
  completedBy: number | null;
  sortOrder: number;
  dueDate: Date | null;
  createdBy: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Subtask {
  id: number;
  taskId: number;
  title: string;
  description: string | null;
  status: "active" | "completed";
  completedAt: Date | null;
  completedBy: number | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChecklistItem {
  id: number;
  subtaskId: number;
  content: string;
  done: boolean;
  sortOrder: number;
  createdAt: Date;
}

export interface TaskWithRelations extends Task {
  list?: List;
  subtasks?: SubtaskWithRelations[];
  creator?: { id: number; name: string };
  completedByUser?: { id: number; name: string } | null;
}

export interface SubtaskWithRelations extends Subtask {
  task?: Task;
  checklist?: ChecklistItem[];
  completedByUser?: { id: number; name: string } | null;
}

export interface ListWithRelations extends List {
  tasks?: TaskWithRelations[];
  creator?: { id: number; name: string };
}
