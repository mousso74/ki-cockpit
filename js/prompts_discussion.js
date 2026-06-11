/* ======================================================================
 * prompts_discussion.js — LLM-Diskussion Prompts (Stufe 1)
 * ==================================================================== */

const DISCUSSION_MODELS = ['ChatGPT', 'Claude', 'Vibe', 'Gemini', 'DeepSeek'];

function buildBiografPrompt(frage) {
  return [
    'Erstelle aus deinem Wissen über mich ein anonymisiertes Kontext-Dossier',
    '(max. 600 Wörter) für folgende Frage:',
    '',
    frage,
    '',
    'Struktur: Situation / Fähigkeiten / Ressourcen / harte Constraints / Risikoneigung.',
    'Keine Klarnamen Dritter, keine Adressen, keine Vertragsdetails.',
    'Gib NUR das Dossier aus, keinen weiteren Text.'
  ].join('\n');
}

function buildBroadcastPrompt(frage, dossier) {
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
