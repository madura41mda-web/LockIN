import { useEffect, useState } from "react";
import { Copy, Crown, Loader2, Check } from "lucide-react";
import { setReady, startBattle } from "./battleApi";
import Avatar from "../Avatar";

export default function WaitingRoom({ room, players, myPlayer, userId, onLeave }) {
  const [copied, setCopied] = useState(false);
  const [countdown, setCountdown] = useState(null);
  
  const isHost = room.host_id === userId;
  const bothReady = players.length === 2 && players.every((p) => p.is_ready);
  const link = `${window.location.origin}/#/battle-join/${room.battle_code}`;

  // Manage Web Audio countdown ticks
  function playCountdownBeep(isGo) {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc.type = "sine";
      osc.frequency.setValueAtTime(isGo ? 880 : 440, audioCtx.currentTime);
      
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      osc.start();
      osc.stop(audioCtx.currentTime + 0.3);
    } catch (e) {
      console.error("Audio synth error:", e);
    }
  }

  // Trigger countdown when both are ready
  useEffect(() => {
    if (bothReady) {
      setCountdown(3);
    } else {
      setCountdown(null);
    }
  }, [bothReady]);

  // Countdown timer logic
  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      if (isHost && room.status === "waiting") {
        startBattle(room.id).catch(console.error);
      }
      return;
    }

    playCountdownBeep(countdown === 1);

    const timer = setTimeout(() => {
      setCountdown(countdown - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown, isHost, room.id, room.status]);

  function toggleReady() {
    if (!myPlayer) return;
    setReady(room.id, userId, !myPlayer.is_ready).catch(console.error);
  }

  function copyLink() {
    navigator.clipboard?.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <main className="feature-page" style={{ maxWidth: "48rem" }}>
      <header className="feature-page-header border-b border-gray-250 dark:border-white/10 pb-4 mb-6">
        <div style={{ flex: 1 }}>
          <span className="setup-label">gladiator_arena_waiting</span>
          <h3 className="feature-page-title">{room.module_name || "Gladiator Battle"}</h3>
          <p className="feature-page-copy">
            {room.question_count} questions · {room.difficulty} · {room.time_per_question}s per question
          </p>
        </div>
      </header>

      {/* Countdown overlay banner */}
      {countdown !== null && (
        <div className="mb-6 p-4 rounded-xl bg-orange-500/10 border border-orange-500/20 text-center animate-pulse">
          <p className="text-sm font-mono font-bold text-orange-500 uppercase tracking-widest">
            {countdown === 1 ? "🔥 FIGHT! INCOMING BATTLE..." : `⚔️ BATTLE BEGINS IN ${countdown - 1}...`}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left column: Lobby Invite */}
        <div className="md:col-span-1 flex flex-col gap-4">
          <section className="p-5 rounded-xl border border-gray-250 dark:border-white/10 bg-white dark:bg-[#12161d] flex flex-col gap-4">
            <span className="setup-label">LOBBY CODE</span>
            <div className="text-3xl font-bold font-mono text-center tracking-wider text-orange-500 py-2 border border-dashed border-orange-500/30 rounded-lg bg-orange-500/5 select-all">
              {room.battle_code}
            </div>
            <button type="button" className="secondary w-full py-2 flex items-center justify-center gap-1.5 font-semibold text-xs" onClick={copyLink}>
              {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
              {copied ? "Copied!" : "Copy Invite Link"}
            </button>
            <p className="text-[10px] text-gray-500 text-center">Share this code with your rival to start the battle match.</p>
          </section>

          <button type="button" className="secondary w-full py-2.5 font-semibold text-xs border-red-500/20 text-red-500 hover:bg-red-500/5" onClick={onLeave}>
            Quit Arena
          </button>
        </div>

        {/* Right column: Player Cards */}
        <div className="md:col-span-2 flex flex-col gap-4">
          <section className="p-5 rounded-xl border border-gray-250 dark:border-white/10 bg-white dark:bg-[#12161d] flex flex-col gap-4 flex-1">
            <span className="setup-label">MATCH PLAYERS ({players.length}/2)</span>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {players.map((p) => {
                const isSelf = p.user_id === userId;
                return (
                  <div 
                    key={p.id} 
                    className={`p-4 rounded-xl border flex flex-col items-center text-center gap-3 transition-all relative ${
                      p.is_ready 
                        ? "border-orange-500 bg-orange-500/[0.02] shadow-[0_0_15px_rgba(249,115,22,0.05)]" 
                        : "border-gray-250 dark:border-white/5 bg-[#171c25]/20"
                    }`}
                  >
                    {p.is_host && (
                      <span className="absolute top-3 left-3 text-orange-500" title="Room Owner">
                        <Crown size={16} />
                      </span>
                    )}

                    <Avatar choice={p.avatar} size={64} />

                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1">
                        {p.username} 
                        {isSelf && <span className="text-[9px] font-bold bg-neutral-800 text-gray-400 px-1 rounded-sm">YOU</span>}
                      </span>
                      {p.status && (
                        <span className="text-[10px] text-gray-500 italic max-w-[150px] truncate" title={p.status}>
                          💬 {p.status}
                        </span>
                      )}
                    </div>

                    <div className="mt-2">
                      <span className={`text-[10px] font-bold font-mono px-3 py-1 rounded-full ${
                        p.is_ready 
                          ? "bg-green-500/10 text-green-500 border border-green-500/20" 
                          : "bg-gray-250 dark:bg-white/5 text-gray-500 border border-transparent"
                      }`}>
                        {p.is_ready ? "READY" : "NOT READY"}
                      </span>
                    </div>

                    {!p.is_connected && (
                      <div className="absolute inset-0 bg-neutral-950/70 rounded-xl flex items-center justify-center backdrop-blur-[1px]">
                        <span className="text-[10px] bg-red-500/20 border border-red-500/30 text-red-500 font-bold px-2 py-0.5 rounded font-mono uppercase tracking-wider">Disconnected</span>
                      </div>
                    )}
                  </div>
                );
              })}

              {players.length < 2 && (
                <div className="p-4 rounded-xl border border-dashed border-gray-250 dark:border-white/5 flex flex-col items-center justify-center text-center gap-2 min-h-[160px]">
                  <Loader2 className="text-orange-500 animate-spin" size={24} />
                  <div>
                    <span className="text-xs font-bold text-slate-700 dark:text-gray-400">Waiting for Opponent</span>
                    <p className="text-[10px] text-gray-500 mt-0.5">Waiting for connection invite...</p>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-gray-250 dark:border-white/10 flex gap-2">
              <button 
                type="button" 
                className={`flex-1 py-2.5 font-bold text-xs rounded-lg transition-all ${
                  myPlayer?.is_ready 
                    ? "secondary text-orange-500 border-orange-500/20" 
                    : "generate-btn"
                }`}
                onClick={toggleReady}
              >
                {myPlayer?.is_ready ? "Cancel Ready State" : "Declare Ready"}
              </button>
            </div>
          </section>
        </div>

      </div>
    </main>
  );
}