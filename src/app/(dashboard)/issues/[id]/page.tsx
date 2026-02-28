"use client";

import { useEffect, useState, use, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChevronLeft, Send, Clock, Upload, X, Check, UserPlus, Image, Search, ChevronRight, Download, Clipboard, Trash2, Pencil } from "lucide-react";
import { Header } from "@/components/layout";
import { Button, Select, PageLoader, StatusBadge, TypeBadge, PriorityBadge, Avatar, Badge } from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";
import { ISSUE_STATUSES, ISSUE_PRIORITIES } from "@/constants";
import { useClickOutside } from "@/hooks/useClickOutside";

interface Member {
  id: number;
  name: string;
  email: string;
  role: string;
}

interface Attachment {
  id: number;
  url: string;
  createdAt: string;
}

interface IssueDetail {
  id: number;
  title: string;
  type: string;
  description: string | null;
  stepsToReproduce: string | null;
  expectedResult: string | null;
  actualResult: string | null;
  status: string;
  priority: string;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
  project: { id: number; name: string; key: string };
  reporter: { id: number; name: string; email: string };
  assignees: Array<{ user: { id: number; name: string; email: string } }>;
  verifiers: Array<{ user: { id: number; name: string; email: string } }>;
  verifications: Array<{ user: { id: number; name: string; email: string } }>;
  attachments: Attachment[];
  comments: Array<{
    id: number;
    body: string;
    createdAt: string;
    user: { id: number; name: string; email: string };
    attachments: Attachment[];
  }>;
  activities: Array<{
    id: number;
    action: string;
    oldValue: string | null;
    newValue: string | null;
    createdAt: string;
    user: { id: number; name: string; email: string };
  }>;
}

export default function IssueDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { token, user } = useAuth();
  const [issue, setIssue] = useState<IssueDetail | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [commentText, setCommentText] = useState("");
  const [commentScreenshots, setCommentScreenshots] = useState<string[]>([]);
  const [isUploadingComment, setIsUploadingComment] = useState(false);
  const commentFileInputRef = useRef<HTMLInputElement>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [lightboxImages, setLightboxImages] = useState<Attachment[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAssigneeDropdown, setShowAssigneeDropdown] = useState(false);
  const [showVerifierDropdown, setShowVerifierDropdown] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [assigneeSearch, setAssigneeSearch] = useState("");
  const [verifierSearch, setVerifierSearch] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    stepsToReproduce: "",
    expectedResult: "",
    actualResult: "",
  });
  const [isSaving, setIsSaving] = useState(false);

  const assigneeDropdownRef = useClickOutside<HTMLDivElement>(() => setShowAssigneeDropdown(false));
  const verifierDropdownRef = useClickOutside<HTMLDivElement>(() => setShowVerifierDropdown(false));

  const issueId = resolvedParams.id;

  const fetchIssue = async () => {
    try {
      const res = await fetch(`/api/issues/${issueId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setIssue(data.issue);
      } else if (res.status === 403 || res.status === 404) {
        router.push("/projects");
      }
    } catch (error) {
      console.error("Failed to fetch issue:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMembers = async (search: string = "") => {
    try {
      const url = `/api/issues/${issueId}/members${search ? `?search=${encodeURIComponent(search)}` : ""}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMembers(data.members);
      }
    } catch (error) {
      console.error("Failed to fetch members:", error);
    }
  };

  useEffect(() => {
    if (token && issueId) {
      fetchIssue();
      fetchMembers();
    }
  }, [token, issueId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (showAssigneeDropdown) {
        fetchMembers(assigneeSearch);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [assigneeSearch, showAssigneeDropdown]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (showVerifierDropdown) {
        fetchMembers(verifierSearch);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [verifierSearch, showVerifierDropdown]);

  // Determine user's project membership from members list
  const currentUserMember = user ? members.find(m => m.id === user.id) : null;
  const isVerified = issue?.isVerified ?? false;
  // All project members can verify (admin, member, or qa)
  const canVerify = user && (
    user.role === "Admin" || currentUserMember !== undefined
  );

  const handleStatusChange = async (newStatus: string) => {
    if (!issue) return;
    try {
      await fetch(`/api/issues/${issueId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });
      fetchIssue();
    } catch (error) {
      console.error("Failed to update status:", error);
    }
  };

  const handlePriorityChange = async (newPriority: string) => {
    if (!issue) return;
    try {
      await fetch(`/api/issues/${issueId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ priority: newPriority }),
      });
      fetchIssue();
    } catch (error) {
      console.error("Failed to update priority:", error);
    }
  };

  const handleAssigneesChange = async (userIds: number[]) => {
    try {
      await fetch(`/api/issues/${issueId}/assignees`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userIds }),
      });
      fetchIssue();
      setShowAssigneeDropdown(false);
    } catch (error) {
      console.error("Failed to update assignees:", error);
    }
  };

  const handleVerifiersChange = async (userIds: number[]) => {
    try {
      await fetch(`/api/issues/${issueId}/verifiers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userIds }),
      });
      fetchIssue();
      setShowVerifierDropdown(false);
    } catch (error) {
      console.error("Failed to update verifiers:", error);
    }
  };

  const handleVerify = async () => {
    try {
      await fetch(`/api/issues/${issueId}/verify`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchIssue();
    } catch (error) {
      console.error("Failed to verify:", error);
    }
  };

  const uploadImageFile = async (file: File): Promise<{ url: string; deleteHash?: string } | null> => {
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (res.ok) return await res.json();
    } catch (error) {
      console.error("Failed to upload:", error);
    }
    return null;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const data = await uploadImageFile(file);
      if (data) {
        await fetch(`/api/issues/${issueId}/attachments`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ url: data.url, deleteHash: data.deleteHash }),
        });
        fetchIssue();
      }
    } catch (error) {
      console.error("Failed to upload:", error);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handlePasteUpload = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) return;
        setIsUploading(true);
        try {
          const data = await uploadImageFile(file);
          if (data) {
            await fetch(`/api/issues/${issueId}/attachments`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ url: data.url, deleteHash: data.deleteHash }),
            });
            fetchIssue();
          }
        } finally {
          setIsUploading(false);
        }
        return;
      }
    }
  };

  const handleCommentPaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) return;
        setIsUploadingComment(true);
        try {
          const data = await uploadImageFile(file);
          if (data) {
            setCommentScreenshots(prev => [...prev, data.url]);
          }
        } finally {
          setIsUploadingComment(false);
        }
        return;
      }
    }
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!commentText.trim() && commentScreenshots.length === 0) || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const bodyText = commentText.trim() || (commentScreenshots.length > 0 ? "(screenshot)" : "");
      const res = await fetch(`/api/issues/${issueId}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ body: bodyText }),
      });

      if (res.ok) {
        const data = await res.json();
        const commentId = data.comment?.id;

        if (commentId && commentScreenshots.length > 0) {
          for (const url of commentScreenshots) {
            await fetch(`/api/issues/${issueId}/attachments`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ url, commentId }),
            });
          }
        }

        setCommentText("");
        setCommentScreenshots([]);
        fetchIssue();
      }
    } catch (error) {
      console.error("Failed to add comment:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCommentScreenshotUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingComment(true);
    try {
      const data = await uploadImageFile(file);
      if (data) {
        setCommentScreenshots(prev => [...prev, data.url]);
      }
    } catch (error) {
      console.error("Failed to upload:", error);
    } finally {
      setIsUploadingComment(false);
      e.target.value = "";
    }
  };

  const canEdit = user?.role === "Admin" || user?.role === "Developer" || user?.role === "QA" || (user && issue?.reporter.id === user.id);
  const canDelete = user?.role === "Admin" || (user && issue?.reporter.id === user.id);

  const handleDeleteIssue = async () => {
    if (!issue) return;
    const confirmed = window.confirm(`Are you sure you want to delete issue #${issue.id} "${issue.title}"? This action cannot be undone.`);
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/issues/${issue.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        router.push(`/projects/${issue.project.id}`);
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete issue");
      }
    } catch (error) {
      console.error("Failed to delete issue:", error);
      alert("Failed to delete issue");
    }
  };

  const assigneeIds = issue?.assignees.map(a => a.user.id) || [];
  const verifierIds = issue?.verifiers.map(v => v.user.id) || [];

  if (isLoading) {
    return <PageLoader />;
  }

  if (!issue) {
    return null;
  }

  const timeline = [
    ...issue.comments.map(c => ({ ...c, type: "comment" as const })),
    ...issue.activities.map(a => ({ ...a, type: "activity" as const })),
  ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  return (
    <div className="min-h-screen flex flex-col pb-20">
      <Header title={`#${issue.id}`} />
        
      <div className="p-4 max-w-7xl mx-auto w-full">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-2">
          <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
            <Link href={`/projects/${issue.project.id}`} className="hover:text-[var(--color-accent)] flex items-center gap-1">
              <ChevronLeft className="w-4 h-4" />
              {issue.project.name}
            </Link>
            <span>/</span>
            <span className="text-[var(--color-text-primary)]">#{issue.id}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canEdit && !isEditing && (
              <Button
                variant="secondary"
                onClick={() => {
                  setEditForm({
                    title: issue.title,
                    description: issue.description || "",
                    stepsToReproduce: issue.stepsToReproduce || "",
                    expectedResult: issue.expectedResult || "",
                    actualResult: issue.actualResult || "",
                  });
                  setIsEditing(true);
                }}
                className="flex items-center gap-2"
              >
                <Pencil className="w-4 h-4" />
                Edit
              </Button>
            )}
            {isEditing && (
              <>
                <Button
                  variant="secondary"
                  onClick={() => setIsEditing(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={async () => {
                    setIsSaving(true);
                    try {
                      const res = await fetch(`/api/issues/${issueId}`, {
                        method: "PUT",
                        headers: {
                          "Content-Type": "application/json",
                          Authorization: `Bearer ${token}`,
                        },
                        body: JSON.stringify({
                          title: editForm.title,
                          description: editForm.description || null,
                          stepsToReproduce: editForm.stepsToReproduce || null,
                          expectedResult: editForm.expectedResult || null,
                          actualResult: editForm.actualResult || null,
                        }),
                      });
                      if (res.ok) {
                        setIsEditing(false);
                        fetchIssue();
                      } else {
                        const data = await res.json();
                        alert(data.error || "Failed to save");
                      }
                    } catch (err) {
                      console.error("Failed to save:", err);
                    } finally {
                      setIsSaving(false);
                    }
                  }}
                  disabled={isSaving}
                >
                  {isSaving ? "Saving..." : "Save"}
                </Button>
              </>
            )}
            {canDelete && (
              <Button
                variant="secondary"
                onClick={handleDeleteIssue}
                className="flex items-center gap-2 text-[var(--color-danger)] hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={() => window.open(`/api/issues/${issue.id}/export${token ? `?token=${token}` : ''}`, "_blank")}
              className="flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export PDF
            </Button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
          <div className="flex-1 min-w-0">
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-2">
                <TypeBadge type={issue.type} />
                <StatusBadge status={issue.status} />
              </div>
              {isEditing ? (
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  className="text-2xl font-semibold text-[var(--color-text-primary)] w-full px-3 py-2 border border-[var(--color-border)] rounded-md focus:outline-none focus:border-[var(--color-accent)]"
                />
              ) : (
                <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">
                  {issue.title}
                </h1>
              )}
            </div>

            {(issue.description || isEditing) && (
              <div className="mb-8">
                <h3 className="text-sm font-medium text-[var(--color-text-secondary)] uppercase tracking-wide mb-2">
                  Description
                </h3>
                {isEditing ? (
                  <textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-md focus:outline-none focus:border-[var(--color-accent)] resize-none"
                    rows={5}
                    placeholder="Issue description... (Markdown supported)"
                  />
                ) : (
                  <div className="bg-[var(--color-surface)] rounded-lg p-4 text-[var(--color-text-primary)] prose prose-sm max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{issue.description}</ReactMarkdown>
                  </div>
                )}
              </div>
            )}

            {/* QA Fields for Bugs */}
            {(issue.type === "Bug" || isEditing) && (
              <div className="mb-8 space-y-4">
                {(issue.stepsToReproduce || isEditing) && (
                  <div>
                    <h3 className="text-sm font-medium text-[var(--color-text-secondary)] uppercase tracking-wide mb-2">
                      Steps to Reproduce
                    </h3>
                    {isEditing ? (
                      <textarea
                        value={editForm.stepsToReproduce}
                        onChange={(e) => setEditForm({ ...editForm, stepsToReproduce: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-md focus:outline-none focus:border-[var(--color-accent)] resize-none"
                        rows={4}
                        placeholder="1. Go to...&#10;2. Click on...&#10;3. See error..."
                      />
                    ) : (
                      <div className="bg-[var(--color-surface)] rounded-lg p-4 text-[var(--color-text-primary)] prose prose-sm max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{issue.stepsToReproduce}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                )}
                {(issue.expectedResult || isEditing) && (
                  <div>
                    <h3 className="text-sm font-medium text-[var(--color-text-secondary)] uppercase tracking-wide mb-2">
                      Expected Result
                    </h3>
                    {isEditing ? (
                      <textarea
                        value={editForm.expectedResult}
                        onChange={(e) => setEditForm({ ...editForm, expectedResult: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-md focus:outline-none focus:border-[var(--color-accent)] resize-none"
                        rows={3}
                        placeholder="What should happen..."
                      />
                    ) : (
                      <div className="bg-[var(--color-surface)] rounded-lg p-4 text-[var(--color-text-primary)] prose prose-sm max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{issue.expectedResult}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                )}
                {(issue.actualResult || isEditing) && (
                  <div>
                    <h3 className="text-sm font-medium text-[var(--color-text-secondary)] uppercase tracking-wide mb-2">
                      Actual Result
                    </h3>
                    {isEditing ? (
                      <textarea
                        value={editForm.actualResult}
                        onChange={(e) => setEditForm({ ...editForm, actualResult: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-md focus:outline-none focus:border-[var(--color-accent)] resize-none"
                        rows={3}
                        placeholder="What actually happens..."
                      />
                    ) : (
                      <div className="bg-[var(--color-surface)] rounded-lg p-4 text-[var(--color-text-primary)] prose prose-sm max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{issue.actualResult}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {issue.attachments && issue.attachments.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-[var(--color-text-secondary)] uppercase tracking-wide mb-2">
                  Attachments ({issue.attachments.length})
                </h3>
                <div className="flex flex-wrap gap-2">
                  {issue.attachments.map((att, index) => (
                    <div
                      key={att.id}
                      onClick={() => {
                        console.log("Opening lightbox for attachment:", att.url);
                        setLightboxImages(issue.attachments || []);
                        setLightboxIndex(index);
                        setLightboxImage(att.url);
                      }}
                      className="block w-20 h-20 md:w-24 md:h-24 rounded-lg overflow-hidden border border-[var(--color-border)] hover:border-[var(--color-accent)] transition-all hover:scale-105 cursor-pointer"
                    >
                      <img src={att.url} alt="attachment" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-6">
              <h3 className="text-sm font-medium text-[var(--color-text-secondary)] uppercase tracking-wide mb-4">
                Activity
              </h3>

              <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                {timeline.map((item, index) => (
                  <div key={`${item.type}-${item.id}`} className="flex gap-3">
                    <Avatar name={item.user.name} size="sm" />
                    <div className="flex-1 min-w-0">
                      {item.type === "comment" ? (
                        <div className="bg-white border border-[var(--color-border)] rounded-lg p-3">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                            <span className="font-medium text-sm text-[var(--color-text-primary)]">
                              {item.user.name}
                            </span>
                            <span className="text-xs text-[var(--color-text-secondary)]">
                              {formatRelativeTime(item.createdAt)}
                            </span>
                          </div>
                          <div className="prose prose-sm max-w-none">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{item.body}</ReactMarkdown>
                          </div>
                          {item.attachments && item.attachments.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {item.attachments.map((att, idx) => (
                                <div
                                  key={att.id}
                                  onClick={() => { setLightboxImages(item.attachments || []); setLightboxIndex(idx); setLightboxImage(att.url); }}
                                  className="block w-14 h-14 md:w-16 md:h-16 rounded overflow-hidden border border-[var(--color-border)] hover:border-[var(--color-accent)] transition-all hover:scale-105 cursor-pointer touch-target"
                                >
                                  <img src={att.url} alt="attachment" className="w-full h-full object-cover" />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="py-2">
                          <span className="text-sm text-[var(--color-text-secondary)]">
                            <span className="font-medium text-[var(--color-text-primary)]">{item.user.name}</span>
                            {" "}{item.action}
                            {item.oldValue && item.newValue && (
                              <>
                                {" "}from <Badge variant="default">{item.oldValue}</Badge>
                                {" "}to <Badge variant="default">{item.newValue}</Badge>
                              </>
                            )}
                            <span className="ml-2 text-xs">{formatRelativeTime(item.createdAt)}</span>
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {canEdit && (
              <form onSubmit={handleSubmitComment} className="flex gap-3">
                <Avatar name={user?.name || ""} size="sm" />
                <div className="flex-1 space-y-2">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      className="flex-1 px-3 py-2 text-sm border border-[var(--color-border)] rounded-md focus:outline-none focus:border-[var(--color-accent)]"
                      placeholder="Add a comment... (Paste image with Ctrl+V)"
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      onPaste={handleCommentPaste}
                    />
                    <input
                      type="file"
                      ref={commentFileInputRef}
                      accept="image/*"
                      onChange={handleCommentScreenshotUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => commentFileInputRef.current?.click()}
                      disabled={isUploadingComment}
                      className="p-2 border border-[var(--color-border)] rounded-md hover:bg-[var(--color-surface)] text-[var(--color-text-secondary)] touch-target"
                    >
                      <Image className="w-4 h-4" />
                    </button>
                    <Button type="submit" disabled={(!commentText.trim() && commentScreenshots.length === 0) || isSubmitting} className="touch-target">
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                  {commentScreenshots.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {commentScreenshots.map((url, index) => (
                        <div key={index} className="relative w-12 h-12 rounded overflow-hidden border border-[var(--color-border)] cursor-pointer hover:border-[var(--color-accent)] transition-all hover:scale-105 touch-target">
                          <img
                            src={url}
                            alt={`screenshot-${index}`}
                            className="w-full h-full object-cover"
                            onClick={() => {
                              setLightboxImages(commentScreenshots.map((u, i) => ({ id: i, url: u, createdAt: '' })));
                              setLightboxIndex(index);
                              setLightboxImage(url);
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => setCommentScreenshots(commentScreenshots.filter((_, i) => i !== index))}
                            className="absolute top-0 right-0 bg-black/50 text-white p-0.5 rounded-bl touch-target"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </form>
            )}
          </div>

          <div className="w-full lg:w-72 flex-shrink-0">
            <div className="bg-white border border-[var(--color-border)] rounded-lg p-4 space-y-4">
              {canVerify && (
                <div>
                  <button
                    onClick={handleVerify}
                    className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md border touch-target ${isVerified
                      ? "bg-green-50 border-green-300 text-green-700"
                      : "border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface)]"
                      }`}
                  >
                    <Check className={`w-4 h-4 ${isVerified ? "text-green-600" : ""}`} />
                    {isVerified ? "Verified" : "Mark as Verified"}
                  </button>
                </div>
              )}

              {isVerified && issue.verifications.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wide mb-2">
                    Verified By
                  </label>
                  <div className="space-y-2">
                    {issue.verifications.map((v) => (
                      <div key={v.user.id} className="flex items-center gap-2">
                        <Avatar name={v.user.name} size="sm" />
                        <span className="text-sm text-[var(--color-text-primary)]">{v.user.name}</span>
                        <Check className="w-4 h-4 text-green-600" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wide mb-2">
                  Status
                </label>
                {canEdit ? (
                  <Select
                    options={Object.values(ISSUE_STATUSES).map(s => ({ value: s, label: s }))}
                    value={issue.status}
                    onChange={(e) => handleStatusChange(e.target.value)}
                  />
                ) : (
                  <StatusBadge status={issue.status} />
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wide mb-2">
                  Priority
                </label>
                {canEdit ? (
                  <Select
                    options={Object.values(ISSUE_PRIORITIES).map(p => ({ value: p, label: p }))}
                    value={issue.priority}
                    onChange={(e) => handlePriorityChange(e.target.value)}
                  />
                ) : (
                  <PriorityBadge priority={issue.priority} />
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wide mb-2">
                  Assignees
                </label>
                {issue.assignees.length > 0 ? (
                  <div className="space-y-2">
                    {issue.assignees.map((a) => (
                      <div key={a.user.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Avatar name={a.user.name} size="sm" />
                          <span className="text-sm text-[var(--color-text-primary)]">{a.user.name}</span>
                        </div>
                        {canEdit && (
                          <button
                            onClick={() => handleAssigneesChange(assigneeIds.filter(id => id !== a.user.id))}
                            className="text-[var(--color-text-secondary)] hover:text-[var(--color-danger)]"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-sm text-[var(--color-text-placeholder)]">Unassigned</span>
                )}
                {canEdit && (
                  <div className="relative mt-2" ref={assigneeDropdownRef}>
                    <button
                      onClick={() => { setShowAssigneeDropdown(!showAssigneeDropdown); setAssigneeSearch(""); fetchMembers(""); }}
                      className="flex items-center gap-1 text-sm text-[var(--color-accent)] hover:text-[var(--color-accent-hover)]"
                    >
                      <UserPlus className="w-4 h-4" />
                      Add assignee
                    </button>
                    {showAssigneeDropdown && (
                      <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-[var(--color-border)] rounded-lg shadow-lg z-10">
                        <div className="p-2 border-b border-[var(--color-border)]">
                          <input
                            type="text"
                            placeholder="Search users..."
                            value={assigneeSearch}
                            onChange={(e) => setAssigneeSearch(e.target.value)}
                            className="w-full px-2 py-1 text-sm border border-[var(--color-border)] rounded focus:outline-none focus:border-[var(--color-accent)]"
                            autoFocus
                          />
                        </div>
                        <div className="max-h-48 overflow-auto">
                          {members.length === 0 ? (
                            <div className="px-3 py-2 text-sm text-[var(--color-text-placeholder)]">No users found</div>
                          ) : (
                            members
                              .filter(m => !assigneeIds.includes(m.id))
                              .map(m => (
                                <button
                                  key={m.id}
                                  onClick={() => handleAssigneesChange([...assigneeIds, m.id])}
                                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--color-surface)] text-left"
                                >
                                  <Avatar name={m.name} size="sm" />
                                  <div className="flex flex-col">
                                    <span className="text-sm">{m.name}</span>
                                    <span className="text-xs text-[var(--color-text-secondary)]">{m.email}</span>
                                  </div>
                                </button>
                              ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wide mb-2">
                  Verifiers
                </label>
                {issue.verifiers.length > 0 ? (
                  <div className="space-y-2">
                    {issue.verifiers.map((v) => (
                      <div key={v.user.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Avatar name={v.user.name} size="sm" />
                          <span className="text-sm text-[var(--color-text-primary)]">{v.user.name}</span>
                        </div>
                        {canEdit && (
                          <button
                            onClick={() => handleVerifiersChange(verifierIds.filter(id => id !== v.user.id))}
                            className="text-[var(--color-text-secondary)] hover:text-[var(--color-danger)]"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-sm text-[var(--color-text-placeholder)]">No verifiers set</span>
                )}
                {canEdit && (
                  <div className="relative mt-2" ref={verifierDropdownRef}>
                    <button
                      onClick={() => { setShowVerifierDropdown(!showVerifierDropdown); setVerifierSearch(""); fetchMembers(""); }}
                      className="flex items-center gap-1 text-sm text-[var(--color-accent)] hover:text-[var(--color-accent-hover)]"
                    >
                      <UserPlus className="w-4 h-4" />
                      Add verifier
                    </button>
                    {showVerifierDropdown && (
                      <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-[var(--color-border)] rounded-lg shadow-lg z-10">
                        <div className="p-2 border-b border-[var(--color-border)]">
                          <input
                            type="text"
                            placeholder="Search users..."
                            value={verifierSearch}
                            onChange={(e) => setVerifierSearch(e.target.value)}
                            className="w-full px-2 py-1 text-sm border border-[var(--color-border)] rounded focus:outline-none focus:border-[var(--color-accent)]"
                            autoFocus
                          />
                        </div>
                        <div className="max-h-48 overflow-auto">
                          {members.length === 0 ? (
                            <div className="px-3 py-2 text-sm text-[var(--color-text-placeholder)]">No users found</div>
                          ) : (
                            members
                              .filter(m => !verifierIds.includes(m.id))
                              .map(m => (
                                <button
                                  key={m.id}
                                  onClick={() => handleVerifiersChange([...verifierIds, m.id])}
                                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--color-surface)] text-left"
                                >
                                  <Avatar name={m.name} size="sm" />
                                  <div className="flex flex-col">
                                    <span className="text-sm">{m.name}</span>
                                    <span className="text-xs text-[var(--color-text-secondary)]">{m.email}</span>
                                  </div>
                                </button>
                              ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wide mb-2">
                  Reporter
                </label>
                <div className="flex items-center gap-2">
                  <Avatar name={issue.reporter.name} size="sm" />
                  <span className="text-sm text-[var(--color-text-primary)]">{issue.reporter.name}</span>
                </div>
              </div>

              {canEdit && (
                <div onPaste={handlePasteUpload} tabIndex={0} className="outline-none">
                  <label className="block text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wide mb-2">
                    Upload Screenshot
                  </label>
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="flex items-center justify-center gap-2 w-full px-3 py-2 border border-dashed border-[var(--color-border)] rounded-md text-[var(--color-text-secondary)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] disabled:opacity-50"
                  >
                    {isUploading ? (
                      "Uploading..."
                    ) : (
                      <>
                        <Image className="w-4 h-4" />
                        Add screenshot
                      </>
                    )}
                  </button>
                  <p className="text-[10px] text-[var(--color-text-placeholder)] mt-1 text-center">or paste with Ctrl+V</p>
                </div>
              )}

              <div className="pt-4 border-t border-[var(--color-border)]">
                <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)] mb-2">
                  <Clock className="w-3 h-3" />
                  Created {formatDate(issue.createdAt)}
                </div>
                <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
                  <Clock className="w-3 h-3" />
                  Updated {formatRelativeTime(issue.updatedAt)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {lightboxImage && (
          <LightboxModal
            image={lightboxImage}
            images={lightboxImages}
            index={lightboxIndex}
            onClose={() => setLightboxImage(null)}
            onPrev={() => setLightboxIndex(Math.max(0, lightboxIndex - 1))}
            onNext={() => setLightboxIndex(Math.min(lightboxImages.length - 1, lightboxIndex + 1))}
          />
        )}
      </div>
    </div>
  );
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// Lightbox Modal
function LightboxModal({
  image,
  images,
  index,
  onClose,
  onPrev,
  onNext
}: {
  image: string;
  images: Attachment[];
  index: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  if (!image) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
      onClick={onClose}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute top-4 right-4 p-2 text-white hover:bg-white/20 rounded-full"
      >
        <X className="w-6 h-6" />
      </button>

      {images.length > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); onPrev(); }}
            className="absolute left-4 p-3 text-white hover:bg-white/20 rounded-full"
          >
            <ChevronLeft className="w-8 h-8" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onNext(); }}
            className="absolute right-4 p-3 text-white hover:bg-white/20 rounded-full"
          >
            <ChevronRight className="w-8 h-8" />
          </button>
        </>
      )}

      <div className="max-w-[90vw] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <img
          src={image}
          alt="Full size"
          className="max-w-full max-h-[85vh] object-contain rounded-lg"
        />
        {images.length > 1 && (
          <div className="text-center text-white mt-2 text-sm">
            {index + 1} / {images.length}
          </div>
        )}
      </div>
    </div>
  );
}
