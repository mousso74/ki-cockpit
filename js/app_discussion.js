/* ======================================================================
 * app_discussion.js — State-Machine "LLM-Diskussion" (Stufe 1)
 *
 * D0 → D1 → D2 → D3 → D6  (D4/D5 = Stufe 2, nicht implementiert)
 *
 * Abhängigkeiten (vorher laden):
 *   storage.js              — BACKEND_URL, saveSession, generateSessionId
 *   prompts_discussion.js   — DISCUSSION_MODELS, buildBiografPrompt,
 *                             buildBroadcastPrompt, parsePosition
 *   storage_discussion.js   — analyzeDivergence, synthesizeDiscussion
 * ==================================================================== */

const discussionState = {
  current: 'D0',
  frage: '',
  kategorie: '',
  projekt: '',
  biografModell: 'ChatGPT',
  dossier: '',
  dossierFreigegeben: false,
  antworten: {},
  mapping: {},
  divergenz: null,
  auswahl: [],
  synthese: '',
  metrikJaNein: null
};

let discAvailableProjects = { geschäftlich: [], privat: [] };

// ========================================
// Initialization
// ========================================

document.addEventListener('DOMContentLoaded', () => {
  console.log('[discussion] LLM-Diskussion initialized');

  // Kategorie-Wechsel → Projekt-Dropdown aktualisieren
  const katSelect = document.getElementById('d-kategorie');
  if (katSelect) {
    katSelect.addEventListener('change', discUpdateProjectDropdown);
  }

  // Projekte laden
  discUpdateProjectDropdown();

  // sessionStorage-Handoff von der Template-Kachel
  try {
    const handoff = sessionStorage.getItem('ki_disc_handoff');
    if (handoff) {
      sessionStorage.removeItem('ki_disc_handoff');
      const data = JSON.parse(handoff);
      if (data.frage) {
        document.getElementById('d-frage').value = data.frage;
      }
      if (data.kategorie && katSelect) {
        katSelect.value = data.kategorie;
        discUpdateProjectDropdown().then(() => {
          if (data.projekt) {
            const projSelect = document.getElementById('d-projekt');
            if (projSelect) projSelect.value = data.projekt;
          }
        });
      }
    }
  } catch (e) {
    console.warn('[discussion] sessionStorage handoff failed:', e);
  }
});

// ========================================
// Project Dropdown
// ========================================

async function discUpdateProjectDropdown() {
  const katSelect = document.getElementById('d-kategorie');
  const projSelect = document.getElementById('d-projekt');
  if (!katSelect || !projSelect) return;

  const category = katSelect.value;
  projSelect.innerHTML = '<option value="Allgemein">Allgemein</option>';

  try {
    const response = await fetch(BACKEND_URL + '?action=getProjects');
    const result = await response.json();

    if (result.status === 'success' && result.data) {
      discAvailableProjects = result.data;
      const projects = result.data[category] || [];
      projects.forEach(name => {
        if (name === 'Allgemein') return;
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        projSelect.appendChild(opt);
      });
    }
  } catch (e) {
    console.warn('[discussion] Projekte konnten nicht geladen werden:', e);
  }
}

// ========================================
// State Navigation
// ========================================

function gotoDiscussionState(state) {
  discussionState.current = state;
  document.querySelectorAll('[data-discussion-state]').forEach(el => {
    el.style.display = (el.getAttribute('data-discussion-state') === state) ? 'block' : 'none';
  });

  // State-Dots aktualisieren
  const stateMap = { 'D0': 0, 'D1': 1, 'D2': 2, 'D3': 3, 'D6': 4 };
  const idx = stateMap[state];
  document.querySelectorAll('.state-dot').forEach((dot, i) => {
    dot.classList.toggle('active', i === idx);
    dot.classList.toggle('completed', i < idx);
  });
}

// ========================================
// D0: Eingabe + Biograf-Wahl
// ========================================

function discussionStart() {
  const frage = document.getElementById('d-frage').value.trim();
  if (!frage) { discToast('Bitte eine Entscheidungsfrage eingeben.', 'error'); return; }

  discussionState.frage = frage;
  discussionState.kategorie = document.getElementById('d-kategorie')?.value || 'privat';
  discussionState.projekt = document.getElementById('d-projekt')?.value || 'Allgemein';
  discussionState.biografModell = document.getElementById('d-biograf')?.value || 'ChatGPT';

  const p0 = buildBiografPrompt(frage);
  document.getElementById('d-biograf-prompt').textContent = p0;
  document.getElementById('d-biograf-target').textContent = discussionState.biografModell;
  gotoDiscussionState('D1');
}

// ========================================
// D1: Dossier-Gate
// ========================================

function discussionUseDossier(selfTyped) {
  let dossier;
  if (selfTyped) {
    dossier = document.getElementById('d-dossier-eigen').value.trim();
  } else {
    dossier = document.getElementById('d-dossier-paste').value.trim();
  }
  if (!dossier) { discToast('Dossier ist leer.', 'error'); return; }

  discussionState.dossier = dossier;
  discussionState.dossierFreigegeben = true;

  const p1 = buildBroadcastPrompt(discussionState.frage, dossier);
  document.getElementById('d-broadcast-prompt').textContent = p1;

  const wrap = document.getElementById('d-paste-felder');
  wrap.innerHTML = '';
  DISCUSSION_MODELS.forEach(modell => {
    const div = document.createElement('div');
    div.className = 'd-paste-row';
    div.innerHTML =
      '<label class="d-paste-label">' + modell + '</label>' +
      '<textarea id="d-ant-' + modell + '" rows="6" placeholder="[POSITION]-Antwort von ' + modell + ' hier einfügen..."></textarea>' +
      '<span class="d-paste-status" id="d-status-' + modell + '"></span>';
    wrap.appendChild(div);
  });
  gotoDiscussionState('D2');
}

// ========================================
// D2: Broadcast einsammeln + parsen
// ========================================

function discussionCollectAnswers() {
  const antworten = {};
  const fehler = [];

  DISCUSSION_MODELS.forEach(modell => {
    const raw = (document.getElementById('d-ant-' + modell)?.value || '').trim();
    const statusEl = document.getElementById('d-status-' + modell);
    if (!raw) {
      if (statusEl) { statusEl.textContent = '-- leer (übersprungen)'; statusEl.className = 'd-paste-status d-skip'; }
      return;
    }
    const parsed = parsePosition(raw);
    if (!parsed.ok) {
      fehler.push(modell + ': ' + parsed.error);
      if (statusEl) { statusEl.textContent = 'x ' + parsed.error; statusEl.className = 'd-paste-status d-err'; }
      return;
    }
    antworten[modell] = { raw, fields: parsed.fields };
    if (statusEl) { statusEl.textContent = 'OK'; statusEl.className = 'd-paste-status d-ok'; }
  });

  if (fehler.length > 0) {
    discToast('Einige Antworten sind nicht parsebar -- bitte Format prüfen.', 'error');
    return;
  }

  const anzahl = Object.keys(antworten).length;
  if (anzahl < 3) {
    discToast('Mindestens 3 strukturierte Antworten nötig (aktuell ' + anzahl + ').', 'error');
    return;
  }

  discussionState.antworten = antworten;

  const mapping = {};
  const positions = [];
  let i = 1;
  DISCUSSION_MODELS.forEach(modell => {
    if (!antworten[modell]) return;
    const id = 'P' + i++;
    mapping[id] = modell;
    positions.push({
      id,
      kernthese: antworten[modell].fields.kernthese || '',
      begruendung: antworten[modell].fields.begruendung || ''
    });
  });
  discussionState.mapping = mapping;

  discussionRunDivergence(positions);
}

// ========================================
// D3: Divergenz-Analyse
// ========================================

async function discussionRunDivergence(positions) {
  discToast('Analysiere Divergenz ...');
  let res;
  try {
    res = await analyzeDivergence(positions);
  } catch (e) {
    discToast('Netzwerkfehler bei der Divergenz-Analyse.', 'error');
    return;
  }
  if (!res || res.status !== 'success') {
    discToast('Divergenz-Analyse fehlgeschlagen: ' + (res?.message || 'unbekannt'), 'error');
    return;
  }

  discussionState.divergenz = res.data;
  discussionState.auswahl = (res.data.auswahl || []).map(id => discussionState.mapping[id] || id);

  renderHeatmap(res.data.pairs, positions, discussionState.mapping, res.data.converged);

  const info = document.getElementById('d-divergenz-info');
  if (res.data.converged) {
    info.innerHTML =
      '<div class="d-konvergenz">Konvergenz (max. Score ' + res.data.maxScore + ' < ' + res.data.threshold + '). ' +
      'Keine Debatte. Direkte Synthese -- Einigkeit korrelierter Modelle ist <strong>schwache Evidenz</strong>.</div>';
  } else {
    info.innerHTML =
      '<div class="d-divergent">Max. Positionsdistanz ' + res.data.maxScore + '/10. ' +
      'Für die Debatte (Stufe 2) ausgewählt: <strong>' + discussionState.auswahl.join(', ') + '</strong>.</div>' +
      '<div class="d-stufe1-hinweis">Stufe 1 endet hier mit der Synthese aller Erstantworten.</div>';
  }
  gotoDiscussionState('D3');
}

// ========================================
// D3 → D6: Synthese
// ========================================

async function discussionRunSynthesis() {
  discToast('Erstelle Entscheidungsvorlage ...');

  const positions = [];
  Object.keys(discussionState.mapping).forEach(id => {
    const modell = discussionState.mapping[id];
    const f = discussionState.antworten[modell].fields;
    positions.push({
      id,
      kernthese: f.kernthese || '',
      begruendung: f.begruendung || '',
      annahmen: f.annahmen || '',
      risiken: f.risiken || '',
      konfidenz: f.konfidenz,
      umstimmbar: f.umstimmbar || ''
    });
  });

  let res;
  try {
    res = await synthesizeDiscussion({
      problem: discussionState.frage,
      positions,
      kritiken: [],
      revisionen: [],
      converged: discussionState.divergenz?.converged || false
    });
  } catch (e) {
    discToast('Netzwerkfehler bei der Synthese.', 'error');
    return;
  }
  if (!res || res.status !== 'success') {
    discToast('Synthese fehlgeschlagen: ' + (res?.message || 'unbekannt'), 'error');
    return;
  }

  discussionState.synthese = res.data.synthesis;
  document.getElementById('d-synthese-output').innerHTML =
    discFormatMarkdown(res.data.synthesis);
  gotoDiscussionState('D6');
}

// ========================================
// D6: Speichern + Export
// ========================================

async function discussionSave() {
  const m = document.querySelector('input[name="d-metrik"]:checked');
  discussionState.metrikJaNein = m ? (m.value === 'ja') : null;

  const sessionData = {
    id: generateSessionId(),
    sessionType: 'discussion',
    category: discussionState.kategorie,
    project: discussionState.projekt,
    name: discussionState.frage.substring(0, 80),
    titleSlug: discSlugify(discussionState.frage),
    createdAt: new Date().toISOString(),
    frage: discussionState.frage,
    biografModell: discussionState.biografModell,
    dossier: discussionState.dossier,
    antworten: discussionState.antworten,
    mapping: discussionState.mapping,
    divergenz: discussionState.divergenz,
    auswahl: discussionState.auswahl,
    synthese: discussionState.synthese,
    metrik: discussionState.metrikJaNein
  };

  saveToLocalStorage(sessionData);

  let res;
  try {
    res = await postAction('saveSession', { data: sessionData });
  } catch (e) {
    discToast('Speichern fehlgeschlagen (Netzwerk). Lokales Backup erstellt.', 'warning');
    return;
  }
  if (res && res.status === 'success') {
    discToast('Diskussion archiviert.', 'success');
  } else {
    discToast('Backend-Fehler: ' + (res?.message || 'unbekannt') + '. Lokales Backup vorhanden.', 'warning');
  }
}

function discussionExportMarkdown() {
  const s = discussionState;
  let md = '# LLM-Diskussion: ' + s.frage + '\n\n';
  md += '**Datum:** ' + new Date().toLocaleDateString('de-DE') + '\n\n---\n\n';
  md += '## Frage\n\n' + s.frage + '\n\n';
  md += '## Kontext-Dossier (' + s.biografModell + ')\n\n' + s.dossier + '\n\n';
  md += '## Erstantworten\n\n';
  Object.keys(s.mapping).forEach(id => {
    const modell = s.mapping[id];
    const f = s.antworten[modell].fields;
    md += '### ' + id + ' (' + modell + ')\n';
    md += '**Kernthese:** ' + (f.kernthese || '-') + '\n\n';
    md += '**Begründung:** ' + (f.begruendung || '-') + '\n\n';
    md += '**Konfidenz:** ' + (f.konfidenz != null ? f.konfidenz : '-') + '\n\n';
  });
  if (s.divergenz) {
    md += '## Divergenz\n\n';
    md += 'Max. Score: ' + s.divergenz.maxScore + '/10 | ';
    md += (s.divergenz.converged ? 'Konvergenz (schwache Evidenz)' : 'Auswahl: ' + s.auswahl.join(', ')) + '\n\n';
  }
  md += '## Synthese\n\n' + s.synthese + '\n\n---\n*Exportiert aus Asinito KI-Cockpit*\n';

  const bom = '﻿';
  const blob = new Blob([bom + md], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = discSlugify(s.frage) + '_diskussion.md';
  a.click();
  URL.revokeObjectURL(url);
}

// ========================================
// Heatmap-Renderer
// ========================================

function renderHeatmap(pairs, positions, mapping, converged) {
  const ids = positions.map(p => p.id);
  const scoreOf = (x, y) => {
    if (x === y) return null;
    const p = pairs.find(pp =>
      (pp.a === x && pp.b === y) || (pp.a === y && pp.b === x));
    return p ? p.score : 0;
  };

  let html = '<table class="d-heatmap"><thead><tr><th></th>';
  ids.forEach(id => { html += '<th title="' + (mapping[id] || id) + '">' + id + '</th>'; });
  html += '</tr></thead><tbody>';
  ids.forEach(rowId => {
    html += '<tr><th title="' + (mapping[rowId] || rowId) + '">' + rowId + '</th>';
    ids.forEach(colId => {
      const sc = scoreOf(rowId, colId);
      if (sc === null) {
        html += '<td class="d-cell d-diag">-</td>';
      } else {
        html += '<td class="d-cell" style="--score:' + sc + '" title="' + sc + '/10">' + sc + '</td>';
      }
    });
    html += '</tr>';
  });
  html += '</tbody></table>';

  const konflikte = pairs.slice().sort((a, b) => b.score - a.score)
    .filter(p => p.score > 0 && p.konflikt);
  if (konflikte.length) {
    html += '<ul class="d-konfliktliste">';
    konflikte.forEach(p => {
      html += '<li><span class="d-konflikt-score">' + p.score + '</span> ' +
        p.a + ' - ' + p.b + ': ' + discEscapeHtml(p.konflikt) + '</li>';
    });
    html += '</ul>';
  }
  document.getElementById('d-heatmap-wrap').innerHTML = html;
}

// ========================================
// Helfer
// ========================================

function discSlugify(text) {
  return text.toLowerCase()
    .replace(/[äöü]/g, m => ({ 'ä': 'ae', 'ö': 'oe', 'ü': 'ue' }[m]))
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50) || 'diskussion';
}

function discEscapeHtml(s) {
  return String(s).replace(/[&<>"]/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function discFormatMarkdown(input) {
  let text = '';
  if (typeof input === 'string') {
    text = input;
  } else if (input == null) {
    text = '';
  } else if (typeof input === 'object') {
    text = input.synthesis || input.text || JSON.stringify(input, null, 2);
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
    .map(para => '<p>' + para.replace(/\n/g, '<br>') + '</p>')
    .join('');
  return text;
}

function discToast(msg, type) {
  const toast = document.getElementById('toast');
  if (!toast) { console.log('[discussion] ' + msg); return; }
  toast.textContent = msg;
  toast.className = 'toast' + (type ? ' ' + type : '');
  toast.classList.remove('hidden');
  const duration = (type === 'error' || type === 'warning') ? 8000 : 3000;
  setTimeout(() => toast.classList.add('hidden'), duration);
}

function copyDiscussion(id) {
  const txt = document.getElementById(id).textContent;
  navigator.clipboard.writeText(txt).then(() => {
    discToast('Prompt kopiert.', 'success');
  });
}

function discussionReset() {
  discussionState.current = 'D0';
  discussionState.frage = '';
  discussionState.dossier = '';
  discussionState.dossierFreigegeben = false;
  discussionState.antworten = {};
  discussionState.mapping = {};
  discussionState.divergenz = null;
  discussionState.auswahl = [];
  discussionState.synthese = '';
  discussionState.metrikJaNein = null;

  document.getElementById('d-frage').value = '';
  gotoDiscussionState('D0');
}
