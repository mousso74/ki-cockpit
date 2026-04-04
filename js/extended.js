/* ========================================
   KI-Cockpit V4.0 – Erweiterte Analyse
   9-State Flow mit Cross-Review Runde
   ======================================== */

// ----------------------------------------
// State
// ----------------------------------------

let extCurrentState = 0;
const EXT_MAX_STATE = 8;

let extSession = {
    id:        'ext-' + Date.now(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    category:  '',
    project:   '',
    problem:   '',
    template:  'extended',

    phase1Prompt: '',
    aiQuestions:  { chatgpt: '', claude: '', gemini: '', deepseek: '' },

    deduplicatedQuestions: [],
    answers: [],

    phase2Prompt:    '',
    aiSolutions_r1:  { chatgpt: '', claude: '', gemini: '', deepseek: '' },   // Runde 1
    crossReviewPrompts: { chatgpt: '', claude: '', gemini: '', deepseek: '' }, // Cross-Review Prompts
    aiSolutions_r2:  { chatgpt: '', claude: '', gemini: '', deepseek: '' },   // Runde 2 (überarbeitet)

    synthesis: null
};

// ----------------------------------------
// Cross-Review Prompt Template
// ----------------------------------------

const CR_SYSTEM = `You are a strict solution-refinement engine.

Your task is to critically analyse two competing solutions from other AI assistants and produce an improved, superior answer that combines the best insights from all three perspectives.

ABSOLUTE RULES (non-negotiable):
- Output ONLY the sections defined in the OUTPUT FORMAT below.
- Do NOT add any text before, between, or after those sections.
- Do NOT add explanations, commentary, apologies, or follow-up offers.
- Be specific and honest in your critique — name concrete points, not vague generalities.
- Clearly state WHAT you adopt and WHY, and WHAT you reject and WHY.
- If these rules are violated, the output is invalid.

LANGUAGE: Respond in German.

You must internally verify compliance with all rules before responding.
If compliance is not met, correct the output silently before returning it.`;

const CR_USER = `Du hast das folgende Problem bereits eigenständig analysiert und gelöst.
Jetzt erhältst du die Antworten der anderen KI-Assistenten zum selben Problem.
Deine Aufgabe: kritisch analysieren, das Beste übernehmen, Fehler benennen, verbesserte Gesamtantwort erstellen.

[PROBLEM]
{PROBLEM_TEXT}
[/PROBLEM]

[KLÄRENDE_FRAGEN_UND_ANTWORTEN]
{QA_BLOCK}
[/KLÄRENDE_FRAGEN_UND_ANTWORTEN]

[DEINE_URSPRÜNGLICHE_ANTWORT]
{OWN_ANSWER}
[/DEINE_URSPRÜNGLICHE_ANTWORT]

{OTHERS_BLOCK}

[AUFGABE]
1. Analysiere die Antworten der beiden anderen KIs.
2. Übernimm das Gute in deine verbesserte Antwort.
3. Benenne konkret, was falsch, unvollständig oder suboptimal ist.
4. Erstelle eine vollständige, verbesserte Gesamtantwort.

[OUTPUT_FORMAT]
Antworte GENAU mit folgender Struktur und nichts anderem:

[ÜBERNAHMEN]
Was du aus den anderen Antworten übernimmst (konkret benennen + Begründung):
- ...
[/ÜBERNAHMEN]

[KRITIK]
Was an den anderen Antworten falsch, unvollständig oder suboptimal ist (konkret benennen + Begründung):
- ...
[/KRITIK]

[VERBESSERTE_GESAMTANTWORT]
[STATUS]
- readiness: READY
- confidence: {0-100}
[/STATUS]

[FOLLOWUP_QUESTIONS]
NONE
[/FOLLOWUP_QUESTIONS]

[SOLUTION]
{Vollständige verbesserte Lösung}
[/SOLUTION]

[ACTION_PLAN]
{Konkrete nächste Schritte (nummeriert)}
[/ACTION_PLAN]

[RISKS]
{Risiken und Gegenmaßnahmen}
[/RISKS]

[ASSUMPTIONS]
{Annahmen oder NONE}
[/ASSUMPTIONS]
[/VERBESSERTE_GESAMTANTWORT]
[/OUTPUT_FORMAT]`;

/**
 * Generates the cross-review prompt for one KI dynamically.
 * @param {string} problem    - Problem text
 * @param {string} qaBlock    - Q&A block as formatted string
 * @param {string} ownAnswer  - This KI's own Runde-1 answer
 * @param {Array}  others     - Array of {name, answer} for all other participating KIs
 * @returns {string}          - Complete prompt (system + user combined)
 */
function generateCrossReviewPrompt(problem, qaBlock, ownAnswer, others) {
    // Build dynamic "other KIs" section
    const othersBlock = others.map((o, i) =>
        `[ANTWORT_ANDERER_KI_${i + 1} quelle="${o.name}"]\n${o.answer || '(keine Antwort eingegeben)'}\n[/ANTWORT_ANDERER_KI_${i + 1}]`
    ).join('\n\n');

    const userPart = CR_USER
        .replace('{PROBLEM_TEXT}', problem)
        .replace('{QA_BLOCK}',     qaBlock)
        .replace('{OWN_ANSWER}',   ownAnswer || '(keine Antwort eingegeben)')
        .replace('{OTHERS_BLOCK}', othersBlock);

    return `[SYSTEM]\n${CR_SYSTEM}\n[/SYSTEM]\n\n${userPart}`;
}


// ----------------------------------------
// Initialization
// ----------------------------------------

document.addEventListener('DOMContentLoaded', () => {
    console.log('[extended.js] V1.1 init');
    extShowState(0);

    // ── Check for handoff from index.html ──
    let handoff = null;
    try {
        const raw = sessionStorage.getItem('ki_handoff');
        if (raw) {
            handoff = JSON.parse(raw);
            sessionStorage.removeItem('ki_handoff'); // consume once
        }
    } catch (e) { /* ignore */ }

    if (handoff) {
        // Pre-fill category
        const catSel = document.getElementById('categorySelect');
        if (catSel && handoff.category) {
            catSel.value = handoff.category;
            extSession.category = handoff.category;
        }
        // Load project dropdown for this category, then set project
        extUpdateProjectDropdown(handoff.project).then(() => {
            const projSel = document.getElementById('projectSelect');
            if (projSel && handoff.project) {
                projSel.value = handoff.project;
                extSession.project = handoff.project;
            }
        });
        // Pre-fill title + problem
        const titleEl = document.getElementById('sessionTitle');
        if (titleEl && handoff.sessionTitle) titleEl.value = handoff.sessionTitle;
        const probEl = document.getElementById('problem-input');
        if (probEl && handoff.problem) probEl.value = handoff.problem;
    } else {
        extUpdateProjectDropdown();
    }

    // Category change
    document.getElementById('categorySelect')?.addEventListener('change', (e) => {
        extSession.category = e.target.value;
        extUpdateProjectDropdown();
    });

    // Project change
    document.getElementById('projectSelect')?.addEventListener('change', (e) => {
        const newProjGroup = document.getElementById('newProjectGroup');
        if (e.target.value === '__new__') {
            if (newProjGroup) { newProjGroup.style.display = 'block'; document.getElementById('newProjectName')?.focus(); }
        } else {
            if (newProjGroup) newProjGroup.style.display = 'none';
            extSession.project = e.target.value;
        }
    });
});


// ----------------------------------------
// Project Dropdown
// ----------------------------------------

async function extUpdateProjectDropdown() {
    const categorySelect = document.getElementById('categorySelect');
    const projectSelect  = document.getElementById('projectSelect');
    if (!categorySelect || !projectSelect) return;

    const category = categorySelect.value;
    projectSelect.innerHTML  = '<option value="">Projekt wählen...</option>';
    projectSelect.innerHTML += '<option value="__new__">+ Neues Projekt erstellen</option>';
    document.getElementById('newProjectGroup').style.display = 'none';

    try {
        const response = await fetch(`${BACKEND_URL}?action=getProjects`);
        const result   = await response.json();
        if (result.status === 'success' && result.data) {
            const projects = result.data[category] || [];
            projects.forEach(name => {
                const opt = document.createElement('option');
                opt.value = name; opt.textContent = name;
                projectSelect.appendChild(opt);
            });
        }
    } catch (e) {
        console.warn('[extended.js] Projects load error:', e.message);
    }
}

function extConfirmNewProject() {
    const input  = document.getElementById('newProjectName');
    const select = document.getElementById('projectSelect');
    const name   = input?.value.trim();
    if (!name) { extShowToast('Bitte Projektnamen eingeben', 'error'); return; }

    const opt = document.createElement('option');
    opt.value = name; opt.textContent = name;
    select.appendChild(opt);
    select.value = name;
    extSession.project = name;

    document.getElementById('newProjectGroup').style.display = 'none';
    input.value = '';
    extShowToast(`Projekt "${name}" hinzugefügt`, 'success');
}


// ----------------------------------------
// State Navigation
// ----------------------------------------

function extShowState(n) {
    if (n < 0 || n > EXT_MAX_STATE) return;

    document.querySelectorAll('.state-section').forEach(s => s.classList.remove('active'));
    document.getElementById(`state-${n}`)?.classList.add('active');

    document.querySelectorAll('.state-dot').forEach((dot, i) => {
        dot.classList.remove('active', 'completed');
        if (i < n)      dot.classList.add('completed');
        else if (i === n) dot.classList.add('active');
    });

    extCurrentState = n;
    extSession.updatedAt = new Date().toISOString();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function extNextState() { if (extCurrentState < EXT_MAX_STATE) extShowState(extCurrentState + 1); }
function extPrevState() { if (extCurrentState > 0) extShowState(extCurrentState - 1); }


// ----------------------------------------
// STATE 0 → 1: Generate Phase-1 Prompts
// ----------------------------------------

function extGeneratePrompts() {
    const categorySelect = document.getElementById('categorySelect');
    if (!categorySelect?.value) { extShowToast('Bitte Kategorie wählen.', 'error'); return; }
    extSession.category = categorySelect.value;

    const projectSelect = document.getElementById('projectSelect');
    const projVal = projectSelect?.value;
    if (projVal === '__new__') {
        const name = document.getElementById('newProjectName')?.value.trim();
        if (!name) { extShowToast('Bitte Projektnamen eingeben.', 'error'); return; }
        extSession.project = name;
    } else if (!projVal) {
        extShowToast('Bitte Projekt wählen.', 'error'); return;
    } else {
        extSession.project = projVal;
    }

    const title = document.getElementById('sessionTitle')?.value.trim();
    if (!title) { extShowToast('Bitte Session-Titel eingeben.', 'error'); document.getElementById('sessionTitle')?.focus(); return; }
    extSession.name = title;

    const problem = document.getElementById('problem-input')?.value.trim();
    if (!problem) { extShowToast('Bitte Problem beschreiben.', 'error'); document.getElementById('problem-input')?.focus(); return; }
    extSession.problem = problem;

    const prompt = generateQuestionsPrompt(problem);
    extSession.phase1Prompt = prompt;

    document.getElementById('phase1-prompt').textContent =
        `[SYSTEM]\n${prompt.system}\n[/SYSTEM]\n\n${prompt.user}`;

    extShowState(1);
}


// ----------------------------------------
// STATE 2 → 3: Analyze & Deduplicate Questions
// ----------------------------------------

async function extAnalyzeQuestions() {
    const chatgpt  = document.getElementById('chatgpt-questions')?.value.trim()  || '';
    const claude   = document.getElementById('claude-questions')?.value.trim()   || '';
    const gemini   = document.getElementById('gemini-questions')?.value.trim()   || '';
    const deepseek = document.getElementById('deepseek-questions')?.value.trim() || '';

    if (!chatgpt && !claude && !gemini && !deepseek) {
        extShowToast('Bitte mindestens eine KI-Antwort einfügen.', 'error'); return;
    }

    extSession.aiQuestions = { chatgpt, claude, gemini, deepseek };

    const container = document.getElementById('questions-container');
    container.innerHTML = '<div class="loading-text">🔄 Fragen werden dedupliziert…</div>';
    extShowState(3);

    try {
        // Parse questions from each participating KI (skip empty)
        const chatgptQs  = chatgpt  ? extractQuestions(chatgpt,  'chatgpt')  : [];
        const claudeQs   = claude   ? extractQuestions(claude,   'claude')   : [];
        const geminiQs   = gemini   ? extractQuestions(gemini,   'gemini')   : [];
        const deepseekQs = deepseek ? extractQuestions(deepseek, 'deepseek') : [];

        console.log('[extended.js] Questions parsed:', chatgptQs.length, claudeQs.length, geminiQs.length, deepseekQs.length);

        // Deduplicate via backend
        const response = await fetch(BACKEND_URL, {
            method: 'POST', redirect: 'follow',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
                action: 'deduplicateQuestions',
                originalProblem: extSession.problem,
                questions: { chatgpt: chatgptQs, claude: claudeQs, gemini: geminiQs, deepseek: deepseekQs }
            })
        });

        const result = await response.json();

        if (result.status === 'success' && Array.isArray(result.data)) {
            extSession.deduplicatedQuestions = result.data;
            extRenderQuestions(result.data);
        } else {
            extShowToast('⚠️ Gemini-Fehler: ' + (result.message || 'Unbekannt'), 'warning');
            // Fallback: show all questions unsorted
            const allQs = [...chatgptQs, ...claudeQs, ...geminiQs].map(q => ({ question: q, priority: 'P2' }));
            extSession.deduplicatedQuestions = allQs;
            extRenderQuestions(allQs);
        }
    } catch (e) {
        console.error('[extended.js] analyzeQuestions error:', e);
        extShowToast('Verbindungsfehler beim Deduplizieren: ' + e.message, 'error');
        container.innerHTML = '<p style="color:var(--error)">Fehler: ' + e.message + '</p>';
    }
}

function extRenderQuestions(questions) {
    const container = document.getElementById('questions-container');
    if (!questions.length) {
        container.innerHTML = '<p>Keine Fragen gefunden.</p>'; return;
    }

    container.innerHTML = questions.map((q, i) => {
        const qText    = typeof q === 'string' ? q : (q.question || String(q));
        const priority = typeof q === 'object' ? (q.priority || 'P2') : 'P2';
        const pClass   = priority === 'P1' ? 'priority-p1' : (priority === 'P3' ? 'priority-p3' : 'priority-p2');
        return `
        <div class="question-item ${pClass}">
            <div class="question-label">
                <span class="question-number">${i + 1}</span>
                <span class="priority-badge">${priority}</span>
                <span class="question-text">${escapeHtml(qText)}</span>
            </div>
            <textarea class="answer-input" id="answer-${i}" placeholder="Antwort…" rows="2"></textarea>
        </div>`;
    }).join('');
}


// ----------------------------------------
// STATE 3 → 4: Generate Solve Prompts
// ----------------------------------------

function extGenerateSolvePrompts() {
    const questions = extSession.deduplicatedQuestions;
    const answers   = questions.map((_, i) =>
        document.getElementById(`answer-${i}`)?.value.trim() || ''
    );

    extSession.answers = answers;

    const qaArray = questions.map((q, i) => ({
        question: typeof q === 'string' ? q : (q.question || String(q)),
        answer:   answers[i] || '(nicht beantwortet)'
    }));

    const prompt = generateSolvePrompt(extSession.problem, qaArray);
    extSession.phase2Prompt = prompt;

    document.getElementById('phase2-prompt').textContent =
        `[SYSTEM]\n${prompt.system}\n[/SYSTEM]\n\n${prompt.user}`;

    extShowState(4);
}


// ----------------------------------------
// STATE 5 → 6: Generate Cross-Review Prompts
// ----------------------------------------

function extGenerateCrossReviewPrompts() {
    // Collect all participating KIs (non-empty answers only)
    const ALL_KIS = [
        { key: 'chatgpt',  name: 'ChatGPT',  answer: document.getElementById('chatgpt-solution-r1')?.value.trim()  || '' },
        { key: 'claude',   name: 'Claude',   answer: document.getElementById('claude-solution-r1')?.value.trim()   || '' },
        { key: 'gemini',   name: 'Gemini',   answer: document.getElementById('gemini-solution-r1')?.value.trim()   || '' },
        { key: 'deepseek', name: 'DeepSeek', answer: document.getElementById('deepseek-solution-r1')?.value.trim() || '' },
    ];

    const participating = ALL_KIS.filter(ki => ki.answer.length > 0);

    if (participating.length < 2) {
        extShowToast('Bitte mindestens zwei KI-Lösungen einfügen damit Cross-Review möglich ist.', 'error');
        return;
    }

    // Save r1 solutions
    extSession.aiSolutions_r1 = Object.fromEntries(ALL_KIS.map(ki => [ki.key, ki.answer]));

    // Build Q&A block string
    const qaBlock = extSession.deduplicatedQuestions.map((q, i) => {
        const qText = typeof q === 'string' ? q : (q.question || String(q));
        return `F${i+1}: ${qText}\nA${i+1}: ${extSession.answers[i] || '(nicht beantwortet)'}`;
    }).join('\n\n');

    // Generate one prompt per participating KI (each sees all others' answers)
    const prompts = {};
    participating.forEach(ki => {
        const others = participating
            .filter(o => o.key !== ki.key)
            .map(o => ({ name: o.name, answer: o.answer }));

        prompts[ki.key] = generateCrossReviewPrompt(
            extSession.problem, qaBlock, ki.answer, others
        );
    });

    extSession.crossReviewPrompts = prompts;

    // Update tab visibility — show only participating KIs
    ALL_KIS.forEach(ki => {
        const tab   = document.getElementById(`cr-tab-${ki.key}`);
        const panel = document.getElementById(`cr-${ki.key}`);
        const isIn  = !!prompts[ki.key];

        if (tab)   tab.style.display   = isIn ? '' : 'none';
        if (panel) panel.classList.add('hidden');

        if (isIn && panel) {
            document.getElementById(`cr-prompt-${ki.key}`).textContent = prompts[ki.key];
        }
    });

    extShowState(6);

    // Activate first participating tab
    const firstKey = participating[0].key;
    const firstTab = document.getElementById(`cr-tab-${firstKey}`);
    extShowCRTab(firstKey, firstTab);
}


// ----------------------------------------
// STATE 6: Tab Switching
// ----------------------------------------

function extShowCRTab(ai, btn) {
    // Update tab buttons
    document.querySelectorAll('.cr-tab').forEach(t => t.classList.remove('active'));
    if (btn) btn.classList.add('active');

    // Show correct panel, hide others
    ['chatgpt', 'claude', 'gemini', 'deepseek'].forEach(name => {
        const panel = document.getElementById(`cr-${name}`);
        if (panel) panel.classList.toggle('hidden', name !== ai);
    });
}

function extCopyCRPrompt(ai) {
    const text = extSession.crossReviewPrompts[ai] || '';
    navigator.clipboard.writeText(text)
        .then(() => extShowToast(`Cross-Review Prompt für ${ai.charAt(0).toUpperCase() + ai.slice(1)} kopiert ✓`, 'success'))
        .catch(() => extShowToast('Kopieren fehlgeschlagen', 'error'));
}


// ----------------------------------------
// STATE 7 → 8: Synthesis
// ----------------------------------------

async function extStartSynthesis() {
    const r2ChatGPT  = document.getElementById('chatgpt-solution-r2')?.value.trim()  || '';
    const r2Claude   = document.getElementById('claude-solution-r2')?.value.trim()   || '';
    const r2Gemini   = document.getElementById('gemini-solution-r2')?.value.trim()   || '';
    const r2DeepSeek = document.getElementById('deepseek-solution-r2')?.value.trim() || '';

    if (!r2ChatGPT && !r2Claude && !r2Gemini && !r2DeepSeek) {
        extShowToast('Bitte die überarbeiteten Lösungen einfügen.', 'error'); return;
    }

    extSession.aiSolutions_r2 = { chatgpt: r2ChatGPT, claude: r2Claude, gemini: r2Gemini, deepseek: r2DeepSeek };

    const btn = document.getElementById('synthesis-btn');
    btn.textContent = '⏳ Synthese läuft…';
    btn.disabled    = true;

    try {
        const response = await fetch(BACKEND_URL, {
            method: 'POST', redirect: 'follow',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
                action:   'synthesize',
                problem:  extSession.problem,
                solutions: {
                    chatgpt:  r2ChatGPT  || undefined,
                    claude:   r2Claude   || undefined,
                    gemini:   r2Gemini   || undefined,
                    deepseek: r2DeepSeek || undefined
                }
            })
        });

        const result = await response.json();

        if (result.status === 'success' && result.data) {
            const synthesisText = result.data.synthesis || JSON.stringify(result.data);
            extSession.synthesis = synthesisText;

            document.getElementById('synthesis-content').innerHTML = formatMarkdown(synthesisText);
            document.getElementById('synthesis-result').classList.remove('hidden');
            btn.textContent = '✅ Synthese abgeschlossen';
        } else {
            extShowToast('Synthese-Fehler: ' + (result.message || 'Unbekannt'), 'error');
            btn.textContent = '🔮 Bestlösung synthetisieren';
            btn.disabled    = false;
        }
    } catch (e) {
        console.error('[extended.js] synthesis error:', e);
        extShowToast('Verbindungsfehler: ' + e.message, 'error');
        btn.textContent = '🔮 Bestlösung synthetisieren';
        btn.disabled    = false;
    }
}


// ----------------------------------------
// Save / Reset
// ----------------------------------------

async function extSaveSession() {
    // Build save payload compatible with existing archive
    const payload = {
        id:         extSession.id,
        name:       extSession.name || 'Erweiterte Session',
        titleSlug:  makeSlug(extSession.name || 'erweiterte-session'),
        category:   extSession.category,
        project:    extSession.project,
        problem:    extSession.problem,
        template:   'extended',
        timestamp:  new Date().toISOString(),
        createdAt:  extSession.createdAt,
        deduplicatedQuestions: extSession.deduplicatedQuestions,
        answers:    extSession.answers,
        phase2Outputs: extSession.aiSolutions_r1,   // Runde 1
        aiSolutions_r2: extSession.aiSolutions_r2,  // Runde 2
        synthesis:  extSession.synthesis
    };

    try {
        const result = await saveSession(payload);
        if (result.success) {
            extShowToast('✅ Session auf Google Drive gespeichert', 'success');
        } else {
            extShowToast('⚠️ Nur lokal gespeichert: ' + (result.error || ''), 'warning');
        }
    } catch (e) {
        extShowToast('❌ Speichern fehlgeschlagen: ' + e.message, 'error');
    }
}

function extResetSession() {
    if (!confirm('Neue Session starten? Alle Eingaben werden gelöscht.')) return;
    location.reload();
}


// ----------------------------------------
// Prompt Copy Helper
// ----------------------------------------

function extCopyPrompt(phase, ai) {
    let text = '';
    if (phase === 'phase1') {
        const p = extSession.phase1Prompt;
        text = p ? `[SYSTEM]\n${p.system}\n[/SYSTEM]\n\n${p.user}` : '';
    } else if (phase === 'phase2') {
        const p = extSession.phase2Prompt;
        text = p ? `[SYSTEM]\n${p.system}\n[/SYSTEM]\n\n${p.user}` : '';
    }

    if (!text) { extShowToast('Kein Prompt vorhanden', 'warning'); return; }

    navigator.clipboard.writeText(text)
        .then(() => extShowToast(`${ai}-Prompt kopiert ✓`, 'success'))
        .catch(() => extShowToast('Kopieren fehlgeschlagen', 'error'));
}


// ----------------------------------------
// Helpers
// ----------------------------------------

function makeSlug(text) {
    return (text || '')
        .toLowerCase()
        .replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 60);
}

function escapeHtml(text) {
    if (!text) return '';
    const d = document.createElement('div');
    d.textContent = text;
    return d.innerHTML;
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
    text = text.split(/\n{2,}/)
        .map(p => p.trim() ? `<p>${p.replace(/\n/g, '<br>')}</p>` : '')
        .join('');
    return text;
}

function extShowToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className   = `toast ${type}`;
    toast.classList.remove('hidden');
    const duration = (type === 'error' || type === 'warning') ? 8000 : 3000;
    setTimeout(() => toast.classList.add('hidden'), duration);
}
