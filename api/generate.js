export const config = {
  maxDuration: 60,
};

const MAX_GENERATE_TEXT_CHARS = 14000;

function detectQuestionBank(text) {
  const signals = [
    /\bCO\d\b/i,
    /\bRBT\b/i,
    /Marks\s*:/i,
    /Q\.?\s?No\.?/i,
  ];
  const hits = signals.reduce((count, re) => count + (re.test(text) ? 1 : 0), 0);
  return hits >= 2;
}

function validatePayload(mode, payload) {
  if (mode === "flashcards" && (!Array.isArray(payload?.flashcards) || payload.flashcards.length === 0)) {
    return "The AI did not return any usable flashcards.";
  }
  if (mode === "quiz" && (!Array.isArray(payload?.quiz) || payload.quiz.length === 0)) {
    return "The AI did not return any usable quiz questions.";
  }
  if (mode === "revision" && (!Array.isArray(payload?.revision) || payload.revision.length === 0)) {
    return "The AI did not return any usable revision notes.";
  }
  return null;
}

function retryAfterHeaderToSeconds(value) {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, Math.ceil(seconds));
  const timestamp = Date.parse(value);
  if (Number.isFinite(timestamp)) return Math.max(0, Math.ceil((timestamp - Date.now()) / 1000));
  return null;
}

function sendStructuredError(res, httpStatus, { code, message, retryAfter = null, retryable = false, details = undefined }) {
  if (retryAfter !== null && retryAfter !== undefined) {
    res.setHeader("Retry-After", String(retryAfter));
  }
  return res.status(httpStatus).json({
    error: message,
    status: httpStatus,
    code,
    message,
    retryAfter,
    retryable,
    ...(details ? { details } : {}),
  });
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { text, mode, options, documentContext } = req.body || {};
    const requestCharCount = JSON.stringify(req.body || {}).length;
    const textCharCount = typeof text === "string" ? text.length : 0;
    const chunkCount = options?.batchMeta?.chunkCount || 0;
    const batchIndex = options?.batchMeta?.index || 1;
    const batchCount = options?.batchMeta?.count || 1;

    console.info("Generate request received:", {
      mode,
      requestCharCount,
      textCharCount,
      chunkCount,
      batchIndex,
      batchCount,
    });

    if (!text || !text.trim()) {
      return sendStructuredError(res, 400, {
        code: "EMPTY_NOTES",
        message: "No notes were sent.",
      });
    }

    if (documentContext) {
      console.warn("Rejected generate request with documentContext. Send one bounded text batch instead.", {
        mode,
        requestCharCount,
      });
      return sendStructuredError(res, 400, {
        code: "DOCUMENT_CONTEXT_REJECTED",
        message: "Generation accepts only one bounded text batch at a time.",
      });
    }

    if (text.length > MAX_GENERATE_TEXT_CHARS) {
      console.warn("Rejected oversized generate batch:", {
        mode,
        textCharCount: text.length,
        maxTextChars: MAX_GENERATE_TEXT_CHARS,
      });
      return sendStructuredError(res, 413, {
        code: "BATCH_TOO_LARGE",
        message: "This section is too large to generate safely. Split it into smaller batches and try again.",
      });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return sendStructuredError(res, 500, {
        code: "MISSING_API_KEY",
        message: "Server is missing GROQ_API_KEY.",
      });
    }

  const isQuestionBank = detectQuestionBank(text);

  const commonRules = `The notes contain source markers like [PAGE 3], [SLIDE 3], or [filename PAGE 3]. For each item, find the nearest preceding marker and report it in the "page" field. For page markers, use only the number. For slide markers, use "Slide N". Never include the marker text itself in your output.

Only use content relevant to studying: definitions, derivations, formulae, numericals, key concepts, and likely exam questions.

Create study material from concepts, definitions, relationships, worked examples, important topics, and recurring academic ideas. Do not create questions from page numbers, file names, isolated fragments, repeated headers, or one-off sentences without educational value.

Completely ignore and never create content about:
- Cover pages or college/university information
- Scheme of examination or administrative rules
- Names of exam controllers, deans, or any administrative roles
- Repeated headers or footers
${isQuestionBank ? "\nThis document appears to be a question bank. Prioritize generating content directly from the actual listed exam questions rather than inventing new ones." : ""}`;

  const focusLine = options?.focusTopic
    ? `\nFocus specifically on the topic: "${options.focusTopic}". Ignore unrelated content.`
    : "";

  const avoidFlashcardsLine = options?.avoidQuestions?.length
    ? `\nDo not repeat any of these existing flashcard questions:\n${options.avoidQuestions
        .slice(0, 40)
        .map((question) => `- ${question}`)
        .join("\n")}\nIf the notes do not contain enough new meaningful material, return an empty "flashcards" array.`
    : "";

  const extraBatchLine = options?.extraBatch
    ? "\nGenerate a fresh follow-up batch of new flashcards from uncovered details, not a restatement of the first obvious points."
    : "";

  const instructions = {
    flashcards: `Read the study notes below and create ${options?.cardsPerBatch || 10} flashcards for exam preparation.

${commonRules}${focusLine}${avoidFlashcardsLine}${extraBatchLine}

Cover concepts from this batch only. Prefer definitions, comparisons, formulas, working principles, applications, and worked examples over isolated facts.

Respond ONLY with valid JSON in exactly this format:

{
  "flashcards": [
    { "question": "...", "answer": "...", "page": 3 }
  ]
}`,

    revision: `Read the study notes below and create a concise revision summary for last-minute exam prep.

${commonRules}

Structure the output using these types: "Definition", "Formula", "Derivation", "FAQ", "OneLiner", "CommonMistake". Skip a type if nothing relevant exists.

- Definition: key term + short definition
- Formula: formula, variables, units - all in "content"
- Derivation: name only (e.g. "EMF equation"), short summary in "content"
- FAQ: a commonly-asked exam question, short answer in "content"
- OneLiner: a single punchy revision sentence
- CommonMistake: something students often confuse, phrased as "X != Y"

Respond ONLY with valid JSON in exactly this format:

{
  "revision": [
    { "type": "Definition", "title": "...", "content": "...", "page": 3 }
  ]
}`,

    quiz: `Read the study notes below and create ${options?.questionsPerBatch || 8} exam-style quiz questions from this batch.

${commonRules}${focusLine}

Difficulty requested: ${options?.difficulty || "medium"}.
- easy = definitions and basic recall
- medium = concepts, comparisons, explanations
- hard = derivations, numericals, applied problems

Question types to include: ${(options?.types || ["mcq"]).join(", ")}. Only generate these types, distributed roughly evenly.

Give each question a short "topic" field (2-4 words, e.g. "Transformer Losses") so similar questions can be grouped later.

Use exactly these fields per type:

- mcq: { "type": "mcq", "topic": "...", "difficulty": "...", "question": "...", "options": ["...","...","...","..."], "correctIndex": 0, "optionNotes": ["why option 0 is right/wrong", "...", "...", "..."], "explanation": "...", "relatedConcept": "... or omit", "page": 3 }
- true_false: { "type": "true_false", "topic": "...", "difficulty": "...", "question": "...", "options": ["True","False"], "correctIndex": 0, "explanation": "...", "page": 3 }
- fill_blank: { "type": "fill_blank", "topic": "...", "difficulty": "...", "question": "... use ____ for the blank ...", "correctAnswer": "...", "acceptableAnswers": ["...alt wordings..."], "explanation": "...", "page": 3 }
- short_answer: { "type": "short_answer", "topic": "...", "difficulty": "...", "question": "...", "modelAnswer": "...", "explanation": "...", "page": 3 }
- numerical: { "type": "numerical", "topic": "...", "difficulty": "...", "question": "...", "modelAnswer": "... include worked steps and final value ...", "explanation": "...", "page": 3 }
- select_all: { "type": "select_all", "topic": "...", "difficulty": "...", "question": "select all that apply...", "options": ["...","...","...","..."], "correctIndices": [0,2], "optionNotes": ["...","...","...","..."], "explanation": "...", "page": 3 }

Respond ONLY with valid JSON in exactly this format:

{
  "quiz": [ ...array of question objects using the fields above... ]
}`,
  };

  const prompt = `${instructions[mode] || instructions.flashcards}

NOTES:

${text}`;

  try {
    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.3,
          response_format: { type: "json_object" }
        }),
      }
    );

    console.info("Groq provider response:", {
      status: response.status,
      ok: response.ok,
      mode,
      textCharCount,
      requestCharCount,
      batchIndex,
      batchCount,
    });

    if (!response.ok) {
      const errorText = await response.text();
      const retryAfter = retryAfterHeaderToSeconds(response.headers.get("Retry-After"));
      const retryable = response.status === 429 || response.status >= 500 || response.status === 408;
      const code = response.status === 429
        ? "AI_RATE_LIMIT"
        : retryable
          ? "AI_PROVIDER_TEMPORARY_ERROR"
          : "AI_PROVIDER_ERROR";
      const message = response.status === 429
        ? "The AI service is rate limited. Retrying shortly."
        : `The AI service returned an error (${response.status}).`;
      console.error("Groq API Error:", {
        status: response.status,
        statusText: response.statusText,
        mode,
        textCharCount,
        requestCharCount,
        batchIndex,
        batchCount,
        code,
        retryAfter,
        retryable,
        body: errorText,
      });
      return sendStructuredError(res, response.status, {
        code,
        message,
        retryAfter,
        retryable,
      });
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content;

    if (!raw) {
      return sendStructuredError(res, 502, {
        code: "AI_EMPTY_RESPONSE",
        message: "No response received from the AI.",
        retryable: true,
      });
    }

    let parsed = null;
    try {
      const firstBrace = raw.indexOf("{");
      const lastBrace = raw.lastIndexOf("}");
      if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
        throw new Error("No JSON object structure found in the AI response.");
      }
      let cleaned = raw.substring(firstBrace, lastBrace + 1).trim();

      // Clean trailing commas in objects/arrays (e.g. {"a": 1,} -> {"a": 1} or [1,2,3,] -> [1,2,3])
      cleaned = cleaned.replace(/,(\s*[\]}])/g, "$1");

      try {
        parsed = JSON.parse(cleaned);
      } catch (initialErr) {
        console.warn("Initial JSON parse failed. Attempting control character cleanup...", initialErr.message);
        // Replace unescaped control chars (like real newlines inside JSON string values)
        let repaired = cleaned.replace(/[\u0000-\u001f]/g, (ch) => {
          if (ch === "\n") return "\\n";
          if (ch === "\r") return "\\r";
          if (ch === "\t") return "\\t";
          return "";
        });
        parsed = JSON.parse(repaired);
      }
    } catch (parseErr) {
      console.error("JSON Parsing/Repair failed for Groq response.");
      console.error("Raw response content was:", raw);
      return sendStructuredError(res, 502, {
        code: "AI_PARSE_ERROR",
        message: "Failed to parse the generated study material. Please try again.",
        retryable: true,
        details: parseErr.message
      });
    }

    const validationError = validatePayload(mode, parsed);
    if (validationError) {
      console.error("Generated payload validation failed:", {
        mode,
        keys: parsed && typeof parsed === "object" ? Object.keys(parsed) : [],
      });
      return sendStructuredError(res, 422, {
        code: "AI_VALIDATION_ERROR",
        message: validationError,
      });
    }

    return res.status(200).json(parsed);
  } catch (err) {
    console.error("Fetch/API invocation error:", err);
    return sendStructuredError(res, 502, {
      code: "AI_FETCH_ERROR",
      message: err.message || "Could not generate study material.",
      retryable: true,
    });
  }
  } catch (globalErr) {
    console.error("Global API Error:", globalErr);
    return sendStructuredError(res, 500, {
      code: "GENERATE_ROUTE_ERROR",
      message: globalErr.message || "Unexpected server error.",
    });
  }
}
