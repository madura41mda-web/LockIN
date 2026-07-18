import React from "react";

// Predefined premium avatar gradients and shapes
const AVATAR_DESIGNS = [
  // 0: Cyber Orange
  (size) => (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g0" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffb454" />
          <stop offset="100%" stopColor="#ff6b00" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="50" fill="url(#g0)" />
      {/* Coder goggles */}
      <rect x="25" y="40" width="50" height="20" rx="6" fill="#12161d" />
      <circle cx="37" cy="50" r="6" fill="#ffb454" />
      <circle cx="63" cy="50" r="6" fill="#ffb454" />
      <path d="M45 70 Q50 75 55 70" stroke="#12161d" strokeWidth="4" strokeLinecap="round" />
    </svg>
  ),
  // 1: Retro Neon
  (size) => (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00f0ff" />
          <stop offset="100%" stopColor="#ff007f" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="50" fill="url(#g1)" />
      {/* Cool sunglasses */}
      <path d="M20 42 L80 42 L72 58 L28 58 Z" fill="#12161d" />
      <line x1="30" y1="46" x2="45" y2="46" stroke="#00f0ff" strokeWidth="2" />
      <line x1="55" y1="46" x2="70" y2="46" stroke="#ff007f" strokeWidth="2" />
    </svg>
  ),
  // 2: Cosmos/Space
  (size) => (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8a2be2" />
          <stop offset="100%" stopColor="#410099" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="50" fill="url(#g2)" />
      {/* Astronaut visor */}
      <rect x="25" y="32" width="50" height="36" rx="18" fill="#171c25" stroke="#fff" strokeWidth="2" />
      <ellipse cx="50" cy="46" rx="20" ry="10" fill="#8a2be2" opacity="0.7" />
      <circle cx="42" cy="42" r="2" fill="#fff" />
    </svg>
  ),
  // 3: Cyberpunk Cyborg
  (size) => (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g3" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#12161d" />
          <stop offset="100%" stopColor="#262d38" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="50" fill="url(#g3)" stroke="#ffb454" strokeWidth="2" />
      {/* Glowing cyber eye */}
      <circle cx="55" cy="45" r="8" fill="#ff4d4d" />
      <circle cx="55" cy="45" r="3" fill="#fff" />
      {/* Left normal eye */}
      <rect x="30" y="44" width="10" height="3" fill="#ffb454" />
      {/* Circuit lines */}
      <path d="M30 65 L45 65 L50 75" stroke="#ffb454" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  // 4: Golden Sage
  (size) => (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g4" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#78350f" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="50" fill="url(#g4)" />
      {/* Intelligent specs */}
      <circle cx="38" cy="48" r="10" stroke="#fff" strokeWidth="3" />
      <circle cx="62" cy="48" r="10" stroke="#fff" strokeWidth="3" />
      <line x1="48" y1="48" x2="52" y2="48" stroke="#fff" strokeWidth="3" />
      {/* Smile */}
      <path d="M42 66 Q50 72 58 66" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
    </svg>
  ),
  // 5: Emerald Owl
  (size) => (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g5" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#064e3b" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="50" fill="url(#g5)" />
      {/* Owl face key elements */}
      <circle cx="36" cy="45" r="12" fill="#fff" />
      <circle cx="64" cy="45" r="12" fill="#fff" />
      <circle cx="36" cy="45" r="5" fill="#12161d" />
      <circle cx="64" cy="45" r="5" fill="#12161d" />
      <polygon points="50,50 45,60 55,60" fill="#f59e0b" />
    </svg>
  )
];

export default function Avatar({ choice, customUrl, email, username, size = 32 }) {
  // If custom Base64 image is uploaded
  if (choice === "custom" && customUrl) {
    return (
      <img
        src={customUrl}
        alt="User Profile"
        className="object-cover rounded-full select-none"
        style={{ width: size, height: size }}
      />
    );
  }

  // If a predefined index is selected
  const index = parseInt(choice, 10);
  if (!isNaN(index) && index >= 0 && index < AVATAR_DESIGNS.length) {
    return AVATAR_DESIGNS[index](size);
  }

  // Fallback initial
  const displayName = username || email?.split("@")[0] || "Account";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <span
      className="flex items-center justify-center rounded-full text-sm font-semibold select-none bg-gradient-to-br from-orange-400 to-orange-600 text-white"
      style={{ width: size, height: size, fontSize: size * 0.45 }}
    >
      {initial}
    </span>
  );
}
