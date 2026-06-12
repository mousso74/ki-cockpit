# Asinito KI-Cockpit – Vollständige Technische Dokumentation

**Projektname:** Asinito KI-Cockpit  
**Aktuelle Version:** 5.0  
**Letztes Update:** Juni 2026  
**Eigentümer:** Armin (GitHub: mousso74)  
**Repository:** https://github.com/mousso74/ki-cockpit  
**Deployed Backend:** Google Apps Script V3.10.0  

---

## Inhaltsverzeichnis

1. [Projektübersicht & Zweck](#1-projektübersicht--zweck)
2. [Architektur](#2-architektur)
3. [Technologie-Stack](#3-technologie-stack)
4. [Dateistruktur](#4-dateistruktur)
5. [Feature 1: Fragen-Analyse (Standard)](#5-feature-1-fragen-analyse-standard)
6. [Feature 2: Cross-Over-Analyse (Erweitert)](#6-feature-2-cross-over-analyse-erweitert)
7. [Feature 3: LLM-Diskussion (Stufe 1 + Stufe 2)](#7-feature-3-llm-diskussion-stufe-1--stufe-2)
8. [Backend: Google Apps Script V3.10.0](#8-backend-google-apps-script-v3100)
9. [Archiv-System](#9-archiv-system)
10. [Prompt-Design](#10-prompt-design)
11. [Versionsgeschichte](#11-versionsgeschichte)
12. [Bekannte Eigenheiten & Lösungen](#12-bekannte-eigenheiten--lösungen)
13. [URLs & Zugangsdaten](#13-urls--zugangsdaten)

---

## 1. Projektübersicht & Zweck

Das Asinito KI-Cockpit ist eine Web-Applikation für strukturierte, multi-modell KI-Befragungen. Es löst ein konkretes Problem: Einzelne KI-Antworten sind von der Persönlichkeit und den Trainingsdaten des jeweiligen Modells geprägt. Das Cockpit nutzt mehrere Modelle parallel und synthetisiert deren Antworten, um blinde Punkte einzelner Modelle auszugleichen.

**Drei Betriebsmodi:**

| Modus | Geeignet für | KI-Modelle | Backend-Calls |
|---|---|---|---|
| Fragen-Analyse | Komplexe Problemstellungen, Recherche | 2–4 wählbar | `synthesize`, `deduplicateQuestions` |
| Cross-Over-Analyse | Tiefe Analyse mit Peer-Review | 2–4 wählbar | `synthesize` |
| LLM-Diskussion | Ermessens- & Entscheidungsfragen | Bis zu 5 fest | `analyzeDivergence`, `synthesizeDiscussion` |

**Wichtige Einschränkung der LLM-Diskussion:** Nur für Fragen geeignet, bei denen echte Meinungsverschiedenheiten zwischen Experten möglich sind (Strategie, Ethik, Prognosen). Für Faktenfragen ungeeignet — dort addiert das Verfahren nur Halluzinationsfläche.

---

## 2. Architektur

```
┌──────────────────────────────────────────────────────────────┐
│                        BENUTZER                               │
└──────────────────────────────────────────────────────────────┘
         │ öffnet browser                    │ kopiert/klebt Prompts
         ▼                                   ▼
┌─────────────────────┐           ┌──────────────────────────┐
│   GitHub Pages /    │           │  Externe KI-Modelle:     │
│   Lokaler Browser   │           │  ChatGPT / Claude /      │
│                     │           │  Gemini / Vibe /         │
│  index.html         │           │  DeepSeek                │
│  discussion.html    │           └──────────────────────────┘
│  extended.html      │
│  session.html       │
│  archiv.html        │
└──────────┬──────────┘
           │ fetch() POST/GET
           ▼
┌─────────────────────────────────────────────────────────────┐
│           Google Apps Script (Backend V3.10.0)               │
│                                                              │
│  doPost()  →  switch(action):                                │
│    saveSession / listSessions / getSession                   │
│    deleteSession / moveSession / renameSession               │
│    deleteProject / getProjects                               │
│    synthesize          <- Standard-Synthese                  │
│    deduplicateQuestions <- Fragen-Deduplizierung             │
│    analyzeDivergence   <- LLM-Diskussion Stufe 1            │
│    synthesizeDiscussion <- LLM-Diskussion Synthese           │
│                                                              │
│  callGemini() → Modell-Fallback-Kette:                       │
│    gemini-3.5-flash → gemini-3.1-flash-lite → gemini-2.5-flash│
└──────────┬──────────────────────────────────────────────────┘
           │ DriveApp
           ▼
┌─────────────────────────────────────────────────────────────┐
│           Google Drive (Archiv)                               │
│  KI-Cockpit-Archiv/                                          │
│    geschäftlich/                                             │
│      [Projekt]/                                              │
│        2026-06-12_14-30__projektname.json                    │
│    privat/                                                   │
│      [Projekt]/                                              │
│        ...                                                   │
└─────────────────────────────────────────────────────────────┘
```

**Kein direkter API-Zugriff auf KI-Modelle vom Frontend.** Der Benutzer kopiert Prompts manuell in die jeweiligen KI-Chats und klebt die Antworten zurück. Das Backend (GAS) nutzt nur Gemini für Analyse-Aufgaben (Deduplizierung, Divergenz, Synthese).

---

## 3. Technologie-Stack

| Schicht | Technologie | Details |
|---|---|---|
| Frontend | Vanilla HTML/CSS/JS | Keine Frameworks, keine Build-Tools |
| Backend | Google Apps Script | Deployed als Web App (doPost/doGet) |
| KI-Engine (Backend) | Google Gemini | Fallback-Kette: 3.5-flash → 3.1-flash-lite → 2.5-flash |
| Dateispeicher | Google Drive | JSON-Dateien in Ordnerhierarchie |
| Hosting | GitHub Pages oder lokal | Statische Dateien, kein Server nötig |
| Versionskontrolle | GitHub | github.com/mousso74/ki-cockpit |

---

## 4. Dateistruktur

```
ki-cockpit/
│
├── index.html              # Home: Problemdefinition, Template-Auswahl, Session-Start
├── discussion.html         # LLM-Diskussion (komplett eigenständig)
├── extended.html           # Cross-Over-Analyse (Erweitert)
├── session.html            # Aktive Session (Fragen-Analyse)
├── archiv.html             # Archiv-Ansicht aller gespeicherten Sessions
│
├── css/
│   ├── style.css           # Globales Stylesheet (alle Seiten außer extended/archiv)
│   ├── extended.css        # Zusatz-Styles für Cross-Over-Analyse
│   ├── session.css         # Zusatz-Styles für Session-Seite
│   └── archiv.css          # Styles für Archiv-Ansicht
│
├── js/
│   ├── storage.js          # BACKEND_URL, saveSession, loadSessions, loadProjects
│   ├── app.js              # Haupt-App-Logik (index.html, Standard-Flow)
│   ├── extended.js         # Cross-Over-Analyse Logik
│   ├── session.js          # Session-Detail-Ansicht
│   ├── archiv.js           # Archiv-Liste, Filter, Move, Delete, Rename
│   ├── parser.js           # Antwort-Parser für Standard-Format
│   ├── prompts.js          # Prompt-Builder für Standard/Cross-Over
│   │
│   ├── prompts_discussion.js   # Prompts + Parser für LLM-Diskussion:
│   │                           #   buildBiografPrompt, buildBroadcastPrompt
│   │                           #   buildCritiquePrompt, buildRevisionPrompt
│   │                           #   parsePosition, parseCritique, parseRevision
│   │
│   ├── storage_discussion.js   # Backend-Calls für LLM-Diskussion:
│   │                           #   analyzeDivergence(), synthesizeDiscussion()
│   │
│   └── app_discussion.js       # Vollständige State-Machine für LLM-Diskussion:
│                               #   D0 → D1 → D2 → D3 → D4 → D5 → D6
│
├── GAS_backend_v3.10_complete.js  # Aktuell deployter Backend-Code (GAS)
├── GAS_backend_v3.8_complete.js   # Vorgänger-Version (Referenz)
├── GAS_backend_v3.7_complete.js   # Ältere Version
├── GAS_moveSession_snippet.txt    # Code-Snippet für moveSession
│
├── Asinito-Logo.png
├── Asinito-Logo.jpg
└── KI-COCKPIT_README.md    # Diese Datei
```

---

## 5. Feature 1: Fragen-Analyse (Standard)

**Einstieg:** `index.html` → Template "Fragen-Analyse"

### Flow (6 States, verwaltet in `app.js`)

```
State 0: Problemdefinition
  → Benutzer beschreibt Problem, wählt Kategorie/Projekt, wählt 2–4 KI-Modelle

State 1: Rückfragen
  → Prompt für jede ausgewählte KI generiert → Benutzer klebt Antworten ein
  → Backend: deduplicateQuestions (Gemini reduziert 20–30 Fragen auf 10–15)

State 2: Fragen beantworten
  → Deduplizierte Fragen werden angezeigt, Benutzer gibt Antworten ein

State 3: Lösungen
  → Prompt mit Kontext+Antworten für jede KI → Benutzer klebt Lösungen ein

State 4: Synthese
  → Backend: synthesize (Gemini fasst alle Lösungen zusammen)

State 5: Archivierung
  → Backend: saveSession (speichert JSON in Google Drive)
```

---

## 6. Feature 2: Cross-Over-Analyse (Erweitert)

**Einstieg:** `index.html` → Template "Cross-Over-Analyse" → `extended.html`

### Flow (9 States, verwaltet in `extended.js`)

Wie Fragen-Analyse, aber nach State 3 (Lösungen Runde 1):

```
State 4: Cross-Review
  → Jede KI bewertet die Antworten ALLER anderen KIs
  → Prompt enthält alle Runde-1-Lösungen + Aufforderung zur Peer-Bewertung

State 5: Lösungen Runde 2
  → Jede KI überarbeitet ihre eigene Antwort auf Basis der Peer-Kritik

State 6: Finale Synthese
  → Gemini synthetisiert die überarbeiteten Lösungen

State 7: Archivierung
```

---

## 7. Feature 3: LLM-Diskussion (Stufe 1 + Stufe 2)

**Einstieg:** `discussion.html` (direkt oder über Home-Kachel "LLM-Diskussion")

### Konzept

Speziell für **Ermessens- und Entscheidungsfragen**. Fünf Modelle nehmen strukturierte Positionen ein, die paarweise auf Divergenz analysiert werden. Bei ausreichend Divergenz folgt eine echte Debatte (Stufe 2): Kreuzkritik und Revision. Das Ergebnis ist eine gewichtete Entscheidungsvorlage — kein einfacher Konsens.

### State-Machine (7 States in `app_discussion.js`)

```
D0: Eingabe
  → Entscheidungsfrage eingeben, Kategorie/Projekt, Biograf-Modell wählen
  → [Dossier anfordern] → D1

D1: Dossier-Gate (Kontext-Absicherung)
  → Biograf-Prompt wird generiert (für das gewählte Modell)
  → Benutzer führt Prompt im gewählten Modell aus
  → Antwort einfügen, sensible Daten entfernen (Gate-Funktion)
  → [Freigeben & Broadcast starten] → D2

D2: Broadcast (alle 5 Modelle)
  → Ein einziger strukturierter Prompt für alle 5 Modelle:
    ChatGPT, Claude, Vibe, Gemini, DeepSeek
  → Jedes Modell gibt eine [POSITION] zurück mit:
    KERNTHESE, BEGRUENDUNG, ANNAHMEN, RISIKEN, KONFIDENZ (0-100), UMSTIMMBAR_DURCH
  → Mind. 3 Antworten nötig
  → [Antworten auswerten] → ruft analyzeDivergence auf → D3

D3: Divergenz-Analyse
  → Heatmap: paarweise Scores 0–10 (0=identisch, 10=unvereinbar)
  → Konfliktliste sortiert nach Score mit Kernkonflikt-Beschreibung
  → Auswahl der 2–3 divergentesten Positionen (für Debatte)
  → Zwei Optionen:
    [Debatte starten (Stufe 2)] → D4   (sichtbar bei Divergenz > Schwellwert 4)
    [Direkt zur Synthese (Stufe 1)] → D6  (immer sichtbar)

D4: Kreuzkritik (Stufe 2) — NEU in V5.0
  → Für jedes ausgewählte Modell: Kritik-Prompt generiert
  → Jedes Modell kritisiert die Positionen der anderen
  → Format der Antwort: [KRITIK] AN_P2: ... AN_P3: ... [/KRITIK]
  → [Kritiken auswerten → Revision] → D5

D5: Revision (Stufe 2) — NEU in V5.0
  → Für jedes kritisierte Modell: Revisions-Prompt mit empfangenen Kritiken
  → Format der Antwort:
    [REVISION]
    KERNTHESE_NEU / BEGRUENDUNG_NEU / KONZESSIONEN / HALTUNG / KONFIDENZ_NEU
    [/REVISION]
  → [Revisionen auswerten → Synthese] → ruft synthesizeDiscussion auf → D6

D6: Entscheidungsvorlage
  → Strukturierte Synthese:
    ## 1. Konsens
    ## 2. Strittige Punkte
    ## 3. Restunsicherheit
    ## 4. Empfehlung (mit Konfidenz + "Was würde uns umstimmen")
  → Stufe-2-Gewichtung: Revidierte Positionen werden in Synthese priorisiert
  → Erfolgsmetrik: Hat die Diskussion einen neuen Gesichtspunkt geliefert? (Ja/Nein)
  → [In Archiv speichern] / [Als Markdown exportieren] / [Neue Diskussion]
```

### State-Dots
7 Punkte in der Header-Navigation entsprechen D0–D6.  
Aktiver Dot = orange, abgeschlossene = grün, ausstehende = grau.

### Schlüsseldateien für LLM-Diskussion

#### `js/prompts_discussion.js`

| Funktion | Beschreibung |
|---|---|
| `DISCUSSION_MODELS` | `['ChatGPT', 'Claude', 'Vibe', 'Gemini', 'DeepSeek']` |
| `buildBiografPrompt(frage)` | D1: Prompt für Kontext-Dossier (anonymisiert, max. 600 Wörter) |
| `buildBroadcastPrompt(frage, dossier)` | D2: Strukturierter [POSITION]-Prompt für alle 5 Modelle |
| `parsePosition(raw)` | D2: Parst [POSITION]...[/POSITION]-Block → `{ok, fields}` |
| `buildCritiquePrompt(kritikerPos, ziele[])` | D4: Prompt für Kreuzkritik |
| `parseCritique(raw, zielIds[])` | D4: Parst [KRITIK] AN_Px: ...-Blöcke → `{ok, kritiken[]}` |
| `buildRevisionPrompt(eigenePos, kritiken[])` | D5: Prompt für Positions-Revision |
| `parseRevision(raw)` | D5: Parst [REVISION]...[/REVISION]-Block → `{ok, fields}` |

#### `js/storage_discussion.js`

| Funktion | Backend-Action |
|---|---|
| `analyzeDivergence(positions, threshold)` | `POST analyzeDivergence` |
| `synthesizeDiscussion(payload)` | `POST synthesizeDiscussion` |
| `postAction(action, payload)` | Generischer POST-Helper |

#### `js/app_discussion.js`

| Funktion | State-Übergang |
|---|---|
| `discussionStart()` | D0 → D1 |
| `discussionUseDossier(selfTyped)` | D1 → D2 |
| `discussionCollectAnswers()` | D2 → (async analyzeDivergence) → D3 |
| `discussionStartDebate()` | D3 → D4 |
| `discussionCollectCritiques()` | D4 → D5 |
| `discussionCollectRevisions()` | D5 → (async synthesizeDiscussion) → D6 |
| `discussionRunSynthesis()` | D3 oder D5 → D6 (mit/ohne Debatte-Daten) |
| `discussionSave()` | Speichert Session inkl. kritiken + revisionen |
| `discussionExportMarkdown()` | Download als .md-Datei |
| `discussionReset()` | Setzt alles zurück → D0 |

### Gespeichertes Session-Format (discussion)

```json
{
  "id": "sess_xyz",
  "sessionType": "discussion",
  "category": "geschäftlich",
  "project": "Immobilien",
  "name": "Sollen wir Projekt X als Bauträger...",
  "titleSlug": "sollen-wir-projekt-x-als-bautraeger",
  "createdAt": "2026-06-12T14:30:00Z",
  "frage": "...",
  "biografModell": "ChatGPT",
  "dossier": "...",
  "antworten": {
    "ChatGPT": { "raw": "...", "fields": { "kernthese": "...", "konfidenz": 75 } }
  },
  "mapping": { "P1": "ChatGPT", "P2": "Claude", "P3": "Gemini" },
  "divergenz": {
    "pairs": [{ "a": "P1", "b": "P2", "score": 8, "konflikt": "..." }],
    "maxScore": 8, "threshold": 4, "converged": false, "auswahl": ["P1","P2"]
  },
  "auswahl": ["P1", "P2"],
  "auswahlModelle": ["ChatGPT", "Claude"],
  "kritiken": [{ "vonId": "P1", "anId": "P2", "text": "..." }],
  "revisionen": [{
    "posId": "P1", "modell": "ChatGPT",
    "fields": { "kernthese_neu": "...", "konfidenz_neu": 70 }
  }],
  "synthese": "...",
  "metrik": true
}
```

---

## 8. Backend: Google Apps Script V3.10.0

**Deployed URL:** Siehe `BACKEND_URL` in `js/storage.js`  
**Quelldatei:** `GAS_backend_v3.10_complete.js`

### Alle Actions

| Action | Methode | Beschreibung |
|---|---|---|
| `saveSession` | POST | JSON-Datei in Drive-Ordner anlegen |
| `listSessions` | GET/POST | Alle Sessions aus Drive laden |
| `getSession` | GET/POST | Einzelne Session per ID laden |
| `deleteSession` | POST | Session in Papierkorb |
| `moveSession` | POST | Session in anderen Kategorie/Projekt-Ordner verschieben |
| `renameSession` | POST | Name + Dateiname aktualisieren |
| `deleteProject` | POST | Leeren Projekt-Ordner löschen |
| `getProjects` | GET/POST | Projekt-Struktur aus Drive-Ordnern laden |
| `synthesize` | POST | Gemini synthetisiert Standard-Lösungen |
| `deduplicateQuestions` | POST | Gemini dedupliziert Rückfragen (20–30 → 10–15) |
| `analyzeDivergence` | POST | Gemini bewertet Positions-Paare 0–10 |
| `synthesizeDiscussion` | POST | Gemini erstellt strukturierte Entscheidungsvorlage |

### Gemini-Fallback-Kette

```javascript
MODELS: ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-2.5-flash"]
RETRIES_PER_MODEL: 2
```

Bei HTTP 503 / "high demand" wechselt `callGemini()` automatisch zum nächsten Modell.  
Bei HTTP 404 (Modell abgekündigt) → nächstes Modell.  
Bei HTTP 400/403 → sofortiger Abbruch (Request- oder API-Key-Problem).

### analyzeDivergence

- Empfängt N anonyme Positionen (P1, P2, ...) mit KERNTHESE + BEGRUENDUNG
- Bewertet jedes ungeordnete Paar: `{"a":"P1","b":"P2","score":7,"konflikt":"..."}`
- Score 0 = identisch, 10 = unvereinbar; Stil/Wortwahl zählt NICHT
- Auswahl der divergentesten Modelle via Score-Summe (Divergenz-Zentralität)
- Liefert: `{ pairs, maxScore, threshold, converged, auswahl }`

### synthesizeDiscussion

Erwartet: `{ problem, positions[], kritiken[], revisionen[], converged }`  
Gewichtungsregel: Argumente, die Kritik und Revision überstanden haben, zählen mehr.  
Bei `converged: true`: Expliziter Hinweis auf schwache Evidenz in der Synthese.  
Ausgabestruktur: `[SYNTHESE] ## 1. Konsens / ## 2. Strittige Punkte / ## 3. Restunsicherheit / ## 4. Empfehlung [/SYNTHESE]`

---

## 9. Archiv-System

**Ordnerstruktur in Google Drive:**
```
KI-Cockpit-Archiv/
  geschäftlich/
    Allgemein/
    [Projektname]/
  privat/
    [Projektname]/
```

**Dateiformat:** `YYYY-MM-DD_HH-mm__slug.json`

`archiv.html` rendert alle Session-Typen:
- Standard-Session (Fragen-Analyse / Cross-Over): zeigt Problem + Synthese
- `sessionType: "discussion"`: zeigt Frage, Divergenz-Score, Synthese

---

## 10. Prompt-Design

### Broadcast-Prompt (D2)

Strikt strukturiert, Modell darf NUR den [POSITION]-Block ausgeben:
```
[POSITION]
KERNTHESE: <ein Satz>
BEGRUENDUNG: <max. 800 Wörter>
ANNAHMEN: <Aufzählung>
RISIKEN: <Aufzählung>
KONFIDENZ: <0-100>
UMSTIMMBAR_DURCH: <was würde diese Position kippen?>
[/POSITION]
```

### Kritik-Prompt (D4)

Gibt Modell seine eigene Position + alle Gegenpositionen.  
Antwort-Format: `[KRITIK] AN_P2: <Kritik> AN_P3: <Kritik> [/KRITIK]`

### Revisions-Prompt (D5)

Gibt Modell seine ursprüngliche Position + alle empfangenen Kritiken.  
Antwort-Format:
```
[REVISION]
KERNTHESE_NEU: ...
BEGRUENDUNG_NEU: ...
KONZESSIONEN: ...
HALTUNG: ...
KONFIDENZ_NEU: <0-100>
[/REVISION]
```

### Parser-Robustheit (alle drei Parser)

1. Optionalen `[BLOCK]...[/BLOCK]`-Wrapper extrahieren (Modelle fügen oft Text davor/danach ein)
2. Schlüsselwörter per Regex finden, nach Position sortieren
3. Textbereiche zwischen Schlüsselwörtern extrahieren
4. Konfidenz-Felder defensiv zu Integer parsen (`parseInt` + `clamp(0,100)`)

---

## 11. Versionsgeschichte

| Version | Datum | Was ist neu |
|---|---|---|
| **V5.0** | Juni 2026 | **LLM-Diskussion Stufe 2**: D4 Kreuzkritik, D5 Revision, 7 State-Dots. Neue Funktionen: `discussionStartDebate`, `discussionCollectCritiques`, `discussionCollectRevisions`. Neue Prompts: `buildCritiquePrompt`, `buildRevisionPrompt`. Neue Parser: `parseCritique`, `parseRevision`. Revisionen fließen in Synthese ein (revidierte Kernthese/Konfidenz ersetzt Original). |
| **V4.0** | Mai 2026 | LLM-Diskussion Stufe 1 komplett: D0 Eingabe, D1 Dossier-Gate, D2 Broadcast (5 Modelle), D3 Divergenz-Heatmap + Direkt-Synthese. Neue Dateien: `discussion.html`, `app_discussion.js`, `prompts_discussion.js`, `storage_discussion.js`. |
| **V3.10** | Mai 2026 | Backend: `analyzeDivergence` + `synthesizeDiscussion` Actions. Gemini-Fallback-Kette (3.5-flash → 3.1-flash-lite → 2.5-flash). `buildDivergencePrompt`, `buildDiscussionSynthesisPrompt`, `selectMostDivergent`, `clampScore`. |
| **V3.9** | April 2026 | Modellwechsel gemini-2.5 → gemini-3.5-flash (2.5 abgekündigt, Shutdown 16.10.2026). Zentraler `callGemini()` mit Retry + exponentiellem Backoff. `extractGeminiText()` Multi-Part-sicher. |
| **V3.8** | März 2026 | `renameSession` Action. `handleListSessions` liest `name` aus JSON-Inhalt (korrekt nach Umbenennung). |
| **V3.7** | März 2026 | `moveSession` Action: verschiebt Drive-Datei + aktualisiert JSON-Felder `category`/`project`. |
| **V3.6** | Februar 2026 | `deleteProject` Action (nur leere Ordner). |
| **V3.5** | Februar 2026 | Cross-Over-Analyse (`extended.html`) mit dynamischer KI-Auswahl 2–4 Modelle. |
| **V3.0** | Februar 2026 | Google Drive Archiv, Kategorie/Projekt-Ordnerstruktur, `getProjects`. |
| **V2.0** | Februar 2026 | DeepSeek als 4. KI, dynamisches Cross-Review für 2–4 KIs. |
| **V1.0** | Februar 2026 | Initiale Version: ChatGPT, Claude, Gemini — Fragen-Analyse (6 States). |

---

## 12. Bekannte Eigenheiten & Lösungen

### GAS Cold Start (30–60 Sekunden)
Bei ersten Anfragen nach längerer Inaktivität braucht Google Apps Script bis zu 60 Sekunden. Betrifft vor allem `analyzeDivergence` und `synthesizeDiscussion`. Kein Bug — normales GAS-Verhalten. Das Frontend zeigt Toast-Meldungen während der Call läuft.

### Gemini "Chatty" Responses
Gemini 3.x fügt trotz "nur JSON"-Instruktion gelegentlich Text vor/nach dem JSON-Array ein. Das Backend löst das mit `rawText.match(/\[\s*\{[\s\S]*\}\s*\]/)` — dasselbe Muster wie bei `deduplicateQuestions`.

### Modell-Korrelations-Warnung
Die Synthese enthält einen expliziten Hinweis: Wenn alle Modelle zur selben Schlussfolgerung kommen (Konvergenz), ist das **schwache Evidenz** — korrelierte Trainingsdaten können zu falscher Einigkeit führen. Dieser Hinweis ist im `synthesizeDiscussion`-Prompt hartkodiert.

### Race Condition bei async Calls (nur Entwicklung)
Wenn man während des laufenden `analyzeDivergence`-Calls manuell State überschreibt, kann der später zurückkommende Call den State zurücksetzen. Im Live-Betrieb kein Problem — der Debatte-Button erscheint erst nach Abschluss des Calls.

### "Vibe" als Modell-Name
In `DISCUSSION_MODELS` als fünftes Modell eingetragen. Gemeint ist ein vom Nutzer verwendetes Tool (z.B. Perplexity AI oder ähnliches). Der Name kann in `prompts_discussion.js` angepasst werden.

---

## 13. URLs & Zugangsdaten

| Resource | Info |
|---|---|
| GitHub Repository | https://github.com/mousso74/ki-cockpit |
| Backend-URL | In `js/storage.js` als `BACKEND_URL` — aktuelle Deployment-URL |
| Google Drive Archiv | Im Google Account des Eigentümers unter "KI-Cockpit-Archiv" |

**Beim Redeployment des Backends (nach Code-Änderungen in GAS):**
1. Inhalt von `GAS_backend_v3.10_complete.js` in Google Apps Script einfügen
2. "Bereitstellen" → "Neue Bereitstellung" → Typ: Web-App → Zugriff: Jeder
3. Neue Deployment-URL in `js/storage.js` als `BACKEND_URL` eintragen
4. Commit + Push zu GitHub

**GEMINI_API_KEY:** Wird in den Google Apps Script Script Properties hinterlegt (nicht im Code). Key: `GEMINI_API_KEY`.
