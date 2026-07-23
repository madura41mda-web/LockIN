import { useEffect, useRef, useState } from "react";

// Root-relative so the same path resolves correctly in both `vite dev` and a
// production build — anything in /public is served from "/" in both modes.
// NOTE: these files are not included in the repo. Drop matching audio into
// public/sounds/ (rain.mp3, forest.mp3, ocean.mp3, fireplace.mp3,
// instrumental.mp3) — short (30–90s), seamlessly loopable, .mp3 or .ogg.
export const SOUND_ASSETS = {
  rain: "/sounds/rain.mp3",
  forest: "/sounds/forest.mp3",
  ocean: "/sounds/ocean.mp3",
  fireplace: "/sounds/fireplace.mp3",
  instrumental: "/sounds/instrumental.mp3",
};

const STORAGE_KEY = "lockin_flow_ambience_v1";
const FADE_MS = 500;
const FADE_STEPS = 20;

export function loadAmbiencePrefs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function savePrefs(prefs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // localStorage can throw in private-browsing / storage-full situations —
    // ambience just won't persist across sessions, nothing else breaks.
  }
}

/**
 * Owns a single <audio>-backed ambience track for Flow State: loading it,
 * fading it in/out, keeping volume/mute in sync, persisting the user's last
 * choice, and cleaning up fully on unmount or when switching tracks so two
 * loops never overlap.
 *
 * @param {string} activeSound - key into SOUND_ASSETS, or "" for none
 * @param {boolean} isPlayingSound - whether it should currently be audible
 * @param {number} volume - 0..1
 * @param {boolean} isMuted
 * @param {number} stopSignal - bump this (e.g. session-end count) to force a stop
 */
// Web Audio ambient synthesizer fallback
let audioCtx = null;
let activeSynthNodes = [];

function stopSynth() {
  if (activeSynthNodes.length > 0) {
    activeSynthNodes.forEach(node => {
      try {
        if (node.stop) node.stop();
        if (node.disconnect) node.disconnect();
      } catch (e) {}
    });
    activeSynthNodes = [];
  }
}

function startSynth(type, volumeValue, isMuted) {
  stopSynth();
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    if (!audioCtx) {
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }

    const mainGain = audioCtx.createGain();
    const activeVol = isMuted ? 0 : volumeValue * 0.15;
    mainGain.gain.setValueAtTime(activeVol, audioCtx.currentTime);
    mainGain.connect(audioCtx.destination);
    activeSynthNodes.push(mainGain);

    // Create a 2-second white noise buffer
    const bufferSize = audioCtx.sampleRate * 2;
    const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const noiseSource = audioCtx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    if (type === "rain") {
      const filter = audioCtx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(700, audioCtx.currentTime);

      const lfo = audioCtx.createOscillator();
      lfo.frequency.setValueAtTime(0.25, audioCtx.currentTime);
      const lfoGain = audioCtx.createGain();
      lfoGain.gain.setValueAtTime(150, audioCtx.currentTime);

      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);
      noiseSource.connect(filter);
      filter.connect(mainGain);

      lfo.start();
      noiseSource.start();
      activeSynthNodes.push(lfo, noiseSource);
    } else if (type === "ocean") {
      const filter = audioCtx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(350, audioCtx.currentTime);

      const swell = audioCtx.createGain();
      swell.gain.setValueAtTime(0.3, audioCtx.currentTime);

      const lfo = audioCtx.createOscillator();
      lfo.frequency.setValueAtTime(0.08, audioCtx.currentTime);
      const lfoGain = audioCtx.createGain();
      lfoGain.gain.setValueAtTime(0.2, audioCtx.currentTime);

      lfo.connect(lfoGain);
      lfoGain.connect(swell.gain);
      noiseSource.connect(filter);
      filter.connect(swell);
      swell.connect(mainGain);

      lfo.start();
      noiseSource.start();
      activeSynthNodes.push(lfo, noiseSource);
    } else if (type === "fireplace") {
      const filter = audioCtx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(150, audioCtx.currentTime);
      filter.Q.setValueAtTime(1.0, audioCtx.currentTime);

      noiseSource.connect(filter);
      filter.connect(mainGain);
      noiseSource.start();
      activeSynthNodes.push(noiseSource);

      const crackleTimer = setInterval(() => {
        if (!audioCtx || audioCtx.state === "suspended") return;
        if (Math.random() > 0.4) {
          const popOsc = audioCtx.createOscillator();
          const popGain = audioCtx.createGain();
          popOsc.type = "triangle";
          popOsc.frequency.setValueAtTime(250 + Math.random() * 900, audioCtx.currentTime);
          popGain.gain.setValueAtTime(0.03 + Math.random() * 0.12, audioCtx.currentTime);
          popGain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.03 + Math.random() * 0.04);
          popOsc.connect(popGain);
          popGain.connect(mainGain);
          popOsc.start();
          popOsc.stop(audioCtx.currentTime + 0.12);
        }
      }, 180);

      activeSynthNodes.push({ stop: () => clearInterval(crackleTimer) });
    } else if (type === "forest") {
      const filter = audioCtx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(450, audioCtx.currentTime);

      const windGain = audioCtx.createGain();
      windGain.gain.setValueAtTime(0.35, audioCtx.currentTime);

      noiseSource.connect(filter);
      filter.connect(windGain);
      windGain.connect(mainGain);
      noiseSource.start();
      activeSynthNodes.push(noiseSource);

      const birdTimer = setInterval(() => {
        if (!audioCtx || audioCtx.state === "suspended") return;
        if (Math.random() > 0.65) {
          const time = audioCtx.currentTime;
          const chirpOsc = audioCtx.createOscillator();
          const chirpGain = audioCtx.createGain();
          chirpOsc.type = "sine";
          chirpOsc.frequency.setValueAtTime(1300 + Math.random() * 250, time);
          chirpOsc.frequency.exponentialRampToValueAtTime(3200 + Math.random() * 400, time + 0.12);

          chirpGain.gain.setValueAtTime(0.015, time);
          chirpGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.12);

          chirpOsc.connect(chirpGain);
          chirpGain.connect(mainGain);
          chirpOsc.start();
          chirpOsc.stop(time + 0.13);
        }
      }, 2500);

      activeSynthNodes.push({ stop: () => clearInterval(birdTimer) });
    } else if (type === "instrumental") {
      const notes = [174.61, 196.00, 220.00, 261.63, 293.66, 349.23, 392.00, 440.00];

      const triggerVoice = (freq) => {
        if (!audioCtx || audioCtx.state === "suspended") return;
        const osc = audioCtx.createOscillator();
        const voiceGain = audioCtx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

        voiceGain.gain.setValueAtTime(0, audioCtx.currentTime);
        voiceGain.gain.linearRampToValueAtTime(0.03, audioCtx.currentTime + 3);
        voiceGain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 8);

        osc.connect(voiceGain);
        voiceGain.connect(mainGain);
        osc.start();
        osc.stop(audioCtx.currentTime + 8.1);
      };

      notes.slice(0, 3).forEach((n) => triggerVoice(n));

      const droneTimer = setInterval(() => {
        if (!audioCtx || audioCtx.state === "suspended") return;
        const n = notes[Math.floor(Math.random() * notes.length)];
        triggerVoice(n);
      }, 5000);

      activeSynthNodes.push({ stop: () => clearInterval(droneTimer) });
    }
  } catch (err) {
    console.error("Web Audio synthesis failed:", err);
  }
}

function updateSynthVolume(volumeValue, isMuted) {
  if (activeSynthNodes.length > 0) {
    const mainGain = activeSynthNodes[0];
    if (mainGain && mainGain.gain && audioCtx) {
      const targetGain = isMuted ? 0 : volumeValue * 0.15;
      mainGain.gain.linearRampToValueAtTime(targetGain, audioCtx.currentTime + 0.15);
    }
  }
}

export function useFlowAmbience({ activeSound, isPlayingSound, volume, isMuted, stopSignal }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const audioRef = useRef(null);
  const fadeIntervalRef = useRef(null);
  const isSynthModeRef = useRef(false);

  function clearFade() {
    if (fadeIntervalRef.current) {
      clearInterval(fadeIntervalRef.current);
      fadeIntervalRef.current = null;
    }
  }

  function fadeTo(audio, target, onDone) {
    clearFade();
    if (!audio) {
      onDone?.();
      return;
    }
    const start = audio.volume;
    const diff = target - start;
    if (Math.abs(diff) < 0.001) {
      onDone?.();
      return;
    }
    let step = 0;
    fadeIntervalRef.current = setInterval(() => {
      step += 1;
      const pct = step / FADE_STEPS;
      audio.volume = Math.min(1, Math.max(0, start + diff * pct));
      if (step >= FADE_STEPS) {
        clearFade();
        audio.volume = Math.max(0, Math.min(1, target));
        onDone?.();
      }
    }, FADE_MS / FADE_STEPS);
  }

  function teardown() {
    clearFade();
    stopSynth();
    isSynthModeRef.current = false;
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
    audioRef.current = null;
  }

  // Persist choices as they change
  useEffect(() => {
    savePrefs({ activeSound, volume, isMuted });
  }, [activeSound, volume, isMuted]);

  // Load / switch track
  useEffect(() => {
    setError("");

    if (!activeSound) {
      teardown();
      return;
    }

    const src = SOUND_ASSETS[activeSound];
    if (!src) {
      setError(`Unknown ambience track: ${activeSound}`);
      return;
    }

    teardown();
    setIsLoading(true);

    const audio = new Audio();
    audio.loop = true;
    audio.preload = "auto";
    audio.volume = 0;
    audioRef.current = audio;

    function handleCanPlay() {
      setIsLoading(false);
    }

    function handleError() {
      setIsLoading(false);
      console.warn(`File loading failed for: ${src}. Falling back to synthesized ambience.`);
      setError("Unable to load sound.");
      
      // Mark as synth mode and spin up synthesizer fallback
      isSynthModeRef.current = true;
      if (isPlayingSound) {
        startSynth(activeSound, volume, isMuted);
      }
    }

    audio.addEventListener("canplaythrough", handleCanPlay);
    audio.addEventListener("error", handleError);
    audio.src = src;
    audio.load();

    return () => {
      audio.removeEventListener("canplaythrough", handleCanPlay);
      audio.removeEventListener("error", handleError);
    };
  }, [activeSound]);

  // Play / pause logic
  useEffect(() => {
    if (isSynthModeRef.current) {
      if (isPlayingSound) {
        startSynth(activeSound, volume, isMuted);
      } else {
        stopSynth();
      }
      return;
    }

    const audio = audioRef.current;
    if (!audio || !activeSound) return;

    const targetVolume = isMuted ? 0 : volume;

    if (isPlayingSound) {
      const playPromise = audio.play();
      if (playPromise?.catch) {
        playPromise
          .then(() => fadeTo(audio, targetVolume))
          .catch((err) => {
            console.error("Flow State ambience play() blocked:", err);
            // Fallback to synth context activation on user gesture click
            isSynthModeRef.current = true;
            startSynth(activeSound, volume, isMuted);
          });
      } else {
        fadeTo(audio, targetVolume);
      }
    } else {
      fadeTo(audio, 0, () => audio.pause());
    }
  }, [isPlayingSound, activeSound]);

  // Live volume updates
  useEffect(() => {
    if (isSynthModeRef.current) {
      updateSynthVolume(volume, isMuted);
      return;
    }
    const audio = audioRef.current;
    if (!audio || !isPlayingSound) return;
    fadeTo(audio, isMuted ? 0 : volume);
  }, [volume, isMuted]);

  // External stop trigger
  useEffect(() => {
    if (isSynthModeRef.current) {
      stopSynth();
      return;
    }
    const audio = audioRef.current;
    if (!audio || stopSignal === undefined) return;
    fadeTo(audio, 0, () => audio.pause());
  }, [stopSignal]);

  useEffect(() => {
    return () => teardown();
  }, []);

  return { isLoading, error };
}