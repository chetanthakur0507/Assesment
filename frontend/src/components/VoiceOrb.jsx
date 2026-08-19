import React, { useMemo } from "react";
import "./VoiceOrb.css";

const BAR_COUNT = 36;

// Deterministic per-bar "personality" so the ring looks organic rather
// than uniform, without needing randomness that changes every render.
const BAR_SEEDS = Array.from({ length: BAR_COUNT }, (_, i) => 0.45 + ((i * 37) % 55) / 100);

const STATE_LABEL = {
  idle: "Ready to begin",
  connecting: "Connecting…",
  ai_speaking: "Aria is speaking",
  ready: "Your turn — tap the mic",
  recording: "Listening…",
  processing: "Thinking…",
  ended: "Call ended",
};

export default function VoiceOrb({ state, level = 0 }) {
  const bars = useMemo(() => {
    const isPulsing = state === "ai_speaking" || state === "connecting" || state === "processing";
    const isListening = state === "recording";

    return BAR_SEEDS.map((seed, i) => {
      let h;
      if (isListening) {
        h = 0.12 + Math.min(1, level * 1.6) * seed;
      } else if (isPulsing) {
        h = 0.18 + seed * 0.22;
      } else {
        h = 0.1 + seed * 0.08;
      }
      return h;
    });
  }, [state, level]);

  return (
    <div className={`orb orb--${state}`} role="img" aria-label={STATE_LABEL[state] || "Voice call"}>
      <div className="orb__glow" />
      <svg className="orb__rings" viewBox="0 0 260 260">
        {bars.map((h, i) => {
          const angle = (360 / BAR_COUNT) * i;
          const r1 = 78;
          const len = 26 + h * 46;
          return (
            <line
              key={i}
              x1="130"
              y1={130 - r1}
              x2="130"
              y2={130 - r1 - len}
              className="orb__bar"
              transform={`rotate(${angle} 130 130)`}
            />
          );
        })}
        <circle cx="130" cy="130" r="62" className="orb__core-ring" />
      </svg>
      <div className="orb__core">
        <CoreIcon state={state} />
      </div>
      <div className="orb__label mono">{STATE_LABEL[state] || ""}</div>
    </div>
  );
}

function CoreIcon({ state }) {
  if (state === "recording") {
    return (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
        <path
          d="M5 11a7 7 0 0 0 14 0M12 18v3"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    );
  }
  if (state === "ended") {
    return (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
        <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 12a8 8 0 0 1 16 0M4 12a8 8 0 0 0 8 8h1M4 12v2a2 2 0 0 0 2 2h1v-5H5a1 1 0 0 0-1 1zM20 12v2a2 2 0 0 1-2 2h-1v-5h1a1 1 0 0 1 1 1z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
