const { classifyText } = require('./aiClassifier');

// POST /api/issues must stay fast. classifyText allows axios 15s and a
// cold HuggingFace model can exceed that, which would hang the submit
// button. Cap the wait; the caller keeps the client's category if we
// time out.
const SOFT_TIMEOUT_MS = 5000;

async function classifyWithTimeout(text, ms = SOFT_TIMEOUT_MS) {
  let timer;
  const timeout = new Promise(resolve => {
    timer = setTimeout(() => resolve(null), ms);
  });
  try {
    return await Promise.race([classifyText(text), timeout]);
  } catch (err) {
    console.warn('classifyWithTimeout failed:', err.message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { classifyWithTimeout };