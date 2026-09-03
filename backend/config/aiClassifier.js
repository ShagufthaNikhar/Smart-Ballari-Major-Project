const axios = require('axios');

const HF_TOKEN  = process.env.HF_API_TOKEN;
// api-inference.huggingface.co was retired — Hugging Face now routes all
// serverless inference calls through router.huggingface.co instead.
const HF_BASE   = 'https://router.huggingface.co/hf-inference/models';

// ── TEXT CLASSIFIER ───────────────────────────────────
// Zero-shot classification — no training needed
const TEXT_MODEL = 'facebook/bart-large-mnli';

const ISSUE_LABELS = [
  'road damage or pothole',
  'water supply problem or leakage',
  'electricity or power outage',
  'garbage or sanitation problem',
  'street light not working',
  'drainage or sewage overflow',
  'illegal construction',
  'noise pollution',
  'other civic issue'
];

// Label → our category enum
const LABEL_TO_CATEGORY = {
  'road damage or pothole':          'road',
  'water supply problem or leakage': 'water',
  'electricity or power outage':     'electric',
  'garbage or sanitation problem':   'sanitation',
  'street light not working':        'electric',
  'drainage or sewage overflow':     'water',
  'illegal construction':            'other',
  'noise pollution':                 'other',
  'other civic issue':               'other'
};

async function classifyText(text) {
  if (!HF_TOKEN) {
    console.warn('HF_API_TOKEN is not set — skipping model call, using keyword fallback.');
    return keywordFallback(text);
  }

  try {
    const res = await axios.post(
      `${HF_BASE}/${TEXT_MODEL}`,
      {
        inputs:     text,
        parameters: { candidate_labels: ISSUE_LABELS }
      },
      {
        headers: {
          Authorization: `Bearer ${HF_TOKEN}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      }
    );

    const predictions = res.data; // new router shape: [{ label, score }, ...] sorted desc

    if (!Array.isArray(predictions) || predictions.length === 0) {
      console.warn('HF response was not the expected array shape:', JSON.stringify(res.data));
      return keywordFallback(text);
    }

    // Top prediction
    const topLabel    = predictions[0].label;
    const topScore     = predictions[0].score;
    const category    = LABEL_TO_CATEGORY[topLabel] || 'other';

    // Build ranked results
    const ranked = predictions.map(p => ({
      label:    p.label,
      category: LABEL_TO_CATEGORY[p.label] || 'other',
      score:    parseFloat((p.score * 100).toFixed(1))
    }));

    return {
      success:    true,
      category,
      label:      topLabel,
      confidence: parseFloat((topScore * 100).toFixed(1)),
      ranked:     ranked.slice(0, 4),
      engine:     'huggingface/bart-large-mnli'
    };

  } catch (err) {
    // Fallback: keyword-based classifier.
    // Logged so it's visible WHY the real model call failed — a silent
    // catch here is exactly what made every result look identical (a
    // flat 70%) with no way to tell what went wrong.
    console.warn(
      'HF text classification failed, using keyword fallback:',
      err.response?.status,
      err.response?.data ? JSON.stringify(err.response.data) : err.message
    );
    return keywordFallback(text);
  }
}

// ── IMAGE CLASSIFIER ──────────────────────────────────
// Vision model for uploaded issue photos
const IMAGE_MODEL = 'google/vit-base-patch16-224';

// ImageNet labels → our categories
const IMAGE_LABEL_MAP = {
  'pothole':       'road',
  'road':          'road',
  'street':        'road',
  'garbage':       'sanitation',
  'trash':         'sanitation',
  'waste':         'sanitation',
  'pipe':          'water',
  'flood':         'water',
  'water':         'water',
  'wire':          'electric',
  'electricity':   'electric',
  'construction':  'other'
};

async function classifyImage(imageBase64) {
  if (!HF_TOKEN) {
    console.warn('HF_API_TOKEN is not set — image classification unavailable.');
    return { success: false, category: 'other', confidence: 0, error: 'HF_API_TOKEN not set' };
  }

  try {
    // Strip data URL prefix if present
    const base64Data = imageBase64.includes(',')
      ? imageBase64.split(',')[1]
      : imageBase64;

    const res = await axios.post(
      `${HF_BASE}/${IMAGE_MODEL}`,
      { inputs: base64Data },
      {
        headers: {
          Authorization:  `Bearer ${HF_TOKEN}`,
          'Content-Type': 'application/json'
        },
        timeout: 20000
      }
    );

    const predictions = res.data;  // [{label, score}]

    // Map to our categories
    let category = 'other';
    let topLabel = predictions[0]?.label || 'unknown';
    let topScore = predictions[0]?.score || 0;

    for (const pred of predictions) {
      const lower = pred.label.toLowerCase();
      for (const [keyword, cat] of Object.entries(IMAGE_LABEL_MAP)) {
        if (lower.includes(keyword)) {
          category = cat;
          topLabel = pred.label;
          topScore = pred.score;
          break;
        }
      }
      if (category !== 'other') break;
    }

    return {
      success:    true,
      category,
      label:      topLabel,
      confidence: parseFloat((topScore * 100).toFixed(1)),
      engine:     'huggingface/vit-base-patch16-224'
    };

  } catch (err) {
    console.warn(
      'HF image classification failed:',
      err.response?.status,
      err.response?.data || err.message
    );
    return {
      success:    false,
      category:   'other',
      confidence: 0,
      error:      err.message
    };
  }
}

// ── COMBINED CLASSIFIER ───────────────────────────────
// Use both text + image, pick highest confidence
async function classifyIssue(text, imageBase64 = null) {
  const results = { text: null, image: null, final: null };

  // Always classify text
  if (text) {
    results.text = await classifyText(text);
  }

  // Classify image if provided
  if (imageBase64) {
    results.image = await classifyImage(imageBase64);
  }

  // Pick final: higher confidence wins
  if (results.text && results.image) {
    results.final = results.text.confidence >= results.image.confidence
      ? { ...results.text, source: 'text' }
      : { ...results.image, source: 'image' };
  } else {
    results.final = results.text
      ? { ...results.text, source: 'text' }
      : { ...results.image, source: 'image' };
  }

  return results;
}

// ── KEYWORD FALLBACK ──────────────────────────────────
// Used only when the real HF model call isn't available (no token,
// rate-limited, model cold-starting, network error, etc). This is a
// rule-based guess, not a statistical confidence — but it now scales
// with how strong the match is instead of returning a flat 70/50 for
// every single case, so results at least vary with the input.
function keywordFallback(text) {
  const lower = text.toLowerCase();

  const rules = [
    { keywords: ['pothole','road','tar','crack','broken road'], category: 'road' },
    { keywords: ['water','pipe','leak','supply','tap'], category: 'water' },
    { keywords: ['light','electric','power','current','wire'], category: 'electric' },
    { keywords: ['garbage','waste','dustbin','trash','smell'], category: 'sanitation' }
  ];

  for (const rule of rules) {
    const matchCount = rule.keywords.filter(k => lower.includes(k)).length;
    if (matchCount > 0) {
      // Base 60, +8 per extra matched keyword, capped at 92 — still a
      // heuristic, not a real probability, but no longer identical
      // for every match.
      const confidence = Math.min(60 + (matchCount - 1) * 8, 92);
      return {
        success:    true,
        category:   rule.category,
        label:      rule.keywords.find(k => lower.includes(k)),
        confidence,
        ranked:     [],
        engine:     'keyword-fallback'
      };
    }
  }

  return {
    success:    true,
    category:   'other',
    label:      'other civic issue',
    confidence: 50,
    ranked:     [],
    engine:     'keyword-fallback'
  };
}

module.exports = { classifyText, classifyImage, classifyIssue };