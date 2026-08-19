# Aria — Voice Health Screening

A live voice conversation with an AI health intake assistant.

**Aria** is an AI screening agent that asks adaptive health-screening questions one at a time. The conversation is processed in real time using a turn-based voice pipeline. Once the call ends, the application generates a structured, clinician-facing health screening report.

Built for a technical take-home assessment.

## Tech Stack

- **React + Vite** — Frontend
- **Node.js + Express** — Backend
- **WebSocket** — Real-time call transport
- **Groq API** — Speech-to-Text, LLM, and Text-to-Speech

---

## Features

- Start and end a voice screening call
- AI-generated voice greeting
- User voice input through browser microphone
- Speech-to-Text transcription
- Adaptive AI conversation
- One-question-at-a-time screening flow
- Conversation state maintained across turns
- AI remembers previously collected information
- Follow-up questions when answers are vague
- Text-to-Speech AI responses
- Live conversation transcript
- Structured health screening report
- Graceful handling of short/incomplete calls
- Graceful handling of silence or unclear speech
- LLM failure fallback
- TTS failure fallback
- WebSocket connection failure handling
- Clinician-style report UI
- No database required for the assessment demo

---

# Quick Start

## Requirements

Before running the project, make sure you have:

- **Node.js 20+**
- **npm**
- A modern browser with microphone support
- A **Groq API key**

Create your Groq API key from:

https://console.groq.com/keys

---

## 1. Install Dependencies

From the project root:

```bash
npm run install:all
