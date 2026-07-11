import { getWeakTopics } from "../utils/weakTopics";

export default function QuizSummary({ summary, onGenerateFlashcardsForTopic, onRetake, onSaveResult, saveStatus }) {
  const weak = getWeakTopics();

  function formatTime(s) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}m ${sec}s`;
  }

  return (
    <div className="quiz-summary">
      <h3 className="summary-title">Quiz Complete</h3>

      <div className="summary-stats">
        <div className="summary-stat">
          <span className="summary-stat-value">{summary.score}/{summary.total}</span>
          <span className="summary-stat-label">Score</span>
        </div>
        <div className="summary-stat">
          <span className="summary-stat-value">{summary.accuracy}%</span>
          <span className="summary-stat-label">Accuracy</span>
        </div>
        <div className="summary-stat">
          <span className="summary-stat-value">{formatTime(summary.timeTakenSeconds)}</span>
          <span className="summary-stat-label">Time Taken</span>
        </div>
      </div>

      {summary.timedOut && <p className="setup-warning">Time ran out before you finished all questions.</p>}

      {summary.weakTopicsThisSession.length > 0 && (
        <div className="summary-section">
          <span className="setup-label">Weak topics this session</span>
          <div className="pill-row pill-row-wrap">
            {summary.weakTopicsThisSession.map((t) => <span key={t} className="pill">{t}</span>)}
          </div>
        </div>
      )}

      {weak.length > 0 && (
        <div className="summary-section">
          <span className="setup-label">Needs Practice (across sessions)</span>
          <div className="needs-practice-list">
            {weak.map((w) => (
              <div key={w.topic} className="needs-practice-item">
                <div>
                  <p className="revision-title">{w.topic}</p>
                  <p className="revision-content">{w.wrong}/{w.attempts} wrong · {Math.round(w.wrongRate * 100)}% miss rate</p>
                </div>
                <button className="secondary" onClick={() => onGenerateFlashcardsForTopic(w.topic)}>Practice</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flashcard-actions mt-4">
        <button className="secondary" onClick={onSaveResult}>
          Save results
        </button>
        <button className="generate-btn" onClick={onRetake}>Take Another Quiz</button>
      </div>

      {saveStatus && <p className="mt-2 text-sm mono text-center">{saveStatus}</p>}
    </div>
  );
}