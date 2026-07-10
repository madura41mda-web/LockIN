const STORAGE_KEY = "lockin_topic_stats";

function loadStats() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveStats(stats) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  } catch {
    // localStorage unavailable — fail silently
  }
}

export function recordTopicResult(topic, correct) {
  const key = topic || "General";
  const stats = loadStats();
  if (!stats[key]) stats[key] = { correct: 0, wrong: 0 };
  if (correct) stats[key].correct += 1;
  else stats[key].wrong += 1;
  saveStats(stats);
}

export function getWeakTopics({ minAttempts = 3, wrongRateThreshold = 0.5 } = {}) {
  const stats = loadStats();
  return Object.entries(stats)
    .map(([topic, { correct, wrong }]) => {
      const attempts = correct + wrong;
      const wrongRate = attempts > 0 ? wrong / attempts : 0;
      return { topic, correct, wrong, attempts, wrongRate };
    })
    .filter((t) => t.attempts >= minAttempts && t.wrongRate >= wrongRateThreshold)
    .sort((a, b) => b.wrongRate - a.wrongRate);
}