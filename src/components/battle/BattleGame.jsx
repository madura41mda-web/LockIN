import { useEffect, useRef, useState } from "react";
import { supabase } from "../../supabaseClient";
import { submitAnswer, advanceQuestion } from "./battleApi";

export default function BattleGame({ room, myPlayer, opponent, userId, onRoomSnapshot }) {
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
  const isHost = room.host_id === userId;
  const authoritativePhase = room.round_phase || phase;
  const bothAnswersPersisted = Boolean(myResult) && opponentAnswered;
  const shouldCloseQuestion = timeLeft <= 0 || bothAnswersPersisted;
  const roundEndsAt = room.round_ends_at
    ? new Date(room.round_ends_at).getTime()
    : room.current_question_started_at
      ? new Date(room.current_question_started_at).getTime() + room.time_per_question * 1000
      : null;

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
    if (room.round_phase) setPhase(room.round_phase);
  }, [room.round_phase, questionIndex]);

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
      const { data, error } = await supabase
        .from("battle_questions")
        .select("*")
        .eq("room_id", room.id)
        .eq("question_index", questionIndex)
        .single();
      if (error) {
        console.error("Battle question load failed", {
          roomId: room.id,
          questionIndex,
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });
      }
      if (active) setQuestion(data);
    }
    async function loadAnswers() {
      const { data, error } = await supabase
        .from("battle_answers")
        .select("*")
        .eq("room_id", room.id)
        .eq("question_index", questionIndex);
      if (error) {
        console.error("Battle answers load failed", {
          roomId: room.id,
          questionIndex,
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });
        return;
      }
      if (!active) return;
      const answers = data || [];
      const myAnswer = answers.find((answer) => answer.player_id === myPlayer?.id);
      const opponentAnswer = answers.find((answer) => answer.player_id === opponent?.id);
      if (myAnswer) {
        setMyResult(myAnswer);
        setSubmitted(true);
        submittedRef.current = true;
        const selectedAnswer = Number(myAnswer.selected_answer);
        if (Number.isInteger(selectedAnswer) && selectedAnswer >= 0) setSelected(selectedAnswer);
      }
      if (opponentAnswer) setOpponentAnswered(true);
    }
    loadQuestion();
    loadAnswers();

    return () => {
      active = false;
    };
  }, [room.id, questionIndex, myPlayer?.id, opponent?.id]);

  useEffect(() => {
    if (!roundEndsAt) return;

    function tick() {
      const remaining = Math.max(0, (roundEndsAt - Date.now()) / 1000);
      setTimeLeft(remaining);
      if (remaining <= 0) {
        if (!room.round_phase) setPhase((p) => (p === "question" ? "reveal" : p));
      }
    }

    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [roundEndsAt, room.round_phase]);

  useEffect(() => {
    if (!opponent) return;
    const channel = supabase
      .channel(`battle-answers-${room.id}-${questionIndex}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "battle_answers", filter: `room_id=eq.${room.id}` },
        (payload) => {
          if (payload.new.question_index !== questionIndex) return;
          if (payload.new.player_id === myPlayer?.id) {
            setMyResult(payload.new);
            setSubmitted(true);
            submittedRef.current = true;
          }
          if (payload.new.player_id === opponent.id) setOpponentAnswered(true);
        }
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [room.id, questionIndex, myPlayer?.id, opponent]);

  useEffect(() => {
    if (bothAnswersPersisted && !room.round_phase) setPhase("reveal");
  }, [bothAnswersPersisted, room.round_phase]);

  useEffect(() => {
    if (!isHost || authoritativePhase !== "question") return;
    if (!shouldCloseQuestion) return;
    const advanceKey = `${room.id}:${questionIndex}:question`;
    if (advancingRef.current === advanceKey) return;
    advancingRef.current = advanceKey;
    let cancelled = false;
    let retryTimer = null;

    function scheduleRetry(attempt) {
      if (cancelled) return;
      if (advancingRef.current === advanceKey) advancingRef.current = false;
      retryTimer = setTimeout(() => {
        if (cancelled) return;
        if (advancingRef.current && advancingRef.current !== advanceKey) return;
        advancingRef.current = advanceKey;
        closeQuestion(attempt);
      }, 1000);
    }

    async function closeQuestion(attempt) {
      try {
        const result = await advanceQuestion(room.id, questionIndex, {
          status: room.status,
          phase: authoritativePhase,
          userId,
          hostId: room.host_id,
        });
        if (result?.roomSnapshot) onRoomSnapshot?.(result.roomSnapshot);
        console.info("Battle close-question attempt", {
          roomId: room.id,
          questionIndex,
          attempt,
          advanced: result?.advanced,
          roomSnapshot: result?.roomSnapshot,
          shouldCloseQuestion,
        });
        if (!result?.advanced && !cancelled) {
          const snapshotStillOnQuestion =
            result?.roomSnapshot?.status === "in_progress" &&
            result.roomSnapshot.current_question_index === questionIndex &&
            result.roomSnapshot.round_phase === "question";
          if (snapshotStillOnQuestion) {
            scheduleRetry(attempt + 1);
          } else if (advancingRef.current === advanceKey) {
            advancingRef.current = false;
          }
        }
      } catch (err) {
        if (cancelled) return;
        if (attempt < 3) {
          scheduleRetry(attempt + 1);
        } else {
          if (advancingRef.current === advanceKey) advancingRef.current = false;
          setBattleError(
            "Having trouble syncing to the next question. If this doesn't resolve in a few seconds, try leaving and rejoining the battle."
          );
        }
      }
    }
    closeQuestion(0);
    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
      if (advancingRef.current === advanceKey) advancingRef.current = false;
    };
  }, [isHost, authoritativePhase, shouldCloseQuestion, room.id, room.status, room.host_id, questionIndex, userId, onRoomSnapshot]);

  useEffect(() => {
    if (!isHost || authoritativePhase !== "reveal") return;
    const revealEndsAt = room.reveal_ends_at ? new Date(room.reveal_ends_at).getTime() : Date.now() + 3000;
    const delay = Math.max(0, revealEndsAt - Date.now());
    const advanceKey = `${room.id}:${questionIndex}:reveal`;
    if (advancingRef.current === advanceKey) return;
    advancingRef.current = advanceKey;

    let cancelled = false;
    let retryTimer = null;

    function scheduleRetry(attempt) {
      if (cancelled) return;
      if (advancingRef.current === advanceKey) advancingRef.current = false;
      retryTimer = setTimeout(() => {
        if (cancelled) return;
        if (advancingRef.current && advancingRef.current !== advanceKey) return;
        advancingRef.current = advanceKey;
        advanceAfterReveal(attempt);
      }, 1000);
    }

    async function advanceAfterReveal(attempt) {
      try {
        const result = await advanceQuestion(room.id, questionIndex, {
          status: room.status,
          phase: authoritativePhase,
          userId,
          hostId: room.host_id,
        });
        if (result?.roomSnapshot) onRoomSnapshot?.(result.roomSnapshot);
        console.info("Battle reveal advance attempt", {
          roomId: room.id,
          questionIndex,
          attempt,
          advanced: result?.advanced,
          roomSnapshot: result?.roomSnapshot,
          revealEndsAt: room.reveal_ends_at,
        });
        if (!result?.advanced && !cancelled) {
          const snapshotStillOnReveal =
            result?.roomSnapshot?.status === "in_progress" &&
            result.roomSnapshot.current_question_index === questionIndex &&
            result.roomSnapshot.round_phase === "reveal";
          if (snapshotStillOnReveal) {
            scheduleRetry(attempt + 1);
          } else if (advancingRef.current === advanceKey) {
            advancingRef.current = false;
          }
        }
      } catch (err) {
        if (cancelled) return;
        if (attempt < 3) {
          scheduleRetry(attempt + 1);
        } else {
          if (advancingRef.current === advanceKey) advancingRef.current = false;
          setBattleError(
            "Having trouble syncing to the next question. If this doesn't resolve in a few seconds, try leaving and rejoining the battle."
          );
        }
      }
    }

    const t = setTimeout(() => advanceAfterReveal(0), delay);
    return () => {
      cancelled = true;
      clearTimeout(t);
      clearTimeout(retryTimer);
      if (advancingRef.current === advanceKey) advancingRef.current = false;
    };
  }, [isHost, authoritativePhase, room.id, room.status, room.host_id, room.reveal_ends_at, questionIndex, userId, onRoomSnapshot]);

  function selectOption(optionIndex) {
    if (submitted || authoritativePhase !== "question") return;
    playBattleSound("click");
    setSelected(optionIndex);
  }

  async function doSubmit(optionIndex) {
    if (authoritativePhase !== "question") return;
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
  const noAnswerSubmitted = myResult?.selected_answer === "-1";

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
            if (authoritativePhase === "reveal") {
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
                disabled={submitted || authoritativePhase === "reveal"}
                onClick={() => selectOption(i)}
              >
                {opt}
              </button>
            );
          })}
        </div>

        {authoritativePhase === "question" && (
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

        {authoritativePhase === "question" && opponentAnswered && !submitted && (
          <p className="mono text-center" style={{ color: "var(--accent)" }}>
            Opponent has answered...
          </p>
        )}

        {authoritativePhase === "reveal" && (
          <div className="quiz-feedback">
            <p className={myResult?.is_correct ? "quiz-feedback-correct" : "quiz-feedback-wrong"}>
              {myResult
                ? noAnswerSubmitted
                  ? "No answer submitted"
                  : myResult.is_correct
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
