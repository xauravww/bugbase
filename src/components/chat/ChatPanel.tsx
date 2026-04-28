"use client";

import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, ArrowLeft, AtSign, RefreshCw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { MentionSelect } from "@/components/ui/MentionSelect";
import ReactMarkdown from "react-markdown";

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

  const projectOptions = [
    { value: "", label: "All Projects" },
    ...projects.map(p => ({ value: p.id.toString(), label: `${p.name} (${p.key})` }))
  ];

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg hover:shadow-xl transition-all flex items-center justify-center hover:scale-105"
        style={{ background: "#5b76fe", color: "#ffffff" }}
        title="Open AI Assistant"
      >
        <MessageCircle className="w-6 h-6" />
      </button>
    );
  }

  const panelClasses = isMobile
    ? "fixed inset-0 z-50 bg-white flex flex-col"
    : "fixed bottom-6 right-6 z-50 w-[380px] h-[520px] rounded-2xl shadow-2xl flex flex-col overflow-hidden";

  return (
    <div className={panelClasses} style={{ background: "#ffffff", border: "1px solid #e9eaef" }}>
      <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ background: "#fafafa", borderBottom: "1px solid #e9eaef" }}>
        <div className="flex items-center gap-2">
          {isMobile && (
            <button onClick={() => setIsOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              <ArrowLeft className="w-5 h-5" style={{ color: "#555a6a" }} />
            </button>
          )}
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#5b76fe" }}>
            <MessageCircle className="w-5 h-5" style={{ color: "#ffffff" }} />
          </div>
          <h3 className="font-medium text-sm" style={{ color: "#1c1c1e", fontFamily: "DM Sans, sans-serif" }}>BugBase Assistant</h3>
        </div>
        {!isMobile && (
          <button onClick={() => setIsOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5" style={{ color: "#555a6a" }} />
          </button>
        )}
      </div>

      <div className="px-3 py-2.5 shrink-0" style={{ borderBottom: "1px solid #e9eaef" }}>
        <MentionSelect
          options={projectOptions}
          value={selectedProjectId}
          onChange={setSelectedProjectId}
          placeholder="Filter by project..."
          emptyMessage="No projects found"
        />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-sm mt-8 px-4">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center" style={{ background: "#f7f6f3" }}>
              <AtSign className="w-8 h-8" style={{ color: "#5b76fe" }} />
            </div>
            <p className="font-medium mb-1" style={{ color: "#1c1c1e", fontFamily: "DM Sans, sans-serif" }}>Ask me anything!</p>
            <p style={{ color: "#555a6a", fontFamily: "DM Sans, sans-serif" }}>Try "@projectname" to ask about a specific project</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {["How many open bugs?", "Show recent issues", "What's in progress?"].map((q, i) => (
                <button
                  key={i}
                  onClick={() => setInput(q)}
                  className="px-3 py-1.5 text-xs rounded-full transition-colors"
                  style={{ background: "#f7f6f3", color: "#555a6a", fontFamily: "DM Sans, sans-serif" }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className="max-w-[85%] px-4 py-3 rounded-2xl text-sm"
              style={msg.role === "user" 
                ? { background: "#5b76fe", color: "#ffffff", fontFamily: "DM Sans, sans-serif" } 
                : { background: "#f7f6f3", color: "#1c1c1e", fontFamily: "DM Sans, sans-serif" }}
            >
              {msg.role === "user" ? (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              ) : (
                <ReactMarkdown
                  components={{
                    p: ({ children }) => <p className="my-1">{children}</p>,
                    ul: ({ children }) => <ul className="my-1 list-disc list-inside">{children}</ul>,
                    ol: ({ children }) => <ol className="my-1 list-decimal list-inside">{children}</ol>,
                    li: ({ children }) => <li className="my-0">{children}</li>,
                    code: ({ children }) => <code className="bg-gray-200 px-1 rounded text-xs">{children}</code>,
                    pre: ({ children }) => <pre className="bg-gray-800 text-white p-2 rounded-lg my-2 text-xs overflow-x-auto">{children}</pre>,
                  }}
                >
                  {msg.content}
                </ReactMarkdown>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="px-4 py-3 rounded-2xl" style={{ background: "#f7f6f3" }}>
              <div className="flex gap-1.5">
                <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: "#5b76fe", animationDelay: "0ms" }} />
                <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: "#5b76fe", animationDelay: "150ms" }} />
                <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: "#5b76fe", animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="px-4 py-3 shrink-0" style={{ borderTop: "1px solid #e9eaef", background: "#fafafa" }}>
        <div className="flex gap-2 items-center">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your projects..."
            className="flex-1 px-4 py-2.5 text-sm rounded-xl border transition-all focus:outline-none focus:border-[#5b76fe]"
            style={{ background: "#ffffff", borderColor: "#e9eaef", fontFamily: "DM Sans, sans-serif" }}
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="w-10 h-10 rounded-xl flex items-center justify-center transition-all disabled:opacity-50"
            style={{ background: "#5b76fe", color: "#ffffff" }}
          >
            {isLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}