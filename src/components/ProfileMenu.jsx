import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut, Pencil, Check, X } from "lucide-react";
import { supabase } from "../supabaseClient";

export default function ProfileMenu({
  username,
  userEmail,
  onUsernameChange,
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(username || "");
  const [saving, setSaving] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    setDraftName(username || "");
  }, [username]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
        setEditing(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () =>
      document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const displayName = username || userEmail?.split("@")[0] || "Account";
  const initial = displayName.charAt(0).toUpperCase();

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
        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 text-sm font-semibold">
          {initial}
        </span>

        <span className="text-sm font-medium text-slate-800 dark:text-white inline">
          {displayName}
        </span>

        <ChevronDown
          size={16}
          className="text-slate-500 dark:text-gray-400"
        />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-neutral-900 shadow-2xl p-4 z-50">

          <p className="text-xs text-gray-500 dark:text-gray-400 truncate break-all">
            {userEmail}
          </p>

          <div className="mt-4">
            <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
              Username
            </p>

            {editing ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveUsername()}
                  autoFocus
                  disabled={saving}
                  className="flex-1 rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-neutral-800 text-slate-900 dark:text-white px-3 py-2 text-sm outline-none focus:border-orange-500"
                />

                <button
                  type="button"
                  onClick={saveUsername}
                  disabled={saving}
                  className="text-green-500 hover:text-green-600"
                >
                  <Check size={18} />
                </button>

                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="text-gray-500 hover:text-gray-700 dark:hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="flex items-center gap-2 text-slate-900 dark:text-white hover:text-orange-500 transition-colors"
              >
                <span>{displayName}</span>
                <Pencil size={14} />
              </button>
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-white/10">
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-2 text-red-500 hover:text-red-600 w-full transition-colors"
            >
              <LogOut size={18} />
              <span>Log out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}