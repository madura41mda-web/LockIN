import { useEffect, useRef, useState } from "react";

// Root-relative so the same path resolves correctly in both `vite dev` and a
// production build — anything in /public is served from "/" in both modes.
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
export function useFlowAmbience({ activeSound, isPlayingSound, volume, isMuted, stopSignal }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const audioRef = useRef(null);
  const fadeIntervalRef = useRef(null);

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
      console.error(`Flow State ambience failed to load: ${src}`);
      setError("Unable to load this ambience track. Please choose another sound.");
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
    const audio = audioRef.current;
    if (!audio || !activeSound) return;

    const targetVolume = isMuted ? 0 : volume;

    if (isPlayingSound) {
      const playPromise = audio.play();
      if (playPromise?.catch) {
        playPromise
          .then(() => {
            setError("");
            fadeTo(audio, targetVolume);
          })
          .catch((err) => {
            console.warn("Flow State ambience play() blocked:", err);
            setError("Your browser blocked audio playback. Press Play Audio to try again.");
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
    const audio = audioRef.current;
    if (!audio || !isPlayingSound) return;
    fadeTo(audio, isMuted ? 0 : volume);
  }, [volume, isMuted]);

  // External stop trigger
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || stopSignal === undefined) return;
    fadeTo(audio, 0, () => audio.pause());
  }, [stopSignal]);

  useEffect(() => {
    return () => teardown();
  }, []);

  return { isLoading, error };
}
