const User = require('../models/User');

const requireRole = (...allowedRoles) => {
  return async (req, res, next) => {
    try {
      const user = await User.findOne({ uid: req.user.uid });

      if (!user) {
        return res.status(404).json({ error: 'User not found in DB' });
      }

      if (!allowedRoles.includes(user.role)) {
        return res.status(403).json({
          error: `Access denied. Required: ${allowedRoles.join(' or ')}`
        });
      }

      req.dbUser = user; // attach full user to request
      next();
    } catch {
      res.status(500).json({ error: 'Role check failed' });
    }
  };
};

module.exports = requireRole;