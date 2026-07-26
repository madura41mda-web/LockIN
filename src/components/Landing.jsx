import { BookOpen, Brain, Clock, Swords, Timer, ArrowRight, Sparkles } from "lucide-react";
import BrandLock from "./BrandLock";
import FocusVisual from "./FocusVisual";

const LANDING_FEATURES = [
  {
    icon: BookOpen,
    title: "Flashcard Studio",
    description: "Turn any notes or PDF into focused question-and-answer cards in seconds.",
  },
  {
    icon: Brain,
    title: "Quiz Practice",
    description: "Generate exam-style questions with answers and clear explanations.",
  },
  {
    icon: Clock,
    title: "Quick Revision",
    description: "Build last-minute revision notes grouped neatly by topic and source.",
  },
  {
    icon: Swords,
    title: "Battle Mode",
    description: "Challenge a friend to a live 1v1 quiz and see who really locked in.",
  },
  {
    icon: Timer,
    title: "Flow State",
    description: "A deep-focus timer with ambient sound and smart study intervals.",
  },
];

const STEPS = [
  { step: "01", title: "Upload your material", copy: "Drop in a PDF or paste your notes. We read it for you." },
  { step: "02", title: "Generate your set", copy: "Pick flashcards, a quiz, or revision notes — built instantly." },
  { step: "03", title: "Lock in and learn", copy: "Study, compete, and track your progress over time." },
];

export default function Landing({ onLogin, onExplore }) {
  return (
    <div className="landing">
      <header className="landing-nav">
        <div className="landing-brand">
          <BrandLock size={38} />
          <span className="landing-brand-name">LockIN</span>
        </div>
        <div className="landing-nav-actions">
          <button type="button" className="landing-link-btn" onClick={onLogin}>
            Log in
          </button>
          <button type="button" className="landing-btn landing-btn-primary" onClick={onLogin}>
            Sign up
          </button>
        </div>
      </header>

      <main className="landing-main">
        <section className="landing-hero">
          <div className="landing-hero-copy">
            <span className="landing-eyebrow">
              <Sparkles size={14} aria-hidden="true" />
              AI study tools that keep you focused
            </span>
            <h1 className="landing-title text-balance">
              Lock in. Learn faster. Remember more.
            </h1>
            <p className="landing-subtitle text-pretty">
              LockIN turns your notes and PDFs into flashcards, quizzes, and revision sets —
              then keeps you in the zone with focus timers and live study battles.
            </p>
            <div className="landing-cta-row">
              <button type="button" className="landing-btn landing-btn-primary landing-btn-lg" onClick={onLogin}>
                Get started — it&apos;s free
                <ArrowRight size={18} aria-hidden="true" />
              </button>
              <button type="button" className="landing-btn landing-btn-ghost landing-btn-lg" onClick={onExplore}>
                Explore without an account
              </button>
            </div>
            <dl className="landing-stats">
              <div className="landing-stat">
                <dt className="landing-stat-value">5</dt>
                <dd className="landing-stat-label">study modes</dd>
              </div>
              <div className="landing-stat">
                <dt className="landing-stat-value">PDF</dt>
                <dd className="landing-stat-label">&amp; notes ready</dd>
              </div>
              <div className="landing-stat">
                <dt className="landing-stat-value">1v1</dt>
                <dd className="landing-stat-label">live battles</dd>
              </div>
            </dl>
          </div>
          <div className="landing-hero-visual">
            <FocusVisual />
          </div>
        </section>

        <section className="landing-section" aria-labelledby="features-heading">
          <div className="landing-section-head">
            <span className="landing-section-label">Everything in one place</span>
            <h2 id="features-heading" className="landing-section-title text-balance">
              Five ways to study smarter
            </h2>
          </div>
          <div className="landing-feature-grid">
            {LANDING_FEATURES.map(({ icon: Icon, title, description }) => (
              <article key={title} className="landing-feature-card">
                <span className="landing-feature-icon" aria-hidden="true">
                  <Icon size={22} />
                </span>
                <h3 className="landing-feature-title">{title}</h3>
                <p className="landing-feature-copy text-pretty">{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-section" aria-labelledby="steps-heading">
          <div className="landing-section-head">
            <span className="landing-section-label">How it works</span>
            <h2 id="steps-heading" className="landing-section-title text-balance">
              From notes to knowledge in three steps
            </h2>
          </div>
          <ol className="landing-steps">
            {STEPS.map(({ step, title, copy }) => (
              <li key={step} className="landing-step">
                <span className="landing-step-num">{step}</span>
                <h3 className="landing-step-title">{title}</h3>
                <p className="landing-step-copy text-pretty">{copy}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="landing-final">
          <h2 className="landing-final-title text-balance">Ready to lock in?</h2>
          <p className="landing-final-copy text-pretty">
            Create a free account to save your decks and track your progress — or jump straight in and explore.
          </p>
          <div className="landing-cta-row landing-cta-center">
            <button type="button" className="landing-btn landing-btn-primary landing-btn-lg" onClick={onLogin}>
              Create free account
              <ArrowRight size={18} aria-hidden="true" />
            </button>
            <button type="button" className="landing-btn landing-btn-ghost landing-btn-lg" onClick={onExplore}>
              Explore without an account
            </button>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <span className="landing-brand-name">LockIN</span>
        <span className="landing-footer-copy">Study tools that keep you focused.</span>
      </footer>
    </div>
  );
}
