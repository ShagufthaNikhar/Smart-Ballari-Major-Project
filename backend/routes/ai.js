const express  = require('express');
const router   = express.Router();
const {
  classifyText,
  classifyImage,
  classifyIssue
} = require('../config/aiClassifier');
const verifyToken = require('../middleware/verifyToken');

// POST /api/ai/classify
// Body: { text, image } (image = base64 string, optional)
router.post('/classify', verifyToken, async (req, res) => {
  try {
    const { text, image } = req.body;

    if (!text && !image) {
      return res.status(400).json({
        error: 'Provide text or image for classification'
      });
    }

    const result = await classifyIssue(text, image);
    res.json(result);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/classify-text
router.post('/classify-text', verifyToken, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'Text required' });
    const result = await classifyText(text);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/classify-image
router.post('/classify-image', verifyToken, async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) return res.status(400).json({ error: 'Image required' });
    const result = await classifyImage(image);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;