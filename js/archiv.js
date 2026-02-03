/**
 * KI-Cockpit Archiv - JavaScript
 * Features: Filter, Suche, Session-Details, Löschen
 */

// ========================================
// Globale Variablen
// ========================================

let allSessions = [];
let filteredSessions = [];
let currentSessionId = null;
let currentSessionTitle = null;
let projects = { geschäftlich: [], privat: [] };

// ========================================
// Initialisierung
// ========================================

document.addEventListener('DOMContentLoaded', async () => {
    console.log('[archiv.js] Archiv wird initialisiert');

    // Event Listener für Filter
    setupFilterListeners();

    // Daten laden
    await loadProjects();
    await loadSessions();
});

/**
 * Richtet alle Filter Event Listener ein
 */
function setupFilterListeners() {
    // Suche (mit Debounce)
    const searchInput = document.getElementById('searchInput');
    let searchTimeout;
    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(applyFilters, 300);
    });

    // Kategorie-Filter
    document.getElementById('filterCategory').addEventListener('change', (e) => {
        updateProjectDropdown(e.target.value);
        applyFilters();
    });

    // Projekt-Filter
    document.getElementById('filterProject').addEventListener('change', applyFilters);

    // Datum-Filter
    document.getElementById('filterDateFrom').addEventListener('change', applyFilters);
    document.getElementById('filterDateTo').addEventListener('change', applyFilters);

    // Reset Button
    document.getElementById('resetFilters').addEventListener('click', resetFilters);

    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModal();
            closeDeleteModal();
        }
    });
}

// ========================================
// Daten laden
// ========================================

/**
 * Lädt alle Projekte vom Backend
 */
async function loadProjects() {
    try {
        const result = await getProjects();
        if (result.status === 'success' && result.data) {
            projects = result.data;
            console.log('[archiv.js] Projekte geladen:', projects);
        }
    } catch (error) {
        console.error('[archiv.js] Fehler beim Laden der Projekte:', error);
    }
}

/**
 * Lädt alle Sessions vom Backend
 */
async function loadSessions() {
    const sessionList = document.getElementById('sessionList');

    try {
        const result = await listSessions();

        if (result.status === 'success' && Array.isArray(result.data)) {
            allSessions = result.data;
            console.log('[archiv.js] Sessions geladen:', allSessions.length);

            // Initial alle anzeigen
            filteredSessions = [...allSessions];
            renderSessions();
        } else {
            showEmptyState();
        }
    } catch (error) {
        console.error('[archiv.js] Fehler beim Laden der Sessions:', error);
        sessionList.innerHTML = `
            <div class="loading-state">
                <p style="color: #ef4444;">Fehler beim Laden der Sessions</p>
                <p>${error.message}</p>
            </div>
        `;
    }
}

// ========================================
// Filter-Funktionen
// ========================================

/**
 * Aktualisiert das Projekt-Dropdown basierend auf der Kategorie
 */
function updateProjectDropdown(category) {
    const projectSelect = document.getElementById('filterProject');
    projectSelect.innerHTML = '<option value="">Alle Projekte</option>';

    if (category && projects[category]) {
        projects[category].forEach(project => {
            const option = document.createElement('option');
            option.value = project;
            option.textContent = project;
            projectSelect.appendChild(option);
        });
    } else {
        // Alle Projekte aus beiden Kategorien
        const allProjects = [...new Set([
            ...(projects.geschäftlich || []),
            ...(projects.privat || [])
        ])].sort();

        allProjects.forEach(project => {
            const option = document.createElement('option');
            option.value = project;
            option.textContent = project;
            projectSelect.appendChild(option);
        });
    }
}

/**
 * Wendet alle aktiven Filter an
 */
function applyFilters() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase().trim();
    const category = document.getElementById('filterCategory').value;
    const project = document.getElementById('filterProject').value;
    const dateFrom = document.getElementById('filterDateFrom').value;
    const dateTo = document.getElementById('filterDateTo').value;

    filteredSessions = allSessions.filter(session => {
        // Suche in Titel und Problem
        if (searchTerm) {
            const titleMatch = (session.displayTitle || '').toLowerCase().includes(searchTerm);
            const problemMatch = (session.problem || '').toLowerCase().includes(searchTerm);
            if (!titleMatch && !problemMatch) return false;
        }

        // Kategorie-Filter
        if (category && session.category !== category) return false;

        // Projekt-Filter
        if (project && session.project !== project) return false;

        // Datum von
        if (dateFrom) {
            const sessionDate = new Date(session.timestamp.replace('_', 'T'));
            const fromDate = new Date(dateFrom);
            if (sessionDate < fromDate) return false;
        }

        // Datum bis
        if (dateTo) {
            const sessionDate = new Date(session.timestamp.replace('_', 'T'));
            const toDate = new Date(dateTo);
            toDate.setHours(23, 59, 59); // Ende des Tages
            if (sessionDate > toDate) return false;
        }

        return true;
    });

    console.log('[archiv.js] Filter angewendet:', filteredSessions.length, 'von', allSessions.length);
    renderSessions();
}

/**
 * Setzt alle Filter zurück
 */
function resetFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('filterCategory').value = '';
    document.getElementById('filterProject').value = '';
    document.getElementById('filterDateFrom').value = '';
    document.getElementById('filterDateTo').value = '';

    updateProjectDropdown('');
    filteredSessions = [...allSessions];
    renderSessions();
}

// ========================================
// Rendering
// ========================================

/**
 * Rendert die Session-Liste
 */
function renderSessions() {
    const sessionList = document.getElementById('sessionList');
    const emptyState = document.getElementById('emptyState');
    const sessionCount = document.getElementById('sessionCount');

    // Counter aktualisieren
    sessionCount.textContent = `${filteredSessions.length} Session${filteredSessions.length !== 1 ? 's' : ''}`;

    if (filteredSessions.length === 0) {
        sessionList.innerHTML = '';
        emptyState.classList.remove('hidden');
        return;
    }

    emptyState.classList.add('hidden');

    sessionList.innerHTML = filteredSessions.map(session => `
        <article class="session-card" onclick="openSession('${session.id}')">
            <div class="session-card-header">
                <h3 class="session-card-title">${escapeHtml(session.displayTitle || 'Unbenannte Session')}</h3>
                <span class="session-card-date">${formatDate(session.timestamp)}</span>
            </div>
            <div class="session-card-meta">
                <span class="badge badge-${session.category || 'privat'}">${session.category || 'privat'}</span>
                <span class="badge badge-secondary">${escapeHtml(session.project || 'Allgemein')}</span>
            </div>
            ${session.problem ? `<p class="session-card-preview">${escapeHtml(truncate(session.problem, 150))}</p>` : ''}
        </article>
    `).join('');
}

/**
 * Zeigt den leeren Zustand an
 */
function showEmptyState() {
    document.getElementById('sessionList').innerHTML = '';
    document.getElementById('emptyState').classList.remove('hidden');
    document.getElementById('sessionCount').textContent = '0 Sessions';
}

// ========================================
// Session Detail Modal
// ========================================

/**
 * Öffnet eine Session im Detail-Modal
 */
async function openSession(sessionId) {
    console.log('[archiv.js] Öffne Session:', sessionId);
    currentSessionId = sessionId;

    const modal = document.getElementById('sessionModal');
    modal.classList.remove('hidden');

    // Loading State im Modal
    document.getElementById('modalTitle').textContent = 'Wird geladen...';
    document.getElementById('modalProblem').textContent = '';

    try {
        const result = await getSession(sessionId);

        if (result.status === 'success' && result.data) {
            const session = result.data;
            currentSessionTitle = session.titleSlug || session.displayTitle || 'Unbenannte Session';

            // Header
            document.getElementById('modalTitle').textContent = session.titleSlug || 'Session Details';

            // Meta
            const categoryBadge = document.getElementById('modalCategory');
            categoryBadge.textContent = session.category || 'privat';
            categoryBadge.className = `badge badge-${session.category || 'privat'}`;

            document.getElementById('modalProject').textContent = session.project || 'Allgemein';
            document.getElementById('modalDate').textContent = formatDate(session.timestamp || new Date().toISOString());

            // Problem
            document.getElementById('modalProblem').textContent = session.problem || 'Kein Problem gespeichert';

            // Fragen
            const questionsSection = document.getElementById('modalQuestionsSection');
            const questionsDiv = document.getElementById('modalQuestions');
            if (session.deduplicatedQuestions && session.deduplicatedQuestions.length > 0) {
                questionsSection.classList.remove('hidden');
                questionsDiv.innerHTML = session.deduplicatedQuestions.map((q, i) =>
                    `<div style="margin-bottom: 0.5rem;"><strong>${i + 1}.</strong> ${escapeHtml(q.question || q)}</div>`
                ).join('');
            } else {
                questionsSection.classList.add('hidden');
            }

            // KI-Lösungen
            const solutionsSection = document.getElementById('modalSolutionsSection');
            if (session.aiSolutions) {
                solutionsSection.classList.remove('hidden');
                document.getElementById('modalChatGPT').textContent = session.aiSolutions.chatgpt || 'Keine Antwort';
                document.getElementById('modalClaude').textContent = session.aiSolutions.claude || 'Keine Antwort';
                document.getElementById('modalGemini').textContent = session.aiSolutions.gemini || 'Keine Antwort';
            } else {
                solutionsSection.classList.add('hidden');
            }

            // Synthese
            const synthesisSection = document.getElementById('modalSynthesisSection');
            if (session.synthesis) {
                synthesisSection.classList.remove('hidden');
                const synthesisText = typeof session.synthesis === 'object'
                    ? session.synthesis.synthesis || JSON.stringify(session.synthesis)
                    : session.synthesis;
                document.getElementById('modalSynthesis').textContent = synthesisText;
            } else {
                synthesisSection.classList.add('hidden');
            }
        } else {
            document.getElementById('modalProblem').textContent = 'Fehler beim Laden der Session';
        }
    } catch (error) {
        console.error('[archiv.js] Fehler beim Laden der Session:', error);
        document.getElementById('modalProblem').textContent = 'Fehler: ' + error.message;
    }
}

/**
 * Schließt das Detail-Modal
 */
function closeModal() {
    document.getElementById('sessionModal').classList.add('hidden');
    currentSessionId = null;
    currentSessionTitle = null;
}

// ========================================
// Löschen-Funktionen
// ========================================

/**
 * Öffnet den Lösch-Bestätigungs-Dialog
 */
function confirmDelete() {
    if (!currentSessionId) return;

    document.getElementById('deleteSessionTitle').textContent = currentSessionTitle;
    document.getElementById('deleteModal').classList.remove('hidden');
}

/**
 * Schließt den Lösch-Dialog
 */
function closeDeleteModal() {
    document.getElementById('deleteModal').classList.add('hidden');
}

/**
 * Führt das Löschen aus
 */
async function executeDelete() {
    if (!currentSessionId) return;

    const deleteBtn = document.querySelector('#deleteModal .btn-danger');
    deleteBtn.textContent = 'Wird gelöscht...';
    deleteBtn.disabled = true;

    try {
        const result = await deleteSession(currentSessionId);

        if (result.status === 'success') {
            // Session aus lokaler Liste entfernen
            allSessions = allSessions.filter(s => s.id !== currentSessionId);
            filteredSessions = filteredSessions.filter(s => s.id !== currentSessionId);

            // UI aktualisieren
            closeDeleteModal();
            closeModal();
            renderSessions();

            showToast('Session erfolgreich gelöscht', 'success');
        } else {
            showToast('Fehler beim Löschen: ' + (result.message || 'Unbekannter Fehler'), 'error');
        }
    } catch (error) {
        console.error('[archiv.js] Fehler beim Löschen:', error);
        showToast('Fehler beim Löschen: ' + error.message, 'error');
    } finally {
        deleteBtn.textContent = 'Ja, endgültig löschen';
        deleteBtn.disabled = false;
    }
}

// ========================================
// Hilfsfunktionen
// ========================================

/**
 * Formatiert ein Datum für die Anzeige
 */
function formatDate(timestamp) {
    if (!timestamp) return '';

    try {
        // Format: "2024-01-15_14-30" oder ISO String
        const dateStr = timestamp.replace('_', 'T').replace(/-(\d{2})$/, ':$1');
        const date = new Date(dateStr);

        if (isNaN(date.getTime())) {
            return timestamp; // Fallback: Original zurückgeben
        }

        return date.toLocaleDateString('de-DE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (e) {
        return timestamp;
    }
}

/**
 * Kürzt Text auf eine maximale Länge
 */
function truncate(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

/**
 * Escaped HTML für sichere Ausgabe
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Zeigt eine Toast-Nachricht an
 */
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type}`;

    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}
