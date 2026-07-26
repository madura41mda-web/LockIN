import { User } from "lucide-react";

export default function ProfilePage({ session, profile, onProfileUpdate }) {
  return (
    <main className="feature-page">
      <header className="feature-page-header">
        <div>
          <span className="setup-label">PROFILE_PAGE</span>
          <h3 className="feature-page-title">Profile</h3>
          <p className="feature-page-copy">Manage your account and preferences.</p>
        </div>
        <div className="feature-page-icon" aria-hidden="true">
          <User size={28} />
        </div>
      </header>

      <div className="study-input-panel">
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "1rem", padding: "2rem" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "0.5rem", fontWeight: 600 }}>
                Email
              </label>
              <p style={{ margin: 0, color: "var(--text)", fontFamily: "'Inter', sans-serif" }}>
                {session?.user?.email || "No email"}
              </p>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "0.5rem", fontWeight: 600 }}>
                Username
              </label>
              <input
                type="text"
                value={profile?.username || ""}
                onChange={(e) => onProfileUpdate?.({ username: e.target.value })}
                style={{
                  width: "100%",
                  padding: "0.8rem",
                  border: "1px solid var(--border)",
                  borderRadius: "0.6rem",
                  background: "var(--surface-2)",
                  color: "var(--text)",
                  fontFamily: "'Inter', sans-serif",
                  fontSize: "0.95rem",
                }}
              />
            </div>

            <button type="button" className="generate-btn">
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
