 Aria — Voice Health Screening

A live voice conversation with an AI health intake assistant.

The user speaks with **Aria**, an AI screening agent that asks adaptive health-screening questions one at a time. The conversation is processed in real time using a turn-based voice pipeline, and once the call ends, the application generates a structured, clinician-facing health screening report.

Built for the technical take-home assessment using:

* **React + Vite** — Frontend
* **Node.js + Express** — Backend
* **WebSocket** — Real-time call transport
* **Groq API** — Speech-to-Text, LLM, and Text-to-Speech

---

## Features

* Start and end a voice screening call
* AI-generated voice greeting
* User voice input through the browser microphone
* Speech-to-Text transcription
* Adaptive AI conversation
* One-question-at-a-time screening flow
* Conversation state maintained across turns
* AI remembers previously collected information
* Follow-up questions when answers are vague
* Text-to-Speech AI responses
* Live conversation transcript
* Structured health screening report
* Graceful handling of short/incomplete calls
* Graceful handling of silence or unclear speech
* LLM failure fallback
* TTS failure fallback
* WebSocket connection failure handling
* Clinician-style report UI
* No database required for the assessment demo

---

# Quick Start

## Requirements

Before running the project, make sure you have:

* **Node.js 20+**
* npm
* A modern browser with microphone support
* A **Groq API key**

Groq API keys can be created from:

https://console.groq.com/keys

---

## 1. Install dependencies

From the project root:

```bash
npm run install:all
```

---

## 2. Create the backend `.env` file

Create a file named:

```text
backend/.env
```

The final structure should look like:

```text
Aria/
├── backend/
│   ├── .env
│   ├── .env.example
│   ├── server.js
│   └── src/
├── frontend/
│   └── src/
├── package.json
└── README.md
```

### Configure `backend/.env`

Copy the following configuration into `backend/.env`:

```env
GROQ_API_KEY=your_groq_api_key_here

GROQ_STT_MODEL=whisper-large-v3-turbo
GROQ_LLM_MODEL=openai/gpt-oss-120b
GROQ_TTS_MODEL=canopylabs/orpheus-v1-english
GROQ_TTS_VOICE=autumn

PORT=8787
```

Replace:

```env
GROQ_API_KEY=your_groq_api_key_here
```

with your actual Groq API key.

### Security

**Never commit your real `.env` file or API key to GitHub.**

Your `.gitignore` should contain:

```text
node_modules/
.env
*.env
```

The repository should only contain the safe `.env.example` file with placeholder values.

---

## 3. Start the application

Run both frontend and backend together:

```bash
npm run dev
```

The application will be available at:

```text
Frontend:
http://localhost:5173

Backend:
http://localhost:8787

Health check:
http://localhost:8787/health
```

The Vite development server proxies:

```text
/call
/health
```

to the backend, so no additional CORS or URL configuration is required for local development.

---

## 4. Using the application

1. Open:

```text
http://localhost:5173
```

2. Click **Start Call**
3. Allow microphone permission
4. Aria greets the user
5. Speak when prompted
6. Click the microphone control to record a turn
7. Stop recording to send the response
8. Aria processes the response
9. Aria asks the next relevant question
10. Continue the screening conversation
11. Click **End Call** when finished
12. The application generates the structured health screening report

The application uses a turn-based / push-to-talk interaction rather than a continuous full-duplex voice stream.

---

## Running Frontend and Backend Separately

If preferred, run them in separate terminals.

### Backend

```bash
npm run dev:backend
```

### Frontend

```bash
npm run dev:frontend
```

---

# APIs and Models Used

All AI functionality is handled through the **Groq API**, called directly over HTTP from the Node.js backend.

The implementation does not depend on a Groq-specific SDK version.

The main API integration is located in:

```text
backend/src/groqClient.js
```

| Pipeline Stage   | Model                           | Purpose                          |
| ---------------- | ------------------------------- | -------------------------------- |
| Speech-to-Text   | `whisper-large-v3-turbo`        | Converts user speech to text     |
| Conversation LLM | `openai/gpt-oss-120b`           | Drives the adaptive conversation |
| Text-to-Speech   | `canopylabs/orpheus-v1-english` | Converts AI responses to speech  |
| TTS Voice        | `autumn`                        | Voice used for Aria              |

The model IDs can be changed through environment variables without modifying the application code.

```env
GROQ_STT_MODEL=whisper-large-v3-turbo
GROQ_LLM_MODEL=openai/gpt-oss-120b
GROQ_TTS_MODEL=canopylabs/orpheus-v1-english
GROQ_TTS_VOICE=autumn
```

Groq's model catalog can change over time. If a model is deprecated or renamed, update the corresponding environment variable with a currently supported model.

---

# Architecture

The application follows this pipeline:

```text
                         ARIA VOICE HEALTH SCREENING

┌─────────────────────┐
│      Browser        │
│                     │
│  React + Vite       │
│  Microphone         │
│  Voice UI           │
│  Transcript         │
└──────────┬──────────┘
           │
           │ WebSocket
           ▼
┌─────────────────────┐
│    Node.js Backend  │
│                     │
│ Express + WebSocket │
│                     │
│ Session Management  │
│ Conversation Agent  │
│ Report Generator    │
└──────────┬──────────┘
           │
           │ HTTP API
           ▼
┌─────────────────────────────────────┐
│              Groq API               │
│                                     │
│  Speech-to-Text                     │
│       ↓                             │
│  Conversation LLM                   │
│       ↓                             │
│  Text-to-Speech                     │
└─────────────────────────────────────┘
```

---

# Call Flow

```text
User clicks "Start Call"
        │
        ▼
WebSocket connection established
        │
        ▼
Backend creates a call session
        │
        ▼
LLM generates greeting + first question
        │
        ▼
TTS generates AI voice
        │
        ▼
Browser plays Aria's voice
        │
        ▼
User records a voice response
        │
        ▼
Audio sent to backend
        │
        ▼
Speech-to-Text
        │
        ▼
Transcript added to conversation
        │
        ▼
Conversation state updated
        │
        ▼
LLM generates next adaptive question
        │
        ▼
TTS generates AI voice
        │
        ▼
Browser plays response
        │
        ▼
Repeat until call ends
        │
        ▼
Generate structured health report
```

---

# Real-Time Transport

The application uses a single WebSocket connection for each call:

```text
ws://localhost:8787/call
```

The assessment allows a turn-based / push-to-talk approach, so the implementation intentionally uses:

```text
User speaks
     ↓
Audio is recorded
     ↓
Audio is sent for processing
     ↓
STT
     ↓
LLM
     ↓
TTS
     ↓
AI audio returned
```

This is not a raw full-duplex streaming audio implementation.

The goal was to provide a reliable working voice conversation while keeping enough time for conversation-state management, failure handling, and report generation.

---

# Conversation State Management

Conversation state is maintained server-side for every active call.

The session manager tracks:

1. Spoken conversation history
2. Structured screening fields

The structured fields include:

```text
name
chiefComplaint
duration
severity
associatedSymptoms
redFlags
notes
```

Example:

```json
{
  "name": "Chetan",
  "chiefComplaint": "Fever and headache",
  "duration": "2 days",
  "severity": "6/10",
  "associatedSymptoms": [
    "Weakness"
  ],
  "redFlags": [],
  "notes": ""
}
```

Every conversation turn returns the complete cumulative fields object rather than only newly discovered fields.

This allows the agent to understand:

```text
What has already been collected
        ↓
What is still missing
        ↓
What question should be asked next
```

This prevents the AI from repeatedly asking questions that the user has already answered.

---

# Adaptive Conversation

Aria is instructed to:

* Ask one question at a time
* Remember previous answers
* Avoid repeating already answered questions
* Ask follow-up questions when an answer is vague
* Collect relevant screening information
* Maintain the conversation naturally
* Avoid making a medical diagnosis

For example:

```text
Aria:
What is your main health concern?

User:
I've been feeling sick.

Aria:
I'm sorry you're not feeling well.
Could you tell me what symptoms you're experiencing?
```

Instead of blindly moving to the next fixed question, the agent can ask a relevant clarification.

---

# Health Report Generation

When the call ends, the backend sends the collected conversation and structured fields to the report generator.

The LLM generates a structured report containing information such as:

* Patient name
* Main concern
* Key symptoms
* Duration
* Severity
* Associated symptoms
* Red flags
* Follow-up considerations
* Completeness of the screening

The frontend then renders this information as a clinician-style screening summary.

Example:

```text
Health Screening Report

Patient Name:
Chetan

Main Concern:
Fever and headache

Duration:
Approximately 2 days

Severity:
6/10

Key Symptoms:
• Fever
• Headache
• Weakness

Associated Symptoms:
No cough reported

Red Flags:
None reported during screening

Follow-up:
Consider medical evaluation if symptoms persist,
worsen, or new concerning symptoms develop.

Screening Completeness:
Moderate
```

The report is intended as a **screening summary**, not a medical diagnosis.

---

# Handling Short or Incomplete Calls

The application does not assume that a complete conversation will always happen.

For example, if the user says only:

```text
My name is Chetan.
```

and immediately ends the call, the application generates a limited report rather than crashing.

Example:

```text
Patient Name:
Chetan

Main Concern:
Not provided

Symptoms:
Not provided

Duration:
Not provided

Severity:
Not provided

Screening Completeness:
Limited information collected
```

The application never intentionally invents missing health information.

---

# Failure Handling

## Speech-to-Text Failure

If the STT service returns no useful speech:

```text
(no clear speech detected)
```

The answer is not added as meaningful collected information.

Aria asks the user to repeat the response.

---

## LLM Failure

If the LLM request fails, the application uses a safe fallback response rather than terminating the call.

Example:

```text
Could you please repeat that?
```

The call can continue.

---

## TTS Failure

If Text-to-Speech fails:

* The AI response is still displayed as text
* The application does not crash
* The microphone is re-enabled
* The user can continue the conversation

---

## WebSocket Failure

If the WebSocket connection drops during a call:

* The frontend detects the connection problem
* A clear error is shown
* The application returns to the start state
* The UI does not remain stuck in a loading/call state

---

# Project Structure

```text
Aria/
│
├── backend/
│   ├── .env.example
│   ├── .env                  # Local only - NOT committed
│   ├── server.js             # Express + WebSocket server
│   │
│   └── src/
│       ├── groqClient.js     # Groq REST API integration
│       ├── sessionManager.js # Per-call session state
│       ├── conversationAgent.js
│       │                       # Conversation system prompt + turn logic
│       └── reportGenerator.js
│                               # Final report + fallback
│
├── frontend/
│   └── src/
│       ├── App.jsx           # Main call state machine
│       └── components/
│           ├── VoiceOrb/
│           ├── TranscriptPanel/
│           └── Report/
│
├── package.json
├── .gitignore
└── README.md
```

---

# Environment Variables

Create:

```text
backend/.env
```

with:

```env
GROQ_API_KEY=your_groq_api_key_here

GROQ_STT_MODEL=whisper-large-v3-turbo
GROQ_LLM_MODEL=openai/gpt-oss-120b
GROQ_TTS_MODEL=canopylabs/orpheus-v1-english
GROQ_TTS_VOICE=autumn

PORT=8787
```

### Variable Description

| Variable         | Description                  |
| ---------------- | ---------------------------- |
| `GROQ_API_KEY`   | Groq authentication key      |
| `GROQ_STT_MODEL` | Speech-to-Text model         |
| `GROQ_LLM_MODEL` | Conversation/reasoning model |
| `GROQ_TTS_MODEL` | Text-to-Speech model         |
| `GROQ_TTS_VOICE` | Voice used for TTS           |
| `PORT`           | Backend server port          |

---

# Language

The current implementation is built and tested primarily for **English**.

The STT pipeline can detect the language returned by the speech recognition model, but the current TTS configuration uses an English voice.

Hindi support could be added by:

1. Detecting the user's spoken language
2. Passing the language preference into conversation state
3. Instructing the LLM to respond in the detected language
4. Using a Hindi-capable TTS provider

A provider such as Sarvam AI could be integrated for Hindi-capable speech synthesis while keeping the existing Groq STT/LLM pipeline.

---

# UI and Design

The interface intentionally uses a clinical / health-screening visual language rather than a conventional chat interface.

### Call Screen

The call screen includes:

* Central animated voice orb
* Microphone interaction
* Live transcript
* Call status
* Start Call / End Call controls

The voice orb uses microphone amplitude through the browser's `AnalyserNode` to provide visual feedback while the user is speaking.

### Report Screen

The report uses a warm paper / clinical chart style.

Important information is separated into structured sections rather than displaying the raw conversation transcript.

Red flags and follow-up considerations are visually emphasized.

---

# Browser Permissions

The application requires microphone access.

When clicking **Start Call**, the browser may show a microphone permission prompt.

Choose:

```text
Allow
```

If microphone access is blocked, the browser's site permission settings may need to be updated.

For local development, the application runs on:

```text
http://localhost:5173
```

---

# Security Notes

This project is intended as a technical assessment/demo.

It is **not production-ready for real patient data**.

Important limitations include:

* API authentication is handled through server-side environment variables
* No user authentication
* No persistent database
* No encryption layer for stored medical information
* No patient identity verification
* No production-grade healthcare compliance implementation

Do not use real sensitive patient information with the assessment demo.

---

# What I Would Improve With More Time

## 1. Full-Duplex Voice

Replace the current turn-based push-to-talk flow with:

```text
WebRTC
+
Streaming STT
+
Streaming TTS
```

This would allow a more natural real-time conversation.

---

## 2. Barge-In

Allow the user to interrupt Aria while she is speaking.

For example:

```text
Aria:
Your symptoms sound like—

User:
Actually, wait...

Aria stops speaking
        ↓
Aria listens to user
```

---

## 3. Hindi / Multilingual Support

Add automatic language detection and switch the AI response language based on the user's speech.

A Hindi-capable TTS provider such as Sarvam AI could be added for better Hindi voice output.

---

## 4. Persistent Storage

Currently, call sessions are stored in memory.

A production version could use a database such as:

```text
MongoDB
PostgreSQL
```

to persist:

* Call sessions
* Transcripts
* Screening reports
* Patient records

---

## 5. Authentication

Add authentication and authorization so that only authorized users can access screening sessions and reports.

---

## 6. Mobile / Safari Testing

MediaRecorder codec support varies between browsers, especially on iOS Safari.

The application selects a supported audio MIME type at runtime, but a production version would require broader device and browser testing.

---

# Scope and Assessment Decisions

The assessment explicitly allows a turn-based / push-to-talk voice interaction rather than requiring a perfect full-duplex implementation.

Therefore, this project prioritizes:

* Working voice conversation
* Correct STT → LLM → TTS pipeline
* Conversation state
* Adaptive questioning
* Error recovery
* Structured report generation
* Graceful handling of incomplete calls

Full-duplex streaming, barge-in, persistent storage, authentication, and multilingual TTS are intentionally left as future improvements.

---

# Medical Safety Disclaimer

Aria is an AI health screening assistant intended for demonstration purposes.

It does **not** provide medical diagnosis, treatment, or emergency medical advice.

The generated report summarizes information provided during the conversation and should not replace evaluation by a qualified healthcare professional.

If a user experiences severe or emergency symptoms, they should seek appropriate emergency medical care.

---

# Assessment Submission Checklist

Before submitting the project:

* [ ] Application runs successfully
* [ ] `Start Call` works
* [ ] Microphone permission works
* [ ] AI greeting plays
* [ ] User voice is transcribed
* [ ] AI responds using voice
* [ ] AI remembers previous answers
* [ ] AI asks adaptive follow-up questions
* [ ] `End Call` works
* [ ] Health report is generated
* [ ] Short/incomplete calls do not crash
* [ ] STT failure is handled
* [ ] LLM failure is handled
* [ ] TTS failure is handled
* [ ] WebSocket failure is handled
* [ ] `backend/.env` is configured locally
* [ ] Real API keys are NOT committed
* [ ] `.gitignore` includes `.env`
* [ ] `.env.example` contains only placeholder values
* [ ] README contains setup instructions
* [ ] GitHub repository is Public
* [ ] Screen recording demonstrates the complete flow

---

# Submission

The GitHub repository should be made **Public** so that it can be reviewed.

The repository should include:

```text
Source code
README.md
.env.example
.gitignore
```

The real `.env` file and API keys must not be included in the repository.

For the requested screen recording, demonstrate:

```text
Start Call
    ↓
AI Greeting
    ↓
User Voice
    ↓
AI Voice Response
    ↓
Multiple Conversation Turns
    ↓
Adaptive Question / Follow-up
    ↓
End Call
    ↓
Generated Health Screening Report
```

The screen recording should capture both:

* The **AI agent's voice**
* The **human user's voice**

so that the complete conversation can be understood.

For the assessment submission email, use the subject:

```text
Tech Assessment 01
```

Include the GitHub repository link and the screen-recording link as requested by the assessment instructions.

---

# License

This project was created as a technical assessment submission and demonstration project.
#   A s s e s m e n t 
 
 
