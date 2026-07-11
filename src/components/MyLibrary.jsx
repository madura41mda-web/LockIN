import { useEffect, useState } from "react";
import { X, Tag, BookOpen, Brain, Pencil, Check } from "lucide-react";
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

  if (viewingDeck) {
    return (
      <main className="feature-page">
        <button type="button" className="secondary" onClick={() => setViewingDeck(null)}>
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

  if (viewingAttempt) {
    const questions = viewingAttempt.questions || [];
    return (
      <main className="feature-page">
        <button type="button" className="secondary" onClick={() => setViewingAttempt(null)}>
          ← Back to Library
        </button>
        <div className="feature-page-header">
          <h3 className="feature-page-title">{viewingAttempt.module_name}</h3>
          <p className="feature-page-copy">
            Score: {viewingAttempt.score} / {viewingAttempt.total_questions}
          </p>
        </div>
        <section className="result-stage result-stage-wide">
          {questions.map((q, i) => (
            <div key={i} className="quiz-card" style={{ marginBottom: "1rem" }}>
              <p className="quiz-question">{i + 1}. {q.question}</p>
              {q.correctAnswer && <p className="quiz-feedback-answer">Answer: {q.correctAnswer}</p>}
              {q.options && q.correctIndex !== undefined && (
                <p className="quiz-feedback-answer">Answer: {q.options[q.correctIndex]}</p>
              )}
              {q.explanation && <p className="quiz-feedback-explanation">💡 {q.explanation}</p>}
            </div>
          ))}
        </section>
      </main>
    );
  }

  return (
    <main className="feature-page">
      <header className="feature-page-header">
        <div>
          <span className="setup-label">library_page</span>
          <h3 className="feature-page-title">My Library</h3>
          <p className="feature-page-copy">Your saved flashcard decks and quiz attempts, grouped by subject.</p>
        </div>
        <button type="button" className="secondary" onClick={onClose} aria-label="Close library">
          <X size={20} />
        </button>
      </header>

      {loading && <p className="mono text-center mt-6">Loading...</p>}

      {!loading && groups.length === 0 && (
        <p className="mono text-center mt-6">Nothing saved yet. Save a deck or quiz result to see it here.</p>
      )}

      {!loading &&
        groups.map((group, gi) => (
          <div key={group.subject} className="study-input-panel" style={{ marginTop: gi === 0 ? "1.5rem" : "1rem" }}>
            <div className="flex items-center gap-2 mb-3">
              <Tag size={16} />
              {editingSubject === group.subject ? (
                <div className="flex items-center gap-2" style={{ flex: 1 }}>
                  <input
                    type="text"
                    value={draftSubject}
                    onChange={(e) => setDraftSubject(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && saveSubjectRename(group.subject)}
                    autoFocus
                    disabled={renaming}
                    className="time-limit-input"
                    style={{ width: "100%" }}
                  />
                  <button type="button" className="secondary" disabled={renaming} onClick={() => saveSubjectRename(group.subject)} aria-label="Save subject name">
                    <Check size={14} />
                  </button>
                  <button type="button" className="secondary" disabled={renaming} onClick={() => setEditingSubject(null)} aria-label="Cancel rename">
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="flex items-center gap-2"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text)" }}
                  onClick={() => {
                    setEditingSubject(group.subject);
                    setDraftSubject(group.subject);
                  }}
                >
                  <span className="setup-label">{group.subject}</span>
                  <Pencil size={12} />
                </button>
              )}
            </div>

            {group.decks.map((deck) => (
              <button
                key={deck.id}
                type="button"
                className="secondary"
                style={{ display: "flex", alignItems: "center", gap: "0.5rem", width: "100%", marginBottom: "0.5rem" }}
                onClick={() => setViewingDeck(deck)}
              >
                <BookOpen size={16} /> {deck.module_name} — {deck.cards?.length || 0} cards
              </button>
            ))}

            {group.attempts.map((attempt) => (
              <button
                key={attempt.id}
                type="button"
                className="secondary"
                style={{ display: "flex", alignItems: "center", gap: "0.5rem", width: "100%", marginBottom: "0.5rem" }}
                onClick={() => setViewingAttempt(attempt)}
              >
                <Brain size={16} /> {attempt.module_name} — {attempt.score}/{attempt.total_questions}
              </button>
            ))}
          </div>
        ))}
    </main>
  );
}