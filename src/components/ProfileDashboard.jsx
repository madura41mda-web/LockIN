import React, { useEffect, useState } from "react";
import { 
  X, User, BookOpen, Brain, Clock, Swords, Trophy, Edit3, Check, Calendar, Activity, 
  Sun, Moon, PenTool, Camera, Clipboard, ShieldAlert, Award
} from "lucide-react";
import { supabase } from "../supabaseClient";
import Avatar from "./Avatar";

const AVATAR_LABELS = ["Cyber Orange", "Retro Neon", "Cosmos Space", "Cyber Cyborg", "Golden Sage", "Emerald Owl"];

export default function ProfileDashboard({ session, profile, onUsernameChange, onClose }) {
  const user = session?.user;
  const userEmail = user?.email || "student@lockin.edu";
  const userId = user?.id;

  // Local state for profile data
  const [displayName, setDisplayName] = useState("");
  const [bBio, setBBio] = useState("");
  const [avatarChoice, setAvatarChoice] = useState("0");
  const [avatarCustomUrl, setAvatarCustomUrl] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  // States for database statistics
  const [stats, setStats] = useState({
    flashcardsCount: 0,
    quizzesCount: 0,
    revisionsCount: 0,
    battlesCount: 0,
    battlesWon: 0,
    quizAccuracy: 0,
    totalSessions: 0,
  });
  const [activities, setActivities] = useState([]);
  const [dbLoading, setDbLoading] = useState(true);

  // Editing username
  const [draftUsername, setDraftUsername] = useState(profile?.username || "");
  const [editingUsername, setEditingUsername] = useState(false);
  const [savingUsername, setSavingUsername] = useState(false);

  // Theme settings
  const [theme, setTheme] = useState(() => localStorage.getItem("lockin-theme") || "dark");

  // Load local settings on mount
  useEffect(() => {
    if (userEmail) {
      const dataStr = localStorage.getItem(`lockin_profile_${userEmail}`);
      if (dataStr) {
        try {
          const data = JSON.parse(dataStr);
          setDisplayName(data.displayName || "");
          setBBio(data.bio || "");
          setAvatarChoice(data.avatarChoice || "0");
          setAvatarCustomUrl(data.avatarCustomUrl || "");
        } catch (e) {
          console.error("Error parsing local profile data:", e);
        }
      } else {
        // Fallback display name
        setDisplayName(profile?.username || userEmail.split("@")[0]);
      }
    }
  }, [userEmail, profile]);

  useEffect(() => {
    if (profile?.username) {
      setDraftUsername(profile.username);
    }
  }, [profile]);

  // Load stats and history from DB & LocalStorage
  useEffect(() => {
    if (!userId) return;
    
    let active = true;

    async function loadStatsAndLogs() {
      setDbLoading(true);
      try {
        // 1. Fetch Flashcard Decks
        const { data: decks, error: decksErr } = await supabase
          .from("flashcard_decks")
          .select("*")
          .eq("user_id", userId);
        
        // 2. Fetch Quiz Attempts
        const { data: attempts, error: attemptsErr } = await supabase
          .from("quiz_attempts")
          .select("*")
          .eq("user_id", userId);

        // 3. Fetch Battle Players rows for matches played
        const { data: battlePlayers, error: bpErr } = await supabase
          .from("battle_players")
          .select("id, room_id, joined_at")
          .eq("user_id", userId);

        if (!active) return;

        let rooms = [];
        let winResults = [];

        if (battlePlayers && battlePlayers.length > 0) {
          const roomIds = battlePlayers.map((p) => p.room_id).filter(Boolean);
          if (roomIds.length > 0) {
            const { data } = await supabase
              .from("battle_rooms")
              .select("id, module_name, status")
              .in("id", roomIds);
            rooms = data || [];
          }

          const playerIds = battlePlayers.map((p) => p.id);
          if (playerIds.length > 0) {
            const { data } = await supabase
              .from("battle_results")
              .select("room_id, player_id, placement")
              .in("player_id", playerIds);
            winResults = data || [];
          }
        }

        // 4. Fetch Revision Stats from local storage
        const revCountKey = `lockin_rev_count_${userId}`;
        const revisionsCount = parseInt(localStorage.getItem(revCountKey) || "0", 10);
        
        const revLogKey = `lockin_rev_logs_${userId}`;
        let revLogs = [];
        try {
          revLogs = JSON.parse(localStorage.getItem(revLogKey) || "[]");
        } catch (e) {
          console.error(e);
        }

        // Compute Statistic Values
        const fcCreated = (decks || []).reduce((sum, d) => sum + (d.cards?.length || 0), 0);
        const quizCompleted = (attempts || []).length;
        const matchesCount = (battlePlayers || []).length;
        const matchesWon = winResults.filter((w) => w.placement === 1).length;

        let avgAccuracy = 0;
        if (quizCompleted > 0) {
          const totalQuestions = (attempts || []).reduce((sum, a) => sum + (a.total_questions || 0), 0);
          const totalScore = (attempts || []).reduce((sum, a) => sum + (a.score || 0), 0);
          avgAccuracy = totalQuestions > 0 ? Math.round((totalScore / totalQuestions) * 100) : 0;
        }

        const totalStudyDecksCount = (decks || []).length;
        // Total active sessions is sum of resources & matches
        const totalSessions = totalStudyDecksCount + quizCompleted + matchesCount + revisionsCount;

        setStats({
          flashcardsCount: fcCreated,
          quizzesCount: quizCompleted,
          revisionsCount: revisionsCount,
          battlesCount: matchesCount,
          battlesWon: matchesWon,
          quizAccuracy: quizCompleted > 0 ? avgAccuracy : null,
          totalSessions: totalSessions,
        });

        // 5. Compile recent activities timeline
        const acts = [];

        // Flashcards created activities
        (decks || []).forEach((d) => {
          acts.push({
            id: `deck-${d.id}`,
            type: "flashcard",
            title: "Created Flashcards",
            desc: `Generated "${d.module_name}" with ${d.cards?.length || 0} cards`,
            date: new Date(d.created_at),
          });
        });

        // Quiz completed activities
        (attempts || []).forEach((a) => {
          acts.push({
            id: `quiz-${a.id}`,
            type: "quiz",
            title: "Completed Quiz",
            desc: `Tested in "${a.module_name}" (Score: ${a.score}/${a.total_questions})`,
            date: new Date(a.created_at),
          });
        });

        // Quick Revisions activities
        revLogs.forEach((r) => {
          acts.push({
            id: `rev-${r.id}`,
            type: "revision",
            title: "Generated Revision",
            desc: `Created Quick Revision summary for "${r.module_name}"`,
            date: new Date(r.created_at || Date.now()),
          });
        });

        // Matches activities
        (battlePlayers || []).forEach((p) => {
          const roomObj = rooms.find((rm) => rm.id === p.room_id);
          const resultObj = winResults.find((res) => res.player_id === p.id);
          const roomName = roomObj?.module_name || "Live Match";
          const didWin = resultObj?.placement === 1;

          acts.push({
            id: `battle-${p.id}`,
            type: didWin ? "battle_win" : "battle",
            title: didWin ? "Won Live Battle" : "Joined Battle",
            desc: didWin 
              ? `Won 1v1 Battle Match in "${roomName}"` 
              : `Challenged in 1v1 Battle Match: "${roomName}"`,
            date: new Date(p.joined_at),
          });
        });

        // Sort by date descending
        acts.sort((a, b) => b.date - a.date);
        setActivities(acts.slice(0, 10)); // keep last 10 activities

      } catch (err) {
        console.error("Failed to compile profile stats:", err);
      } finally {
        if (active) setDbLoading(false);
      }
    }

    loadStatsAndLogs();

    return () => {
      active = false;
    };
  }, [userId]);

  // Handle saving profile changes
  function saveProfileData() {
    const updated = {
      displayName: displayName.trim(),
      bio: bBio.trim(),
      avatarChoice,
      avatarCustomUrl,
    };
    localStorage.setItem(`lockin_profile_${userEmail}`, JSON.stringify(updated));
    setIsEditing(false);
  }

  // Handle uploading custom profile Base64 image
  function handleImageUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1024 * 1024) {
      alert("Image is too large. Please select an image under 1MB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarCustomUrl(reader.result);
      setAvatarChoice("custom");
    };
    reader.readAsDataURL(file);
  }

  // Toggle app theme
  const toggleThemeState = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    localStorage.setItem("lockin-theme", nextTheme);
  };

  // Sync username changes to supabase profiles table
  async function submitUsernameChange() {
    const trimmed = draftUsername.trim();
    if (!trimmed || trimmed === profile?.username) {
      setEditingUsername(false);
      return;
    }
    setSavingUsername(true);
    await onUsernameChange(trimmed);
    setSavingUsername(false);
    setEditingUsername(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  const joinDate = user?.created_at 
    ? new Date(user.created_at).toLocaleDateString(undefined, { year: "numeric", month: "long" }) 
    : "Recently Joined";

  return (
    <main className="feature-page" style={{ maxWidth: "64rem" }}>
      {/* Header */}
      <header className="feature-page-header border-b border-gray-250 dark:border-white/10 pb-4 mb-6">
        <div style={{ flex: 1 }}>
          <span className="setup-label">profile_dashboard</span>
          <h3 className="feature-page-title">Profile Dashboard</h3>
          <p className="feature-page-copy">Manage your AI study coach profile and review your stats.</p>
        </div>
        <button type="button" className="secondary" onClick={onClose} aria-label="Close profile">
          <X size={20} />
        </button>
      </header>

      {/* Profile Card block */}
      <section className="study-input-panel mb-8" style={{ maxWidth: "none" }}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 p-6 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-neutral-900/50">
          
          {/* Avatar display Column */}
          <div className="flex flex-col items-center justify-center md:border-r border-gray-200 dark:border-white/10 pr-2">
            <div className="relative group">
              <Avatar
                choice={avatarChoice}
                customUrl={avatarCustomUrl}
                email={userEmail}
                username={profile?.username}
                size={100}
              />
              {isEditing && (
                <label className="absolute bottom-0 right-0 p-2 bg-orange-500 rounded-full text-white cursor-pointer hover:bg-orange-600 transition-colors shadow">
                  <Camera size={14} />
                  <input type="file" onChange={handleImageUpload} accept="image/*" className="hidden" />
                </label>
              )}
            </div>
            {isEditing && (
              <span className="text-[10px] text-gray-500 mt-2 font-medium">Custom Upload enabled (Max 1MB)</span>
            )}
          </div>

          {/* Details Column */}
          <div className="md:col-span-3 flex flex-col justify-between">
            <div>
              {isEditing ? (
                <div className="flex flex-col gap-2">
                  <div>
                    <label className="profile-label">NAME</label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="profile-input"
                      style={{ marginBottom: "0.75rem" }}
                      placeholder="Your name"
                    />
                  </div>
                  <div>
                    <label className="profile-label">BIO</label>
                    <textarea
                      value={bBio}
                      onChange={(e) => setBBio(e.target.value)}
                      className="profile-input"
                      rows={2}
                      style={{ resize: "none", fontFamily: "inherit" }}
                      placeholder="Short bio about yourself..."
                    />
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="flex items-baseline gap-2">
                    <h4 className="text-xl font-bold text-slate-900 dark:text-white">
                      {displayName || "Account Student"}
                    </h4>
                    <span className="text-sm font-semibold text-slate-500 dark:text-gray-400">
                      @{profile?.username || "no-username"}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300 italic min-h-[2.5rem] mt-1 pr-4">
                    {bBio || "This user holds a silent resolution to achieve focus.exe."}
                  </p>
                </div>
              )}
            </div>

            {/* Sub Meta Info */}
            <div className="flex flex-wrap items-center gap-6 mt-4 pt-4 border-t border-gray-200 dark:border-white/10 text-xs text-gray-500 dark:text-gray-400 font-mono">
              <span className="flex items-center gap-1.5">
                <Calendar size={14} className="text-orange-500" />
                Joined: {joinDate}
              </span>
              <span className="flex items-center gap-1.5 truncate max-w-[200px]" title={userEmail}>
                <User size={14} className="text-orange-500" />
                Email: {userEmail}
              </span>
            </div>

            {/* Profile Action button */}
            <div className="mt-4 flex gap-2">
              {isEditing ? (
                <>
                  <button type="button" onClick={saveProfileData} className="generate-btn py-1.5 px-4 text-xs font-semibold" style={{ width: "auto", marginTop: 0 }}>
                    <Check size={14} className="inline mr-1" /> Save
                  </button>
                  <button type="button" onClick={() => setIsEditing(false)} className="secondary text-xs" style={{ padding: "0.5rem 1rem" }}>
                    Cancel
                  </button>
                </>
              ) : (
                <button type="button" onClick={() => setIsEditing(true)} className="secondary text-xs" style={{ display: "flex", gap: "0.25rem", alignItems: "center" }}>
                  <Edit3 size={12} /> Edit Profile Info
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Editing Avatar choice panel if overall editing is open */}
      {isEditing && (
        <section className="study-input-panel mb-8" style={{ maxWidth: "none" }}>
          <div className="p-4 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-neutral-900/50">
            <span className="profile-label mb-3">CHOOSE AVATAR STYLE</span>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
              {AVATAR_LABELS.map((label, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setAvatarChoice(idx.toString())}
                  className={`flex flex-col items-center gap-2 p-3 rounded-lg border transition-colors ${
                    avatarChoice === idx.toString() 
                      ? "border-orange-500 bg-orange-500/5" 
                      : "border-gray-200 dark:border-white/10 hover:border-orange-400"
                  }`}
                >
                  <Avatar choice={idx.toString()} size={48} />
                  <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium text-center">{label}</span>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Stats and Recent Activity splits */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Statistics Columns (Grid span 2) */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          
          <div className="flex items-center gap-2 bg-gradient-to-r from-orange-500/10 to-transparent p-3 rounded-lg border-l-2 border-orange-500">
            <Activity className="text-orange-500" size={18} />
            <h4 className="text-sm font-bold tracking-wide uppercase font-mono">Study Metrics ({dbLoading ? "Loading..." : "Live"})</h4>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            
            {/* Stat 1 */}
            <div className="p-4 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-neutral-900/30 flex flex-col justify-between min-h-[90px]">
              <div className="flex justify-between items-center text-gray-500 dark:text-gray-400">
                <BookOpen size={16} />
                <span className="text-[10px] font-mono font-semibold uppercase">Flashcards</span>
              </div>
              <div className="mt-2">
                <p className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
                  {dbLoading ? "—" : stats.flashcardsCount}
                </p>
                <p className="text-[10px] text-gray-500 mt-1">Total Cards Created</p>
              </div>
            </div>

            {/* Stat 2 */}
            <div className="p-4 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-neutral-900/30 flex flex-col justify-between min-h-[90px]">
              <div className="flex justify-between items-center text-gray-500 dark:text-gray-400">
                <Brain size={16} />
                <span className="text-[10px] font-mono font-semibold uppercase">Quizzes</span>
              </div>
              <div className="mt-2">
                <p className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
                  {dbLoading ? "—" : stats.quizzesCount}
                </p>
                <p className="text-[10px] text-gray-500 mt-1">Attempts Logged</p>
              </div>
            </div>

            {/* Stat 3 */}
            <div className="p-4 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-neutral-900/30 flex flex-col justify-between min-h-[90px]">
              <div className="flex justify-between items-center text-gray-500 dark:text-gray-400">
                <Clock size={16} />
                <span className="text-[10px] font-mono font-semibold uppercase">Revisions</span>
              </div>
              <div className="mt-2">
                <p className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
                  {dbLoading ? "—" : stats.revisionsCount}
                </p>
                <p className="text-[10px] text-gray-500 mt-1">Summaries Built</p>
              </div>
            </div>

            {/* Stat 4 */}
            <div className="p-4 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-neutral-900/30 flex flex-col justify-between min-h-[90px]">
              <div className="flex justify-between items-center text-gray-500 dark:text-gray-400">
                <Swords size={16} />
                <span className="text-[10px] font-mono font-semibold uppercase">Battles</span>
              </div>
              <div className="mt-2">
                <p className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
                  {dbLoading ? "—" : stats.battlesCount}
                </p>
                <p className="text-[10px] text-gray-500 mt-1">Matches Conducted</p>
              </div>
            </div>

            {/* Stat 5 */}
            <div className="p-4 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-neutral-900/30 flex flex-col justify-between min-h-[90px]">
              <div className="flex justify-between items-center text-gray-500 dark:text-gray-400">
                <Trophy size={16} className="text-orange-500" />
                <span className="text-[10px] font-mono font-semibold uppercase">Wins</span>
              </div>
              <div className="mt-2">
                <p className="text-2xl font-bold font-mono text-[#ffb454]">
                  {dbLoading ? "—" : stats.battlesWon}
                </p>
                <p className="text-[10px] text-gray-500 mt-1">Total Victories</p>
              </div>
            </div>

            {/* Stat 6 */}
            <div className="p-4 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-neutral-900/30 flex flex-col justify-between min-h-[90px]">
              <div className="flex justify-between items-center text-gray-500 dark:text-gray-400">
                <Award size={16} />
                <span className="text-[10px] font-mono font-semibold uppercase">Accuracy</span>
              </div>
              <div className="mt-2">
                <p className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
                  {dbLoading ? "—" : stats.quizAccuracy !== null ? `${stats.quizAccuracy}%` : "N/A"}
                </p>
                <p className="text-[10px] text-gray-500 mt-1">Average Quiz Score</p>
              </div>
            </div>

          </div>

          {/* Stat 7 session tally */}
          <div className="p-5 rounded-xl border border-orange-500/20 bg-orange-500/[0.02] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-orange-500/10 text-orange-500 rounded-lg">
                <PenTool size={20} />
              </div>
              <div>
                <h5 className="font-bold text-slate-900 dark:text-white text-sm">Total Study Sessions</h5>
                <p className="text-xs text-gray-500">Accumulated quizzes, decks, battles & revisions</p>
              </div>
            </div>
            <span className="text-3xl font-bold font-mono text-orange-500">
              {dbLoading ? "—" : stats.totalSessions}
            </span>
          </div>

        </div>

        {/* Recent Activity Timeline (Grid span 1) */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 bg-gradient-to-r from-orange-500/10 to-transparent p-3 rounded-lg border-l-2 border-orange-500">
            <Clipboard className="text-orange-500" size={18} />
            <h4 className="text-sm font-bold tracking-wide uppercase font-mono">Recent Activity</h4>
          </div>

          <div 
            className="flex flex-col gap-4 p-5 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-neutral-900/30 overflow-y-auto"
            style={{ maxHeight: "392px" }}
          >
            {dbLoading ? (
              <p className="text-xs text-gray-500 font-mono text-center py-6">Connecting to timeline feed...</p>
            ) : activities.length === 0 ? (
              <p className="text-xs text-gray-500 font-mono text-center py-6">No session logs recorded yet.</p>
            ) : (
              <div className="relative border-l border-orange-500/20 ml-2 pl-4 flex flex-col gap-5">
                {activities.map((a) => {
                  let actIconColor = "bg-orange-500";
                  if (a.type === "quiz") actIconColor = "bg-emerald-500";
                  if (a.type === "revision") actIconColor = "bg-blue-500";
                  if (a.type === "battle_win") actIconColor = "bg-yellow-500";

                  return (
                    <div key={a.id} className="relative text-xs">
                      {/* Timeline dot */}
                      <span className={`absolute -left-[21px] top-1.5 w-2 h-2 rounded-full ${actIconColor}`} />
                      <div className="flex justify-between items-center text-gray-400 font-mono text-[10px] mb-0.5">
                        <span className="font-semibold text-slate-800 dark:text-white uppercase">{a.title}</span>
                        <span>
                          {a.date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                        </span>
                      </div>
                      <p className="text-gray-500 dark:text-gray-400 mt-1 line-clamp-2 leading-relaxed">
                        {a.desc}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Account Settings Dashboard (Settings section) */}
      <section className="mt-8 pt-8 border-t border-gray-250 dark:border-white/10">
        <h4 className="text-base font-bold text-slate-900 dark:text-white mb-4 font-mono uppercase tracking-wide">
          Account Settings
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Change username */}
          <div className="p-5 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-neutral-900/30">
            <span className="profile-label">CHANGE USERNAME</span>
            {editingUsername ? (
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="text"
                  value={draftUsername}
                  onChange={(e) => setDraftUsername(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitUsernameChange()}
                  disabled={savingUsername}
                  className="flex-1 rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-neutral-800 text-slate-900 dark:text-white px-3 py-2 text-sm outline-none focus:border-orange-500"
                />
                <button
                  type="button"
                  onClick={submitUsernameChange}
                  disabled={savingUsername}
                  className="text-green-500 hover:text-green-600 secondary p-2"
                  style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
                  aria-label="Confirm Username"
                >
                  <Check size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => setEditingUsername(false)}
                  className="text-gray-500 hover:text-gray-700 secondary p-2"
                  style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
                  aria-label="Cancel Username edit"
                >
                  <X size={18} />
                </button>
              </div>
            ) : (
              <div className="flex justify-between items-center mt-2">
                <span className="text-sm font-semibold text-slate-800 dark:text-white">
                  @{profile?.username || "no-username"}
                </span>
                <button type="button" onClick={() => setEditingUsername(true)} className="secondary text-xs">
                  Change
                </button>
              </div>
            )}
          </div>

          {/* Theme Settings & Logout */}
          <div className="p-5 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-neutral-900/30 flex flex-col justify-between gap-4">
            <div className="flex justify-between items-center">
              <div>
                <span className="profile-label">THEME CONTROL</span>
                <span className="text-xs text-gray-500">Toggle lockin color scheme</span>
              </div>
              <button
                type="button"
                onClick={toggleThemeState}
                className="theme-toggle"
                aria-label="Toggle Theme"
              >
                {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
              </button>
            </div>

            <div className="pt-4 border-t border-gray-200 dark:border-white/10 flex justify-between items-center">
              <span className="text-xs text-red-500 font-mono">WARNING: session terminate</span>
              <button
                type="button"
                onClick={handleLogout}
                className="secondary"
                style={{ color: "#ef4444", borderColor: "rgba(239, 68, 68, 0.2)", padding: "0.4rem 1rem" }}
              >
                Log out
              </button>
            </div>

          </div>

        </div>
      </section>

    </main>
  );
}
