import { useEffect, useState } from "react";
import { 
  X, Tag, BookOpen, Brain, Pencil, Check, Search, SlidersHorizontal, 
  ArrowUpDown, Code2, Terminal, Library, Activity, BookMarked, Sparkles,
  MoreVertical, Trash2
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
  const [openMenu, setOpenMenu] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [groupDeleteTarget, setGroupDeleteTarget] = useState(null);
  const [groupDeleteMode, setGroupDeleteMode] = useState("move");
  const [deletingGroup, setDeletingGroup] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [libraryStatus, setLibraryStatus] = useState("");
  const [libraryError, setLibraryError] = useState("");

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all"); 
  const [sortOption, setSortOption] = useState("recent"); 

  useEffect(() => {
    if (session) load();
  }, [session]);

  async function load() {
    const userId = session?.user?.id;
    if (!userId) return;
    setLoading(true);
    setLibraryError("");
    const [decksRes, attemptsRes] = await Promise.all([
      supabase.from("flashcard_decks").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("quiz_attempts").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    ]);
    if (decksRes.error || attemptsRes.error) {
      console.error("Loading library resources failed:", {
        decksError: decksRes.error,
        attemptsError: attemptsRes.error,
      });
      setLibraryError(decksRes.error?.message || attemptsRes.error?.message || "Could not load Library resources.");
    }
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

  function beginRename(subject) {
    setOpenMenu(null);
    setLibraryError("");
    setLibraryStatus("");
    setEditingSubject(subject);
    setDraftSubject(subject);
  }

  function cancelRename() {
    setDraftSubject(editingSubject || "");
    setEditingSubject(null);
    setLibraryError("");
  }

  async function saveSubjectRename(oldSubject) {
    const userId = session?.user?.id;
    const trimmed = draftSubject.trim();
    if (!userId) {
      setLibraryError("You must be signed in to rename Library groups.");
      return;
    }
    if (!trimmed) {
      setLibraryError("Library group name cannot be empty.");
      return;
    }
    if (trimmed === oldSubject) {
      setEditingSubject(null);
      return;
    }

    setRenaming(true);
    setLibraryError("");
    setLibraryStatus("");
    const deckIds = decks.filter((d) => subjectOf(d) === oldSubject).map((d) => d.id);
    const attemptIds = attempts.filter((a) => subjectOf(a) === oldSubject).map((a) => a.id);

    const [deckResult, attemptResult] = await Promise.all([
      deckIds.length
        ? supabase.from("flashcard_decks").update({ subject: trimmed }).eq("user_id", userId).in("id", deckIds)
        : Promise.resolve({ error: null }),
      attemptIds.length
        ? supabase.from("quiz_attempts").update({ subject: trimmed }).eq("user_id", userId).in("id", attemptIds)
        : Promise.resolve({ error: null }),
    ]);

    setRenaming(false);
    if (deckResult.error || attemptResult.error) {
      console.error("Library group rename failed:", {
        oldSubject,
        trimmed,
        deckError: deckResult.error,
        attemptError: attemptResult.error,
      });
      setLibraryError(deckResult.error?.message || attemptResult.error?.message || "Could not rename this Library group.");
      return;
    }

    const deckIdSet = new Set(deckIds);
    const attemptIdSet = new Set(attemptIds);
    setDecks((current) => current.map((deck) => (
      deckIdSet.has(deck.id) ? { ...deck, subject: trimmed } : deck
    )));
    setAttempts((current) => current.map((attempt) => (
      attemptIdSet.has(attempt.id) ? { ...attempt, subject: trimmed } : attempt
    )));
    setLibraryStatus(`Renamed "${oldSubject}" to "${trimmed}".`);
    setEditingSubject(null);
  }

  function resourceTitle(resource) {
    return resource?.module_name || resource?.subject || "Untitled resource";
  }

  function requestDeleteResource(type, resource) {
    setOpenMenu(null);
    setLibraryError("");
    setLibraryStatus("");
    setDeleteTarget({ type, resource });
  }

  async function confirmDeleteResource() {
    if (!deleteTarget || deleting) return;
    const userId = session?.user?.id;
    if (!userId) {
      setLibraryError("You must be signed in to delete Library resources.");
      return;
    }

    setDeleting(true);
    setLibraryError("");
    setLibraryStatus("");

    const tableName = deleteTarget.type === "flashcards" ? "flashcard_decks" : "quiz_attempts";
    const resourceName = resourceTitle(deleteTarget.resource);
    const { error, count } = await supabase
      .from(tableName)
      .delete({ count: "exact" })
      .eq("id", deleteTarget.resource.id)
      .eq("user_id", userId);

    if (error) {
      console.error("Delete Library resource failed:", {
        tableName,
        resourceId: deleteTarget.resource.id,
        userId,
        error,
      });
      setLibraryError(`Could not delete "${resourceName}": ${error.message || "Supabase rejected the request."}`);
      setDeleting(false);
      return;
    }

    if (count === 0) {
      console.warn("Delete Library resource affected no rows:", {
        tableName,
        resourceId: deleteTarget.resource.id,
        userId,
      });
      setLibraryError(`Could not delete "${resourceName}". It may already be deleted or you may not own it.`);
      setDeleting(false);
      return;
    }

    if (deleteTarget.type === "flashcards") {
      setDecks((current) => current.filter((deck) => deck.id !== deleteTarget.resource.id));
    } else {
      setAttempts((current) => current.filter((attempt) => attempt.id !== deleteTarget.resource.id));
    }

    setLibraryStatus(`Deleted "${resourceName}".`);
    setDeleting(false);
    setDeleteTarget(null);
  }

  function requestDeleteGroup(group) {
    setOpenMenu(null);
    setLibraryError("");
    setLibraryStatus("");
    setGroupDeleteMode("move");
    setGroupDeleteTarget({
      subject: group.subject,
      decks: group.decks,
      attempts: group.attempts,
    });
  }

  async function confirmDeleteGroup() {
    if (!groupDeleteTarget || deletingGroup) return;
    const userId = session?.user?.id;
    if (!userId) {
      setLibraryError("You must be signed in to delete Library groups.");
      return;
    }

    const deckIds = groupDeleteTarget.decks.map((deck) => deck.id);
    const attemptIds = groupDeleteTarget.attempts.map((attempt) => attempt.id);
    const fallbackSubject = "Uncategorized";

    setDeletingGroup(true);
    setLibraryError("");
    setLibraryStatus("");

    const deckQuery = groupDeleteMode === "delete"
      ? (deckIds.length
        ? supabase.from("flashcard_decks").delete({ count: "exact" }).eq("user_id", userId).in("id", deckIds)
        : Promise.resolve({ error: null, count: 0 }))
      : (deckIds.length
        ? supabase.from("flashcard_decks").update({ subject: fallbackSubject }).eq("user_id", userId).in("id", deckIds)
        : Promise.resolve({ error: null, count: 0 }));

    const attemptQuery = groupDeleteMode === "delete"
      ? (attemptIds.length
        ? supabase.from("quiz_attempts").delete({ count: "exact" }).eq("user_id", userId).in("id", attemptIds)
        : Promise.resolve({ error: null, count: 0 }))
      : (attemptIds.length
        ? supabase.from("quiz_attempts").update({ subject: fallbackSubject }).eq("user_id", userId).in("id", attemptIds)
        : Promise.resolve({ error: null, count: 0 }));

    const [deckResult, attemptResult] = await Promise.all([deckQuery, attemptQuery]);
    setDeletingGroup(false);

    if (deckResult.error || attemptResult.error) {
      console.error("Library group delete failed:", {
        subject: groupDeleteTarget.subject,
        mode: groupDeleteMode,
        deckError: deckResult.error,
        attemptError: attemptResult.error,
      });
      setLibraryError(deckResult.error?.message || attemptResult.error?.message || "Could not delete this Library group.");
      return;
    }

    const deckIdSet = new Set(deckIds);
    const attemptIdSet = new Set(attemptIds);
    if (groupDeleteMode === "delete") {
      setDecks((current) => current.filter((deck) => !deckIdSet.has(deck.id)));
      setAttempts((current) => current.filter((attempt) => !attemptIdSet.has(attempt.id)));
      setLibraryStatus(`Deleted "${groupDeleteTarget.subject}" and ${deckIds.length + attemptIds.length} contained resources.`);
    } else {
      setDecks((current) => current.map((deck) => (
        deckIdSet.has(deck.id) ? { ...deck, subject: fallbackSubject } : deck
      )));
      setAttempts((current) => current.map((attempt) => (
        attemptIdSet.has(attempt.id) ? { ...attempt, subject: fallbackSubject } : attempt
      )));
      setLibraryStatus(`Moved "${groupDeleteTarget.subject}" resources to ${fallbackSubject}.`);
    }

    setGroupDeleteTarget(null);
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
      {libraryStatus && <p className="mb-4 text-sm mono text-emerald-500 text-center">{libraryStatus}</p>}
      {libraryError && <p className="mb-4 text-sm mono text-red-400 text-center">{libraryError}</p>}

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
                              onClick={(event) => event.stopPropagation()}
                              onKeyDown={(event) => {
                                event.stopPropagation();
                                if (event.key === "Enter") saveSubjectRename(group.subject);
                                if (event.key === "Escape") cancelRename();
                              }}
                              autoFocus
                              disabled={renaming}
                              className="rounded border border-gray-300 dark:border-white/15 bg-white dark:bg-neutral-800 text-slate-900 dark:text-white px-2 py-1 text-xs outline-none focus:border-orange-500"
                            />
                            <button
                              type="button"
                              className="secondary p-1"
                              disabled={renaming}
                              onClick={(event) => {
                                event.stopPropagation();
                                saveSubjectRename(group.subject);
                              }}
                              aria-label="Confirm Rename"
                            >
                              <Check size={12} />
                            </button>
                            <button
                              type="button"
                              className="secondary p-1"
                              disabled={renaming}
                              onClick={(event) => {
                                event.stopPropagation();
                                cancelRename();
                              }}
                              aria-label="Cancel Rename"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ) : (
                          <h4 
                            onClick={(event) => {
                              event.stopPropagation();
                              beginRename(group.subject);
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

                    <div className="library-group-actions">
                      <div className="text-right text-[10px] font-mono text-gray-500">
                        Files: {resourcesCount}
                      </div>
                      <button
                        type="button"
                        className="library-resource-menu-trigger"
                        onClick={(event) => {
                          event.stopPropagation();
                          setOpenMenu(openMenu === `group-${group.subject}` ? null : `group-${group.subject}`);
                        }}
                        aria-label={`More options for ${group.subject}`}
                      >
                        <MoreVertical size={14} />
                      </button>
                      {openMenu === `group-${group.subject}` && (
                        <div className="library-resource-menu library-group-menu">
                          <button type="button" onClick={() => beginRename(group.subject)}>
                            <Pencil size={13} /> Rename
                          </button>
                          <button type="button" onClick={() => requestDeleteGroup(group)}>
                            <Trash2 size={13} /> Delete group
                          </button>
                        </div>
                      )}
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
                      <div key={deck.id} className="library-resource-row">
                        <button
                          type="button"
                          className="library-resource-main"
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
                        <button
                          type="button"
                          className="library-resource-menu-trigger"
                          onClick={(event) => {
                            event.stopPropagation();
                            setOpenMenu(openMenu === `deck-${deck.id}` ? null : `deck-${deck.id}`);
                          }}
                          aria-label={`More options for ${deck.module_name}`}
                        >
                          <MoreVertical size={14} />
                        </button>
                        {openMenu === `deck-${deck.id}` && (
                          <div className="library-resource-menu">
                            <button type="button" onClick={() => requestDeleteResource("flashcards", deck)}>
                              <Trash2 size={13} /> Delete
                            </button>
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Attempts inside cards */}
                    {group.attempts.map((attempt) => (
                      <div key={attempt.id} className="library-resource-row">
                        <button
                          type="button"
                          className="library-resource-main"
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
                        <button
                          type="button"
                          className="library-resource-menu-trigger"
                          onClick={(event) => {
                            event.stopPropagation();
                            setOpenMenu(openMenu === `quiz-${attempt.id}` ? null : `quiz-${attempt.id}`);
                          }}
                          aria-label={`More options for ${attempt.module_name}`}
                        >
                          <MoreVertical size={14} />
                        </button>
                        {openMenu === `quiz-${attempt.id}` && (
                          <div className="library-resource-menu">
                            <button type="button" onClick={() => requestDeleteResource("quiz", attempt)}>
                              <Trash2 size={13} /> Delete
                            </button>
                          </div>
                        )}
                      </div>
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

      {deleteTarget && (
        <div className="auth-modal-overlay" onClick={() => !deleting && setDeleteTarget(null)}>
          <div className="auth-modal-box" onClick={(event) => event.stopPropagation()}>
            <div className="auth-shell" style={{ maxWidth: "480px" }}>
              <button
                type="button"
                className="auth-modal-close"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                aria-label="Close delete confirmation"
              >
                <X size={16} />
              </button>
              <span className="setup-label">delete_resource</span>
              <h3 className="feature-page-title text-left">Delete resource?</h3>
              <p className="feature-page-copy text-sm">
                Delete <strong>{resourceTitle(deleteTarget.resource)}</strong>? This removes this generated{" "}
                {deleteTarget.type === "flashcards" ? "flashcard deck" : "quiz attempt"} only. The source PDF and
                unrelated Library resources stay unchanged.
              </p>

              <div className="flashcard-actions">
                <button type="button" className="secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="secondary text-red-500 border-red-500/30"
                  onClick={confirmDeleteResource}
                  disabled={deleting}
                >
                  {deleting ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {groupDeleteTarget && (
        <div className="auth-modal-overlay" onClick={() => !deletingGroup && setGroupDeleteTarget(null)}>
          <div className="auth-modal-box" onClick={(event) => event.stopPropagation()}>
            <div className="auth-shell" style={{ maxWidth: "500px" }}>
              <button
                type="button"
                className="auth-modal-close"
                onClick={() => setGroupDeleteTarget(null)}
                disabled={deletingGroup}
                aria-label="Close delete group confirmation"
              >
                <X size={16} />
              </button>
              <span className="setup-label">delete_group</span>
              <h3 className="feature-page-title text-left">Delete "{groupDeleteTarget.subject}"?</h3>
              <p className="feature-page-copy text-sm">
                This affects only resources currently grouped under "{groupDeleteTarget.subject}".
                Source PDF documents are not deleted.
              </p>

              <div className="flex flex-col gap-3 my-5">
                <label className="quiz-option">
                  <input
                    type="radio"
                    name="groupDeleteMode"
                    checked={groupDeleteMode === "move"}
                    onChange={() => setGroupDeleteMode("move")}
                    disabled={deletingGroup}
                    className="mr-2"
                  />
                  Delete group only — move resources to Uncategorized
                </label>
                <label className="quiz-option">
                  <input
                    type="radio"
                    name="groupDeleteMode"
                    checked={groupDeleteMode === "delete"}
                    onChange={() => setGroupDeleteMode("delete")}
                    disabled={deletingGroup}
                    className="mr-2"
                  />
                  Delete group and all contained flashcard decks/quizzes
                </label>
              </div>

              <div className="flashcard-actions">
                <button type="button" className="secondary" onClick={() => setGroupDeleteTarget(null)} disabled={deletingGroup}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="secondary text-red-500 border-red-500/30"
                  onClick={confirmDeleteGroup}
                  disabled={deletingGroup}
                >
                  {deletingGroup ? "Deleting..." : "Delete group"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
