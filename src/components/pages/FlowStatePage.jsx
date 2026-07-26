import { Timer } from "lucide-react";
import { useState } from "react";

export default function FlowStatePage() {
  const [timeLeft, setTimeLeft] = useState(1500); // 25 minutes

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <main className="feature-page">
      <header className="feature-page-header">
        <div>
          <span className="setup-label">FLOW_PAGE</span>
          <h3 className="feature-page-title">Flow State</h3>
          <p className="feature-page-copy">Deep focus productivity timer with smart study intervals.</p>
        </div>
        <div className="feature-page-icon" aria-hidden="true">
          <Timer size={28} />
        </div>
      </header>

      <div className="study-input-panel">
        <div style={{ textAlign: "center", padding: "2rem 1.25rem", background: "var(--surface)", borderRadius: "1rem", border: "1px solid var(--border)" }}>
          <div style={{ fontSize: "3.5rem", fontFamily: "'JetBrains Mono', monospace", fontWeight: "700", color: "var(--accent)", marginBottom: "1.5rem" }}>
            {formatTime(timeLeft)}
          </div>
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
            <button type="button" className="generate-btn" style={{ width: "auto", minWidth: "120px" }}>
              Start Focus
            </button>
            <button type="button" className="secondary">
              Pause
            </button>
            <button type="button" className="secondary">
              Reset
            </button>
          </div>

          <div style={{ marginTop: "2rem", paddingTop: "1.5rem", borderTop: "1px solid var(--border)" }}>
            <span className="setup-label" style={{ marginBottom: "0.75rem", display: "block" }}>Ambience</span>
            <div className="pill-row pill-row-wrap" style={{ justifyContent: "center" }}>
              {["None", "Rain", "Cafe", "Forest"].map((amb) => (
                <button key={amb} className="pill" type="button">
                  {amb}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
