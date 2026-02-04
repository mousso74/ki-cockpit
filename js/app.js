/* ========================================
   KI-Cockpit V3.0 - Main Application
   ======================================== */

// ========================================
// State Management
// ========================================

let currentState = 0;
const MAX_STATE = 5;

// Available projects cache (loaded from backend)
let availableProjects = {
    'geschäftlich': [],
    'privat': []
};

// Session object to collect all data
let session = {
    id: generateSessionId(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    category: '',      // NEU: 'geschäftlich' oder 'privat'
    project: '',       // NEU: Projektname
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
    console.log('[app.js] Asinito KI-Cockpit V3.4 initialized');
    showState(0);

    // Update usage display
    updateUsageDisplay();

    // Load projects on startup
    updateProjectDropdown();

    // Category selection handling (select dropdown)
    const categorySelect = document.getElementById('categorySelect');
    if (categorySelect) {
        categorySelect.addEventListener('change', (e) => {
            session.category = e.target.value;
            console.log('[app.js] Category selected:', session.category);
            updateProjectDropdown();
        });
    }

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

    // Project dropdown change handling
    const projectSelect = document.getElementById('projectSelect');
    if (projectSelect) {
        projectSelect.addEventListener('change', (e) => {
            const newProjectGroup = document.getElementById('newProjectGroup');
            if (e.target.value === '__new__') {
                // Show new project input
                if (newProjectGroup) {
                    newProjectGroup.style.display = 'block';
                    document.getElementById('newProjectName')?.focus();
                }
            } else {
                // Hide new project input and set project
                if (newProjectGroup) {
                    newProjectGroup.style.display = 'none';
                }
                session.project = e.target.value;
                console.log('[app.js] Project selected:', session.project);
            }
        });
    }
});

// ========================================
// Project Management (V3.4)
// ========================================

/**
 * Updates the project dropdown based on selected category
 * Loads existing projects from backend and adds "new project" option
 */
async function updateProjectDropdown() {
    const categorySelect = document.getElementById('categorySelect');
    const projectSelect = document.getElementById('projectSelect');
    const newProjectGroup = document.getElementById('newProjectGroup');

    if (!categorySelect || !projectSelect) {
        console.warn('[app.js] Category or project select not found');
        return;
    }

    const category = categorySelect.value;
    console.log('[app.js] Updating project dropdown for category:', category);

    // Reset dropdown
    projectSelect.innerHTML = '<option value="">Projekt wählen...</option>';
    projectSelect.innerHTML += '<option value="__new__">+ Neues Projekt erstellen</option>';

    // Hide new project input
    if (newProjectGroup) {
        newProjectGroup.style.display = 'none';
    }

    try {
        // Load projects from backend
        const response = await fetch(`${BACKEND_URL}?action=getProjects`);
        const result = await response.json();
        console.log('[app.js] Backend response:', result);

        if (result.status === 'success' && result.data) {
            // Backend returns { geschäftlich: [...], privat: [...] }
            const projects = result.data[category] || [];
            console.log('[app.js] Loaded projects for', category + ':', projects);

            projects.forEach(projectName => {
                const option = document.createElement('option');
                option.value = projectName;
                option.textContent = projectName;
                projectSelect.appendChild(option);
            });

            console.log('[app.js] Dropdown updated with', projects.length, 'projects for', category);
        }
    } catch (error) {
        console.error('[app.js] Error loading projects:', error);
    }
}

/**
 * Confirms new project from input field
 * Called when user enters a new project name
 */
function confirmNewProject() {
    const input = document.getElementById('newProjectName');
    const projectSelect = document.getElementById('projectSelect');
    const newProjectGroup = document.getElementById('newProjectGroup');

    if (!input) return;

    const projectName = input.value.trim();

    if (!projectName) {
        showToast('Bitte Projektnamen eingeben', 'error');
        return;
    }

    // Add to dropdown
    const option = document.createElement('option');
    option.value = projectName;
    option.textContent = projectName;
    projectSelect.appendChild(option);

    // Select the new project
    projectSelect.value = projectName;
    session.project = projectName;

    // Hide input and clear
    if (newProjectGroup) {
        newProjectGroup.style.display = 'none';
    }
    input.value = '';

    showToast('Projekt "' + projectName + '" hinzugefügt', 'success');
    console.log('[app.js] New project added:', projectName);
}

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
    // Validate required fields (V3.4)
    const categorySelect = document.getElementById('categorySelect');
    console.log('[app.js] generatePrompts - categorySelect:', categorySelect, 'value:', categorySelect?.value);

    if (!categorySelect || !categorySelect.value) {
        showToast('Bitte wähle eine Kategorie (Geschäftlich/Privat).', 'error');
        return;
    }
    session.category = categorySelect.value;

    const projectSelect = document.getElementById('projectSelect');
    const projectValue = projectSelect ? projectSelect.value : '';

    // Check if "new project" is selected
    if (projectValue === '__new__') {
        const newProjectName = document.getElementById('newProjectName');
        if (!newProjectName || !newProjectName.value.trim()) {
            showToast('Bitte gib einen Projektnamen ein.', 'error');
            if (newProjectName) newProjectName.focus();
            return;
        }
        session.project = newProjectName.value.trim();
    } else if (!projectValue) {
        showToast('Bitte wähle ein Projekt aus oder erstelle ein neues.', 'error');
        if (projectSelect) projectSelect.focus();
        return;
    } else {
        session.project = projectValue;
    }

    const sessionTitle = document.getElementById('sessionTitle').value.trim();
    if (!sessionTitle) {
        showToast('Bitte gib einen Session-Titel ein.', 'error');
        document.getElementById('sessionTitle').focus();
        return;
    }

    const problemInput = document.getElementById('problem-input');
    const problemText = problemInput.value.trim();

    if (!problemText) {
        showToast('Bitte beschreibe zuerst dein Problem.', 'error');
        problemInput.focus();
        return;
    }

    console.log('[app.js] Generating Phase 1 prompts');

    // Save to session (V3.4: category and project already set above)
    session.problem = problemText;

    // Generate prompt
    const prompt = generateQuestionsPrompt(problemText);
    session.phase1Prompt = prompt;

    // Display prompt (show user part only, system prompt is too long)
    const displayText = prompt.user || prompt;
    document.getElementById('phase1-prompt').textContent = displayText;

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
 * Analyzes and deduplicates questions from all AIs using Gemini API
 */
async function analyzeQuestions() {
    console.log('[app.js] Analyzing questions with AI deduplication');

    // Increment usage counter
    incrementDedupeCounter();

    // Get AI outputs
    const chatgptOutput = document.getElementById('chatgpt-questions').value;
    const claudeOutput = document.getElementById('claude-questions').value;
    const geminiOutput = document.getElementById('gemini-questions').value;
    const problemText = document.getElementById('problem-input').value;

    // Check if at least one AI has input
    if (!chatgptOutput && !claudeOutput && !geminiOutput) {
        showToast('Bitte füge mindestens eine KI-Antwort ein.', 'error');
        return;
    }

    // Save to session
    session.aiQuestions = {
        chatgpt: chatgptOutput,
        claude: claudeOutput,
        gemini: geminiOutput
    };

    // Show loading indicator
    const container = document.getElementById('questions-container');
    container.innerHTML = '<p class="loading-text">Analysiere Fragen mit KI...</p>';

    // Move to state 3 to show loading
    showState(3);

    try {
        // Extract questions from each AI output
        const chatgptQuestions = extractQuestionsFromText(chatgptOutput);
        const claudeQuestions = extractQuestionsFromText(claudeOutput);
        const geminiQuestions = extractQuestionsFromText(geminiOutput);

        const totalExtracted = chatgptQuestions.length + claudeQuestions.length + geminiQuestions.length;

        console.log('[app.js] ====== QUESTION EXTRACTION ======');
        console.log('[app.js] ChatGPT questions extracted:', chatgptQuestions.length);
        console.log('[app.js] Claude questions extracted:', claudeQuestions.length);
        console.log('[app.js] Gemini questions extracted:', geminiQuestions.length);
        console.log('[app.js] TOTAL questions extracted:', totalExtracted);
        console.log('[app.js] Problem text length:', problemText.length, 'chars');

        // Log individual questions for debugging
        console.log('[app.js] ChatGPT questions:', chatgptQuestions);
        console.log('[app.js] Claude questions:', claudeQuestions);
        console.log('[app.js] Gemini questions:', geminiQuestions);

        // Warning if problem text is very long
        if (problemText.length > 5000) {
            console.warn('[app.js] WARNING: Problem text is very long (' + problemText.length + ' chars). Consider shortening it if deduplication fails.');
        }

        // Call Gemini API for intelligent deduplication
        console.log('[app.js] Calling deduplicateQuestionsAPI...');
        const result = await deduplicateQuestionsAPI(problemText, {
            chatgpt: chatgptQuestions,
            claude: claudeQuestions,
            gemini: geminiQuestions
        });

        console.log('[app.js] ====== DEDUPLICATION RESULT ======');
        console.log('[app.js] Result status:', result.status);
        console.log('[app.js] Result data type:', typeof result.data);

        if (result.status === 'success' && result.data) {
            // Backend V3.1 gibt direkt das Array in result.data zurück
            // Fallback auf result.data.questions falls altes Format
            const questions = Array.isArray(result.data) ? result.data : (result.data.questions || result.data);

            console.log('[app.js] Deduplicated questions received:', questions.length);
            console.log('[app.js] INPUT was:', totalExtracted, 'questions');
            console.log('[app.js] OUTPUT is:', questions.length, 'deduplicated questions');

            // Check if there's a significant reduction (potential issue)
            if (totalExtracted > 0 && questions.length < totalExtracted * 0.3) {
                console.warn('[app.js] WARNING: Significant question reduction detected!');
                console.warn('[app.js] Input:', totalExtracted, '-> Output:', questions.length);
                console.warn('[app.js] This might indicate an API issue.');
            }

            displayDeduplicatedQuestions(questions);
            session.deduplicatedQuestions = questions;
            window.deduplicatedQuestions = questions;
            showToast(`${questions.length} deduplizierte Fragen gefunden! (von ${totalExtracted} original)`, 'success');
        } else {
            // Fallback to local deduplication
            console.log('[app.js] API deduplication failed, using fallback');
            const localQuestions = localDeduplicateQuestions(chatgptOutput, claudeOutput, geminiOutput);
            displayDeduplicatedQuestions(localQuestions);
            session.deduplicatedQuestions = localQuestions;
            window.deduplicatedQuestions = localQuestions;
            showToast(`${localQuestions.length} Fragen gefunden (lokal)`, 'success');
        }
    } catch (error) {
        console.error('[app.js] Deduplication error:', error);
        // Fallback to local deduplication on error
        const localQuestions = localDeduplicateQuestions(chatgptOutput, claudeOutput, geminiOutput);
        displayDeduplicatedQuestions(localQuestions);
        session.deduplicatedQuestions = localQuestions;
        window.deduplicatedQuestions = localQuestions;
        showToast('Lokale Analyse verwendet', 'success');
    }
}

/**
 * Extracts questions from AI output text - supports multiple formats
 * @param {string} text - AI output text
 * @returns {Array} - Array of question strings
 */
function extractQuestionsFromText(text) {
    if (!text) return [];
    const questions = [];
    const lines = text.split('\n');

    for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;

        let match;

        // Format 1: 1. (P1) (TAG:xxx) Question text
        match = trimmedLine.match(/^\d+\.\s*\(P[123]\)\s*\(TAG:\w+\)\s*(.+)/);
        if (match) {
            questions.push(match[1].trim());
            continue;
        }

        // Format 2: 1. (P1) Question text (ohne TAG)
        match = trimmedLine.match(/^\d+\.\s*\(P[123]\)\s+(.+)/);
        if (match) {
            questions.push(match[1].trim());
            continue;
        }

        // Format 3: - (P1) Question text (mit Bullet)
        match = trimmedLine.match(/^[-•]\s*\(P[123]\)\s+(.+)/);
        if (match) {
            questions.push(match[1].trim());
            continue;
        }

        // Format 4: 1. Question text (nur Nummer und Frage mit ?)
        match = trimmedLine.match(/^\d+\.\s+(.+\?)\s*$/);
        if (match) {
            questions.push(match[1].trim());
            continue;
        }

        // Format 5: - Question text (Bullet mit Fragezeichen)
        match = trimmedLine.match(/^[-•]\s+(.+\?)\s*$/);
        if (match) {
            questions.push(match[1].trim());
            continue;
        }

        // Format 6: **Frage:** oder ähnliche Markdown-Formatierung
        match = trimmedLine.match(/^\*\*.*?\*\*:?\s*(.+\?)\s*$/);
        if (match) {
            questions.push(match[1].trim());
            continue;
        }

        // Format 7: Zeile endet mit Fragezeichen und beginnt mit Großbuchstabe (min. 20 Zeichen)
        if (trimmedLine.endsWith('?') && /^[A-ZÄÖÜ]/.test(trimmedLine) && trimmedLine.length > 20) {
            questions.push(trimmedLine);
        }
    }

    console.log('[app.js] extractQuestionsFromText found', questions.length, 'questions from input');
    return questions;
}

/**
 * Displays deduplicated questions with the new format
 * @param {Array} questions - Array of question objects
 */
function displayDeduplicatedQuestions(questions) {
    const container = document.getElementById('questions-container');

    if (!questions || questions.length === 0) {
        container.innerHTML = '<p>Keine Fragen gefunden.</p>';
        return;
    }

    let html = '<div class="dedupe-list">';
    questions.forEach((q, index) => {
        const sourceBadges = (q.sources || []).map(s => {
            const colors = { 'ChatGPT': '#74aa9c', 'Claude': '#d97706', 'Gemini': '#4285f4' };
            return `<span class="source-badge" style="background:${colors[s] || '#666'}">${s}</span>`;
        }).join('');

        html += `
            <div class="dedupe-question">
                <div class="question-header">
                    <span class="priority ${q.priority || 'P2'}">${q.priority || 'P2'}</span>
                    ${sourceBadges}
                </div>
                <div class="question-text">${q.question || q.text}</div>
                <textarea
                    class="answer-input"
                    id="answer-${index}"
                    placeholder="Deine Antwort..."
                    onchange="updateAnswer(${index}, this.value)"
                >${q.answer || ''}</textarea>
            </div>
        `;
    });
    html += '</div>';

    container.innerHTML = html;
}

/**
 * Fallback for local deduplication when API fails
 * @param {string} chatgpt - ChatGPT output
 * @param {string} claude - Claude output
 * @param {string} gemini - Gemini output
 * @returns {Array} - Array of question objects
 */
function localDeduplicateQuestions(chatgpt, claude, gemini) {
    const allQuestions = [];
    const seen = new Set();

    const addQuestions = (text, source) => {
        const questions = extractQuestionsFromText(text);
        questions.forEach(q => {
            const normalized = q.toLowerCase().trim();
            if (!seen.has(normalized)) {
                seen.add(normalized);
                allQuestions.push({
                    question: q,
                    priority: 'P2',
                    sources: [source]
                });
            }
        });
    };

    addQuestions(chatgpt, 'ChatGPT');
    addQuestions(claude, 'Claude');
    addQuestions(gemini, 'Gemini');

    return allQuestions;
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

    // Use window.deduplicatedQuestions or session.deduplicatedQuestions
    const questions = window.deduplicatedQuestions || session.deduplicatedQuestions || [];

    // Collect answers from textareas
    const answers = [];
    questions.forEach((q, index) => {
        const answerEl = document.getElementById(`answer-${index}`);
        const answer = answerEl?.value || '';
        answers.push(answer);
        // Also update the question object
        if (typeof q === 'object') {
            q.answer = answer;
        }
    });

    // Check if at least some questions are answered
    const answeredCount = answers.filter(a => a && a.trim()).length;
    if (answeredCount === 0) {
        showToast('Bitte beantworte mindestens eine Frage.', 'error');
        return;
    }

    // Store answers in session
    session.answers = answers;
    session.deduplicatedQuestions = questions;

    // Generate QA block for the prompt
    let qaBlock = '';
    questions.forEach((q, i) => {
        const questionText = typeof q === 'string' ? q : (q.question || q.text || 'Frage nicht verfügbar');
        const answer = answers[i] || '(nicht beantwortet)';
        qaBlock += `F${i+1}: ${questionText}\nA${i+1}: ${answer}\n\n`;
    });

    const prompt = generateSolvePrompt(session.problem, qaBlock);
    session.phase2Prompt = prompt;

    // Display prompt (show user part only, system prompt is too long)
    const displayText = prompt.user || prompt;
    document.getElementById('phase2-prompt').textContent = displayText;

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

    // Increment usage counter
    incrementUsageCounter();

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
 * Formats markdown text to HTML (robust version)
 * @param {*} input - Markdown text or object
 * @returns {string} - HTML string
 */
function formatMarkdown(input) {
    let text = '';
    if (typeof input === 'string') {
        text = input;
    } else if (input == null) {
        text = '';
    } else if (typeof input === 'number' || typeof input === 'boolean') {
        text = String(input);
    } else if (typeof input === 'object') {
        if (typeof input.synthesis === 'string') text = input.synthesis;
        else if (typeof input.text === 'string') text = input.text;
        else {
            try { text = JSON.stringify(input, null, 2); } catch { text = String(input); }
        }
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
        .map(para => `<p>${para.replace(/\n/g, '<br>')}</p>`)
        .join('');

    return text;
}

/**
 * Creates a URL-safe slug from a title
 * @param {string} title - The title
 * @returns {string} - URL-safe slug
 */
function makeTitleSlug(title) {
    const t = (title || '').trim() || 'Session';
    const map = { ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' };

    const slug = t
        .toLowerCase()
        .replace(/[äöüß]/g, m => map[m] || m)
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 40);

    return slug || 'session';
}

/**
 * Extracts synthesis text from various formats
 * @param {*} synthesis - Could be string, object, or nested object
 * @returns {string} - Plain synthesis text
 */
function extractSynthesisText(synthesis) {
    if (!synthesis) return 'Keine Synthese vorhanden';

    // Fall 1: Bereits ein String
    if (typeof synthesis === 'string') {
        // Prüfen ob es ein JSON-String ist
        try {
            const parsed = JSON.parse(synthesis);
            if (parsed.data && parsed.data.synthesis) {
                return parsed.data.synthesis;
            }
            if (parsed.synthesis) {
                return parsed.synthesis;
            }
        } catch (e) {
            // Kein JSON, direkt zurückgeben
            return synthesis;
        }
        return synthesis;
    }

    // Fall 2: Objekt mit data.synthesis
    if (typeof synthesis === 'object') {
        if (synthesis.data && synthesis.data.synthesis) {
            return synthesis.data.synthesis;
        }
        if (synthesis.synthesis) {
            return synthesis.synthesis;
        }
        if (synthesis.text) {
            return synthesis.text;
        }
        return JSON.stringify(synthesis, null, 2);
    }

    return String(synthesis);
}

/**
 * Converts markdown to plain text
 * @param {*} md - Markdown string or other input
 * @returns {string} - Plain text
 */
function markdownToPlainText(md) {
    if (typeof md !== 'string') md = md == null ? '' : String(md);

    let s = md.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // Remove headers
    s = s.replace(/^\s{0,3}#{1,6}\s+/gm, '');

    // Remove bold, italic, code
    s = s.replace(/\*\*(.+?)\*\*/g, '$1');
    s = s.replace(/\*(.+?)\*/g, '$1');
    s = s.replace(/`([^`]+)`/g, '$1');

    // Normalize lists
    s = s.replace(/^\s*[-•]\s+/gm, '- ');
    s = s.replace(/^\s*(\d+)\.\s+/gm, '$1) ');

    // Clean up whitespace
    s = s.replace(/\n{3,}/g, '\n\n').trim();

    return s;
}

/**
 * Copies the synthesis to clipboard
 * @param {string} format - 'text' or 'markdown'
 */
function copySynthesis(format) {
    const text = window.currentSynthesis || '';

    let copyText = text;

    if (format === 'text') {
        // Entferne Markdown-Formatierung für reinen Text
        copyText = text
            .replace(/\*\*(.*?)\*\*/g, '$1')
            .replace(/\*(.*?)\*/g, '$1')
            .replace(/#{1,6}\s?(.*?)(\n|$)/g, '$1$2')
            .replace(/\[(.*?)\]\(.*?\)/g, '$1')
            .replace(/`(.*?)`/g, '$1')
            .replace(/^\s*[-*+]\s/gm, '• ')
            .replace(/\[SOLUTION\]|\[\/SOLUTION\]/g, '')
            .replace(/\[ACTION_PLAN\]|\[\/ACTION_PLAN\]/g, '')
            .replace(/\[RISKS\]|\[\/RISKS\]/g, '')
            .replace(/\[STATUS\]|\[\/STATUS\]/g, '')
            .replace(/\[ASSUMPTIONS\]|\[\/ASSUMPTIONS\]/g, '')
            .replace(/\[FOLLOWUP_QUESTIONS\]|\[\/FOLLOWUP_QUESTIONS\]/g, '')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }

    navigator.clipboard.writeText(copyText).then(() => {
        const msg = format === 'text' ? 'Text kopiert (ohne Formatierung)!' : 'Markdown kopiert!';
        showToast(msg, 'success');
    }).catch(() => {
        showToast('Kopieren fehlgeschlagen', 'error');
    });
}

/**
 * Opens email client with synthesis as plain text
 */
function openAsEmail() {
    const title = document.getElementById('sessionTitle')?.value?.trim() || 'KI-Cockpit Session';

    const date = new Date();
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

    const subject = `KI-Cockpit – ${title} – ${dateStr}`;

    const md = window.currentSynthesis || '';
    const plainText = markdownToPlainText(md);

    const MAX_MAILTO_BODY = 8000;
    const safeBody = plainText.length > MAX_MAILTO_BODY
        ? plainText.substring(0, MAX_MAILTO_BODY) + '\n\n(Text gekürzt - bitte im Cockpit kopieren)'
        : plainText;

    const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(safeBody)}`;
    window.location.href = mailto;
}

// ========================================
// Session Management
// ========================================

/**
 * Saves the current session with all data
 */
async function saveCurrentSession() {
    console.log('[app.js] Saving current session (V3.0)');

    // Get title and create slug using helper function
    const titleFromUi = document.getElementById('sessionTitle')?.value || 'Session';
    const titleSlug = makeTitleSlug(titleFromUi);

    // Get category and project (V3.0)
    const categorySelect = document.getElementById('categorySelect');
    const category = categorySelect?.value || session.category || 'privat';

    // Check if user selected "new project" and entered a name
    const projectSelect = document.getElementById('projectSelect');
    let project = projectSelect?.value || session.project || 'Allgemein';

    if (project === '__new__') {
        const newProjectName = document.getElementById('newProjectName')?.value?.trim();
        project = newProjectName || 'Allgemein';
    }

    // Store name and titleSlug BEFORE saving
    session.name = titleFromUi;
    session.titleSlug = titleSlug;
    session.category = category;
    session.project = project;

    // Collect all answers from the question textareas
    const answers = [];
    if (session.deduplicatedQuestions) {
        session.deduplicatedQuestions.forEach((q, index) => {
            const answerEl = document.getElementById(`answer-${index}`);
            answers.push(answerEl?.value || '');
        });
    }

    // Collect phase 1 outputs (questions from AIs)
    const phase1Outputs = {
        chatgpt: document.getElementById('chatgpt-questions')?.value || '',
        claude: document.getElementById('claude-questions')?.value || '',
        gemini: document.getElementById('gemini-questions')?.value || ''
    };

    // Collect phase 2 outputs (solutions from AIs)
    const phase2Outputs = {
        chatgpt: document.getElementById('chatgpt-solution')?.value || '',
        claude: document.getElementById('claude-solution')?.value || '',
        gemini: document.getElementById('gemini-solution')?.value || ''
    };

    // Update session object with all data (V3.0: including category and project)
    session.title = titleFromUi;
    session.titleSlug = titleSlug;
    session.category = category;
    session.project = project;
    session.problem = document.getElementById('problem-input')?.value || session.problem;
    session.phase1Outputs = phase1Outputs;
    session.answers = answers;
    session.phase2Outputs = phase2Outputs;
    session.updatedAt = new Date().toISOString();
    if (!session.createdAt) {
        session.createdAt = session.updatedAt;
    }

    console.log('[app.js] Saving to:', category, '/', project, '/', titleSlug);

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
            sessions.data.forEach(s => {
                const displayName = s.displayTitle || s.name || 'Unbenannte Session';
                const dateStr = s.date ? new Date(s.date).toLocaleDateString('de-DE') : 'Kein Datum';
                html += `<div class="archive-item" onclick="viewSession('${s.id}')">
                    <span class="archive-name">${displayName}</span>
                    <span class="archive-date">${dateStr}</span>
                </div>`;
            });
            html += '<button class="btn btn-secondary" onclick="closeArchiveModal()" style="margin-top:15px;width:100%;">Schließen</button></div>';
            document.getElementById('archiveModal').innerHTML = html;
            document.getElementById('archiveModal').style.display = 'block';
        } else if (Array.isArray(sessions) && sessions.length > 0) {
            // Fallback for localStorage format
            let html = '<div class="archive-list"><h3>Gespeicherte Sessions</h3>';
            sessions.forEach(s => {
                const displayName = s.displayTitle || s.name || 'Unbenannte Session';
                const dateStr = s.date || s.createdAt ? new Date(s.date || s.createdAt).toLocaleDateString('de-DE') : 'Kein Datum';
                html += `<div class="archive-item" onclick="viewSession('${s.id}')">
                    <span class="archive-name">${displayName}</span>
                    <span class="archive-date">${dateStr}</span>
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
 * @param {Object} session - Session data (may be nested in .data)
 */
function displaySessionDetails(session) {
    const modal = document.getElementById('archiveModal');

    // Hole die Daten - sie könnten in session.data oder direkt in session sein
    const data = session.data || session;

    const title = data.name || data.title || data.titleSlug || 'Session';
    const problem = data.problem || 'Kein Problem gespeichert';

    // Synthese extrahieren - kann verschachtelt sein
    let synthesisText = data.synthesis || 'Keine Synthese vorhanden';
    if (typeof synthesisText === 'string') {
        try {
            const parsed = JSON.parse(synthesisText);
            if (parsed.data && parsed.data.synthesis) {
                synthesisText = parsed.data.synthesis;
            } else if (parsed.synthesis) {
                synthesisText = parsed.synthesis;
            }
        } catch (e) {
            // Kein JSON, ist bereits ein String
        }
    } else if (typeof synthesisText === 'object') {
        if (synthesisText.data && synthesisText.data.synthesis) {
            synthesisText = synthesisText.data.synthesis;
        } else if (synthesisText.synthesis) {
            synthesisText = synthesisText.synthesis;
        }
    }

    // Deduplizierte Fragen
    let questionsHtml = '';
    const questions = data.deduplicatedQuestions || [];
    const answers = data.answers || [];

    if (questions.length > 0) {
        questionsHtml = questions.map((q, i) => {
            const questionText = typeof q === 'string' ? q : (q.question || 'Frage nicht verfügbar');
            const answer = answers[i] || 'Keine Antwort';
            return `<div class="qa-item">
                <div class="question"><strong>F${i+1}:</strong> ${questionText}</div>
                <div class="answer"><strong>A:</strong> ${answer}</div>
            </div>`;
        }).join('');
    } else {
        questionsHtml = '<p>Keine Fragen gespeichert</p>';
    }

    // KI-Lösungen
    const phase2 = data.phase2Outputs || {};
    const chatgptSolution = phase2.chatgpt || 'Nicht vorhanden';
    const claudeSolution = phase2.claude || 'Nicht vorhanden';
    const geminiSolution = phase2.gemini || 'Nicht vorhanden';

    let html = `
        <div class="session-detail">
            <div class="session-header">
                <h2>${title}</h2>
                <span class="session-date">${new Date(data.createdAt || Date.now()).toLocaleDateString('de-DE')}</span>
            </div>

            <div class="session-section">
                <h3>📋 Problemstellung</h3>
                <div class="session-content">${problem}</div>
            </div>

            <div class="session-section">
                <h3>❓ Fragen & Antworten</h3>
                <div class="session-content qa-list">${questionsHtml}</div>
            </div>

            <div class="session-section">
                <h3>🤖 KI-Lösungen</h3>
                <div class="ki-solutions-tabs">
                    <button class="tab-btn active" onclick="showSolutionTab('chatgpt')">ChatGPT</button>
                    <button class="tab-btn" onclick="showSolutionTab('claude')">Claude</button>
                    <button class="tab-btn" onclick="showSolutionTab('gemini')">Gemini</button>
                </div>
                <div id="solution-chatgpt" class="solution-content active">${formatMarkdown(chatgptSolution)}</div>
                <div id="solution-claude" class="solution-content" style="display:none">${formatMarkdown(claudeSolution)}</div>
                <div id="solution-gemini" class="solution-content" style="display:none">${formatMarkdown(geminiSolution)}</div>
            </div>

            <div class="session-section">
                <h3>🎯 Synthese</h3>
                <div class="session-content synthesis-formatted">${formatMarkdown(synthesisText)}</div>
            </div>

            <div class="session-actions">
                <button onclick="exportSessionMarkdown()" class="btn-small btn-primary">📥 Als Markdown exportieren</button>
                <button onclick="copySessionMarkdown()" class="btn-small">📋 Markdown kopieren</button>
                <button onclick="loadArchive()" class="btn-small">← Zurück zur Liste</button>
                <button onclick="closeModal()" class="btn-small">Schließen</button>
            </div>
        </div>
    `;

    modal.innerHTML = html;
    window.currentSessionData = data;
}

/**
 * Shows a specific KI solution tab
 * @param {string} ki - 'chatgpt', 'claude', or 'gemini'
 */
function showSolutionTab(ki) {
    document.querySelectorAll('.solution-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById('solution-' + ki).style.display = 'block';
    event.target.classList.add('active');
}

/**
 * Generates markdown from session data
 * @param {Object} session - Session data (may be nested in .data)
 * @returns {string} - Markdown string
 */
function generateSessionMarkdown(session) {
    const data = session.data || session;

    const title = data.name || data.title || data.titleSlug || 'Session';
    const date = new Date(data.createdAt || Date.now()).toLocaleDateString('de-DE');
    const problem = data.problem || 'Kein Problem';

    // Synthese extrahieren - kann verschachtelt sein
    let synthesisText = data.synthesis || 'Keine Synthese';
    if (typeof synthesisText === 'string') {
        try {
            const parsed = JSON.parse(synthesisText);
            if (parsed.data && parsed.data.synthesis) {
                synthesisText = parsed.data.synthesis;
            } else if (parsed.synthesis) {
                synthesisText = parsed.synthesis;
            }
        } catch (e) {
            // Kein JSON, ist bereits ein String
        }
    } else if (typeof synthesisText === 'object') {
        if (synthesisText.data && synthesisText.data.synthesis) {
            synthesisText = synthesisText.data.synthesis;
        } else if (synthesisText.synthesis) {
            synthesisText = synthesisText.synthesis;
        }
    }

    let md = `# ${title}\n`;
    md += `**Datum:** ${date}\n\n`;
    md += `---\n\n`;

    md += `## 📋 Problemstellung\n\n${problem}\n\n`;

    md += `## ❓ Fragen & Antworten\n\n`;
    const questions = data.deduplicatedQuestions || [];
    const answers = data.answers || [];

    if (questions.length > 0) {
        questions.forEach((q, i) => {
            const questionText = typeof q === 'string' ? q : (q.question || 'Frage');
            const answer = answers[i] || '-';
            md += `### Frage ${i+1}\n`;
            md += `**${questionText}**\n\n`;
            md += `*Antwort:* ${answer}\n\n`;
        });
    }

    const phase2 = data.phase2Outputs || {};
    md += `## 🤖 KI-Lösungen\n\n`;
    md += `### ChatGPT\n${phase2.chatgpt || 'Nicht vorhanden'}\n\n`;
    md += `### Claude\n${phase2.claude || 'Nicht vorhanden'}\n\n`;
    md += `### Gemini\n${phase2.gemini || 'Nicht vorhanden'}\n\n`;

    md += `## 🎯 Synthese\n\n${synthesisText}\n\n`;

    md += `---\n*Exportiert aus KI-Cockpit*\n`;

    return md;
}

/**
 * Copies session as markdown to clipboard
 */
function copySessionMarkdown() {
    const md = generateSessionMarkdown(window.currentSessionData);
    navigator.clipboard.writeText(md).then(() => {
        showToast('Markdown in Zwischenablage kopiert!', 'success');
    });
}

/**
 * Exports session as markdown file download
 */
function exportSessionMarkdown() {
    const session = window.currentSessionData;
    const md = generateSessionMarkdown(session);
    const filename = `${session.titleSlug || 'session'}_${new Date().toISOString().split('T')[0]}.md`;

    // Add BOM for Windows UTF-8 compatibility
    const bom = '\uFEFF';
    const blob = new Blob([bom + md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

/**
 * Copies session text to clipboard (legacy)
 * @param {string} encodedText - URL-encoded text
 */
function copySessionText(encodedText) {
    const text = decodeURIComponent(encodedText);
    navigator.clipboard.writeText(text).then(() => {
        showToast('Kopiert!', 'success');
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
    console.log('[app.js] Resetting session (V3.0)');

    // Create new session (V3.0: including category and project)
    session = {
        id: generateSessionId(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        category: '',
        project: '',
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

    // Reset UI (V3.4: using select dropdowns)
    const categorySelect = document.getElementById('categorySelect');
    if (categorySelect) categorySelect.value = 'privat';

    const newProjectGroup = document.getElementById('newProjectGroup');
    if (newProjectGroup) newProjectGroup.style.display = 'none';

    const newProjectName = document.getElementById('newProjectName');
    if (newProjectName) newProjectName.value = '';

    // Reload projects for default category
    updateProjectDropdown();
    document.getElementById('sessionTitle').value = '';
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

// ========================================
// Usage Counter (Frontend Warning)
// ========================================

/**
 * Increments the synthesis usage counter and shows warnings
 * @returns {number} - Current count
 */
function incrementUsageCounter() {
    const today = new Date().toISOString().split('T')[0];
    const storageKey = 'ki-cockpit-usage';

    let usage = JSON.parse(localStorage.getItem(storageKey) || '{}');

    // Reset wenn neuer Tag
    if (usage.date !== today) {
        usage = { date: today, synthesisCount: 0, dedupeCount: 0 };
    }

    usage.synthesisCount = (usage.synthesisCount || 0) + 1;
    localStorage.setItem(storageKey, JSON.stringify(usage));

    // Warnung bei hoher Nutzung
    if (usage.synthesisCount === 40) {
        alert('⚠️ Hinweis: Du hast heute bereits 40 Synthese-Anfragen gestellt. Bei mehr als 50 könnten API-Limits erreicht werden.');
    }
    if (usage.synthesisCount >= 50) {
        alert('⚠️ Warnung: 50+ Anfragen heute! Um Kosten zu vermeiden, wird auf das günstigere Modell gewechselt.');
    }

    updateUsageDisplay();
    return usage.synthesisCount;
}

/**
 * Increments the deduplication usage counter
 * @returns {number} - Current count
 */
function incrementDedupeCounter() {
    const today = new Date().toISOString().split('T')[0];
    const storageKey = 'ki-cockpit-usage';

    let usage = JSON.parse(localStorage.getItem(storageKey) || '{}');

    if (usage.date !== today) {
        usage = { date: today, synthesisCount: 0, dedupeCount: 0 };
    }

    usage.dedupeCount = (usage.dedupeCount || 0) + 1;
    localStorage.setItem(storageKey, JSON.stringify(usage));

    updateUsageDisplay();
    return usage.dedupeCount;
}

/**
 * Gets current usage statistics
 * @returns {Object} - Usage stats
 */
function getUsageStats() {
    const storageKey = 'ki-cockpit-usage';
    return JSON.parse(localStorage.getItem(storageKey) || '{"date":"","synthesisCount":0,"dedupeCount":0}');
}

/**
 * Updates the usage display in the UI
 */
function updateUsageDisplay() {
    const stats = getUsageStats();
    const el = document.getElementById('usageStats');
    if (el && stats.date === new Date().toISOString().split('T')[0]) {
        el.innerHTML = `<small>Heute: ${stats.synthesisCount} Synthesen, ${stats.dedupeCount} Deduplizierungen</small>`;
    } else if (el) {
        el.innerHTML = '';
    }
}

console.log('[app.js] App script loaded');
