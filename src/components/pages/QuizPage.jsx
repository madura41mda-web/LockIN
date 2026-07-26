import { Brain } from "lucide-react";

export default function QuizPage() {
  return (
    <main className="feature-page">
      <header className="feature-page-header">
        <div>
          <span className="setup-label">QUIZ_PAGE</span>
          <h3 className="feature-page-title">Quiz Practice</h3>
          <p className="feature-page-copy">Create exam-style questions with answers and explanations.</p>
        </div>
        <div className="feature-page-icon" aria-hidden="true">
          <Brain size={28} />
        </div>
      </header>

      <div className="study-input-panel">
        <div className="quiz-setup">
          <div className="setup-section">
            <span className="setup-label">Question Count</span>
            <div className="pill-row pill-row-wrap">
              {[5, 10, 15, 20].map((num) => (
                <button key={num} className="pill" type="button">
                  {num} Questions
                </button>
              ))}
            </div>
          </div>

          <div className="setup-section">
            <span className="setup-label">Difficulty</span>
            <div className="pill-row pill-row-wrap">
              {["Easy", "Medium", "Hard", "Mixed"].map((diff) => (
                <button key={diff} className="pill" type="button">
                  {diff}
                </button>
              ))}
            </div>
          </div>

          <button type="button" className="generate-btn">
            Start Quiz
          </button>
        </div>
      </div>
    </main>
  );
}
