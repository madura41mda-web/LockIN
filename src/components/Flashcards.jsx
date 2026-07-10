import { useEffect, useState } from "react";

function formatSource(card, moduleName) {
  const rawSource = card.source ?? card.page;
  if (rawSource === undefined || rawSource === null || String(rawSource).trim() === "") {
    return moduleName || "";
  }

  const value = String(rawSource).trim();
  const location = /^(page|slide)\s+/i.test(value) ? value : `Page ${value}`;
  return moduleName ? `${moduleName} - ${location}` : location;
}

export default function Flashcards({
  cards,
  moduleName,
  onGenerateNew,
  onGenerateMore,
  loadingMore,
  endMessage,
}) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    setIndex((currentIndex) => Math.min(currentIndex, Math.max(cards.length - 1, 0)));
    setFlipped(false);
  }, [cards.length]);

  if (!cards || cards.length === 0) return null;

  const card = cards[index];
  const source = formatSource(card, moduleName);

  function next() {
    setFlipped(false);
    setIndex((i) => (i + 1) % cards.length);
  }

  function prev() {
    setFlipped(false);
    setIndex((i) => (i - 1 + cards.length) % cards.length);
  }

  return (
    <div className="card-stage">
      <div className="flashcard-wrap">
        <div
          className={`flashcard-3d ${flipped ? "is-flipped" : ""}`}
          onClick={() => setFlipped((f) => !f)}
        >
          <div className="flashcard-face flashcard-front">
            <span className="label">Question</span>
            <span className="card-text">{card.question}</span>
            <span className="tap-hint">Tap to reveal answer</span>
          </div>
          <div className="flashcard-face flashcard-back">
            <span className="label label-answer">Answer</span>
            <span className="card-text">{card.answer}</span>
            {source && (
              <span className="source-note">Source: {source}</span>
            )}
          </div>
        </div>
      </div>

      <div className="nav-row">
        <button type="button" className="secondary" onClick={prev}>Prev</button>
        <span className="counter">{index + 1} / {cards.length}</span>
        <button type="button" className="secondary" onClick={next}>Next</button>
      </div>

      <div className="flashcard-actions">
        <button type="button" className="secondary" onClick={onGenerateNew} disabled={loadingMore}>
          New set
        </button>
        <button type="button" className="secondary" onClick={onGenerateMore} disabled={loadingMore || Boolean(endMessage)}>
          {loadingMore ? "Generating..." : "More cards"}
        </button>
      </div>

      {endMessage && <p className="flashcard-end-message">{endMessage}</p>}
    </div>
  );
}
