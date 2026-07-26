import { useState } from "react";
import { supabase } from "../supabaseClient";

const EDUCATION_LEVELS = [
  "5th - 7th grade",
  "8th - 10th grade",
  "11th - 12th grade / PU",
  "Undergraduate",
  "Postgraduate",
  "Other",
];

function friendlyAuthError(message) {
  if (message.includes("Invalid login credentials")) {
    return "Incorrect email or password. If you don't have an account yet, sign up below.";
  }
  if (message.includes("Email not confirmed")) {
    return "Please confirm your email before logging in — check your inbox for a confirmation link.";
  }
  if (message.includes("User already registered")) {
    return "An account with this email already exists. Try logging in instead.";
  }
  if (message.includes("Password should be at least")) {
    return "Password must be at least 6 characters.";
  }
  if (message.includes("rate limit")) {
    return "Too many attempts. Please wait a minute and try again.";
  }
  return message;
}

export default function Auth() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [age, setAge] = useState("");
  const [educationLevel, setEducationLevel] = useState(EDUCATION_LEVELS[3]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (isSignUp) {
      if (password !== confirmPassword) {
        setError("Passwords don't match.");
        return;
      }
      if (!fullName.trim()) {
        setError("Please enter your name.");
        return;
      }
      const ageNum = Number(age);
      if (!age || Number.isNaN(ageNum) || ageNum < 5 || ageNum > 100) {
        setError("Please enter a valid age.");
        return;
      }
    }

    setLoading(true);
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              full_name: fullName.trim(),
              age: Number(age),
              education_level: educationLevel,
            },
          },
        });
        if (error) throw error;
        setMessage("Account created! Check your email to confirm your account before logging in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      setError(friendlyAuthError(err.message));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    setError(null);
    try {
      localStorage.setItem("lockin_post_oauth_hash", window.location.hash || "");
    } catch (e) {
      console.warn("Failed to cache pre-OAuth hash:", e);
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) setError(error.message);
  }

  return (
    <div className="auth-shell">
      <div className="auth-header">
        <span className="auth-brand-mark" aria-hidden="true">L</span>
        <h2 className="auth-title">{isSignUp ? "Create your account" : "Welcome back"}</h2>
        <p className="auth-subtitle">
          {isSignUp
            ? "Save your decks and track your progress across every study mode."
            : "Log in to pick up right where you left off."}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="auth-form">
        {isSignUp && (
          <input
            type="text"
            placeholder="Full name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            className="auth-input"
          />
        )}

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="auth-input"
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          className="auth-input"
        />

        {isSignUp && (
          <>
            <input
              type="password"
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              className="auth-input"
            />

            <input
              type="number"
              placeholder="Age"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              required
              min={5}
              max={100}
              className="auth-input"
            />

            <select
              value={educationLevel}
              onChange={(e) => setEducationLevel(e.target.value)}
              className="auth-input"
            >
              {EDUCATION_LEVELS.map((level) => (
                <option key={level} value={level}>{level}</option>
              ))}
            </select>
          </>
        )}

        {error && <p className="auth-message auth-message-error">{error}</p>}
        {message && <p className="auth-message auth-message-success">{message}</p>}

        <button type="submit" disabled={loading} className="generate-btn">
          {loading ? "Please wait..." : isSignUp ? "Sign up" : "Log in"}
        </button>
      </form>

      <div className="auth-divider">or</div>

      <button type="button" onClick={handleGoogleLogin} className="secondary" style={{ width: "100%" }}>
        Continue with Google
      </button>

      <button
        type="button"
        onClick={() => {
          setIsSignUp(!isSignUp);
          setError(null);
          setMessage(null);
        }}
        className="auth-toggle-link"
      >
        {isSignUp ? "Already have an account? Log in" : "Need an account? Sign up"}
      </button>
    </div>
  );
}
