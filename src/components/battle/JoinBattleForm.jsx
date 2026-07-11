import { useState } from "react";
import { joinBattleByCode } from "./battleApi";

export default function JoinBattleForm({ initialCode, onBack, onJoined, onError }) {
  const [code, setCode] = useState(initialCode || "");
  const [loading, setLoading] = useState(false);

  async function handleJoin() {
    if (!code.trim()) return;
    setLoading(true);
    onError("");
    try {
      const roomId = await joinBattleByCode(code);
      onJoined(roomId);
    } catch (err) {
      console.error(err);
      onError(err.message || "Could not join that battle.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="quiz-setup">
      <div className="setup-section">
        <span className="setup-label">Battle Code</span>
        <input
          type="text"
          className="time-limit-input"
          style={{ width: "100%", textTransform: "uppercase" }}
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="ABCD1234"
          maxLength={8}
        />
      </div>
      <div className="nav-row">
        <button type="button" className="secondary" onClick={onBack}>
          ← Back
        </button>
        <button type="button" className="generate-btn" onClick={handleJoin} disabled={loading || !code.trim()} style={{ flex: 1 }}>
          {loading ? "Joining..." : "Join Battle"}
        </button>
      </div>
    </div>
  );
}