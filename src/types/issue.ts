import type { User } from "./user";
import type { Project } from "./project";
import type { IssueStatus, IssuePriority, IssueType } from "@/constants";

export interface Issue {
  id: number;
  projectId: number;
  title: string;
  type: IssueType;
  description: string | null;
  status: IssueStatus;
  priority: IssuePriority;
  reporterId: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IssueWithRelations extends Issue {
  project?: Project;
  reporter?: User;
  assignees?: User[];
  verifiers?: User[];
}

export interface CreateIssueInput {
  projectId: number;
  title: string;
  type: IssueType;
  description?: string;
  priority?: IssuePriority;
  assigneeIds?: number[];
  verifierIds?: number[];
}

export interface UpdateIssueInput {
  title?: string;
  type?: IssueType;
  description?: string;
  status?: IssueStatus;
  priority?: IssuePriority;
}

export interface Comment {
  id: number;
  issueId: number;
  userId: number;
  body: string;
  createdAt: Date;
  user?: User;
  attachments?: Attachment[];
}

export interface Attachment {
  id: number;
  issueId: number | null;
  commentId: number | null;
  url: string;
  imgbbDeleteHash: string | null;
  uploadedBy: number;
  createdAt: Date;
}

export interface Activity {
  id: number;
  issueId: number;
  userId: number;
  action: string;
  oldValue: string | null;
  newValue: string | null;
  createdAt: Date;
  user?: User;
}
