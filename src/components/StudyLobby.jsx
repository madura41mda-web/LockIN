import { useEffect, useState, useRef } from "react";
import { Users, Copy, Check, Play, Square, Smile, Sparkles, Trophy, LogOut } from "lucide-react";
import { supabase } from "../supabaseClient";
import Avatar from "./Avatar";

const EMOJIS = ["🔥", "🚀", "👏", "💡", "☕", "💯"];

export default function StudyLobby({ session, profile, currentActiveMode, flowIsRunning, onClose }) {
  const user = session?.user;
  const userId = user?.id || "anon-" + Math.random().toString(36).substring(2, 8);
  const username = profile?.username || "Student";
  const avatar = profile?.avatarChoice || "0";
  const customStatus = profile?.status || "";

  // Lobby navigation states
  const [roomCode, setRoomCode] = useState("");
  const [isInRoom, setIsInRoom] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [members, setMembers] = useState([]);
  const [copied, setCopied] = useState(false);

  // Synced Timer States
  const [timerDuration, setTimerDuration] = useState(25 * 60); // default 25 min
  const [timerTimeLeft, setTimerTimeLeft] = useState(25 * 60);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerEndTime, setTimerEndTime] = useState(null);
  
  // Floating reactions list
  const [reactions, setReactions] = useState([]);

  // Session summary trigger
  const [showSummary, setShowSummary] = useState(false);
  const [summaryTally, setSummaryTally] = useState({ participantsCount: 0, totalMinutes: 0 });

  const channelRef = useRef(null);
  const timerIntervalRef = useRef(null);

  // Generate a random room code
  const handleCreateRoom = () => {
    const code = "ROOM-" + Math.floor(100000 + Math.random() * 900000);
    setRoomCode(code);
    setIsHost(true);
    setIsInRoom(true);
  };

  const handleJoinRoom = (e) => {
    e.preventDefault();
    const cleanCode = roomCode.trim().toUpperCase();
    if (!cleanCode) return;
    setRoomCode(cleanCode);
    setIsHost(false);
    setIsInRoom(true);
  };

  // Determine current active mode
  const getCurrentAction = () => {
    if (flowIsRunning) return "Focusing";
    if (currentActiveMode === "quiz") return "Taking Quiz";
    if (currentActiveMode === "battle") return "Gladiating";
    if (currentActiveMode === "flashcards") return "Reviewing Cards";
    if (currentActiveMode === "revision") return "Revising Notes";
    return "Idle";
  };

  const currentAction = getCurrentAction();

  // Supabase Realtime logic
  useEffect(() => {
    if (!isInRoom || !roomCode) return;

    const channelName = `lobby:${roomCode}`;
    const channel = supabase.channel(channelName, {
      config: {
        presence: { key: userId },
      },
    });

    channelRef.current = channel;

    // Listen for presence state changes
    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const membersList = Object.values(state).flatMap((presences) => presences);
        setMembers(membersList);

        // Auto-negotiate host if current host leaves or if no host exists
        const hasHost = membersList.some((m) => m.isHost);
        if (!hasHost && membersList.length > 0) {
          // The oldest joined user becomes the host
          const sorted = [...membersList].sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0));
          if (sorted[0]?.user_id === userId) {
            setIsHost(true);
          }
        }
      })
      .on("presence", { event: "join" }, ({ key, newPresences }) => {
        // Safe display logic or custom alerts could be attached here
      })
      .on("presence", { event: "leave" }, ({ key, leftPresences }) => {
        // Safe display logic
      })
      .on("broadcast", { event: "reaction" }, ({ payload }) => {
        triggerLocalReaction(payload.emoji, payload.senderName);
      })
      .on("broadcast", { event: "timer_update" }, ({ payload }) => {
        if (!isHost) {
          setTimerRunning(payload.running);
          setTimerEndTime(payload.endTime);
          setTimerDuration(payload.duration);
          if (payload.running && payload.endTime) {
            const rem = Math.max(0, Math.round((payload.endTime - Date.now()) / 1000));
            setTimerTimeLeft(rem);
          } else {
            setTimerTimeLeft(payload.duration);
          }
        }
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            user_id: userId,
            username,
            avatar,
            customStatus,
            currentAction,
            isHost,
            joinedAt: Date.now(),
          });
        }
      });

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [isInRoom, roomCode, isHost, currentAction, username, avatar, customStatus]);

  // Sync state tracking when state changes
  useEffect(() => {
    if (channelRef.current && isInRoom) {
      channelRef.current.track({
        user_id: userId,
        username,
        avatar,
        customStatus,
        currentAction,
        isHost,
        joinedAt: Date.now(),
      });
    }
  }, [currentAction, username, avatar, customStatus, isHost]);

  // Synced timer tick
  useEffect(() => {
    if (timerRunning && timerEndTime) {
      const tick = () => {
        const remaining = Math.max(0, Math.round((timerEndTime - Date.now()) / 1000));
        setTimerTimeLeft(remaining);

        if (remaining <= 0) {
          setTimerRunning(false);
          clearInterval(timerIntervalRef.current);
          
          // Complete session - calculate metrics
          const mins = Math.round(timerDuration / 60);
          setSummaryTally({
            participantsCount: members.length,
            totalMinutes: mins * members.length,
          });
          setShowSummary(true);
        }
      };

      tick();
      timerIntervalRef.current = setInterval(tick, 1000);
    } else {
      clearInterval(timerIntervalRef.current);
    }

    return () => clearInterval(timerIntervalRef.current);
  }, [timerRunning, timerEndTime, timerDuration, members.length]);

  // Host Timer Control
  const startTimer = (durSecs) => {
    if (!isHost) return;
    const endTime = Date.now() + durSecs * 1000;
    setTimerDuration(durSecs);
    setTimerTimeLeft(durSecs);
    setTimerEndTime(endTime);
    setTimerRunning(true);

    channelRef.current?.send({
      type: "broadcast",
      event: "timer_update",
      payload: { running: true, endTime, duration: durSecs },
    });
  };

  const stopTimer = () => {
    if (!isHost) return;
    setTimerRunning(false);
    setTimerEndTime(null);
    setTimerTimeLeft(timerDuration);

    channelRef.current?.send({
      type: "broadcast",
      event: "timer_update",
      payload: { running: false, endTime: null, duration: timerDuration },
    });
  };

  // Broadcast emoji reaction
  const sendReaction = (emoji) => {
    if (!channelRef.current) return;
    channelRef.current.send({
      type: "broadcast",
      event: "reaction",
      payload: { emoji, senderName: username },
    });
    // Trigger locally
    triggerLocalReaction(emoji, username);
  };

  // Render floating reactions procedurally
  const triggerLocalReaction = (emoji, sender) => {
    const id = Math.random().toString();
    const newReaction = {
      id,
      emoji,
      sender,
      left: Math.random() * 80 + 10, // random offset percentage
    };
    setReactions((prev) => [...prev, newReaction]);
    setTimeout(() => {
      setReactions((prev) => prev.filter((r) => r.id !== id));
    }, 2000);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const leaveRoom = () => {
    channelRef.current?.unsubscribe();
    channelRef.current = null;
    setIsInRoom(false);
    setIsHost(false);
    setMembers([]);
    setTimerRunning(false);
  };

  // Compute focus score
  const focusingCount = members.filter((m) => m.currentAction === "Focusing").length;
  const totalGroupFocusScore = focusingCount * 10;

  // Format Time Left
  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  if (!isInRoom) {
    return (
      <main className="feature-page" style={{ maxWidth: "36rem" }}>
        <header className="feature-page-header border-b border-gray-250 dark:border-white/10 pb-4 mb-6">
          <div style={{ flex: 1 }}>
            <span className="setup-label">shared_study_rooms</span>
            <h3 className="feature-page-title">Study Lobby</h3>
            <p className="feature-page-copy">Focus together, sync timers, and challenge peers in real-time rooms.</p>
          </div>
          <button type="button" className="secondary" onClick={onClose} aria-label="Close Lobby">
            ✕
          </button>
        </header>

        <section className="study-input-panel p-6 rounded-xl border border-gray-250 dark:border-white/10 bg-white dark:bg-[#12161d] flex flex-col gap-6">
          <div>
            <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Create or Join a Room</h4>
            <p className="text-xs text-gray-500">Collaborate with study buddies globally under a shared timer.</p>
          </div>

          <div className="flex flex-col gap-4">
            <button type="button" onClick={handleCreateRoom} className="generate-btn w-full py-3 font-semibold flex items-center justify-center gap-2">
              <Users size={18} /> Create New Room
            </button>

            <div className="flex items-center gap-3 font-mono text-xs text-gray-500 my-2">
              <span className="flex-1 border-t border-gray-250 dark:border-white/10" />
              <span>OR JOIN AN EXISTING ONE</span>
              <span className="flex-1 border-t border-gray-250 dark:border-white/10" />
            </div>

            <form onSubmit={handleJoinRoom} className="flex gap-2">
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="ROOM-CODE (e.g. ROOM-123456)"
                className="flex-1 rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-[#12161d] text-slate-900 dark:text-white px-3 py-2.5 text-sm outline-none focus:border-orange-500 font-mono"
              />
              <button type="submit" className="secondary px-5 font-semibold">Join</button>
            </form>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="feature-page relative overflow-hidden" style={{ maxWidth: "60rem" }}>
      {/* Reaction Floating Node Render */}
      <div className="absolute inset-0 pointer-events-none z-50">
        {reactions.map((r) => (
          <div
            key={r.id}
            className="absolute bottom-10 flex flex-col items-center animate-float-up"
            style={{ left: `${r.left}%` }}
          >
            <span className="text-3xl filter drop-shadow">{r.emoji}</span>
            <span className="text-[8px] bg-neutral-900/80 text-white px-1.5 py-0.5 rounded font-mono mt-1 opacity-75">{r.sender}</span>
          </div>
        ))}
      </div>

      {/* Header */}
      <header className="feature-page-header border-b border-gray-250 dark:border-white/10 pb-4 mb-6 flex justify-between items-center">
        <div style={{ flex: 1 }}>
          <span className="setup-label flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" /> study_room_connected</span>
          <h3 className="feature-page-title flex items-center gap-3">
            Room Code: <span className="font-mono text-orange-500">{roomCode}</span>
            <button 
              type="button" 
              onClick={copyToClipboard} 
              className="secondary p-1 rounded hover:bg-neutral-800 hover:text-white"
              title="Copy room code"
            >
              {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
            </button>
          </h3>
        </div>
        <button type="button" onClick={leaveRoom} className="secondary text-xs flex items-center gap-1.5 border-red-500/20 text-red-500 hover:bg-red-500/5">
          <LogOut size={14} /> Leave Room
        </button>
      </header>

      {/* Main Study Lobby Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Synced Timer Card & Reactions Panel */}
        <div className="md:col-span-2 flex flex-col gap-6">
          <section className="p-6 rounded-xl border border-gray-250 dark:border-white/10 bg-white dark:bg-[#12161d] flex flex-col items-center justify-center text-center gap-6">
            <span className="setup-label">synced_lobby_timer</span>
            
            {/* Circular representation */}
            <div className="relative w-48 h-48 rounded-full border-4 border-orange-500/10 flex flex-col items-center justify-center gap-1">
              <span className="text-4xl font-bold font-mono tracking-tight text-slate-900 dark:text-white">
                {formatTime(timerTimeLeft)}
              </span>
              <span className="text-[10px] text-gray-500 uppercase tracking-widest font-mono font-semibold">
                {timerRunning ? "Focus Session" : "Ready"}
              </span>

              {/* Glowing active ring */}
              {timerRunning && (
                <div className="absolute inset-[-4px] rounded-full border-4 border-t-orange-500 border-r-orange-400 border-b-transparent border-l-transparent animate-spin" style={{ animationDuration: "3s" }} />
              )}
            </div>

            {/* Timer Controls */}
            {isHost ? (
              <div className="flex flex-col gap-4 w-full max-w-xs">
                <div className="flex gap-2">
                  {[15, 25, 45, 60].map((mins) => (
                    <button 
                      key={mins} 
                      type="button" 
                      onClick={() => { if (!timerRunning) { setTimerDuration(mins * 60); setTimerTimeLeft(mins * 60); } }}
                      className={`flex-1 py-1.5 text-xs font-mono font-bold rounded-lg border ${
                        timerDuration === mins * 60 
                          ? "border-orange-500 bg-orange-500/10 text-orange-500" 
                          : "border-gray-250 dark:border-white/10 hover:border-orange-400"
                      }`}
                      disabled={timerRunning}
                    >
                      {mins}m
                    </button>
                  ))}
                </div>

                <div className="flex gap-2">
                  {timerRunning ? (
                    <button type="button" onClick={stopTimer} className="secondary w-full py-2.5 font-semibold text-xs flex items-center justify-center gap-1.5 border-red-500/20 text-red-500">
                      <Square size={14} /> Stop Synced Focus
                    </button>
                  ) : (
                    <button type="button" onClick={() => startTimer(timerDuration)} className="generate-btn w-full py-2.5 font-semibold text-xs flex items-center justify-center gap-1.5">
                      <Play size={14} /> Start Synced Focus
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-3 bg-neutral-900/30 border border-white/5 rounded-lg text-xs text-gray-500">
                ⚠️ Sync Timer is managed by the Room Host.
              </div>
            )}
          </section>

          {/* Quick Reaction Toolbar */}
          <section className="p-4 rounded-xl border border-gray-250 dark:border-white/10 bg-white dark:bg-[#12161d] flex items-center justify-between">
            <span className="text-xs font-bold font-mono text-gray-500 flex items-center gap-1.5"><Smile size={16}/> SEND REACTION:</span>
            <div className="flex gap-2">
              {EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => sendReaction(emoji)}
                  className="w-10 h-10 text-xl rounded-lg border border-gray-250 dark:border-white/10 hover:border-orange-500 bg-white dark:bg-[#171c25] hover:scale-110 active:scale-95 transition-all flex items-center justify-center"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </section>
        </div>

        {/* Members sidebar & Focus Score */}
        <div className="flex flex-col gap-6">
          
          {/* Focus Score card */}
          <section className="p-4 rounded-xl border border-orange-500/20 bg-orange-500/[0.02] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-orange-500/10 text-orange-500 rounded-lg">
                <Sparkles size={18} />
              </div>
              <div>
                <h5 className="font-bold text-slate-900 dark:text-white text-xs">Group Focus Score</h5>
                <p className="text-[10px] text-gray-500">{focusingCount} of {members.length} active</p>
              </div>
            </div>
            <span className="text-2xl font-bold font-mono text-orange-500">
              {totalGroupFocusScore} pts
            </span>
          </section>

          {/* Members List */}
          <section className="p-5 rounded-xl border border-gray-250 dark:border-white/10 bg-white dark:bg-[#12161d] flex flex-col gap-4 flex-1">
            <span className="setup-label flex items-center gap-1.5"><Users size={14}/> Connected Peers ({members.length})</span>
            
            <div className="flex flex-col gap-3 overflow-y-auto max-h-[350px]">
              {members.map((member, idx) => {
                const isSelf = member.user_id === userId;
                const isFocusing = member.currentAction === "Focusing";

                return (
                  <div 
                    key={idx} 
                    className={`p-3 rounded-lg border flex items-center justify-between gap-3 transition-colors ${
                      isSelf 
                        ? "border-orange-500/30 bg-orange-500/[0.02]" 
                        : "border-gray-250 dark:border-white/5 bg-[#171c25]/30"
                    }`}
                  >
                    <div className="flex items-center gap-2 max-w-[150px]">
                      <div className="relative">
                        <Avatar choice={member.avatar} size={32} />
                        {isFocusing && (
                          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-orange-500 border-2 border-[#12161d] animate-pulse" />
                        )}
                      </div>
                      <div className="flex flex-col truncate">
                        <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1 truncate">
                          {member.username} 
                          {member.isHost && <span className="text-[8px] bg-orange-500/10 text-orange-500 border border-orange-500/20 px-1 rounded-sm">HOST</span>}
                          {isSelf && <span className="text-[8px] bg-neutral-800 text-gray-400 px-1 rounded-sm">YOU</span>}
                        </span>
                        {member.customStatus && (
                          <span className="text-[9px] text-gray-500 truncate" title={member.customStatus}>
                            💬 {member.customStatus}
                          </span>
                        )}
                      </div>
                    </div>

                    <span className={`text-[10px] font-semibold font-mono px-2 py-0.5 rounded-full ${
                      isFocusing 
                        ? "bg-orange-500/15 text-orange-500" 
                        : member.currentAction === "Idle" 
                          ? "bg-gray-250 dark:bg-white/5 text-gray-500" 
                          : "bg-emerald-500/15 text-emerald-500"
                    }`}>
                      {member.currentAction}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

        </div>

      </div>

      {/* Synced Focus Session Complete Summary Modal */}
      {showSummary && (
        <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm p-6 rounded-xl border border-gray-250 dark:border-white/10 bg-white dark:bg-[#12161d] text-center flex flex-col items-center gap-4">
            <Trophy size={48} className="text-[#ffb454] animate-bounce" />
            <div>
              <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Focus Block Cleared!</h4>
              <p className="text-xs text-gray-500">Congratulations study room! You crushed it.</p>
            </div>

            <div className="grid grid-cols-2 gap-4 w-full my-2 bg-neutral-900/30 p-3 rounded-lg border border-white/5 font-mono text-xs">
              <div>
                <span className="text-[10px] text-gray-500 uppercase">Participants</span>
                <p className="text-lg font-bold text-slate-900 dark:text-white">{summaryTally.participantsCount}</p>
              </div>
              <div>
                <span className="text-[10px] text-gray-500 uppercase">Focus Minutes</span>
                <p className="text-lg font-bold text-orange-500">+{summaryTally.totalMinutes}m</p>
              </div>
            </div>

            <button type="button" onClick={() => setShowSummary(false)} className="generate-btn w-full py-2 text-xs font-semibold">
              Return to Lobby
            </button>
          </div>
        </div>
      )}

    </main>
  );
}
