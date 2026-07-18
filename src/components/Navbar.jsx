import { Lock, LockOpen, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import ProfileMenu from "./ProfileMenu";

function getInitialTheme() {
  const savedTheme = localStorage.getItem("lockin-theme");
  if (savedTheme === "light" || savedTheme === "dark") return savedTheme;
  return "dark";
}

export default function Navbar({
  userEmail,
  username,
  onUsernameChange,
  onLoginClick,
  onLibraryClick,
  onBattleClick,
  onProfileClick,
}) {
  const [theme, setTheme] = useState(getInitialTheme);
  const isLightMode = theme === "light";

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("lockin-theme", theme);
  }, [theme]);

  function toggleTheme() {
    setTheme((currentTheme) =>
      currentTheme === "dark" ? "light" : "dark"
    );
  }

  return (
    <nav className="navbar-shell">
      <div className="flex items-center gap-3">
        <div className="brand-icon" tabIndex={0} aria-label="Focus lock">
          <Lock className="brand-lock brand-lock-closed w-6 h-6" />
          <LockOpen className="brand-lock brand-lock-open w-6 h-6" />
        </div>

        <div>
          <h1 className="brand-title">LockIN</h1>
          <p className="brand-sub">focus.exe --mode=study</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {userEmail ? (
          <>
            <button type="button" onClick={onLibraryClick} className="secondary">
              My Library
            </button>
            <ProfileMenu
              userEmail={userEmail}
              username={username}
              onUsernameChange={onUsernameChange}
              onProfileClick={onProfileClick}
            />
          </>
        ) : (
          <button
            type="button"
            onClick={onLoginClick}
            className="secondary"
          >
            Log in
          </button>
        )}

        <button
          type="button"
          onClick={toggleTheme}
          className="theme-toggle"
          aria-label={
            isLightMode
              ? "Switch to dark mode"
              : "Switch to light mode"
          }
          title={
            isLightMode
              ? "Switch to dark mode"
              : "Switch to light mode"
          }
        >
          {isLightMode ? <Moon size={20} /> : <Sun size={20} />}
        </button>
      </div>
    </nav>
  );
}