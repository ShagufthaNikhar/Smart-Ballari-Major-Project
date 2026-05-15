const express = require('express');
const router = express.Router();
const User = require('../models/User');
const admin = require('../middleware/firebaseAdmin');
const verifyToken = require('../middleware/verifyToken');

// Register or login — called after Firebase auth on frontend
router.post('/sync-user', async (req, res) => {
  const { token } = req.body;

  try {
    // Verify Firebase token
    const decoded = await admin.auth().verifyIdToken(token);
    const { uid, email } = decoded;

    // Check if user exists in MongoDB
    let user = await User.findOne({ uid });

    if (!user) {
      // New user — default role is 'user'
      user = await User.create({ uid, email, role: 'user' });
    }

    res.json({ success: true, user });
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// GET /api/auth/me — get current user info
router.get('/me', verifyToken, async (req, res) => {
  try {
    const user = await User.findOne({ uid: req.user.uid });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;