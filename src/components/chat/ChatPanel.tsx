"use client";

import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, ChevronDown, ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useBreakpoint } from "@/hooks/useBreakpoint";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Project {
  id: number;
  name: string;
  key: string;
}

export function ChatPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { token } = useAuth();
  const breakpoint = useBreakpoint();
  const isMobile = breakpoint === "mobile";

  useEffect(() => {
    if (isOpen && token) {
      fetchProjects();
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, token]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchProjects = async () => {
    try {
      const res = await fetch("/api/projects", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects || []);
      }
    } catch (error) {
      console.error("Fetch projects error:", error);
    }
  };

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMessage: Message = { role: "user", content: trimmed };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: trimmed,
          projectId: selectedProjectId || undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [...prev, { role: "assistant", content: data.reply }]);
      } else {
        const data = await res.json();
        setMessages(prev => [...prev, { role: "assistant", content: data.error || "Sorry, I encountered an error." }]);
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: "assistant", content: "Network error. Please try again." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-[var(--color-accent)] text-white rounded-full shadow-lg hover:shadow-xl transition-all flex items-center justify-center hover:scale-105"
        title="Open AI Assistant"
      >
        <MessageCircle className="w-6 h-6" />
      </button>
    );
  }

  const panelClasses = isMobile
    ? "fixed inset-0 z-50 bg-white flex flex-col"
    : "fixed bottom-6 right-6 z-50 w-[400px] h-[500px] bg-white border border-[var(--color-border)] rounded-xl shadow-2xl flex flex-col";

  return (
    <div className={panelClasses}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] rounded-t-xl shrink-0">
        <div className="flex items-center gap-2">
          {isMobile && (
            <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-white rounded">
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <MessageCircle className="w-5 h-5 text-[var(--color-accent)]" />
          <h3 className="font-medium text-sm text-[var(--color-text-primary)]">BugBase Assistant</h3>
        </div>
        {!isMobile && (
          <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-white rounded transition-colors">
            <X className="w-5 h-5 text-[var(--color-text-secondary)]" />
          </button>
        )}
      </div>

      {/* Project Selector */}
      <div className="px-4 py-2 border-b border-[var(--color-border)] shrink-0">
        <select
          value={selectedProjectId}
          onChange={(e) => setSelectedProjectId(e.target.value)}
          className="w-full px-2 py-1.5 text-sm bg-white border border-[var(--color-border)] rounded-md focus:outline-none focus:border-[var(--color-accent)]"
        >
          <option value="">All projects</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-sm text-[var(--color-text-secondary)] mt-8">
            <MessageCircle className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p>Ask me about your projects!</p>
            <p className="text-xs mt-1 opacity-70">e.g. "How many open bugs?" or "What's left to do?"</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] px-3 py-2 rounded-lg text-sm ${
              msg.role === "user"
                ? "bg-[var(--color-accent)] text-white"
                : "bg-[var(--color-surface)] text-[var(--color-text-primary)]"
            }`}>
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-[var(--color-surface)] px-3 py-2 rounded-lg text-sm">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-[var(--color-text-secondary)] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 bg-[var(--color-text-secondary)] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 bg-[var(--color-text-secondary)] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-[var(--color-border)] shrink-0">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your projects..."
            className="flex-1 px-3 py-2 text-sm bg-white border border-[var(--color-border)] rounded-lg focus:outline-none focus:border-[var(--color-accent)]"
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="px-3 py-2 bg-[var(--color-accent)] text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
