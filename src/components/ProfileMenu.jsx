import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut, Pencil, Check, X, User } from "lucide-react";
import { supabase } from "../supabaseClient";
import Avatar from "./Avatar";

export default function ProfileMenu({
  username,
  userEmail,
  onUsernameChange,
  onProfileClick,
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(username || "");
  const [saving, setSaving] = useState(false);
  const [localProfile, setLocalProfile] = useState({});
  const menuRef = useRef(null);

  // Load localStorage profile state whenever menu opens or email changes
  useEffect(() => {
    if (userEmail) {
      const data = localStorage.getItem(`lockin_profile_${userEmail}`);
      if (data) {
        try {
          setLocalProfile(JSON.parse(data));
        } catch (e) {
          console.error("Failed to parse local profile", e);
        }
      } else {
        setLocalProfile({});
      }
    }
  }, [userEmail, open]);

  useEffect(() => {
    setDraftName(username || "");
  }, [username]);

  // Click outside handler
  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
        setEditing(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const profileName = localProfile.displayName || username || userEmail?.split("@")[0] || "Account";
  const avatarChoice = localProfile.avatarChoice || null;
  const avatarCustomUrl = localProfile.avatarCustomUrl || null;

  async function saveUsername() {
    const trimmed = draftName.trim();
    if (!trimmed || trimmed === username) {
      setEditing(false);
      return;
    }
    setSaving(true);
    await onUsernameChange(trimmed);
    setSaving(false);
    setEditing(false);
  }

  async function handleLogout() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Logout failed:", error);
    }
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full pl-1 pr-3 py-1 border border-gray-300 dark:border-white/10 hover:border-orange-400 transition-colors"
        aria-label="Account menu"
      >
        <Avatar
          choice={avatarChoice}
          customUrl={avatarCustomUrl}
          email={userEmail}
          username={username}
          size={32}
        />

        <span className="text-sm font-medium text-slate-800 dark:text-white inline max-w-[120px] truncate">
          {profileName}
        </span>

        <ChevronDown
          size={16}
          className="text-slate-500 dark:text-gray-400"
        />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-neutral-900 shadow-2xl p-4 z-50">
          
          <div className="flex items-center gap-3 mb-3 pb-3 border-b border-gray-200 dark:border-white/10">
            <Avatar
              choice={avatarChoice}
              customUrl={avatarCustomUrl}
              email={userEmail}
              username={username}
              size={48}
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                {profileName}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate break-all">
                {userEmail}
              </p>
            </div>
          </div>

          <div className="mt-2">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onProfileClick();
              }}
              className="flex items-center gap-2 text-sm font-medium w-full text-left py-2 px-3 rounded-lg hover:bg-neutral-100 dark:hover:bg-white/5 text-slate-800 dark:text-white transition-colors"
            >
              <User size={16} className="text-orange-500" />
              <span>View Profile Dashboard</span>
            </button>
          </div>

          <div className="mt-4 pt-2 border-t border-gray-200 dark:border-white/10">
            <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2 px-1">
              Username
            </p>

            {editing ? (
              <div className="flex items-center gap-2 px-1">
                <input
                  type="text"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveUsername()}
                  autoFocus
                  disabled={saving}
                  className="flex-1 rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-neutral-800 text-slate-900 dark:text-white px-2 py-1.5 text-xs outline-none focus:border-orange-500"
                />

                <button
                  type="button"
                  onClick={saveUsername}
                  disabled={saving}
                  className="text-green-500 hover:text-green-600"
                >
                  <Check size={16} />
                </button>

                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="text-gray-500 hover:text-gray-700 dark:hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="flex items-center gap-2 text-slate-900 dark:text-white hover:text-orange-500 transition-colors w-full text-left py-1.5 px-3 rounded-lg hover:bg-neutral-100 dark:hover:bg-white/5 text-xs"
              >
                <span>@{username || "none"}</span>
                <Pencil size={12} />
              </button>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-gray-200 dark:border-white/10">
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-2 text-xs font-semibold text-red-500 hover:text-red-600 w-full transition-colors py-2 px-3 rounded-lg hover:bg-red-500/10"
            >
              <LogOut size={16} strokeWidth={2.5} />
              <span>Log out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}