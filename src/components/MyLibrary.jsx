import { useEffect, useState } from "react";
import { 
  X, Tag, BookOpen, Brain, Pencil, Check, Search, SlidersHorizontal, 
  ArrowUpDown, Code2, Terminal, Library, Activity, BookMarked, Sparkles
} from "lucide-react";
import { supabase } from "../supabaseClient";
import Flashcards from "./Flashcards";

export default function MyLibrary({ session, onClose, onOpenDeck }) {
  const [loading, setLoading] = useState(true);
  const [decks, setDecks] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [viewingDeck, setViewingDeck] = useState(null);
  const [viewingAttempt, setViewingAttempt] = useState(null);
  const [editingSubject, setEditingSubject] = useState(null);
  const [draftSubject, setDraftSubject] = useState("");
  const [renaming, setRenaming] = useState(false);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all"); 
  const [sortOption, setSortOption] = useState("recent"); 

  useEffect(() => {
    if (session) load();
  }, [session]);

  async function load() {
    setLoading(true);
    const [decksRes, attemptsRes] = await Promise.all([
      supabase.from("flashcard_decks").select("*").order("created_at", { ascending: false }),
      supabase.from("quiz_attempts").select("*").order("created_at", { ascending: false }),
    ]);
    setDecks(decksRes.data || []);
    setAttempts(attemptsRes.data || []);
    setLoading(false);
  }

  function subjectOf(item) {
    return (item.subject || item.module_name || "Unlabeled").trim() || "Unlabeled";
  }

  function itemsForSubject(subject) {
    return {
      decks: decks.filter((d) => subjectOf(d) === subject),
      attempts: attempts.filter((a) => subjectOf(a) === subject),
    };
  }

  const subjectNames = Array.from(
    new Set([...decks.map(subjectOf), ...attempts.map(subjectOf)])
  );
  const groups = subjectNames.map((subject) => ({ subject, ...itemsForSubject(subject) }));

  async function saveSubjectRename(oldSubject) {
    const trimmed = draftSubject.trim();
    if (!trimmed || trimmed === oldSubject) {
      setEditingSubject(null);
      return;
    }

    setRenaming(true);
    const deckIds = decks.filter((d) => subjectOf(d) === oldSubject).map((d) => d.id);
    const attemptIds = attempts.filter((a) => subjectOf(a) === oldSubject).map((a) => a.id);

    await Promise.all([
      deckIds.length
        ? supabase.from("flashcard_decks").update({ subject: trimmed }).in("id", deckIds)
        : Promise.resolve(),
      attemptIds.length
        ? supabase.from("quiz_attempts").update({ subject: trimmed }).in("id", attemptIds)
        : Promise.resolve(),
    ]);

    await load();
    setRenaming(false);
    setEditingSubject(null);
  }

  // Find appropriate icon for a subject name
  const getSubjectIcon = (subject) => {
    const name = subject.toLowerCase();
    if (name.includes("code") || name.includes("program") || name.includes("js") || name.includes("react") || name.includes("python") || name.includes("dev")) {
      return <Code2 size={22} className="text-orange-500" />;
    }
    if (name.includes("math") || name.includes("phys") || name.includes("calc") || name.includes("alg") || name.includes("stat")) {
      return <Terminal size={22} className="text-orange-500" />;
    }
    if (name.includes("science") || name.includes("bio") || name.includes("chem") || name.includes("med") || name.includes("brain")) {
      return <Brain size={22} className="text-orange-500" />;
    }
    if (name.includes("history") || name.includes("english") || name.includes("write") || name.includes("lit") || name.includes("social")) {
      return <BookOpen size={22} className="text-orange-500" />;
    }
    return <Library size={22} className="text-orange-500" />;
  };

  // 1. Filtering logic
  const filteredGroups = groups.filter((g) => {
    const matchesSearch = g.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.decks.some(d => d.module_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      g.attempts.some(a => a.module_name.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    if (activeFilter === "flashcards") return g.decks.length > 0;
    if (activeFilter === "quiz") return g.attempts.length > 0;
    return true;
  });

  // 2. Sorting logic
  filteredGroups.sort((a, b) => {
    if (sortOption === "alphabetical") {
      return a.subject.localeCompare(b.subject);
    }
    if (sortOption === "most_resources") {
      return (b.decks.length + b.attempts.length) - (a.decks.length + a.attempts.length);
    }
    if (sortOption === "least_resources") {
      return (a.decks.length + a.attempts.length) - (b.decks.length + b.attempts.length);
    }
    
    // Sort by recent (latest item created_at timestamp in group)
    const latestA = Math.max(
      ...a.decks.map(d => new Date(d.created_at).getTime()),
      ...a.attempts.map(at => new Date(at.created_at).getTime()),
      0
    );
    const latestB = Math.max(
      ...b.decks.map(d => new Date(d.created_at).getTime()),
      ...b.attempts.map(at => new Date(at.created_at).getTime()),
      0
    );
    return latestB - latestA;
  });

  // Screen: Viewing Deck
  if (viewingDeck) {
    return (
      <main className="feature-page">
        <button type="button" className="secondary mb-4" onClick={() => setViewingDeck(null)}>
          ← Back to Library
        </button>
        <section className="result-stage">
          <Flashcards
            cards={viewingDeck.cards}
            moduleName={viewingDeck.module_name}
            onGenerateNew={() => {}}
            onGenerateMore={() => {}}
            loadingMore={false}
            endMessage=""
            onSaveDeck={() => {}}
            saveStatus=""
          />
        </section>
      </main>
    );
  }

  // Screen: Viewing Quiz Attempt
  if (viewingAttempt) {
    const questions = viewingAttempt.questions || [];
    return (
      <main className="feature-page" style={{ maxWidth: "48rem" }}>
        <button type="button" className="secondary mb-4" onClick={() => setViewingAttempt(null)}>
          ← Back to Library
        </button>
        <div className="feature-page-header border-b border-gray-200 dark:border-white/10 pb-4 mb-6">
          <div>
            <span className="setup-label">quiz_review</span>
            <h3 className="feature-page-title">{viewingAttempt.module_name}</h3>
            <p className="feature-page-copy">
              Attempt recorded: {new Date(viewingAttempt.created_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs uppercase tracking-wider text-gray-500 font-mono">Score Tally</span>
            <p className="text-2xl font-bold font-mono text-orange-500">
              {viewingAttempt.score} / {viewingAttempt.total_questions}
            </p>
          </div>
        </div>
        <section className="result-stage result-stage-wide">
          {questions.map((q, i) => (
            <div key={i} className="quiz-card border-b border-gray-200 dark:border-white/5 pb-4 mb-4" style={{ marginBottom: "1rem" }}>
              <p className="quiz-question font-bold text-slate-800 dark:text-white mb-2">
                {i + 1}. {q.question}
              </p>
              {q.correctAnswer && (
                <p className="quiz-feedback-answer text-emerald-500 font-semibold text-xs border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-1 rounded inline-block">
                  Correct Answer: {q.correctAnswer}
                </p>
              )}
              {q.options && q.correctIndex !== undefined && (
                <p className="quiz-feedback-answer text-emerald-500 font-semibold text-xs border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-1 rounded inline-block">
                  Correct Answer: {q.options[q.correctIndex]}
                </p>
              )}
              {q.explanation && (
                <p className="quiz-feedback-explanation text-xs text-gray-500 dark:text-slate-400 mt-2 bg-neutral-100 dark:bg-white/5 p-2 rounded">
                  💡 {q.explanation}
                </p>
              )}
            </div>
          ))}
        </section>
      </main>
    );
  }

  return (
    <main className="feature-page" style={{ maxWidth: "64rem" }}>
      {/* Header */}
      <header className="feature-page-header border-b border-gray-250 dark:border-white/10 pb-4 mb-6">
        <div style={{ flex: 1 }}>
          <span className="setup-label">library_page</span>
          <h3 className="feature-page-title">My Library</h3>
          <p className="feature-page-copy">Review and manage saved flashcards and quiz attempts, grouped by subject.</p>
        </div>
        <button type="button" className="secondary" onClick={onClose} aria-label="Close library">
          <X size={20} />
        </button>
      </header>

      {/* Control panel: Search, filters, sorting */}
      <section className="study-input-panel grid grid-cols-1 md:grid-cols-12 gap-3 mb-6 p-4" style={{ maxWidth: "none" }}>
        
        {/* Search */}
        <div className="relative md:col-span-5 flex items-center">
          <span className="absolute left-3 text-slate-400">
            <Search size={16} />
          </span>
          <input
            type="text"
            placeholder="Search subjects or modules..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-neutral-800 text-slate-900 dark:text-white text-xs outline-none focus:border-orange-500"
          />
        </div>

        {/* Filter Selection */}
        <div className="flex items-center gap-1.5 md:col-span-4 justify-between">
          <span className="text-[10px] uppercase font-mono tracking-wider text-gray-500 flex items-center gap-1">
            <SlidersHorizontal size={12} className="text-orange-500" /> Filter
          </span>
          <div className="flex bg-neutral-100 dark:bg-white/5 rounded-lg p-0.5 border border-gray-300 dark:border-white/5">
            <button
              type="button"
              onClick={() => setActiveFilter("all")}
              className={`px-3 py-1 text-[10px] font-semibold rounded-md transition-colors ${
                activeFilter === "all" ? "bg-orange-500 text-white" : "text-gray-400 hover:text-white"
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter("flashcards")}
              className={`px-3 py-1 text-[10px] font-semibold rounded-md transition-colors ${
                activeFilter === "flashcards" ? "bg-orange-500 text-white" : "text-gray-400 hover:text-white"
              }`}
            >
              Flashcards
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter("quiz")}
              className={`px-3 py-1 text-[10px] font-semibold rounded-md transition-colors ${
                activeFilter === "quiz" ? "bg-orange-500 text-white" : "text-gray-400 hover:text-white"
              }`}
            >
              Quiz
            </button>
          </div>
        </div>

        {/* Sort Selection */}
        <div className="flex items-center gap-1.5 md:col-span-3 justify-between">
          <span className="text-[10px] uppercase font-mono tracking-wider text-gray-500 flex items-center gap-1">
            <ArrowUpDown size={12} className="text-orange-500" /> Sort
          </span>
          <select
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value)}
            className="rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-neutral-800 text-slate-800 dark:text-white px-2 py-1.5 text-[10px] outline-none focus:border-orange-500"
          >
            <option value="recent">Recently Opened</option>
            <option value="alphabetical">Alphabetical</option>
            <option value="most_resources">Most Resources</option>
            <option value="least_resources">Least Resources</option>
          </select>
        </div>

      </section>

      {/* Loading state */}
      {loading && (
        <div className="py-20 text-center">
          <span className="btn-spinner inline-block mr-2" />
          <p className="mono text-xs text-gray-500 inline-block">Consulting local data banks...</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredGroups.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 border border-dashed border-gray-200 dark:border-white/10 rounded-xl bg-orange-500/[0.01]">
          <div className="p-4 bg-orange-500/10 rounded-full text-orange-500 mb-4 animate-pulse">
            <BookMarked size={36} />
          </div>
          <h4 className="text-base font-bold text-slate-800 dark:text-white mb-2">No study materials found</h4>
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center max-w-sm mb-6 leading-relaxed">
            {searchQuery 
              ? "No items match your search. Make sure the subject or module name is spelled correctly or adjust filters."
              : "Your study library is currently empty. Upload your notepad or read PDF summaries to generate practice materials."
            }
          </p>
          {!searchQuery && (
            <button type="button" onClick={onClose} className="generate-btn text-xs py-2 px-6" style={{ width: "auto" }}>
              <Sparkles size={14} className="inline mr-1" /> Get Started — Upload Notes
            </button>
          )}
        </div>
      )}

      {/* Grid of Cards */}
      {!loading && filteredGroups.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredGroups.map((group) => {
            const hasDecks = group.decks.length > 0;
            const hasAttempts = group.attempts.length > 0;
            const resourcesCount = group.decks.length + group.attempts.length;

            // Get last updated date cleanly from real data
            const lastUpdated = Math.max(
              ...group.decks.map(d => new Date(d.created_at).getTime()),
              ...group.attempts.map(at => new Date(at.created_at).getTime()),
              0
            );

            return (
              <div 
                key={group.subject} 
                className="study-input-panel flex flex-col justify-between rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-neutral-900/50 p-5 hover:border-orange-500/60 transition-colors"
                style={{ maxWidth: "none", margin: 0 }}
              >
                <div>
                  
                  {/* Card Header (Icon, Title, Rename) */}
                  <div className="flex items-start justify-between border-b border-gray-200 dark:border-white/5 pb-3 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-orange-500/10 rounded-lg text-orange-500">
                        {getSubjectIcon(group.subject)}
                      </div>
                      
                      <div>
                        {editingSubject === group.subject ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={draftSubject}
                              onChange={(e) => setDraftSubject(e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && saveSubjectRename(group.subject)}
                              autoFocus
                              disabled={renaming}
                              className="rounded border border-gray-300 dark:border-white/15 bg-white dark:bg-neutral-800 text-slate-900 dark:text-white px-2 py-1 text-xs outline-none focus:border-orange-500"
                            />
                            <button type="button" className="secondary p-1" disabled={renaming} onClick={() => saveSubjectRename(group.subject)} aria-label="Confirm Rename">
                              <Check size={12} />
                            </button>
                            <button type="button" className="secondary p-1" disabled={renaming} onClick={() => setEditingSubject(null)} aria-label="Cancel Rename">
                              <X size={12} />
                            </button>
                          </div>
                        ) : (
                          <h4 
                            onClick={() => {
                              setEditingSubject(group.subject);
                              setDraftSubject(group.subject);
                            }}
                            className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-1.5 cursor-pointer hover:text-orange-500 transition-colors"
                            title="Click to rename subject tag"
                          >
                            {group.subject} <Pencil size={11} className="text-gray-400" />
                          </h4>
                        )}
                        <span className="text-[10px] text-gray-500 font-mono">subject tag</span>
                      </div>
                    </div>

                    <div className="text-right text-[10px] font-mono text-gray-500">
                      Files: {resourcesCount}
                    </div>
                  </div>

                  {/* Resource counts columns */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="p-3 bg-neutral-100 dark:bg-white/5 rounded-lg border border-gray-200 dark:border-white/5 text-center">
                      <span className="text-[9px] uppercase font-semibold text-gray-500">Flashcard Decks</span>
                      <p className="text-lg font-bold font-mono text-slate-800 dark:text-white mt-1">
                        {group.decks.length}
                      </p>
                    </div>
                    <div className="p-3 bg-neutral-100 dark:bg-white/5 rounded-lg border border-gray-200 dark:border-white/5 text-center">
                      <span className="text-[9px] uppercase font-semibold text-gray-500">Quiz Attempts</span>
                      <p className="text-lg font-bold font-mono text-slate-800 dark:text-white mt-1">
                        {group.attempts.length}
                      </p>
                    </div>
                  </div>

                  {/* Progress Line - displaying real data omission strictly */}
                  <div className="mb-4 text-xs font-mono text-gray-500 flex justify-between items-center border-t border-b border-gray-200 dark:border-white/5 py-2">
                    <span>Completion Progress:</span>
                    <span className="text-slate-800 dark:text-white font-semibold">Not Available</span>
                  </div>

                  {/* Resources items list */}
                  <div className="flex flex-col gap-1.5 max-h-[140px] overflow-y-auto mb-4 pr-1">
                    
                    {/* Decks inside cards */}
                    {group.decks.map((deck) => (
                      <button
                        key={deck.id}
                        type="button"
                        className="flex items-center justify-between text-left text-xs bg-neutral-50 dark:bg-neutral-800/40 hover:bg-orange-500/10 border border-gray-300 dark:border-white/5 rounded-lg p-2 transition-colors cursor-pointer w-full"
                        onClick={() => setViewingDeck(deck)}
                      >
                        <span className="flex items-center gap-2 truncate font-semibold text-slate-800 dark:text-slate-300">
                          <BookOpen size={13} className="text-orange-500" />
                          <span className="truncate">{deck.module_name}</span>
                        </span>
                        <span className="text-[9px] font-mono text-gray-500 whitespace-nowrap ml-2">
                          {deck.cards?.length || 0} cards
                        </span>
                      </button>
                    ))}

                    {/* Attempts inside cards */}
                    {group.attempts.map((attempt) => (
                      <button
                        key={attempt.id}
                        type="button"
                        className="flex items-center justify-between text-left text-xs bg-neutral-50 dark:bg-neutral-800/40 hover:bg-orange-500/10 border border-gray-300 dark:border-white/5 rounded-lg p-2 transition-colors cursor-pointer w-full"
                        onClick={() => setViewingAttempt(attempt)}
                      >
                        <span className="flex items-center gap-2 truncate font-semibold text-slate-800 dark:text-slate-300">
                          <Brain size={13} className="text-orange-500" />
                          <span className="truncate">{attempt.module_name}</span>
                        </span>
                        <span className="text-[9px] font-mono text-gray-500 whitespace-nowrap ml-2">
                          Acc: {attempt.total_questions > 0 ? Math.round((attempt.score / attempt.total_questions)*100) : 0}%
                        </span>
                      </button>
                    ))}

                  </div>

                </div>

                {/* Card footer (Updated timestamp) */}
                <div className="flex items-center justify-between border-t border-gray-250 dark:border-white/5 pt-3 mt-2 text-[10px] text-gray-500 font-mono">
                  <span>
                    Updated: {lastUpdated > 0 ? new Date(lastUpdated).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "Recently"}
                  </span>
                  <span className="text-orange-400 select-none">Open resources above</span>
                </div>

              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}