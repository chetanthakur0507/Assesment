// Thin wrapper around Groq's OpenAI-compatible REST API.
// Using raw fetch (not the SDK) keeps this in full control of multipart
// uploads for STT and raw binary responses for TTS, and means one fewer
// dependency to version-match.

const GROQ_BASE = "https://api.groq.com/openai/v1";
const API_KEY = process.env.GROQ_API_KEY;

const STT_MODEL = process.env.GROQ_STT_MODEL || "whisper-large-v3-turbo";
const LLM_MODEL = process.env.GROQ_LLM_MODEL || "openai/gpt-oss-120b";
const TTS_MODEL = process.env.GROQ_TTS_MODEL || "canopylabs/orpheus-v1-english";
const TTS_VOICE = process.env.GROQ_TTS_VOICE || "autumn";

function assertKey() {
  if (!API_KEY) {
    throw new Error(
      "GROQ_API_KEY is not set. Add it to backend/.env (see .env.example)."
    );
  }
}

/**
 * Transcribe an audio buffer with Groq Whisper.
 * Returns { text, language, empty } — empty=true means silence / no
 * usable speech was detected, which callers should handle gracefully.
 */
export async function transcribeAudio(buffer, mimeType = "audio/webm") {
  assertKey();

  const ext = mimeType.includes("wav")
    ? "wav"
    : mimeType.includes("mp4") || mimeType.includes("m4a")
    ? "m4a"
    : mimeType.includes("ogg")
    ? "ogg"
    : "webm";

  const form = new FormData();
  form.append("file", new Blob([buffer], { type: mimeType }), `turn.${ext}`);
  form.append("model", STT_MODEL);
  form.append("response_format", "verbose_json");
  form.append("temperature", "0");

  const res = await fetch(`${GROQ_BASE}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${API_KEY}` },
    body: form,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Groq STT failed (${res.status}): ${errText.slice(0, 300)}`);
  }

  const data = await res.json();
  const text = (data.text || "").trim();

  // Whisper hallucinates short filler on near-silent clips. Treat very
  // short / low-signal transcripts as "nothing usable" so the agent can
  // ask the user to repeat instead of acting on garbage.
  const empty = text.length === 0 || /^[\s.,!?…-]*$/.test(text);

  return { text, language: data.language || null, empty };
}

/**
 * Ask the LLM for the next turn. `messages` is a standard chat array.
 * Returns the raw assistant text content.
 */
export async function chatCompletion(messages, { jsonMode = false, temperature = 0.4 } = {}) {
  assertKey();

  const body = {
    model: LLM_MODEL,
    messages,
    temperature,
    max_tokens: 600,
  };
  if (jsonMode) body.response_format = { type: "json_object" };

  const res = await fetch(`${GROQ_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Groq LLM failed (${res.status}): ${errText.slice(0, 300)}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

/**
 * Synthesize speech for `text`. Returns a Buffer of audio (mp3), or null
 * if TTS fails — callers should degrade to text-only rather than crash
 * the call.
 */
export async function synthesizeSpeech(text) {
  assertKey();
  if (!text || !text.trim()) return null;

  try {
    const res = await fetch(`${GROQ_BASE}/audio/speech`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: TTS_MODEL,
        voice: TTS_VOICE,
        input: text,
        response_format: "wav",
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error(`Groq TTS failed (${res.status}): ${errText.slice(0, 300)}`);
      return null;
    }

    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (err) {
    console.error("Groq TTS error:", err.message);
    return null;
  }
}

export const config = { STT_MODEL, LLM_MODEL, TTS_MODEL, TTS_VOICE };
