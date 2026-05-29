import React, { useState, useEffect } from "react";
import { Button, Input } from "@/components/ui";
import { Sparkles, FileText, CheckCircle, XCircle, AlertCircle, Plus, Copy, X, Trash2, Edit2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface TestCaseResult {
  id: number;
  status: "Pass" | "Fail" | "Blocked";
  notes: string;
  createdAt: string;
  tester: { name: string };
}

interface TestCase {
  id: number;
  title: string;
  description: string;
  steps: string;
  expectedResult: string;
  createdAt: string;
  creator: { name: string; email: string };
  results: TestCaseResult[];
}

export function TestCasesWorkspace({ projectId }: { projectId: string }) {
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const { token } = useAuth();
  
  const [form, setForm] = useState({
    title: "",
    description: "",
    steps: "",
    expectedResult: "",
  });

  const [activeResultForm, setActiveResultForm] = useState<number | null>(null);
  const [resultForm, setResultForm] = useState({ status: "Pass", notes: "" });

  const [editingResultId, setEditingResultId] = useState<number | null>(null);
  const [editResultForm, setEditResultForm] = useState({ status: "Pass", notes: "" });

  const [showPromptModal, setShowPromptModal] = useState(false);
  const [featureDesc, setFeatureDesc] = useState("");
  
  const [includeGit, setIncludeGit] = useState(false);
  const [gitSince, setGitSince] = useState("");
  const [gitUntil, setGitUntil] = useState("");
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);

  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<{ imported: number, duplicates: any[] } | null>(null);
  const [selectedDuplicates, setSelectedDuplicates] = useState<number[]>([]);

  const [editingTestCase, setEditingTestCase] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ title: "", description: "", steps: "", expectedResult: "" });

  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [filterStatus, setFilterStatus] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortBy, filterStatus]);

  const generatePromptText = () => `
You are an expert QA Engineer. 
I need you to generate multiple comprehensive Test Cases for the following feature. Cover happy paths, edge cases, and failure states.

Please output the response as a JSON object containing an array of test cases exactly like this:
{
  "testCases": [
    {
      "title": "[A short clear title]",
      "description": "[A brief description of what this test verifies]",
      "steps": "[Numbered list of steps to execute]",
      "expectedResult": "[What is the expected outcome if successful]"
    }
  ]
}

Feature description:
${featureDesc}
`;

  const fetchTestCases = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/test-cases`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTestCases(data.testCases || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTestCases();
  }, [projectId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/projects/${projectId}/test-cases`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify(form)
      });
      if (res.ok) {
        setForm({ title: "", description: "", steps: "", expectedResult: "" });
        setShowCreate(false);
        fetchTestCases();
      } else if (res.status === 409) {
        const errData = await res.json().catch(() => ({}));
        if (confirm(errData.error + " Do you want to force add it anyway?")) {
          const forceRes = await fetch(`/api/projects/${projectId}/test-cases`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ ...form, force: true })
          });
          if (forceRes.ok) {
            setForm({ title: "", description: "", steps: "", expectedResult: "" });
            setShowCreate(false);
            fetchTestCases();
          } else {
            alert("Failed to force create test case");
          }
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(errData.error || "Failed to create test case");
      }
    } catch (e) {
      console.error(e);
      alert("Error creating test case");
    }
  };

  const handleSubmitResult = async (tcId: number, e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/projects/${projectId}/test-cases/${tcId}/results`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(resultForm)
      });
      if (res.ok) {
        setActiveResultForm(null);
        setResultForm({ status: "Pass", notes: "" });
        fetchTestCases();
      } else {
        alert("Failed to submit result");
      }
    } catch (e) {
      alert("Error submitting result");
    }
  };

  const handleEditResultSubmit = async (tcId: number, resId: number, e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/projects/${projectId}/test-cases/${tcId}/results/${resId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(editResultForm)
      });
      if (res.ok) {
        setEditingResultId(null);
        fetchTestCases();
      } else {
        alert("Failed to edit result.");
      }
    } catch (e) {
      alert("Error editing result.");
    }
  };

  const handleDeleteResult = async (tcId: number, resId: number) => {
    if (!confirm("Are you sure you want to delete this result?")) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/test-cases/${tcId}/results/${resId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        fetchTestCases();
      } else {
        alert("Failed to delete result.");
      }
    } catch (e) {
      alert("Error deleting result.");
    }
  };

  const handleDelete = async (tcId: number) => {
    if (!confirm("Are you sure you want to delete this test case?")) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/test-cases/${tcId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        fetchTestCases();
      } else {
        alert("Failed to delete test case.");
      }
    } catch (e) {
      alert("Error deleting test case.");
    }
  };

  const handleEditSubmit = async (tcId: number, e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/projects/${projectId}/test-cases/${tcId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(editForm)
      });
      if (res.ok) {
        setEditingTestCase(null);
        fetchTestCases();
      } else {
        alert("Failed to edit test case.");
      }
    } catch (e) {
      alert("Error editing test case.");
    }
  };

  const copyPrompt = async () => {
    if (!featureDesc.trim()) {
      alert("Please enter a feature description first.");
      return;
    }
    
    setIsGeneratingPrompt(true);
    let commitsContext = "";
    
    if (includeGit) {
      try {
        const params = new URLSearchParams();
        if (gitSince) params.append("since", gitSince);
        if (gitUntil) params.append("until", gitUntil);
        
        const url = `/api/projects/${projectId}/git-commits${params.toString() ? '?' + params.toString() : ''}`;
        
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }});
        if (res.ok) {
          const data = await res.json();
          const dateStr = gitSince || gitUntil ? `(Date range: ${gitSince || 'start'} to ${gitUntil || 'now'})` : '';
          commitsContext = `\n\nRecent Git Commits ${dateStr}\n(This is provided only for extra context to help you understand recent changes):\n${data.commits}`;
        }
      } catch (e) {
        console.error("Failed to fetch git commits", e);
      }
    }
    
    const finalPrompt = generatePromptText() + commitsContext;
    navigator.clipboard.writeText(finalPrompt);
    
    setIsGeneratingPrompt(false);
    alert("Prompt copied to clipboard! Paste this into Claude or ChatGPT.");
    setShowPromptModal(false);
    setFeatureDesc("");
    setIncludeGit(false);
    setGitSince("");
    setGitUntil("");
  };

  const handleImportAI = async () => {
    setIsImporting(true);
    try {
      const json = JSON.parse(importText);
      const tests = Array.isArray(json) ? json : (json.testCases || [json]);
      
      let importedCount = 0;
      const duplicateTests = [];
      for (const tc of tests) {
        if (!tc.title) continue;
        const res = await fetch(`/api/projects/${projectId}/test-cases`, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}` 
          },
          body: JSON.stringify({
            title: tc.title || "",
            description: tc.description || "",
            steps: tc.steps || "",
            expectedResult: tc.expectedResult || "",
          })
        });
        if (res.ok) importedCount++;
        else if (res.status === 409) {
          const errData = await res.json().catch(() => ({}));
          duplicateTests.push({ ...tc, existingTestCase: errData.existing, reason: errData.error });
        }
      }
      
      setShowImportModal(false);
      setImportText("");
      fetchTestCases();
      setImportSummary({ imported: importedCount, duplicates: duplicateTests });
      setSelectedDuplicates(duplicateTests.map((_, i) => i));
    } catch (e) {
      alert("Make sure you pasted valid JSON from the AI output");
    } finally {
      setIsImporting(false);
    }
  };

  const handleForceAddDuplicates = async () => {
    if (!importSummary) return;
    setIsImporting(true);
    let importedCount = 0;
    try {
      const testsToForceAdd = importSummary.duplicates.filter((_, i) => selectedDuplicates.includes(i));
      for (const tc of testsToForceAdd) {
        const res = await fetch(`/api/projects/${projectId}/test-cases`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            title: tc.title || "",
            description: tc.description || "",
            steps: tc.steps || "",
            expectedResult: tc.expectedResult || "",
            force: true
          })
        });
        if (res.ok) importedCount++;
      }
      fetchTestCases();
      
      const remainingDuplicates = importSummary.duplicates.filter((_, i) => !selectedDuplicates.includes(i));
      if (remainingDuplicates.length > 0) {
        setImportSummary({ imported: importSummary.imported + importedCount, duplicates: remainingDuplicates });
        setSelectedDuplicates([]);
      } else {
        setImportSummary(null);
      }
    } finally {
      setIsImporting(false);
    }
  };

  const filteredAndSorted = testCases
    .filter(tc => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = tc.title.toLowerCase().includes(q) || tc.description?.toLowerCase().includes(q) || tc.steps?.toLowerCase().includes(q);
      
      let matchesStatus = true;
      if (filterStatus !== "all") {
        const latestResult = tc.results?.[0]?.status;
        if (filterStatus === "untested") matchesStatus = !latestResult;
        else matchesStatus = latestResult?.toLowerCase() === filterStatus;
      }
      
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      if (sortBy === "newest") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sortBy === "oldest") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (sortBy === "title_asc") return a.title.localeCompare(b.title);
      if (sortBy === "title_desc") return b.title.localeCompare(a.title);
      return 0;
    });

  const totalPages = Math.ceil(filteredAndSorted.length / itemsPerPage);
  const paginatedTestCases = filteredAndSorted.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="flex flex-col h-full gap-4 relative">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-medium text-[var(--color-text-primary)]">Test Cases</h2>
          <p className="text-sm text-[var(--color-text-secondary)]">Manage, run, and auto-categorize QA test cases using AI.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setShowPromptModal(true)}>
            <Copy className="w-4 h-4 mr-2" />
            Copy AI Prompt
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setShowImportModal(true)}>
            <Sparkles className="w-4 h-4 mr-2" />
            Import from AI
          </Button>
          <Button onClick={() => setShowCreate(!showCreate)} size="sm" style={{ background: "var(--color-accent)", color: "white" }}>
            <Plus className="w-4 h-4 mr-2" />
            New Test Case
          </Button>
        </div>
      </div>

      {showPromptModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-[var(--color-bg)] rounded-xl p-5 shadow-lg w-full max-w-md border border-[var(--color-border)]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-[var(--color-text-primary)]">Generate AI Prompt</h3>
              <button onClick={() => setShowPromptModal(false)} className="text-[var(--color-text-placeholder)] hover:text-[var(--color-text-primary)]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-[var(--color-text-secondary)] mb-3">
              Describe the feature you want to test. We'll generate a prompt you can paste directly into an AI.
            </p>
            <textarea
              className="w-full h-32 rounded-lg border border-[var(--color-border)] p-3 text-sm focus:outline-none focus:border-[var(--color-accent)] mb-3"
              placeholder="e.g. As a user, I want to be able to reset my password via email link..."
              value={featureDesc}
              onChange={(e) => setFeatureDesc(e.target.value)}
            />
            
            <div className="mb-4 space-y-3">
              <label className="flex items-center gap-2 text-sm text-[var(--color-text-primary)] cursor-pointer">
                <input 
                  type="checkbox" 
                  className="rounded border-[var(--color-border)] accent-[var(--color-accent)]"
                  checked={includeGit}
                  onChange={(e) => setIncludeGit(e.target.checked)}
                />
                Include Git Commits as Context
              </label>
              
              {includeGit && (
                <div className="flex gap-3 pl-6">
                  <div className="flex-1">
                    <label className="block text-xs text-[var(--color-text-secondary)] mb-1">Since (Optional)</label>
                    <Input type="date" value={gitSince} onChange={(e) => setGitSince(e.target.value)} />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs text-[var(--color-text-secondary)] mb-1">Until (Optional)</label>
                    <Input type="date" value={gitUntil} onChange={(e) => setGitUntil(e.target.value)} />
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowPromptModal(false)}>Cancel</Button>
              <Button style={{ background: "var(--color-accent)", color: "white", opacity: isGeneratingPrompt ? 0.7 : 1 }} onClick={copyPrompt} disabled={isGeneratingPrompt}>
                <Copy className="w-4 h-4 mr-2" />
                {isGeneratingPrompt ? "Gathering Context..." : "Copy Prompt"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-[var(--color-bg)] rounded-xl p-5 shadow-lg w-full max-w-2xl border border-[var(--color-border)]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-[var(--color-text-primary)]">Import from AI</h3>
              <button onClick={() => setShowImportModal(false)} className="text-[var(--color-text-placeholder)] hover:text-[var(--color-text-primary)]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-[var(--color-text-secondary)] mb-3">
              Paste the JSON response from Claude or ChatGPT here.
            </p>
            <textarea
              className="w-full h-64 font-mono rounded-lg border border-[var(--color-border)] p-3 text-sm focus:outline-none focus:border-[var(--color-accent)] mb-3"
              placeholder='{\n  "testCases": [\n    { "title": "..." }\n  ]\n}'
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowImportModal(false)} disabled={isImporting}>Cancel</Button>
              <Button style={{ background: "var(--color-accent)", color: "white", opacity: isImporting ? 0.7 : 1 }} onClick={handleImportAI} disabled={isImporting}>
                {isImporting ? <span className="animate-pulse">Importing...</span> : <><Sparkles className="w-4 h-4 mr-2" />Import JSON</>}
              </Button>
            </div>
          </div>
        </div>
      )}

      {importSummary && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--color-bg)] rounded-xl p-5 shadow-lg w-full max-w-5xl border border-[var(--color-border)] flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between mb-3 shrink-0">
              <h3 className="font-semibold text-[var(--color-text-primary)]">Import Results</h3>
              <button onClick={() => setImportSummary(null)} className="text-[var(--color-text-placeholder)] hover:text-[var(--color-text-primary)]" disabled={isImporting}>
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="mb-4 flex-1 flex flex-col min-h-0">
              <p className="text-sm text-[var(--color-text-primary)] mb-2 shrink-0">
                Successfully imported <strong>{importSummary.imported}</strong> test case(s).
              </p>
              {importSummary.duplicates.length > 0 && (
                <div className="bg-[var(--color-surface)] border border-yellow-500/30 text-[var(--color-text-primary)] p-3 md:p-5 rounded-lg text-sm mt-3 overflow-y-auto flex-1 min-h-0">
                  <p className="font-medium flex items-center gap-1 text-yellow-500 mb-2 shrink-0"><AlertCircle className="w-4 h-4" /> {importSummary.duplicates.length} duplicate(s) detected</p>
                  <p className="text-xs mb-3 text-[var(--color-text-secondary)] shrink-0">Select the test cases you wish to force add anyway:</p>
                  <div className="space-y-2 mt-2">
                    {importSummary.duplicates.map((dup, idx) => (
                      <label key={idx} className="flex items-start gap-3 p-3 bg-[var(--color-bg)] rounded-lg border border-[var(--color-border)] shadow-sm transition-colors cursor-pointer hover:border-[var(--color-accent)]/50">
                        <input 
                          type="checkbox" 
                          className="mt-1 rounded border-[var(--color-border)] accent-[var(--color-accent)]"
                          checked={selectedDuplicates.includes(idx)} 
                          onChange={(e) => {
                            if (e.target.checked) setSelectedDuplicates([...selectedDuplicates, idx]);
                            else setSelectedDuplicates(selectedDuplicates.filter(i => i !== idx));
                          }} 
                        />
                        <div className="flex-1 min-w-0 flex flex-col gap-2">
                          <div className="flex flex-col md:flex-row gap-3 w-full">
                            <div className="flex-1 min-w-0">
                              <span className="text-[10px] font-bold text-[var(--color-accent)] uppercase tracking-wider mb-1 block">New Import</span>
                              <p className="font-medium text-xs truncate" title={dup.title}>{dup.title}</p>
                              {dup.description && <p className="text-[10px] text-[var(--color-text-secondary)] line-clamp-2 mt-0.5" title={dup.description}>{dup.description}</p>}
                            </div>
                            {dup.existingTestCase && (
                              <div className="flex-1 min-w-0 pl-3 md:border-l border-[var(--color-border)]">
                                <span className="text-[10px] font-bold text-[var(--color-text-placeholder)] uppercase tracking-wider mb-1 block">Matched Existing</span>
                                <p className="font-medium text-xs text-[var(--color-text-secondary)] truncate" title={dup.existingTestCase.title}>{dup.existingTestCase.title}</p>
                                {dup.existingTestCase.description && <p className="text-[10px] text-[var(--color-text-placeholder)] line-clamp-2 mt-0.5" title={dup.existingTestCase.description}>{dup.existingTestCase.description}</p>}
                              </div>
                            )}
                          </div>
                          {dup.reason && (
                            <p className="text-[10px] text-yellow-600/80 italic mt-1 border-t border-[var(--color-border)] pt-1">{dup.reason}</p>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 shrink-0 mt-4">
              <Button variant="secondary" onClick={() => setImportSummary(null)} disabled={isImporting}>Close</Button>
              {importSummary.duplicates.length > 0 && selectedDuplicates.length > 0 && (
                <Button 
                  style={{ background: "var(--color-surface)", color: "var(--color-text-primary)", border: "1px solid var(--color-border)", opacity: isImporting ? 0.7 : 1 }} 
                  onClick={handleForceAddDuplicates} 
                  disabled={isImporting}
                >
                  {isImporting ? <span className="animate-pulse">Adding...</span> : `Force Add (${selectedDuplicates.length})`}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {showCreate && (
        <div className="bg-[var(--color-bg)] p-5 rounded-xl border border-[var(--color-border)] mb-6 shadow-sm max-w-3xl">
          <h3 className="font-medium text-[var(--color-text-primary)] mb-4">Create New Test Case</h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <Input 
              label="Test Case Title"
              placeholder="e.g., User can reset password" 
              value={form.title} 
              onChange={e => setForm({...form, title: e.target.value})} 
              required
            />
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "#1c1c1e", fontFamily: "DM Sans, sans-serif" }}>
                Description
              </label>
              <textarea
                placeholder="What does this test verify?"
                className="w-full px-3 py-2 text-sm rounded-md border transition-all duration-150 placeholder:text-[#a5a8b5] focus:outline-none focus:border-[#5b76fe]"
                style={{ background: "#ffffff", borderColor: "#e9eaef", fontFamily: "DM Sans, sans-serif", color: "#1c1c1e" }}
                value={form.description}
                onChange={e => setForm({...form, description: e.target.value})}
                rows={2}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "#1c1c1e", fontFamily: "DM Sans, sans-serif" }}>
                Steps to Reproduce
              </label>
              <textarea
                placeholder="1. Go to login&#10;2. Click forgot password..."
                className="w-full px-3 py-2 text-sm rounded-md border transition-all duration-150 placeholder:text-[#a5a8b5] focus:outline-none focus:border-[#5b76fe]"
                style={{ background: "#ffffff", borderColor: "#e9eaef", fontFamily: "DM Sans, sans-serif", color: "#1c1c1e" }}
                value={form.steps}
                onChange={e => setForm({...form, steps: e.target.value})}
                rows={4}
              />
            </div>
            <Input 
              label="Expected Result"
              placeholder="e.g., A password reset email is sent." 
              value={form.expectedResult} 
              onChange={e => setForm({...form, expectedResult: e.target.value})} 
            />
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button type="submit" style={{ background: "var(--color-accent)", color: "white" }}>Save Test Case</Button>
            </div>
          </form>
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-3 mb-2">
        <Input 
          placeholder="Search test cases..." 
          className="flex-1"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
        <select 
          className="border border-[var(--color-border)] rounded-md px-3 py-2 text-sm bg-[var(--color-bg)] text-[var(--color-text-primary)]"
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
        >
          <option value="all">All Statuses</option>
          <option value="pass">Passing</option>
          <option value="fail">Failing</option>
          <option value="blocked">Blocked</option>
          <option value="untested">Untested</option>
        </select>
        <select 
          className="border border-[var(--color-border)] rounded-md px-3 py-2 text-sm bg-[var(--color-bg)] text-[var(--color-text-primary)]"
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
        >
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
          <option value="title_asc">Title A-Z</option>
          <option value="title_desc">Title Z-A</option>
        </select>
      </div>

      <div className="space-y-4">
        {paginatedTestCases.map((tc) => (
          <div key={tc.id} className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
            {editingTestCase === tc.id ? (
              <form onSubmit={(e) => handleEditSubmit(tc.id, e)} className="space-y-4">
                <Input 
                  label="Test Case Title"
                  value={editForm.title} 
                  onChange={e => setEditForm({...editForm, title: e.target.value})} 
                  required
                />
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--color-text-primary)", fontFamily: "DM Sans, sans-serif" }}>Description</label>
                  <textarea
                    className="w-full px-3 py-2 text-sm rounded-md border transition-all duration-150 focus:outline-none focus:border-[var(--color-accent)] bg-[var(--color-bg)] border-[var(--color-border)] text-[var(--color-text-primary)]"
                    value={editForm.description}
                    onChange={e => setEditForm({...editForm, description: e.target.value})}
                    rows={2}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--color-text-primary)", fontFamily: "DM Sans, sans-serif" }}>Steps to Reproduce</label>
                  <textarea
                    className="w-full px-3 py-2 text-sm rounded-md border transition-all duration-150 focus:outline-none focus:border-[var(--color-accent)] bg-[var(--color-bg)] border-[var(--color-border)] text-[var(--color-text-primary)]"
                    value={editForm.steps}
                    onChange={e => setEditForm({...editForm, steps: e.target.value})}
                    rows={4}
                  />
                </div>
                <Input 
                  label="Expected Result"
                  value={editForm.expectedResult} 
                  onChange={e => setEditForm({...editForm, expectedResult: e.target.value})} 
                />
                <div className="flex justify-end gap-3 pt-2">
                  <Button type="button" variant="secondary" onClick={() => setEditingTestCase(null)}>Cancel</Button>
                  <Button type="submit" style={{ background: "var(--color-accent)", color: "white" }}>Save Changes</Button>
                </div>
              </form>
            ) : (
              <>
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-medium text-[var(--color-text-primary)] text-lg flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[var(--color-text-secondary)]" />
                    {tc.title}
                  </h3>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-[var(--color-text-placeholder)]">By {tc.creator?.name}</span>
                    <button 
                      onClick={() => {
                        setEditingTestCase(tc.id);
                        setEditForm({ title: tc.title, description: tc.description || "", steps: tc.steps || "", expectedResult: tc.expectedResult || "" });
                      }} 
                      className="text-[var(--color-text-placeholder)] hover:text-blue-500 transition-colors p-1"
                      title="Edit Test Case"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDelete(tc.id)} 
                      className="text-[var(--color-text-placeholder)] hover:text-red-500 transition-colors p-1"
                      title="Delete Test Case"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {tc.description && <p className="text-sm text-[var(--color-text-secondary)] mb-3">{tc.description}</p>}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="bg-[var(--color-surface)] p-3 rounded-lg">
                    <span className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase block mb-1">Steps</span>
                    <p className="text-sm text-[var(--color-text-primary)] whitespace-pre-wrap">{tc.steps}</p>
                  </div>
                  <div className="bg-[var(--color-surface)] p-3 rounded-lg border border-[var(--color-accent)]/20">
                    <span className="text-xs font-semibold text-[var(--color-accent)] uppercase block mb-1">Expected Result</span>
                    <p className="text-sm text-[var(--color-text-primary)]">{tc.expectedResult}</p>
                  </div>
                </div>

                <div className="border-t border-[var(--color-border)] pt-3 mt-2">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium text-[var(--color-text-primary)]">QA Results ({tc.results.length})</h4>
                    <Button variant="secondary" size="sm" onClick={() => setActiveResultForm(tc.id)}>
                      Add Result
                    </Button>
                  </div>

                  {activeResultForm === tc.id && (
                    <form onSubmit={(e) => handleSubmitResult(tc.id, e)} className="mb-3 bg-[var(--color-surface)] p-3 rounded-lg border border-[var(--color-border)]">
                      <div className="flex gap-2 mb-2">
                        <select 
                          className="border border-[var(--color-border)] rounded-md p-1.5 text-sm bg-[var(--color-bg)]"
                          value={resultForm.status}
                          onChange={e => setResultForm({...resultForm, status: e.target.value})}
                        >
                          <option value="Pass">Pass</option>
                          <option value="Fail">Fail</option>
                          <option value="Blocked">Blocked</option>
                        </select>
                        <Input 
                          placeholder="Optional notes..." 
                          className="flex-1"
                          value={resultForm.notes}
                          onChange={e => setResultForm({...resultForm, notes: e.target.value})}
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="secondary" size="sm" onClick={() => setActiveResultForm(null)}>Cancel</Button>
                        <Button type="submit" size="sm" style={{ background: "var(--color-accent)", color: "white" }}>Save Result</Button>
                      </div>
                    </form>
                  )}

                  {tc.results.length === 0 ? (
                    <p className="text-xs text-[var(--color-text-placeholder)]">No results recorded yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {tc.results.map((res) => (
                        <React.Fragment key={res.id}>
                          {editingResultId === res.id ? (
                            <form onSubmit={(e) => handleEditResultSubmit(tc.id, res.id, e)} className="flex items-center gap-2 text-sm bg-[var(--color-surface)] p-2 rounded-lg border border-[var(--color-border)]">
                              <select 
                                className="border border-[var(--color-border)] rounded-md p-1.5 text-sm bg-[var(--color-bg)]"
                                value={editResultForm.status}
                                onChange={e => setEditResultForm({...editResultForm, status: e.target.value})}
                              >
                                <option value="Pass">Pass</option>
                                <option value="Fail">Fail</option>
                                <option value="Blocked">Blocked</option>
                              </select>
                              <Input 
                                placeholder="Optional notes..." 
                                className="flex-1 min-w-[120px]"
                                value={editResultForm.notes}
                                onChange={e => setEditResultForm({...editResultForm, notes: e.target.value})}
                              />
                              <div className="flex items-center gap-1 shrink-0">
                                <Button type="button" variant="secondary" size="sm" onClick={() => setEditingResultId(null)}>Cancel</Button>
                                <Button type="submit" size="sm" style={{ background: "var(--color-accent)", color: "white" }}>Save</Button>
                              </div>
                            </form>
                          ) : (
                            <div className="flex items-center gap-2 text-sm bg-[var(--color-surface)] p-2 rounded-lg group">
                              {res.status === "Pass" && <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />}
                              {res.status === "Fail" && <XCircle className="w-4 h-4 text-red-500 shrink-0" />}
                              {res.status === "Blocked" && <AlertCircle className="w-4 h-4 text-yellow-500 shrink-0" />}
                              <span className="font-medium text-[var(--color-text-primary)] whitespace-nowrap">{res.tester?.name}</span>
                              <span className="text-[var(--color-text-secondary)] whitespace-nowrap">- {res.status}</span>
                              {res.notes && <span className="text-[var(--color-text-placeholder)] italic text-xs ml-2 truncate flex-1">{res.notes}</span>}
                              {!res.notes && <div className="flex-1"></div>}
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                <button 
                                  onClick={() => { setEditingResultId(res.id); setEditResultForm({ status: res.status, notes: res.notes || "" }); }} 
                                  className="text-[var(--color-text-placeholder)] hover:text-blue-500 transition-colors p-1"
                                  title="Edit Result"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button 
                                  onClick={() => handleDeleteResult(tc.id, res.id)} 
                                  className="text-[var(--color-text-placeholder)] hover:text-red-500 transition-colors p-1"
                                  title="Delete Result"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        ))}

        {testCases.length > 0 && paginatedTestCases.length === 0 && !isLoading && (
          <div className="text-center py-12 text-[var(--color-text-secondary)]">
            <p>No test cases match your search criteria.</p>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-4 mt-6">
            <Button variant="secondary" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Previous</Button>
            <span className="text-sm text-[var(--color-text-secondary)]">Page {currentPage} of {totalPages}</span>
            <Button variant="secondary" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next</Button>
          </div>
        )}
      </div>
    </div>
  );
}
