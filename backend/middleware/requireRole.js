const User = require('../models/User');

/**
 * Role gate. Runs AFTER verifyToken, which sets req.user = decoded Firebase token.
 *
 * FIX: the lookup was { uid: req.user.uid }, but the User schema field is
 * `firebaseUid`. That query matched nothing, so every guarded route returned
 * 404 regardless of the caller.
 *
 * The role is read from MongoDB, never from the Firebase token or the request
 * body - a custom claim can go stale, and a body field can be forged.
 */
const requireRole = (...allowedRoles) => {
  return async (req, res, next) => {
    try {
      const user = await User.findOne({ firebaseUid: req.user.uid });

      if (!user) {
        return res.status(401).json({ error: 'User not registered' });
      }
      if (!user.active) {
        return res.status(403).json({ error: 'Account disabled' });
      }
      if (!allowedRoles.includes(user.role)) {
        // Deliberately vague - do not reveal what role the route wants.
        return res.status(403).json({ error: 'Forbidden' });
      }

      req.dbUser = user;
      // Alias so route code can use either. Keeps the Firebase claims on
      // req.firebaseUser in case anything downstream still needs them.
      req.firebaseUser = req.user;
      req.user = user;

      next();
    } catch (err) {
      console.error('Role check failed:', err);
      res.status(500).json({ error: 'Role check failed' });
    }
  };
};

module.exports = requireRole;