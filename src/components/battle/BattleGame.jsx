import { useEffect, useRef, useState } from "react";
import { supabase } from "../../supabaseClient";
import { submitAnswer, advanceQuestion } from "./battleApi";

export default function BattleGame({ room, myPlayer, opponent, userId }) {
  const [question, setQuestion] = useState(null);
  const [phase, setPhase] = useState("question"); // question | reveal
  const [selected, setSelected] = useState(null);
  const [myResult, setMyResult] = useState(null);
  const [opponentAnswered, setOpponentAnswered] = useState(false);
  const [timeLeft, setTimeLeft] = useState(room.time_per_question);
  const advancingRef = useRef(false);

  const questionIndex = room.current_question_index;

  useEffect(() => {
    let active = true;
    setSelected(null);
    setMyResult(null);
    setOpponentAnswered(false);
    setPhase("question");
    advancingRef.current = false;

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
    if (selected !== null && opponentAnswered) setPhase("reveal");
  }, [selected, opponentAnswered]);

  useEffect(() => {
    if (phase !== "reveal" || advancingRef.current) return;
    advancingRef.current = true;
    const t = setTimeout(() => {
      advanceQuestion(room.id, questionIndex).catch(console.error);
    }, 4000);
    return () => clearTimeout(t);
  }, [phase, room.id, questionIndex]);

  async function handleAnswer(optionIndex) {
    if (selected !== null || phase !== "question") return;
    setSelected(optionIndex);
    try {
      const result = await submitAnswer(room.id, questionIndex, optionIndex);
      setMyResult(result);
    } catch (err) {
      console.error(err);
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
                disabled={selected !== null || phase === "reveal"}
                onClick={() => handleAnswer(i)}
              >
                {opt}
              </button>
            );
          })}
        </div>

        {phase === "question" && opponentAnswered && selected === null && (
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