import { useEffect, useState } from "react";
import Auth from "./components/Auth";
import Landing from "./components/Landing";
import DashboardShell from "./components/DashboardShell";
import { supabase, isSupabaseConfigured } from "./supabaseClient";

export default function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [exploreAnon, setExploreAnon] = useState(false);
  const [profile, setProfile] = useState(null);

  // Track login state, but never block the app on it
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setAuthLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession) {
        setAuthModalOpen(false);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  // Fetch (or create) the user's profile row once logged in
  useEffect(() => {
    if (!isSupabaseConfigured || !session) {
      setProfile(null);
      return;
    }

    supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .single()
      .then(({ data, error }) => {
        if (error && error.code === "PGRST116") {
          const newProfile = { id: session.user.id, username: null };
          return supabase
            .from("profiles")
            .insert([newProfile])
            .then(() => setProfile(newProfile));
        } else if (error) {
          console.error("[v0] Error loading profile:", error);
        } else {
          setProfile(data);
        }
      });
  }, [session]);

  const handleProfileUpdate = (updates) => {
    if (!session || !isSupabaseConfigured) return;
    const newProfile = { ...profile, ...updates };
    setProfile(newProfile);

    supabase
      .from("profiles")
      .update(updates)
      .eq("id", session.user.id)
      .then(({ error }) => {
        if (error) console.error("[v0] Error updating profile:", error);
      });
  };

  if (authLoading) {
    return <div className="min-h-screen p-6" />;
  }

  // Show landing page until user logs in or explores anonymously
  if (!session && !exploreAnon) {
    return (
      <>
        <Landing
          onLogin={() => setAuthModalOpen(true)}
          onExplore={() => setExploreAnon(true)}
        />
        {authModalOpen && (
          <div className="auth-modal-overlay" onClick={() => setAuthModalOpen(false)}>
            <div className="auth-modal-box" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className="auth-modal-close"
                onClick={() => setAuthModalOpen(false)}
                aria-label="Close"
              >
                ✕
              </button>
              <Auth />
            </div>
          </div>
        )}
      </>
    );
  }

  // Show the premium dashboard
  return (
    <DashboardShell
      session={session}
      profile={profile}
      onProfileUpdate={handleProfileUpdate}
      onLogout={() => {
        setAuthModalOpen(true);
      }}
    />
  );
}
