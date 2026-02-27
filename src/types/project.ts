import type { User } from "./user";

export interface Project {
  id: number;
  name: string;
  key: string;
  description: string | null;
  createdBy: number;
  archived: boolean;
  createdAt: Date;
}

export interface ProjectWithMembers extends Project {
  members: ProjectMember[];
  issueCount?: number;
  openIssueCount?: number;
}

export interface ProjectMember {
  id: number;
  projectId: number;
  userId: number;
  role: "admin" | "member";
  user?: User;
}

export interface CreateProjectInput {
  name: string;
  key: string;
  description?: string;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  archived?: boolean;
}
