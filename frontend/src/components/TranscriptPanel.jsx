import React, { useEffect, useRef } from "react";
import "./TranscriptPanel.css";

export default function TranscriptPanel({ turns }) {
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns]);

  return (
    <div className="transcript">
      <div className="transcript__header">
        <span className="mono">LIVE CHART NOTE</span>
        <span className="transcript__dot" />
      </div>
      <div className="transcript__body">
        {turns.length === 0 && (
          <p className="transcript__empty">The conversation will appear here as it happens.</p>
        )}
        {turns.map((t, i) => (
          <div key={i} className={`transcript__row transcript__row--${t.role}`}>
            <span className="transcript__role mono">{t.role === "assistant" ? "ARIA" : "YOU"}</span>
            <span className={`transcript__text ${t.unclear ? "transcript__text--unclear" : ""}`}>
              {t.text}
            </span>
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
}
