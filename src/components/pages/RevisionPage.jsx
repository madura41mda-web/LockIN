import { Clock } from "lucide-react";

export default function RevisionPage() {
  return (
    <main className="feature-page">
      <header className="feature-page-header">
        <div>
          <span className="setup-label">REVISION_PAGE</span>
          <h3 className="feature-page-title">Quick Revision</h3>
          <p className="feature-page-copy">Build last-minute revision notes grouped by topic and source.</p>
        </div>
        <div className="feature-page-icon" aria-hidden="true">
          <Clock size={28} />
        </div>
      </header>

      <div className="study-input-panel">
        <div className="upload-box">
          <div className="upload-row">
            <button type="button" className="attach-btn">📎</button>
            <span className="upload-text-input" style={{ display: "block", padding: "0.5rem", color: "var(--text-muted)" }}>
              Upload document for revision notes...
            </span>
          </div>
        </div>

        <button type="button" className="generate-btn">
          Generate Quick Revision
        </button>
      </div>
    </main>
  );
}
