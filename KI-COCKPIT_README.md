# Asinito KI-Cockpit V3.4.2 – Vollständige Technische Dokumentation

**Projektname:** Asinito KI-Cockpit (ehemals KI-Cockpit)
**Version:** 3.4.2
**Entwicklungszeitraum:** 1.–3. Februar 2026
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
6. [Google Drive Ordnerstruktur (V3.0+)](#6-google-drive-ordnerstruktur-v30)
7. [Workflow-Beschreibung](#7-workflow-beschreibung)
8. [Prompt-Templates](#8-prompt-templates)
9. [Backend-Code (Google Apps Script)](#9-backend-code-google-apps-script)
10. [Frontend-Code (Wichtige Funktionen)](#10-frontend-code-wichtige-funktionen)
11. [Versionsgeschichte](#11-versionsgeschichte)
12. [Bekannte Probleme und Lösungen](#12-bekannte-probleme-und-lösungen)
13. [URLs und Zugangsdaten](#13-urls-und-zugangsdaten)

---

## 1. Projektübersicht

Das KI-Cockpit ist eine Web-Applikation, die drei KI-Modelle (ChatGPT, Claude, Gemini) parallel befragt, um komplexe Probleme zu lösen. Der Workflow umfasst:

1. **Problemdefinition** durch den Benutzer
2. **Kategorie- und Projektauswahl** (geschäftlich/privat + Projektordner)
3. **Automatische Prompt-Generierung** für alle drei KIs
4. **Rückfragen-Sammlung** von allen drei KIs
5. **Intelligente Deduplizierung** der Fragen via Gemini API
6. **Beantwortung** der deduplizierten Fragen
7. **Lösungsgenerierung** durch alle drei KIs
8. **Synthese** der besten Lösung via Gemini API
9. **Archivierung** in Google Drive (hierarchische Ordnerstruktur)
10. **Export** als Markdown

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
│  │ archiv.html │  │ archiv.css  │  │ prompts.js   │              │
│  └─────────────┘  └─────────────┘  │ storage.js   │              │
│                                     │ archiv.js    │              │
│                                     └─────────────┘              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ fetch() Requests
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                 BACKEND (Google Apps Script)                     │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  doPost() → Router                                       │    │
│  │    ├── handleSaveSession()      → Drive-Speicherung      │    │
│  │    ├── handleListSessions()     → Session-Liste          │    │
│  │    ├── handleGetSession()       → Session abrufen        │    │
│  │    ├── handleGetProjects()      → Projekt-Liste (V3.0)   │    │
│  │    ├── handleDeleteSession()    → Soft-Delete (V3.0)     │    │
│  │    ├── handleSynthesize()       → Gemini-Synthese        │    │
│  │    ├── handleDeduplicateQuestions() → Gemini-Dedupe      │    │
│  │    └── handleSaveExport()       → Export speichern       │    │
│  │                                                          │    │
│  │  doGet() → Router (V3.0: alle via outputJSON())          │    │
│  │    ├── listSessions                                      │    │
│  │    ├── getSession                                        │    │
│  │    └── getProjects (V3.0)                                │    │
│  └──────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
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
│  │    ├── geschäftlich/                                     │    │
│  │    │     ├── Projekt-Alpha/                              │    │
│  │    │     │     └── 2026-02-03_14-30__meeting-notes.json │    │
│  │    │     └── Kunde-XYZ/                                  │    │
│  │    │           └── 2026-02-03_16-45__anfrage.json       │    │
│  │    ├── privat/                                           │    │
│  │    │     ├── Gesundheit/                                 │    │
│  │    │     │     └── 2026-02-02_18-35__diagnose.json      │    │
│  │    │     └── Hobby/                                      │    │
│  │    │           └── 2026-02-03_09-15__recherche.json     │    │
│  │    ├── Papierkorb/                                       │    │
│  │    │     └── [gelöschte Sessions]                        │    │
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

---

## 4. Technologie-Stack

| Komponente | Technologie | Beschreibung |
|------------|-------------|--------------|
| Frontend-Hosting | GitHub Pages | Statisches Hosting, kostenlos |
| Frontend-Sprache | Vanilla JavaScript | Kein Framework, direkte DOM-Manipulation |
| Styling | CSS3 | Light Theme (Asinito CI), responsive |
| Backend | Google Apps Script | Serverless, kostenlos |
| Datenbank | Google Drive | JSON-Dateien in hierarchischer Ordnerstruktur |
| AI-Engine | Gemini API | gemini-3-pro-preview |
| Versionskontrolle | Git/GitHub | Repository: mousso74/ki-cockpit |
| Entwicklungstool | Claude Code | CLI-basierte Entwicklung |

---

## 5. Dateistruktur

```
ki-cockpit/
├── index.html              # Hauptseite mit State-Machine
├── archiv.html             # Archiv-Übersicht (V3.0)
├── css/
│   ├── style.css           # Dark Theme Styling (Hauptseite)
│   └── archiv.css          # Archiv-Styling (V3.0)
├── js/
│   ├── app.js              # Hauptlogik, State-Management
│   ├── prompts.js          # Prompt-Templates (Questions, Solve)
│   ├── storage.js          # API-Kommunikation mit Backend
│   └── archiv.js           # Archiv-Logik (V3.0)
└── KI-COCKPIT_README.md    # Projekt-Dokumentation
```

---

## 6. Google Drive Ordnerstruktur (V3.0+)

Ab Version 3.0 werden Sessions in einer hierarchischen Ordnerstruktur gespeichert:

```
KI-Cockpit-Archiv/
├── geschäftlich/           # Kategorie
│   ├── Projekt-Alpha/      # Projekt (dynamisch erstellt)
│   │   ├── 2026-02-03_14-30__meeting-notes.json
│   │   └── 2026-02-03_15-45__strategie.json
│   └── Kunde-XYZ/
│       └── 2026-02-03_16-45__anfrage.json
├── privat/                 # Kategorie
│   ├── Gesundheit/         # Projekt
│   │   └── 2026-02-02_18-35__diagnose.json
│   └── Allgemein/
│       └── 2026-02-03_09-15__recherche.json
├── Papierkorb/             # Soft-Delete (V3.0)
│   └── [gelöschte Sessions mit originalem Pfad im Dateinamen]
└── Export/
    └── [PDF/MD Exporte]
```

### Kategorie- und Projektauswahl (Frontend)

Die Hauptseite (index.html) enthält:
- **Kategorie-Dropdown:** geschäftlich / privat
- **Projekt-Dropdown:** Dynamisch geladen via `getProjects` API
- **Neues Projekt erstellen:** Inline-Eingabefeld

---

## 7. Workflow-Beschreibung

### State-Machine (6 Zustände)

```
State 0: PROBLEM_INPUT (+ Kategorie/Projekt-Auswahl)
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

**Lösung (V2+):** Gemini API (semantisch)
- Ergebnis: 5-8 präzise, deduplizierte Fragen

**V3.0+ Fix:** Robuste JSON-Extraktion für "chatty" Gemini 3 Modelle:
```javascript
// Regex-Extraktion für JSON-Arrays aus Gemini-Output
const jsonMatch = rawText.match(/\[\s*\{[\s\S]*\}\s*\]/);
if (jsonMatch) {
  questions = JSON.parse(jsonMatch[0]);
}
```

---

## 8. Prompt-Templates

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

---

## 9. Backend-Code (Google Apps Script)

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
      case 'getProjects':
        result = handleGetProjects(data.category);
        break;
      case 'deleteSession':
        result = handleDeleteSession(data.id);
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

    return outputJSON(result);

  } catch (error) {
    return outputJSON({
      status: 'error',
      message: error.toString()
    });
  }
}
```

### doGet (V3.0: CORS-Fix mit outputJSON)

```javascript
function doGet(e) {
  try {
    const action = e.parameter.action;

    switch(action) {
      case 'listSessions':
        return outputJSON(handleListSessions());
      case 'getSession':
        return outputJSON(handleGetSession(e.parameter.id));
      case 'getProjects':
        return outputJSON(handleGetProjects(e.parameter.category));
      default:
        return outputJSON(errorResponse('Unknown action'));
    }
  } catch (error) {
    return outputJSON({ status: 'error', message: error.toString() });
  }
}
```

### outputJSON Helper (V3.0 CORS-Fix)

```javascript
function outputJSON(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
```

### handleGetProjects (V3.0)

```javascript
function handleGetProjects(category) {
  const rootFolder = getOrCreateFolder(SETTINGS.ROOT_FOLDER_NAME);
  const catFolder = getOrCreateFolder(category, rootFolder);

  const projects = [];
  const folders = catFolder.getFolders();

  while (folders.hasNext()) {
    const folder = folders.next();
    const name = folder.getName();
    if (name !== 'Export' && name !== 'Papierkorb') {
      projects.push(name);
    }
  }

  projects.sort();
  return successResponse({ projects: projects });
}
```

### handleDeleteSession (V3.0 Soft-Delete)

```javascript
function handleDeleteSession(fileId) {
  const rootFolder = getOrCreateFolder(SETTINGS.ROOT_FOLDER_NAME);
  const trashFolder = getOrCreateFolder('Papierkorb', rootFolder);

  const file = DriveApp.getFileById(fileId);
  const originalName = file.getName();
  const parents = file.getParents();

  let originalPath = '';
  if (parents.hasNext()) {
    const parent = parents.next();
    const grandparents = parent.getParents();
    if (grandparents.hasNext()) {
      originalPath = grandparents.next().getName() + '_' + parent.getName() + '_';
    }
  }

  // Verschieben statt löschen
  file.moveTo(trashFolder);
  file.setName(originalPath + originalName);

  return successResponse({ message: 'Session in Papierkorb verschoben' });
}
```

### handleSaveSession (V3.0: mit Kategorie/Projekt)

```javascript
function handleSaveSession(payload) {
  const rootFolder = getOrCreateFolder(SETTINGS.ROOT_FOLDER_NAME);

  const sessionContent = payload.data || {};

  // V3.0: Kategorie und Projekt aus Session-Daten
  const category = sessionContent.category || 'privat';
  const project = sessionContent.project || 'Allgemein';

  const catFolder = getOrCreateFolder(category, rootFolder);
  const projectFolder = getOrCreateFolder(project, catFolder);

  const timestamp = Utilities.formatDate(new Date(), "GMT+1", "yyyy-MM-dd_HH-mm");
  const slug = sessionContent.titleSlug || "session";
  const fileName = `${timestamp}__${slug}.json`;

  const file = projectFolder.createFile(
    fileName,
    JSON.stringify(sessionContent, null, 2),
    MimeType.PLAIN_TEXT
  );

  return successResponse({
    id: file.getId(),
    name: fileName,
    slug: slug,
    category: category,
    project: project
  });
}
```

### handleDeduplicateQuestions (V3.0: Robuste JSON-Extraktion)

```javascript
function handleDeduplicateQuestions(data) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent?key=${apiKey}`;

  const prompt = `
Du bist ein erfahrener Strategieberater. Vor dir liegen Listen von Rückfragen dreier KI-Assistenten zu folgendem Problem:

[ORIGINAL_PROBLEM]
${data.originalProblem}
[/ORIGINAL_PROBLEM]

[CHATGPT_QUESTIONS]
${(data.questions.chatgpt || []).join('\n')}
[/CHATGPT_QUESTIONS]

[CLAUDE_QUESTIONS]
${(data.questions.claude || []).join('\n')}
[/CLAUDE_QUESTIONS]

[GEMINI_QUESTIONS]
${(data.questions.gemini || []).join('\n')}
[/GEMINI_QUESTIONS]

AUFGABE:
1. Identifiziere semantisch gleiche oder sehr ähnliche Fragen
2. Wähle die präziseste Formulierung oder kombiniere zu einer besseren Frage
3. Weise jeder Frage eine Priorität zu (P1 = kritisch, P2 = wichtig, P3 = optional)
4. Gib an, welche KI(s) diese Frage gestellt haben

WICHTIG: Antworte NUR mit einem JSON-Array, KEIN Text davor oder danach!

[OUTPUT]
[
  {
    "question": "Die deduplizierte Frage",
    "priority": "P1|P2|P3",
    "sources": ["ChatGPT", "Claude", "Gemini"],
    "reason": "Kurze Begründung"
  }
]
[/OUTPUT]
`;

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.2
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

  const rawText = result.candidates[0].content.parts[0].text;

  // V3.0: Robuste JSON-Extraktion für "chatty" Gemini 3 Modelle
  let questions;
  try {
    questions = JSON.parse(rawText);
  } catch (e) {
    // Versuche JSON-Array aus Text zu extrahieren
    const jsonMatch = rawText.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (jsonMatch) {
      questions = JSON.parse(jsonMatch[0]);
    } else {
      return errorResponse('Could not parse Gemini response: ' + rawText.substring(0, 200));
    }
  }

  return successResponse({ questions: questions });
}
```

### handleSynthesize (V3.0: Null-Checks + explizite Tags)

```javascript
function handleSynthesize(data) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent?key=${apiKey}`;

  // V3.0: Null-safe Zugriff auf solutions
  const solutions = data.solutions || {};

  const prompt = `
Du bist ein erfahrener Strategieberater. Drei KI-Assistenten haben unabhängig voneinander Lösungen für folgendes Problem erarbeitet:

[PROBLEM]
${data.problem || 'Kein Problem angegeben'}
[/PROBLEM]

[CHATGPT_LÖSUNG]
${solutions.chatgpt || 'Keine Lösung von ChatGPT'}
[/CHATGPT_LÖSUNG]

[CLAUDE_LÖSUNG]
${solutions.claude || 'Keine Lösung von Claude'}
[/CLAUDE_LÖSUNG]

[GEMINI_LÖSUNG]
${solutions.gemini || 'Keine Lösung von Gemini'}
[/GEMINI_LÖSUNG]

AUFGABE:
Erstelle eine synthetisierte Master-Lösung, die die stärksten Punkte aller drei KIs kombiniert.

WICHTIG:
- Wenn alle drei KIs einen Punkt betonen, ist er besonders relevant
- Wenn nur eine KI einen Punkt erwähnt, prüfe kritisch ob er wertvoll ist
- Strukturiere die Lösung klar mit [SOLUTION], [ACTION_PLAN], [RISKS], [ASSUMPTIONS]
- Antworte auf Deutsch
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

## 10. Frontend-Code (Wichtige Funktionen)

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

### loadProjects (V3.0)

```javascript
async function loadProjects(category) {
  try {
    const response = await fetch(`${BACKEND_URL}?action=getProjects&category=${category}`);
    const result = await response.json();

    if (result.status === 'success') {
      return result.data.projects || [];
    }
    return [];
  } catch (error) {
    console.error('Error loading projects:', error);
    return [];
  }
}
```

### updateProjectDropdown (V3.0)

```javascript
async function updateProjectDropdown() {
  const category = document.getElementById('categorySelect').value;
  const projectSelect = document.getElementById('projectSelect');

  projectSelect.innerHTML = '<option value="">Projekt wählen...</option>';

  const projects = await loadProjects(category);

  projects.forEach(project => {
    const option = document.createElement('option');
    option.value = project;
    option.textContent = project;
    projectSelect.appendChild(option);
  });

  // Option für neues Projekt
  const newOption = document.createElement('option');
  newOption.value = '__new__';
  newOption.textContent = '+ Neues Projekt erstellen';
  projectSelect.appendChild(newOption);
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

  md += `## Problemstellung\n\n${problem}\n\n`;

  md += `## Fragen & Antworten\n\n`;
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
  md += `## KI-Lösungen\n\n`;
  md += `### ChatGPT\n${phase2.chatgpt || 'Nicht vorhanden'}\n\n`;
  md += `### Claude\n${phase2.claude || 'Nicht vorhanden'}\n\n`;
  md += `### Gemini\n${phase2.gemini || 'Nicht vorhanden'}\n\n`;

  md += `## Synthese\n\n${synthesisText}\n\n`;

  md += `---\n*Exportiert aus KI-Cockpit*\n`;

  return md;
}
```

---

## 11. Versionsgeschichte

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
| **V3.0** | **03.02.2026** | **Neue Ordnerstruktur: geschäftlich/privat + Projekte** |
| | | - Neue Backend-Funktionen: handleGetProjects(), handleDeleteSession() |
| | | - Modifiziert: handleSaveSession() (Kategorie/Projekt-Support) |
| | | - Modifiziert: handleListSessions() (alle Kategorien/Projekte durchsuchen) |
| | | - Neue Frontend-Dateien: archiv.html, css/archiv.css, js/archiv.js |
| | | - Kategorie- und Projekt-Auswahl auf Hauptseite |
| | | - Archiv-Link im Header |
| **V3.1** | **03.02.2026** | **Deduplizierung-Fix** |
| | | - Frontend sendete `{questions: [...]}`, Backend erwartete direkt Array |
| | | - Fix: `result.data.questions \|\| result.data` |
| **V3.2** | **03.02.2026** | **Synthese-Fix** |
| | | - Frontend sendete `data.responses`, Backend erwartete `data.solutions` |
| | | - Fix: Frontend sendet jetzt `solutions` statt `responses` |
| | | - Null-Checks in handleSynthesize() hinzugefügt |
| **V3.3** | **03.02.2026** | **CORS-Fix für doGet()** |
| | | - `errorResponse()` gab plain Object zurück statt ContentService |
| | | - Fix: Alle doGet()-Returns durch `outputJSON()` gewrappt |
| | | - Archiv-Seite kann jetzt Sessions laden |
| **V3.4** | **03.02.2026** | **Gemini 3 "Chatty" Output Fix** |
| | | - Gemini 3 pro preview fügt Text um JSON-Output hinzu |
| | | - Fix: Regex-Extraktion `rawText.match(/\[\s*\{[\s\S]*\}\s*\]/)` |
| | | - Explizite [OUTPUT]-Tags in Prompts |
| **V3.4.1** | **03.02.2026** | **Asinito Corporate Identity Redesign** |
| | | - Neues Branding: "Asinito" statt "KI-Cockpit" |
| | | - Light Theme mit Corporate Colors (#ff6b36 Orange, #ffffff Background) |
| | | - Inter Font Familie |
| | | - Neuer Header mit Asinito Logo und Navigation |
| | | - HTML-Struktur: Radio-Buttons → Select-Dropdowns für Kategorie/Projekt |
| | | - DOMContentLoaded Handler komplett überarbeitet |
| | | - generatePrompts() auf neue HTML-Struktur angepasst |
| | | - Cache-Busting mit ?v= Parametern eingeführt |
| **V3.4.2** | **03.02.2026** | **Project Dropdown Backend Response Fix** |
| | | - Backend gibt `{geschäftlich: [...], privat: [...]}` Format zurück |
| | | - updateProjectDropdown() korrigiert: `result.data[category]` statt `result.data.projects` |
| | | - Projekt-Dropdown lädt jetzt korrekt existierende Projekte |
| | | - Debug-Logging für Backend-Response hinzugefügt |

---

## 12. Bekannte Probleme und Lösungen

### Problem: Quota Exceeded (Gemini API)

**Symptom:** `RESOURCE_EXHAUSTED`, `limit: 0`

**Ursache:** Free-Tier-Limit erreicht oder Sandbox-Modus aktiv (EU/EEA)

**Lösung:**
1. Google Cloud Billing aktivieren (kostenloser Testzeitraum)
2. Projekt aus Sandbox-Modus befreien
3. Alternative: Modell wechseln (gemini-1.5-flash hat höheres Limit)

### Problem: forEach is not a function (V3.1)

**Symptom:** Fehler beim Verarbeiten der deduplizierten Fragen

**Ursache:** Backend gibt `{questions: [...]}` zurück, Frontend erwartet direktes Array

**Lösung:** `result.data.questions || result.data` verwenden

### Problem: Synthese erhält undefined solutions (V3.2)

**Symptom:** Backend-Log zeigt `undefined` für alle drei KI-Lösungen

**Ursache:** Frontend sendet `responses`, Backend erwartet `solutions`

**Lösung:** Frontend angepasst: `solutions: { chatgpt, claude, gemini }`

### Problem: CORS "Failed to fetch" im Archiv (V3.3)

**Symptom:** Archiv-Seite kann keine Sessions laden

**Ursache:** `errorResponse()` gibt plain Object zurück, nicht ContentService

**Lösung:** Alle doGet()-Returns durch `outputJSON()` wrappen

### Problem: Gemini 3 fügt Text um JSON hinzu (V3.4)

**Symptom:** `JSON.parse()` schlägt fehl, weil Output wie "Hier ist das JSON: [...]" aussieht

**Ursache:** Gemini 3 pro preview ist "chattier" als ältere Modelle

**Lösung:** Regex-Extraktion: `rawText.match(/\[\s*\{[\s\S]*\}\s*\]/)`

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

## 13. URLs und Zugangsdaten

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

### SENSIBLE URLs (NICHT ÖFFENTLICH TEILEN)

| Ressource | URL | Sicherheitshinweis |
|-----------|-----|-------------------|
| **Backend V3.4** | `https://script.google.com/macros/s/AKfycbzdUdWbgjp0wofYk2M1Ui8FcaB10awsrgTzojOWaJS9jAXWzopQUdFBDxd0bu9D9z8p/exec` | Diese URL ermöglicht direkten Zugriff auf das Backend. Missbrauch könnte API-Kosten verursachen. |

### API-Keys

| Service | Speicherort | Hinweis |
|---------|-------------|---------|
| **Gemini API Key** | Google Apps Script → Projekteinstellungen → Script Properties → `GEMINI_API_KEY` | NIEMALS im Code hardcoden oder öffentlich teilen |

---

## Anhang: Checkliste für neue Entwickler/KIs

Falls eine andere KI dieses Projekt weiterentwickeln soll:

1. **Repository klonen:** `git clone https://github.com/mousso74/ki-cockpit.git`

2. **Claude Code installieren:** Via Anthropic-Dokumentation

3. **Backend verstehen:**
   - Öffne https://script.google.com/
   - Suche nach "KI-Cockpit-Backend"
   - Prüfe die `doPost()` und `doGet()` Funktionen

4. **Wichtige Patterns:**
   - Daten sind oft verschachtelt: `data.data.field`
   - Synthese kann JSON-String sein: immer `extractSynthesisText()` nutzen
   - Prompts müssen "gehärtet" sein: keine Extra-Ausgabe außerhalb der definierten Blöcke
   - Gemini 3 ist "chatty": Regex-Extraktion für JSON verwenden

5. **Deployment-Workflow:**
   - Frontend: `git push` → GitHub Pages aktualisiert automatisch
   - Backend: Google Apps Script → Bereitstellen → Neue Bereitstellung

6. **V3.0+ Ordnerstruktur:**
   - Sessions werden in `KI-Cockpit-Archiv/{kategorie}/{projekt}/` gespeichert
   - Soft-Delete verschiebt in `Papierkorb/`
   - Export-Dateien in `Export/`

---

*Dokumentation erstellt am 02.02.2026, aktualisiert am 03.02.2026 von Claude (Anthropic)*
*Asinito Redesign und V3.4.2 Update am 03.02.2026*
*Für Fragen: Kontext aus dieser README an eine neue KI übergeben*
