import { chatCompletion } from "./groqClient.js";

function deterministicReport(session, note) {
  const f = session.fields;
  const hasAnything = Boolean(
    f.name || f.chiefComplaint || f.duration || f.severity || f.associatedSymptoms.length
  );

  return {
    summary: hasAnything
      ? `Limited screening data was collected before the call ended. ${
          f.chiefComplaint ? `The patient mentioned: ${f.chiefComplaint}.` : ""
        }`.trim()
      : "The call ended before any meaningful information was collected. No screening data is available.",
    patientName: f.name,
    chiefComplaint: f.chiefComplaint,
    duration: f.duration,
    severity: f.severity,
    associatedSymptoms: f.associatedSymptoms,
    redFlags: f.redFlags,
    recommendedFollowUp: f.redFlags.length
      ? "Red flags were mentioned — recommend prompt clinician review."
      : "Standard follow-up; consider a short callback to complete the missed questions.",
    completeness: hasAnything ? "partial" : "minimal",
    note,
  };
}

/**
 * Build the final report. Always tries the LLM for a well-written
 * synthesis, but falls back to a deterministic report built straight
 * from the tracked fields if the call was too short, or the LLM call
 * fails, so the UI never shows garbage or crashes.
 */
export async function generateReport(session) {
  const turnCount = session.messages.filter((m) => m.role === "user").length;

  if (turnCount === 0) {
    return deterministicReport(
      session,
      "Call ended with no patient responses recorded."
    );
  }

  const transcript = session.messages
    .map((m) => `${m.role === "user" ? "Patient" : "Aria"}: ${m.text}`)
    .join("\n");

  const prompt = `Below is a transcript of a voice health-screening call and the structured data tracked live during the call. Write a clinician-facing intake report.

TRANSCRIPT:
${transcript}

TRACKED FIELDS (JSON):
${JSON.stringify(session.fields)}

Respond with STRICT JSON ONLY in exactly this shape:
{
  "summary": "<2-4 sentence plain-English clinical summary a doctor could glance at>",
  "patientName": "<string or null>",
  "chiefComplaint": "<string or null>",
  "duration": "<string or null>",
  "severity": "<string or null>",
  "associatedSymptoms": ["<string>", ...],
  "redFlags": ["<string>", ...],
  "recommendedFollowUp": "<one short sentence>",
  "completeness": "<'full' if all core questions were answered, 'partial' if some were, 'minimal' if almost nothing was collected>"
}
Do not invent facts not present in the transcript or tracked fields.`;

  try {
    const raw = await chatCompletion(
      [
        {
          role: "system",
          content:
            "You are a clinical documentation assistant that turns call transcripts into concise, accurate intake reports. Output strict JSON only.",
        },
        { role: "user", content: prompt },
      ],
      { jsonMode: true, temperature: 0.2 }
    );
    const cleaned = raw.trim().replace(/^```json\s*|^```\s*|```$/g, "");
    const parsed = JSON.parse(cleaned);
    if (!parsed || typeof parsed.summary !== "string") throw new Error("bad shape");

    return {
      summary: parsed.summary,
      patientName: parsed.patientName ?? session.fields.name,
      chiefComplaint: parsed.chiefComplaint ?? session.fields.chiefComplaint,
      duration: parsed.duration ?? session.fields.duration,
      severity: parsed.severity ?? session.fields.severity,
      associatedSymptoms: Array.isArray(parsed.associatedSymptoms)
        ? parsed.associatedSymptoms
        : session.fields.associatedSymptoms,
      redFlags: Array.isArray(parsed.redFlags) ? parsed.redFlags : session.fields.redFlags,
      recommendedFollowUp: parsed.recommendedFollowUp || null,
      completeness: parsed.completeness || (turnCount < 2 ? "minimal" : "partial"),
      note: null,
    };
  } catch (err) {
    console.error("Report generation via LLM failed, using fallback:", err.message);
    return deterministicReport(
      session,
      "Automated summary generation failed; showing raw tracked data instead."
    );
  }
}
