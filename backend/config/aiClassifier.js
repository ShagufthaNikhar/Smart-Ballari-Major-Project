const axios = require('axios');

const HF_TOKEN  = process.env.HF_API_TOKEN;
const HF_BASE   = 'https://api-inference.huggingface.co/models';

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

    const { labels, scores } = res.data;

    // Top prediction
    const topLabel    = labels[0];
    const topScore    = scores[0];
    const category    = LABEL_TO_CATEGORY[topLabel] || 'other';

    // Build ranked results
    const ranked = labels.map((label, i) => ({
      label,
      category: LABEL_TO_CATEGORY[label] || 'other',
      score:    parseFloat((scores[i] * 100).toFixed(1))
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
    // Fallback: keyword-based classifier
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
function keywordFallback(text) {
  const lower = text.toLowerCase();

  const rules = [
    { keywords: ['pothole','road','tar','crack','broken road'], category: 'road' },
    { keywords: ['water','pipe','leak','supply','tap'], category: 'water' },
    { keywords: ['light','electric','power','current','wire'], category: 'electric' },
    { keywords: ['garbage','waste','dustbin','trash','smell'], category: 'sanitation' }
  ];

  for (const rule of rules) {
    if (rule.keywords.some(k => lower.includes(k))) {
      return {
        success:    true,
        category:   rule.category,
        label:      rule.keywords[0],
        confidence: 70,
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


