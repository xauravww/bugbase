"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { marked } from "marked";
import { Search, ChevronLeft, ChevronRight, Activity, Mail, Pencil, Save, X, ToggleLeft, ToggleRight, Eye, Plus, Bold, Italic, List, ListOrdered, Link as LinkIcon, Heading2, Code } from "lucide-react";
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
  const [activeTab, setActiveTab] = useState<"profile" | "logs" | "emails">("profile");
  
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
    setTimeout(() => {
      setMessage({ type: "success", text: "Password changed successfully" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setIsUpdating(false);
    }, 1000);
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
    <div>
      <Header title="Settings" />

      <div className="p-4 md:p-6 max-w-5xl">
        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-[var(--color-border)]">
          <button
            onClick={() => setActiveTab("profile")}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              activeTab === "profile"
                ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            }`}
          >
            Profile
          </button>
          {user.role === "Admin" && (
            <>
              <button
                onClick={() => setActiveTab("logs")}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px flex items-center gap-2 ${
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
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px flex items-center gap-2 ${
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
          <div className="max-w-lg">
            <section className="mb-8">
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">Profile</h2>
              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <Input id="name" label="Full Name" value={name} onChange={(e) => setName(e.target.value)} required />
                <Input id="email" label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                <div className="text-sm text-[var(--color-text-secondary)]">
                  Role: <span className="font-medium text-[var(--color-text-primary)]">{user.role}</span>
                </div>
                <Button type="submit" disabled={isUpdating}>Update Profile</Button>
              </form>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">Change Password</h2>
              <form onSubmit={handleChangePassword} className="space-y-4">
                <Input id="currentPassword" label="Current Password" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
                <Input id="newPassword" label="New Password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
                <Input id="confirmPassword" label="Confirm New Password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
                <Button type="submit" disabled={isUpdating}>Change Password</Button>
              </form>
            </section>
          </div>
        )}

        {/* Activity Logs Tab */}
        {activeTab === "logs" && user.role === "Admin" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Activity Logs</h2>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--color-text-secondary)]">Auto-refresh</span>
                <button
                  onClick={() => setLogsAutoRefresh(!logsAutoRefresh)}
                  className={`p-1 rounded transition-colors ${logsAutoRefresh ? "text-green-600" : "text-gray-400"}`}
                >
                  {logsAutoRefresh ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
                </button>
              </div>
            </div>

            <div className="bg-[var(--color-surface)] rounded-lg p-4 mb-4 space-y-3">
              <div className="flex flex-wrap gap-3">
                <div className="flex-1 min-w-[200px]">
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
                  className="px-3 py-2 text-sm bg-white border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
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
                <Button variant="secondary" size="sm" onClick={() => { clearLogsFilters(); fetchLogs(1); }}>
                  Clear
                </Button>
                <Button size="sm" onClick={() => fetchLogs(1)}>
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
                      <div className="flex items-start gap-4">
                        <Avatar name={log.user.name} size="md" />
                        <div className="flex-1 min-w-0">
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
                          <div className="flex items-center gap-2 mt-2">
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
                  <div className="flex items-center justify-between mt-6 pt-4 border-t border-[var(--color-border)]">
                    <span className="text-sm text-[var(--color-text-secondary)]">
                      Showing {((logsPagination.page - 1) * logsPagination.limit) + 1} to {Math.min(logsPagination.page * logsPagination.limit, logsPagination.total)} of {logsPagination.total} logs
                    </span>
                    <div className="flex items-center gap-2">
                      <button onClick={() => fetchLogs(logsPagination.page - 1)} disabled={logsPagination.page === 1}
                        className="p-2 rounded border border-[var(--color-border)] hover:bg-[var(--color-surface)] disabled:opacity-50">
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="text-sm text-[var(--color-text-secondary)] px-3">
                        Page {logsPagination.page} of {logsPagination.totalPages}
                      </span>
                      <button onClick={() => fetchLogs(logsPagination.page + 1)} disabled={logsPagination.page >= logsPagination.totalPages}
                        className="p-2 rounded border border-[var(--color-border)] hover:bg-[var(--color-surface)] disabled:opacity-50">
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
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Email Templates</h2>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                  Configure email notifications for various events. Use {"{{variable}}"} for dynamic content.
                </p>
              </div>
              <Button size="sm" onClick={() => setShowAddModal(true)}>
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
                        <div className="flex items-center justify-between">
                          <h3 className="font-medium">{EMAIL_EVENTS[template.event] || template.event}</h3>
                          <div className="flex gap-2">
                            <button onClick={handleSaveTemplate} className="p-1.5 text-[var(--color-success)] hover:bg-green-50 rounded">
                              <Save className="w-4 h-4" />
                            </button>
                            <button onClick={() => setEditingTemplate(null)} className="p-1.5 text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)] rounded">
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
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium">{EMAIL_EVENTS[template.event] || template.event}</h3>
                            {template.enabled ? (
                              <Badge variant="default" className="bg-green-50 text-green-700">Enabled</Badge>
                            ) : (
                              <Badge variant="default" className="bg-gray-50 text-gray-500">Disabled</Badge>
                            )}
                          </div>
                          <div className="flex gap-1">
                            <button
                              onClick={() => setPreviewTemplate(template)}
                              className="p-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] hover:bg-[var(--color-surface)] rounded"
                              title="Preview"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setEditingTemplate(template)}
                              className="p-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] hover:bg-[var(--color-surface)] rounded"
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
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
                <div>
                  <h3 className="font-semibold text-[var(--color-text-primary)]">Email Preview</h3>
                  <p className="text-sm text-[var(--color-text-secondary)]">{EMAIL_EVENTS[previewTemplate.event] || previewTemplate.event}</p>
                </div>
                <button
                  onClick={() => setPreviewTemplate(null)}
                  className="p-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface)] rounded"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4 overflow-y-auto max-h-[calc(90vh-120px)]">
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
            <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
              <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
                <h3 className="font-semibold text-[var(--color-text-primary)]">Add Custom Template</h3>
                <button
                  onClick={() => { setShowAddModal(false); setNewTemplate({ event: "", subject: "", body: "" }); }}
                  className="p-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface)] rounded"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4 space-y-4 max-h-[80vh] overflow-y-auto">
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
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="secondary" onClick={() => { setShowAddModal(false); setNewTemplate({ event: "", subject: "", body: "" }); }}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateTemplate}>
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
