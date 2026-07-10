import { useState, useEffect, useMemo, useRef } from "react";
import { recordTopicResult } from "../utils/weakTopics";

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function formatSource(moduleName, page) {
  if (page === undefined || page === null || String(page).trim() === "") {
    return moduleName || "Source not available";
  }

  const value = String(page).trim();
  const location = /^(page|slide)\s+/i.test(value) ? value : `Page ${value}`;
  return moduleName ? `${moduleName} - ${location}` : location;
}

export default function Quiz({ questions, moduleName, order, mode, timeLimit, onFinish }) {
  const orderedQuestions = useMemo(
    () => (order === "shuffle" ? shuffleArray(questions) : questions),
    [questions, order]
  );

  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [selected, setSelected] = useState(null);
  const [fillAnswer, setFillAnswer] = useState("");
  const [selfAssessed, setSelfAssessed] = useState(null);
  const [results, setResults] = useState([]);
  const [secondsLeft, setSecondsLeft] = useState(timeLimit ? timeLimit * 60 : null);
  const startTimeRef = useRef(Date.now());
  const finishedRef = useRef(false);

  const q = orderedQuestions[index];
  const needsSelfAssessment = q.type === "short_answer" || q.type === "numerical";
  const canProceed = needsSelfAssessment ? selfAssessed !== null : revealed;

  useEffect(() => {
    if (mode !== "exam" || !timeLimit) return;
    const interval = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(interval);
          finishQuiz(true);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function formatTime(s) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  }

  function recordResult(correct) {
    setResults((prev) => [...prev, { topic: q.topic || "General", correct, type: q.type, page: q.page }]);
    recordTopicResult(q.topic || "General", correct);
  }

  function selectMcqOption(i) {
    if (revealed) return;
    setSelected(i);
    setRevealed(true);
    recordResult(i === q.correctIndex);
  }

  function toggleSelectAllOption(i) {
    if (revealed) return;
    setSelected((prev) => {
      const arr = prev || [];
      return arr.includes(i) ? arr.filter((x) => x !== i) : [...arr, i];
    });
  }

  function submitSelectAll() {
    if (revealed) return;
    const chosen = (selected || []).slice().sort();
    const correctSet = (q.correctIndices || []).slice().sort();
    const correct = chosen.length === correctSet.length && chosen.every((v, i) => v === correctSet[i]);
    setRevealed(true);
    recordResult(correct);
  }

  function submitFillBlank() {
    if (revealed) return;
    const normalized = fillAnswer.trim().toLowerCase();
    const acceptable = [q.correctAnswer, ...(q.acceptableAnswers || [])].filter(Boolean).map((a) => a.trim().toLowerCase());
    setRevealed(true);
    recordResult(acceptable.includes(normalized));
  }

  function revealOpenEnded() {
    setRevealed(true);
  }

  function selfAssess(correct) {
    setSelfAssessed(correct);
    recordResult(correct);
  }

  function resetQuestionState() {
    setRevealed(false);
    setSelected(null);
    setSelfAssessed(null);
    setFillAnswer("");
  }

  function goNext() {
    if (index + 1 >= orderedQuestions.length) {
      finishQuiz(false);
      return;
    }
    setIndex((i) => i + 1);
    resetQuestionState();
  }

  function finishQuiz(timedOut) {
    if (finishedRef.current) return;
    finishedRef.current = true;
    const timeTakenSeconds = Math.round((Date.now() - startTimeRef.current) / 1000);
    const totalAnswered = results.length;
    const correctCount = results.filter((r) => r.correct).length;
    const accuracy = totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 0;

    const topicMap = {};
    results.forEach((r) => {
      if (!topicMap[r.topic]) topicMap[r.topic] = { correct: 0, wrong: 0 };
      if (r.correct) topicMap[r.topic].correct += 1;
      else topicMap[r.topic].wrong += 1;
    });
    const weakTopicsThisSession = Object.entries(topicMap)
      .filter(([, v]) => v.wrong > v.correct)
      .map(([topic]) => topic);

    onFinish({
      score: correctCount,
      total: orderedQuestions.length,
      answered: totalAnswered,
      accuracy,
      timeTakenSeconds,
      timedOut,
      weakTopicsThisSession,
    });
  }

  const isLast = index + 1 >= orderedQuestions.length;
  const lastResult = results[results.length - 1];

  return (
    <div className="card-stage">
      {mode === "exam" && timeLimit && <div className="quiz-timer mono">⏱ {formatTime(secondsLeft)}</div>}

      <div className="quiz-card">
        <div className="quiz-card-header">
          <span className="label">Question {index + 1} of {orderedQuestions.length}</span>
          <span className="quiz-difficulty-tag">{q.difficulty}</span>
        </div>

        <p className="quiz-question">{q.question}</p>

        {(q.type === "mcq" || q.type === "true_false") && (
          <div className="quiz-options">
            {q.options.map((opt, i) => {
              let cls = "quiz-option";
              if (revealed && i === q.correctIndex) cls += " quiz-option-correct";
              else if (revealed && i === selected) cls += " quiz-option-wrong";
              else if (!revealed && i === selected) cls += " quiz-option-selected";
              return (
                <button key={i} className={cls} onClick={() => selectMcqOption(i)} disabled={revealed}>
                  {opt}
                </button>
              );
            })}
          </div>
        )}

        {q.type === "select_all" && (
          <div className="quiz-options">
            {q.options.map((opt, i) => {
              const isChecked = (selected || []).includes(i);
              let cls = "quiz-option quiz-option-checkbox";
              if (revealed && (q.correctIndices || []).includes(i)) cls += " quiz-option-correct";
              else if (revealed && isChecked) cls += " quiz-option-wrong";
              else if (!revealed && isChecked) cls += " quiz-option-selected";
              return (
                <button key={i} className={cls} onClick={() => toggleSelectAllOption(i)} disabled={revealed}>
                  {isChecked ? "☑" : "☐"} {opt}
                </button>
              );
            })}
            {!revealed && <button className="secondary submit-select-all" onClick={submitSelectAll}>Submit</button>}
          </div>
        )}

        {q.type === "fill_blank" && (
          <div className="fill-blank-row">
            <input
              type="text"
              className="fill-blank-input"
              placeholder="Type your answer..."
              value={fillAnswer}
              onChange={(e) => setFillAnswer(e.target.value)}
              disabled={revealed}
            />
            {!revealed && <button className="secondary" onClick={submitFillBlank}>Submit</button>}
          </div>
        )}

        {needsSelfAssessment && !revealed && (
          <button className="secondary" onClick={revealOpenEnded}>Show Model Answer</button>
        )}

        {revealed && (
          <div className="quiz-feedback">
            {needsSelfAssessment ? (
              <>
                <p className="quiz-feedback-answer mono">Model answer:</p>
                <p className="card-text">{q.modelAnswer}</p>
                {selfAssessed === null ? (
                  <div className="self-assess-row">
                    <span className="setup-label">Did you get this right?</span>
                    <div className="pill-row">
                      <button className="pill" onClick={() => selfAssess(true)}>Yes</button>
                      <button className="pill" onClick={() => selfAssess(false)}>No</button>
                    </div>
                  </div>
                ) : (
                  <p className={selfAssessed ? "quiz-feedback-correct" : "quiz-feedback-wrong"}>
                    {selfAssessed ? "Marked correct" : "Marked incorrect"}
                  </p>
                )}
              </>
            ) : (
              <>
                <p className={lastResult?.correct ? "quiz-feedback-correct" : "quiz-feedback-wrong"}>
                  {lastResult?.correct ? "✅ Correct" : "❌ Incorrect"}
                </p>
                {q.type === "fill_blank" && !lastResult?.correct && (
                  <p className="quiz-feedback-answer">✅ Correct answer: {q.correctAnswer}</p>
                )}
                {(q.type === "mcq" || q.type === "true_false") && selected !== q.correctIndex && (
                  <>
                    <p className="quiz-feedback-answer">✅ Correct answer: {q.options[q.correctIndex]}</p>
                    {q.optionNotes && q.optionNotes[selected] && (
                      <p className="quiz-feedback-explanation">📌 {q.optionNotes[selected]}</p>
                    )}
                  </>
                )}
                {q.type === "select_all" && !lastResult?.correct && (
                  <p className="quiz-feedback-answer">
                    ✅ Correct: {(q.correctIndices || []).map((i) => q.options[i]).join(", ")}
                  </p>
                )}
              </>
            )}

            <p className="quiz-feedback-explanation">💡 {q.explanation}</p>
            <p className="tap-hint">Source: {formatSource(moduleName, q.page)}</p>
            {q.relatedConcept && <p className="quiz-feedback-explanation">🔗 Related: {q.relatedConcept}</p>}
          </div>
        )}
      </div>

      <div className="nav-row">
        <button className="secondary" onClick={goNext} disabled={!canProceed}>
          {isLast ? "Finish Quiz →" : "Next →"}
        </button>
      </div>
    </div>
  );
}
