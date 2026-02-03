# KI-Cockpit V2.6 – Vollständige Technische Dokumentation

**Projektname:** KI-Cockpit  
**Version:** 2.6.1  
**Entwicklungszeitraum:** 1.–2. Februar 2026  
**Lead-Architekt:** Claude (Anthropic)  
**Assistenten:** Gemini (Google), ChatGPT (OpenAI)  
**Eigentümer:** Armin (GitHub: mousso74)

---

## Inhaltsverzeichnis

1. [Projektübersicht](#1-projektübersicht)
2. [Architektur](#2-architektur)
3. [Das Chef/Assistenten-Modell](#3-das-chefassistenten-modell)
4. [Technologie-Stack](#4-technologie-stack)
5. [Dateistruktur](#5-dateistruktur)
6. [Workflow-Beschreibung](#6-workflow-beschreibung)
7. [Prompt-Templates](#7-prompt-templates)
8. [Backend-Code (Google Apps Script)](#8-backend-code-google-apps-script)
9. [Frontend-Code (Wichtige Funktionen)](#9-frontend-code-wichtige-funktionen)
10. [Versionsgeschichte](#10-versionsgeschichte)
11. [Bekannte Probleme und Lösungen](#11-bekannte-probleme-und-lösungen)
12. [URLs und Zugangsdaten](#12-urls-und-zugangsdaten)

---

## 1. Projektübersicht

Das KI-Cockpit ist eine Web-Applikation, die drei KI-Modelle (ChatGPT, Claude, Gemini) parallel befragt, um komplexe Probleme zu lösen. Der Workflow umfasst:

1. **Problemdefinition** durch den Benutzer
2. **Automatische Prompt-Generierung** für alle drei KIs
3. **Rückfragen-Sammlung** von allen drei KIs
4. **Intelligente Deduplizierung** der Fragen via Gemini API
5. **Beantwortung** der deduplizierten Fragen
6. **Lösungsgenerierung** durch alle drei KIs
7. **Synthese** der besten Lösung via Gemini API
8. **Archivierung** und **Export** als Markdown

---

## 2. Architektur

```
┌─────────────────────────────────────────────────────────────────┐
│                         BENUTZER                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND (GitHub Pages)                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   HTML      │  │   CSS       │  │   JavaScript │              │
│  │ index.html  │  │ style.css   │  │ app.js       │              │
│  └─────────────┘  └─────────────┘  │ prompts.js   │              │
│                                     │ storage.js   │              │
│                                     └─────────────┘              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ fetch() Requests
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                 BACKEND (Google Apps Script)                     │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  doPost() → Router                                       │    │
│  │    ├── handleSaveSession()                               │    │
│  │    ├── handleListSessions()                              │    │
│  │    ├── handleGetSession()                                │    │
│  │    ├── handleSynthesize()         ──────────────────┐    │    │
│  │    ├── handleDeduplicateQuestions() ────────────────┤    │    │
│  │    └── handleSaveExport()                           │    │    │
│  └─────────────────────────────────────────────────────┼────┘    │
└────────────────────────────────────────────────────────┼────────┘
                                                         │
                                                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                      GEMINI API                                  │
│              gemini-3-pro-preview                                │
│         (Synthese + Deduplizierung)                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    GOOGLE DRIVE                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  KI-Cockpit-Archiv/                                      │    │
│  │    ├── 2026-02/                                          │    │
│  │    │     ├── 2026-02-02_18-35__blaehungen-diagnose.json │    │
│  │    │     └── 2026-02-02_19-42__email-an-ernest.json     │    │
│  │    └── Export/                                           │    │
│  │          └── [PDF/MD Exporte]                            │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Das Chef/Assistenten-Modell

Das Projekt wurde mit einem innovativen Multi-KI-Entwicklungsansatz realisiert:

### Rollenverteilung

| Rolle | KI | Aufgaben |
|-------|-----|----------|
| **Lead-Architekt (Chef)** | Claude | Gesamtarchitektur, Frontend-Entwicklung via Claude Code, Koordination, Entscheidungen |
| **Backend-Spezialist** | Gemini | Google Apps Script, Gemini API Integration, Quota-Management, Drive-Speicherung |
| **Frontend-Spezialist** | ChatGPT | JavaScript-Debugging, formatMarkdown(), Prompt-Engineering |

### Kommunikationsprotokoll

1. **Problem identifiziert** → Claude analysiert
2. **Spezialist benötigt** → Claude erstellt kontextreichen Prompt für den jeweiligen Assistenten
3. **Assistent antwortet** → Lösung wird an Claude zurückgegeben
4. **Claude konsolidiert** → Implementierung via Claude Code

### Beispiel: Bug-Fix via Assistenten

**Situation:** `text.replace is not a function` Fehler beim Session-Laden

**Claudes Prompt an ChatGPT:**
```
## Kontext: KI-Cockpit V2.3 – Frontend-Bug beim Session-Laden

### BUG 1: "text.replace is not a function"
Beim Klicken auf eine gespeicherte Session im Archiv erscheint dieser Fehler.

Vermutete Ursache: Die formatMarkdown() Funktion erhält kein String, 
sondern undefined oder ein Objekt.

Aktueller Code:
function formatMarkdown(text) {
  return text
    .replace(/## (.*?)(\n|$)/g, '<h3>$1</h3>')
    // ...
}

Deine Aufgabe: Liefere eine robuste Version von formatMarkdown()
```

**Claudes Prompt an Gemini:**
```
## Kontext: KI-Cockpit V2.3 – Backend-Bug bei Session-Speicherung

### Das Problem:
Die Sessions werden gespeichert, aber der titleSlug wird NICHT in den 
Dateinamen übernommen.

Erwartet: 2026-02-02_18-35__blaehungen-diagnose.json
Tatsächlich: 2026-02-02_18-35__session.json

### Meine Vermutung:
Der Code liest data.titleSlug, aber die Daten sind in data.data.titleSlug 
geschachtelt.

Deine Aufgaben:
1. Analysiere das Problem
2. Liefere korrigierten handleSaveSession() Code
```

---

## 4. Technologie-Stack

| Komponente | Technologie | Beschreibung |
|------------|-------------|--------------|
| Frontend-Hosting | GitHub Pages | Statisches Hosting, kostenlos |
| Frontend-Sprache | Vanilla JavaScript | Kein Framework, direkte DOM-Manipulation |
| Styling | CSS3 | Dark Theme, responsive |
| Backend | Google Apps Script | Serverless, kostenlos |
| Datenbank | Google Drive | JSON-Dateien als Speicher |
| AI-Engine | Gemini API | gemini-3-pro-preview |
| Versionskontrolle | Git/GitHub | Repository: mousso74/ki-cockpit |
| Entwicklungstool | Claude Code | CLI-basierte Entwicklung |

---

## 5. Dateistruktur

```
ki-cockpit/
├── index.html              # Hauptseite mit State-Machine
├── css/
│   └── style.css           # Dark Theme Styling
├── js/
│   ├── app.js              # Hauptlogik, State-Management
│   ├── prompts.js          # Prompt-Templates (Questions, Solve)
│   └── storage.js          # API-Kommunikation mit Backend
└── README.md               # Projekt-Dokumentation
```

---

## 6. Workflow-Beschreibung

### State-Machine (6 Zustände)

```
State 0: PROBLEM_INPUT
    │
    ▼ [Prompts generieren]
State 1: PHASE1_PROMPTS
    │
    ▼ [KI-Outputs einfügen → Fragen analysieren]
State 2: QUESTIONS_REVIEW (Deduplizierung via Gemini)
    │
    ▼ [Fragen beantworten]
State 3: ANSWERS_INPUT
    │
    ▼ [Solve-Prompts generieren]
State 4: PHASE2_PROMPTS
    │
    ▼ [KI-Outputs einfügen → Synthese starten]
State 5: SYNTHESIS (Synthese via Gemini)
    │
    ▼ [Session speichern / Exportieren]
```

### Deduplizierungsprozess

**Problem:** Drei KIs stellen zusammen ~30 Fragen, viele davon semantisch identisch.

**Vorher (V1):** Jaccard-Ähnlichkeit (statisch, nur Wortvergleich)
- Ergebnis: 20+ ähnliche Fragen

**Nachher (V2):** Gemini API (semantisch)
- Ergebnis: 5-8 präzise, deduplizierte Fragen

**Beispiel:**
```
Input (3 KIs):
- ChatGPT: "Treten die Blähungen in zeitlichem Zusammenhang mit Mahlzeiten auf?"
- Claude: "Wann treten die Blähungen typischerweise auf – nach Mahlzeiten?"
- Gemini: "Gibt es einen Zusammenhang mit bestimmten Nahrungsmitteln?"

Output (dedupliziert):
- "Gibt es einen erkennbaren Zusammenhang zu bestimmten Mahlzeiten oder 
   Lebensmitteln und wie sieht Ihre typische Ernährung aus?"
  [Sources: ChatGPT, Claude, Gemini] [Priority: P2]
```

---

## 7. Prompt-Templates

### Questions-Template V2 (SYSTEM)

```
You are a strict question-generation engine.

Your task is to identify and ask ONLY the clarifying questions that are truly necessary to solve the user's problem later.

ABSOLUTE RULES (non-negotiable):
- Output ONLY the [QUESTIONS] block defined below.
- Do NOT add any text before or after the [QUESTIONS] block.
- Do NOT add explanations, suggestions, confirmations, summaries, or follow-up offers.
- Do NOT ask the user if they want to continue.
- If these rules are violated, the output is invalid.

QUESTION RULES:
- Ask as many questions as necessary, and as few as possible.
- Stop asking questions as soon as additional questions would not materially improve solution quality.
- Questions must be concrete, non-overlapping, and decision-relevant.
- Every question must be assigned exactly one priority (P1, P2, or P3) and exactly one tag.

LANGUAGE: Respond in German.

You must internally verify compliance with all rules before responding.
If compliance is not met, correct the output silently before returning it.
```

### Questions-Template V2 (USER)

```
[PROBLEM]
{PROBLEM_TEXT}
[/PROBLEM]

[TASK]
Generate only the clarifying questions required to solve the problem properly later.
Use your judgment to determine how many questions are needed.
Do not aim for a target number.

[OUTPUT_FORMAT]
Return EXACTLY the following structure and nothing else:

[QUESTIONS]
1. (P1) (TAG:{TAG}) {Question text}
2. (P2) (TAG:{TAG}) {Question text}
...
[/QUESTIONS]

ALLOWED TAGS (choose exactly one per question):
objective | constraints | timeline | stakeholders | data | preferences | risks | legal | medical | technical | financial | communication | other

PRIORITY DEFINITIONS:
- P1 = blocking (must be answered before any solution is possible)
- P2 = important (significantly improves solution quality)
- P3 = optional (nice to have, refinement only)
[/OUTPUT_FORMAT]
```

### Solve-Template V2 (SYSTEM)

```
You are a precise solution-generation engine.

Based on the clarified problem and Q&A, provide a structured solution.

ABSOLUTE RULES (non-negotiable):
- Output ONLY the blocks defined below.
- Do NOT add any text before or after the defined blocks.
- Do NOT add explanations, suggestions, confirmations, or follow-up offers.
- If these rules are violated, the output is invalid.

LANGUAGE: Respond in German.

You must internally verify compliance with all rules before responding.
If compliance is not met, correct the output silently before returning it.
```

### Solve-Template V2 (USER)

```
[PROBLEM]
{PROBLEM_TEXT}
[/PROBLEM]

[CLARIFYING_QA]
{QA_BLOCK}
[/CLARIFYING_QA]

[TASK]
Based on the problem and the clarified Q&A:
1) Decide whether you have sufficient information to proceed.
2) If yes, provide a clear and actionable solution.
3) If no, request only the missing information.

[OUTPUT_FORMAT]
Return EXACTLY the following structure and nothing else:

[STATUS]
- readiness: {READY | NEEDS_INFO}
- confidence: {0-100}
[/STATUS]

[FOLLOWUP_QUESTIONS]
IF readiness = NEEDS_INFO: List missing questions
IF readiness = READY: Write exactly: NONE
[/FOLLOWUP_QUESTIONS]

[SOLUTION]
IF readiness = READY: Provide the solution.
IF readiness = NEEDS_INFO: Write exactly: PENDING
[/SOLUTION]

[ACTION_PLAN]
IF readiness = READY: List concrete next steps (numbered).
IF readiness = NEEDS_INFO: Write exactly: PENDING
[/ACTION_PLAN]

[RISKS]
IF readiness = READY: List relevant risks and countermeasures.
IF readiness = NEEDS_INFO: Write exactly: PENDING
[/RISKS]

[ASSUMPTIONS]
List assumptions that materially affect the solution.
If none: Write exactly: NONE
[/ASSUMPTIONS]
[/OUTPUT_FORMAT]
```

---

## 8. Backend-Code (Google Apps Script)

### Haupt-Router (doPost)

```javascript
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    
    let result;
    switch(action) {
      case 'saveSession':
        result = handleSaveSession(data);
        break;
      case 'listSessions':
        result = handleListSessions();
        break;
      case 'getSession':
        result = handleGetSession(data.id);
        break;
      case 'synthesize':
        result = handleSynthesize(data);
        break;
      case 'deduplicateQuestions':
        result = handleDeduplicateQuestions(data);
        break;
      case 'saveExport':
        result = handleSaveExport(data);
        break;
      default:
        result = errorResponse('Unknown action: ' + action);
    }
    
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
```

### handleSaveSession (korrigiert für verschachtelte Daten)

```javascript
function handleSaveSession(payload) {
  const rootFolder = getOrCreateFolder(SETTINGS.ROOT_FOLDER_NAME);
  
  // Zugriff auf die verschachtelten Daten
  const sessionContent = payload.data || {}; 
  
  const monthString = Utilities.formatDate(new Date(), "GMT+1", "yyyy-MM");
  const monthFolder = getOrCreateFolder(monthString, rootFolder);
  
  const timestamp = Utilities.formatDate(new Date(), "GMT+1", "yyyy-MM-dd_HH-mm");
  
  // Korrekter Zugriff auf den titleSlug innerhalb von payload.data
  const slug = sessionContent.titleSlug || "session";
  const fileName = `${timestamp}__${slug}.json`;
  
  // Nur den Inhalt von 'data' speichern
  const file = monthFolder.createFile(
    fileName, 
    JSON.stringify(sessionContent, null, 2), 
    MimeType.PLAIN_TEXT
  );
  
  return successResponse({ 
    id: file.getId(), 
    name: fileName,
    slug: slug 
  });
}
```

### handleListSessions (optimiert)

```javascript
function handleListSessions() {
  const rootFolder = getOrCreateFolder(SETTINGS.ROOT_FOLDER_NAME);
  const folders = rootFolder.getFolders();
  let allFiles = [];

  while (folders.hasNext()) {
    const folder = folders.next();
    if (folder.getName() === "Export") continue;

    const files = folder.getFiles();
    while (files.hasNext()) {
      const file = files.next();
      if (file.getName().endsWith(".json")) {
        const rawName = file.getName().replace(".json", "");
        
        // Extraktion von Zeitstempel und Titel
        const parts = rawName.split("__");
        const timestamp = parts[0];
        const title = parts.length > 1 ? parts[1] : "Unbenannte Session";

        allFiles.push({
          id: file.getId(),
          fileName: file.getName(),
          displayTitle: title,
          timestamp: timestamp,
          date: file.getDateCreated(),
          folder: folder.getName()
        });
      }
    }
  }
  
  allFiles.sort((a, b) => b.date - a.date);
  return successResponse(allFiles);
}
```

### handleDeduplicateQuestions (Smart Dedupe via Gemini)

```javascript
function handleDeduplicateQuestions(data) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent?key=${apiKey}`;
  
  const prompt = `
Du bist ein erfahrener Strategieberater. Vor dir liegen Listen von Rückfragen dreier KI-Assistenten (ChatGPT, Claude, Gemini) zu folgendem Problem:

[ORIGINAL_PROBLEM]
${data.originalProblem}
[/ORIGINAL_PROBLEM]

[CHATGPT_QUESTIONS]
${data.questions.chatgpt.join('\n')}
[/CHATGPT_QUESTIONS]

[CLAUDE_QUESTIONS]
${data.questions.claude.join('\n')}
[/CLAUDE_QUESTIONS]

[GEMINI_QUESTIONS]
${data.questions.gemini.join('\n')}
[/GEMINI_QUESTIONS]

AUFGABE:
1. Identifiziere semantisch gleiche oder sehr ähnliche Fragen
2. Wähle die präziseste Formulierung oder kombiniere zu einer besseren Frage
3. Weise jeder Frage eine Priorität zu (P1 = kritisch, P2 = wichtig, P3 = optional)
4. Gib an, welche KI(s) diese Frage gestellt haben

OUTPUT FORMAT (JSON):
[
  {
    "question": "Die deduplizierte Frage",
    "priority": "P1|P2|P3",
    "sources": ["ChatGPT", "Claude", "Gemini"],
    "reason": "Kurze Begründung"
  }
]

Antworte NUR mit dem JSON-Array, ohne zusätzlichen Text.
`;
  
  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { 
      temperature: 0.2,
      responseMimeType: "application/json"
    }
  };
  
  const response = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  
  const result = JSON.parse(response.getContentText());
  
  if (result.error) {
    return errorResponse(result.error.message);
  }
  
  const synthesisText = result.candidates[0].content.parts[0].text;
  const questions = JSON.parse(synthesisText);
  
  return successResponse({ questions: questions });
}
```

### handleSynthesize

```javascript
function handleSynthesize(data) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent?key=${apiKey}`;
  
  const prompt = `
Du bist ein erfahrener Strategieberater. Drei KI-Assistenten haben unabhängig voneinander Lösungen für folgendes Problem erarbeitet:

[PROBLEM]
${data.problem}
[/PROBLEM]

[CHATGPT_LÖSUNG]
${data.solutions.chatgpt}
[/CHATGPT_LÖSUNG]

[CLAUDE_LÖSUNG]
${data.solutions.claude}
[/CLAUDE_LÖSUNG]

[GEMINI_LÖSUNG]
${data.solutions.gemini}
[/GEMINI_LÖSUNG]

AUFGABE:
Erstelle eine synthetisierte Master-Lösung, die die stärksten Punkte aller drei KIs kombiniert.

WICHTIG:
- Wenn alle drei KIs einen Punkt betonen, ist er besonders relevant
- Wenn nur eine KI einen Punkt erwähnt, prüfe kritisch ob er wertvoll ist
- Strukturiere die Lösung klar mit [SOLUTION], [ACTION_PLAN], [RISKS], [ASSUMPTIONS]
`;
  
  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.7 }
  };
  
  const response = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  
  const result = JSON.parse(response.getContentText());
  
  if (result.error) {
    return errorResponse(result.error.message);
  }
  
  const synthesisText = result.candidates[0].content.parts[0].text;
  return successResponse({ synthesis: synthesisText });
}
```

---

## 9. Frontend-Code (Wichtige Funktionen)

### formatMarkdown (robust)

```javascript
function formatMarkdown(input) {
  let text = '';
  if (typeof input === 'string') {
    text = input;
  } else if (input == null) {
    text = '';
  } else if (typeof input === 'number' || typeof input === 'boolean') {
    text = String(input);
  } else if (typeof input === 'object') {
    if (typeof input.synthesis === 'string') text = input.synthesis;
    else if (typeof input.text === 'string') text = input.text;
    else {
      try { text = JSON.stringify(input, null, 2); } catch { text = String(input); }
    }
  } else {
    text = String(input);
  }

  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  text = text
    .replace(/^###\s+(.+)$/gm, '<h4>$1</h4>')
    .replace(/^##\s+(.+)$/gm, '<h3>$1</h3>')
    .replace(/^#\s+(.+)$/gm, '<h2>$1</h2>');

  text = text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');

  text = text.replace(/`([^`]+)`/g, '<code>$1</code>');

  text = text
    .split(/\n{2,}/)
    .map(para => `<p>${para.replace(/\n/g, '<br>')}</p>`)
    .join('');

  return text;
}
```

### extractSynthesisText

```javascript
function extractSynthesisText(synthesis) {
  if (!synthesis) return 'Keine Synthese vorhanden';
  
  // Fall 1: Bereits ein String
  if (typeof synthesis === 'string') {
    try {
      const parsed = JSON.parse(synthesis);
      if (parsed.data && parsed.data.synthesis) {
        return parsed.data.synthesis;
      }
      if (parsed.synthesis) {
        return parsed.synthesis;
      }
    } catch (e) {
      // Kein JSON, direkt zurückgeben
      return synthesis;
    }
    return synthesis;
  }
  
  // Fall 2: Objekt mit data.synthesis
  if (typeof synthesis === 'object') {
    if (synthesis.data && synthesis.data.synthesis) {
      return synthesis.data.synthesis;
    }
    if (synthesis.synthesis) {
      return synthesis.synthesis;
    }
    if (synthesis.text) {
      return synthesis.text;
    }
    return JSON.stringify(synthesis, null, 2);
  }
  
  return String(synthesis);
}
```

### makeTitleSlug

```javascript
function makeTitleSlug(title) {
  const t = (title || '').trim() || 'Session';
  const map = { ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' };

  const slug = t
    .toLowerCase()
    .replace(/[äöüß]/g, m => map[m] || m)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 40);

  return slug || 'session';
}
```

### markdownToPlainText

```javascript
function markdownToPlainText(md) {
  if (typeof md !== 'string') md = md == null ? '' : String(md);

  let s = md.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Headings entfernen
  s = s.replace(/^\s{0,3}#{1,6}\s+/gm, '');

  // Bold/italic/code markers entfernen
  s = s.replace(/\*\*(.+?)\*\*/g, '$1');
  s = s.replace(/\*(.+?)\*/g, '$1');
  s = s.replace(/`([^`]+)`/g, '$1');

  // Listen konvertieren
  s = s.replace(/^\s*[-•]\s+/gm, '- ');
  s = s.replace(/^\s*(\d+)\.\s+/gm, '$1) ');

  // Mehrfache Leerzeilen reduzieren
  s = s.replace(/\n{3,}/g, '\n\n').trim();

  return s;
}
```

### openAsEmail

```javascript
function openAsEmail() {
  const title = document.getElementById('sessionTitle')?.value?.trim() || 'KI-Cockpit Session';

  const date = new Date();
  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

  const subject = `KI-Cockpit – ${title} – ${dateStr}`;

  const md = window.currentSynthesis || '';
  const plainText = markdownToPlainText(md);

  const MAX_MAILTO_BODY = 8000;
  const safeBody = plainText.length > MAX_MAILTO_BODY
    ? plainText.substring(0, MAX_MAILTO_BODY) + '\n\n(Text gekürzt - bitte im Cockpit kopieren)'
    : plainText;

  const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(safeBody)}`;
  window.location.href = mailto;
}
```

### generateSessionMarkdown

```javascript
function generateSessionMarkdown(session) {
  const data = session.data || session;
  
  const title = data.name || data.title || data.titleSlug || 'Session';
  const date = new Date(data.createdAt || Date.now()).toLocaleDateString('de-DE');
  const problem = data.problem || 'Kein Problem';
  
  // Synthese extrahieren
  let synthesisText = extractSynthesisText(data.synthesis);
  
  let md = `# ${title}\n`;
  md += `**Datum:** ${date}\n\n`;
  md += `---\n\n`;
  
  md += `## 📋 Problemstellung\n\n${problem}\n\n`;
  
  md += `## ❓ Fragen & Antworten\n\n`;
  const questions = data.deduplicatedQuestions || [];
  const answers = data.answers || [];
  
  if (questions.length > 0) {
    questions.forEach((q, i) => {
      const questionText = typeof q === 'string' ? q : (q.question || 'Frage');
      const answer = answers[i] || '-';
      md += `### Frage ${i+1}\n`;
      md += `**${questionText}**\n\n`;
      md += `*Antwort:* ${answer}\n\n`;
    });
  }
  
  const phase2 = data.phase2Outputs || {};
  md += `## 🤖 KI-Lösungen\n\n`;
  md += `### ChatGPT\n${phase2.chatgpt || 'Nicht vorhanden'}\n\n`;
  md += `### Claude\n${phase2.claude || 'Nicht vorhanden'}\n\n`;
  md += `### Gemini\n${phase2.gemini || 'Nicht vorhanden'}\n\n`;
  
  md += `## 🎯 Synthese\n\n${synthesisText}\n\n`;
  
  md += `---\n*Exportiert aus KI-Cockpit*\n`;
  
  return md;
}
```

---

## 10. Versionsgeschichte

| Version | Datum | Änderungen |
|---------|-------|------------|
| V1.0 | 01.02.2026 | Initiale Version, Basis-Workflow |
| V1.1 | 01.02.2026 | GitHub Pages Deployment |
| V2.0 | 02.02.2026 | Session-Archiv, Export-Funktion, Synthese via Gemini |
| V2.1 | 02.02.2026 | Smart Deduplication via Gemini API |
| V2.2 | 02.02.2026 | Prompt-Templates V2 (gehärtet) |
| V2.3 | 02.02.2026 | Bug-Fixes: titleSlug, Session-Laden |
| V2.4 | 02.02.2026 | Bug-Fixes von Gemini (Backend) und ChatGPT (Frontend) |
| V2.5 | 02.02.2026 | Fix: title undefined, displayTitle, synthesis object |
| V2.6 | 02.02.2026 | UTF-8 Encoding, Synthese-Extraktion |
| V2.6.1 | 02.02.2026 | Finaler Fix: Synthese im Markdown-Export |

---

## 11. Bekannte Probleme und Lösungen

### Problem: Quota Exceeded (Gemini API)

**Symptom:** `RESOURCE_EXHAUSTED`, `limit: 0`

**Ursache:** Free-Tier-Limit erreicht oder Sandbox-Modus aktiv (EU/EEA)

**Lösung:**
1. Google Cloud Billing aktivieren (kostenloser Testzeitraum)
2. Projekt aus Sandbox-Modus befreien
3. Alternative: Modell wechseln (gemini-1.5-flash hat höheres Limit)

### Problem: Session-Daten nicht geladen

**Symptom:** Alle Felder zeigen "Nicht vorhanden"

**Ursache:** Verschachtelte Datenstruktur `{ action: "saveSession", data: {...} }`

**Lösung:** Immer `session.data || session` prüfen

### Problem: Synthese als JSON-String

**Symptom:** `{"status":"success","data":{"synthesis":"..."}}`

**Ursache:** Backend gibt verschachteltes Objekt zurück

**Lösung:** `extractSynthesisText()` Funktion verwenden

### Problem: Umlaute falsch kodiert

**Symptom:** `Ã¤` statt `ä`

**Ursache:** Fehlendes UTF-8 BOM im Export

**Lösung:** `const bom = '\uFEFF'; new Blob([bom + md], { type: 'text/markdown;charset=utf-8' })`

---

## 12. URLs und Zugangsdaten

### Öffentliche URLs

| Ressource | URL | Beschreibung |
|-----------|-----|--------------|
| **Live-App** | https://mousso74.github.io/ki-cockpit/ | Frontend (GitHub Pages) |
| **Repository** | https://github.com/mousso74/ki-cockpit | Quellcode |
| **Claude** | https://claude.ai/ | Lead-Architekt KI |
| **ChatGPT** | https://chat.openai.com/ | Frontend-Spezialist KI |
| **Gemini** | https://gemini.google.com/ | Backend-Spezialist KI |

### Entwicklungs-URLs

| Ressource | URL | Beschreibung |
|-----------|-----|--------------|
| **Google Apps Script** | https://script.google.com/ | Backend-Editor |
| **Google AI Studio** | https://aistudio.google.com/ | API-Key-Verwaltung |
| **Google Cloud Console** | https://console.cloud.google.com/ | Billing, Quota |

### ⚠️ SENSIBLE URLs (NICHT ÖFFENTLICH TEILEN)

| Ressource | URL | Sicherheitshinweis |
|-----------|-----|-------------------|
| **Backend V2.4** | `https://script.google.com/macros/s/AKfycbxK6GTY9xNBR3vmVF3aV-bd7RrU5IWxA7RDqXDuOQCfzZhM4ONz6RkLPVSMnj9aBYoq/exec` | ⚠️ Diese URL ermöglicht direkten Zugriff auf das Backend. Missbrauch könnte API-Kosten verursachen. |

### API-Keys

| Service | Speicherort | Hinweis |
|---------|-------------|---------|
| **Gemini API Key** | Google Apps Script → Projekteinstellungen → Script Properties → `GEMINI_API_KEY` | ⚠️ NIEMALS im Code hardcoden oder öffentlich teilen |

---

## Anhang: Checkliste für neue Entwickler/KIs

Falls eine andere KI dieses Projekt weiterentwickeln soll:

1. **Repository klonen:** `git clone https://github.com/mousso74/ki-cockpit.git`

2. **Claude Code installieren:** Via Anthropic-Dokumentation

3. **Backend verstehen:** 
   - Öffne https://script.google.com/
   - Suche nach "KI-Cockpit-Backend"
   - Prüfe die `doPost()` Funktion

4. **Wichtige Patterns:**
   - Daten sind oft verschachtelt: `data.data.field`
   - Synthese kann JSON-String sein: immer `extractSynthesisText()` nutzen
   - Prompts müssen "gehärtet" sein: keine Extra-Ausgabe außerhalb der definierten Blöcke

5. **Deployment-Workflow:**
   - Frontend: `git push` → GitHub Pages aktualisiert automatisch
   - Backend: Google Apps Script → Bereitstellen → Neue Bereitstellung

---

*Dokumentation erstellt am 02.02.2026 von Claude (Anthropic)*  
*Für Fragen: Kontext aus dieser README an eine neue KI übergeben*
