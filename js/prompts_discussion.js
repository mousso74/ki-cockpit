/* ======================================================================
 * prompts_discussion.js — LLM-Diskussion Prompts (Stufe 1)
 * ==================================================================== */

const DISCUSSION_MODELS = ['ChatGPT', 'Claude', 'Vibe', 'Gemini', 'DeepSeek'];

function buildBiografPrompt(frage, attBlock) {
  const lines = [
    'Erstelle aus deinem Wissen über mich ein anonymisiertes Kontext-Dossier',
    '(max. 600 Wörter) für folgende Frage:',
    '',
    frage,
    '',
    'Struktur: Situation / Fähigkeiten / Ressourcen / harte Constraints / Risikoneigung.',
    'Keine Klarnamen Dritter, keine Adressen, keine Vertragsdetails.',
    'Gib NUR das Dossier aus, keinen weiteren Text.'
  ];
  if (attBlock) lines.push(attBlock);
  return lines.join('\n');
}

function buildBroadcastPrompt(frage, dossier, attReminder) {
  const extra = attReminder || '';
  return [
    'Du bist ein präziser Entscheidungs-Berater.',
    '',
    'ABSOLUTE REGELN (nicht verhandelbar):',
    '- Gib AUSSCHLIESSLICH den [POSITION]-Block unten aus.',
    '- KEIN Text davor oder danach, keine Einleitung, keine Rückfrage, kein Nachsatz.',
    '- Antworte auf Deutsch.',
    '- Wenn du diese Regeln verletzt, ist die Ausgabe ungültig.',
    '',
    '[FRAGE]',
    frage,
    '[/FRAGE]',
    '',
    '[KONTEXT_DOSSIER]',
    dossier || '(kein Dossier bereitgestellt)',
    '[/KONTEXT_DOSSIER]',
    extra,
    '',
    'Gib exakt diese Struktur aus und nichts anderes:',
    '',
    '[POSITION]',
    'KERNTHESE: <ein Satz>',
    'BEGRUENDUNG: <max. 800 Wörter>',
    'ANNAHMEN: <Aufzählung>',
    'RISIKEN: <Aufzählung>',
    'KONFIDENZ: <0-100>',
    'UMSTIMMBAR_DURCH: <was würde diese Position kippen?>',
    '[/POSITION]'
  ].join('\n');
}

/**
 * D4: Prompt für Modell X, das die Positionen der anderen (Y, Z) kritisiert.
 * kritikerPos = { id, kernthese, begruendung, annahmen, risiken, konfidenz, umstimmbar }
 * zielPositionen = Array derselben Struktur (die anderen ausgewählten Modelle)
 */
function buildCritiquePrompt(kritikerPos, zielPositionen) {
  const zielBlock = zielPositionen.map(function(p) {
    return '[' + p.id + ']\n'
      + 'KERNTHESE: ' + (p.kernthese || '') + '\n'
      + 'BEGRUENDUNG: ' + (p.begruendung || '') + '\n'
      + 'ANNAHMEN: ' + (p.annahmen || '') + '\n'
      + 'RISIKEN: ' + (p.risiken || '') + '\n'
      + 'UMSTIMMBAR_DURCH: ' + (p.umstimmbar || '') + '\n'
      + '[/' + p.id + ']';
  }).join('\n\n');

  const zielIds = zielPositionen.map(function(p) { return p.id; }).join(', ');

  return [
    'Du bist ein präziser Debattant. Du hast bereits eine eigene Position eingenommen:',
    '',
    '[DEINE POSITION: ' + kritikerPos.id + ']',
    'KERNTHESE: ' + (kritikerPos.kernthese || ''),
    'BEGRUENDUNG: ' + (kritikerPos.begruendung || ''),
    '[/DEINE POSITION]',
    '',
    'Nun siehst du die folgenden Gegenpositionen (' + zielIds + '):',
    '',
    zielBlock,
    '',
    'ABSOLUTE REGELN:',
    '- Gib AUSSCHLIESSLICH den [KRITIK]-Block unten aus.',
    '- KEIN Text davor oder danach.',
    '- Antworte auf Deutsch.',
    '',
    'AUFGABE: Kritisiere jede Gegenposition. Pro Position:',
    '- Benenne die schwächste Annahme.',
    '- Nenne einen Fakt oder ein Szenario, das diese Position kippen würde.',
    '- Bleibe sachlich und präzise (max. 200 Wörter pro Position).',
    '',
    '[KRITIK]',
    zielPositionen.map(function(p) {
      return 'AN_' + p.id + ': <Kritik hier>';
    }).join('\n'),
    '[/KRITIK]'
  ].join('\n');
}

/**
 * D5: Prompt für Modell Y, das auf erhaltene Kritiken reagiert und seine Position revidiert.
 * eigenePos = { id, kernthese, begruendung, annahmen, risiken, konfidenz, umstimmbar }
 * kritiken = Array von { vonId, text } — alle Kritiken, die dieses Modell erhalten hat
 */
function buildRevisionPrompt(eigenePos, kritiken) {
  const kritikBlock = kritiken.map(function(k) {
    return '[KRITIK von ' + k.vonId + ']\n' + k.text + '\n[/KRITIK]';
  }).join('\n\n');

  return [
    'Du bist ein präziser Debattant. Du hast ursprünglich diese Position vertreten:',
    '',
    '[DEINE URSPRÜNGLICHE POSITION: ' + eigenePos.id + ']',
    'KERNTHESE: ' + (eigenePos.kernthese || ''),
    'BEGRUENDUNG: ' + (eigenePos.begruendung || ''),
    'ANNAHMEN: ' + (eigenePos.annahmen || ''),
    'RISIKEN: ' + (eigenePos.risiken || ''),
    'KONFIDENZ: ' + (eigenePos.konfidenz != null ? eigenePos.konfidenz : ''),
    'UMSTIMMBAR_DURCH: ' + (eigenePos.umstimmbar || ''),
    '[/DEINE URSPRÜNGLICHE POSITION]',
    '',
    'Du hast folgende Kritiken erhalten:',
    '',
    kritikBlock,
    '',
    'ABSOLUTE REGELN:',
    '- Gib AUSSCHLIESSLICH den [REVISION]-Block unten aus.',
    '- KEIN Text davor oder danach.',
    '- Antworte auf Deutsch.',
    '',
    'AUFGABE: Revidiere deine Position ehrlich.',
    '- Welche Kritik ist berechtigt? Wo hältst du stand?',
    '- Aktualisiere Kernthese und Konfidenz wenn nötig.',
    '- Sei präzise (max. 400 Wörter).',
    '',
    '[REVISION]',
    'KERNTHESE_NEU: <revidierte oder bestätigte Kernthese>',
    'BEGRUENDUNG_NEU: <aktualisierte Begründung>',
    'KONZESSIONEN: <was räumst du ein?>',
    'HALTUNG: <woran hältst du fest und warum?>',
    'KONFIDENZ_NEU: <0-100>',
    '[/REVISION]'
  ].join('\n');
}

/**
 * Parst eine [REVISION]-Antwort.
 */
function parseRevision(raw) {
  if (!raw || !raw.trim()) return { ok: false, error: 'Leere Antwort.' };

  let body = raw;
  const blockMatch = raw.match(/\[REVISION\]([\s\S]*?)\[\/REVISION\]/i);
  if (blockMatch) body = blockMatch[1];

  const FELDER = [
    ['kernthese_neu',   /KERNTHESE_NEU\s*:/i],
    ['begruendung_neu', /BEGRUENDUNG_NEU\s*:/i],
    ['konzessionen',    /KONZESSIONEN\s*:/i],
    ['haltung',         /HALTUNG\s*:/i],
    ['konfidenz_neu',   /KONFIDENZ_NEU\s*:/i]
  ];

  const marker = [];
  FELDER.forEach(function([key, re]) {
    const m = body.match(re);
    if (m) marker.push({ key, start: m.index, headerLen: m[0].length });
  });
  marker.sort(function(a, b) { return a.start - b.start; });

  if (marker.length === 0) return { ok: false, error: 'Kein [REVISION]-Feld erkennbar.' };

  const fields = {};
  for (let i = 0; i < marker.length; i++) {
    const cur = marker[i];
    const next = marker[i + 1];
    const from = cur.start + cur.headerLen;
    const to = next ? next.start : body.length;
    fields[cur.key] = body.substring(from, to).trim();
  }

  if (fields.konfidenz_neu != null) {
    const num = parseInt(String(fields.konfidenz_neu).replace(/[^0-9]/g, ''), 10);
    fields.konfidenz_neu = isNaN(num) ? null : Math.max(0, Math.min(100, num));
  }

  return { ok: true, fields };
}

/**
 * Parst eine [KRITIK]-Antwort und extrahiert die einzelnen AN_Px-Blöcke.
 * Gibt { ok, kritiken: [{anId, text}] } zurück.
 */
function parseCritique(raw, zielIds) {
  if (!raw || !raw.trim()) return { ok: false, error: 'Leere Antwort.' };

  let body = raw;
  const blockMatch = raw.match(/\[KRITIK\]([\s\S]*?)\[\/KRITIK\]/i);
  if (blockMatch) body = blockMatch[1];

  const kritiken = [];
  zielIds.forEach(function(id) {
    const re = new RegExp('AN_' + id + '\\s*:(.*?)(?=AN_P\\d+\\s*:|$)', 'is');
    const m = body.match(re);
    if (m && m[1] && m[1].trim()) {
      kritiken.push({ anId: id, text: m[1].trim() });
    }
  });

  if (kritiken.length === 0) return { ok: false, error: 'Keine AN_Px-Felder gefunden.' };
  return { ok: true, kritiken };
}

function parsePosition(raw) {
  if (!raw || !raw.trim()) {
    return { ok: false, error: 'Leere Antwort.' };
  }

  let body = raw;
  const blockMatch = raw.match(/\[POSITION\]([\s\S]*?)\[\/POSITION\]/i);
  if (blockMatch) {
    body = blockMatch[1];
  }

  const FELDER = [
    ['kernthese',  /KERNTHESE\s*:/i],
    ['begruendung',/BEGRUENDUNG\s*:/i],
    ['annahmen',   /ANNAHMEN\s*:/i],
    ['risiken',    /RISIKEN\s*:/i],
    ['konfidenz',  /KONFIDENZ\s*:/i],
    ['umstimmbar', /UMSTIMMBAR_DURCH\s*:/i]
  ];

  const marker = [];
  FELDER.forEach(([key, re]) => {
    const m = body.match(re);
    if (m) marker.push({ key, start: m.index, headerLen: m[0].length });
  });
  marker.sort((a, b) => a.start - b.start);

  if (marker.length === 0) {
    return { ok: false, error: 'Kein [POSITION]-Feld erkennbar (KERNTHESE etc. fehlt).' };
  }

  const fields = {};
  for (let i = 0; i < marker.length; i++) {
    const cur = marker[i];
    const next = marker[i + 1];
    const from = cur.start + cur.headerLen;
    const to = next ? next.start : body.length;
    fields[cur.key] = body.substring(from, to).trim();
  }

  if (fields.konfidenz != null) {
    const num = parseInt(String(fields.konfidenz).replace(/[^0-9]/g, ''), 10);
    fields.konfidenz = isNaN(num) ? null : Math.max(0, Math.min(100, num));
  }

  if (!fields.kernthese) {
    return { ok: false, error: 'Pflichtfeld KERNTHESE fehlt oder leer.' };
  }

  return { ok: true, fields };
}
