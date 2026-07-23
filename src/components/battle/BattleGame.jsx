import { useEffect, useRef, useState } from "react";
import { supabase } from "../../supabaseClient";
import { submitAnswer, advanceQuestion } from "./battleApi";

export default function BattleGame({ room, myPlayer, opponent, userId }) {
  const [question, setQuestion] = useState(null);
  const [phase, setPhase] = useState("question"); // question | reveal
  const [selected, setSelected] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [myResult, setMyResult] = useState(null);
  const [opponentAnswered, setOpponentAnswered] = useState(false);
  const [timeLeft, setTimeLeft] = useState(room.time_per_question);
  const [battleError, setBattleError] = useState("");
  const advancingRef = useRef(false);
  const submittingRef = useRef(false);
  const submittedRef = useRef(false);
  const selectedRef = useRef(null);

  const questionIndex = room.current_question_index;

  function playBattleSound(type) {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      const now = audioCtx.currentTime;

      if (type === "click") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(600, now);
        gain.gain.setValueAtTime(0.04, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        osc.start(now);
        osc.stop(now + 0.06);
      } else if (type === "submit") {
        osc.type = "triangle";
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(800, now + 0.12);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc.start(now);
        osc.stop(now + 0.13);
      } else if (type === "correct") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.35);
      } else if (type === "incorrect") {
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.linearRampToValueAtTime(100, now + 0.22);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc.start(now);
        osc.stop(now + 0.25);
      }
    } catch (e) {
      console.error("Audio synthesis failed:", e);
    }
  }

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  useEffect(() => {
    if (myResult) {
      playBattleSound(myResult.is_correct ? "correct" : "incorrect");
    }
  }, [myResult]);

  useEffect(() => {
    let active = true;
    setSelected(null);
    setSubmitted(false);
    setMyResult(null);
    setOpponentAnswered(false);
    setPhase("question");
    setBattleError("");
    advancingRef.current = false;
    submittingRef.current = false;
    submittedRef.current = false;

    async function loadQuestion() {
      const { data } = await supabase
        .from("battle_questions")
        .select("*")
        .eq("room_id", room.id)
        .eq("question_index", questionIndex)
        .single();
      if (active) setQuestion(data);
    }
    loadQuestion();

    return () => {
      active = false;
    };
  }, [room.id, questionIndex]);

  useEffect(() => {
    if (!room.current_question_started_at) return;
    const startedAt = new Date(room.current_question_started_at).getTime();

    function tick() {
      const elapsed = (Date.now() - startedAt) / 1000;
      const remaining = Math.max(0, room.time_per_question - elapsed);
      setTimeLeft(remaining);
      if (remaining <= 0) {
        // Timer ran out: auto-submit whatever (if anything) was selected so the
        // server always has an answer row for this question, then reveal.
        if (!submittedRef.current) {
          doSubmit(selectedRef.current);
        }
        setPhase((p) => (p === "question" ? "reveal" : p));
      }
    }

    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [room.current_question_started_at, room.time_per_question]);

  useEffect(() => {
    if (!opponent) return;
    const channel = supabase
      .channel(`battle-answers-${room.id}-${questionIndex}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "battle_answers", filter: `room_id=eq.${room.id}` },
        (payload) => {
          if (payload.new.question_index !== questionIndex) return;
          if (payload.new.player_id === opponent.id) setOpponentAnswered(true);
        }
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [room.id, questionIndex, opponent]);

  useEffect(() => {
    if (submitted && opponentAnswered) setPhase("reveal");
  }, [submitted, opponentAnswered]);

  useEffect(() => {
    if (phase !== "reveal" || advancingRef.current) return;
    advancingRef.current = true;

    // advance_question is optimistic-concurrency: only the first caller for a
    // given expectedIndex actually moves the room forward, the other client's
    // call is a harmless no-op. If it fails for a real reason (network blip,
    // RLS, etc.) we retry a couple of times and surface an error instead of
    // leaving both players silently stuck on the same question.
    let cancelled = false;
    async function tryAdvance(attempt) {
      try {
        await advanceQuestion(room.id, questionIndex);
      } catch (err) {
        console.error("advanceQuestion failed", err);
        if (cancelled) return;
        if (attempt < 3) {
          setTimeout(() => tryAdvance(attempt + 1), 1000);
        } else {
          setBattleError(
            "Having trouble syncing to the next question. If this doesn't resolve in a few seconds, try leaving and rejoining the battle."
          );
        }
      }
    }

    const t = setTimeout(() => tryAdvance(0), 4000);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [phase, room.id, questionIndex]);

  function selectOption(optionIndex) {
    if (submitted || phase !== "question") return;
    playBattleSound("click");
    setSelected(optionIndex);
  }

  async function doSubmit(optionIndex) {
    if (submittingRef.current || submittedRef.current) return;
    submittingRef.current = true;
    playBattleSound("submit");
    // Lock the UI immediately so a slow network response can't leave a window
    // where the player could still change or re-submit their answer.
    submittedRef.current = true;
    setSubmitted(true);
    try {
      const result = await submitAnswer(room.id, questionIndex, optionIndex ?? -1);
      setMyResult(result);
    } catch (err) {
      console.error("submitAnswer failed", err);
      setBattleError("Couldn't submit your answer — it may not count for this question.");
    } finally {
      submittingRef.current = false;
    }
  }

  if (!question) {
    return (
      <main className="feature-page">
        <p className="mono text-center">Loading question...</p>
      </main>
    );
  }

  const correctIndex = Number(question.correct_answer);
  const myScore = myPlayer?.score ?? 0;
  const opponentScore = opponent?.score ?? 0;
  const progressPct = (questionIndex / room.question_count) * 100;

  return (
    <main className="feature-page">
      <div className="battle-hud">
        <div className="battle-hud-score">
          <span className="summary-stat-label">You</span>
          <span className="summary-stat-value">{myScore}</span>
        </div>
        <div className="battle-hud-mid">
          <span className="setup-label">
            Question {questionIndex + 1} / {room.question_count}
          </span>
          <div className="quiz-timer">{Math.ceil(timeLeft)}s</div>
        </div>
        <div className="battle-hud-score">
          <span className="summary-stat-label">Opponent</span>
          <span className="summary-stat-value">{opponentScore}</span>
        </div>
      </div>

      <div className="battle-progress-track">
        <div className="battle-progress-fill" style={{ width: `${progressPct}%` }} />
      </div>

      {battleError && (
        <p className="mono text-center" style={{ color: "var(--danger, #ef4444)", marginTop: "0.75rem" }}>
          {battleError}
        </p>
      )}

      <div className="quiz-card" style={{ margin: "1.5rem auto 0" }}>
        <p className="quiz-question">{question.question_text}</p>

        <div className="quiz-options">
          {(question.options || []).map((opt, i) => {
            let cls = "quiz-option";
            if (phase === "reveal") {
              if (i === correctIndex) cls += " quiz-option-correct";
              else if (i === selected) cls += " quiz-option-wrong";
            } else if (i === selected) {
              cls += " quiz-option-selected";
            }
            return (
              <button
                key={i}
                type="button"
                className={cls}
                disabled={submitted || phase === "reveal"}
                onClick={() => selectOption(i)}
              >
                {opt}
              </button>
            );
          })}
        </div>

        {phase === "question" && (
          <button
            type="button"
            className="generate-btn"
            style={{ width: "100%", marginTop: "1rem" }}
            disabled={selected === null || submitted}
            onClick={() => doSubmit(selected)}
          >
            {submitted ? "Answer Locked In" : "Submit Answer"}
          </button>
        )}

        {phase === "question" && opponentAnswered && !submitted && (
          <p className="mono text-center" style={{ color: "var(--accent)" }}>
            Opponent has answered...
          </p>
        )}

        {phase === "reveal" && (
          <div className="quiz-feedback">
            <p className={myResult?.is_correct ? "quiz-feedback-correct" : "quiz-feedback-wrong"}>
              {myResult
                ? myResult.is_correct
                  ? `Correct! +${myResult.points_earned}`
                  : "Incorrect"
                : "No answer submitted"}
            </p>
            {question.explanation && <p className="quiz-feedback-explanation">💡 {question.explanation}</p>}
            {question.source_reference && <p className="source-note">Source: page {question.source_reference}</p>}
          </div>
        )}
      </div>
    </main>
  );
}