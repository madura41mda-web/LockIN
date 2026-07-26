import { useEffect, useRef, useState } from "react";

/**
 * Interactive LockIN brand mark: a padlock inside an amber-outlined rounded
 * badge. As the cursor approaches, the shackle lifts open ("unlocks") and the
 * badge subtly tilts toward the cursor; it re-locks as the cursor moves away.
 */
export default function BrandLock({ size = 40 }) {
  const ref = useRef(null);
  const frame = useRef(0);
  // openness: 0 = locked, 1 = fully unlocked. tiltX/tiltY in degrees.
  const [state, setState] = useState({ openness: 0, tiltX: 0, tiltY: 0 });

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;

    const onMove = (e) => {
      if (frame.current) return;
      frame.current = requestAnimationFrame(() => {
        frame.current = 0;
        const el = ref.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = e.clientX - cx;
        const dy = e.clientY - cy;
        const dist = Math.hypot(dx, dy);

        const radius = 260; // proximity radius in px
        const openness = Math.max(0, Math.min(1, 1 - dist / radius));
        // Tilt strongest when close, capped for subtlety.
        const t = openness;
        const tiltY = Math.max(-10, Math.min(10, (dx / radius) * 18)) * t;
        const tiltX = Math.max(-10, Math.min(10, (-dy / radius) * 18)) * t;

        setState({ openness, tiltX, tiltY });
      });
    };

    const onLeave = () => setState({ openness: 0, tiltX: 0, tiltY: 0 });

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseleave", onLeave);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", onLeave);
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, []);

  const { openness, tiltX, tiltY } = state;
  // Shackle motion: lift up and swing open around its right leg.
  const lift = -3.2 * openness;
  const swing = -22 * openness;

  return (
    <span
      ref={ref}
      className="brand-lock"
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        transform: `perspective(320px) rotateX(${tiltX}deg) rotateY(${tiltY}deg)`,
      }}
    >
      <svg viewBox="0 0 40 40" width={size} height={size} role="presentation">
        {/* Shackle */}
        <g
          style={{
            transform: `translateY(${lift}px) rotate(${swing}deg)`,
            transformOrigin: "26px 18px",
            transition: "transform 0.18s ease-out",
          }}
        >
          <path
            d="M14 20 V16 a6 6 0 0 1 12 0 V20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
        </g>
        {/* Lock body */}
        <rect
          x="11"
          y="19"
          width="18"
          height="14"
          rx="3.4"
          fill="currentColor"
        />
        {/* Keyhole */}
        <circle cx="20" cy="25" r="1.9" fill="var(--surface, #14110c)" />
        <rect x="19.1" y="25.4" width="1.8" height="4.2" rx="0.9" fill="var(--surface, #14110c)" />
      </svg>
    </span>
  );
}
