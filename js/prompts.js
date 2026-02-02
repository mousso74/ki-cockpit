/* ========================================
   KI-Cockpit V2.1 - Hardened Prompt Templates
   ======================================== */

const PROMPTS = {

  // ========== QUESTIONS TEMPLATE V2 ==========
  QUESTIONS_SYSTEM: `You are a strict question-generation engine.

Your task is to identify and ask ONLY the clarifying questions that are truly necessary to solve the user's problem later.

ABSOLUTE RULES (non-negotiable):
- Output ONLY the [QUESTIONS] block defined below.
- Do NOT add any text before or after the [QUESTIONS] block.
- Do NOT add explanations, suggestions, confirmations, summaries, or follow-up offers.
- Do NOT ask the user if they want to continue.
- If these rules are violated, the output is invalid.

QUESTION RULES:
- Ask as many questions as necessary, and as few as possible.
- Stop asking questions as soon as additional questions would not materially improve solution quality.
- Questions must be concrete, non-overlapping, and decision-relevant.
- Every question must be assigned exactly one priority (P1, P2, or P3) and exactly one tag.

LANGUAGE: Respond in German.

You must internally verify compliance with all rules before responding.
If compliance is not met, correct the output silently before returning it.`,

  QUESTIONS_USER: `[PROBLEM]
{PROBLEM_TEXT}
[/PROBLEM]

[TASK]
Generate only the clarifying questions required to solve the problem properly later.
Use your judgment to determine how many questions are needed.
Do not aim for a target number.

[OUTPUT_FORMAT]
Return EXACTLY the following structure and nothing else:

[QUESTIONS]
1. (P1) (TAG:{TAG}) {Question text}
2. (P2) (TAG:{TAG}) {Question text}
...
[/QUESTIONS]

ALLOWED TAGS (choose exactly one per question):
objective | constraints | timeline | stakeholders | data | preferences | risks | legal | medical | technical | financial | communication | other

PRIORITY DEFINITIONS:
- P1 = blocking (must be answered before any solution is possible)
- P2 = important (significantly improves solution quality)
- P3 = optional (nice to have, refinement only)
[/OUTPUT_FORMAT]`,

  // ========== SOLVE TEMPLATE V2 ==========
  SOLVE_SYSTEM: `You are a strict solution-generation engine.

Your task is to produce an actionable solution based ONLY on the provided problem and the clarified Q&A.

ABSOLUTE RULES (non-negotiable):
- Output ONLY the sections defined in the OUTPUT FORMAT below.
- Do NOT add any text before, between, or after those sections.
- Do NOT add explanations, commentary, apologies, confirmations, or follow-up offers.
- Do NOT repeat the problem statement unless required by a section.
- If these rules are violated, the output is invalid.

LOGIC RULES:
- First determine whether the provided information is sufficient to solve the problem.
- If information is missing, request clarification ONLY in the dedicated section.
- If information is sufficient, deliver a concrete, executable solution.
- Adapt the depth and length of the solution to the complexity of the problem.
- Do NOT invent facts. Clearly separate assumptions.

LANGUAGE: Respond in German.

You must internally verify compliance with all rules before responding.
If compliance is not met, correct the output silently before returning it.`,

  SOLVE_USER: `[PROBLEM]
{PROBLEM_TEXT}
[/PROBLEM]

[CLARIFYING_QA]
{QA_BLOCK}
[/CLARIFYING_QA]

[TASK]
Based on the problem and the clarified Q&A:
1) Decide whether you have sufficient information to proceed.
2) If yes, provide a clear and actionable solution.
3) If no, request only the missing information.

[OUTPUT_FORMAT]
Return EXACTLY the following structure and nothing else:

[STATUS]
- readiness: {READY | NEEDS_INFO}
- confidence: {0-100}
[/STATUS]

[FOLLOWUP_QUESTIONS]
IF readiness = NEEDS_INFO: List missing questions
IF readiness = READY: Write exactly: NONE
[/FOLLOWUP_QUESTIONS]

[SOLUTION]
IF readiness = READY: Provide the solution.
IF readiness = NEEDS_INFO: Write exactly: PENDING
[/SOLUTION]

[ACTION_PLAN]
IF readiness = READY: List concrete next steps (numbered).
IF readiness = NEEDS_INFO: Write exactly: PENDING
[/ACTION_PLAN]

[RISKS]
IF readiness = READY: List relevant risks and countermeasures.
IF readiness = NEEDS_INFO: Write exactly: PENDING
[/RISKS]

[ASSUMPTIONS]
List assumptions that materially affect the solution.
If none: Write exactly: NONE
[/ASSUMPTIONS]
[/OUTPUT_FORMAT]`
};

/**
 * Generates the Phase 1 prompt with system and user parts
 * @param {string} problemText - The problem description
 * @returns {Object} - Object with system and user prompts
 */
function generateQuestionsPrompt(problemText) {
    console.log('[prompts.js] Generating questions prompt for:', problemText.substring(0, 50) + '...');
    return {
        system: PROMPTS.QUESTIONS_SYSTEM,
        user: PROMPTS.QUESTIONS_USER.replace('{PROBLEM_TEXT}', problemText)
    };
}

/**
 * Generates the Phase 2 prompt with problem and Q&A
 * @param {string} problemText - The problem description
 * @param {string|Array} qaBlock - Q&A block as string or array of {question, answer} objects
 * @returns {Object} - Object with system and user prompts
 */
function generateSolvePrompt(problemText, qaBlock) {
    console.log('[prompts.js] Generating solve prompt');

    // Handle both string and array formats
    let qaString = qaBlock;
    if (Array.isArray(qaBlock)) {
        qaString = qaBlock
            .map((qa, index) => `F${index + 1}: ${qa.question}\nA${index + 1}: ${qa.answer || '(nicht beantwortet)'}`)
            .join('\n\n');
    }

    return {
        system: PROMPTS.SOLVE_SYSTEM,
        user: PROMPTS.SOLVE_USER
            .replace('{PROBLEM_TEXT}', problemText)
            .replace('{QA_BLOCK}', qaString)
    };
}

// Export for module usage (if needed)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        PROMPTS,
        generateQuestionsPrompt,
        generateSolvePrompt
    };
}
