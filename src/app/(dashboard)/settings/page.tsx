"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { marked } from "marked";
import { Search, ChevronLeft, ChevronRight, Activity, Mail, Pencil, Save, X, ToggleLeft, ToggleRight, Eye, Plus, Bold, Italic, List, ListOrdered, Link as LinkIcon, Heading2, Code, Plug } from "lucide-react";
import { Header } from "@/components/layout";
import { Button, Input, Select, PageLoader, Avatar, Badge } from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";

interface ActivityLog {
  id: number;
  action: string;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
  user: { id: number; name: string; email: string };
  issue: { id: number; title: string; project: { id: number; name: string } } | null;
}

interface EmailTemplate {
  id: number;
  event: string;
  subject: string;
  body: string;
  enabled: boolean;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const EMAIL_EVENTS: Record<string, string> = {
  issue_created: "Issue Created",
  issue_assigned: "Issue Assigned",
  issue_status_changed: "Status Changed",
  issue_verified: "Issue Verified",
  issue_commented: "New Comment",
};

const PLACEHOLDERS = [
  { key: "issue_title", label: "Issue Title" },
  { key: "issue_description", label: "Issue Description" },
  { key: "issue_id", label: "Issue ID" },
  { key: "issue_type", label: "Issue Type" },
  { key: "issue_status", label: "Issue Status" },
  { key: "issue_priority", label: "Issue Priority" },
  { key: "issue_url", label: "Issue URL" },
  { key: "project_name", label: "Project Name" },
  { key: "reporter_name", label: "Reporter Name" },
  { key: "assignee_name", label: "Assignee Name" },
  { key: "old_status", label: "Old Status" },
  { key: "new_status", label: "New Status" },
  { key: "comment_body", label: "Comment Body" },
  { key: "created_at", label: "Created Date" },
  { key: "created_at_time", label: "Created Time" },
];

function RichTextEditor({ 
  value, 
  onChange,
  label = "Body"
}: { 
  value: string; 
  onChange: (value: string) => void;
  label?: string;
}) {
  const [showPlaceholders, setShowPlaceholders] = useState(false);

  const insertText = (before: string, after: string = "") => {
    const textarea = document.getElementById("template-body") as HTMLTextAreaElement;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    const newText = value.substring(0, start) + before + selectedText + after + value.substring(end);
    onChange(newText);
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, start + before.length + selectedText.length);
    }, 0);
  };

  const insertPlaceholder = (key: string) => {
    insertText(`{{${key}}}`);
    setShowPlaceholders(false);
  };

  const tools = [
    { icon: Bold, action: () => insertText("**", "**"), title: "Bold" },
    { icon: Italic, action: () => insertText("*", "*"), title: "Italic" },
    { icon: Heading2, action: () => insertText("## "), title: "Heading" },
    { icon: List, action: () => insertText("- "), title: "Bullet List" },
    { icon: ListOrdered, action: () => insertText("1. "), title: "Numbered List" },
    { icon: LinkIcon, action: () => insertText("[", "](url)"), title: "Link" },
    { icon: Code, action: () => insertText("`", "`"), title: "Code" },
  ];

  return (
    <div>
      <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">{label}</label>
      <div className="border border-[var(--color-border)] rounded-md overflow-hidden">
        <div className="flex items-center gap-1 p-2 bg-gray-50 border-b border-[var(--color-border)] flex-wrap">
          {tools.map((tool, idx) => (
            <button
              key={idx}
              type="button"
              onClick={tool.action}
              title={tool.title}
              className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded transition-colors"
            >
              <tool.icon className="w-4 h-4" />
            </button>
          ))}
          <div className="relative ml-auto">
            <button
              type="button"
              onClick={() => setShowPlaceholders(!showPlaceholders)}
              className="px-2 py-1 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded transition-colors flex items-center gap-1"
            >
              {"{{ }}"} Placeholders
            </button>
            {showPlaceholders && (
              <div className="absolute right-0 top-full mt-1 w-64 bg-white border border-[var(--color-border)] rounded-md shadow-lg z-10 max-h-60 overflow-y-auto">
                {PLACEHOLDERS.map((ph) => (
                  <button
                    key={ph.key}
                    type="button"
                    onClick={() => insertPlaceholder(ph.key)}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center justify-between"
                  >
                    <span className="text-[var(--color-text-primary)]">{ph.label}</span>
                    <code className="text-xs text-[var(--color-accent)] bg-gray-100 px-1 rounded">{"{{" + ph.key + "}}"}</code>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <textarea
          id="template-body"
          className="w-full px-3 py-2 text-sm bg-white focus:outline-none resize-none font-mono"
          rows={10}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Write your email content here... Use the toolbar for formatting and click 'Placeholders' to insert dynamic variables."
        />
      </div>
      <p className="text-xs text-[var(--color-text-secondary)] mt-1">
        Tip: Use the toolbar above for formatting. Variables like {"{{issue_title}}"} will be replaced with actual values when the email is sent.
      </p>
    </div>
  );
}

function parseMarkdown(md: string): string {
  const rawHtml = marked.parse(md, { async: false }) as string;
  
  const styledHtml = rawHtml
    .replace(/<h1>/g, '<h1 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 700; color: #1f2937;">')
    .replace(/<h2>/g, '<h2 style="margin: 0 0 14px 0; font-size: 20px; font-weight: 600; color: #1f2937;">')
    .replace(/<h3>/g, '<h3 style="margin: 0 0 12px 0; font-size: 18px; font-weight: 600; color: #1f2937;">')
    .replace(/<h4>/g, '<h4 style="margin: 0 0 10px 0; font-size: 16px; font-weight: 600; color: #1f2937;">')
    .replace(/<p>/g, '<p style="margin: 0 0 12px 0; line-height: 1.6; color: #1f2937;">')
    .replace(/<strong>/g, '<strong style="font-weight: 600;">')
    .replace(/<a /g, '<a style="color: #4f46e5; text-decoration: underline;" ')
    .replace(/<code>/g, '<code style="background-color: #f3f4f6; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 13px;">')
    .replace(/<ul>/g, '<ul style="margin: 0 0 12px 0; padding-left: 24px;">')
    .replace(/<ol>/g, '<ol style="margin: 0 0 12px 0; padding-left: 24px;">')
    .replace(/<li>/g, '<li style="margin-bottom: 6px;">')
    .replace(/<blockquote>/g, '<blockquote style="border-left: 4px solid #e5e7eb; margin: 0 0 12px 0; padding-left: 16px; color: #6b7280;">')
    .replace(/<hr>/g, '<hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;">')
    .replace(/<table>/g, '<table style="border-collapse: collapse; width: 100%; margin: 12px 0;">')
    .replace(/<th>/g, '<th style="border: 1px solid #e5e7eb; padding: 8px 12px; background-color: #f9fafb; text-align: left; font-weight: 600;">')
    .replace(/<td>/g, '<td style="border: 1px solid #e5e7eb; padding: 8px 12px;">')
    .replace(/<tr>/g, '<tr>');
  
  return styledHtml;
}

export default function SettingsPage() {
  const router = useRouter();
  const { user, token } = useAuth();
  const [activeTab, setActiveTab] = useState<"profile" | "logs" | "emails" | "mcp">("profile");
  
  // Profile state
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Logs state
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [logsPagination, setLogsPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsSearch, setLogsSearch] = useState("");
  const [logsAction, setLogsAction] = useState("");
  const [logsDateFrom, setLogsDateFrom] = useState("");
  const [logsDateTo, setLogsDateTo] = useState("");
  const [logsAutoRefresh, setLogsAutoRefresh] = useState(false);

  // Email templates state
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTemplate, setNewTemplate] = useState({ event: "", subject: "", body: "" });

  const fetchLogs = useCallback(async (page: number = 1) => {
    setLogsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", "20");
      if (logsSearch) params.set("search", logsSearch);
      if (logsAction) params.set("action", logsAction);
      if (logsDateFrom) params.set("dateFrom", logsDateFrom);
      if (logsDateTo) params.set("dateTo", logsDateTo);
      
      const res = await fetch(`/api/settings/activity-logs?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
        setLogsPagination(data.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 });
      }
    } catch (error) {
      console.error("Failed to fetch logs:", error);
    } finally {
      setLogsLoading(false);
    }
  }, [token, logsSearch, logsAction, logsDateFrom, logsDateTo]);

  const fetchTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    try {
      const res = await fetch("/api/settings/email-templates", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates || []);
      }
    } catch (error) {
      console.error("Failed to fetch templates:", error);
    } finally {
      setTemplatesLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (user?.role === "Admin" && activeTab === "logs") {
      fetchLogs(logsPagination.page);
    }
  }, [user?.role, activeTab]);

  useEffect(() => {
    if (user?.role === "Admin" && activeTab === "emails") {
      fetchTemplates();
    }
  }, [user?.role, activeTab]);

  useEffect(() => {
    if (!logsAutoRefresh || activeTab !== "logs") return;
    const interval = setInterval(() => fetchLogs(1), 30000);
    return () => clearInterval(interval);
  }, [logsAutoRefresh, activeTab, fetchLogs]);

  const clearLogsFilters = () => {
    setLogsSearch("");
    setLogsAction("");
    setLogsDateFrom("");
    setLogsDateTo("");
    setLogsPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setIsUpdating(true);
    setTimeout(() => {
      setMessage({ type: "success", text: "Profile updated successfully" });
      setIsUpdating(false);
    }, 1000);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (newPassword !== confirmPassword) {
      setMessage({ type: "error", text: "Passwords do not match" });
      return;
    }
    if (newPassword.length < 6) {
      setMessage({ type: "error", text: "Password must be at least 6 characters" });
      return;
    }
    setIsUpdating(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({ type: "success", text: "Password changed successfully" });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        setMessage({
          type: "error",
          text: data.error || "Failed to change password",
        });
      }
    } catch (error) {
      console.error("Change password error:", error);
      setMessage({ type: "error", text: "An error occurred while changing password" });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!editingTemplate) return;
    
    try {
      const res = await fetch("/api/settings/email-templates", {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify(editingTemplate),
      });

      if (res.ok) {
        setTemplates(templates.map(t => t.event === editingTemplate.event ? editingTemplate : t));
        setEditingTemplate(null);
        setMessage({ type: "success", text: "Template saved successfully" });
      }
    } catch (error) {
      console.error("Failed to save template:", error);
      setMessage({ type: "error", text: "Failed to save template" });
    }
  };

  const handleCreateTemplate = async () => {
    if (!newTemplate.event || !newTemplate.subject || !newTemplate.body) {
      setMessage({ type: "error", text: "All fields are required" });
      return;
    }

    try {
      const res = await fetch("/api/settings/email-templates", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ ...newTemplate, enabled: true }),
      });

      if (res.ok) {
        const data = await res.json();
        setTemplates([...templates, data.template]);
        setShowAddModal(false);
        setNewTemplate({ event: "", subject: "", body: "" });
        setMessage({ type: "success", text: "Template created successfully" });
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error || "Failed to create template" });
      }
    } catch (error) {
      console.error("Failed to create template:", error);
      setMessage({ type: "error", text: "Failed to create template" });
    }
  };

  if (!user) return <PageLoader />;

  return (
    <div className="w-full">
      <Header title="Settings" />

      <div className="p-4 max-w-5xl mx-auto w-full">
        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6 border-b border-[var(--color-border)]">
          <button
            onClick={() => setActiveTab("profile")}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px touch-target ${
              activeTab === "profile"
                ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            }`}
          >
            Profile
          </button>
          <button
            onClick={() => setActiveTab("mcp")}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px flex items-center gap-2 touch-target ${
              activeTab === "mcp"
                ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            }`}
          >
            <Plug className="w-4 h-4" />
            MCP Server
          </button>
          {user.role === "Admin" && (
            <>
              <button
                onClick={() => setActiveTab("logs")}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px flex items-center gap-2 touch-target ${
                  activeTab === "logs"
                    ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                    : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                }`}
              >
                <Activity className="w-4 h-4" />
                Activity Logs
              </button>
              <button
                onClick={() => setActiveTab("emails")}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px flex items-center gap-2 touch-target ${
                  activeTab === "emails"
                    ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                    : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                }`}
              >
                <Mail className="w-4 h-4" />
                Email Templates
              </button>
            </>
          )}
        </div>

        {message && (
          <div className={`mb-6 p-3 text-sm rounded-md border ${
            message.type === "success"
              ? "text-[var(--color-success)] bg-green-50 border-green-100"
              : "text-[var(--color-danger)] bg-red-50 border-red-100"
          }`}>
            {message.text}
          </div>
        )}

        {/* Profile Tab */}
        {activeTab === "profile" && (
          <div className="max-w-full">
            <section className="mb-8">
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">Profile</h2>
              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <Input id="name" label="Full Name" value={name} onChange={(e) => setName(e.target.value)} required />
                <Input id="email" label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                <div className="text-sm text-[var(--color-text-secondary)]">
                  Role: <span className="font-medium text-[var(--color-text-primary)]">{user.role}</span>
                </div>
                <Button type="submit" disabled={isUpdating} className="w-full sm:w-auto">Update Profile</Button>
              </form>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">Change Password</h2>
              <form onSubmit={handleChangePassword} className="space-y-4">
                <Input id="currentPassword" label="Current Password" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
                <Input id="newPassword" label="New Password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
                <Input id="confirmPassword" label="Confirm New Password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
                <Button type="submit" disabled={isUpdating} className="w-full sm:w-auto">Change Password</Button>
              </form>
            </section>
          </div>
        )}

        {/* MCP Server Tab */}
        {activeTab === "mcp" && <McpSettings />}

        {/* Activity Logs Tab */}
        {activeTab === "logs" && user.role === "Admin" && (
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-2">
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Activity Logs</h2>
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <span className="text-xs text-[var(--color-text-secondary)]">Auto-refresh</span>
                <button
                  onClick={() => setLogsAutoRefresh(!logsAutoRefresh)}
                  className={`p-1 rounded transition-colors touch-target ${logsAutoRefresh ? "text-green-600" : "text-gray-400"}`}
                >
                  {logsAutoRefresh ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
                </button>
              </div>
            </div>

            <div className="bg-[var(--color-surface)] rounded-lg p-4 mb-4 space-y-3">
              <div className="flex flex-col sm:flex-row flex-wrap gap-3">
                <div className="flex-1 min-w-[200px] w-full sm:w-auto">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)]" />
                    <input
                      type="text"
                      placeholder="Search by action or user..."
                      value={logsSearch}
                      onChange={(e) => { setLogsSearch(e.target.value); setLogsPagination(p => ({ ...p, page: 1 })); }}
                      onKeyDown={(e) => e.key === "Enter" && fetchLogs(1)}
                      className="w-full pl-10 pr-4 py-2 text-sm bg-white border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                    />
                  </div>
                </div>
                <select
                  value={logsAction}
                  onChange={(e) => { setLogsAction(e.target.value); setLogsPagination(p => ({ ...p, page: 1 })); }}
                  className="px-3 py-2 text-sm bg-white border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] min-w-[150px]"
                >
                  <option value="">All Actions</option>
                  <option value="created">Created</option>
                  <option value="updated">Updated</option>
                  <option value="deleted">Deleted</option>
                  <option value="assigned">Assigned</option>
                </select>
                <input
                  type="date"
                  value={logsDateFrom}
                  onChange={(e) => { setLogsDateFrom(e.target.value); setLogsPagination(p => ({ ...p, page: 1 })); }}
                  className="px-3 py-2 text-sm bg-white border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                />
                <input
                  type="date"
                  value={logsDateTo}
                  onChange={(e) => { setLogsDateTo(e.target.value); setLogsPagination(p => ({ ...p, page: 1 })); }}
                  className="px-3 py-2 text-sm bg-white border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                />
                <Button variant="secondary" size="sm" onClick={() => { clearLogsFilters(); fetchLogs(1); }} className="w-full sm:w-auto">
                  Clear
                </Button>
                <Button size="sm" onClick={() => fetchLogs(1)} className="w-full sm:w-auto">
                  <Search className="w-4 h-4 mr-1" /> Search
                </Button>
              </div>
            </div>
            
            {logsLoading ? (
              <PageLoader />
            ) : logs.length === 0 ? (
              <div className="text-center py-12 text-[var(--color-text-secondary)]">No activity logs found</div>
            ) : (
              <>
                <div className="space-y-2">
                  {logs.map((log) => (
                    <div key={log.id} className="bg-white border border-[var(--color-border)] rounded-lg p-4 hover:shadow-sm transition-shadow">
                      <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
                        <Avatar name={log.user.name} size="md" />
                        <div className="flex-1 min-w-0 w-full">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-semibold text-sm text-[var(--color-text-primary)]">{log.user.name}</span>
                            <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded ${
                              log.action === "created" ? "bg-green-100 text-green-800" :
                              log.action === "deleted" ? "bg-red-100 text-red-800" :
                              log.action === "assigned" ? "bg-blue-100 text-blue-800" :
                              "bg-[var(--color-tag-bg)] text-[var(--color-text-primary)]"
                            }`}>{log.action}</span>
                            {log.oldValue && log.newValue && (
                              <>
                                <span className="text-xs text-[var(--color-text-secondary)]">{log.oldValue}</span>
                                <span className="text-[var(--color-accent)]">→</span>
                                <span className="text-xs text-[var(--color-text-secondary)]">{log.newValue}</span>
                              </>
                            )}
                          </div>
                          {log.issue && (
                            <Link href={`/issues/${log.issue.id}`} className="text-sm text-[var(--color-accent)] hover:underline block">
                              {log.issue.project.name} - {log.issue.title}
                            </Link>
                          )}
                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            <span className="text-xs text-[var(--color-text-secondary)] bg-[var(--color-surface)] px-2 py-1 rounded">
                              {new Date(log.createdAt).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {logsPagination.totalPages > 1 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between mt-6 pt-4 border-t border-[var(--color-border)] gap-4">
                    <span className="text-sm text-[var(--color-text-secondary)] text-center sm:text-left">
                      Showing {((logsPagination.page - 1) * logsPagination.limit) + 1} to {Math.min(logsPagination.page * logsPagination.limit, logsPagination.total)} of {logsPagination.total} logs
                    </span>
                    <div className="flex items-center gap-2">
                      <button onClick={() => fetchLogs(logsPagination.page - 1)} disabled={logsPagination.page === 1}
                        className="p-2 rounded border border-[var(--color-border)] hover:bg-[var(--color-surface)] disabled:opacity-50 touch-target">
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="text-sm text-[var(--color-text-secondary)] px-3">
                        Page {logsPagination.page} of {logsPagination.totalPages}
                      </span>
                      <button onClick={() => fetchLogs(logsPagination.page + 1)} disabled={logsPagination.page >= logsPagination.totalPages}
                        className="p-2 rounded border border-[var(--color-border)] hover:bg-[var(--color-surface)] disabled:opacity-50 touch-target">
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Email Templates Tab */}
        {activeTab === "emails" && user.role === "Admin" && (
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-4">
              <div>
                <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Email Templates</h2>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                  Configure email notifications for various events. Use {"{{variable}}"} for dynamic content.
                </p>
              </div>
              <Button size="sm" onClick={() => setShowAddModal(true)} className="w-full sm:w-auto">
                <Plus className="w-4 h-4 mr-1" /> Add Custom Template
              </Button>
            </div>

            {templatesLoading ? (
              <PageLoader />
            ) : (
              <div className="space-y-4">
                {templates.map((template) => (
                  <div key={template.id} className="bg-white border border-[var(--color-border)] rounded-lg p-4">
                    {editingTemplate?.event === template.event ? (
                      <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <h3 className="font-medium">{EMAIL_EVENTS[template.event] || template.event}</h3>
                          <div className="flex gap-2">
                            <button onClick={handleSaveTemplate} className="p-1.5 text-[var(--color-success)] hover:bg-green-50 rounded touch-target">
                              <Save className="w-4 h-4" />
                            </button>
                            <button onClick={() => setEditingTemplate(null)} className="p-1.5 text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)] rounded touch-target">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <Input
                          label="Subject"
                          value={editingTemplate.subject}
                          onChange={(e) => setEditingTemplate({ ...editingTemplate, subject: e.target.value })}
                        />
                        <RichTextEditor
                          value={editingTemplate.body}
                          onChange={(body) => setEditingTemplate({ ...editingTemplate, body })}
                          label="Body"
                        />
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id={`enabled-${template.event}`}
                            checked={editingTemplate.enabled}
                            onChange={(e) => setEditingTemplate({ ...editingTemplate, enabled: e.target.checked })}
                            className="rounded"
                          />
                          <label htmlFor={`enabled-${template.event}`} className="text-sm text-[var(--color-text-primary)]">Enable this notification</label>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2 gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-medium">{EMAIL_EVENTS[template.event] || template.event}</h3>
                            {template.enabled ? (
                              <Badge variant="neutral" className="bg-green-50 text-green-700">Enabled</Badge>
                            ) : (
                              <Badge variant="neutral" className="bg-gray-50 text-gray-500">Disabled</Badge>
                            )}
                          </div>
                          <div className="flex gap-1">
                            <button
                              onClick={() => setPreviewTemplate(template)}
                              className="p-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] hover:bg-[var(--color-surface)] rounded touch-target"
                              title="Preview"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setEditingTemplate(template)}
                              className="p-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] hover:bg-[var(--color-surface)] rounded touch-target"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <div className="text-sm text-[var(--color-text-secondary)]">
                          <div className="mb-1"><strong>Subject:</strong> {template.subject}</div>
                          <div className="bg-[var(--color-surface)] rounded p-2 text-xs font-mono whitespace-pre-wrap line-clamp-3">
                            {template.body}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Preview Modal */}
        {previewTemplate && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 border-b border-[var(--color-border)] gap-2">
                <div>
                  <h3 className="font-semibold text-[var(--color-text-primary)]">Email Preview</h3>
                  <p className="text-sm text-[var(--color-text-secondary)]">{EMAIL_EVENTS[previewTemplate.event] || previewTemplate.event}</p>
                </div>
                <button
                  onClick={() => setPreviewTemplate(null)}
                  className="p-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface)] rounded touch-target self-start sm:self-auto"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4 overflow-y-auto flex-grow">
                {(() => {
                  const sampleData = {
                    issue_title: "Login page not loading",
                    issue_description: "The login page shows a blank screen on mobile devices.",
                    issue_id: "123",
                    issue_type: "Bug",
                    issue_status: "Open",
                    issue_priority: "High",
                    issue_url: "https://bugbase.app/issues/123",
                    project_name: "My Project",
                    reporter_name: "John Doe",
                    assignee_name: "Jane Smith",
                    action: "created",
                    old_status: "",
                    new_status: "Open",
                    comment_body: "This is a sample comment for the issue.",
                    created_at: new Date().toLocaleDateString(),
                    created_at_time: new Date().toLocaleString(),
                  };

                  let renderedBody = previewTemplate.body;
                  let renderedSubject = previewTemplate.subject;

                  Object.entries(sampleData).forEach(([key, value]) => {
                    const regex = new RegExp(`{{${key}}}`, 'g');
                    renderedBody = renderedBody.replace(regex, value || '');
                    renderedSubject = renderedSubject.replace(regex, value || '');
                  });

                  renderedBody = renderedBody.replace(/\\n/g, '\n').trim();

                  const renderedHtml = parseMarkdown(renderedBody);

                  const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color: #4f46e5; padding: 20px 30px;">
              <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 600;">BugBase</h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 30px;">
              <div style="color: #1f2937; font-size: 14px; line-height: 1.6;">
                ${renderedHtml}
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 20px 30px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #6b7280; font-size: 12px; text-align: center;">
                You received this email because you're subscribed to issue notifications in BugBase.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

                  return (
                    <>
                      <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                        <div className="text-xs text-gray-500 mb-1">Subject:</div>
                        <div className="font-medium text-gray-900">{renderedSubject}</div>
                      </div>
                      <div className="border border-gray-300 rounded-lg overflow-hidden">
                        <iframe
                          srcDoc={emailHtml}
                          title="Email Preview"
                          style={{ width: '100%', height: '400px', border: 'none' }}
                        />
                      </div>
                        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="text-xs text-blue-700 font-medium mb-2">Available Variables:</div>
                        <div className="text-xs text-blue-600 space-y-1">
                          <div><code>{"{{issue_title}}"}</code> - Issue title</div>
                          <div><code>{"{{issue_description}}"}</code> - Issue description</div>
                          <div><code>{"{{issue_id}}"}</code> - Issue ID</div>
                          <div><code>{"{{issue_type}}"}</code> - Issue type (Bug/Feature)</div>
                          <div><code>{"{{issue_status}}"}</code> - Issue status</div>
                          <div><code>{"{{issue_priority}}"}</code> - Issue priority</div>
                          <div><code>{"{{issue_url}}"}</code> - Issue URL</div>
                          <div><code>{"{{project_name}}"}</code> - Project name</div>
                          <div><code>{"{{reporter_name}}"}</code> - Reporter name</div>
                          <div><code>{"{{assignee_name}}"}</code> - Assignee name</div>
                          <div><code>{"{{old_status}}"}</code> - Previous status</div>
                          <div><code>{"{{new_status}}"}</code> - New status</div>
                          <div><code>{"{{comment_body}}"}</code> - Comment content</div>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* Add Custom Template Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-lg w-full flex flex-col">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 border-b border-[var(--color-border)] gap-2">
                <h3 className="font-semibold text-[var(--color-text-primary)]">Add Custom Template</h3>
                <button
                  onClick={() => { setShowAddModal(false); setNewTemplate({ event: "", subject: "", body: "" }); }}
                  className="p-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface)] rounded touch-target self-start sm:self-auto"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4 space-y-4 flex-grow overflow-y-auto">
                <Input
                  label="Event Name"
                  placeholder="e.g., custom_notification"
                  value={newTemplate.event}
                  onChange={(e) => setNewTemplate({ ...newTemplate, event: e.target.value })}
                />
                <Input
                  label="Subject"
                  placeholder="Email subject line"
                  value={newTemplate.subject}
                  onChange={(e) => setNewTemplate({ ...newTemplate, subject: e.target.value })}
                />
                <RichTextEditor
                  value={newTemplate.body}
                  onChange={(body) => setNewTemplate({ ...newTemplate, body })}
                  label="Body"
                />
                <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2">
                  <Button variant="secondary" onClick={() => { setShowAddModal(false); setNewTemplate({ event: "", subject: "", body: "" }); }} className="w-full sm:w-auto">
                    Cancel
                  </Button>
                  <Button onClick={handleCreateTemplate} className="w-full sm:w-auto">
                    Create Template
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────── MCP Server settings ───────────────────────────

function CopyBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };
  return (
    <div className="relative group">
      <pre className="text-xs sm:text-[13px] leading-relaxed overflow-x-auto rounded-lg p-3 pr-12 bg-[var(--color-bg-subtle)] border border-[var(--color-border)] text-[var(--color-text-primary)]">
        <code>{text}</code>
      </pre>
      <button
        onClick={copy}
        className="absolute top-2 right-2 px-2 py-1 text-[11px] rounded border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

function McpSettings() {
  const { token } = useAuth();
  const [origin, setOrigin] = useState("http://localhost:3000");
  const [tokens, setTokens] = useState<Array<{ id: number; name: string; prefix: string; lastUsedAt: string | null; createdAt: string }>>([]);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [freshToken, setFreshToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/mcp/tokens", { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setTokens((await res.json()).tokens || []);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { if (token) load(); }, [token, load]);

  const createToken = async () => {
    setCreating(true);
    setFreshToken(null);
    try {
      const res = await fetch("/api/mcp/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: newName }),
      });
      if (res.ok) {
        const d = await res.json();
        setFreshToken(d.token);
        setNewName("");
        await load();
      }
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (id: number) => {
    await fetch(`/api/mcp/tokens/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    await load();
  };

  const mcpUrl = `${origin}/api/mcp`;
  const config = JSON.stringify(
    {
      mcpServers: {
        bugbase: {
          type: "http",
          url: mcpUrl,
          headers: { Authorization: `Bearer ${freshToken || "mcp_YOUR_TOKEN"}` },
        },
      },
    },
    null,
    2
  );

  const mcpGuideMarkdown = `# Bugbase MCP Server — Complete Developer & AI Agent Guide

## 1. Overview & Connection Setup
The Bugbase MCP (Model Context Protocol) Server exposes complete project management, issue tracking, QA test management, and workspace capabilities over HTTP (Streamable HTTP / SSE). Every request is authenticated via your user Access Token (\`Bearer mcp_...\`) and strictly inherits your user role and project permissions.

### Client Config (\`.mcp.json\`)
\`\`\`json
{
  "mcpServers": {
    "bugbase": {
      "type": "http",
      "url": "${mcpUrl}",
      "headers": {
        "Authorization": "Bearer ${freshToken || "mcp_YOUR_ACCESS_TOKEN"}"
      }
    }
  }
}
\`\`\`

---

## 2. Core Usage Rules & Principles

1. **Always Scope to Project**: Most tools require \`projectId\`. Never attempt to list or create project-specific items without providing \`projectId\`.
2. **Issue Tracker vs. Global Dashboard**:
   - Use \`list_issues\` with \`projectId\` when you need actual issue objects for a project.
   - Do **NOT** use \`dashboard\` to get issues for a project — \`dashboard\` returns global numerical aggregate stats and user-assigned issues only.
3. **QA Tasks vs. Dev Tasks & Timelines**:
   - **Task Tracker (\`list_lists\`, \`create_task\`, \`update_task\`)**: Designed primarily for **QA Tasks**, execution checklists, operational subtasks, and verification items.
   - **Dev Tasks (\`pm_list module="dev-tasks"\`, \`pm_create module="dev-tasks"\`)**: Designed for **Development & Engineering Tasks**, complete with time estimations (\`estimatedTime\`, \`actualTime\`), dependencies (\`dev_task_deps\`), sprint mapping, and feature links.
   - **Timelines & Sprints (\`pm_list module="sprints" | "milestones" | "releases"\`)**: Use these modules for roadmap milestones, sprint planning, and release versioning.
4. **Detail Precision**:
   - Provide clean, human-readable titles (minimum 2 characters).
   - Fill in detailed descriptions, acceptance criteria, and steps to reproduce. Richer detail enables better AI validation and team collaboration.

---

## 3. AI Record Reviewer (\`check_with_ai\`) & Out-of-Category Validation

All creation and edit operations (\`pm_create\`, \`pm_update\`, \`create_issue\`, \`update_issue\`, \`create_test_case\`, \`update_test_case\`, \`create_task\`, \`update_task\`) execute an automated **Check with AI** test before saving.

### How the AI Test Method Works
1. **Category Alignment Check**: Evaluates whether the content belongs in the specified module (e.g. Bug reports belong in \`bugs\` or \`issues\`, product specs in \`requirements\`, system design in \`arch-docs\`).
2. **Out-of-Category Blocking**: If \`belongsHere === false\`, the MCP server blocks creation/update and returns a structured error:
   \`\`\`json
   {
     "error": "AI Review Failed: Content does not belong in 'requirements'. It belongs in 'bugs'. Summary: This item describes a runtime error, not a product specification. Pass force=true to override.",
     "aiReview": {
       "summary": "...",
       "belongsHere": false,
       "belongsIn": "bugs",
       "findings": [...]
     }
   }
   \`\`\`
3. **Overriding Validation**: If you explicitly want to bypass AI category validation, pass \`force: true\` in your tool arguments.
4. **Explicit Evaluation Tool (\`check_with_ai\`)**:
   Call \`check_with_ai\` at any time with \`{ "module": "<module-name>", "fields": { ... } }\` to evaluate draft content and get field-by-field suggestions before calling create/update tools.

---

## 4. Error Handling & Status Codes

| Error Case | Response Format | Resolution |
| :--- | :--- | :--- |
| **Out of Category** | \`{ "error": "AI Review Failed: ...", "aiReview": {...} }\` | Re-route creation to suggested module (\`belongsIn\`), or pass \`force=true\`. |
| **Missing Arguments** | \`{ "error": "projectId is required" }\` | Provide all mandatory fields declared in tool \`inputSchema\`. |
| **Permission Denied** | \`{ "error": "Forbidden: Requires Admin or Member role" }\` | Ensure user access token has sufficient project permissions. |
| **Item Not Found** | \`{ "error": "Record not found" }\` | Verify record ID and project scope. |
| **LLM Offline** | Graceful fallback (\`aiReview: null\`) | Creation/update proceeds normally if AI review backend is unreachable. |

---

## 5. Complete MCP Tools Reference (42 Tools)

### 👤 Identity & Global Context
- \`upload_image\`: Upload base64 image data and return a public image-host URL (\`imageBase64\`, \`filename\`, \`mimeType\`). Use its returned \`url\` in issue \`imageUrls\`.
- \`whoami\`: Returns authenticated user info (\`id\`, \`name\`, \`email\`, \`role\`).
- \`list_projects\`: Lists all projects accessible by the authenticated user.
- \`get_project\`: Fetches a single project with its full member list and roles (\`projectId\`).
- \`dashboard\`: Returns global aggregate stats across ALL projects (counts of open/closed/in-progress issues and top 10 user-assigned issues). *Do not use for listing project issues.*
- \`team_progress\`: Team progress metrics (\`projectId\`, optional date ranges \`from\`/\`to\`, \`userId\`).

### 🐛 Issue Tracker Tools
- \`list_issues\`: Query project issues (\`projectId\`, \`status\`, \`priority\`, \`type\`, \`search\`, \`assignedToMe\`, \`page\`, \`limit\`).
- \`get_issue\`: Get issue details (\`issueId\`).
- \`create_issue\`: Create issue (\`projectId\`, \`title\`, \`type\`, \`description\`, \`stepsToReproduce\`, \`expectedResult\`, \`actualResult\`, \`priority\`, \`dueDate\`, \`assigneeIds\`, \`categoryIds\`, \`imageUrls\`, \`force\`). *Runs AI check.*
- \`update_issue\`: Update issue fields (\`issueId\`, \`title\`, \`status\`, \`priority\`, \`type\`, \`description\`, \`dueDate\`, \`imageUrls\`, \`force\`). *Runs AI check.*
- \`delete_issue\`: Admin-only issue deletion (\`issueId\`).
- \`set_issue_assignees\`: Replace issue assignee IDs (\`issueId\`, \`userIds\`).
- \`add_issue_comment\`: Add a comment (\`issueId\`, \`body\`).
- \`list_issue_comments\`: List comments (\`issueId\`).
- \`add_issue_images\`: Attach public image URLs to an issue or existing comment (\`issueId\`, \`imageUrls\`, optional \`commentId\`).

### 🧪 Test Cases (QA Management)
- \`list_test_cases\`: List test cases for a project (\`projectId\`).
- \`create_test_case\`: Create test case (\`projectId\`, \`title\`, \`description\`, \`steps\`, \`expectedResult\`, \`force\`). *Runs AI check.*
- \`update_test_case\`: Update test case (\`projectId\`, \`testCaseId\`, \`title\`, \`description\`, \`steps\`, \`expectedResult\`, \`force\`). *Runs AI check.*
- \`record_test_result\`: Log run execution result (\`projectId\`, \`testCaseId\`, \`status\`: \`'Pass' \| 'Fail' \| 'Blocked'\`, \`notes\`).

### 🏷️ Categories & Labels
- \`list_categories\`: List project labels/categories (\`projectId\`).
- \`create_category\`: Create label (\`projectId\`, \`name\`, \`color\`).

### 📋 Task Tracker (QA & Operational Tasks)
*Note: This section is primarily for QA tasks, checklist items, and operational execution.*
- \`list_lists\`: List task lists in a project (\`projectId\`, \`shallow\`: boolean).
- \`list_tasks\`: List paginated tasks in a list (\`projectId\`, \`listId\`, \`page\`, \`limit\`).
- \`get_task\`: Get detailed task object with subtasks & checklist items (\`projectId\`, \`listId\`, \`taskId\`).
- \`create_list\`: Create task list (\`projectId\`, \`name\`, \`description\`, \`color\`).
- \`create_task\`: Create task (\`projectId\`, \`listId\`, \`title\`, \`description\`, \`priority\`: \`'none'\|'low'\|'medium'\|'high'\`, \`dueDate\`, \`status\`: \`'active'\|'completed'\`, \`assigneeIds\`, \`categoryIds\`, \`force\`). *Runs AI check.*
- \`update_task\`: Update task (\`projectId\`, \`listId\`, \`taskId\`, \`title\`, \`description\`, \`priority\`, \`status\`, \`dueDate\`, \`assigneeIds\`, \`completerIds\`, \`categoryIds\`, \`restore\`, \`force\`). *Runs AI check.*
- \`delete_task\`: Soft-delete task (\`projectId\`, \`listId\`, \`taskId\`).
- \`create_subtask\`: Create subtask (\`projectId\`, \`listId\`, \`taskId\`, \`title\`, \`description\`).
- \`update_subtask\`: Update subtask (\`projectId\`, \`listId\`, \`taskId\`, \`subtaskId\`, \`title\`, \`description\`, \`status\`).
- \`add_checklist_item\`: Add item to subtask checklist (\`projectId\`, \`listId\`, \`taskId\`, \`subtaskId\`, \`content\`).
- \`toggle_checklist\`: Toggle checklist item state (\`projectId\`, \`listId\`, \`taskId\`, \`subtaskId\`, \`itemId\`, \`done\`).
- \`task_history\`: Task activity feed (\`projectId\`, \`taskId\`, \`action\`, \`limit\`).

### ⚙️ System & Admin
- \`activity_logs\`: Query system audit logs (\`page\`, \`limit\`, \`search\`, \`action\`, \`dateFrom\`, \`dateTo\`). *Admin only.*
- \`email_templates\`: List system email templates. *Admin only.*

### 🚀 PM Workspace Modules (19 Modules)
*Generic CRUD tools for end-to-end Project Management & Software Architecture:*
- \`pm_list\`: List records for any PM module (\`module\`, \`projectId\`, \`search\`, \`status\`, \`priority\`, \`severity\`, \`tags\`, \`sort\`, \`dir\`, \`page\`, \`limit\`).
- \`pm_get\`: Retrieve single PM record (\`module\`, \`id\`).
- \`pm_create\`: Create PM record (\`module\`, \`projectId\`, fields..., \`force\`). *Runs AI check.*
- \`pm_update\`: Update PM record (\`module\`, \`id\`, fields..., \`force\`). *Runs AI check.*
- \`pm_delete\`: Delete PM record (\`module\`, \`id\`).
- \`pm_dashboard\`: Multi-project aggregate PM metrics.
- \`check_with_ai\`: Explicitly evaluate any draft record against AI review standards (\`module\`, \`fields\`).

---

## 6. PM Workspace Modules Breakdown (19 Modules)

| Module Slug | Label | Description & Purpose |
| :--- | :--- | :--- |
| \`requirements\` | Requirements | Agreed product functional/non-functional requirements with acceptance criteria. |
| \`features\` | Features | High-level epics & product feature capabilities linked to requirements. |
| \`dev-tasks\` | Dev Tasks | Engineering & development tasks with estimations, dependencies, and sprint links. |
| \`bugs\` | Bugs | Defect tracking with severity, environment, steps to reproduce, and fix verification. |
| \`releases\` | Releases | Software release versions, target release dates, and release notes. |
| \`api-docs\` | API Docs | Endpoint specifications, HTTP methods, auth, request/response payload schemas. |
| \`arch-docs\` | Arch Docs | System architecture documentation, design decisions, and tech diagrams. |
| \`meeting-notes\` | Meeting Notes | Team meeting agendas, participants, summaries, decisions, and action items. |
| \`risks\` | Risks | Project risks, impact rating, probability, and mitigation plans. |
| \`ideas\` | Ideas | Product brainstorming, feature ideas, impact vs. effort scoring. |
| \`milestones\` | Milestones | Project milestones, target dates, status, and completion progress %. |
| \`sprints\` | Sprints | Sprint iterations, start/end dates, sprint goals, and status. |
| \`user-stories\` | User Stories | Agile user stories (As a... I want... So that...). |
| \`personas\` | Personas | User personas, roles, goals, pain points, and behavioral traits. |
| \`user-journeys\` | User Journeys | Mapping end-to-end user workflows, touchpoints, and opportunities. |
| \`tech-stack\` | Tech Stack | Frameworks, libraries, databases, evaluation status, and technical rationale. |
| \`mockups\` | Mockups | Design links (Figma/images), screen names, descriptions, and UI status. |
| \`workflows\` | Workflows | Step-by-step process flows, trigger events, and execution steps. |
| \`business-rules\` | Business Rules | System validation rules, conditions, constraints, and enforcement actions. |
`;

  return (
    <div className="max-w-full space-y-8">
      <section>
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">MCP Server</h2>
        <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
          Connect any MCP client (Claude Code, Claude Desktop, Cursor) to bugbase over
          the network — no local install. The server exposes projects, issues, test
          cases, the task tracker, team progress, and admin settings as tools. Every
          call runs as <strong>you</strong>, scoped to your role and project memberships.
        </p>
      </section>

      {/* 1. Token */}
      <section>
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">1. Create an access token</h3>
        <div className="flex flex-col sm:flex-row gap-2 mb-3">
          <Input
            id="tokenName"
            placeholder="Token name (e.g. Laptop, CI, Alice)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            wrapperClassName="flex-1"
          />
          <Button onClick={createToken} disabled={creating} className="sm:w-auto">
            {creating ? "Generating…" : "Generate token"}
          </Button>
        </div>

        {freshToken && (
          <div className="mb-3">
            <p className="text-xs mb-1.5 font-medium text-[var(--color-warning,#b45309)]">
              Copy this now — it won&apos;t be shown again.
            </p>
            <CopyBlock text={freshToken} />
          </div>
        )}

        {/* Existing tokens */}
        {!loading && tokens.length > 0 && (
          <div className="border border-[var(--color-border)] rounded-lg divide-y divide-[var(--color-border)]">
            {tokens.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <div className="text-sm text-[var(--color-text-primary)] truncate">{t.name}</div>
                  <div className="text-[11px] text-[var(--color-text-secondary)]">
                    {t.prefix}…{" · "}
                    {t.lastUsedAt ? `last used ${new Date(t.lastUsedAt).toLocaleDateString()}` : "never used"}
                  </div>
                </div>
                <button
                  onClick={() => revoke(t.id)}
                  className="text-[11px] px-2 py-1 rounded border border-[var(--color-border)] text-[var(--color-danger)] hover:bg-red-50 transition-colors flex-shrink-0"
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
        )}
        {!loading && tokens.length === 0 && !freshToken && (
          <p className="text-xs text-[var(--color-text-secondary)]">No tokens yet.</p>
        )}
      </section>

      {/* 2. Config */}
      <section>
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">2. Add to your MCP client</h3>
        <p className="text-sm text-[var(--color-text-secondary)] mb-3">
          Paste into your client&apos;s MCP config (e.g.{" "}
          <code className="text-xs px-1 py-0.5 rounded bg-[var(--color-bg-subtle)]">.mcp.json</code>). The
          server URL is <code className="text-xs px-1 py-0.5 rounded bg-[var(--color-bg-subtle)]">{mcpUrl}</code>.
        </p>
        <CopyBlock text={config} />
        <p className="text-xs text-[var(--color-text-secondary)] mt-2">
          Reload MCP servers in your client, then use any tool. No login step — the token identifies you.
        </p>
      </section>

      {/* 3. Rules & Instructions */}
      <section>
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">
          3. Rules & Usage Instructions
        </h3>
        <p className="text-sm text-[var(--color-text-secondary)] mb-3">
          Follow these rules when interacting with Bugbase via MCP tools to ensure data accuracy, clear details, and proper categorization:
        </p>

        <div className="space-y-3 text-xs text-[var(--color-text-secondary)] mb-4">
          <div className="p-3.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-subtle)] space-y-1.5">
            <div className="font-semibold text-[var(--color-text-primary)] flex items-center gap-1.5">
              <span>🤖 AI Category & Content Validation</span>
            </div>
            <p>
              All creation and update operations (<code>pm_create</code>, <code>pm_update</code>, <code>create_issue</code>, <code>create_test_case</code>, <code>create_task</code>) automatically execute the <strong>Check with AI</strong> test method before saving.
            </p>
            <ul className="list-disc pl-4 space-y-1 pt-1">
              <li>Content must match the target module category (e.g. Bug reports belong in <code>bugs</code>/<code>issues</code>, product specifications in <code>requirements</code>, architecture in <code>arch-docs</code>).</li>
              <li>Out-of-category items (where <code>belongsHere === false</code>) are blocked to prevent misfiling data. Pass <code>force=true</code> to override.</li>
              <li>You can explicitly test draft content before saving by calling the <code>check_with_ai</code> tool with <code>{`{ module, fields }`}</code>.</li>
            </ul>
          </div>

          <div className="p-3.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-subtle)] space-y-1.5">
            <div className="font-semibold text-[var(--color-text-primary)] flex items-center gap-1.5">
              <span>🖼️ Image URLs in Issue Reports</span>
            </div>
            <p>
              First call <code>upload_image</code> with base64 image data, a filename, and MIME type to upload a screenshot to the configured image host. It returns a public <code>url</code>. Pass that URL in <code>imageUrls</code> when calling <code>create_issue</code> or <code>update_issue</code>; updates add attachments without removing existing ones.
            </p>
            <ul className="list-disc pl-4 space-y-1">
              <li><code>upload_image</code> accepts JPEG, PNG, GIF, WebP, and SVG images up to 10 MB. The server must have an ImgBB or FreeImage.host API key configured.</li>
              <li>Use <code>add_issue_images</code> with <code>{`{ issueId, imageUrls }`}</code> to add images after an issue exists.</li>
              <li>Pass <code>commentId</code> to attach images to a specific existing issue comment.</li>
              <li>Only use publicly reachable direct image URLs; MCP stores the URL and does not download the file.</li>
            </ul>
          </div>

          <div className="p-3.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-subtle)] space-y-1.5">
            <div className="font-semibold text-[var(--color-text-primary)] flex items-center gap-1.5">
              <span>🎯 Project Scoping & Permissions</span>
            </div>
            <ul className="list-disc pl-4 space-y-1">
              <li>Always provide <code>projectId</code> for project-scoped tools (e.g. <code>list_issues</code>, <code>list_test_cases</code>, <code>pm_create</code>, <code>list_lists</code>).</li>
              <li>Operations run strictly under your authenticated identity and respect project role permissions (Admin, Member, Viewer).</li>
            </ul>
          </div>

          <div className="p-3.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-subtle)] space-y-1.5">
            <div className="font-semibold text-[var(--color-text-primary)] flex items-center gap-1.5">
              <span>📊 Tool Selection & Tasks vs Dev-Tasks</span>
            </div>
            <ul className="list-disc pl-4 space-y-1">
              <li><strong>Task Tracker (QA Tasks)</strong>: <code>create_task</code> & <code>list_tasks</code> are designed primarily for QA tasks, checklist execution, and operational items.</li>
              <li><strong>Dev Tasks (Timelines & Engineering)</strong>: Use <code>pm_create</code>/<code>pm_list</code> with <code>module=&quot;dev-tasks&quot;</code> for engineering tasks with time estimations, feature links, and dependencies. Use <code>sprints</code>, <code>milestones</code>, and <code>releases</code> for project timelines.</li>
              <li>Use <code>list_issues</code> with <code>projectId</code> to retrieve project issues (do not use <code>dashboard</code> for project listing).</li>
            </ul>
          </div>
        </div>

        <h4 className="text-xs font-semibold text-[var(--color-text-primary)] mb-1.5">
          Full Copy-Pastable MCP Guide & System Prompt for AI Agents
        </h4>
        <CopyBlock text={mcpGuideMarkdown} />
      </section>
    </div>
  );
}
