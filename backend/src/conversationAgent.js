import { chatCompletion } from "./groqClient.js";

// The agent is instructed to always answer in strict JSON so we get both
// a spoken reply AND an updated structured snapshot of what's been
// collected, in a single round-trip. This is what lets the call "track
// what's already been asked/answered" instead of re-deriving it from a
// raw transcript every turn — the fields object IS the memory.

const SYSTEM_PROMPT = `You are Aria, a calm and professional AI voice assistant conducting a brief pre-visit health screening call, similar to what a clinic intake nurse does before a doctor sees a patient.

Rules:
- Ask ONE question at a time. Never ask two things in one turn.
- Keep every reply short and spoken (1-2 sentences, no lists, no markdown, no headers) — this will be read aloud by text-to-speech.
- Be adaptive, not scripted. If an answer is vague or incomplete, ask one natural follow-up before moving to the next topic. If the user already answered something (even ahead of when you'd normally ask), don't ask it again.
- Collect, in a natural order: the person's name, their main concern/symptom, how long it's been going on, how severe it is (mild/moderate/severe, or 1-10), and any related/associated symptoms.
- You are NOT a doctor. Never diagnose, never prescribe, never give medical advice. You only gather information for a human clinician to review.
- If the user describes something urgent (e.g. chest pain, severe difficulty breathing, stroke symptoms, active suicidal intent, heavy bleeding), calmly note it as a red flag, gently tell them to seek immediate/emergency care, and still keep the call going if they want to continue.
- If the transcript for this turn is marked "[unclear or silent audio]", do not treat it as an answer — politely ask the user to repeat themselves, in a slightly different phrasing than last time. Do not advance to a new topic.
- Once you have name, chief complaint, duration, severity, and have at least asked about associated symptoms, wrap up: thank them, say a report is being prepared, and set "done": true.
- Never invent information the user did not say. Leave a field null / empty array if it wasn't mentioned.

You must respond with STRICT JSON ONLY (no markdown fences, no commentary outside the JSON), matching exactly this shape:
{
  "reply": "<what you say out loud next>",
  "fields": {
    "name": "<string or null>",
    "chiefComplaint": "<string or null>",
    "duration": "<string or null>",
    "severity": "<string or null>",
    "associatedSymptoms": ["<string>", ...],
    "redFlags": ["<string>", ...],
    "notes": "<any other clinically relevant detail volunteered, or null>"
  },
  "done": <true or false>
}

The "fields" object must always be the FULL cumulative picture (carry forward everything collected in earlier turns, merge in anything new this turn) — not just what changed this turn.`;

function fallbackTurn(session, reason) {
  return {
    reply:
      reason === "unclear"
        ? "Sorry, I didn't catch that — could you say that again?"
        : "Sorry, I had a little trouble processing that. Could you repeat what you just said?",
    fields: session.fields,
    done: false,
  };
}

function safeParseTurn(raw, session) {
  try {
    // Strip accidental markdown fences just in case.
    const cleaned = raw.trim().replace(/^```json\s*|^```\s*|```$/g, "");
    const parsed = JSON.parse(cleaned);
    if (!parsed || typeof parsed.reply !== "string") {
      throw new Error("missing reply");
    }
    const fields = {
      ...session.fields,
      ...(parsed.fields && typeof parsed.fields === "object" ? parsed.fields : {}),
    };
    fields.associatedSymptoms = Array.isArray(fields.associatedSymptoms)
      ? fields.associatedSymptoms
      : session.fields.associatedSymptoms;
    fields.redFlags = Array.isArray(fields.redFlags) ? fields.redFlags : session.fields.redFlags;

    return { reply: parsed.reply.trim(), fields, done: Boolean(parsed.done) };
  } catch (err) {
    console.error("Failed to parse LLM turn JSON:", err.message, "raw:", raw?.slice(0, 300));
    return null;
  }
}

function buildContextMessages(session, latestUserText) {
  const stateNote = {
    role: "system",
    content: `Current structured data collected so far (JSON): ${JSON.stringify(
      session.fields
    )}`,
  };

  const history = session.messages.map((m) => ({
    role: m.role,
    content: m.text,
  }));

  const messages = [{ role: "system", content: SYSTEM_PROMPT }, stateNote, ...history];

  if (latestUserText !== undefined) {
    messages.push({ role: "user", content: latestUserText });
  }

  return messages;
}

/** Produce the opening greeting + first question. */
export async function kickoff(session) {
  const messages = buildContextMessages(session, undefined);
  messages.push({
    role: "user",
    content:
      "[The call just started. Greet the patient warmly and briefly, explain in one sentence that you'll ask a few quick questions before the doctor sees them, then ask your first question — their name.]",
  });

  let turn;
  try {
    const raw = await chatCompletion(messages, { jsonMode: true });
    turn = safeParseTurn(raw, session);
  } catch (err) {
    console.error("kickoff LLM call failed:", err.message);
  }

  if (!turn) {
    turn = {
      reply:
        "Hi, I'm Aria, and I'll be asking a few quick questions before the doctor sees you today. To start — what's your name?",
      fields: session.fields,
      done: false,
    };
  }

  session.messages.push({ role: "assistant", text: turn.reply });
  session.fields = turn.fields;
  session.done = turn.done;
  return turn;
}

/**
 * Run one conversational turn given the user's transcribed speech.
 * `sttEmpty` marks silence/unclear audio so the agent asks the user to
 * repeat instead of treating garbage as an answer.
 */
export async function runTurn(session, userText, { sttEmpty = false } = {}) {
  const effectiveText = sttEmpty ? "[unclear or silent audio]" : userText;

  // Only pollute history with real user speech, not the placeholder —
  // keeps the transcript clean for the report later.
  if (!sttEmpty) {
    session.messages.push({ role: "user", text: userText });
  }

  const messages = buildContextMessages(
    session,
    sttEmpty ? "[unclear or silent audio]" : undefined
  );

  let turn;
  try {
    const raw = await chatCompletion(messages, { jsonMode: true });
    turn = safeParseTurn(raw, session);
  } catch (err) {
    console.error("runTurn LLM call failed:", err.message);
  }

  if (!turn) {
    turn = fallbackTurn(session, sttEmpty ? "unclear" : "error");
  }

  session.messages.push({ role: "assistant", text: turn.reply });
  session.fields = turn.fields;
  session.done = turn.done;
  session.unclearStreak = sttEmpty ? session.unclearStreak + 1 : 0;

  return turn;
}
