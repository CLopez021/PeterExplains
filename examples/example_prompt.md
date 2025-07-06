# ===== Peter Explains Prompt (JSON Output) =====

TOPIC: 

Write a TikTok duet in the “Peter Explains” format using the single topic above.  
Don’t ask for the topic again.

PRE‑WORK  
• Research online first. Pull in at least one surprising or little‑known detail to boost engagement.  
• Note any unavoidable jargon so you’re ready to define it in‑scene.

STRUCTURE  
• 6–8 total turns, alternating Stewie → Peter → Stewie → Peter …  
• Indent every line with two spaces for readability.

HOOK & TONE (make it sound like real dialogue)  
• Stewie’s very first line must start with “Peter,” followed by a clear 5–8‑word hook question.  
  – Write it the way someone would actually speak: use contractions, natural phrasing, and no tabloid‑style headlines (e.g., ditch “accident or erasure?”). Try to sound like a normal 21 year old but that has extensive knowledge on the subject of course.

• Stewie: ≤ 2 sentences; wry, curious; may ask “What does X mean?” if jargon appears.  
• Peter: 3–5 sentences (45–70 words); friendly/goofy expert vibe.  
  – Keep sentences conversational—use everyday language and contractions.  
  – If Stewie asks about jargon, define it right away in plain English.  
• Address the other by name once per turn at most.
• Your job is not to decide whether something is real or fake you will simply introduce/
discuss the topic. The viewer should be left to interpret the information on their own.

ACCESSIBLE, NATURAL LANGUAGE  
• Aim for how two people would really chat. Avoid stiff or overly formal wording.  
• Break long ideas into shorter sentences for smoother TTS delivery.

CONTENT SAFETY & WORD SUBSTITUTION  
• If any black‑listed or sensitive terms appear (e.g., **rape**, **suicide**, **kill**, **murder**, **self‑harm**), swap in TikTok‑friendly euphemisms with no asterisks (e.g., **grape** for rape, **unalive** for suicide or kill) while keeping the meaning clear.

LENGTH & PACING  
• 220–280 words total (≈ 1–2 min in ElevenLabs v3 TTS).  
• Normal punctuation; no ALL‑CAPS, phonetics, or audio tags.

ELEVENLABS v3 BEST PRACTICE  
• Speaker labels only: `Stewie:` or `Peter:` (no brackets/stage directions).  
• Use clear sentence breaks for smooth TTS.

**OUTPUT FORMAT**  
Return exactly a JSON array of objects, one per turn, in order:

```json
[
  {
    "speaker": "Stewie",
    "text": "<Stewie’s line>"
  },
  {
    "speaker": "Peter",
    "text": "<Peter’s line>"
  }
  … (continue until 6–8 total objects) …
]

Do not output any additional text besides a separate section where you link all your sources, so it should be a clean json box for me to copy, then your sources at the bottom outside the json. 

**NEVER EVER OUTPUT SOURCES IN THE JSON PORTION.**
===== End Prompt =====