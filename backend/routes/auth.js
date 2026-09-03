const express = require('express');
const router  = express.Router();
const User    = require('../models/User');
const admin   = require('../middleware/firebaseAdmin');

/**
 * POST /api/auth/sync-user
 * Called right after Firebase sign-in or registration. Creates the MongoDB
 * user record on first sight, returns it afterwards.
 *
 * SECURITY: `role` is hardcoded to 'citizen' and is never read from the
 * request. This endpoint runs before any role check exists, so accepting a
 * client-supplied role here would let anyone register as an admin.
 * Promotion happens only via PATCH /api/admin/users/:id/role.
 */
router.post('/sync-user', async (req, res) => {
  const header = req.headers.authorization || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : req.body.token;

  if (!token) return res.status(401).json({ error: 'No token provided' });

  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(token);
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }

  try {
    const { uid, email, name } = decoded;
    if (!email) return res.status(400).json({ error: 'Account has no email address.' });

    // Upsert atomically. find-then-create raced: two simultaneous first
    // logins both saw "no user" and both inserted, and the unique index
    // on firebaseUid rejected one.
    //
    // $setOnInsert means role and name are written ONLY at creation, so a
    // later login can never reset an officer or admin back to citizen.
    const user = await User.findOneAndUpdate(
      { firebaseUid: uid },
      {
        $set: { email: email.toLowerCase() },
        $setOnInsert: {
          firebaseUid: uid,
          name:        name || email.split('@')[0],
          role:        'citizen',
          active:      true
        }
      },
      { returnDocument: 'after', upsert: true, runValidators: true }
    );

    res.json({
      success: true,
      user: {
        id:    user._id,
        name:  user.name,
        email: user.email,
        role:  user.role,
        department: user.role === 'officer' ? user.department : undefined
      }
    });
  } catch (err) {
    // Log the real reason. The original bare catch reported "Invalid token"
    // for Mongo validation failures, pointing debugging at Firebase.
    console.error('sync-user failed:', err);
    res.status(500).json({ error: 'Could not complete sign-in.' });
  }
});

// GET /api/auth/me removed - duplicated GET /api/me and had the same
// `uid` vs `firebaseUid` bug. /api/me is the single source of truth.

module.exports = router;