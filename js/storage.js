/* ========================================
   KI-Cockpit V2.1 - Storage & Backend
   ======================================== */

const BACKEND_URL = 'https://script.google.com/macros/s/AKfycbx7vpSxKfMlGh9nggDNyeIq6wjQNR3F_WZN3ue8u8FAO6dZUbPNFMcE43yu7by6pTB9/exec';

/**
 * Saves a session to the backend
 * @param {Object} sessionData - The session data to save
 * @returns {Promise<Object>} - Response from backend
 */
async function saveSession(sessionData) {
    console.log('[storage.js] Saving session:', sessionData.id);

    // Add titleSlug from sessionTitle input
    const title = document.getElementById('sessionTitle')?.value || '';
    const titleSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 40);
    sessionData.titleSlug = titleSlug;
    sessionData.name = title || 'Unbenannte Session';

    try {
        const response = await fetch(BACKEND_URL, {
            method: 'POST',
            redirect: 'follow',
            headers: {
                'Content-Type': 'text/plain',
            },
            body: JSON.stringify({
                action: 'saveSession',
                data: sessionData
            })
        });

        // With no-cors, we can't read the response
        // Save to localStorage as backup
        saveToLocalStorage(sessionData);

        console.log('[storage.js] Session saved successfully');
        return { success: true };
    } catch (error) {
        console.error('[storage.js] Error saving session:', error);
        // Fallback to localStorage
        saveToLocalStorage(sessionData);
        return { success: true, fallback: true };
    }
}

/**
 * Loads sessions from the backend
 * @returns {Promise<Array>} - Array of sessions
 */
async function loadSessions() {
    console.log('[storage.js] Loading sessions');

    try {
        const response = await fetch(`${BACKEND_URL}?action=listSessions`, {
            method: 'GET',
            redirect: 'follow',
        });

        if (response.ok) {
            const data = await response.json();
            console.log('[storage.js] Loaded', data.length, 'sessions from backend');
            return data;
        }
    } catch (error) {
        console.error('[storage.js] Error loading from backend:', error);
    }

    // Fallback to localStorage
    console.log('[storage.js] Falling back to localStorage');
    return loadFromLocalStorage();
}

/**
 * Calls the synthesis endpoint
 * @param {string} problem - The original problem
 * @param {Object} responses - Object with chatgpt, claude, gemini solutions
 * @returns {Promise<Object>} - Synthesized response
 */
async function synthesize(problem, responses) {
    console.log('[storage.js] Starting synthesis');

    try {
        const response = await fetch(BACKEND_URL, {
            method: 'POST',
            redirect: 'follow',
            headers: {
                'Content-Type': 'text/plain',
            },
            body: JSON.stringify({
                action: 'synthesize',
                problem: problem,
                solutions: responses  // Backend V3.1 erwartet 'solutions', nicht 'responses'
            })
        });

        // Try to parse response
        try {
            const data = await response.json();
            console.log('[storage.js] Synthesis complete');
            return data;
        } catch (e) {
            // If JSON parsing fails, return a fallback
            console.log('[storage.js] Could not parse synthesis response, using fallback');
            return createLocalSynthesis(problem, responses);
        }
    } catch (error) {
        console.error('[storage.js] Synthesis error:', error);
        // Fallback: create local synthesis
        return createLocalSynthesis(problem, responses);
    }
}

/**
 * Creates a local synthesis when backend is unavailable
 * @param {string} problem - The original problem
 * @param {Object} responses - Object with solutions
 * @returns {Object} - Local synthesis
 */
function createLocalSynthesis(problem, responses) {
    console.log('[storage.js] Creating local synthesis');

    const synthesis = {
        success: true,
        local: true,
        summary: '📊 Zusammenfassung der KI-Lösungen\n\n',
        solutions: []
    };

    if (responses.chatgpt) {
        synthesis.summary += '🟢 ChatGPT:\n' + responses.chatgpt.substring(0, 500) + '\n\n';
    }
    if (responses.claude) {
        synthesis.summary += '🟠 Claude:\n' + responses.claude.substring(0, 500) + '\n\n';
    }
    if (responses.gemini) {
        synthesis.summary += '🔵 Gemini:\n' + responses.gemini.substring(0, 500) + '\n\n';
    }

    synthesis.summary += '\n📌 Hinweis: Dies ist eine lokale Zusammenfassung. Für eine KI-gestützte Synthese ist eine Backend-Verbindung erforderlich.';

    return synthesis;
}

/**
 * Saves session to localStorage
 * @param {Object} sessionData - Session to save
 */
function saveToLocalStorage(sessionData) {
    console.log('[storage.js] Saving to localStorage');

    try {
        const sessions = JSON.parse(localStorage.getItem('ki-cockpit-sessions') || '[]');

        // Check if session already exists
        const existingIndex = sessions.findIndex(s => s.id === sessionData.id);
        if (existingIndex >= 0) {
            sessions[existingIndex] = sessionData;
        } else {
            sessions.unshift(sessionData);
        }

        // Keep only last 50 sessions
        const trimmed = sessions.slice(0, 50);
        localStorage.setItem('ki-cockpit-sessions', JSON.stringify(trimmed));

        console.log('[storage.js] Saved to localStorage, total sessions:', trimmed.length);
    } catch (error) {
        console.error('[storage.js] localStorage save error:', error);
    }
}

/**
 * Loads sessions from localStorage
 * @returns {Array} - Array of sessions
 */
function loadFromLocalStorage() {
    console.log('[storage.js] Loading from localStorage');

    try {
        const sessions = JSON.parse(localStorage.getItem('ki-cockpit-sessions') || '[]');
        console.log('[storage.js] Loaded', sessions.length, 'sessions from localStorage');
        return sessions;
    } catch (error) {
        console.error('[storage.js] localStorage load error:', error);
        return [];
    }
}

/**
 * Deletes a session from localStorage
 * @param {string} sessionId - ID of session to delete
 */
function deleteFromLocalStorage(sessionId) {
    console.log('[storage.js] Deleting session:', sessionId);

    try {
        const sessions = JSON.parse(localStorage.getItem('ki-cockpit-sessions') || '[]');
        const filtered = sessions.filter(s => s.id !== sessionId);
        localStorage.setItem('ki-cockpit-sessions', JSON.stringify(filtered));
        console.log('[storage.js] Session deleted');
    } catch (error) {
        console.error('[storage.js] Delete error:', error);
    }
}

/**
 * Generates a unique session ID
 * @returns {string} - Unique ID
 */
function generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

/**
 * Gets a single session by ID from the backend
 * @param {string} id - Session ID
 * @returns {Promise<Object>} - Session data
 */
async function getSession(id) {
    const response = await fetch(BACKEND_URL + '?action=getSession&id=' + id, {
        method: 'GET',
        redirect: 'follow'
    });
    return await response.json();
}

/**
 * Lists all sessions from the backend
 * @returns {Promise<Object>} - Object with status and data array
 */
async function listSessions() {
    console.log('[storage.js] Listing all sessions');
    const response = await fetch(BACKEND_URL + '?action=listSessions', {
        method: 'GET',
        redirect: 'follow'
    });
    return await response.json();
}

/**
 * Gets all projects from the backend
 * @returns {Promise<Object>} - Object with geschäftlich and privat arrays
 */
async function getProjects() {
    console.log('[storage.js] Loading projects from backend');
    const response = await fetch(BACKEND_URL + '?action=getProjects', {
        method: 'GET',
        redirect: 'follow'
    });
    return await response.json();
}

/**
 * Deletes a session from the backend (Google Drive)
 * @param {string} id - Session file ID
 * @returns {Promise<Object>} - Result of deletion
 */
async function deleteSession(id) {
    console.log('[storage.js] Deleting session:', id);
    const response = await fetch(BACKEND_URL, {
        method: 'POST',
        redirect: 'follow',
        headers: {
            'Content-Type': 'text/plain',
        },
        body: JSON.stringify({
            action: 'deleteSession',
            id: id
        })
    });
    return await response.json();
}

/**
 * Calls the backend for intelligent question deduplication using Gemini
 * @param {string} originalProblem - The original problem text
 * @param {Object} questions - Object with chatgpt, claude, gemini question arrays
 * @returns {Promise<Object>} - Deduplicated questions
 */
async function deduplicateQuestionsAPI(originalProblem, questions) {
    const response = await fetch(BACKEND_URL, {
        method: 'POST',
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
            action: 'deduplicateQuestions',
            originalProblem: originalProblem,
            questions: questions
        })
    });
    return await response.json();
}

// Export for module usage (if needed)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        saveSession,
        loadSessions,
        getSession,
        synthesize,
        deduplicateQuestionsAPI,
        saveToLocalStorage,
        loadFromLocalStorage,
        deleteFromLocalStorage,
        generateSessionId
    };
}
