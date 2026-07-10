import { useEffect, useState } from "react";
import { BookOpen, Brain, Clock } from "lucide-react";
import Navbar from "./components/Navbar";
import FileUpload from "./components/FileUpload";
import ModuleSelector from "./components/ModuleSelector";
import Flashcards from "./components/Flashcards";
import QuizSetup from "./components/QuizSetup";
import Quiz from "./components/Quiz";
import QuizSummary from "./components/QuizSummary";
import QuickRevision from "./components/QuickRevision";
import { parseModules } from "./utils/parseModules";

const FEATURES = [
  {
    id: "flashcards",
    label: "Flashcards",
    title: "Flashcard Studio",
    description: "Turn your notes into focused question and answer cards.",
    actionLabel: "Generate Flashcards",
    icon: BookOpen,
  },
  {
    id: "quiz",
    label: "Quiz",
    title: "Quiz Practice",
    description: "Create exam-style questions with answers and explanations.",
    actionLabel: "Start Quiz",
    icon: Brain,
  },
  {
    id: "revision",
    label: "Quick Revision",
    title: "Quick Revision",
    description: "Build last-minute revision notes grouped by topic and source.",
    actionLabel: "Generate Quick Revision",
    icon: Clock,
  },
];

const FEATURE_IDS = new Set(FEATURES.map((feature) => feature.id));

function getModeFromHash() {
  if (typeof window === "undefined") return "flashcards";
  const hashMode = window.location.hash.replace(/^#\/?/, "");
  return FEATURE_IDS.has(hashMode) ? hashMode : "flashcards";
}

export default function App() {
  const [noteText, setNoteText] = useState("");
  const [modules, setModules] = useState({});
  const [selectedModule, setSelectedModule] = useState("");
  const [activeMode, setActiveMode] = useState(getModeFromHash);

  const [flashcards, setFlashcards] = useState(null);
  const [flashcardEndMessage, setFlashcardEndMessage] = useState("");
  const [revision, setRevision] = useState(null);

  const [quizStage, setQuizStage] = useState("setup");
  const [quizQuestions, setQuizQuestions] = useState(null);
  const [quizConfig, setQuizConfig] = useState(null);
  const [quizSummaryData, setQuizSummaryData] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!window.location.hash) {
      window.history.replaceState(null, "", "#/flashcards");
    }

    function syncModeFromHash() {
      setActiveMode(getModeFromHash());
      setError(null);
    }

    window.addEventListener("hashchange", syncModeFromHash);
    return () => window.removeEventListener("hashchange", syncModeFromHash);
  }, []);

  function handleNoteTextChange(text) {
    setNoteText(text);
    const parsed = parseModules(text);
    setModules(parsed);
    const firstKey = Object.keys(parsed)[0];
    setSelectedModule(firstKey || "");
    resetAllOutputs();
  }

  function resetAllOutputs() {
    setFlashcards(null);
    setFlashcardEndMessage("");
    setRevision(null);
    setQuizStage("setup");
    setQuizQuestions(null);
    setQuizSummaryData(null);
    setError(null);
  }

  function switchMode(mode) {
    if (!FEATURE_IDS.has(mode) || mode === activeMode) return;
    setActiveMode(mode);
    resetAllOutputs();
    window.location.hash = `/${mode}`;
  }

  function getSelectedText() {
    return selectedModule === "__ALL__" ? noteText : modules[selectedModule] || noteText;
  }

  async function callGenerate(mode, options) {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: getSelectedText(), mode, options }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Something went wrong.");
    return data;
  }

  async function handleGenerateSimple() {
    if (!noteText.trim()) {
      setError("Please upload a PDF or paste some notes first.");
      return;
    }
    setLoading(true);
    setError(null);
    setFlashcards(null);
    setRevision(null);
    try {
      const data = await callGenerate(activeMode);
      if (activeMode === "flashcards") {
        setFlashcards(data.flashcards);
        setFlashcardEndMessage("");
      }
      if (activeMode === "revision") setRevision(data.revision);
    } catch (err) {
      console.error(err);
      setError(err.message || "Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }

  async function handleStartQuiz(config) {
    if (!noteText.trim()) {
      setError("Please upload a PDF or paste some notes first.");
      return;
    }
    setLoading(true);
    setError(null);
    setQuizConfig(config);
    try {
      const data = await callGenerate("quiz", { difficulty: config.difficulty, types: config.types });
      setQuizQuestions(data.quiz);
      setQuizStage("active");
    } catch (err) {
      console.error(err);
      setError(err.message || "Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }

  function handleQuizFinish(summary) {
    setQuizSummaryData(summary);
    setQuizStage("summary");
  }

  function handleRetakeQuiz() {
    setQuizStage("setup");
    setQuizQuestions(null);
    setQuizSummaryData(null);
  }

  async function handleGenerateFlashcardsForTopic(topic) {
    setActiveMode("flashcards");
    window.location.hash = "/flashcards";
    setQuizStage("setup");
    setLoading(true);
    setError(null);
    setFlashcardEndMessage("");
    try {
      const data = await callGenerate("flashcards", { focusTopic: topic });
      setFlashcards(data.flashcards);
    } catch (err) {
      console.error(err);
      setError(err.message || "Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }

  function flashcardKey(card) {
    return (card?.question || "").trim().toLowerCase();
  }

  async function handleGenerateMoreFlashcards() {
    if (!noteText.trim()) {
      setError("Please upload a PDF, PPTX, or notes first.");
      return;
    }

    const currentCards = Array.isArray(flashcards) ? flashcards : [];
    setLoading(true);
    setError(null);
    setFlashcardEndMessage("");

    try {
      const data = await callGenerate("flashcards", {
        avoidQuestions: currentCards.map((card) => card.question).filter(Boolean),
        extraBatch: true,
      });

      const existingKeys = new Set(currentCards.map(flashcardKey));
      const newCards = (data.flashcards || []).filter((card) => {
        const key = flashcardKey(card);
        return key && !existingKeys.has(key);
      });

      if (newCards.length === 0) {
        setFlashcardEndMessage("Cannot generate more useful flashcards from this content. Try a game for better understanding.");
        return;
      }

      setFlashcards([...currentCards, ...newCards]);
    } catch (err) {
      console.error(err);
      setError(err.message || "Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }

  const displayModuleName = selectedModule === "__ALL__" ? "Entire Syllabus" : selectedModule;
  const activeFeature = FEATURES.find((feature) => feature.id === activeMode) || FEATURES[0];
  const ActiveIcon = activeFeature.icon;

  return (
    <div className="min-h-screen p-6">
      <Navbar />

      <div className="mt-10">
        <h2 className="hero-title">Focus. Learn. Ace.</h2>
        <p className="hero-sub mt-3">turn study material into your ai study coach</p>
      </div>

      <nav className="feature-nav" aria-label="Study tools">
        {FEATURES.map((feature) => {
          const FeatureIcon = feature.icon;
          const isActive = activeMode === feature.id;

          return (
            <button
              key={feature.id}
              type="button"
              data-feature={feature.id}
              className={`feature-tab ${isActive ? "feature-tab-active" : ""}`}
              onClick={() => switchMode(feature.id)}
              aria-current={isActive ? "page" : undefined}
            >
              <span className="feature-tab-icon">
                <FeatureIcon size={21} />
              </span>
              <span className="feature-tab-copy">
                <span className="feature-tab-label">{feature.label}</span>
                <span className="feature-tab-description">{feature.description}</span>
              </span>
            </button>
          );
        })}
      </nav>

      <main className="feature-page">
        <header className="feature-page-header">
          <div>
            <span className="setup-label">{activeFeature.id}_page</span>
            <h3 className="feature-page-title">{activeFeature.title}</h3>
            <p className="feature-page-copy">{activeFeature.description}</p>
          </div>
          <div className="feature-page-icon" aria-hidden="true">
            <ActiveIcon size={28} />
          </div>
        </header>

        <section className="study-input-panel" aria-label="Study source">
          <FileUpload noteText={noteText} setNoteText={handleNoteTextChange} />
          <ModuleSelector modules={modules} selectedModule={selectedModule} setSelectedModule={setSelectedModule} />
        </section>

        {activeMode !== "quiz" ? (
          <button type="button" onClick={handleGenerateSimple} disabled={loading} className="generate-btn">
            {loading ? (
              <span className="btn-spinner-row"><span className="btn-spinner"></span>Generating...</span>
            ) : (
              activeFeature.actionLabel
            )}
          </button>
        ) : null}

        {error && <p className="mt-4 text-red-400 text-center mono">{error}</p>}

        {activeMode === "flashcards" && flashcards && (
          <section className="result-stage">
            <Flashcards
              cards={flashcards}
              moduleName={displayModuleName}
              onGenerateNew={handleGenerateSimple}
              onGenerateMore={handleGenerateMoreFlashcards}
              loadingMore={loading}
              endMessage={flashcardEndMessage}
            />
          </section>
        )}

        {activeMode === "revision" && revision && (
          <section className="result-stage result-stage-wide">
            <QuickRevision items={revision} moduleName={displayModuleName} />
          </section>
        )}

        {activeMode === "quiz" && (
          <section className="result-stage">
            {quizStage === "setup" && <QuizSetup onStart={handleStartQuiz} loading={loading} />}
            {quizStage === "active" && quizQuestions && (
              <Quiz
                questions={quizQuestions}
                moduleName={displayModuleName}
                order={quizConfig.order}
                mode={quizConfig.mode}
                timeLimit={quizConfig.timeLimit}
                onFinish={handleQuizFinish}
              />
            )}
            {quizStage === "summary" && quizSummaryData && (
              <QuizSummary
                summary={quizSummaryData}
                onGenerateFlashcardsForTopic={handleGenerateFlashcardsForTopic}
                onRetake={handleRetakeQuiz}
              />
            )}
          </section>
        )}
      </main>
    </div>
  );
}
