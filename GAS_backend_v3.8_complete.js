/**
 * KI-Cockpit Backend V3.8
 * Engine: Gemini 2.5 Flash
 * Changelog V3.8: renameSession Action hinzugefügt
 *                 (ändert Titel in JSON-Inhalt + Dateinamen)
 */

const SETTINGS = {
  ROOT_FOLDER_NAME: 'KI-Cockpit-Archiv',
  CATEGORIES: ['geschäftlich', 'privat'],
  MODEL: "gemini-2.5-flash"
};

// === CORE: ROUTING ===

function doPost(e) {
  try {
    const data   = JSON.parse(e.postData.contents);
    const action = data.action;

    let result;
    switch(action) {
      case 'saveSession':          result = handleSaveSession(data);            break;
      case 'listSessions':         result = handleListSessions();               break;
      case 'getProjects':          result = handleGetProjects();                break;
      case 'getSession':           result = handleGetSession(data.id);          break;
      case 'deleteSession':        result = handleDeleteSession(data);          break;
      case 'moveSession':          result = handleMoveSession(data);            break;
      case 'deleteProject':        result = handleDeleteProject(data);          break;
      case 'renameSession':        result = handleRenameSession(data);          break;
      case 'synthesize':           result = handleSynthesize(data);             break;
      case 'deduplicateQuestions': result = handleDeduplicateQuestions(data);   break;
      default:                     result = errorResponse('Unknown action: ' + action);
    }

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify(errorResponse(error.toString())))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  try {
    if (!e || !e.parameter) return outputJSON(errorResponse('No parameters provided'));

    const action = e.parameter.action;

    if (action === 'listSessions') return outputJSON(handleListSessions());
    if (action === 'getProjects')  return outputJSON(handleGetProjects());

    if (action === 'getSession') {
      if (!e.parameter.id) return outputJSON(errorResponse('Missing id parameter'));
      return outputJSON(handleGetSession(e.parameter.id));
    }

    return outputJSON(errorResponse('Action not found: ' + action));

  } catch (error) {
    return outputJSON(errorResponse(error.toString()));
  }
}

// === DEDUPLICATION ===

function handleDeduplicateQuestions(data) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${SETTINGS.MODEL}:generateContent?key=${apiKey}`;

  const MAX_CONTEXT_LENGTH = 50000;
  let problemContext = data.originalProblem || "";
  if (problemContext.length > MAX_CONTEXT_LENGTH) {
    problemContext = problemContext.substring(0, MAX_CONTEXT_LENGTH) + "... [gekürzt]";
  }

  const chatgptQs = (data.questions.chatgpt || []).map((q, i) => ({ id: `C${i+1}`, text: q, source: "ChatGPT" }));
  const claudeQs  = (data.questions.claude  || []).map((q, i) => ({ id: `L${i+1}`, text: q, source: "Claude"  }));
  const geminiQs  = (data.questions.gemini  || []).map((q, i) => ({ id: `G${i+1}`, text: q, source: "Gemini"  }));
  const allQuestions = [...chatgptQs, ...claudeQs, ...geminiQs];
  const totalInput   = allQuestions.length;

  const prompt = `
Du bist Experte für die Analyse von Klärungsfragen. Drei KI-Assistenten haben zu einem Problem jeweils Rückfragen gestellt.

[PROBLEM KONTEXT]
${problemContext}
[/PROBLEM KONTEXT]

[EINGANGS-LISTE: ${totalInput} Fragen]
${allQuestions.map(q => `[${q.id}] (${q.source}): ${q.text}`).join('\n')}
[/EINGANGS-LISTE]

[ENTSCHEIDUNGSREGELN]

ZUSAMMENFASSEN – wenn Fragen dieselbe Information erfragen, nur anders formuliert:
- "Nutzt du AID-System?" + "Nutzt du Closed-Loop?" + "Nutzt du automatisierte Funktionen?" → EINE Frage
- "Welche Sportart?" + "Welcher Sport und wie lange?" + "Ausdauer oder Kraft?" → EINE Frage
- Faustregel: Kann der Nutzer beide Fragen mit einer einzigen Antwort beantworten? → Zusammenfassen.

GETRENNT HALTEN – wenn Fragen verschiedene Aspekte ansprechen:
- "Wann tritt die Hypo auf?" ≠ "Wie tief fallen die Werte?"
- "Insulindosis anpassen?" ≠ "Kohlenhydrate essen?"
- Faustregel: Braucht der Nutzer zwei separate Antworten? → Getrennt lassen.

ZIEL: 50–70% der Eingangsfragen behalten. Wähle bei Zusammenfassungen die präziseste Formulierung.

[OUTPUT FORMAT]
Antworte NUR mit einem JSON-Array, kein Text davor oder danach:
[
  {
    "question": "Beste konsolidierte Formulierung",
    "priority": "P1|P2|P3",
    "sources": ["ChatGPT", "Claude", "Gemini"],
    "mapped_ids": ["C5", "L2", "G1"],
    "reason": "Zusammengefasst weil: / Behalten weil:"
  }
]
`;

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: "application/json"
    }
  };

  try {
    const response = UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    const result = JSON.parse(response.getContentText());
    if (result.error) return errorResponse("API Error: " + result.error.message);
    if (!result.candidates || !result.candidates[0].content) return errorResponse("Leere Antwort von KI");

    let rawText = result.candidates[0].content.parts[0].text.trim();

    let cleanArray;
    try {
      const jsonMatch = rawText.match(/\[\s*\{[\s\S]*\}\s*\]/);
      cleanArray = JSON.parse(jsonMatch ? jsonMatch[0] : rawText);
    } catch (parseError) {
      cleanArray = JSON.parse(rawText);
    }

    console.log(`Deduplication: ${totalInput} → ${cleanArray.length} Fragen`);
    return successResponse(cleanArray);

  } catch (e) {
    console.error("Deduplication Error: " + e.toString());
    return errorResponse("Backend Fehler: " + e.toString());
  }
}

// === SYNTHESE ===

function handleSynthesize(data) {
  let solutions = data.solutions;
  let problem   = data.problem;

  if (!solutions && data.data && data.data.solutions) {
    solutions = data.data.solutions;
    problem   = data.data.problem || problem;
  }

  if (!solutions) return errorResponse("Backend Error: Keine Lösungen empfangen.");

  const textChatGPT = solutions.chatgpt || "Keine Antwort.";
  const textClaude  = solutions.claude  || "Keine Antwort.";
  const textGemini  = solutions.gemini  || "Keine Antwort.";

  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  const url    = `https://generativelanguage.googleapis.com/v1beta/models/${SETTINGS.MODEL}:generateContent?key=${apiKey}`;

  const prompt = `
Du bist ein erfahrener Lead-Architekt. Synthetisiere eine Master-Lösung.
[PROBLEM] ${problem} [/PROBLEM]
[LÖSUNG 1: CHATGPT] ${textChatGPT} [/LÖSUNG 1]
[LÖSUNG 2: CLAUDE] ${textClaude} [/LÖSUNG 2]
[LÖSUNG 3: GEMINI] ${textGemini} [/LÖSUNG 3]
[OUTPUT] Nutze Markdown (Headings, Bulletpoints).
`;

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.7 }
  };

  try {
    const response = UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    const result = JSON.parse(response.getContentText());
    if (result.error) return errorResponse("API Fehler: " + result.error.message);
    return successResponse({ synthesis: result.candidates[0].content.parts[0].text });
  } catch (e) {
    return errorResponse("Synthese Exception: " + e.toString());
  }
}

// === FILE SYSTEM OPERATIONS ===

function handleSaveSession(payload) {
  const sessionContent = payload.data || {};
  const category = sessionContent.category || 'privat';
  const project  = sessionContent.project  || 'Allgemein';
  const slug     = sessionContent.titleSlug || "session";

  const rootFolder     = getOrCreateFolder(SETTINGS.ROOT_FOLDER_NAME);
  const categoryFolder = getOrCreateFolder(category, rootFolder);
  const projectFolder  = getOrCreateFolder(project,  categoryFolder);

  const timestamp = Utilities.formatDate(new Date(), "GMT+1", "yyyy-MM-dd_HH-mm");
  const fileName  = `${timestamp}__${slug}.json`;

  const file = projectFolder.createFile(fileName, JSON.stringify(sessionContent, null, 2), MimeType.PLAIN_TEXT);
  return successResponse({ id: file.getId(), name: fileName });
}

function handleDeleteSession(data) {
  if (!data.id) return errorResponse("Fehler: Keine Session-ID.");
  try {
    const file = DriveApp.getFileById(data.id);
    file.setTrashed(true);
    return successResponse({ deleted: true, id: data.id });
  } catch (e) {
    return errorResponse("Löschen fehlgeschlagen: " + e.toString());
  }
}

/**
 * Verschiebt eine Session-Datei in einen anderen Kategorie-/Projekt-Ordner.
 * Erwartet: data.id, data.category, data.project
 */
function handleMoveSession(data) {
  const id          = data.id;
  const newCategory = data.category;
  const newProject  = data.project;

  if (!id || !newCategory || !newProject) {
    return errorResponse("id, category und project sind erforderlich");
  }

  try {
    const file = DriveApp.getFileById(id);

    const rootFolder     = getOrCreateFolder(SETTINGS.ROOT_FOLDER_NAME);
    const categoryFolder = getOrCreateFolder(newCategory, rootFolder);
    const projectFolder  = getOrCreateFolder(newProject,  categoryFolder);

    file.moveTo(projectFolder);

    try {
      const content    = JSON.parse(file.getBlob().getDataAsString());
      content.category = newCategory;
      content.project  = newProject;
      file.setContent(JSON.stringify(content, null, 2));
    } catch (parseErr) {
      console.warn("moveSession: JSON-Update fehlgeschlagen, Datei wurde aber verschoben.", parseErr);
    }

    console.log("moveSession: " + file.getName() + " → " + newCategory + "/" + newProject);
    return successResponse({ id: file.getId(), name: file.getName(), category: newCategory, project: newProject });

  } catch (e) {
    console.error("handleMoveSession Fehler: " + e.toString());
    return errorResponse("Fehler beim Verschieben: " + e.toString());
  }
}

/**
 * Löscht einen leeren Projekt-Ordner (verschiebt ihn in den Papierkorb).
 * Erwartet: data.category, data.project
 */
function handleDeleteProject(data) {
  const category = data.category;
  const project  = data.project;

  if (!category || !project) {
    return errorResponse("Kategorie und Projekt sind erforderlich");
  }

  try {
    const rootFolder = getOrCreateFolder(SETTINGS.ROOT_FOLDER_NAME);
    const catFolder  = getOrCreateFolder(category, rootFolder);

    const folders = catFolder.getFoldersByName(project);
    if (!folders.hasNext()) {
      return errorResponse("Projektordner nicht gefunden: " + project);
    }

    const projectFolder = folders.next();

    if (projectFolder.getFiles().hasNext()) {
      return errorResponse("Das Projekt enthält noch Sessions und kann nicht gelöscht werden.");
    }
    if (projectFolder.getFolders().hasNext()) {
      return errorResponse("Das Projekt enthält noch Unterordner und kann nicht gelöscht werden.");
    }

    projectFolder.setTrashed(true);
    console.log("deleteProject: " + category + "/" + project + " in Papierkorb verschoben");
    return successResponse({ deleted: true, category: category, project: project });

  } catch (e) {
    console.error("handleDeleteProject Fehler: " + e.toString());
    return errorResponse("Fehler beim Löschen: " + e.toString());
  }
}

/**
 * Benennt eine Session um: aktualisiert das Feld "name" im JSON
 * und benennt die Datei entsprechend um.
 * Erwartet: data.id, data.newTitle
 */
function handleRenameSession(data) {
  const id       = data.id;
  const newTitle = (data.newTitle || "").trim();

  if (!id)       return errorResponse("Keine Session-ID übergeben");
  if (!newTitle) return errorResponse("Neuer Titel darf nicht leer sein");

  try {
    const file = DriveApp.getFileById(id);

    // JSON-Inhalt aktualisieren
    let content = {};
    try {
      content = JSON.parse(file.getBlob().getDataAsString());
    } catch (e) {
      return errorResponse("Session-Datei konnte nicht gelesen werden: " + e.toString());
    }

    content.name = newTitle;

    // Slug aus neuem Titel erzeugen (Kleinbuchstaben, Sonderzeichen → Bindestrich)
    const newSlug = newTitle
      .toLowerCase()
      .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 60);

    content.titleSlug = newSlug;

    // Dateiname: Zeitstempel-Präfix beibehalten, Slug ersetzen
    const oldName     = file.getName();                     // z.B. "2026-02-03_17-08__alter-slug.json"
    const timestampPart = oldName.split('__')[0] || oldName.replace('.json', '');
    const newFileName   = `${timestampPart}__${newSlug}.json`;

    file.setContent(JSON.stringify(content, null, 2));
    file.setName(newFileName);

    console.log("renameSession: " + oldName + " → " + newFileName);
    return successResponse({ id: file.getId(), name: newFileName, title: newTitle, slug: newSlug });

  } catch (e) {
    console.error("handleRenameSession Fehler: " + e.toString());
    return errorResponse("Fehler beim Umbenennen: " + e.toString());
  }
}

function handleGetProjects() {
  const rootFolder  = getOrCreateFolder(SETTINGS.ROOT_FOLDER_NAME);
  const projectData = {};
  SETTINGS.CATEGORIES.forEach(cat => {
    projectData[cat] = [];
    const catFolder  = getOrCreateFolder(cat, rootFolder);
    const subFolders = catFolder.getFolders();
    while (subFolders.hasNext()) projectData[cat].push(subFolders.next().getName());
    projectData[cat].sort();
  });
  return successResponse(projectData);
}

function handleListSessions() {
  const rootFolder = getOrCreateFolder(SETTINGS.ROOT_FOLDER_NAME);
  let allFiles = [];
  SETTINGS.CATEGORIES.forEach(category => {
    const catFolder      = getOrCreateFolder(category, rootFolder);
    const projectFolders = catFolder.getFolders();
    while (projectFolders.hasNext()) {
      const projFolder = projectFolders.next();
      const files      = projFolder.getFiles();
      while (files.hasNext()) {
        const file = files.next();
        if (file.getName().endsWith(".json")) {
          const parts = file.getName().replace(".json", "").split("__");
          allFiles.push({
            id:           file.getId(),
            fileName:     file.getName(),
            displayTitle: parts.length > 1 ? parts[1] : "Unbenannte Session",
            timestamp:    parts[0],
            date:         file.getDateCreated(),
            category:     category,
            project:      projFolder.getName()
          });
        }
      }
    }
  });
  return successResponse(allFiles.sort((a, b) => b.date - a.date));
}

function handleGetSession(id) {
  try {
    if (!id) return errorResponse("Keine ID übergeben");
    const file    = DriveApp.getFileById(id);
    const content = file.getBlob().getDataAsString();
    if (!content) return errorResponse("Session file is empty");
    return successResponse(JSON.parse(content));
  } catch (e) {
    return errorResponse("Session not found or invalid: " + e.toString());
  }
}

// === HELPER FUNCTIONS ===

function getOrCreateFolder(name, parent) {
  const searchIn = parent || DriveApp;
  const folders  = searchIn.getFoldersByName(name);
  return folders.hasNext() ? folders.next() : searchIn.createFolder(name);
}

function outputJSON(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function successResponse(data)  { return { status: 'success', data: data };      }
function errorResponse(message) { return { status: 'error',   message: message }; }
