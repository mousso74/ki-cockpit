# Backend-Fix benötigt: handleGetSession()

## Problem
Beim Abrufen einer Session über `getSession` kommt folgender Fehler:

```
{"status":"error","message":"Session not found or invalid: TypeError: file.getContentText is not a function"}
```

## Kontext
- **Backend URL:** `https://script.google.com/macros/s/AKfycbzdUdWbgjp0wofYk2M1Ui8FcaB10awsrgTzojOWaJS9jAXWzopQUdFBDxd0bu9D9z8p/exec`
- **Test-Request:** `?action=getSession&id=1dhzsAY7npQyzdhbnxu47tYuxQVdtFCtK`
- **Die Session existiert:** `listSessions` gibt sie korrekt zurück mit dieser ID

## Vermutete Ursache
Die `handleGetSession()` Funktion verwendet wahrscheinlich `DriveApp.getFileById(id)` und ruft dann `.getContentText()` auf.

Mögliche Probleme:
1. `DriveApp.getFileById()` gibt eventuell kein File-Objekt zurück wenn die ID ungültig ist
2. Oder es wird ein Folder statt ein File zurückgegeben
3. Oder das File-Objekt hat aus irgendeinem Grund keine `getContentText()` Methode

## Erwartetes Verhalten
```javascript
// Request
GET ?action=getSession&id=1dhzsAY7npQyzdhbnxu47tYuxQVdtFCtK

// Response
{
  "status": "success",
  "data": {
    "problem": "...",
    "deduplicatedQuestions": [...],
    "answers": [...],
    "phase2Outputs": {...},
    "synthesis": "..."
  }
}
```

## Aktueller handleGetSession Code (vermutlich)
```javascript
function handleGetSession(id) {
  try {
    const file = DriveApp.getFileById(id);
    const content = file.getContentText();  // <-- HIER IST DER FEHLER
    const data = JSON.parse(content);
    return successResponse(data);
  } catch (error) {
    return errorResponse('Session not found or invalid: ' + error);
  }
}
```

## Vorgeschlagener Fix
```javascript
function handleGetSession(id) {
  try {
    // Prüfen ob ID gültig ist
    if (!id) {
      return errorResponse('No session ID provided');
    }

    const file = DriveApp.getFileById(id);

    // Prüfen ob es wirklich ein File ist (nicht Folder)
    if (!file) {
      return errorResponse('File not found');
    }

    // getBlob().getDataAsString() ist robuster als getContentText()
    const content = file.getBlob().getDataAsString();
    const data = JSON.parse(content);

    return successResponse(data);
  } catch (error) {
    return errorResponse('Session not found or invalid: ' + error.toString());
  }
}
```

## Alternative: Über Folder iterieren
Falls das Problem ist, dass die File-ID nicht direkt funktioniert:

```javascript
function handleGetSession(id) {
  try {
    const rootFolder = getOrCreateFolder(SETTINGS.ROOT_FOLDER_NAME);

    // Rekursiv durch alle Ordner suchen
    function findFileById(folder, targetId) {
      // Erst in Dateien suchen
      const files = folder.getFiles();
      while (files.hasNext()) {
        const file = files.next();
        if (file.getId() === targetId) {
          return file;
        }
      }

      // Dann in Unterordnern
      const subfolders = folder.getFolders();
      while (subfolders.hasNext()) {
        const result = findFileById(subfolders.next(), targetId);
        if (result) return result;
      }

      return null;
    }

    const file = findFileById(rootFolder, id);

    if (!file) {
      return errorResponse('Session not found: ' + id);
    }

    const content = file.getBlob().getDataAsString();
    const data = JSON.parse(content);

    return successResponse(data);
  } catch (error) {
    return errorResponse('Error loading session: ' + error.toString());
  }
}
```

## Bitte
1. Analysiere den aktuellen `handleGetSession()` Code im Backend
2. Finde heraus warum `getContentText()` fehlschlägt
3. Implementiere den Fix
4. Deploye eine neue Version
5. Teile mir die neue Backend-URL mit (falls sie sich ändert)
