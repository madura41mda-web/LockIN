import { Swords } from "lucide-react";

export default function BattleModePage() {
  return (
    <main className="feature-page">
      <header className="feature-page-header">
        <div>
          <span className="setup-label">BATTLE_PAGE</span>
          <h3 className="feature-page-title">Battle Mode</h3>
          <p className="feature-page-copy">Challenge a friend to a live 1v1 quiz in real-time.</p>
        </div>
        <div className="feature-page-icon" aria-hidden="true">
          <Swords size={28} />
        </div>
      </header>

      <div className="study-input-panel">
        <div className="quiz-setup">
          <div className="setup-section">
            <span className="setup-label">Create or Join Battle</span>
            <div style={{ display: "flex", gap: "0.75rem", flexDirection: "column" }}>
              <button type="button" className="generate-btn">
                Create Battle
              </button>
              <input
                type="text"
                placeholder="Enter battle code..."
                className="time-limit-input"
                style={{ width: "100%", padding: "0.8rem" }}
              />
              <button type="button" className="secondary" style={{ width: "100%" }}>
                Join Battle
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
