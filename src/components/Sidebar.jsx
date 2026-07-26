import { useEffect, useState } from "react";
import { Lock, LockOpen, Moon, Sun, X } from "lucide-react";
import ProfileMenu from "./ProfileMenu";

function getInitialTheme() {
  const savedTheme = localStorage.getItem("lockin-theme");
  if (savedTheme === "light" || savedTheme === "dark") return savedTheme;
  return "dark";
}

export default function Sidebar({
  navItems,
  activeKey,
  onSelect,
  open,
  onClose,
  userEmail,
  username,
  onUsernameChange,
  onProfileClick,
  onLoginClick,
  profile,
}) {
  const [theme, setTheme] = useState(getInitialTheme);
  const isLightMode = theme === "light";

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("lockin-theme", theme);
  }, [theme]);

  function toggleTheme() {
    setTheme((currentTheme) => (currentTheme === "dark" ? "light" : "dark"));
  }

  return (
    <aside className={`app-sidebar ${open ? "is-open" : ""}`} aria-label="Primary navigation">
      <div className="side-brand">
        <div className="brand-icon" tabIndex={0} aria-label="Focus lock">
          <Lock className="brand-lock brand-lock-closed w-6 h-6" />
          <LockOpen className="brand-lock brand-lock-open w-6 h-6" />
        </div>
        <div className="min-w-0">
          <h1 className="brand-title">LockIN</h1>
          <p className="brand-sub">
            focus.exe --mode=study<span className="term-cursor" aria-hidden="true">▋</span>
          </p>
        </div>
        <button
          type="button"
          className="side-close"
          onClick={onClose}
          aria-label="Close navigation"
        >
          <X size={18} />
        </button>
      </div>

      <p className="side-nav-label">// tools</p>

      <nav className="side-nav" aria-label="Study tools">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeKey === item.key;
          return (
            <button
              key={item.key}
              type="button"
              data-feature={item.key}
              className={`side-nav-item ${isActive ? "side-nav-item-active" : ""}`}
              onClick={() => onSelect(item.key)}
              aria-current={isActive ? "page" : undefined}
            >
              <span className="side-nav-icon">
                <Icon size={18} />
              </span>
              <span className="side-nav-text">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="side-footer">
        <button
          type="button"
          onClick={toggleTheme}
          className="side-theme-toggle"
          aria-label={isLightMode ? "Switch to dark mode" : "Switch to light mode"}
          title={isLightMode ? "Switch to dark mode" : "Switch to light mode"}
        >
          {isLightMode ? <Moon size={18} /> : <Sun size={18} />}
          <span>{isLightMode ? "Dark mode" : "Light mode"}</span>
        </button>

        {userEmail ? (
          <div className="side-profile">
            <ProfileMenu
              userEmail={userEmail}
              username={username}
              onUsernameChange={onUsernameChange}
              onProfileClick={onProfileClick}
              profile={profile}
            />
          </div>
        ) : (
          <button type="button" onClick={onLoginClick} className="side-login">
            <span className="side-login-prompt" aria-hidden="true">&gt;</span>
            <span className="side-login-cmd">authenticate</span>
            <span className="side-login-caret" aria-hidden="true">_</span>
          </button>
        )}
      </div>
    </aside>
  );
}
