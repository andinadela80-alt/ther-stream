// Kageon text generation: Gemini first, Groq as fallback. Keys stay server-side.
export class LlmError extends Error {
  constructor(message: string, public statusCode?: number) { super(message); }
}

async function gemini(key: string, system: string, user: string) {
  const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: { maxOutputTokens: 400, temperature: 0.6, thinkingConfig: { thinkingBudget: 0 } },
    }),
  });
  if (!res.ok) throw new LlmError(`Gemini error ${res.status}`, res.status);
  const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  return json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
}

async function groq(key: string, system: string, user: string) {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      max_tokens: 400,
      temperature: 0.6,
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
    }),
  });
  if (!res.ok) throw new LlmError(`Groq error ${res.status}`, res.status);
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return json.choices?.[0]?.message?.content ?? "";
}

export async function generateKageonText(system: string, user: string): Promise<string> {
  const gKey = process.env["GEMINI_API_KEY"];
  const qKey = process.env["GROQ_API_KEY"];
  if (!gKey && !qKey) throw new LlmError("Kageon's AI is not configured.");
  const errors: string[] = [];
  for (const [name, key, fn] of [["gemini", gKey, gemini], ["groq", qKey, groq]] as const) {
    if (!key) continue;
    try {
      const text = (await fn(key, system, user)).trim();
      if (text) return text;
      errors.push(`${name}: empty`);
    } catch (e) {
      console.error(`[kageon] ${name} failed`, (e as Error).message);
      errors.push(name);
    }
  }
  throw new LlmError("Kageon is busy right now. Please try again in a moment.");
}
