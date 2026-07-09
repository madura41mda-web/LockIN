// This file lives in /api and runs securely on the server.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { text, mode } = req.body;

  if (!text || !text.trim()) {
    return res.status(400).json({ error: "No notes were sent." });
  }

  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return res
      .status(500)
      .json({ error: "Server is missing GROQ_API_KEY." });
  }

  const instructions = {
    flashcards: `Read the study notes below and create 8-12 flashcards.

Each flashcard must contain:
- question
- answer
- source (quote or mention where it came from)

Respond ONLY with valid JSON in exactly this format:

{
  "flashcards": [
    {
      "question": "...",
      "answer": "...",
      "source": "..."
    }
  ]
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
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.3,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Groq API Error:", errorText);

      return res
        .status(500)
        .json({ error: "The AI service returned an error." });
    }

    const data = await response.json();

    const raw = data.choices?.[0]?.message?.content;

    if (!raw) {
      return res
        .status(500)
        .json({ error: "No response received from the AI." });
    }

    const cleaned = raw.replace(/```json|```/g, "").trim();

    const parsed = JSON.parse(cleaned);

    return res.status(200).json(parsed);
  } catch (err) {
    console.error(err);

    return res
      .status(500)
      .json({ error: "Could not generate flashcards." });
  }
}