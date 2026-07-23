import React, { useEffect, useState } from "react";
import { 
  X, User, BookOpen, Brain, Clock, Swords, Trophy, Edit3, Check, Calendar, Activity, 
  Sun, Moon, PenTool, Camera, Clipboard, ShieldAlert, Award, FileText
} from "lucide-react";
import { supabase } from "../supabaseClient";
import Avatar from "./Avatar";

const AVATAR_LABELS = ["Cyber Orange", "Retro Neon", "Cosmos Space", "Cyber Cyborg", "Golden Sage", "Emerald Owl"];

export default function ProfileDashboard({ session, profile, onProfileUpdate, onClose }) {
  const user = session?.user;
  const userEmail = user?.email || "student@lockin.edu";
  const userId = user?.id;

  // Local state for profile data
  const [displayName, setDisplayName] = useState("");
  const [bBio, setBBio] = useState("");
  const [avatarChoice, setAvatarChoice] = useState("0");
  const [avatarCustomUrl, setAvatarCustomUrl] = useState("");
  const [studyGoal, setStudyGoal] = useState("");
  const [favouriteSubject, setFavouriteSubject] = useState("");
  const [customStatus, setCustomStatus] = useState("");
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
    streak: 0,
    hoursFocused: "0.0",
    flowSessionsCount: 0,
    docsUploaded: 0,
    flashcardsReviewed: 0,
    xp: 0,
    level: 1,
    levelProgress: 0,
    xpForCurrentLevel: 0,
    xpForNextLevel: 100,
    weeklyMinutes: [0, 0, 0, 0, 0, 0, 0],
    heatmapWeeks: [],
  });
  
  const [activities, setActivities] = useState([]);
  const [dbLoading, setDbLoading] = useState(true);

  // Editing username
  const [draftUsername, setDraftUsername] = useState(profile?.username || "");
  const [editingUsername, setEditingUsername] = useState(false);
  const [savingUsername, setSavingUsername] = useState(false);

  // Theme settings
  const [theme, setTheme] = useState(() => localStorage.getItem("lockin-theme") || "dark");

  // Sync state from profile prop
  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName || profile.display_name || "");
      setBBio(profile.bio || "");
      setAvatarChoice(profile.avatarChoice || profile.avatar || "0");
      setAvatarCustomUrl(profile.avatarCustomUrl || "");
      setStudyGoal(profile.studyGoal || "");
      setFavouriteSubject(profile.favouriteSubject || "");
      setCustomStatus(profile.status || "");
      setDraftUsername(profile.username || "");
    }
  }, [profile]);

  // Load stats and history from DB & LocalStorage
  useEffect(() => {
    const currentUserId = userId || "anon";
    let active = true;

    async function loadStatsAndLogs() {
      setDbLoading(true);
      try {
        let decks = [];
        let attempts = [];
        let battlePlayers = [];

        if (userId) {
          // 1. Fetch Flashcard Decks
          const { data: d } = await supabase
            .from("flashcard_decks")
            .select("*")
            .eq("user_id", userId);
          decks = d || [];
          
          // 2. Fetch Quiz Attempts
          const { data: a } = await supabase
            .from("quiz_attempts")
            .select("*")
            .eq("user_id", userId);
          attempts = a || [];

          // 3. Fetch Battle Players rows
          const { data: bp } = await supabase
            .from("battle_players")
            .select("id, room_id, joined_at")
            .eq("user_id", userId);
          battlePlayers = bp || [];
        }

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

        // 4. Fetch Revision Stats
        const revCountKey = `lockin_rev_count_${currentUserId}`;
        const revisionsCount = parseInt(localStorage.getItem(revCountKey) || "0", 10);
        const revLogKey = `lockin_rev_logs_${currentUserId}`;
        let revLogs = [];
        try {
          revLogs = JSON.parse(localStorage.getItem(revLogKey) || "[]");
        } catch (e) {
          console.error(e);
        }

        // 5. Fetch Focus Logs, Streak, Docs Uploaded, and Flashcards Reviewed
        const focusLogKey = `lockin_focus_logs_${currentUserId}`;
        let focusLogs = [];
        try {
          focusLogs = JSON.parse(localStorage.getItem(focusLogKey) || "[]");
        } catch (e) {
          console.error(e);
        }
        
        const streak = parseInt(localStorage.getItem(`lockin_study_streak_${currentUserId}`) || "0", 10);
        const docsUploaded = parseInt(localStorage.getItem(`lockin_docs_uploaded_${currentUserId}`) || "0", 10);
        const fcReviewed = parseInt(localStorage.getItem(`lockin_flashcards_reviewed_${currentUserId}`) || "0", 10);

        // 6. Compute Statistic Values
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
        const focusMinutes = focusLogs.reduce((sum, f) => sum + (f.duration_minutes || 0), 0);
        const totalSessions = totalStudyDecksCount + quizCompleted + matchesCount + revisionsCount + focusLogs.length;

        // 7. Calculate XP & RPG Level
        // 10 XP per flashcard, 20 XP per quiz, 15 XP per revision, 50 XP per win, 20 XP per match played, 1 XP per focus minute
        const xp = (fcCreated * 10) + (quizCompleted * 20) + (revisionsCount * 15) + (matchesWon * 50) + ((matchesCount - matchesWon) * 20) + focusMinutes;
        const level = Math.floor(Math.sqrt(xp / 100)) + 1;
        const xpForCurrentLevel = Math.pow(level - 1, 2) * 100;
        const xpForNextLevel = Math.pow(level, 2) * 100;
        const levelProgress = xpForNextLevel > xpForCurrentLevel 
          ? ((xp - xpForCurrentLevel) / (xpForNextLevel - xpForCurrentLevel)) * 100 
          : 0;

        // 8. Compile Weekly study graph minutes (Mon-Sun)
        const weeklyMinutes = [0, 0, 0, 0, 0, 0, 0];
        const getDayIndex = (date) => {
          const day = date.getDay(); // 0 Sunday, 1 Monday...
          return day === 0 ? 6 : day - 1;
        };

        const today = new Date();
        const startOfWeek = new Date(today);
        // Find Monday of this week
        const diff = today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1);
        startOfWeek.setDate(diff);
        startOfWeek.setHours(0, 0, 0, 0);

        const isThisWeek = (date) => date >= startOfWeek;

        (attempts || []).forEach((a) => {
          const d = new Date(a.created_at);
          if (isThisWeek(d)) {
            weeklyMinutes[getDayIndex(d)] += Math.round((a.timeTakenSeconds || 180) / 60);
          }
        });

        focusLogs.forEach((f) => {
          const d = new Date(f.created_at);
          if (isThisWeek(d)) {
            weeklyMinutes[getDayIndex(d)] += (f.duration_minutes || 0);
          }
        });

        revLogs.forEach((r) => {
          const d = new Date(r.created_at);
          if (isThisWeek(d)) {
            weeklyMinutes[getDayIndex(d)] += 2; // assume 2 mins study per revision
          }
        });

        // 9. Compile 12-Week Heatmap matrix
        const dateCounts = {};
        const recordDate = (date) => {
          const key = date.toISOString().split("T")[0];
          dateCounts[key] = (dateCounts[key] || 0) + 1;
        };

        (attempts || []).forEach((a) => recordDate(new Date(a.created_at)));
        (decks || []).forEach((d) => recordDate(new Date(d.created_at)));
        focusLogs.forEach((f) => recordDate(new Date(f.created_at)));
        revLogs.forEach((r) => recordDate(new Date(r.created_at)));
        (battlePlayers || []).forEach((p) => recordDate(new Date(p.joined_at)));

        const heatmapWeeks = [];
        const mapStartDate = new Date();
        mapStartDate.setDate(today.getDate() - 12 * 7 - today.getDay()); // Sunday 12 weeks ago
        mapStartDate.setHours(0, 0, 0, 0);

        for (let w = 0; w < 12; w++) {
          const weekDays = [];
          for (let d = 0; d < 7; d++) {
            const cur = new Date(mapStartDate);
            cur.setDate(mapStartDate.getDate() + w * 7 + d);
            const dateStr = cur.toISOString().split("T")[0];
            weekDays.push({
              date: dateStr,
              count: dateCounts[dateStr] || 0,
            });
          }
          heatmapWeeks.push(weekDays);
        }

        // 10. Compile recent activities timeline (merging local activity feed + Supabase logs)
        const acts = [];
        const localActivityFeedKey = `lockin_activity_feed_${currentUserId}`;
        let localActivities = [];
        try {
          localActivities = JSON.parse(localStorage.getItem(localActivityFeedKey) || "[]");
        } catch (e) {
          console.error(e);
        }

        localActivities.forEach((la) => {
          acts.push({
            id: la.id,
            type: la.type,
            title: la.type.toUpperCase(),
            desc: la.detail,
            date: new Date(la.created_at)
          });
        });

        // Backup parsing from DB tables if local feed was empty
        if (acts.length === 0) {
          (decks || []).forEach((d) => {
            acts.push({
              id: `deck-${d.id}`,
              type: "flashcard",
              title: "Created Flashcards",
              desc: `Generated "${d.module_name}" with ${d.cards?.length || 0} cards`,
              date: new Date(d.created_at),
            });
          });

          (attempts || []).forEach((a) => {
            acts.push({
              id: `quiz-${a.id}`,
              type: "quiz",
              title: "Completed Quiz",
              desc: `Tested in "${a.module_name}" (Score: ${a.score}/${a.total_questions})`,
              date: new Date(a.created_at),
            });
          });

          revLogs.forEach((r) => {
            acts.push({
              id: `rev-${r.id}`,
              type: "revision",
              title: "Generated Revision",
              desc: `Created Quick Revision summary for "${r.module_name}"`,
              date: new Date(r.created_at || Date.now()),
            });
          });

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
        }

        acts.sort((a, b) => b.date - a.date);
        setActivities(acts.slice(0, 10));

        setStats({
          flashcardsCount: fcCreated,
          quizzesCount: quizCompleted,
          revisionsCount: revisionsCount,
          battlesCount: matchesCount,
          battlesWon: matchesWon,
          quizAccuracy: quizCompleted > 0 ? avgAccuracy : null,
          totalSessions: totalSessions,
          streak: streak,
          hoursFocused: (focusMinutes / 60).toFixed(1),
          flowSessionsCount: focusLogs.length,
          docsUploaded: docsUploaded,
          flashcardsReviewed: fcReviewed,
          xp,
          level,
          levelProgress,
          xpForCurrentLevel,
          xpForNextLevel,
          weeklyMinutes,
          heatmapWeeks,
        });

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
      studyGoal: studyGoal.trim(),
      favouriteSubject: favouriteSubject.trim(),
      status: customStatus.trim()
    };
    onProfileUpdate?.(updated);
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
    onProfileUpdate?.({ theme: nextTheme });
  };

  // Sync username changes
  async function submitUsernameChange() {
    const trimmed = draftUsername.trim();
    if (!trimmed || trimmed === profile?.username) {
      setEditingUsername(false);
      return;
    }
    setSavingUsername(true);
    await onProfileUpdate?.({ username: trimmed });
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
          <span className="setup-label">profile_dashboard_2.0</span>
          <h3 className="feature-page-title">Profile Dashboard</h3>
          <p className="feature-page-copy">Manage your AI study coach profile and review your stats.</p>
        </div>
        <button type="button" className="secondary" onClick={onClose} aria-label="Close profile">
          <X size={20} />
        </button>
      </header>

      {/* Profile Card block */}
      <section className="study-input-panel mb-8" style={{ maxWidth: "none" }}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 p-6 rounded-xl border border-gray-250 dark:border-white/10 bg-white dark:bg-[#12161d]">
          
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
            {!isEditing && customStatus && (
              <div className="mt-3 px-3 py-1 bg-orange-500/10 text-orange-500 text-[10px] font-semibold font-mono rounded-full border border-orange-500/20 text-center max-w-[150px] truncate" title={customStatus}>
                💬 {customStatus}
              </div>
            )}
          </div>

          {/* Details Column */}
          <div className="md:col-span-3 flex flex-col justify-between gap-4">
            <div>
              {isEditing ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="profile-label">NAME</label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="profile-input"
                      placeholder="Your name"
                    />
                  </div>
                  <div className="sm:col-span-2">
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
                  <div>
                    <label className="profile-label">STUDY GOAL</label>
                    <input
                      type="text"
                      value={studyGoal}
                      onChange={(e) => setStudyGoal(e.target.value)}
                      className="profile-input"
                      placeholder="DSA preparation, Finals..."
                    />
                  </div>
                  <div>
                    <label className="profile-label">FAVOURITE SUBJECT</label>
                    <input
                      type="text"
                      value={favouriteSubject}
                      onChange={(e) => setFavouriteSubject(e.target.value)}
                      className="profile-input"
                      placeholder="Computer Science, Calculus..."
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="profile-label">CUSTOM STATUS</label>
                    <input
                      type="text"
                      value={customStatus}
                      onChange={(e) => setCustomStatus(e.target.value)}
                      className="profile-input"
                      placeholder="Grinding DSA before finals..."
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
                  <p className="text-sm text-slate-600 dark:text-slate-300 italic min-h-[1.5rem] mt-1 pr-4">
                    {bBio || "This user holds a silent resolution to achieve focus.exe."}
                  </p>

                  <div className="grid grid-cols-2 gap-4 mt-2 text-xs">
                    <div>
                      <span className="text-[10px] text-gray-500 uppercase tracking-wider font-mono">Study Goal</span>
                      <p className="font-semibold text-slate-800 dark:text-white">{studyGoal || "None specified"}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-500 uppercase tracking-wider font-mono">Subject focus</span>
                      <p className="font-semibold text-slate-800 dark:text-white">{favouriteSubject || "None specified"}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* RPG Level bar */}
            {!dbLoading && (
              <div className="mt-2 p-3 bg-gradient-to-r from-orange-500/5 to-transparent rounded-lg border border-orange-500/10">
                <div className="flex justify-between items-center text-xs font-mono mb-1.5">
                  <span className="font-bold text-orange-500">LEVEL {stats.level}</span>
                  <span className="text-gray-500">{stats.xp} / {stats.xpForNextLevel} XP</span>
                </div>
                <div className="w-full bg-gray-250 dark:bg-white/10 h-2.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-orange-500 to-[#ffb454] h-full rounded-full transition-all duration-500" 
                    style={{ width: `${stats.levelProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Sub Meta Info */}
            <div className="flex flex-wrap items-center gap-6 mt-2 pt-3 border-t border-gray-200 dark:border-white/10 text-xs text-gray-500 dark:text-gray-400 font-mono">
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
            <div className="mt-2 flex gap-2">
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
          <div className="p-4 rounded-xl border border-gray-250 dark:border-white/10 bg-white dark:bg-[#12161d]">
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
                      : "border-gray-250 dark:border-white/10 hover:border-orange-400"
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

      {/* Heatmap & Weekly Graph grid split */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Heatmap Card */}
        <div className="p-5 rounded-xl border border-gray-250 dark:border-white/10 bg-white dark:bg-[#12161d] flex flex-col">
          <span className="setup-label mb-3 flex items-center gap-1.5"><Activity size={12} className="text-orange-500"/> Activity Heatmap</span>
          {dbLoading ? (
            <div className="flex-1 flex items-center justify-center h-[120px] text-xs font-mono text-gray-500">Compiling activity map...</div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-thin">
                {stats.heatmapWeeks.map((week, wIdx) => (
                  <div key={wIdx} className="flex flex-col gap-1">
                    {week.map((day, dIdx) => {
                      let color = "bg-gray-200 dark:bg-neutral-800"; // 0
                      if (day.count === 1) color = "bg-orange-200 dark:bg-orange-950";
                      else if (day.count === 2) color = "bg-orange-300 dark:bg-orange-800";
                      else if (day.count === 3) color = "bg-orange-400 dark:bg-orange-600";
                      else if (day.count > 3) color = "bg-orange-500 dark:bg-orange-500";
                      
                      return (
                        <div 
                          key={dIdx} 
                          className={`w-3 h-3 rounded-[2px] ${color} transition-colors duration-300 hover:ring-1 hover:ring-orange-500`}
                          title={`${day.date}: ${day.count} activities`}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
              <div className="flex justify-between items-center text-[9px] font-mono text-gray-500">
                <span>12 weeks ago</span>
                <div className="flex items-center gap-1">
                  <span>Less</span>
                  <div className="w-2.5 h-2.5 rounded-[1px] bg-gray-200 dark:bg-neutral-800" />
                  <div className="w-2.5 h-2.5 rounded-[1px] bg-orange-200 dark:bg-orange-950" />
                  <div className="w-2.5 h-2.5 rounded-[1px] bg-orange-300 dark:bg-orange-800" />
                  <div className="w-2.5 h-2.5 rounded-[1px] bg-orange-400 dark:bg-orange-600" />
                  <div className="w-2.5 h-2.5 rounded-[1px] bg-orange-500 dark:bg-orange-500" />
                  <span>More</span>
                </div>
                <span>Today</span>
              </div>
            </div>
          )}
        </div>

        {/* Weekly Graph Card */}
        <div className="p-5 rounded-xl border border-gray-250 dark:border-white/10 bg-white dark:bg-[#12161d] flex flex-col">
          <span className="setup-label mb-3 flex items-center gap-1.5"><Clock size={12} className="text-orange-500"/> Focus Hours (This Week)</span>
          {dbLoading ? (
            <div className="flex-1 flex items-center justify-center h-[120px] text-xs font-mono text-gray-500">Loading weekly telemetry...</div>
          ) : (
            <div className="flex-1 flex items-end justify-between gap-2 h-[120px] pt-4">
              {["M", "T", "W", "T", "F", "S", "S"].map((day, idx) => {
                const mins = stats.weeklyMinutes[idx] || 0;
                const heightPercent = Math.min(100, Math.max(8, (mins / 120) * 100)); // cap at 2 hours for 100% height, min 8% for visibility
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
                    <div className="relative w-full flex justify-center">
                      {mins > 0 && (
                        <span className="absolute -top-6 text-[9px] font-bold font-mono bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 px-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                          {mins}m
                        </span>
                      )}
                      <div 
                        className={`w-full max-w-[20px] rounded-t-[4px] transition-all duration-500 ${
                          mins > 0 
                            ? "bg-gradient-to-t from-orange-600 to-orange-400 hover:filter hover:brightness-110" 
                            : "bg-gray-200 dark:bg-neutral-800"
                        }`}
                        style={{ height: `${heightPercent}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-bold text-gray-500 font-mono">{day}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Gamified Achievements section */}
      <section className="p-5 rounded-xl border border-gray-250 dark:border-white/10 bg-white dark:bg-[#12161d] mb-8">
        <span className="setup-label mb-3 flex items-center gap-1.5"><Award size={14} className="text-orange-500"/> Achievement Badges</span>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {[
            { id: "streak", name: "Streak Master", desc: "Study 3 consecutive days", unlocked: stats.streak >= 3 },
            { id: "focus", name: "Focus Guru", desc: "Focus for over 2.0 hours", unlocked: parseFloat(stats.hoursFocused) >= 2.0 },
            { id: "quiz", name: "Quiz Champ", desc: "Complete 5 quiz attempts", unlocked: stats.quizzesCount >= 5 },
            { id: "gladiator", name: "1v1 Gladiator", desc: "Participate in 3 battles", unlocked: stats.battlesCount >= 3 },
            { id: "revision", name: "Revisionist", desc: "Build 3 revision summaries", unlocked: stats.revisionsCount >= 3 },
            { id: "scholar", name: "Scholar", desc: "Upload 3 note files", unlocked: stats.docsUploaded >= 3 },
          ].map((badge) => (
            <div 
              key={badge.id}
              className={`p-3 rounded-lg border flex flex-col items-center text-center justify-between gap-1 transition-all ${
                badge.unlocked 
                  ? "border-orange-500/30 bg-orange-500/[0.03] text-orange-500" 
                  : "border-gray-250 dark:border-white/5 bg-gray-50 dark:bg-neutral-900/10 text-gray-500 opacity-60"
              }`}
            >
              <Trophy size={28} className={badge.unlocked ? "text-orange-500 animate-pulse" : "text-gray-400"} />
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-bold font-mono tracking-tight leading-tight">{badge.name}</span>
                <span className="text-[8px] leading-tight text-gray-500">{badge.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

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
            <div className="p-4 rounded-xl border border-gray-250 dark:border-white/10 bg-white dark:bg-[#12161d] flex flex-col justify-between min-h-[90px] hover:border-orange-500/30 transition-all duration-300">
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
            <div className="p-4 rounded-xl border border-gray-250 dark:border-white/10 bg-white dark:bg-[#12161d] flex flex-col justify-between min-h-[90px] hover:border-orange-500/30 transition-all duration-300">
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
            <div className="p-4 rounded-xl border border-gray-250 dark:border-white/10 bg-white dark:bg-[#12161d] flex flex-col justify-between min-h-[90px] hover:border-orange-500/30 transition-all duration-300">
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
            <div className="p-4 rounded-xl border border-gray-250 dark:border-white/10 bg-white dark:bg-[#12161d] flex flex-col justify-between min-h-[90px] hover:border-orange-500/30 transition-all duration-300">
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
            <div className="p-4 rounded-xl border border-gray-250 dark:border-white/10 bg-white dark:bg-[#12161d] flex flex-col justify-between min-h-[90px] hover:border-orange-500/30 transition-all duration-300">
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
            <div className="p-4 rounded-xl border border-gray-250 dark:border-white/10 bg-white dark:bg-[#12161d] flex flex-col justify-between min-h-[90px] hover:border-orange-500/30 transition-all duration-300">
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

            {/* Extra Stats: Focus Hours, streak, upload */}
            <div className="p-4 rounded-xl border border-gray-250 dark:border-white/10 bg-white dark:bg-[#12161d] flex flex-col justify-between min-h-[90px] hover:border-orange-500/30 transition-all duration-300">
              <div className="flex justify-between items-center text-gray-500 dark:text-gray-400">
                <Clock size={16} className="text-orange-500" />
                <span className="text-[10px] font-mono font-semibold uppercase">Hours Focused</span>
              </div>
              <div className="mt-2">
                <p className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
                  {dbLoading ? "—" : stats.hoursFocused}h
                </p>
                <p className="text-[10px] text-gray-500 mt-1">Flow session totals</p>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-gray-250 dark:border-white/10 bg-white dark:bg-[#12161d] flex flex-col justify-between min-h-[90px] hover:border-orange-500/30 transition-all duration-300">
              <div className="flex justify-between items-center text-gray-500 dark:text-gray-400">
                <Activity size={16} className="text-orange-500 animate-bounce" />
                <span className="text-[10px] font-mono font-semibold uppercase">Study Streak</span>
              </div>
              <div className="mt-2">
                <p className="text-2xl font-bold font-mono text-[#ffb454]">
                  🔥 {dbLoading ? "—" : stats.streak} days
                </p>
                <p className="text-[10px] text-gray-500 mt-1">Consecutive focus</p>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-gray-250 dark:border-white/10 bg-white dark:bg-[#12161d] flex flex-col justify-between min-h-[90px] hover:border-orange-500/30 transition-all duration-300">
              <div className="flex justify-between items-center text-gray-500 dark:text-gray-400">
                <FileText size={16} />
                <span className="text-[10px] font-mono font-semibold uppercase">Uploaded Notes</span>
              </div>
              <div className="mt-2">
                <p className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
                  {dbLoading ? "—" : stats.docsUploaded}
                </p>
                <p className="text-[10px] text-gray-500 mt-1">Note files compiled</p>
              </div>
            </div>

          </div>

          {/* Session tally */}
          <div className="p-5 rounded-xl border border-orange-500/20 bg-orange-500/[0.02] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-orange-500/10 text-orange-500 rounded-lg">
                <PenTool size={20} />
              </div>
              <div>
                <h5 className="font-bold text-slate-900 dark:text-white text-sm">Total Study Sessions</h5>
                <p className="text-xs text-gray-500">Accumulated quizzes, decks, battles & focus sessions</p>
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
            className="flex flex-col gap-4 p-5 rounded-xl border border-gray-250 dark:border-white/10 bg-white dark:bg-[#12161d] overflow-y-auto"
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
                        <span className="font-semibold text-slate-800 dark:text-white uppercase truncate max-w-[120px]" title={a.title}>{a.title}</span>
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
          <div className="p-5 rounded-xl border border-gray-250 dark:border-white/10 bg-white dark:bg-[#12161d]">
            <span className="profile-label">CHANGE USERNAME</span>
            {editingUsername ? (
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="text"
                  value={draftUsername}
                  onChange={(e) => setDraftUsername(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitUsernameChange()}
                  disabled={savingUsername}
                  className="flex-1 rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-[#12161d] text-slate-900 dark:text-white px-3 py-2 text-sm outline-none focus:border-orange-500"
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
          <div className="p-5 rounded-xl border border-gray-250 dark:border-white/10 bg-white dark:bg-[#12161d] flex flex-col justify-between gap-4">
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

            <div className="pt-4 border-t border-gray-250 dark:border-white/10 flex justify-between items-center">
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
