/* ========================================
   KI-Cockpit V2 - Main Application
   ======================================== */

// ========================================
// State Management
// ========================================

let currentState = 0;
const MAX_STATE = 5;

// Session object to collect all data
let session = {
    id: generateSessionId(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    problem: '',
    template: 'questions',
    phase1Prompt: '',
    aiQuestions: {
        chatgpt: '',
        claude: '',
        gemini: ''
    },
    deduplicatedQuestions: [],
    phase2Prompt: '',
    aiSolutions: {
        chatgpt: '',
        claude: '',
        gemini: ''
    },
    synthesis: null
};

// ========================================
// Initialization
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('[app.js] KI-Cockpit V2 initialized');
    showState(0);

    // Template selection handling
    document.querySelectorAll('.template-option input').forEach(input => {
        input.addEventListener('change', (e) => {
            document.querySelectorAll('.template-option').forEach(opt => {
                opt.classList.remove('selected');
            });
            e.target.closest('.template-option').classList.add('selected');
            session.template = e.target.value;
            console.log('[app.js] Template selected:', session.template);
        });
    });
});

// ========================================
// State Navigation
// ========================================

/**
 * Shows a specific state/screen
 * @param {number} stateNum - State number (0-5)
 */
function showState(stateNum) {
    console.log(`[app.js] Switching to state ${stateNum}`);

    // Validate state number
    if (stateNum < 0 || stateNum > MAX_STATE) {
        console.error('[app.js] Invalid state:', stateNum);
        return;
    }

    // Hide all sections
    document.querySelectorAll('.state-section').forEach(section => {
        section.classList.remove('active');
    });

    // Show target section
    const targetSection = document.getElementById(`state-${stateNum}`);
    if (targetSection) {
        targetSection.classList.add('active');
    }

    // Update state indicator dots
    document.querySelectorAll('.state-dot').forEach((dot, index) => {
        dot.classList.remove('active', 'completed');
        if (index < stateNum) {
            dot.classList.add('completed');
        } else if (index === stateNum) {
            dot.classList.add('active');
        }
    });

    currentState = stateNum;
    session.updatedAt = new Date().toISOString();
}

/**
 * Go to next state
 */
function nextState() {
    if (currentState < MAX_STATE) {
        showState(currentState + 1);
    }
}

/**
 * Go to previous state
 */
function prevState() {
    if (currentState > 0) {
        showState(currentState - 1);
    }
}

// ========================================
// Phase 1: Generate Questions Prompt
// ========================================

/**
 * Generates the Phase 1 prompts
 */
function generatePrompts() {
    const problemInput = document.getElementById('problem-input');
    const problemText = problemInput.value.trim();

    if (!problemText) {
        showToast('Bitte beschreibe zuerst dein Problem.', 'error');
        problemInput.focus();
        return;
    }

    console.log('[app.js] Generating Phase 1 prompts');

    // Save to session
    session.problem = problemText;

    // Generate prompt
    const prompt = generateQuestionsPrompt(problemText);
    session.phase1Prompt = prompt;

    // Display prompt
    document.getElementById('phase1-prompt').textContent = prompt;

    // Move to next state
    showState(1);
    showToast('Prompts generiert!', 'success');
}

// ========================================
// Copy Functionality
// ========================================

/**
 * Copies prompt to clipboard
 * @param {string} phase - 'phase1' or 'phase2'
 * @param {string} aiName - Name of the AI for toast message
 */
async function copyPrompt(phase, aiName) {
    const promptElement = document.getElementById(`${phase}-prompt`);
    const promptText = promptElement.textContent;

    try {
        await navigator.clipboard.writeText(promptText);

        // Visual feedback
        const buttons = document.querySelectorAll(`.btn-${aiName.toLowerCase()}`);
        buttons.forEach(btn => {
            if (btn.closest(`#state-${currentState}`)) {
                btn.classList.add('copied');
                setTimeout(() => btn.classList.remove('copied'), 2000);
            }
        });

        showToast(`Prompt für ${aiName} kopiert!`, 'success');
        console.log(`[app.js] Prompt copied for ${aiName}`);
    } catch (error) {
        console.error('[app.js] Copy failed:', error);
        showToast('Kopieren fehlgeschlagen', 'error');
    }
}

// ========================================
// Phase 2: Analyze Questions
// ========================================

/**
 * Analyzes and deduplicates questions from all AIs
 */
function analyzeQuestions() {
    console.log('[app.js] Analyzing questions');

    // Get AI outputs
    const chatgptQuestions = document.getElementById('chatgpt-questions').value;
    const claudeQuestions = document.getElementById('claude-questions').value;
    const geminiQuestions = document.getElementById('gemini-questions').value;

    // Check if at least one AI has input
    if (!chatgptQuestions && !claudeQuestions && !geminiQuestions) {
        showToast('Bitte füge mindestens eine KI-Antwort ein.', 'error');
        return;
    }

    // Save to session
    session.aiQuestions = {
        chatgpt: chatgptQuestions,
        claude: claudeQuestions,
        gemini: geminiQuestions
    };

    // Extract questions from each AI
    const allQuestions = [];

    if (chatgptQuestions) {
        allQuestions.push(...extractQuestions(chatgptQuestions, 'chatgpt'));
    }
    if (claudeQuestions) {
        allQuestions.push(...extractQuestions(claudeQuestions, 'claude'));
    }
    if (geminiQuestions) {
        allQuestions.push(...extractQuestions(geminiQuestions, 'gemini'));
    }

    console.log(`[app.js] Total questions extracted: ${allQuestions.length}`);

    if (allQuestions.length === 0) {
        showToast('Keine Fragen gefunden. Prüfe das Format der KI-Antworten.', 'error');
        return;
    }

    // Deduplicate questions
    const deduplicated = deduplicateQuestions(allQuestions);
    session.deduplicatedQuestions = deduplicated;

    // Render questions
    renderQuestions(deduplicated);

    // Move to next state
    showState(3);
    showToast(`${deduplicated.length} einzigartige Fragen gefunden!`, 'success');
}

/**
 * Renders the deduplicated questions
 * @param {Array} questions - Array of question objects
 */
function renderQuestions(questions) {
    const container = document.getElementById('questions-container');
    container.innerHTML = '';

    questions.forEach((q, index) => {
        const questionEl = document.createElement('div');
        questionEl.className = 'question-item';
        questionEl.innerHTML = `
            <div class="question-header">
                <span class="question-text">${q.text}</span>
                <div class="question-meta">
                    <span class="tag">${q.tag}</span>
                    <span class="priority ${q.priority.toLowerCase()}">${q.priority}</span>
                </div>
            </div>
            <div class="sources">
                Quellen:
                ${q.sources.map(s => `<span class="source-badge ${s}"></span>${s}`).join(', ')}
            </div>
            <textarea
                id="answer-${index}"
                placeholder="Deine Antwort..."
                onchange="updateAnswer(${index}, this.value)"
            >${q.answer || ''}</textarea>
        `;
        container.appendChild(questionEl);
    });
}

/**
 * Updates an answer in the session
 * @param {number} index - Question index
 * @param {string} value - Answer text
 */
function updateAnswer(index, value) {
    if (session.deduplicatedQuestions[index]) {
        session.deduplicatedQuestions[index].answer = value;
        console.log(`[app.js] Answer ${index + 1} updated`);
    }
}

// ========================================
// Phase 3: Generate Solve Prompts
// ========================================

/**
 * Generates the Phase 2 (Solve) prompts
 */
function generateSolvePrompts() {
    console.log('[app.js] Generating Solve prompts');

    // Collect answers from textareas
    session.deduplicatedQuestions.forEach((q, index) => {
        const answerEl = document.getElementById(`answer-${index}`);
        if (answerEl) {
            q.answer = answerEl.value;
        }
    });

    // Check if at least some questions are answered
    const answeredCount = session.deduplicatedQuestions.filter(q => q.answer && q.answer.trim()).length;
    if (answeredCount === 0) {
        showToast('Bitte beantworte mindestens eine Frage.', 'error');
        return;
    }

    // Generate prompt
    const questionsAndAnswers = session.deduplicatedQuestions.map(q => ({
        question: q.text,
        answer: q.answer
    }));

    const prompt = generateSolvePrompt(session.problem, questionsAndAnswers);
    session.phase2Prompt = prompt;

    // Display prompt
    document.getElementById('phase2-prompt').textContent = prompt;

    // Move to next state
    showState(4);
    showToast('Solve-Prompts generiert!', 'success');
}

// ========================================
// Phase 4: Synthesis
// ========================================

/**
 * Starts the synthesis process
 */
async function startSynthesis() {
    console.log('[app.js] Starting synthesis');

    const btn = document.getElementById('synthesis-btn');
    const resultDiv = document.getElementById('synthesis-result');
    const contentDiv = document.getElementById('synthesis-content');

    // Get solutions
    const chatgptSolution = document.getElementById('chatgpt-solution').value;
    const claudeSolution = document.getElementById('claude-solution').value;
    const geminiSolution = document.getElementById('gemini-solution').value;

    // Check if at least one solution is provided
    if (!chatgptSolution && !claudeSolution && !geminiSolution) {
        showToast('Bitte füge mindestens eine Lösung ein.', 'error');
        return;
    }

    // Save to session
    session.aiSolutions = {
        chatgpt: chatgptSolution,
        claude: claudeSolution,
        gemini: geminiSolution
    };

    // Show loading state
    btn.classList.add('loading');
    btn.disabled = true;
    btn.textContent = 'Synthese läuft...';

    try {
        // Call synthesis
        const result = await synthesize(session.problem, session.aiSolutions);

        // Save result
        session.synthesis = result;

        // Save synthesis text for copy functions
        if (result.data && result.data.synthesis) {
            window.currentSynthesis = result.data.synthesis;
        } else if (result.synthesis) {
            window.currentSynthesis = result.synthesis;
        } else if (result.summary) {
            window.currentSynthesis = result.summary;
        }

        // Display result using displaySynthesis
        displaySynthesis(result);

        resultDiv.classList.remove('hidden');
        showToast('Synthese abgeschlossen!', 'success');

    } catch (error) {
        console.error('[app.js] Synthesis error:', error);
        showToast('Synthese fehlgeschlagen: ' + error.message, 'error');
    } finally {
        btn.classList.remove('loading');
        btn.disabled = false;
        btn.textContent = '🔮 Synthese starten';
    }
}

/**
 * Displays the synthesis result with proper formatting
 * @param {Object} result - The synthesis result
 */
function displaySynthesis(result) {
    const container = document.getElementById('synthesis-content');

    if (result.status === 'success' && result.data && result.data.synthesis) {
        const synthesisText = result.data.synthesis;
        const synthesisHtml = formatMarkdown(synthesisText);

        container.innerHTML = `
            <div class="synthesis-content">
                <div class="synthesis-actions">
                    <button onclick="copySynthesis('text')" class="btn-small">📋 Text kopieren</button>
                    <button onclick="copySynthesis('markdown')" class="btn-small">📝 Markdown kopieren</button>
                    <button onclick="openAsEmail()" class="btn-small">✉️ Als E-Mail</button>
                </div>
                <div class="synthesis-text">${synthesisHtml}</div>
            </div>
        `;
    } else if (result.synthesis || result.summary) {
        // Fallback for other response formats
        const text = result.synthesis || result.summary;
        const html = formatMarkdown(text);
        container.innerHTML = `
            <div class="synthesis-content">
                <div class="synthesis-actions">
                    <button onclick="copySynthesis('text')" class="btn-small">📋 Text kopieren</button>
                    <button onclick="copySynthesis('markdown')" class="btn-small">📝 Markdown kopieren</button>
                    <button onclick="openAsEmail()" class="btn-small">✉️ Als E-Mail</button>
                </div>
                <div class="synthesis-text">${html}</div>
            </div>
        `;
    } else {
        container.innerHTML = `<div class="error">Fehler: ${result.message || 'Unbekannter Fehler'}</div>`;
    }
}

/**
 * Formats markdown text to HTML
 * @param {string} text - Markdown text
 * @returns {string} - HTML string
 */
function formatMarkdown(text) {
    return text
        .replace(/## (.*?)(\n|$)/g, '<h3>$1</h3>')
        .replace(/### (.*?)(\n|$)/g, '<h4>$1</h4>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n- /g, '<br>• ')
        .replace(/\n(\d+)\. /g, '<br>$1. ')
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>');
}

/**
 * Copies the synthesis to clipboard
 * @param {string} format - 'text' or 'markdown'
 */
function copySynthesis(format) {
    const text = window.currentSynthesis || '';
    navigator.clipboard.writeText(text).then(() => {
        showToast('Kopiert!', 'success');
    }).catch(() => {
        showToast('Kopieren fehlgeschlagen', 'error');
    });
}

/**
 * Opens email client with synthesis
 */
function openAsEmail() {
    const title = document.getElementById('sessionTitle')?.value || 'KI-Cockpit Synthese';
    const text = window.currentSynthesis || '';
    const subject = encodeURIComponent(`KI-Cockpit: ${title}`);
    const body = encodeURIComponent(text.substring(0, 8000));
    window.open(`mailto:?subject=${subject}&body=${body}`);
}

// ========================================
// Session Management
// ========================================

/**
 * Saves the current session
 */
async function saveCurrentSession() {
    console.log('[app.js] Saving current session');

    session.updatedAt = new Date().toISOString();

    try {
        await saveSession(session);
        showToast('Session gespeichert!', 'success');
    } catch (error) {
        console.error('[app.js] Save error:', error);
        showToast('Speichern fehlgeschlagen', 'error');
    }
}

/**
 * Opens the archive modal
 */
async function openArchive() {
    console.log('[app.js] Opening archive');
    await loadArchive();
}

/**
 * Loads and displays archive sessions
 */
async function loadArchive() {
    try {
        const sessions = await loadSessions();
        if (sessions.status === 'success' && sessions.data && sessions.data.length > 0) {
            let html = '<div class="archive-list"><h3>Gespeicherte Sessions</h3>';
            sessions.data.forEach(session => {
                html += `<div class="archive-item" onclick="viewSession('${session.id}')">
                    <span class="archive-name">${session.name || session.titleSlug || 'Unbenannt'}</span>
                    <span class="archive-date">${new Date(session.date || session.createdAt).toLocaleDateString('de-DE')}</span>
                </div>`;
            });
            html += '<button class="btn btn-secondary" onclick="closeArchiveModal()" style="margin-top:15px;width:100%;">Schließen</button></div>';
            document.getElementById('archiveModal').innerHTML = html;
            document.getElementById('archiveModal').style.display = 'block';
        } else if (Array.isArray(sessions) && sessions.length > 0) {
            // Fallback for localStorage format
            let html = '<div class="archive-list"><h3>Gespeicherte Sessions</h3>';
            sessions.forEach(session => {
                html += `<div class="archive-item" onclick="viewSession('${session.id}')">
                    <span class="archive-name">${session.name || session.titleSlug || 'Unbenannt'}</span>
                    <span class="archive-date">${new Date(session.date || session.createdAt).toLocaleDateString('de-DE')}</span>
                </div>`;
            });
            html += '<button class="btn btn-secondary" onclick="closeArchiveModal()" style="margin-top:15px;width:100%;">Schließen</button></div>';
            document.getElementById('archiveModal').innerHTML = html;
            document.getElementById('archiveModal').style.display = 'block';
        } else {
            alert('Keine Sessions gefunden');
        }
    } catch (error) {
        alert('Fehler beim Laden: ' + error.message);
    }
}

/**
 * Views a specific session
 * @param {string} id - Session ID
 */
async function viewSession(id) {
    try {
        const result = await getSession(id);
        if (result.status === 'success') {
            displaySessionDetails(result.data);
        } else {
            alert('Fehler: ' + result.message);
        }
    } catch (error) {
        alert('Fehler beim Laden: ' + error.message);
    }
}

/**
 * Displays session details in the modal
 * @param {Object} session - Session data
 */
function displaySessionDetails(session) {
    const modal = document.getElementById('archiveModal');

    const problemText = session.problem?.raw || session.problem?.cleaned || 'Kein Problem gespeichert';
    const synthesisText = session.synthesis || session.compare?.synthesis || 'Keine Synthese vorhanden';

    let html = `
        <div class="session-detail">
            <div class="session-header">
                <h2>${session.title || session.titleSlug || 'Session'}</h2>
                <span class="session-date">${new Date(session.createdAt || Date.now()).toLocaleDateString('de-DE')}</span>
            </div>

            <div class="session-section">
                <h3>📋 Problemstellung</h3>
                <div class="session-content">${problemText}</div>
            </div>

            <div class="session-section">
                <h3>🎯 Synthese</h3>
                <div class="session-content synthesis-formatted">${formatMarkdown(synthesisText)}</div>
            </div>

            <div class="session-actions">
                <button onclick="copySessionText('${encodeURIComponent(synthesisText)}')" class="btn-small">📋 Synthese kopieren</button>
                <button onclick="closeModal()" class="btn-small">Schließen</button>
                <button onclick="loadArchive()" class="btn-small">← Zurück zur Liste</button>
            </div>
        </div>
    `;

    modal.innerHTML = html;
}

/**
 * Copies session text to clipboard
 * @param {string} encodedText - URL-encoded text
 */
function copySessionText(encodedText) {
    const text = decodeURIComponent(encodedText);
    navigator.clipboard.writeText(text).then(() => {
        alert('Kopiert!');
    });
}

/**
 * Closes the archive modal
 */
function closeModal() {
    document.getElementById('archiveModal').style.display = 'none';
}

/**
 * Closes the archive modal (alias)
 */
function closeArchiveModal() {
    document.getElementById('archiveModal').style.display = 'none';
}

/**
 * Closes the archive modal
 */
function closeArchive() {
    document.getElementById('archive-modal').classList.add('hidden');
}

/**
 * Loads a session from archive
 * @param {string} sessionId - ID of session to load
 */
async function loadSession(sessionId) {
    console.log('[app.js] Loading session:', sessionId);

    try {
        const sessions = await loadSessions();
        const loadedSession = sessions.find(s => s.id === sessionId);

        if (!loadedSession) {
            showToast('Session nicht gefunden', 'error');
            return;
        }

        // Restore session
        session = loadedSession;

        // Restore UI state
        document.getElementById('problem-input').value = session.problem || '';

        if (session.phase1Prompt) {
            document.getElementById('phase1-prompt').textContent = session.phase1Prompt;
        }

        if (session.aiQuestions) {
            document.getElementById('chatgpt-questions').value = session.aiQuestions.chatgpt || '';
            document.getElementById('claude-questions').value = session.aiQuestions.claude || '';
            document.getElementById('gemini-questions').value = session.aiQuestions.gemini || '';
        }

        if (session.deduplicatedQuestions && session.deduplicatedQuestions.length > 0) {
            renderQuestions(session.deduplicatedQuestions);
        }

        if (session.phase2Prompt) {
            document.getElementById('phase2-prompt').textContent = session.phase2Prompt;
        }

        if (session.aiSolutions) {
            document.getElementById('chatgpt-solution').value = session.aiSolutions.chatgpt || '';
            document.getElementById('claude-solution').value = session.aiSolutions.claude || '';
            document.getElementById('gemini-solution').value = session.aiSolutions.gemini || '';
        }

        if (session.synthesis) {
            const contentDiv = document.getElementById('synthesis-content');
            const resultDiv = document.getElementById('synthesis-result');
            contentDiv.textContent = session.synthesis.summary || JSON.stringify(session.synthesis, null, 2);
            resultDiv.classList.remove('hidden');
        }

        closeArchive();
        showState(0);
        showToast('Session geladen!', 'success');

    } catch (error) {
        console.error('[app.js] Load error:', error);
        showToast('Laden fehlgeschlagen', 'error');
    }
}

/**
 * Resets the session to start fresh
 */
function resetSession() {
    console.log('[app.js] Resetting session');

    // Create new session
    session = {
        id: generateSessionId(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        problem: '',
        template: 'questions',
        phase1Prompt: '',
        aiQuestions: {
            chatgpt: '',
            claude: '',
            gemini: ''
        },
        deduplicatedQuestions: [],
        phase2Prompt: '',
        aiSolutions: {
            chatgpt: '',
            claude: '',
            gemini: ''
        },
        synthesis: null
    };

    // Reset UI
    document.getElementById('problem-input').value = '';
    document.getElementById('phase1-prompt').textContent = '';
    document.getElementById('chatgpt-questions').value = '';
    document.getElementById('claude-questions').value = '';
    document.getElementById('gemini-questions').value = '';
    document.getElementById('questions-container').innerHTML = '';
    document.getElementById('phase2-prompt').textContent = '';
    document.getElementById('chatgpt-solution').value = '';
    document.getElementById('claude-solution').value = '';
    document.getElementById('gemini-solution').value = '';
    document.getElementById('synthesis-content').textContent = '';
    document.getElementById('synthesis-result').classList.add('hidden');

    showState(0);
    showToast('Neue Session gestartet', 'success');
}

// ========================================
// Toast Notifications
// ========================================

/**
 * Shows a toast notification
 * @param {string} message - Message to display
 * @param {string} type - 'success' or 'error'
 */
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type}`;

    // Show toast
    setTimeout(() => {
        toast.classList.remove('hidden');
    }, 10);

    // Hide after 3 seconds
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}

// ========================================
// Keyboard Shortcuts
// ========================================

document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + Enter to proceed to next step
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();

        switch (currentState) {
            case 0:
                generatePrompts();
                break;
            case 1:
            case 4:
                nextState();
                break;
            case 2:
                analyzeQuestions();
                break;
            case 3:
                generateSolvePrompts();
                break;
            case 5:
                startSynthesis();
                break;
        }
    }

    // Escape to close modal
    if (e.key === 'Escape') {
        closeArchive();
    }
});

console.log('[app.js] App script loaded');
