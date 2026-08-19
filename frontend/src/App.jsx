import React, { useCallback, useEffect, useRef, useState } from "react";
import VoiceOrb from "./components/VoiceOrb.jsx";
import TranscriptPanel from "./components/TranscriptPanel.jsx";
import Report from "./components/Report.jsx";
import "./App.css";

const WS_URL =
  import.meta.env.VITE_WS_URL ||
  `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/call`;

const PICKED_MIME =
  typeof MediaRecorder !== "undefined" &&
  ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((t) =>
    MediaRecorder.isTypeSupported?.(t)
  );

export default function App() {
  const [callState, setCallState] = useState("idle"); // idle | connecting | ai_speaking | ready | recording | processing | ending | report
  const [turns, setTurns] = useState([]);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState(null);
  const [report, setReport] = useState(null);

  const wsRef = useRef(null);
  const audioElRef = useRef(null);
  const pendingDoneRef = useRef(false);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const rafRef = useRef(null);

  const cleanupMic = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
      audioCtxRef.current.close().catch(() => {});
    }
    audioCtxRef.current = null;
    setLevel(0);
  }, []);

  const teardown = useCallback(() => {
    cleanupMic();
    wsRef.current?.close();
    wsRef.current = null;
  }, [cleanupMic]);

  useEffect(() => () => teardown(), [teardown]);

  function playAiAudio(base64, mimeType, onDone) {
    if (!base64) {
      onDone();
      return;
    }
    const el = audioElRef.current;
    el.src = `data:${mimeType || "audio/mpeg"};base64,${base64}`;
    el.onended = onDone;
    el.onerror = onDone;
    el.play().catch(() => onDone());
  }

  function handleServerMessage(msg) {
    switch (msg.type) {
      case "session_started":
        break;

      case "ai_text": {
        pendingDoneRef.current = Boolean(msg.done);
        setTurns((t) => [...t, { role: "assistant", text: msg.text }]);
        setCallState("ai_speaking");
        break;
      }

      case "ai_audio": {
        playAiAudio(msg.audio, msg.mimeType, () => {
          if (pendingDoneRef.current) {
            endCall(true);
          } else {
            setCallState("ready");
          }
        });
        break;
      }

      case "user_transcript": {
        setTurns((t) => [
          ...t,
          {
            role: "user",
            text: msg.empty ? "(no clear speech detected)" : msg.text,
            unclear: msg.empty,
          },
        ]);
        break;
      }

      case "call_ready_to_end":
        break;

      case "report": {
        setReport(msg.report);
        setCallState("report");
        teardown();
        break;
      }

      case "error": {
        setError(msg.message || "Something went wrong.");
        if (msg.stage === "greeting") {
          setCallState("idle");
          teardown();
        } else if (callState === "processing" || callState === "recording") {
          setCallState("ready");
        }
        break;
      }

      default:
        break;
    }
  }

  function startCall() {
    setError(null);
    setTurns([]);
    setReport(null);
    setCallState("connecting");

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onmessage = (evt) => {
      try {
        handleServerMessage(JSON.parse(evt.data));
      } catch (e) {
        console.error("Bad message from server", e);
      }
    };
    ws.onerror = () => {
      setError("Couldn't reach the call server. Is the backend running?");
      setCallState("idle");
    };
    ws.onclose = () => {
      setCallState((s) => {
        if (s === "report" || s === "idle") return s;
        setError((e) => e || "The call connection was lost. Please start a new call.");
        return "idle";
      });
    };
  }

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        setLevel(Math.min(1, avg / 100));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();

      const mr = new MediaRecorder(stream, PICKED_MIME ? { mimeType: PICKED_MIME } : undefined);
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = onRecordingStopped;
      mediaRecorderRef.current = mr;
      mr.start();
      setCallState("recording");
    } catch (err) {
      console.error(err);
      setError("Couldn't access your microphone. Check your browser's permission settings.");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    cleanupMic();
  }

  function onRecordingStopped() {
    const mimeType = mediaRecorderRef.current?.mimeType || PICKED_MIME || "audio/webm";
    const blob = new Blob(chunksRef.current, { type: mimeType });
    setCallState("processing");

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result.split(",")[1];
      wsRef.current?.readyState === WebSocket.OPEN &&
        wsRef.current.send(JSON.stringify({ type: "user_audio", audio: base64, mimeType }));
    };
    reader.onerror = () => setError("Couldn't process the recording — please try again.");
    reader.readAsDataURL(blob);
  }

  function endCall(auto = false) {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    cleanupMic();
    setCallState("ending");
    wsRef.current.send(JSON.stringify({ type: "end_call" }));
  }

  function restart() {
    setCallState("idle");
    setTurns([]);
    setReport(null);
    setError(null);
  }

  const inCall = !["idle", "report"].includes(callState);
  const orbState =
    callState === "ending" ? "processing" : callState === "connecting" ? "connecting" : callState;

  return (
    <div className="app">
      <audio ref={audioElRef} hidden />
      <header className="app__header">
        <div className="app__brand">
          <span className="app__brand-mark" />
          <span className="app__brand-name">Aria</span>
          <span className="app__brand-sub mono">voice health screening</span>
        </div>
        {inCall && (
          <button className="app__end-btn" onClick={() => endCall(false)} disabled={callState === "ending"}>
            End call
          </button>
        )}
      </header>

      {error && (
        <div className="app__error" role="alert">
          {error}
        </div>
      )}

      <main className="app__main">
        {callState === "idle" && (
          <section className="hero">
            <div className="hero__copy">
              <p className="hero__eyebrow mono">YOUR HEALTH, HEARD</p>
              <h1 className="hero__title">
                A calmer first step to <span>feeling better.</span>
              </h1>
              <p className="hero__body">
                Talk naturally with Aria about how you feel. In a few minutes, your conversation
                becomes a clear, clinician-ready intake summary.
              </p>
              <button className="hero__cta" onClick={startCall}>
                <span className="hero__cta-icon">↗</span> Start a health check
              </button>
              <div className="hero__trust"><span /> Private by design <b>·</b> No diagnosis</div>
            </div>
            <div className="hero__visual" aria-hidden="true">
              <div className="hero__halo hero__halo--outer" />
              <div className="hero__halo hero__halo--inner" />
              <div className="hero__orb">
                <span className="hero__orb-cross">+</span>
                <span className="hero__orb-pulse" />
              </div>
              <div className="hero__float-card hero__float-card--top"><span className="hero__float-icon">✦</span><div><strong>Listening first</strong><small>Personalized screening</small></div></div>
              <div className="hero__float-card hero__float-card--bottom"><span className="hero__float-icon hero__float-icon--mint">✓</span><div><strong>Clear next steps</strong><small>Ready when you are</small></div></div>
            </div>
          </section>
        )}

        {inCall && (
          <section className="call">
            <div className="call__stage">
              <VoiceOrb state={orbState} level={level} />
              <div className="call__control">
                {callState === "ready" && (
                  <button className="call__mic call__mic--start" onClick={startRecording}>
                    Tap to speak
                  </button>
                )}
                {callState === "recording" && (
                  <button className="call__mic call__mic--stop" onClick={stopRecording}>
                    Tap to send
                  </button>
                )}
                {["connecting", "ai_speaking", "processing", "ending"].includes(callState) && (
                  <div className="call__waiting mono">please wait…</div>
                )}
              </div>
            </div>
            <TranscriptPanel turns={turns} />
          </section>
        )}

        {callState === "report" && <Report report={report} onRestart={restart} />}
      </main>

      <footer className="app__footer mono">
        Not a diagnosis. For informational intake purposes only.
      </footer>
    </div>
  );
}
