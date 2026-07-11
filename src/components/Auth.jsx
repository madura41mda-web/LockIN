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
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google" });
    if (error) setError(error.message);
  }

  return (
    <div className="auth-shell">
      <h2 className="feature-page-title">{isSignUp ? "Create account" : "Log in"}</h2>

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

        {error && <p className="mt-2 text-red-400 text-sm mono">{error}</p>}
        {message && <p className="mt-2 text-green-400 text-sm mono">{message}</p>}

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