import { useEffect, useRef, useState } from "react";
import { joinBattleByCode } from "./battleApi";

export default function JoinBattleForm({ initialCode, onBack, onJoined, onError }) {
  const [code, setCode] = useState(initialCode || "");
  const [loading, setLoading] = useState(false);
  const autoJoinedRef = useRef(false);

  async function handleJoin(codeToJoin) {
    const target = (codeToJoin ?? code).trim();
    if (!target) return;
    setLoading(true);
    onError("");
    try {
      const roomId = await joinBattleByCode(target);
      onJoined(roomId);
    } catch (err) {
      console.error(err);
      onError(
        err.message?.includes("row")
          ? "That battle code doesn't exist or has already started."
          : err.message || "Could not join that battle."
      );
    } finally {
      setLoading(false);
    }
  }

  // Coming in from an invite link should join automatically instead of
  // making the person click "Join Battle" again for a code they already have.
  useEffect(() => {
    if (initialCode && !autoJoinedRef.current) {
      autoJoinedRef.current = true;
      handleJoin(initialCode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCode]);

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
        <button type="button" className="generate-btn" onClick={() => handleJoin()} disabled={loading || !code.trim()} style={{ flex: 1 }}>
          {loading ? "Joining..." : "Join Battle"}
        </button>
      </div>
    </div>
  );
}