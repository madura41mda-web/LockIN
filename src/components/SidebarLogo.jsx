/**
 * Static sidebar logo: a clean padlock SVG with rounded badge styling.
 * No animation, no shackle motion. Used only in the dashboard sidebar.
 */
export default function SidebarLogo({ size = 32 }) {
  return (
    <span
      className="sidebar-lock-logo"
      aria-hidden="true"
      style={{
        width: size,
        height: size,
      }}
    >
      <svg viewBox="0 0 40 40" width={size} height={size} role="presentation">
        {/* Shackle */}
        <path
          d="M14 20 V16 a6 6 0 0 1 12 0 V20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
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
        <circle cx="20" cy="25" r="1.9" fill="var(--surface, #0e151e)" />
        <rect x="19.1" y="25.4" width="1.8" height="4.2" rx="0.9" fill="var(--surface, #0e151e)" />
      </svg>
    </span>
  );
}
