"use client";

import { useState } from "react";
import { Button, Input, Modal } from "@/components/ui";
import { Plus, Trash2 } from "lucide-react";

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

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleAddItem = () => {
    setFormData(prev => ({
      ...prev,
      checklistItems: [...prev.checklistItems, ""]
    }));
  };

  const handleRemoveItem = (index: number) => {
    if (formData.checklistItems.length <= 1) return;
    setFormData(prev => ({
      ...prev,
      checklistItems: prev.checklistItems.filter((_, i) => i !== index)
    }));
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

    // Validate
    if (!formData.title.trim()) {
      setError("Title is required");
      return;
    }

    if (formData.checklistItems.some(item => !item.trim())) {
      setError("All checklist items must have content");
      return;
    }

    onCreate(formData);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create New Milestone">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 text-sm text-[var(--color-danger)] bg-red-50 rounded-md border border-red-100">
            {error}
          </div>
        )}

        <Input
          id="title"
          label="Title"
          placeholder="Milestone title"
          value={formData.title}
          onChange={(e) => handleInputChange("title", e.target.value)}
          required
        />

        <div>
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
            Description
          </label>
          <textarea
            className="w-full px-3 py-2 text-sm bg-white border border-[var(--color-border)] rounded-md focus:outline-none focus:border-[var(--color-accent)] resize-none"
            placeholder="Describe the milestone..."
            rows={3}
            value={formData.description}
            onChange={(e) => handleInputChange("description", e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
            Checklist Items
          </label>
          <div className="space-y-2">
            {formData.checklistItems.map((item, index) => (
              <div key={index} className="flex gap-2">
                <input
                  type="text"
                  className="flex-grow px-3 py-2 text-sm bg-white border border-[var(--color-border)] rounded-md focus:outline-none focus:border-[var(--color-accent)]"
                  placeholder={`Task ${index + 1}`}
                  value={item}
                  onChange={(e) => handleItemChange(index, e.target.value)}
                  required
                />
                {formData.checklistItems.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(index)}
                    className="px-3 py-2 text-sm text-[var(--color-danger)] hover:bg-red-50 rounded-md"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            <Button
              type="button"
              variant="secondary"
              onClick={handleAddItem}
              className="w-full flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Checklist Item
            </Button>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={isCreating}>
            {isCreating ? "Creating..." : "Create Milestone"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
