import { useState } from "react";

const QUESTION_TYPES = [
  { id: "mcq", label: "Multiple Choice" },
  { id: "true_false", label: "True / False" },
  { id: "fill_blank", label: "Fill in the Blank" },
  { id: "short_answer", label: "Short Answer" },
  { id: "numerical", label: "Numerical" },
  { id: "select_all", label: "Select All" },
];

export default function QuizSetup({ onStart, loading }) {
  const [difficulty, setDifficulty] = useState("medium");
  const [types, setTypes] = useState(["mcq"]);
  const [order, setOrder] = useState("shuffle");
  const [mode, setMode] = useState("practice");
  const [timeLimit, setTimeLimit] = useState(15);

  function toggleType(id) {
    setTypes((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  }

  function handleStart() {
    if (types.length === 0) return;
    onStart({ difficulty, types, order, mode, timeLimit: mode === "exam" ? timeLimit : null });
  }

  return (
    <div className="quiz-setup">
      <div className="setup-section">
        <span className="setup-label">Difficulty</span>
        <div className="pill-row">
          {["easy", "medium", "hard"].map((d) => (
            <button key={d} className={`pill ${difficulty === d ? "pill-active" : ""}`} onClick={() => setDifficulty(d)}>
              {d}
            </button>
          ))}
        </div>
      </div>

      <div className="setup-section">
        <span className="setup-label">Question Types</span>
        <div className="pill-row pill-row-wrap">
          {QUESTION_TYPES.map((t) => (
            <button key={t.id} className={`pill ${types.includes(t.id) ? "pill-active" : ""}`} onClick={() => toggleType(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="setup-section">
        <span className="setup-label">Order</span>
        <div className="pill-row">
          {["shuffle", "sequential"].map((o) => (
            <button key={o} className={`pill ${order === o ? "pill-active" : ""}`} onClick={() => setOrder(o)}>
              {o}
            </button>
          ))}
        </div>
      </div>

      <div className="setup-section">
        <span className="setup-label">Mode</span>
        <div className="pill-row">
          {["practice", "exam"].map((m) => (
            <button key={m} className={`pill ${mode === m ? "pill-active" : ""}`} onClick={() => setMode(m)}>
              {m}
            </button>
          ))}
        </div>
        {mode === "exam" && (
          <div className="time-limit-row">
            <label className="setup-label">Minutes</label>
            <input
              type="number"
              min="1"
              value={timeLimit}
              onChange={(e) => setTimeLimit(Number(e.target.value))}
              className="time-limit-input"
            />
          </div>
        )}
      </div>

      {types.length === 0 && <p className="setup-warning">Select at least one question type.</p>}

      <button className="generate-btn" onClick={handleStart} disabled={loading || types.length === 0}>
        {loading ? (
          <span className="btn-spinner-row"><span className="btn-spinner"></span>Generating...</span>
        ) : (
          "Start Quiz"
        )}
      </button>
    </div>
  );
}