import { useEffect, useState } from "react";
import { BookOpen, Brain, Clock, Swords, Timer, Users } from "lucide-react";
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
import StudyLobby from "./components/StudyLobby";
import { parseModules } from "./utils/parseModules";
import { createGenerationBatches, mergeFlashcardBatches } from "./utils/documentProcessing";
import { useFlowAmbience, loadAmbiencePrefs } from "./utils/useFlowAmbience";
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
  {
    id: "lobby",
    label: "Study Lobby",
    title: "Shared Study Room",
    description: "Focus in real-time rooms with synced timers & status tracking.",
    actionLabel: "Enter Study Lobby",
    icon: Users,
  },
];

const FEATURE_IDS = new Set(FEATURES.map((feature) => feature.id));

function validArray(value) {
  return Array.isArray(value) && value.length > 0;
}

function validateGeneratedData(mode, data) {
  if (mode === "flashcards" && !validArray(data?.flashcards)) {
    throw new Error("No usable flashcards were generated. Try a clearer document or a smaller section.");
  }
  if (mode === "quiz" && !validArray(data?.quiz)) {
    throw new Error("No usable quiz questions were generated. Try a clearer document or a smaller section.");
  }
  if (mode === "revision" && !validArray(data?.revision)) {
    throw new Error("No usable revision notes were generated. Try a clearer document or a smaller section.");
  }
}

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
  const [generationStatus, setGenerationStatus] = useState("");

  const [currentDocumentId, setCurrentDocumentId] = useState(null);
  const [processedDocuments, setProcessedDocuments] = useState([]);
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

  // Focus sound states — restored from the last session where available.
  const savedAmbiencePrefs = loadAmbiencePrefs();
  const [flowActiveSound, setFlowActiveSound] = useState(savedAmbiencePrefs.activeSound || "");
  const [flowIsPlayingSound, setFlowIsPlayingSound] = useState(false);
  const [flowVolume, setFlowVolume] = useState(
    typeof savedAmbiencePrefs.volume === "number" ? savedAmbiencePrefs.volume : 0.5
  );
  const [flowIsMuted, setFlowIsMuted] = useState(Boolean(savedAmbiencePrefs.isMuted));
  const [flowResetSignal, setFlowResetSignal] = useState(0);

  const { isLoading: flowAmbienceLoading, error: flowAmbienceError } = useFlowAmbience({
    activeSound: flowActiveSound,
    isPlayingSound: flowIsPlayingSound,
    volume: flowVolume,
    isMuted: flowIsMuted,
    stopSignal: flowResetSignal,
  });

  // Study tracking helper utilities
  function updateStudyStreak(userId) {
    const streakKey = `lockin_study_streak_${userId}`;
    const lastActiveKey = `lockin_last_active_date_${userId}`;
    try {
      const today = new Date().toDateString();
      const lastActive = localStorage.getItem(lastActiveKey);
      let streak = parseInt(localStorage.getItem(streakKey) || "0", 10);

      if (lastActive === today) return;

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toDateString();

      if (lastActive === yesterdayStr) {
        streak += 1;
      } else {
        streak = 1;
      }

      localStorage.setItem(streakKey, streak.toString());
      localStorage.setItem(lastActiveKey, today);
    } catch (e) {
      console.error("Failed to update study streak:", e);
    }
  }

  function logStudyActivity(type, detail) {
    const userId = session?.user?.id || "anon";
    const logKey = `lockin_activity_feed_${userId}`;
    try {
      const feed = JSON.parse(localStorage.getItem(logKey) || "[]");
      feed.unshift({
        id: Date.now().toString(),
        type,
        detail,
        created_at: new Date().toISOString()
      });
      localStorage.setItem(logKey, JSON.stringify(feed.slice(0, 50)));
      updateStudyStreak(userId);
    } catch (e) {
      console.error("Failed to log activity:", e);
    }
  }

  // Background timer ticking synchronization
  const handleFlowSessionEnd = () => {
    if (!flowIsBreak) {
      setFlowIsBreak(true);
      const breakMins = flowActiveMode === "custom" ? flowCustomBreak : TIMER_MODES[flowActiveMode].break;
      const secs = breakMins * 60;
      setFlowTimeLeft(secs);
      setFlowDuration(secs);
      setFlowTargetEndTime(Date.now() + secs * 1000);

      const studyMins = flowActiveMode === "custom" ? flowCustomStudy : TIMER_MODES[flowActiveMode].study;

      // Auto-save Focus Session
      const userId = session?.user?.id || "anon";
      const logKey = `lockin_focus_logs_${userId}`;
      try {
        const logs = JSON.parse(localStorage.getItem(logKey) || "[]");
        logs.unshift({
          id: Date.now().toString(),
          duration_minutes: studyMins,
          created_at: new Date().toISOString()
        });
        localStorage.setItem(logKey, JSON.stringify(logs.slice(0, 50)));
      } catch (e) {
        console.error("Failed to save focus session:", e);
      }

      logStudyActivity("flow", `Focused for ${studyMins} minutes in FlowState`);
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
      // Check local storage backup first (offline fallback)
      let offlineBackup = null;
      try {
        const localData = localStorage.getItem(`lockin_profile_offline_${session.user.id}`);
        if (localData) {
          offlineBackup = JSON.parse(localData);
        }
      } catch (e) {
        console.error("Failed to load offline profile backup:", e);
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();

      if (data) {
        let parsedProfile = { ...data };
        if (data.username && data.username.startsWith("JSON:")) {
          try {
            const extra = JSON.parse(data.username.substring(5));
            parsedProfile = {
              ...parsedProfile,
              ...extra,
              username: extra.username || data.username
            };
          } catch (e) {
            console.error("Failed to parse JSON serialized profile:", e);
          }
        }
        // Merge offline updates if remote updated_at is older
        if (offlineBackup && offlineBackup.updated_at && (!data.updated_at || new Date(offlineBackup.updated_at) > new Date(data.updated_at))) {
          parsedProfile = { ...parsedProfile, ...offlineBackup };
        }
        setProfile(parsedProfile);
        return;
      }

      // If we don't have remote data, try offline backup or generate new profile
      const fallbackUsername =
        offlineBackup?.username ||
        session.user.user_metadata?.full_name ||
        session.user.email?.split("@")[0] ||
        "Student";

      // If offline backup has JSON content, use it to insert
      const insertUsername = offlineBackup && offlineBackup.username 
        ? "JSON:" + JSON.stringify({
            username: offlineBackup.username,
            displayName: offlineBackup.displayName,
            avatarChoice: offlineBackup.avatarChoice,
            avatarCustomUrl: offlineBackup.avatarCustomUrl,
            bio: offlineBackup.bio,
            studyGoal: offlineBackup.studyGoal,
            favouriteSubject: offlineBackup.favouriteSubject,
            status: offlineBackup.status,
            theme: offlineBackup.theme
          })
        : fallbackUsername;

      const { data: created, error: insertError } = await supabase
        .from("profiles")
        .insert({ id: session.user.id, username: insertUsername })
        .select()
        .single();

      if (!insertError && created) {
        let parsed = { ...created };
        if (created.username && created.username.startsWith("JSON:")) {
          try {
            const extra = JSON.parse(created.username.substring(5));
            parsed = { ...parsed, ...extra, username: extra.username || created.username };
          } catch (e) {}
        }
        setProfile(parsed);
      } else if (offlineBackup) {
        // Safe fallback if insert fails (e.g. database schema is read-only)
        setProfile(offlineBackup);
      } else {
        setProfile({ id: session.user.id, username: fallbackUsername });
      }
    }

    loadProfile();
  }, [session]);

  useEffect(() => {
    if (activeMode === "battle" && !authLoading && !session) {
      const isOauth = window.location.hash.includes("access_token=") || window.location.hash.includes("error=");
      if (!isOauth) {
        switchMode("flashcards");
      }
    }
  }, [session, authLoading, activeMode]);

  // Main hash routing effect
  useEffect(() => {
    function handleHashRoute() {
      const hash = window.location.hash || "";

      // Skip parsing if this is an active OAuth token callback
      if (hash.includes("access_token=") || hash.includes("error=") || hash.includes("type=recovery")) {
        return;
      }

      // Check for live battle invitations
      const joinMatch = hash.match(/^#\/battle-join\/([A-Za-z0-9]+)/);
      if (joinMatch) {
        const code = joinMatch[1].toUpperCase();
        setPendingBattleCode(code);
        requireLogin(() => {
          switchMode("battle");
        });
        setLibraryOpen(false);
        setProfileOpen(false);
        window.history.replaceState(null, "", "#/battle");
        return;
      }

      if (!hash) {
        window.history.replaceState(null, "", "#/flashcards");
      }

      setActiveMode(getModeFromHash());
      setError(null);
    }

    handleHashRoute();
    window.addEventListener("hashchange", handleHashRoute);
    return () => window.removeEventListener("hashchange", handleHashRoute);
  }, [session, authLoading]);

  // Clean up OAuth hashes and restore original views/join codes post-login
  useEffect(() => {
    const hash = window.location.hash || "";
    const isSupabaseAuth = hash.includes("access_token=") || hash.includes("error=") || hash.includes("type=recovery");

    if (isSupabaseAuth && !authLoading) {
      let savedHash = "";
      try {
        savedHash = localStorage.getItem("lockin_post_oauth_hash") || "";
        localStorage.removeItem("lockin_post_oauth_hash");
      } catch (e) {
        console.error("Failed to read cached hash:", e);
      }

      if (savedHash && savedHash.startsWith("#/")) {
        window.location.hash = savedHash.substring(1);
      } else {
        window.location.hash = `/${activeMode}`;
      }
    }
  }, [authLoading, session]);

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
    setGenerationStatus("");
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
    const selectedText = getSelectedText();
    const requestBody = { text: selectedText, mode, options };
    const requestChars = JSON.stringify(requestBody).length;
    console.info("LockIN generate request", {
      mode,
      requestChars,
      textChars: selectedText.length,
      chunkCount: options?.batchMeta?.chunkCount || 0,
      batch: options?.batchMeta ? `${options.batchMeta.index}/${options.batchMeta.count}` : "single",
    });

    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
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
      const data = await response.json();
      validateGeneratedData(mode, data);
      return data;
    } catch (e) {
      if (e instanceof Error && e.message.startsWith("No usable")) throw e;
      throw new Error("Failed to parse server response.");
    }
  }

  async function generateFlashcardsInBatches(options = {}) {
    const batches = createGenerationBatches({
      text: getSelectedText(),
      documents: processedDocuments,
      selectedModule,
    });

    if (batches.length === 0) {
      throw new Error("No usable study content was found for flashcard generation.");
    }

    console.info("LockIN flashcard batching", {
      batchCount: batches.length,
      batchSizes: batches.map((batch) => batch.text.length),
      chunkCounts: batches.map((batch) => batch.chunkCount),
    });

    const allCards = [];
    for (const batch of batches) {
      setGenerationStatus(`Generating batch ${batch.index} of ${batch.count}`);
      try {
        const data = await callGenerateBatch("flashcards", batch.text, {
          ...options,
          cardsPerBatch: batches.length > 1 ? 5 : 12,
          batchMeta: {
            index: batch.index,
            count: batch.count,
            chunkCount: batch.chunkCount,
            charCount: batch.text.length,
            sources: batch.sources,
          },
          batchMode: true,
          totalBatches: batch.count,
        });
        allCards.push(data.flashcards || []);
      } catch (err) {
        throw new Error(`Batch ${batch.index} of ${batch.count} failed: ${err.message}`);
      }
    }

    setGenerationStatus("Combining flashcards");
    const mergedCards = mergeFlashcardBatches(allCards);
    if (!validArray(mergedCards)) {
      throw new Error("No usable flashcards were generated after combining batches.");
    }
    return { flashcards: mergedCards };
  }

  async function callGenerateBatch(mode, text, options) {
    const requestBody = { text, mode, options };
    const requestChars = JSON.stringify(requestBody).length;
    console.info("LockIN generate request", {
      mode,
      requestChars,
      textChars: text.length,
      chunkCount: options?.batchMeta?.chunkCount || 0,
      batch: options?.batchMeta ? `${options.batchMeta.index}/${options.batchMeta.count}` : "single",
    });

    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
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
      const data = await response.json();
      validateGeneratedData(mode, data);
      return data;
    } catch (e) {
      if (e instanceof Error && e.message.startsWith("No usable")) throw e;
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
    setGenerationStatus("");
    setFlashcards(null);
    setRevision(null);
    try {
      const data = activeMode === "flashcards"
        ? await generateFlashcardsInBatches()
        : await callGenerate(activeMode);
      if (activeMode === "flashcards") {
        setFlashcards(data.flashcards);
        setFlashcardEndMessage("");

        // Auto-save to Supabase
        if (session) {
          setSaveStatus("Saving...");
          const { error } = await supabase.from("flashcard_decks").insert({
            user_id: session.user.id,
            module_name: displayModuleName,
            subject: displayModuleName,
            cards: data.flashcards,
            document_id: currentDocumentId,
          });
          if (error) {
            console.error("Auto-save flashcards failed in Supabase:", error);
            setSaveStatus("Could not save to cloud.");
          } else {
            setSaveStatus("Saved!");
          }
        } else {
          // Offline fallback
          try {
            const fcLogKey = `lockin_flashcards_offline_${session?.user?.id || 'anon'}`;
            const decks = JSON.parse(localStorage.getItem(fcLogKey) || '[]');
            decks.unshift({
              id: Date.now().toString(),
              module_name: displayModuleName,
              subject: displayModuleName,
              cards: data.flashcards,
              created_at: new Date().toISOString()
            });
            localStorage.setItem(fcLogKey, JSON.stringify(decks.slice(0, 30)));
            setSaveStatus("Saved locally");
          } catch(e) {
            console.error("Failed to auto-save flashcard deck to localStorage:", e);
          }
        }
        logStudyActivity("flashcards", `Created Flashcard Deck for ${displayModuleName} (${data.flashcards.length} cards)`);
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
        logStudyActivity("revision", `Generated Revision Summary for ${displayModuleName}`);
      }
    } catch (err) {
      console.error(err);
      setError(err.message || "Could not reach the server.");
    } finally {
      setGenerationStatus("");
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

    // Automatically save progress!
    if (session) {
      setSaveStatus("Saving...");
      supabase.from("quiz_attempts").insert({
        user_id: session.user.id,
        module_name: displayModuleName,
        subject: displayModuleName,
        score: summary.score,
        total_questions: summary.total,
        questions: quizQuestions,
        document_id: currentDocumentId,
      }).then(({ error }) => {
        if (error) {
          console.error("Auto-save quiz attempt failed in Supabase:", error);
          setSaveStatus("Could not save to cloud.");
        } else {
          setSaveStatus("Saved!");
        }
      });
    } else {
      // Offline fallback
      try {
        const quizLogKey = `lockin_quiz_logs_offline_${session?.user?.id || 'anon'}`;
        const logs = JSON.parse(localStorage.getItem(quizLogKey) || '[]');
        logs.unshift({
          id: Date.now().toString(),
          module_name: displayModuleName,
          subject: displayModuleName,
          score: summary.score,
          total_questions: summary.total,
          created_at: new Date().toISOString()
        });
        localStorage.setItem(quizLogKey, JSON.stringify(logs.slice(0, 50)));
        setSaveStatus("Saved locally");
      } catch (e) {
        console.error("Failed to save quiz attempt to localStorage:", e);
      }
    }
    logStudyActivity("quiz", `Completed Quiz in ${displayModuleName} (Score: ${summary.score}/${summary.total})`);
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
      const data = await generateFlashcardsInBatches({ focusTopic: topic });
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
      const data = await generateFlashcardsInBatches({
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
  function handleFileRead(fileResult) {
    const documents = fileResult?.documents || [];
    setProcessedDocuments(documents);
    setCurrentDocumentId(documents[0]?.id || null);
    if (fileResult?.fileName) {
      logStudyActivity("upload", `Uploaded note file: ${fileResult.fileName}`);
      try {
        const userId = session?.user?.id || "anon";
        const docCountKey = `lockin_docs_uploaded_${userId}`;
        const currentDocCount = parseInt(localStorage.getItem(docCountKey) || '0', 10);
        localStorage.setItem(docCountKey, (currentDocCount + Math.max(1, documents.length)).toString());
      } catch (e) {
        console.error("Failed to update uploaded document count:", e);
      }
    }
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
        document_id: currentDocumentId,
      });
      if (error) {
        console.error("Supabase Error [Save Quiz Attempt]:", {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        });
        setSaveStatus("Could not save. Try again.");
      } else {
        setSaveStatus("Saved!");
      }
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
        document_id: currentDocumentId,
      });
      if (error) {
        console.error("Supabase Error [Save Flashcard Deck]:", {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        });
        setSaveStatus("Could not save. Try again.");
      } else {
        setSaveStatus("Saved!");
      }
    });
  }

  async function handleProfileUpdate(updatedFields) {
    if (!session || !profile) return;

    // Create new profile object merging changes
    const newProfile = { ...profile, ...updatedFields, updated_at: new Date().toISOString() };

    // Offline local storage update
    try {
      localStorage.setItem(`lockin_profile_offline_${session.user.id}`, JSON.stringify(newProfile));
    } catch(e) {
      console.error("Failed to save offline profile:", e);
    }

    // Try updating individual columns first
    const { error } = await supabase
      .from("profiles")
      .update({
        username: newProfile.username,
        display_name: newProfile.displayName,
        avatar: newProfile.avatarChoice,
        bio: newProfile.bio,
        study_goal: newProfile.studyGoal,
        favourite_subject: newProfile.favouriteSubject,
        status: newProfile.status,
        theme: newProfile.theme,
        updated_at: newProfile.updated_at
      })
      .eq("id", session.user.id);

    if (error) {
      console.warn("Updating individual columns failed, attempting JSON serialization fallback...", error.message);

      // Fallback: Serialize extra fields in username column
      const serialized = JSON.stringify({
        username: newProfile.username,
        displayName: newProfile.displayName,
        avatarChoice: newProfile.avatarChoice,
        avatarCustomUrl: newProfile.avatarCustomUrl,
        bio: newProfile.bio,
        studyGoal: newProfile.studyGoal,
        favouriteSubject: newProfile.favouriteSubject,
        status: newProfile.status,
        theme: newProfile.theme
      });

      const { error: fallbackErr } = await supabase
        .from("profiles")
        .update({
          username: "JSON:" + serialized,
          updated_at: newProfile.updated_at
        })
        .eq("id", session.user.id);

      if (fallbackErr) {
        console.error("Supabase Error [Update Profile (JSON fallback)]:", {
          message: fallbackErr.message,
          code: fallbackErr.code,
          details: fallbackErr.details,
          hint: fallbackErr.hint
        });
      }
    }

    setProfile(newProfile);
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
        onUsernameChange={(u) => handleProfileUpdate({ username: u })}
        onLibraryClick={() => { setLibraryOpen(true); setProfileOpen(false); }}
        onProfileClick={() => { setProfileOpen(true); setLibraryOpen(false); }}
        profile={profile}
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
          onProfileUpdate={handleProfileUpdate}
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
      ) : activeMode === "lobby" ? (
        <StudyLobby
          session={session}
          profile={profile}
          currentActiveMode={activeMode}
          flowIsRunning={flowIsRunning}
          onClose={() => switchMode("flashcards")}
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
              ambienceLoading={flowAmbienceLoading}
              ambienceError={flowAmbienceError}
              onFullStop={() => setFlowResetSignal((n) => n + 1)}
            />
          ) : (
            <>
              <section className="study-input-panel" aria-label="Study source">
                <FileUpload
                  noteText={noteText}
                  setNoteText={handleNoteTextChange}
                  onFileRead={handleFileRead}
                  session={session}
                  subject={displayModuleName}
                />
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

              {generationStatus && <p className="mt-3 text-center mono text-sm text-orange-400">{generationStatus}</p>}
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
