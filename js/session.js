/* ========================================
   KI-Cockpit Session Detail V1.0
   Vollansicht einer einzelnen Session
   ======================================== */

let sessionData = null;

// ========================================
// INIT
// ========================================

document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const id     = params.get('id');

    if (!id) {
        showError('Keine Session-ID in der URL angegeben.');
        return;
    }

    try {
        const result = await getSession(id);

        if (result && result.status === 'success' && result.data) {
            sessionData = result.data.data || result.data;
            renderSession(sessionData);
            showContent();
        } else {
            showError((result && result.message) || 'Session konnte nicht geladen werden.');
        }
    } catch (e) {
        console.error('[session.js] Fehler:', e);
        showError('Verbindungsfehler: ' + e.message);
    }
});


// ========================================
// RENDER
// ========================================

function renderSession(d) {
    // Page title
    const title = d.name || d.titleSlug || 'Session';
    document.title = `Asinito – ${title}`;

    // Top bar
    const cat = d.category || 'privat';
    const catEl = document.getElementById('topbarCategory');
    catEl.textContent = cat === 'geschäftlich' ? 'Geschäftlich' : 'Privat';
    catEl.className   = `badge badge-${cat}`;
    document.getElementById('topbarProject').textContent = d.project || 'Allgemein';
    document.getElementById('topbarDate').textContent    = formatDate(d.timestamp);

    // Title
    document.getElementById('sessionTitle').textContent = title;

    // 1. Problemstellung
    document.getElementById('sectionProblem').textContent = d.problem || 'Keine Problemstellung gespeichert.';

    // 2. Fragen & Antworten
    const questions = d.deduplicatedQuestions || [];
    const answers   = d.answers || [];

    if (questions.length > 0) {
        const qaList = document.getElementById('sectionQA');
        qaList.innerHTML = questions.map((q, i) => {
            const qText = typeof q === 'string' ? q : (q.question || String(q));
            const aText = answers[i] || '–';
            return `
            <div class="qa-item">
                <div class="qa-question">
                    <span class="qa-num">${i + 1}</span>
                    <span>${escapeHtml(qText)}</span>
                </div>
                <div class="qa-answer">${escapeHtml(aText)}</div>
            </div>`;
        }).join('');
    } else {
        document.getElementById('sectionQAWrap').style.display = 'none';
    }

    // 3. KI-Lösungen
    const phase2 = d.phase2Outputs || {};
    if (phase2.chatgpt || phase2.claude || phase2.gemini) {
        document.getElementById('solutionChatgpt').textContent = phase2.chatgpt || 'Keine Antwort gespeichert.';
        document.getElementById('solutionClaude').textContent  = phase2.claude  || 'Keine Antwort gespeichert.';
        document.getElementById('solutionGemini').textContent  = phase2.gemini  || 'Keine Antwort gespeichert.';
    } else {
        document.getElementById('sectionSolutionsWrap').style.display = 'none';
    }

    // 4. Synthese
    const synthText = extractSynthesisText(d.synthesis);
    if (synthText && synthText !== 'Keine Synthese vorhanden') {
        document.getElementById('sectionSynthesis').innerHTML = formatMarkdown(synthText);
    } else {
        document.getElementById('sectionSynthesisWrap').style.display = 'none';
    }
}


// ========================================
// TITLE EDITING
// ========================================

function startTitleEdit() {
    const currentTitle = document.getElementById('sessionTitle').textContent;
    document.getElementById('titleInput').value = currentTitle;
    document.getElementById('titleView').classList.add('hidden');
    document.getElementById('titleEdit').classList.remove('hidden');
    document.getElementById('titleInput').focus();
    document.getElementById('titleInput').select();
}

function cancelTitleEdit() {
    document.getElementById('titleEdit').classList.add('hidden');
    document.getElementById('titleView').classList.remove('hidden');
}

async function saveTitle() {
    const newTitle = document.getElementById('titleInput').value.trim();
    if (!newTitle) {
        showToast('Titel darf nicht leer sein', 'warning');
        return;
    }

    const params = new URLSearchParams(window.location.search);
    const id     = params.get('id');
    if (!id) return;

    const btn = document.getElementById('btnSaveTitle');
    btn.textContent = 'Speichert…';
    btn.disabled    = true;

    try {
        const response = await fetch(BACKEND_URL, {
            method:   'POST',
            redirect: 'follow',
            headers:  { 'Content-Type': 'text/plain' },
            body:     JSON.stringify({ action: 'renameSession', id, newTitle })
        });
        const result = await response.json();

        if (result.status === 'success') {
            // Update UI
            document.getElementById('sessionTitle').textContent = newTitle;
            document.title = `Asinito – ${newTitle}`;
            // Update local data
            if (sessionData) { sessionData.name = newTitle; }
            cancelTitleEdit();
            showToast('Titel gespeichert ✓', 'success');
        } else {
            showToast('Fehler: ' + (result.message || 'Unbekannt'), 'error');
        }
    } catch (e) {
        console.error('[session.js] saveTitle error:', e);
        showToast('Verbindungsfehler', 'error');
    } finally {
        btn.textContent = 'Speichern';
        btn.disabled    = false;
    }
}

// ========================================
// COPY ACTIONS
// ========================================

function copyAsMarkdown() {
    if (!sessionData) return;
    const md = buildMarkdown(sessionData);
    navigator.clipboard.writeText(md)
        .then(() => showToast('Markdown kopiert ✓', 'success'))
        .catch(() => showToast('Kopieren fehlgeschlagen', 'error'));
}

function copyAsTxt() {
    if (!sessionData) return;
    const txt = buildTxt(sessionData);
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
    md += `---\n\n`;
    md += `## Problemstellung\n\n${problem}\n\n`;

    const questions = d.deduplicatedQuestions || [];
    const answers   = d.answers || [];
    if (questions.length > 0) {
        md += `## Fragen & Antworten\n\n`;
        questions.forEach((q, i) => {
            const qText = typeof q === 'string' ? q : (q.question || String(q));
            md += `**${i + 1}. ${qText}**\n${answers[i] || '–'}\n\n`;
        });
    }

    const phase2 = d.phase2Outputs || {};
    if (phase2.chatgpt || phase2.claude || phase2.gemini) {
        md += `## KI-Lösungen\n\n`;
        if (phase2.chatgpt) md += `### ChatGPT\n${phase2.chatgpt}\n\n`;
        if (phase2.claude)  md += `### Claude\n${phase2.claude}\n\n`;
        if (phase2.gemini)  md += `### Gemini\n${phase2.gemini}\n\n`;
    }

    if (synthesis && synthesis !== 'Keine Synthese vorhanden') {
        md += `## Synthese\n\n${synthesis}\n\n`;
    }

    md += `---\n*Exportiert aus Asinito KI-Cockpit*`;
    return md;
}

function buildTxt(d) {
    const title    = d.name || 'Session';
    const date     = formatDate(d.timestamp);
    const problem  = d.problem || '';
    const synthesis = extractSynthesisText(d.synthesis);
    const line = '─'.repeat(60);

    let txt = `${title}\n${line}\n`;
    txt += `Kategorie: ${d.category || 'privat'} | Projekt: ${d.project || 'Allgemein'} | Datum: ${date}\n\n`;

    txt += `PROBLEMSTELLUNG\n${line}\n${problem}\n\n`;

    const questions = d.deduplicatedQuestions || [];
    const answers   = d.answers || [];
    if (questions.length > 0) {
        txt += `FRAGEN & ANTWORTEN\n${line}\n`;
        questions.forEach((q, i) => {
            const qText = typeof q === 'string' ? q : (q.question || String(q));
            txt += `${i + 1}. ${qText}\n   → ${answers[i] || '–'}\n\n`;
        });
    }

    const phase2 = d.phase2Outputs || {};
    if (phase2.chatgpt || phase2.claude || phase2.gemini) {
        txt += `KI-LÖSUNGEN\n${line}\n`;
        if (phase2.chatgpt) txt += `ChatGPT:\n${phase2.chatgpt}\n\n`;
        if (phase2.claude)  txt += `Claude:\n${phase2.claude}\n\n`;
        if (phase2.gemini)  txt += `Gemini:\n${phase2.gemini}\n\n`;
    }

    if (synthesis && synthesis !== 'Keine Synthese vorhanden') {
        txt += `SYNTHESE\n${line}\n${synthesis}\n\n`;
    }

    txt += `${line}\nExportiert aus Asinito KI-Cockpit`;
    return txt;
}


// ========================================
// UI STATE
// ========================================

function showContent() {
    document.getElementById('pageLoading').classList.add('hidden');
    document.getElementById('sessionContent').classList.remove('hidden');
}

function showError(msg) {
    document.getElementById('pageLoading').classList.add('hidden');
    document.getElementById('errorMessage').textContent = msg;
    document.getElementById('pageError').classList.remove('hidden');
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

function formatMarkdown(text) {
    if (!text) return '';
    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    text = text
        .replace(/^###\s+(.+)$/gm, '<h4>$1</h4>')
        .replace(/^##\s+(.+)$/gm,  '<h3>$1</h3>')
        .replace(/^#\s+(.+)$/gm,   '<h2>$1</h2>');
    text = text
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g,     '<em>$1</em>');
    text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
    text = text
        .split(/\n{2,}/)
        .map(para => para.trim() ? `<p>${para.replace(/\n/g, '<br>')}</p>` : '')
        .join('');
    return text;
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
