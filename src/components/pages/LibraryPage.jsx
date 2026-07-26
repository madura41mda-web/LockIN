import { Library } from "lucide-react";

const SAMPLE_DECKS = [
  { id: 1, title: "React Fundamentals", cards: 24 },
  { id: 2, title: "JavaScript ES6+", cards: 18 },
  { id: 3, title: "Database Design", cards: 32 },
];

export default function LibraryPage() {
  return (
    <main className="feature-page">
      <header className="feature-page-header">
        <div>
          <span className="setup-label">LIBRARY_PAGE</span>
          <h3 className="feature-page-title">My Library</h3>
          <p className="feature-page-copy">Your saved decks and study materials.</p>
        </div>
        <div className="feature-page-icon" aria-hidden="true">
          <Library size={28} />
        </div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1rem", marginTop: "1.5rem" }}>
        {SAMPLE_DECKS.map((deck) => (
          <div
            key={deck.id}
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "1rem",
              padding: "1.25rem",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--accent)";
              e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--border)";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            <h4 style={{ margin: "0 0 0.5rem", color: "var(--text)", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700 }}>
              {deck.title}
            </h4>
            <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.9rem" }}>
              {deck.cards} cards
            </p>
          </div>
        ))}
      </div>
    </main>
  );
}
