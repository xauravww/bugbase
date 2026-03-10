"use client";

import { useState } from "react";
import { Button, Input, Modal } from "@/components/ui";
import { Plus, Trash2, Sparkles, Wand2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface CreateMilestoneModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: { title: string; description?: string; checklistItems: string[] }) => void;
  isCreating?: boolean;
}

export function CreateMilestoneModal({
  isOpen,
  onClose,
  onCreate,
  isCreating = false
}: CreateMilestoneModalProps) {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    checklistItems: [""],
  });
  const [error, setError] = useState("");
  const [refiningField, setRefiningField] = useState<string | null>(null);
  const { token } = useAuth();

  const handleRefine = async (field: "title" | "description") => {
    const content = formData[field];
    if (!content) return;
    setRefiningField(field);
    try {
      const res = await fetch("/api/ai/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content, field: `milestone_${field}` }),
      });
      if (res.ok) {
        const data = await res.json();
        setFormData(prev => ({ ...prev, [field]: data.refinedContent }));
      } else {
        const data = await res.json();
        alert(data.error || "Failed to refine content");
      }
    } catch (error) {
      console.error("AI Refine Error:", error);
      alert("Failed to refine content");
    } finally {
      setRefiningField(null);
    }
  };

  const handleSuggest = async (field: "title" | "description") => {
    setRefiningField(field);
    try {
      const res = await fetch("/api/ai/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          field: `milestone_${field}`,
          mode: "suggest",
          context: { title: formData.title, description: formData.description, checklistItems: formData.checklistItems.join(", ") }
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setFormData(prev => ({ ...prev, [field]: data.refinedContent }));
      } else {
        const data = await res.json();
        alert(data.error || "Failed to suggest content");
      }
    } catch (error) {
      console.error("AI Suggest Error:", error);
      alert("Failed to suggest content");
    } finally {
      setRefiningField(null);
    }
  };

  const handleAddItem = () => {
    setFormData(prev => ({ ...prev, checklistItems: [...prev.checklistItems, ""] }));
  };

  const handleRemoveItem = (index: number) => {
    if (formData.checklistItems.length <= 1) return;
    setFormData(prev => ({ ...prev, checklistItems: prev.checklistItems.filter((_, i) => i !== index) }));
  };

  const handleItemChange = (index: number, value: string) => {
    setFormData(prev => {
      const newItems = [...prev.checklistItems];
      newItems[index] = value;
      return { ...prev, checklistItems: newItems };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!formData.title.trim()) {
      setError("Title is required");
      return;
    }
    const nonEmptyItems = formData.checklistItems.filter(item => item.trim());
    onCreate({
      title: formData.title,
      description: formData.description || undefined,
      checklistItems: nonEmptyItems,
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Test Checklist">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 text-sm text-[var(--color-danger)] bg-red-50 rounded-md border border-red-100">
            {error}
          </div>
        )}

        <div className="relative">
          <Input id="title" label="Title" placeholder="e.g. Sprint 12 - Login Flow Testing" value={formData.title}
            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))} required />
          {formData.title ? (
            <button type="button" onClick={() => handleRefine("title")} disabled={refiningField === "title"}
              className="absolute right-2 top-9 p-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] disabled:opacity-50 touch-target z-10" title="AI Refine">
              <Sparkles className={`w-4 h-4 ${refiningField === "title" ? "animate-pulse" : ""}`} />
            </button>
          ) : (
            <button type="button" onClick={() => handleSuggest("title")} disabled={refiningField === "title"}
              className="absolute right-2 top-9 p-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] disabled:opacity-50 touch-target z-10" title="AI Suggest">
              <Wand2 className={`w-4 h-4 ${refiningField === "title" ? "animate-pulse" : ""}`} />
            </button>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-sm font-medium text-[var(--color-text-primary)]">Description</label>
            {formData.description ? (
              <button type="button" onClick={() => handleRefine("description")} disabled={refiningField === "description"}
                className="flex items-center gap-1 text-xs text-[var(--color-accent)] hover:underline disabled:opacity-50">
                <Sparkles className={`w-3 h-3 ${refiningField === "description" ? "animate-pulse" : ""}`} />
                {refiningField === "description" ? "Refining..." : "AI Refine"}
              </button>
            ) : (
              <button type="button" onClick={() => handleSuggest("description")} disabled={refiningField === "description"}
                className="flex items-center gap-1 text-xs text-[var(--color-accent)] hover:underline disabled:opacity-50">
                <Wand2 className={`w-3 h-3 ${refiningField === "description" ? "animate-pulse" : ""}`} />
                {refiningField === "description" ? "Suggesting..." : "AI Suggest"}
              </button>
            )}
          </div>
          <textarea className="w-full px-3 py-2 text-sm bg-white border border-[var(--color-border)] rounded-md focus:outline-none focus:border-[var(--color-accent)] resize-none"
            placeholder="What is being tested and why..." rows={3} value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))} />
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">What to Test</label>
          <div className="space-y-2">
            {formData.checklistItems.map((item, index) => (
              <div key={index} className="flex gap-2">
                <div className="flex items-center justify-center w-6 h-9 text-xs text-[var(--color-text-secondary)]">
                  {index + 1}.
                </div>
                <input type="text"
                  className="flex-grow px-3 py-2 text-sm bg-white border border-[var(--color-border)] rounded-md focus:outline-none focus:border-[var(--color-accent)]"
                  placeholder={`Test step ${index + 1}...`} value={item} onChange={(e) => handleItemChange(index, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); handleAddItem(); }
                  }}
                />
                {formData.checklistItems.length > 1 && (
                  <button type="button" onClick={() => handleRemoveItem(index)}
                    className="px-2 py-2 text-[var(--color-text-secondary)] hover:text-[var(--color-danger)] rounded-md transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            <button type="button" onClick={handleAddItem}
              className="w-full flex items-center justify-center gap-2 py-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] border border-dashed border-[var(--color-border)] rounded-md hover:border-[var(--color-accent)] transition-colors">
              <Plus className="w-4 h-4" /> Add test step
            </button>
          </div>
          <p className="text-xs text-[var(--color-text-secondary)] mt-1">Press Enter to quickly add a new step</p>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={isCreating}>
            {isCreating ? "Creating..." : "Create Checklist"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
