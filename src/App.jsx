import { useEffect, useState, useRef } from "react";
import { BookOpen, Brain, Clock, Swords, Timer } from "lucide-react";
import Navbar from "./components/Navbar";
import FileUpload from "./components/FileUpload";
import ModuleSelector from "./components/ModuleSelector";
import Flashcards from "./components/Flashcards";
import QuizSetup from "./components/QuizSetup";
import Quiz from "./components/Quiz";
import QuizSummary from "./components/QuizSummary";
import QuickRevision from "./components/QuickRevision";
import Auth from "./components/Auth";
import MyLibrary from "./components/MyLibrary";
import ProfileDashboard from "./components/ProfileDashboard";
import BattleMode from "./components/battle/BattleMode";
import FlowState, { TIMER_MODES } from "./components/FlowState";
import { parseModules } from "./utils/parseModules";
import { supabase } from "./supabaseClient";

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
  {
    id: "battle",
    label: "Battle Mode",
    title: "Battle Mode",
    description: "Challenge a friend to a live 1v1 quiz in real-time.",
    actionLabel: "Start Battle",
    icon: Swords,
  },
  {
    id: "flow",
    label: "Flow State",
    title: "Flow State",
    description: "Deep focus productivity timer with smart study intervals.",
    actionLabel: "Start Focus Session",
    icon: Timer,
  },
];

const FEATURE_IDS = new Set(FEATURES.map((feature) => feature.id));

function getModeFromHash() {
  if (typeof window === "undefined") return "flashcards";
  const hashMode = window.location.hash.replace(/^#\/?/, "");
  return FEATURE_IDS.has(hashMode) ? hashMode : "flashcards";
}

export default function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [saveStatus, setSaveStatus] = useState("");
  const [profile, setProfile] = useState(null);

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

  const [currentDocumentId, setCurrentDocumentId] = useState(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [pendingBattleCode, setPendingBattleCode] = useState(null);

  // Flow State background timer states
  const [flowActiveMode, setFlowActiveMode] = useState("pomodoro_25");
  const [flowCustomStudy, setFlowCustomStudy] = useState(25);
  const [flowCustomBreak, setFlowCustomBreak] = useState(5);
  const [flowIsBreak, setFlowIsBreak] = useState(false);
  const [flowTimeLeft, setFlowTimeLeft] = useState(25 * 60);
  const [flowDuration, setFlowDuration] = useState(25 * 60);
  const [flowIsRunning, setFlowIsRunning] = useState(false);
  const [flowSessionCount, setFlowSessionCount] = useState(0);
  const [flowTargetEndTime, setFlowTargetEndTime] = useState(null);

  // Focus sound states
  const [flowActiveSound, setFlowActiveSound] = useState("");
  const [flowIsPlayingSound, setFlowIsPlayingSound] = useState(false);
  const [flowVolume, setFlowVolume] = useState(0.5);
  const [flowIsMuted, setFlowIsMuted] = useState(false);
  const flowAudioRef = useRef(null);

  // Background ambient audio loop synchronization
  useEffect(() => {
    const SOUND_ASSETS = {
      rain: "https://www.soundjay.com/nature/sounds/rain-07.mp3",
      forest: "https://www.soundjay.com/nature/sounds/forest-wind-1.mp3",
      ocean: "https://www.soundjay.com/nature/sounds/ocean-wave-1.mp3",
      fireplace: "https://www.soundjay.com/misc/sounds/fire-1.mp3",
      instrumental: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3",
    };

    if (!flowActiveSound) {
      if (flowAudioRef.current) {
        flowAudioRef.current.pause();
        flowAudioRef.current = null;
      }
      return;
    }

    const soundUrl = SOUND_ASSETS[flowActiveSound];
    if (!flowAudioRef.current || flowAudioRef.current.src !== soundUrl) {
      if (flowAudioRef.current) {
        flowAudioRef.current.pause();
      }
      flowAudioRef.current = new Audio(soundUrl);
      flowAudioRef.current.loop = true;
    }

    flowAudioRef.current.volume = flowIsMuted ? 0 : flowVolume;

    if (flowIsPlayingSound) {
      flowAudioRef.current.play().catch((err) => console.error("Audio play failed:", err));
    } else {
      flowAudioRef.current.pause();
    }
  }, [flowActiveSound, flowIsPlayingSound, flowVolume, flowIsMuted]);

  // Background timer ticking synchronization
  const handleFlowSessionEnd = () => {
    if (!flowIsBreak) {
      setFlowIsBreak(true);
      const breakMins = flowActiveMode === "custom" ? flowCustomBreak : TIMER_MODES[flowActiveMode].break;
      const secs = breakMins * 60;
      setFlowTimeLeft(secs);
      setFlowDuration(secs);
      setFlowTargetEndTime(Date.now() + secs * 1000);
      setFlowSessionCount((prev) => prev + 1);
    } else {
      setFlowIsBreak(false);
      const studyMins = flowActiveMode === "custom" ? flowCustomStudy : TIMER_MODES[flowActiveMode].study;
      const secs = studyMins * 60;
      setFlowTimeLeft(secs);
      setFlowDuration(secs);
      setFlowTargetEndTime(Date.now() + secs * 1000);
    }
  };

  useEffect(() => {
    let timerId = null;
    if (flowIsRunning && flowTargetEndTime) {
      const tick = () => {
        const remaining = Math.max(0, Math.round((flowTargetEndTime - Date.now()) / 1000));
        setFlowTimeLeft(remaining);
        if (remaining <= 0) {
          clearInterval(timerId);
          handleFlowSessionEnd();
        }
      };

      tick();
      timerId = setInterval(tick, 1000);
    }
    return () => clearInterval(timerId);
  }, [flowIsRunning, flowTargetEndTime, flowIsBreak, flowActiveMode, flowCustomStudy, flowCustomBreak]);

  // Track login state, but never block the app on it
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession) {
        setAuthModalOpen(false);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  // Once logged in, if there was something waiting to be saved, save it now
  useEffect(() => {
    if (session && pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  }, [session, pendingAction]);

  // Fetch (or create) the user's profile row once logged in
  useEffect(() => {
    if (!session) {
      setProfile(null);
      return;
    }

    async function loadProfile() {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();

      if (data) {
        setProfile(data);
        return;
      }

      const fallbackUsername =
        session.user.user_metadata?.full_name ||
        session.user.email?.split("@")[0] ||
        "Student";

      const { data: created, error: insertError } = await supabase
        .from("profiles")
        .insert({ id: session.user.id, username: fallbackUsername })
        .select()
        .single();

      if (!insertError) setProfile(created);
    }

    loadProfile();
  }, [session]);

  useEffect(() => {
    if (activeMode === "battle" && !authLoading && !session) {
      switchMode("flashcards");
    }
  }, [session, authLoading, activeMode]);

  useEffect(() => {
    const joinMatch = window.location.hash.match(/^#\/battle-join\/([A-Za-z0-9]+)/);
    if (joinMatch) {
      setPendingBattleCode(joinMatch[1].toUpperCase());
      requireLogin(() => {
        switchMode("battle");
      });
      setLibraryOpen(false);
      setProfileOpen(false);
      window.history.replaceState(null, "", "#/battle");
      return;
    }

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

  function requireLogin(action) {
    if (session) {
      action();
    } else {
      setPendingAction(() => action);
      setAuthModalOpen(true);
    }
  }

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
    setSaveStatus("");
  }

  function switchMode(mode) {
    if (!FEATURE_IDS.has(mode) || mode === activeMode) return;
    setActiveMode(mode);
    resetAllOutputs();
    window.location.hash = `/${mode}`;
    setLibraryOpen(false);
    setProfileOpen(false);
  }

  function handleFeatureClick(id) {
    if (id === "battle") {
      requireLogin(() => switchMode("battle"));
    } else {
      switchMode(id);
    }
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

    if (!response.ok) {
      let errMsg = "Something went wrong.";
      try {
        const data = await response.json();
        errMsg = data.error || errMsg;
      } catch (e) {
        errMsg = `Server error (${response.status}): ${response.statusText || "Internal Server Error"}`;
      }
      throw new Error(errMsg);
    }

    try {
      return await response.json();
    } catch (e) {
      throw new Error("Failed to parse server response.");
    }
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
      if (activeMode === "revision") {
        setRevision(data.revision);
        try {
          const revCountKey = `lockin_rev_count_${session?.user?.id || 'anon'}`;
          const currentCount = parseInt(localStorage.getItem(revCountKey) || '0', 10);
          localStorage.setItem(revCountKey, (currentCount + 1).toString());

          const logKey = `lockin_rev_logs_${session?.user?.id || 'anon'}`;
          const logs = JSON.parse(localStorage.getItem(logKey) || '[]');
          logs.unshift({
            id: Date.now().toString(),
            module_name: displayModuleName,
            created_at: new Date().toISOString()
          });
          localStorage.setItem(logKey, JSON.stringify(logs.slice(0, 30)));
        } catch(e) {
          console.error("Failed to update revision stats", e);
        }
      }
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
    setSaveStatus("");
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

  // FileUpload still reports the file name after a successful read, but we no
  // longer persist a "documents" row for it — My Library groups by an editable
  // subject name instead of source file, which doesn't need this.
  function handleFileRead() {
    setCurrentDocumentId(null);
  }

  // Save handlers — gated behind login via requireLogin
  function handleSaveQuizResult() {
    requireLogin(async () => {
      setSaveStatus("Saving...");
      const { error } = await supabase.from("quiz_attempts").insert({
        user_id: session.user.id,
        module_name: displayModuleName,
        subject: displayModuleName,
        score: quizSummaryData.score,
        total_questions: quizSummaryData.total,
        questions: quizQuestions,
      });
      setSaveStatus(error ? "Could not save. Try again." : "Saved!");
    });
  }

  function handleSaveFlashcardDeck() {
    requireLogin(async () => {
      setSaveStatus("Saving...");
      const { error } = await supabase.from("flashcard_decks").insert({
        user_id: session.user.id,
        module_name: displayModuleName,
        subject: displayModuleName,
        cards: flashcards,
      });
      setSaveStatus(error ? "Could not save. Try again." : "Saved!");
    });
  }

  async function handleUsernameChange(newUsername) {
    if (!session || !profile) return;
    const { data, error } = await supabase
      .from("profiles")
      .update({ username: newUsername, updated_at: new Date().toISOString() })
      .eq("id", session.user.id)
      .select()
      .single();

    if (!error) setProfile(data);
  }

  function handleOpenDeckFromLibrary(cards, moduleName) {
    setFlashcards(cards);
    setFlashcardEndMessage("");
    setActiveMode("flashcards");
    window.location.hash = "/flashcards";
    setLibraryOpen(false);
    setProfileOpen(false);
  }

  const displayModuleName = selectedModule === "__ALL__" ? "Entire Syllabus" : selectedModule;
  const activeFeature = FEATURES.find((feature) => feature.id === activeMode) || FEATURES[0];
  const ActiveIcon = activeFeature.icon;

  if (authLoading) {
    return <div className="min-h-screen p-6" />;
  }

  return (
    <div className="min-h-screen p-6">
      <Navbar
        userEmail={session?.user?.email}
        onLoginClick={() => setAuthModalOpen(true)}
        username={profile?.username}
        onUsernameChange={handleUsernameChange}
        onLibraryClick={() => { setLibraryOpen(true); setProfileOpen(false); }}
        onProfileClick={() => { setProfileOpen(true); setLibraryOpen(false); }}
      />

      {authModalOpen && (
        <div className="auth-modal-overlay" onClick={() => setAuthModalOpen(false)}>
          <div className="auth-modal-box" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="auth-modal-close"
              onClick={() => setAuthModalOpen(false)}
              aria-label="Close"
            >
              ✕
            </button>
            <Auth />
          </div>
        </div>
      )}

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
              onClick={() => handleFeatureClick(feature.id)}
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

      {libraryOpen ? (
        <MyLibrary
          session={session}
          onClose={() => setLibraryOpen(false)}
          onOpenDeck={handleOpenDeckFromLibrary}
        />
      ) : profileOpen ? (
        <ProfileDashboard
          session={session}
          profile={profile}
          onUsernameChange={handleUsernameChange}
          onClose={() => setProfileOpen(false)}
        />
      ) : activeMode === "battle" ? (
        <BattleMode
          session={session}
          profile={profile}
          noteText={noteText}
          setNoteText={handleNoteTextChange}
          modules={modules}
          selectedModule={selectedModule}
          setSelectedModule={setSelectedModule}
          displayModuleName={displayModuleName}
          currentDocumentId={currentDocumentId}
          callGenerate={callGenerate}
          initialBattleCode={pendingBattleCode}
          onClose={() => {
            switchMode("flashcards");
            setPendingBattleCode(null);
          }}
          onFileRead={handleFileRead}
        />
      ) : (
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

          {activeMode === "flow" ? (
            <FlowState
              activeMode={flowActiveMode}
              setActiveMode={setFlowActiveMode}
              customStudy={flowCustomStudy}
              setCustomStudy={setFlowCustomStudy}
              customBreak={flowCustomBreak}
              setCustomBreak={setFlowCustomBreak}
              isBreak={flowIsBreak}
              setIsBreak={setFlowIsBreak}
              timeLeft={flowTimeLeft}
              setTimeLeft={setFlowTimeLeft}
              duration={flowDuration}
              setDuration={setFlowDuration}
              isRunning={flowIsRunning}
              setIsRunning={setFlowIsRunning}
              sessionCount={flowSessionCount}
              setSessionCount={setFlowSessionCount}
              targetEndTime={flowTargetEndTime}
              setTargetEndTime={setFlowTargetEndTime}
              activeSound={flowActiveSound}
              setActiveSound={setFlowActiveSound}
              isPlayingSound={flowIsPlayingSound}
              setIsPlayingSound={setFlowIsPlayingSound}
              volume={flowVolume}
              setVolume={setFlowVolume}
              isMuted={flowIsMuted}
              setIsMuted={setFlowIsMuted}
            />
          ) : (
            <>
              <section className="study-input-panel" aria-label="Study source">
                <FileUpload noteText={noteText} setNoteText={handleNoteTextChange} onFileRead={handleFileRead} />
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
                    onSaveDeck={handleSaveFlashcardDeck}
                    saveStatus={saveStatus}
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
                      onSaveResult={handleSaveQuizResult}
                      saveStatus={saveStatus}
                    />
                  )}
                </section>
              )}
            </>
          )}
        </main>
      )}
    </div>
  );
}