import { useEffect, useMemo, useState } from "react";
import { Check, Copy, LogOut, Pause, Play, RotateCcw, Send, Users } from "lucide-react";
import Avatar from "./Avatar";
import { useStudyLobby } from "../hooks/useStudyLobby";

function formatTime(secs) {
  const safeSecs = Math.max(0, Math.round(secs || 0));
  const minutes = Math.floor(safeSecs / 60);
  const seconds = safeSecs % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

function timerRemaining(timer) {
  if (timer.status === "running" && timer.endsAt) {
    return Math.max(0, Math.round((new Date(timer.endsAt).getTime() - Date.now()) / 1000));
  }
  return timer.remainingSeconds || timer.durationSeconds || 25 * 60;
}

export default function StudyLobby({ session, profile, currentActiveMode, flowIsRunning, onClose }) {
  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [copied, setCopied] = useState(false);
  const [messageDraft, setMessageDraft] = useState("");
  const [selectedDuration, setSelectedDuration] = useState(25 * 60);
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);

  const currentAction = useMemo(() => {
    if (flowIsRunning) return "Focusing";
    if (currentActiveMode === "quiz") return "Taking Quiz";
    if (currentActiveMode === "battle") return "Gladiating";
    if (currentActiveMode === "flashcards") return "Reviewing Cards";
    if (currentActiveMode === "revision") return "Revising Notes";
    return "Idle";
  }, [currentActiveMode, flowIsRunning]);

  const lobby = useStudyLobby({ session, profile, currentAction });
  const roomCode = lobby.room?.code || "";

  useEffect(() => {
    setSelectedDuration(lobby.timer.durationSeconds || 25 * 60);
    setSecondsLeft(timerRemaining(lobby.timer));
  }, [lobby.timer]);

  useEffect(() => {
    if (lobby.timer.status !== "running") return;
    const tick = () => setSecondsLeft(timerRemaining(lobby.timer));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [lobby.timer]);

  async function copyToClipboard() {
    await navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleJoinRoom(event) {
    event.preventDefault();
    await lobby.joinRoom(roomCodeInput);
  }

  async function handleSendMessage(event) {
    event.preventDefault();
    const body = messageDraft.trim();
    if (!body) return;
    setMessageDraft("");
    await lobby.postMessage(body);
  }

  function startTimer(durationSeconds = selectedDuration) {
    const now = new Date();
    const endsAt = new Date(now.getTime() + durationSeconds * 1000);
    lobby.setTimerState({
      status: "running",
      durationSeconds,
      remainingSeconds: durationSeconds,
      startedAt: now.toISOString(),
      endsAt: endsAt.toISOString(),
    });
  }

  function pauseTimer() {
    lobby.setTimerState({
      status: "paused",
      durationSeconds: selectedDuration,
      remainingSeconds: secondsLeft,
      startedAt: null,
      endsAt: null,
    });
  }

  function resetTimer() {
    lobby.setTimerState({
      status: "idle",
      durationSeconds: selectedDuration,
      remainingSeconds: selectedDuration,
      startedAt: null,
      endsAt: null,
    });
  }

  function leaveRoom() {
    lobby.leaveRoom();
  }

  const onlineCount = lobby.participants.filter((member) => member.is_online).length;
  const focusingCount = lobby.participants.filter((member) => member.current_action === "Focusing").length;

  if (!session) {
    return (
      <main className="feature-page" style={{ maxWidth: "36rem" }}>
        <header className="feature-page-header border-b border-gray-250 dark:border-white/10 pb-4 mb-6">
          <div style={{ flex: 1 }}>
            <span className="setup-label">shared_study_rooms</span>
            <h3 className="feature-page-title">Study Lobby</h3>
            <p className="feature-page-copy">Sign in to create or join a secure real-time study room.</p>
          </div>
          <button type="button" className="secondary" onClick={onClose} aria-label="Close Lobby">
            X
          </button>
        </header>
      </main>
    );
  }

  if (!lobby.isInRoom) {
    return (
      <main className="feature-page" style={{ maxWidth: "36rem" }}>
        <header className="feature-page-header border-b border-gray-250 dark:border-white/10 pb-4 mb-6">
          <div style={{ flex: 1 }}>
            <span className="setup-label">shared_study_rooms</span>
            <h3 className="feature-page-title">Study Lobby</h3>
            <p className="feature-page-copy">Focus together with durable chat, presence, and a synced host timer.</p>
          </div>
          <button type="button" className="secondary" onClick={onClose} aria-label="Close Lobby">
            X
          </button>
        </header>

        <section className="study-input-panel p-6 rounded-xl border border-gray-250 dark:border-white/10 bg-white dark:bg-[#12161d] flex flex-col gap-6">
          <div>
            <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Create or Join a Room</h4>
            <p className="text-xs text-gray-500">Rooms restore after refresh and reconnect through Supabase Realtime.</p>
          </div>

          <button
            type="button"
            onClick={lobby.createRoom}
            className="generate-btn w-full py-3 font-semibold flex items-center justify-center gap-2"
            disabled={lobby.status === "creating"}
          >
            <Users size={18} /> {lobby.status === "creating" ? "Creating..." : "Create New Room"}
          </button>

          <form onSubmit={handleJoinRoom} className="flex gap-2">
            <input
              type="text"
              value={roomCodeInput}
              onChange={(event) => setRoomCodeInput(event.target.value.toUpperCase())}
              placeholder="ROOM-123456"
              className="flex-1 rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-[#12161d] text-slate-900 dark:text-white px-3 py-2.5 text-sm outline-none focus:border-orange-500 font-mono"
            />
            <button type="submit" className="secondary px-5 font-semibold" disabled={lobby.status === "joining"}>
              {lobby.status === "joining" ? "Joining..." : "Join"}
            </button>
          </form>

          {lobby.error && <p className="upload-error mono">{lobby.error}</p>}
        </section>
      </main>
    );
  }

  return (
    <main className="feature-page relative overflow-hidden" style={{ maxWidth: "64rem" }}>
      <header className="feature-page-header border-b border-gray-250 dark:border-white/10 pb-4 mb-6 flex justify-between items-center">
        <div style={{ flex: 1 }}>
          <span className="setup-label flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> {lobby.status === "reconnecting" ? "reconnecting" : "study_room_connected"}
          </span>
          <h3 className="feature-page-title flex items-center gap-3">
            Room Code: <span className="font-mono text-orange-500">{roomCode}</span>
            <button type="button" onClick={copyToClipboard} className="secondary p-1 rounded" title="Copy room code">
              {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
            </button>
          </h3>
        </div>
        <button type="button" onClick={leaveRoom} className="secondary text-xs flex items-center gap-1.5 border-red-500/20 text-red-500 hover:bg-red-500/5">
          <LogOut size={14} /> Leave Room
        </button>
      </header>

      {lobby.error && <p className="upload-error mono mb-4">{lobby.error}</p>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 flex flex-col gap-6">
          <section className="p-6 rounded-xl border border-gray-250 dark:border-white/10 bg-white dark:bg-[#12161d] flex flex-col items-center justify-center text-center gap-6">
            <span className="setup-label">synced_lobby_timer</span>
            <div className="relative w-48 h-48 rounded-full border-4 border-orange-500/10 flex flex-col items-center justify-center gap-1">
              <span className="text-4xl font-bold font-mono tracking-tight text-slate-900 dark:text-white">
                {formatTime(secondsLeft)}
              </span>
              <span className="text-[10px] text-gray-500 uppercase tracking-widest font-mono font-semibold">
                {lobby.timer.status === "running" ? "Focus Session" : lobby.timer.status}
              </span>
              {lobby.timer.status === "running" && (
                <div className="absolute inset-[-4px] rounded-full border-4 border-t-orange-500 border-r-orange-400 border-b-transparent border-l-transparent animate-spin" style={{ animationDuration: "3s" }} />
              )}
            </div>

            {lobby.isHost ? (
              <div className="flex flex-col gap-4 w-full max-w-sm">
                <div className="flex gap-2">
                  {[15, 25, 45, 60].map((minutes) => {
                    const duration = minutes * 60;
                    return (
                      <button
                        key={minutes}
                        type="button"
                        onClick={() => {
                          setSelectedDuration(duration);
                          if (lobby.timer.status !== "running") setSecondsLeft(duration);
                        }}
                        className={`flex-1 py-1.5 text-xs font-mono font-bold rounded-lg border ${
                          selectedDuration === duration
                            ? "border-orange-500 bg-orange-500/10 text-orange-500"
                            : "border-gray-250 dark:border-white/10 hover:border-orange-400"
                        }`}
                        disabled={lobby.timer.status === "running"}
                      >
                        {minutes}m
                      </button>
                    );
                  })}
                </div>

                <div className="flex gap-2">
                  {lobby.timer.status === "running" ? (
                    <button type="button" onClick={pauseTimer} className="secondary w-full py-2.5 font-semibold text-xs flex items-center justify-center gap-1.5">
                      <Pause size={14} /> Pause
                    </button>
                  ) : (
                    <button type="button" onClick={() => startTimer(secondsLeft || selectedDuration)} className="generate-btn w-full py-2.5 font-semibold text-xs flex items-center justify-center gap-1.5">
                      <Play size={14} /> {lobby.timer.status === "paused" ? "Resume" : "Start"}
                    </button>
                  )}
                  <button type="button" onClick={resetTimer} className="secondary py-2.5 font-semibold text-xs flex items-center justify-center gap-1.5">
                    <RotateCcw size={14} /> Reset
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-neutral-900/30 border border-white/5 rounded-lg text-xs text-gray-500">
                Sync Timer is managed by the Room Host.
              </div>
            )}
          </section>

          <section className="p-5 rounded-xl border border-gray-250 dark:border-white/10 bg-white dark:bg-[#12161d] flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="setup-label">lobby_chat</span>
              <span className="text-[10px] font-mono text-gray-500">{lobby.messages.length} messages</span>
            </div>
            <div className="flex flex-col gap-3 max-h-[320px] overflow-y-auto pr-1">
              {lobby.messages.length === 0 ? (
                <p className="text-xs text-gray-500 mono">No messages yet.</p>
              ) : (
                lobby.messages.map((message) => (
                  <article key={message.id} className="p-3 rounded-lg border border-gray-250 dark:border-white/5 bg-[#171c25]/30">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">{message.username || "Student"}</span>
                      <time className="text-[10px] text-gray-500 font-mono">
                        {new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </time>
                    </div>
                    <p className="text-sm text-slate-700 dark:text-slate-300 mt-1 whitespace-pre-wrap">{message.body}</p>
                  </article>
                ))
              )}
            </div>
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <input
                type="text"
                value={messageDraft}
                onChange={(event) => setMessageDraft(event.target.value)}
                placeholder="Send a message..."
                className="flex-1 rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-[#12161d] text-slate-900 dark:text-white px-3 py-2.5 text-sm outline-none focus:border-orange-500"
              />
              <button type="submit" className="secondary px-4" aria-label="Send message">
                <Send size={16} />
              </button>
            </form>
          </section>
        </div>

        <div className="flex flex-col gap-6">
          <section className="p-4 rounded-xl border border-orange-500/20 bg-orange-500/[0.02] flex items-center justify-between">
            <div>
              <h5 className="font-bold text-slate-900 dark:text-white text-xs">Group Focus Score</h5>
              <p className="text-[10px] text-gray-500">{focusingCount} of {onlineCount} active</p>
            </div>
            <span className="text-2xl font-bold font-mono text-orange-500">{focusingCount * 10} pts</span>
          </section>

          <section className="p-5 rounded-xl border border-gray-250 dark:border-white/10 bg-white dark:bg-[#12161d] flex flex-col gap-4 flex-1">
            <span className="setup-label flex items-center gap-1.5"><Users size={14} /> Connected Peers ({onlineCount})</span>
            <div className="flex flex-col gap-3 overflow-y-auto max-h-[520px]">
              {lobby.participants.map((member) => {
                const isSelf = member.user_id === session.user.id;
                const isOnline = member.is_online;

                return (
                  <div
                    key={member.id || `${member.room_id}-${member.user_id}`}
                    className={`p-3 rounded-lg border flex items-center justify-between gap-3 transition-colors ${
                      isSelf ? "border-orange-500/30 bg-orange-500/[0.02]" : "border-gray-250 dark:border-white/5 bg-[#171c25]/30"
                    } ${isOnline ? "" : "opacity-60"}`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="relative">
                        <Avatar choice={member.avatar} size={32} />
                        <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#12161d] ${isOnline ? "bg-emerald-500" : "bg-gray-500"}`} />
                      </div>
                      <div className="flex flex-col truncate">
                        <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1 truncate">
                          {member.username}
                          {member.is_host && <span className="text-[8px] bg-orange-500/10 text-orange-500 border border-orange-500/20 px-1 rounded-sm">HOST</span>}
                          {isSelf && <span className="text-[8px] bg-neutral-800 text-gray-400 px-1 rounded-sm">YOU</span>}
                        </span>
                        {member.custom_status && (
                          <span className="text-[9px] text-gray-500 truncate" title={member.custom_status}>
                            {member.custom_status}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] font-semibold font-mono px-2 py-0.5 rounded-full bg-gray-250 dark:bg-white/5 text-gray-500">
                      {member.current_action || "Idle"}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
