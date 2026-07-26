import { useState } from "react";
import { BookOpen } from "lucide-react";

const SAMPLE_FLASHCARDS = [
  {
    id: 1,
    question: "What is polymorphism?",
    answer: "Polymorphism allows the same interface to represent different underlying forms or implementations.",
  },
  {
    id: 2,
    question: "What is encapsulation?",
    answer: "Encapsulation groups data and methods together while restricting direct access to internal state.",
  },
  {
    id: 3,
    question: "What is inheritance?",
    answer: "Inheritance allows one class to reuse and extend the behavior of another class.",
  },
];

export default function FlashcardsPage() {
  const [file, setFile] = useState(null);
  const [showCards, setShowCards] = useState(false);
  const [flipped, setFlipped] = useState({});

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const handleGenerate = () => {
    if (file) {
      setShowCards(true);
    }
  };

  const toggleFlip = (cardId) => {
    setFlipped((prev) => ({
      ...prev,
      [cardId]: !prev[cardId],
    }));
  };

  return (
    <main className="feature-page">
      <header className="feature-page-header">
        <div>
          <span className="setup-label">FLASHCARDS_PAGE</span>
          <h3 className="feature-page-title">Flashcard Studio</h3>
          <p className="feature-page-copy">Turn your notes into focused question and answer cards.</p>
        </div>
        <div className="feature-page-icon" aria-hidden="true">
          <BookOpen size={28} />
        </div>
      </header>

      <div className="study-input-panel">
        <div className="upload-box">
          <div className="upload-row">
            <button
              type="button"
              className="attach-btn"
              onClick={() => document.getElementById("file-input").click()}
            >
              📎
            </button>
            <input
              id="file-input"
              type="file"
              accept=".pdf,.pptx,.txt,.md"
              onChange={handleFileSelect}
              style={{ display: "none" }}
            />
            <span className="upload-text-input" style={{ display: "block", padding: "0.5rem", color: file ? "var(--text)" : "var(--text-muted)" }}>
              {file ? file.name : "Attach PDF, PPTX, TXT, MD, or paste notes here..."}
            </span>
          </div>
          {file && (
            <div className="file-chip">
              <span className="file-chip-name">{file.name}</span>
              <button
                type="button"
                className="file-chip-remove"
                onClick={() => setFile(null)}
              >
                ✕
              </button>
            </div>
          )}
        </div>

        <button
          type="button"
          className="generate-btn"
          onClick={handleGenerate}
          disabled={!file}
        >
          Generate Flashcards
        </button>
      </div>

      {showCards && (
        <div className="card-stage">
          <h4 style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginTop: "1.5rem" }}>
            Sample Flashcards
          </h4>
          {SAMPLE_FLASHCARDS.map((card) => (
            <div
              key={card.id}
              className="flashcard-wrap"
              onClick={() => toggleFlip(card.id)}
            >
              <div
                className={`flashcard-3d ${flipped[card.id] ? "is-flipped" : ""}`}
              >
                <div className="flashcard-face">
                  <span className="label">QUESTION</span>
                  <div className="card-text">{card.question}</div>
                  <span className="tap-hint">Click to reveal answer</span>
                </div>
                <div className="flashcard-face flashcard-back">
                  <span className="label">ANSWER</span>
                  <div className="card-text">{card.answer}</div>
                  <span className="tap-hint">Click to flip back</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
