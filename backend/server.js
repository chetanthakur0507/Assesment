import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "http";
import { WebSocketServer } from "ws";

import { transcribeAudio, synthesizeSpeech } from "./src/groqClient.js";
import { createSession, getSession, deleteSession } from "./src/sessionManager.js";
import { kickoff, runTurn } from "./src/conversationAgent.js";
import { generateReport } from "./src/reportGenerator.js";

const PORT = process.env.PORT || 8787;
const MAX_UPLOAD_BYTES = 12 * 1024 * 1024; // ~12MB per turn is very generous for push-to-talk clips

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, groqKeySet: Boolean(process.env.GROQ_API_KEY) });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/call", maxPayload: MAX_UPLOAD_BYTES });

function send(ws, payload) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(payload));
}

async function sendAiTurn(ws, session, turn) {
  send(ws, { type: "ai_text", text: turn.reply, fields: turn.fields, done: turn.done });

  const audioBuf = await synthesizeSpeech(turn.reply);
  send(ws, {
    type: "ai_audio",
    audio: audioBuf ? audioBuf.toString("base64") : null,
    mimeType: "audio/wav",
  });

  if (turn.done) {
    send(ws, { type: "call_ready_to_end" });
  }
}

wss.on("connection", async (ws) => {
  const session = createSession();
  send(ws, { type: "session_started", callId: session.callId });

  try {
    const greeting = await kickoff(session);
    await sendAiTurn(ws, session, greeting);
  } catch (err) {
    console.error("Greeting failed:", err);
    send(ws, {
      type: "error",
      stage: "greeting",
      message: "Could not start the call. Check the server's GROQ_API_KEY.",
    });
  }

  ws.on("message", async (raw, isBinary) => {
    if (isBinary) return; // we only expect JSON control/data messages

    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return send(ws, { type: "error", stage: "protocol", message: "Malformed message." });
    }

    const activeSession = getSession(session.callId);
    if (!activeSession) {
      return send(ws, { type: "error", stage: "session", message: "Session expired." });
    }

    if (msg.type === "user_audio") {
      try {
        if (!msg.audio) throw new Error("No audio payload received.");
        const buffer = Buffer.from(msg.audio, "base64");
        if (buffer.length === 0) throw new Error("Empty audio payload.");

        let sttResult;
        try {
          sttResult = await transcribeAudio(buffer, msg.mimeType || "audio/webm");
        } catch (err) {
          console.error("STT failed:", err.message);
          send(ws, { type: "user_transcript", text: "", empty: true, sttFailed: true });
          const turn = await runTurn(activeSession, "", { sttEmpty: true });
          await sendAiTurn(ws, activeSession, turn);
          return;
        }

        send(ws, {
          type: "user_transcript",
          text: sttResult.text,
          empty: sttResult.empty,
          language: sttResult.language,
        });

        const turn = await runTurn(activeSession, sttResult.text, {
          sttEmpty: sttResult.empty,
        });
        await sendAiTurn(ws, activeSession, turn);
      } catch (err) {
        console.error("Turn processing failed:", err);
        send(ws, {
          type: "error",
          stage: "turn",
          message: "Something went wrong processing that — please try again.",
        });
      }
      return;
    }

    if (msg.type === "end_call") {
      try {
        const report = await generateReport(activeSession);
        send(ws, { type: "report", report });
      } catch (err) {
        console.error("Report generation failed entirely:", err);
        send(ws, {
          type: "error",
          stage: "report",
          message: "Could not generate the report.",
        });
      } finally {
        deleteSession(activeSession.callId);
      }
      return;
    }
  });

  ws.on("close", () => {
    // Keep the session around briefly in case of a report request still
    // in flight; sessionManager's TTL cleanup handles final GC.
  });
});

server.listen(PORT, () => {
  console.log(`Health-screening backend listening on http://localhost:${PORT}`);
  console.log(`WebSocket call endpoint: ws://localhost:${PORT}/call`);
  if (!process.env.GROQ_API_KEY) {
    console.warn("WARNING: GROQ_API_KEY is not set — the call will fail. See backend/.env.example");
  }
});
