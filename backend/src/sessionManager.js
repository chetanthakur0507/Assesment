import { nanoid } from "nanoid";

// Simple in-memory store — fine for a take-home / single-instance deploy.
// Keyed by callId. Each session tracks the spoken conversation (for LLM
// context + transcript display) and the cumulative structured fields the
// agent has extracted so far, which is what makes "don't repeat / don't
// lose the thread" possible across turns.

const sessions = new Map();
const SESSION_TTL_MS = 1000 * 60 * 60; // 1 hour safety cleanup

export function createSession() {
  const callId = nanoid(12);
  const session = {
    callId,
    createdAt: Date.now(),
    messages: [], // [{ role: 'user'|'assistant', text }]
    fields: emptyFields(),
    done: false,
    detectedLanguage: null,
    unclearStreak: 0,
  };
  sessions.set(callId, session);
  scheduleCleanup(callId);
  return session;
}

export function getSession(callId) {
  return sessions.get(callId) || null;
}

export function deleteSession(callId) {
  sessions.delete(callId);
}

export function emptyFields() {
  return {
    name: null,
    chiefComplaint: null,
    duration: null,
    severity: null,
    associatedSymptoms: [],
    redFlags: [],
    notes: null,
  };
}

function scheduleCleanup(callId) {
  setTimeout(() => {
    const s = sessions.get(callId);
    if (s && Date.now() - s.createdAt > SESSION_TTL_MS) {
      sessions.delete(callId);
    }
  }, SESSION_TTL_MS + 1000).unref?.();
}
