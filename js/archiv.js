/* ========================================
   KI-Cockpit Archiv V4.0
   Two-panel layout: filter + list | detail preview
   ======================================== */

// ---- State ----
let allSessions = [];
let projects = { geschäftlich: [], privat: [] };
let currentSession = null;       // Full session data shown in right panel
let currentSessionId = null;     // ID of highlighted session in list


// ========================================
// INIT
// ========================================

document.addEventListener('DOMContentLoaded', async () => {
    console.log('[archiv.js] V4.0 init');

    // Filter listeners
    document.getElementById('filterCategory').addEventListener('change', onCategoryChange);
    document.getElementById('filterProject').addEventListener('change', () => {
        updateDeleteProjectButton();
        applyFilters();
    });

    // Load data
    await loadData();

    // If opened via ?session=ID (e.g. via "Laden" button in another tab), auto-preview
    const params = new URLSearchParams(window.location.search);
    const sessionParam = params.get('session');
    if (sessionParam) {
        await previewSession(sessionParam);
    }
});

async function loadData() {
    await Promise.all([loadProjects(), loadSessions()]);
}

async function refreshSessions() {
    allSessions = [];
    currentSession = null;
    currentSessionId = null;

    // Reset right panel
    showRightPanel('placeholder');

    await loadData();
}


// ========================================
// PROJECTS
// ========================================

async function loadProjects() {
    try {
        const result = await getProjects();
        if (result && result.status === 'success' && result.data) {
            projects = result.data;
            updateProjectDropdown();
        }
    } catch (e) {
        console.warn('[archiv.js] Projekte konnten nicht geladen werden:', e.message);
    }
}

function onCategoryChange() {
    updateProjectDropdown();
    updateDeleteProjectButton();
    applyFilters();
}

function updateProjectDropdown() {
    const category = document.getElementById('filterCategory').value;
    const select = document.getElementById('filterProject');

    select.innerHTML = '<option value="">Alle Projekte</option>';

    const list = category
        ? (projects[category] || [])
        : [...new Set([...(projects.geschäftlich || []), ...(projects.privat || [])])].sort();

    list.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p;
        opt.textContent = p;
        select.appendChild(opt);
    });
}


/** Show/hide the 🗑 project-delete button depending on selection */
function updateDeleteProjectButton() {
    const project  = document.getElementById('filterProject').value;
    const category = document.getElementById('filterCategory').value;
    const btn      = document.getElementById('btnDeleteProject');
    if (btn) {
        btn.classList.toggle('hidden', !project || !category);
    }
}

/**
 * Delete the currently selected (empty) project folder from Google Drive.
 * Backend will refuse if the folder still contains sessions.
 */
async function deleteProject() {
    const project  = document.getElementById('filterProject').value;
    const category = document.getElementById('filterCategory').value;

    if (!project || !category) return;

    if (!confirm(`Projekt "${project}" (${category}) wirklich löschen?\n\nDer Ordner wird auf Google Drive in den Papierkorb verschoben.\nNur möglich wenn das Projekt keine Sessions enthält.`)) return;

    const btn = document.getElementById('btnDeleteProject');
    btn.textContent  = '…';
    btn.disabled     = true;

    try {
        const response = await fetch(BACKEND_URL, {
            method:   'POST',
            redirect: 'follow',
            headers:  { 'Content-Type': 'text/plain' },
            body:     JSON.stringify({ action: 'deleteProject', category, project })
        });
        const result = await response.json();

        if (result.status === 'success') {
            showToast(`Projekt "${project}" gelöscht ✓`, 'success');

            // Remove from local projects cache
            if (projects[category]) {
                projects[category] = projects[category].filter(p => p !== project);
            }

            // Reset filters and re-render
            document.getElementById('filterProject').value = '';
            updateProjectDropdown();
            updateDeleteProjectButton();
            applyFilters();
        } else {
            showToast('Fehler: ' + (result.message || 'Unbekannt'), 'error');
        }
    } catch (e) {
        console.error('[archiv.js] deleteProject error:', e);
        showToast('Verbindungsfehler', 'error');
    } finally {
        btn.textContent = '🗑';
        btn.disabled    = false;
    }
}

// ========================================
// SESSIONS LIST
// ========================================

async function loadSessions() {
    const listEl = document.getElementById('sessionList');
    listEl.innerHTML = '<div class="loading-indicator"><div class="spinner"></div><span>Wird geladen…</span></div>';

    try {
        const result = await listSessions();

        if (result && result.status === 'success' && Array.isArray(result.data)) {
            allSessions = result.data;
            console.log('[archiv.js] Sessions geladen:', allSessions.length);
            applyFilters();
        } else {
            const msg = (result && result.message) ? result.message : 'Unbekannter Fehler';
            listEl.innerHTML = `<div class="error-state">⚠️ Fehler beim Laden:<br>${escapeHtml(msg)}</div>`;
        }
    } catch (e) {
        console.error('[archiv.js] Fehler beim Laden:', e);
        listEl.innerHTML = `<div class="error-state">⚠️ Verbindungsfehler:<br>${escapeHtml(e.message)}</div>`;
    }
}

function applyFilters() {
    const category = document.getElementById('filterCategory').value;
    const project  = document.getElementById('filterProject').value;

    const filtered = allSessions.filter(s => {
        if (category && s.category !== category) return false;
        if (project  && s.project  !== project)  return false;
        return true;
    });

    document.getElementById('sessionCount').textContent =
        `${filtered.length} Session${filtered.length !== 1 ? 's' : ''}`;

    renderList(filtered);
}

function renderList(sessions) {
    const listEl = document.getElementById('sessionList');

    if (!sessions.length) {
        listEl.innerHTML = '<div class="empty-state">📭 Keine Sessions gefunden</div>';
        updateProjectDatalist();
        return;
    }

    listEl.innerHTML = sessions.map(s => buildItemHtml(s)).join('');
    updateProjectDatalist();
}

function buildItemHtml(s) {
    const id       = s.id;
    const title    = escapeHtml(s.displayTitle || s.name || 'Unbenannte Session');
    const date     = formatDate(s.timestamp);
    const cat      = s.category || 'privat';
    const catLabel = cat === 'geschäftlich' ? 'Geschäftlich' : 'Privat';
    const proj     = escapeHtml(s.project || 'Allgemein');
    const selPriv  = cat === 'privat'       ? 'selected' : '';
    const selGes   = cat === 'geschäftlich' ? 'selected' : '';

    return `
<div class="session-item" id="item-${id}" data-id="${id}">
  <div class="item-view">
    <div class="item-info" onclick="previewSession('${id}')">
      <span class="item-title">${title}</span>
      <div class="item-meta">
        <span class="badge badge-${cat}">${catLabel}</span>
        <span class="badge badge-secondary">${proj}</span>
        <span class="item-date">${date}</span>
      </div>
    </div>
    <div class="item-actions">
      <button class="btn-action btn-delete" onclick="deleteItem(event,'${id}')">Löschen</button>
      <button class="btn-action btn-load"   onclick="loadItem(event,'${id}')">Laden</button>
      <button class="btn-action btn-edit"   onclick="toggleEdit(event,'${id}')">Bearbeiten</button>
    </div>
  </div>
  <div class="item-edit-form" id="editform-${id}" style="display:none">
    <div class="edit-fields">
      <select class="edit-cat" id="editcat-${id}">
        <option value="privat" ${selPriv}>Privat</option>
        <option value="geschäftlich" ${selGes}>Geschäftlich</option>
      </select>
      <input class="edit-proj" id="editproj-${id}" type="text"
             value="${escapeHtml(s.project || '')}"
             placeholder="Projektname"
             list="allProjectsList">
    </div>
    <div class="edit-actions">
      <button class="btn-action btn-save" onclick="saveEdit(event,'${id}')">✓ Speichern</button>
      <button class="btn-action btn-cancel" onclick="cancelEdit(event,'${id}')">✕ Abbrechen</button>
    </div>
  </div>
</div>`;
}

function updateProjectDatalist() {
    const dl = document.getElementById('allProjectsList');
    if (!dl) return;
    const all = [...new Set([...(projects.geschäftlich || []), ...(projects.privat || [])])].sort();
    dl.innerHTML = all.map(p => `<option value="${escapeHtml(p)}">`).join('');
}


// ========================================
// PREVIEW (right panel)
// ========================================

async function previewSession(id) {
    // Highlight in list
    document.querySelectorAll('.session-item').forEach(el => el.classList.remove('active'));
    const item = document.getElementById(`item-${id}`);
    if (item) {
        item.classList.add('active');
        item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }

    currentSessionId = id;
    showRightPanel('loading');

    try {
        const result = await getSession(id);

        if (result && result.status === 'success' && result.data) {
            currentSession = result.data;
            renderDetail(result.data);
            showRightPanel('detail');
        } else {
            showRightPanel('placeholder');
            showToast('Fehler: ' + ((result && result.message) || 'Unbekannt'), 'error');
        }
    } catch (e) {
        console.error('[archiv.js] previewSession error:', e);
        showRightPanel('placeholder');
        showToast('Verbindungsfehler', 'error');
    }
}

function renderDetail(sessionData) {
    // sessionData may be wrapped: { data: {...} } or flat
    const d = sessionData.data || sessionData;

    document.getElementById('detailTitle').textContent =
        d.name || d.titleSlug || 'Session Details';

    const catEl = document.getElementById('detailCategory');
    const cat   = d.category || 'privat';
    catEl.textContent = cat === 'geschäftlich' ? 'Geschäftlich' : 'Privat';
    catEl.className   = `badge badge-${cat}`;

    document.getElementById('detailProject').textContent = d.project || 'Allgemein';
    document.getElementById('detailDate').textContent    = formatDate(d.timestamp);
    document.getElementById('detailProblem').value       = d.problem || '';
    document.getElementById('detailSynthesis').value     = extractSynthesisText(d.synthesis);
}


// ========================================
// ITEM ACTIONS
// ========================================

/** Open session in new tab – full single-column detail page */
function loadItem(event, id) {
    event.stopPropagation();
    window.open(`session.html?id=${encodeURIComponent(id)}`, '_blank');
}

/** Toggle inline edit form */
function toggleEdit(event, id) {
    event.stopPropagation();
    const form = document.getElementById(`editform-${id}`);
    form.style.display = form.style.display === 'none' ? 'block' : 'none';
}

function cancelEdit(event, id) {
    event.stopPropagation();
    document.getElementById(`editform-${id}`).style.display = 'none';
}

/** Save category/project and move file on Google Drive */
async function saveEdit(event, id) {
    event.stopPropagation();

    const newCategory = document.getElementById(`editcat-${id}`).value;
    const newProject  = document.getElementById(`editproj-${id}`).value.trim();

    if (!newProject) {
        showToast('Bitte Projektname eingeben', 'warning');
        return;
    }

    const btn = event.currentTarget;
    btn.textContent = 'Speichert…';
    btn.disabled    = true;

    try {
        const response = await fetch(BACKEND_URL, {
            method: 'POST',
            redirect: 'follow',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({ action: 'moveSession', id, category: newCategory, project: newProject })
        });
        const result = await response.json();

        if (result.status === 'success') {
            showToast('Session verschoben ✓', 'success');
            document.getElementById(`editform-${id}`).style.display = 'none';

            // Update local data
            const s = allSessions.find(x => x.id === id);
            if (s) { s.category = newCategory; s.project = newProject; }

            // Patch DOM badges without full re-render
            const itemEl = document.getElementById(`item-${id}`);
            if (itemEl) {
                const catBadge  = itemEl.querySelector('.item-meta .badge:first-child');
                const projBadge = itemEl.querySelector('.item-meta .badge-secondary');
                if (catBadge)  { catBadge.className   = `badge badge-${newCategory}`; catBadge.textContent = newCategory === 'geschäftlich' ? 'Geschäftlich' : 'Privat'; }
                if (projBadge) { projBadge.textContent = newProject; }
            }

            // Refresh right panel if this session is currently displayed
            if (currentSession) {
                const d = currentSession.data || currentSession;
                if (d.id === id || currentSession.id === id) {
                    d.category = newCategory;
                    d.project  = newProject;
                    renderDetail(currentSession);
                }
            }
        } else {
            showToast('Fehler: ' + (result.message || 'Unbekannt'), 'error');
        }
    } catch (e) {
        console.error('[archiv.js] saveEdit error:', e);
        showToast('Verbindungsfehler', 'error');
    } finally {
        btn.textContent = '✓ Speichern';
        btn.disabled    = false;
    }
}

/** Delete session from Google Drive */
async function deleteItem(event, id) {
    event.stopPropagation();

    const session  = allSessions.find(s => s.id === id);
    const titleStr = session ? (session.displayTitle || session.name || 'diese Session') : 'diese Session';

    if (!confirm(`"${titleStr}" wirklich löschen?\n\nDie Datei wird in Google Drive in den Papierkorb verschoben.`)) return;

    try {
        const response = await fetch(BACKEND_URL, {
            method: 'POST',
            redirect: 'follow',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({ action: 'deleteSession', id })
        });
        const result = await response.json();

        if (result.status === 'success') {
            allSessions = allSessions.filter(s => s.id !== id);
            applyFilters();

            // Clear right panel if it was showing this session
            if (currentSessionId === id) {
                currentSession   = null;
                currentSessionId = null;
                showRightPanel('placeholder');
            }

            showToast('Session gelöscht', 'success');
        } else {
            showToast('Fehler: ' + (result.message || 'Unbekannt'), 'error');
        }
    } catch (e) {
        console.error('[archiv.js] deleteItem error:', e);
        showToast('Verbindungsfehler', 'error');
    }
}


// ========================================
// COPY ACTIONS
// ========================================

function copyAsMarkdown() {
    if (!currentSession) return;
    const d  = currentSession.data || currentSession;
    const md = buildMarkdown(d);
    navigator.clipboard.writeText(md)
        .then(() => showToast('Markdown kopiert ✓', 'success'))
        .catch(() => showToast('Kopieren fehlgeschlagen', 'error'));
}

function copyAsTxt() {
    if (!currentSession) return;
    const d   = currentSession.data || currentSession;
    const txt = buildTxt(d);
    navigator.clipboard.writeText(txt)
        .then(() => showToast('Text kopiert ✓', 'success'))
        .catch(() => showToast('Kopieren fehlgeschlagen', 'error'));
}

function buildMarkdown(d) {
    const title    = d.name || 'Session';
    const date     = formatDate(d.timestamp);
    const problem  = d.problem || '';
    const synthesis = extractSynthesisText(d.synthesis);

    let md = `# ${title}\n\n`;
    md += `**Kategorie:** ${d.category || 'privat'} | **Projekt:** ${d.project || 'Allgemein'} | **Datum:** ${date}\n\n`;
    md += `---\n\n## Problemstellung\n\n${problem}\n\n`;

    // Q&A
    const questions = d.deduplicatedQuestions || [];
    const answers   = d.answers || [];
    if (questions.length > 0) {
        md += `## Fragen & Antworten\n\n`;
        questions.forEach((q, i) => {
            const qText = typeof q === 'string' ? q : (q.question || String(q));
            md += `**${i + 1}. ${qText}**\n${answers[i] || '–'}\n\n`;
        });
    }

    // KI Solutions
    const phase2 = d.phase2Outputs || {};
    if (phase2.chatgpt || phase2.claude || phase2.gemini) {
        md += `## KI-Lösungen\n\n`;
        if (phase2.chatgpt) md += `### ChatGPT\n${phase2.chatgpt}\n\n`;
        if (phase2.claude)  md += `### Claude\n${phase2.claude}\n\n`;
        if (phase2.gemini)  md += `### Gemini\n${phase2.gemini}\n\n`;
    }

    md += `## Synthese\n\n${synthesis}\n\n---\n*Exportiert aus Asinito KI-Cockpit*`;
    return md;
}

function buildTxt(d) {
    const title    = d.name || 'Session';
    const date     = formatDate(d.timestamp);
    const problem  = d.problem || '';
    const synthesis = extractSynthesisText(d.synthesis);

    const line = '─'.repeat(50);
    let txt = `${title}\n${line}\n`;
    txt += `Kategorie: ${d.category || 'privat'} | Projekt: ${d.project || 'Allgemein'} | Datum: ${date}\n\n`;
    txt += `PROBLEMSTELLUNG\n${line}\n${problem}\n\n`;
    txt += `SYNTHESE\n${line}\n${synthesis}\n\n`;
    txt += `${line}\nExportiert aus Asinito KI-Cockpit`;
    return txt;
}


// ========================================
// RIGHT PANEL VISIBILITY
// ========================================

function showRightPanel(mode) {
    // mode: 'placeholder' | 'loading' | 'detail'
    const placeholder = document.getElementById('rightPlaceholder');
    const loading     = document.getElementById('rightLoading');
    const detail      = document.getElementById('sessionDetail');

    placeholder.classList.toggle('hidden', mode !== 'placeholder');
    loading.classList.toggle('hidden',     mode !== 'loading');
    detail.classList.toggle('hidden',      mode !== 'detail');
}


// ========================================
// HELPERS
// ========================================

function extractSynthesisText(synthesis) {
    if (!synthesis) return 'Keine Synthese vorhanden';

    if (typeof synthesis === 'string') {
        try {
            const p = JSON.parse(synthesis);
            return p.data?.synthesis || p.synthesis || synthesis;
        } catch (e) { return synthesis; }
    }

    if (typeof synthesis === 'object') {
        return synthesis.data?.synthesis || synthesis.synthesis || synthesis.text
            || JSON.stringify(synthesis, null, 2);
    }

    return String(synthesis);
}

function formatDate(ts) {
    if (!ts) return '';
    try {
        const d = new Date(typeof ts === 'string' ? ts.replace('_', 'T') : ts);
        if (isNaN(d.getTime())) return String(ts);
        return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch (e) { return String(ts); }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className   = `toast ${type}`;
    toast.classList.remove('hidden');
    const duration = (type === 'error' || type === 'warning') ? 8000 : 3000;
    setTimeout(() => toast.classList.add('hidden'), duration);
}
