import { useState } from "react";
import { createBattleRoom } from "./battleApi";
import FileUpload from "../FileUpload";
import ModuleSelector from "../ModuleSelector";

const DIFFICULTIES = ["easy", "medium", "hard"];
const COUNTS = [5, 10, 15, 20];
const TIMES = [15, 20, 25, 30];

export default function CreateBattleForm({
  session,
  noteText,
  setNoteText,
  modules,
  selectedModule,
  setSelectedModule,
  displayModuleName,
  currentDocumentId,
  callGenerate,
  onBack,
  onCreated,
  onError,
  onFileRead,
}) {
  const [difficulty, setDifficulty] = useState("medium");
  const [questionCount, setQuestionCount] = useState(10);
  const [timePerQuestion, setTimePerQuestion] = useState(20);
  const [isPrivate, setIsPrivate] = useState(true);
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState(null);

  async function handleCreate() {
    if (!noteText.trim()) {
      onError("Please upload a PDF or paste some notes first.");
      return;
    }
    setLoading(true);
    onError("");
    try {
      const data = await callGenerate("quiz", { difficulty, types: ["mcq"] });
      const mcqOnly = (data.quiz || [])
        .filter((q) => q.type === "mcq" && Array.isArray(q.options))
        .slice(0, questionCount);

      if (mcqOnly.length < 2) {
        onError("Could not generate enough multiple-choice questions from these notes. Try different notes or a lower question count.");
        return;
      }

      const room = await createBattleRoom({
        hostId: session.user.id,
        documentId: currentDocumentId,
        moduleName: displayModuleName,
        difficulty,
        questionCount: mcqOnly.length,
        timePerQuestion,
        isPrivate,
        questions: mcqOnly,
      });

      setCreated(room);
    } catch (err) {
      console.error(err);
      onError(err.message || "Could not create the battle.");
    } finally {
      setLoading(false);
    }
  }

  if (created) {
    const link = `${window.location.origin}/#/battle-join/${created.battle_code}`;
    return (
      <div className="quiz-setup">
        <span className="setup-label">Battle Created</span>
        <p className="card-text">Share this code or link with your opponent:</p>
        <div className="battle-code-display mono">{created.battle_code}</div>
        <input
          type="text"
          className="time-limit-input"
          style={{ width: "100%" }}
          readOnly
          value={link}
          onFocus={(e) => e.target.select()}
        />
        <button type="button" className="generate-btn" onClick={() => onCreated(created.id)}>
          Enter Waiting Room
        </button>
      </div>
    );
  }

  return (
    <div className="quiz-setup">
      <div className="setup-section">
        <span className="setup-label">Source Notes / PDF</span>
        <FileUpload noteText={noteText} setNoteText={setNoteText} onFileRead={onFileRead} />
        <ModuleSelector modules={modules} selectedModule={selectedModule} setSelectedModule={setSelectedModule} />
      </div>

      <div className="setup-section">
        <span className="setup-label">Difficulty</span>
        <div className="pill-row">
          {DIFFICULTIES.map((d) => (
            <button
              key={d}
              type="button"
              className={`pill ${difficulty === d ? "pill-active" : ""}`}
              onClick={() => setDifficulty(d)}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      <div className="setup-section">
        <span className="setup-label">Question Count</span>
        <div className="pill-row">
          {COUNTS.map((c) => (
            <button
              key={c}
              type="button"
              className={`pill ${questionCount === c ? "pill-active" : ""}`}
              onClick={() => setQuestionCount(c)}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="setup-section">
        <span className="setup-label">Time per Question</span>
        <div className="pill-row">
          {TIMES.map((t) => (
            <button
              key={t}
              type="button"
              className={`pill ${timePerQuestion === t ? "pill-active" : ""}`}
              onClick={() => setTimePerQuestion(t)}
            >
              {t}s
            </button>
          ))}
        </div>
      </div>

      <div className="setup-section">
        <span className="setup-label">Visibility</span>
        <div className="pill-row">
          <button type="button" className={`pill ${isPrivate ? "pill-active" : ""}`} onClick={() => setIsPrivate(true)}>
            Private
          </button>
          <button type="button" className={`pill ${!isPrivate ? "pill-active" : ""}`} onClick={() => setIsPrivate(false)}>
            Public
          </button>
        </div>
      </div>

      <div className="nav-row">
        <button type="button" className="secondary" onClick={onBack}>
          ← Back
        </button>
        <button type="button" className="generate-btn" onClick={handleCreate} disabled={loading} style={{ flex: 1 }}>
          {loading ? (
            <span className="btn-spinner-row">
              <span className="btn-spinner"></span>Generating Questions...
            </span>
          ) : (
            "Create Battle"
          )}
        </button>
      </div>
    </div>
  );
}