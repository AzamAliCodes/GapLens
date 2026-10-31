'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useGapLensStore } from '@/lib/store';
import { Mode, SourceInput } from '@/lib/types';
import { NBButton } from '@/components/ui/NBButton';
import { NBCard } from '@/components/ui/NBCard';
import { NBInput, NBTextarea } from '@/components/ui/NBInput';
import { Logo } from '@/components/ui/Logo';
import {
  Sparkles,
  Link as LinkIcon,
  FileText,
  Search,
  Trash2,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Plus,
  Scale,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const { setIsAnalyzing } = useGapLensStore();

  // Mode Selection: 'answer_audit' (primary) or 'research_gaps' (secondary)
  const [mode, setMode] = useState<Mode>('answer_audit');

  // Input states
  const [question, setQuestion] = useState('');
  const [candidateAnswer, setCandidateAnswer] = useState('');
  const [sources, setSources] = useState<SourceInput[]>([]);

  // Source entry sub-mode
  const [inputMode, setInputMode] = useState<'url' | 'paste' | 'suggest'>('url');
  const [newUrl, setNewUrl] = useState('');
  const [newUrlLabel, setNewUrlLabel] = useState('');
  const [pastedText, setPastedText] = useState('');
  const [pastedLabel, setPastedLabel] = useState('');

  // Source suggestion state
  const [suggestQuery, setSuggestQuery] = useState('');
  const [suggestResults, setSuggestResults] = useState<{ title: string; url: string; snippet: string; domain: string }[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sampleLoadedNotice, setSampleLoadedNotice] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);

  const handleAddUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl.trim()) return;

    if (sources.length >= 6) {
      setErrorMsg('Maximum 6 sources allowed.');
      return;
    }

    try {
      new URL(newUrl.trim());
    } catch {
      setErrorMsg('Please enter a valid URL (starting with http:// or https://)');
      return;
    }

    setSources([
      ...sources,
      { url: newUrl.trim(), label: newUrlLabel.trim() || undefined },
    ]);
    setNewUrl('');
    setNewUrlLabel('');
    setErrorMsg(null);
  };

  const handleAddPastedText = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pastedText.trim()) return;

    if (sources.length >= 6) {
      setErrorMsg('Maximum 6 sources allowed.');
      return;
    }

    setSources([
      ...sources,
      {
        text: pastedText.trim(),
        label: pastedLabel.trim() || `Source Document ${sources.length + 1}`,
      },
    ]);
    setPastedText('');
    setPastedLabel('');
    setErrorMsg(null);
  };

  const handleRemoveSource = (index: number) => {
    setSources(sources.filter((_, i) => i !== index));
  };

  // One smart sample loader
  const handleLoadSample = () => {
    if (mode === 'answer_audit') {
      setQuestion('What should I verify before applying for National Merit Scholarship 2026?');
      setCandidateAnswer(
        'Eligible candidates must have achieved a minimum aggregate of 75% marks in their Class 12 exams. ' +
        'Gross annual family income must not exceed INR 6,00,000 and parent Income Tax Return (ITR) is strictly mandatory. ' +
        'The portal closing date is 15 October 2024. ' +
        'Students must maintain a continuing 7.5 CGPA in university to renew the scholarship. ' +
        'Applying early is always a wonderful idea and guarantees success.'
      );
      setSources([
        { url: 'https://scholarships.gov.in/national-merit-2026', label: 'Official Gazette Notification' },
        { url: 'https://studentdesk.org/scholarships/national-merit-guide', label: 'Student Advisory Portal' },
        { url: 'https://edutips.net/articles/merit-scholarship-advice', label: 'EduTips Blog (2024 Cycle)' },
        { url: 'https://scholarshipforum.in/threads/national-merit-questions', label: 'Peer Forum Discussion' },
      ]);
    } else {
      setQuestion('What should I verify before applying for National Merit Scholarship 2026?');
      setCandidateAnswer('');
      setSources([
        { url: 'https://scholarships.gov.in/national-merit-2026', label: 'Official Gazette Notification' },
        { url: 'https://studentdesk.org/scholarships/national-merit-guide', label: 'Student Advisory Portal' },
        { url: 'https://edutips.net/articles/merit-scholarship-advice', label: 'EduTips Guidance Article' },
        { url: 'https://scholarshipforum.in/threads/national-merit-questions', label: 'Peer Forum Discussion' },
      ]);
    }
    setSourcesOpen(true);
    setErrorMsg(null);
    setSampleLoadedNotice(true);
  };

  const handleSearchSources = async () => {
    const q = suggestQuery.trim() || question.trim();
    if (!q) return;
    setSuggestResults([]);
    setIsSearching(true);
    setHasSearched(false);
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ goal: q }),
      });
      if (res.ok) {
        const data = await res.json();
        setSuggestResults(data.results || []);
      } else {
        setSuggestResults([]);
      }
    } catch {
      setSuggestResults([]);
    } finally {
      setIsSearching(false);
      setHasSearched(true);
    }
  };

  const handleAddSuggested = (item: { title: string; url: string; snippet?: string }) => {
    if (sources.length >= 6) {
      setErrorMsg('Maximum 6 sources allowed.');
      return;
    }
    if (sources.some(s => s.url === item.url)) {
      setErrorMsg('Source already in your list.');
      return;
    }
    setSources([...sources, { url: item.url, label: item.title, text: item.snippet }]);
    setErrorMsg(null);
  };

  const handleAnalyze = () => {
    if (question.trim().length < 5) {
      setErrorMsg('Please enter a question (at least 5 characters).');
      return;
    }

    if (mode === 'answer_audit') {
      if (candidateAnswer.trim().length < 10) {
        setErrorMsg('Please enter an answer to audit (at least 10 characters).');
        return;
      }
    } else {
      if (sources.length < 2) {
        setErrorMsg('Please add at least 2 sources to compare.');
        return;
      }
    }

    sessionStorage.setItem(
      'gaplens_pending_run',
      JSON.stringify({
        mode,
        question: question.trim(),
        goal: question.trim(),
        answer: mode === 'answer_audit' ? candidateAnswer.trim() : undefined,
        sources,
      })
    );

    setIsAnalyzing(true);
    router.push('/analyze');
  };

  const canAnalyze =
    question.trim().length >= 5 &&
    (mode === 'answer_audit' ? candidateAnswer.trim().length >= 10 : sources.length >= 2);

  return (
    <div className="flex-1 flex flex-col justify-between">
      {/* Sleek Minimal Header */}
      <header className="w-full bg-[#FFFDF8] border-b-2.5 border-black sticky top-0 z-30 shadow-[0_2px_0_0_#0A0A0A]">
        <div className="max-w-4xl sm:max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <Logo size="md" />

          <NBButton
            variant="yellow"
            size="sm"
            onClick={handleLoadSample}
            className="text-xs font-bold"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Load Sample</span>
          </NBButton>
        </div>
      </header>

      {/* Main Workbench */}
      <main className="max-w-3xl sm:max-w-4xl mx-auto px-4 sm:px-6 py-8 w-full space-y-6">
        {/* Simple Heading */}
        <div className="text-center space-y-1.5">
          <h1 className="text-2xl sm:text-3xl font-black font-heading text-black tracking-tight">
            Verify answers. Spot missing facts.
          </h1>
          <p className="text-xs sm:text-sm text-neutral-600 max-w-md mx-auto leading-relaxed">
            Check factual claims against authentic sources, find contradictions, and discover dark spots.
          </p>
        </div>

        {/* Clean Mode Switcher */}
        <div className="flex p-1 bg-[#FFF4DC] border-2 border-black rounded-xl shadow-[2px_2px_0_#0A0A0A] max-w-md mx-auto">
          <button
            type="button"
            onClick={() => {
              setMode('answer_audit');
              setErrorMsg(null);
            }}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              mode === 'answer_audit'
                ? 'bg-white text-black border-2 border-black shadow-[1.5px_1.5px_0_#0A0A0A]'
                : 'text-neutral-600 hover:text-black border-2 border-transparent'
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            <span>Audit an Answer</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMode('research_gaps');
              setSourcesOpen(true);
              setErrorMsg(null);
            }}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              mode === 'research_gaps'
                ? 'bg-white text-black border-2 border-black shadow-[1.5px_1.5px_0_#0A0A0A]'
                : 'text-neutral-600 hover:text-black border-2 border-transparent'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Find Research Gaps</span>
          </button>
        </div>

        {/* Sample Loaded Toast */}
        {sampleLoadedNotice && (
          <div className="p-3 rounded-xl bg-emerald-50 border-2 border-black text-xs text-emerald-950 flex items-center justify-between gap-2 shadow-[2px_2px_0_#0A0A0A]">
            <div className="flex items-center gap-2">
              <span className="font-bold text-emerald-700">✓</span>
              <span>
                <strong>Sample scenario loaded!</strong> Click <strong>&quot;{mode === 'answer_audit' ? 'Verify Answer' : 'Analyze Sources'}&quot;</strong> below to run.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSampleLoadedNotice(false)}
              className="text-neutral-500 hover:text-black font-bold p-1 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Clean Workbench Form */}
        <NBCard variant="normal" className="bg-[#FFFDF8] p-5 sm:p-6 space-y-4 border-2.5 border-black shadow-[4px_4px_0_#0A0A0A]">
          {/* Question Input */}
          <div className="space-y-1.5">
            <label htmlFor="question-input" className="text-xs font-black font-mono uppercase tracking-wider text-black block">
              Question or Topic:
            </label>
            <NBInput
              id="question-input"
              type="text"
              value={question}
              onChange={(e) => {
                setQuestion(e.target.value);
                if (errorMsg) setErrorMsg(null);
              }}
              placeholder="e.g. What should I verify before applying for National Merit Scholarship 2026?"
              className="text-sm font-medium bg-white"
            />
          </div>

          {/* Answer Box (Audit Mode only) */}
          {mode === 'answer_audit' && (
            <div className="space-y-1.5 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <label htmlFor="answer-input" className="text-xs font-black font-mono uppercase tracking-wider text-black block">
                  Answer to Verify:
                </label>
                {candidateAnswer.length > 0 && (
                  <span className="text-[11px] font-mono text-neutral-500">
                    {candidateAnswer.length} chars
                  </span>
                )}
              </div>
              <NBTextarea
                id="answer-input"
                rows={3}
                value={candidateAnswer}
                onChange={(e) => {
                  setCandidateAnswer(e.target.value);
                  if (errorMsg) setErrorMsg(null);
                }}
                placeholder="Paste the statement or text to fact-check..."
                className="text-xs sm:text-sm font-medium leading-relaxed bg-white"
              />
            </div>
          )}

          {/* Collapsible / Clean Sources Section */}
          <div className="pt-2 border-t border-black/10">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setSourcesOpen(!sourcesOpen)}
                className="flex items-center gap-1.5 text-xs font-black font-mono uppercase tracking-wider text-black hover:text-neutral-700 cursor-pointer"
              >
                <span>Sources to check against ({sources.length})</span>
                {mode === 'answer_audit' && (
                  <span className="text-[10px] font-normal normal-case text-neutral-500">
                    (Optional — defaults to official references)
                  </span>
                )}
                {sourcesOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>

            {sourcesOpen && (
              <div className="space-y-3 pt-3">
                {/* Compact segmented button */}
                <div className="flex gap-1 p-1 bg-[#FFF4DC] border border-black rounded-lg w-fit">
                  <button
                    type="button"
                    onClick={() => setInputMode('url')}
                    className={`px-2.5 py-1 rounded text-xs font-bold cursor-pointer ${
                      inputMode === 'url' ? 'bg-white text-black border border-black shadow-[1px_1px_0_#0A0A0A]' : 'text-neutral-600'
                    }`}
                  >
                    URL
                  </button>
                  <button
                    type="button"
                    onClick={() => setInputMode('paste')}
                    className={`px-2.5 py-1 rounded text-xs font-bold cursor-pointer ${
                      inputMode === 'paste' ? 'bg-white text-black border border-black shadow-[1px_1px_0_#0A0A0A]' : 'text-neutral-600'
                    }`}
                  >
                    Paste Text
                  </button>
                  <button
                    type="button"
                    onClick={() => setInputMode('suggest')}
                    className={`px-2.5 py-1 rounded text-xs font-bold cursor-pointer ${
                      inputMode === 'suggest' ? 'bg-white text-black border border-black shadow-[1px_1px_0_#0A0A0A]' : 'text-neutral-600'
                    }`}
                  >
                    Search
                  </button>
                </div>

                {inputMode === 'url' && (
                  <form onSubmit={handleAddUrl} className="flex gap-2">
                    <NBInput
                      type="url"
                      value={newUrl}
                      onChange={(e) => setNewUrl(e.target.value)}
                      placeholder="https://example.gov.in/guidelines"
                      className="bg-white text-xs"
                      required
                    />
                    <NBButton type="submit" variant="yellow" size="sm" className="shrink-0 text-xs font-bold">
                      Add Link
                    </NBButton>
                  </form>
                )}

                {inputMode === 'paste' && (
                  <form onSubmit={handleAddPastedText} className="space-y-2 p-2.5 rounded bg-neutral-50 border border-black/20">
                    <NBInput
                      type="text"
                      value={pastedLabel}
                      onChange={(e) => setPastedLabel(e.target.value)}
                      placeholder="Label (e.g. Official Policy Excerpt)"
                      className="bg-white text-xs"
                      required
                    />
                    <NBTextarea
                      rows={2}
                      value={pastedText}
                      onChange={(e) => setPastedText(e.target.value)}
                      placeholder="Paste document text..."
                      className="bg-white text-xs"
                      required
                    />
                    <div className="flex justify-end">
                      <NBButton type="submit" variant="yellow" size="sm" className="text-xs font-bold">
                        Add Document
                      </NBButton>
                    </div>
                  </form>
                )}

                {inputMode === 'suggest' && (
                  <div className="space-y-2 p-2.5 rounded bg-neutral-50 border border-black/20">
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleSearchSources();
                      }}
                      className="flex gap-2"
                    >
                      <NBInput
                        type="text"
                        value={suggestQuery}
                        onChange={(e) => setSuggestQuery(e.target.value)}
                        placeholder="Search for official pages or guidelines..."
                        className="bg-white text-xs"
                      />
                      <NBButton type="submit" variant="yellow" size="sm" disabled={isSearching} className="text-xs font-bold shrink-0">
                        {isSearching ? '...' : 'Search'}
                      </NBButton>
                    </form>

                    {suggestResults.length > 0 && (
                      <div className="space-y-1.5 max-h-36 overflow-y-auto">
                        {suggestResults.map((item, idx) => (
                          <div key={idx} className="p-2 rounded bg-white border border-black/20 flex items-center justify-between text-xs gap-2">
                            <span className="truncate font-medium">{item.title}</span>
                            <button
                              type="button"
                              onClick={() => handleAddSuggested(item)}
                              disabled={sources.some(s => s.url === item.url)}
                              className="text-xs font-bold text-blue-700 hover:underline shrink-0 cursor-pointer"
                            >
                              {sources.some(s => s.url === item.url) ? 'Added' : '+ Add'}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Added sources pills */}
                {sources.length > 0 && (
                  <div className="space-y-1 pt-1">
                    {sources.map((s, idx) => (
                      <div
                        key={idx}
                        className="px-2.5 py-1.5 rounded-md bg-[#FFF9EC] border border-black flex items-center justify-between gap-2 text-xs"
                      >
                        <span className="truncate font-medium">
                          {s.label || s.url}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveSource(idx)}
                          className="text-neutral-400 hover:text-red-600 p-0.5 cursor-pointer font-bold text-xs"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="p-2.5 rounded-lg bg-[var(--red-light)] border border-black text-xs font-mono font-bold text-red-950 flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Submit Action */}
          <div className="pt-2">
            <NBButton
              variant="yellow"
              size="lg"
              className="w-full justify-center text-sm font-black shadow-[3px_3px_0_#0A0A0A] py-3"
              disabled={!canAnalyze}
              onClick={handleAnalyze}
            >
              <span>{mode === 'answer_audit' ? 'Verify Answer' : 'Analyze Sources'}</span>
              <ArrowRight className="w-4 h-4" />
            </NBButton>
          </div>
        </NBCard>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-black bg-[#FFFDF8] py-3 px-4 text-center text-xs font-mono text-neutral-500">
        GapLens — Question-Adaptive Claim Verification
      </footer>
    </div>
  );
}
