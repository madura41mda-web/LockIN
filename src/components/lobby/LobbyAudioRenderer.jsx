import { useEffect, useRef } from "react";

export default function LobbyAudioRenderer({ tracks, onPlaybackError }) {
  const containerRef = useRef(null);
  const attachedTracksRef = useRef(new Map());

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const nextTrackIds = new Set(tracks.map((entry) => entry.id));
    for (const [trackId, attached] of attachedTracksRef.current) {
      if (nextTrackIds.has(trackId)) continue;
      attached.track.detach(attached.element);
      attached.element.remove();
      attachedTracksRef.current.delete(trackId);
    }

    for (const entry of tracks) {
      const current = attachedTracksRef.current.get(entry.id);
      if (current?.track === entry.track) continue;
      if (current) {
        current.track.detach(current.element);
        current.element.remove();
        attachedTracksRef.current.delete(entry.id);
      }
      const element = document.createElement("audio");
      element.autoplay = true;
      element.setAttribute("data-livekit-audio-track", entry.id);
      entry.track.attach(element);
      container.appendChild(element);
      attachedTracksRef.current.set(entry.id, { track: entry.track, element });
      element.play().catch(() => {
        onPlaybackError?.(
          "Your browser paused room audio. Press the microphone button to resume audio."
        );
      });
    }
  }, [onPlaybackError, tracks]);

  useEffect(
    () => () => {
      for (const attached of attachedTracksRef.current.values()) {
        attached.track.detach(attached.element);
        attached.element.remove();
      }
      attachedTracksRef.current.clear();
    },
    []
  );

  return <div ref={containerRef} hidden aria-hidden="true" />;
}
