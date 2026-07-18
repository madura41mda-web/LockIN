import { Play, Pause, RotateCcw, SkipForward, CheckCircle, Volume2, VolumeX } from "lucide-react";

export const TIMER_MODES = {
  pomodoro_25: {
    name: "Pomodoro (25/5)",
    study: 25,
    break: 5,
    recommendation: "Quick Revision",
    explanation: "Great for rapid memory recall, flashcards, or last-minute quick reviews.",
  },
  pomodoro_50: {
    name: "Pomodoro (50/10)",
    study: 50,
    break: 10,
    recommendation: "Medium Study Session",
    explanation: "Ideal for general subject comprehension, solving quizzes, or structured reading.",
  },
  method_52: {
    name: "52/17 Method",
    study: 52,
    break: 17,
    recommendation: "Long Reading Sessions",
    explanation: "Optimized break ratio to maintain high cognitive stamina during extensive text reviews.",
  },
  deep_90: {
    name: "Deep Focus (90/20)",
    study: 90,
    break: 20,
    recommendation: "Deep Concentration",
    explanation: "Best suited for advanced derivations, complex programming, or intense analytical writing.",
  },
  custom: {
    name: "Custom Timer",
    study: 25,
    break: 5,
    recommendation: "Tailored Focus",
    explanation: "Configure your own custom study blocks and breaks to match your personal circadian rhythm.",
  },
};

export default function FlowState({
  activeMode,
  setActiveMode,
  customStudy,
  setCustomStudy,
  customBreak,
  setCustomBreak,
  isBreak,
  setIsBreak,
  timeLeft,
  setTimeLeft,
  duration,
  setDuration,
  isRunning,
  setIsRunning,
  sessionCount,
  setSessionCount,
  targetEndTime,
  setTargetEndTime,
  activeSound,
  setActiveSound,
  isPlayingSound,
  setIsPlayingSound,
  volume,
  setVolume,
  isMuted,
  setIsMuted,
}) {
  const resetTimer = (mode = activeMode) => {
    setIsRunning(false);
    setIsBreak(false);
    setTargetEndTime(null);
    const mins = mode === "custom" ? customStudy : TIMER_MODES[mode].study;
    setTimeLeft(mins * 60);
    setDuration(mins * 60);
  };

  const handleSkipBreak = () => {
    if (!isBreak) return;
    setIsBreak(false);
    const studySeconds = activeMode === "custom" ? customStudy * 60 : TIMER_MODES[activeMode].study * 60;
    setTimeLeft(studySeconds);
    setDuration(studySeconds);
    if (isRunning) {
      setTargetEndTime(Date.now() + studySeconds * 1000);
    } else {
      setTargetEndTime(null);
    }
  };

  const toggleTimer = () => {
    if (isRunning) {
      setIsRunning(false);
      setTargetEndTime(null);
    } else {
      setIsRunning(true);
      setTargetEndTime(Date.now() + timeLeft * 1000);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const currentModeInfo = TIMER_MODES[activeMode];
  const progressPercent = duration > 0 ? ((duration - timeLeft) / duration) * 100 : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-6 max-w-4xl mx-auto mt-4 text-left">
      {/* Mode selection & Recommendations */}
      <div className="md:col-span-2 flex flex-col gap-4">
        {/* Focus Modes Card */}
        <div className="quiz-setup" style={{ maxWidth: "100%", width: "100%" }}>
          <span className="setup-label">Focus Modes</span>
          <div className="flex flex-col gap-2">
            {Object.entries(TIMER_MODES).map(([key, value]) => (
              <button
                key={key}
                type="button"
                className={`pill text-left justify-start py-3 px-4 rounded-xl border flex items-center justify-between ${
                  activeMode === key ? "pill-active font-semibold" : ""
                }`}
                onClick={() => {
                  setActiveMode(key);
                  // Trigger reset directly
                  setIsRunning(false);
                  setIsBreak(false);
                  setTargetEndTime(null);
                  const mins = key === "custom" ? customStudy : value.study;
                  setTimeLeft(mins * 60);
                  setDuration(mins * 60);
                }}
                style={{ width: "100%", textTransform: "none", borderRadius: "0.75rem" }}
              >
                <span>{value.name}</span>
                {activeMode === key && <CheckCircle size={14} />}
              </button>
            ))}
          </div>
        </div>

        {/* Ambient Focus Sounds Card */}
        <div className="quiz-setup" style={{ maxWidth: "100%", width: "100%" }}>
          <span className="setup-label">Focus Sounds</span>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase font-mono tracking-wider" style={{ color: "var(--text-muted)" }}>
                Background Ambience
              </label>
              <select
                className="time-limit-input"
                style={{ width: "100%", padding: "0.5rem", borderRadius: "0.5rem" }}
                value={activeSound}
                onChange={(e) => {
                  const sound = e.target.value;
                  setActiveSound(sound);
                  if (sound) {
                    setIsPlayingSound(true);
                  } else {
                    setIsPlayingSound(false);
                  }
                }}
              >
                <option value="">None (No Ambience)</option>
                <option value="rain">🌧️ Rain Shower</option>
                <option value="forest">🌲 Forest Wind</option>
                <option value="ocean">🌊 Ocean Waves</option>
                <option value="fireplace">🔥 Crackling Fire</option>
                <option value="instrumental">🎵 Calm Instrumental</option>
              </select>
            </div>

            {activeSound && (
              <div className="flex flex-col gap-2 mt-1">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    className="pill flex items-center justify-center gap-1.5 py-1 px-3"
                    onClick={() => setIsPlayingSound(!isPlayingSound)}
                  >
                    {isPlayingSound ? (
                      <>
                        <Pause size={12} />
                        <span>Pause Audio</span>
                      </>
                    ) : (
                      <>
                        <Play size={12} />
                        <span>Play Audio</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    className="pill flex items-center justify-center p-2"
                    onClick={() => setIsMuted(!isMuted)}
                    title={isMuted ? "Unmute" : "Mute"}
                    style={{ borderRadius: "50%" }}
                  >
                    {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                  </button>
                </div>

                <div className="flex flex-col gap-1 mt-1">
                  <div className="flex justify-between text-[9px] font-mono" style={{ color: "var(--text-muted)" }}>
                    <span>Volume</span>
                    <span>{Math.round(volume * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={volume}
                    onChange={(e) => {
                      setVolume(parseFloat(e.target.value));
                      if (isMuted) setIsMuted(false);
                    }}
                    style={{
                      width: "100%",
                      accentColor: "var(--accent)",
                      cursor: "pointer",
                      height: "4px",
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Dynamic Study Recommendation card */}
        <div className="quiz-setup" style={{ maxWidth: "100%", width: "100%" }}>
          <span className="setup-label">Smart Recommendation</span>
          <div className="flex flex-col gap-2 mt-1">
            <h4 className="font-bold text-sm tracking-wider" style={{ color: "var(--accent)" }}>
              ★ Recommended For: {currentModeInfo.recommendation}
            </h4>
            <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)", margin: 0 }}>
              {currentModeInfo.explanation}
            </p>
          </div>
        </div>

        {/* Custom Configuration Panel */}
        {activeMode === "custom" && (
          <div className="quiz-setup" style={{ maxWidth: "100%", width: "100%" }}>
            <span className="setup-label">Custom Configuration</span>
            <div className="grid grid-cols-2 gap-4 mt-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-mono tracking-wider" style={{ color: "var(--text-muted)" }}>
                  Study (mins)
                </label>
                <input
                  type="number"
                  min="1"
                  max="180"
                  className="time-limit-input"
                  style={{ width: "100%" }}
                  value={customStudy}
                  onChange={(e) => {
                    const val = Math.max(1, parseInt(e.target.value) || 1);
                    setCustomStudy(val);
                    if (!isRunning) {
                      setTimeLeft(val * 60);
                      setDuration(val * 60);
                    }
                  }}
                  disabled={isRunning}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-mono tracking-wider" style={{ color: "var(--text-muted)" }}>
                  Break (mins)
                </label>
                <input
                  type="number"
                  min="1"
                  max="60"
                  className="time-limit-input"
                  style={{ width: "100%" }}
                  value={customBreak}
                  onChange={(e) => {
                    const val = Math.max(1, parseInt(e.target.value) || 1);
                    setCustomBreak(val);
                  }}
                  disabled={isRunning}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Timer Display */}
      <div className="md:col-span-3 flex flex-col justify-start">
        <div className="quiz-setup" style={{ maxWidth: "100%", width: "100%", padding: "2.25rem 2rem" }}>
          {/* Status Bar */}
          <div className="flex justify-between items-center mb-1">
            <span
              className="px-3 py-1 font-semibold rounded-full text-xs uppercase font-mono tracking-wider"
              style={{
                background: isBreak ? "rgba(34, 197, 94, 0.15)" : "rgba(249, 115, 22, 0.15)",
                color: isBreak ? "#22c55e" : "var(--accent)",
                border: `1px solid ${isBreak ? "#22c55e" : "var(--accent)"}`,
              }}
            >
              {isBreak ? "Break Interval" : "Study Interval"}
            </span>
            <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
              Sessions Completed: {sessionCount}
            </span>
          </div>

          {/* Large Countdown display */}
          <div
            className="text-center font-mono my-6 tracking-wide select-none"
            style={{
              fontSize: "5.5rem",
              fontWeight: "700",
              color: "var(--text)",
              textShadow: "0 0 10px rgba(255,180,84,0.1)",
              lineHeight: "1.1",
            }}
          >
            {formatTime(timeLeft)}
          </div>

          {/* Progress Tracker */}
          <div className="setup-section mb-6">
            <div className="battle-progress-track" style={{ maxWidth: "100%", width: "100%", height: "8px", margin: 0 }}>
              <div
                className="battle-progress-fill"
                style={{
                  width: `${progressPercent}%`,
                  background: isBreak ? "#22c55e" : "var(--accent)",
                }}
              />
            </div>
            <div className="flex justify-between text-[10px] font-mono mt-1" style={{ color: "var(--text-muted)" }}>
              <span>Elapsed: {formatTime(duration - timeLeft)}</span>
              <span>Total Duration: {formatTime(duration)}</span>
            </div>
          </div>

          {/* Controls Bar */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="generate-btn flex items-center justify-center gap-2"
              onClick={toggleTimer}
              style={{ flex: 1, marginTop: 0 }}
            >
              {isRunning ? (
                <>
                  <Pause size={16} /> Pause
                </>
              ) : (
                <>
                  <Play size={16} /> {timeLeft < duration ? "Resume" : "Start Focus"}
                </>
              )}
            </button>

            <button
              type="button"
              className="secondary flex items-center justify-center gap-2"
              onClick={() => resetTimer()}
              style={{ padding: "0.95rem 1.2rem", borderRadius: "0.85rem" }}
              title="Reset current interval"
            >
              <RotateCcw size={16} /> Reset
            </button>

            {isBreak && (
              <button
                type="button"
                className="secondary flex items-center justify-center gap-2"
                onClick={handleSkipBreak}
                style={{ padding: "0.95rem 1.2rem", borderRadius: "0.85rem" }}
              >
                <SkipForward size={16} /> Skip Break
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
