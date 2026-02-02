/* ========================================
   KI-Cockpit V1 - Parser Functions
   ======================================== */

/**
 * Normalizes text for comparison
 * @param {string} text - Input text
 * @returns {string} - Normalized text (lowercase, no special chars)
 */
function normalizeText(text) {
    return text
        .toLowerCase()
        .replace(/[^\w\säöüß]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Calculates Jaccard similarity between two strings
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} - Similarity score (0-1)
 */
function jaccardSimilarity(str1, str2) {
    const set1 = new Set(normalizeText(str1).split(' '));
    const set2 = new Set(normalizeText(str2).split(' '));

    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    if (union.size === 0) return 0;
    return intersection.size / union.size;
}

/**
 * Extracts questions from AI output
 * @param {string} text - AI response text
 * @param {string} source - Source identifier (chatgpt, claude, gemini)
 * @returns {Array} - Array of question objects
 */
function extractQuestions(text, source) {
    console.log(`[parser.js] Extracting questions from ${source}`);

    const questions = [];

    // Try to find [QUESTIONS] block first
    const questionsBlockMatch = text.match(/\[QUESTIONS\]([\s\S]*?)\[\/QUESTIONS\]/i);
    const contentToProcess = questionsBlockMatch ? questionsBlockMatch[1] : text;

    // Pattern to match numbered questions with optional priority and tag
    // Matches: "1. (P1) (TAG:xyz) Question text" or simpler formats
    const patterns = [
        // Full format: 1. (P1) (TAG:xyz) Question
        /(\d+)\.\s*\(P([1-3])\)\s*\(TAG:(\w+)\)\s*(.+?)(?=\n\d+\.|$)/gi,
        // With priority only: 1. (P1) Question
        /(\d+)\.\s*\(P([1-3])\)\s*(.+?)(?=\n\d+\.|$)/gi,
        // Simple numbered: 1. Question
        /(\d+)\.\s*(.+?)(?=\n\d+\.|$)/gi,
        // Bullet points
        /[-•]\s*(.+?)(?=\n[-•]|$)/gi
    ];

    let matched = false;

    // Try full format first
    const fullFormatRegex = /(\d+)\.\s*\(P([1-3])\)\s*\(TAG:(\w+)\)\s*(.+)/gi;
    let match;

    while ((match = fullFormatRegex.exec(contentToProcess)) !== null) {
        questions.push({
            number: parseInt(match[1]),
            priority: `P${match[2]}`,
            tag: match[3].toLowerCase(),
            text: match[4].trim(),
            source: source,
            originalText: match[0]
        });
        matched = true;
    }

    // If full format didn't work, try priority-only format
    if (!matched) {
        const priorityOnlyRegex = /(\d+)\.\s*\(P([1-3])\)\s*([^(\n]+)/gi;
        while ((match = priorityOnlyRegex.exec(contentToProcess)) !== null) {
            questions.push({
                number: parseInt(match[1]),
                priority: `P${match[2]}`,
                tag: 'other',
                text: match[3].trim(),
                source: source,
                originalText: match[0]
            });
            matched = true;
        }
    }

    // If still no match, try simple numbered format
    if (!matched) {
        const simpleRegex = /(\d+)\.\s*([^?\n]+\?)/gi;
        while ((match = simpleRegex.exec(contentToProcess)) !== null) {
            questions.push({
                number: parseInt(match[1]),
                priority: 'P2',
                tag: 'other',
                text: match[2].trim(),
                source: source,
                originalText: match[0]
            });
            matched = true;
        }
    }

    // Last resort: find anything that looks like a question
    if (!matched) {
        const questionMarkRegex = /([^.!?\n]+\?)/gi;
        let num = 1;
        while ((match = questionMarkRegex.exec(contentToProcess)) !== null) {
            const questionText = match[1].trim();
            if (questionText.length > 10) { // Filter out very short matches
                questions.push({
                    number: num++,
                    priority: 'P2',
                    tag: 'other',
                    text: questionText,
                    source: source,
                    originalText: match[0]
                });
            }
        }
    }

    console.log(`[parser.js] Extracted ${questions.length} questions from ${source}`);
    return questions;
}

/**
 * Deduplicates questions from multiple sources
 * @param {Array} allQuestions - Array of all question objects
 * @param {number} threshold - Jaccard similarity threshold (default 0.6)
 * @returns {Array} - Deduplicated array of merged question objects
 */
function deduplicateQuestions(allQuestions, threshold = 0.6) {
    console.log(`[parser.js] Deduplicating ${allQuestions.length} questions with threshold ${threshold}`);

    const merged = [];
    const used = new Set();

    for (let i = 0; i < allQuestions.length; i++) {
        if (used.has(i)) continue;

        const group = {
            questions: [allQuestions[i]],
            sources: new Set([allQuestions[i].source]),
            priority: allQuestions[i].priority,
            tag: allQuestions[i].tag
        };

        // Find similar questions
        for (let j = i + 1; j < allQuestions.length; j++) {
            if (used.has(j)) continue;

            const similarity = jaccardSimilarity(
                allQuestions[i].text,
                allQuestions[j].text
            );

            if (similarity >= threshold) {
                group.questions.push(allQuestions[j]);
                group.sources.add(allQuestions[j].source);
                used.add(j);

                // Use highest priority
                const priorities = { 'P1': 1, 'P2': 2, 'P3': 3 };
                if (priorities[allQuestions[j].priority] < priorities[group.priority]) {
                    group.priority = allQuestions[j].priority;
                }
            }
        }

        used.add(i);

        // Create merged question object
        // Use the longest question text as representative
        const longestQuestion = group.questions.reduce((a, b) =>
            a.text.length > b.text.length ? a : b
        );

        merged.push({
            id: merged.length + 1,
            text: longestQuestion.text,
            priority: group.priority,
            tag: group.tag,
            sources: Array.from(group.sources),
            variants: group.questions.map(q => ({ source: q.source, text: q.text })),
            answer: ''
        });
    }

    // Sort by priority
    merged.sort((a, b) => {
        const priorities = { 'P1': 1, 'P2': 2, 'P3': 3 };
        return priorities[a.priority] - priorities[b.priority];
    });

    console.log(`[parser.js] Deduplicated to ${merged.length} unique questions`);
    return merged;
}

/**
 * Extracts solution sections from AI output
 * @param {string} text - AI response text
 * @returns {Object} - Object with solution, nextSteps, risks
 */
function extractSolution(text) {
    console.log('[parser.js] Extracting solution sections');

    const result = {
        status: 'UNKNOWN',
        solution: '',
        nextSteps: [],
        risks: []
    };

    // Extract status
    const statusMatch = text.match(/\[STATUS\]([\s\S]*?)\[\/STATUS\]/i);
    if (statusMatch) {
        const readinessMatch = statusMatch[1].match(/readiness:\s*(READY|NEEDS_INFO)/i);
        if (readinessMatch) {
            result.status = readinessMatch[1].toUpperCase();
        }
    }

    // Extract solution
    const solutionMatch = text.match(/\[SOLUTION\]([\s\S]*?)\[\/SOLUTION\]/i);
    if (solutionMatch) {
        result.solution = solutionMatch[1].trim();
    } else {
        // Fallback: use entire text if no tags found
        result.solution = text.trim();
    }

    // Extract next steps
    const stepsMatch = text.match(/\[NEXT_STEPS\]([\s\S]*?)\[\/NEXT_STEPS\]/i);
    if (stepsMatch) {
        const steps = stepsMatch[1].match(/\d+\.\s*(.+)/g);
        if (steps) {
            result.nextSteps = steps.map(s => s.replace(/^\d+\.\s*/, '').trim());
        }
    }

    // Extract risks
    const risksMatch = text.match(/\[RISKS\]([\s\S]*?)\[\/RISKS\]/i);
    if (risksMatch) {
        const risks = risksMatch[1].match(/[-•]\s*(.+)/g);
        if (risks) {
            result.risks = risks.map(r => r.replace(/^[-•]\s*/, '').trim());
        }
    }

    return result;
}

// Export for module usage (if needed)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        normalizeText,
        jaccardSimilarity,
        extractQuestions,
        deduplicateQuestions,
        extractSolution
    };
}
