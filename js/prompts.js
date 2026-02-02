/* ========================================
   KI-Cockpit V1 - Prompt Templates
   ======================================== */

const QUESTIONS_TEMPLATE = `Du bist ein präziser Problem-Analyse-Assistent.
Stelle NUR klärende Fragen, KEINE Lösungen.
Maximal 10 Fragen, priorisiert.

[PROBLEM]
{PROBLEM_TEXT}
[/PROBLEM]

Antworte EXAKT in diesem Format:
[QUESTIONS]
1. (P1) (TAG:constraints) Frage hier
2. (P2) (TAG:objective) Weitere Frage
[/QUESTIONS]

Tags: objective | constraints | timeline | stakeholders | risks | technical | other
Prioritäten: P1=kritisch, P2=wichtig, P3=nice-to-have`;

const SOLVE_TEMPLATE = `Löse das Problem basierend auf den Antworten.

[PROBLEM]
{PROBLEM_TEXT}
[/PROBLEM]

[FRAGEN_UND_ANTWORTEN]
{QA_BLOCK}
[/FRAGEN_UND_ANTWORTEN]

Antworte EXAKT in diesem Format:
[STATUS]
readiness: READY oder NEEDS_INFO
[/STATUS]

[SOLUTION]
Deine Lösung hier
[/SOLUTION]

[NEXT_STEPS]
1. Schritt 1
2. Schritt 2
[/NEXT_STEPS]

[RISKS]
- Risiko 1
- Risiko 2
[/RISKS]`;

/**
 * Generates the Phase 1 prompt with the problem text
 * @param {string} problemText - The problem description
 * @returns {string} - The complete prompt
 */
function generateQuestionsPrompt(problemText) {
    console.log('[prompts.js] Generating questions prompt for:', problemText.substring(0, 50) + '...');
    return QUESTIONS_TEMPLATE.replace('{PROBLEM_TEXT}', problemText);
}

/**
 * Generates the Phase 2 prompt with problem and Q&A
 * @param {string} problemText - The problem description
 * @param {Array} questionsAndAnswers - Array of {question, answer} objects
 * @returns {string} - The complete prompt
 */
function generateSolvePrompt(problemText, questionsAndAnswers) {
    console.log('[prompts.js] Generating solve prompt with', questionsAndAnswers.length, 'Q&As');

    const qaBlock = questionsAndAnswers
        .map((qa, index) => `F${index + 1}: ${qa.question}\nA${index + 1}: ${qa.answer || '(nicht beantwortet)'}`)
        .join('\n\n');

    return SOLVE_TEMPLATE
        .replace('{PROBLEM_TEXT}', problemText)
        .replace('{QA_BLOCK}', qaBlock);
}

// Export for module usage (if needed)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        QUESTIONS_TEMPLATE,
        SOLVE_TEMPLATE,
        generateQuestionsPrompt,
        generateSolvePrompt
    };
}
