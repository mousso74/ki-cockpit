/* ======================================================================
 * storage_discussion.js — Backend-Calls für LLM-Diskussion
 * Nutzt BACKEND_URL aus storage.js (muss vorher geladen sein).
 * ==================================================================== */

async function postAction(action, payload) {
  const response = await fetch(BACKEND_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(Object.assign({ action }, payload))
  });
  return response.json();
}

async function analyzeDivergence(positions, threshold) {
  return postAction('analyzeDivergence', { positions, threshold });
}

async function synthesizeDiscussion(payload) {
  return postAction('synthesizeDiscussion', payload);
}
