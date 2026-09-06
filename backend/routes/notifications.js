const express    = require('express');
const router     = express.Router();
const { sendMail } = require('../config/mailer');
const verifyToken  = require('../middleware/verifyToken');
const requireRole  = require('../middleware/requireRole');
const Issue        = require('../models/Issue');

// POST /api/notify/status-update
// Called automatically when issue status changes
router.post(
  '/status-update',
  verifyToken,
  requireRole('admin'),
  async (req, res) => {
    const { issueId, status } = req.body;

    try {
      const issue = await Issue.findById(issueId);
      if (!issue || !issue.reportedBy) {
        return res.json({ sent: false, reason: 'No email to notify' });
      }

      const statusInfo = {
        'open':        { emoji: '📋', label: 'Opened',      color: '#ef4444' },
        'in-progress': { emoji: '⚙️',  label: 'In Progress', color: '#f59e0b' },
        'resolved':    { emoji: '✅',  label: 'Resolved',    color: '#22c55e' }
      };

      const info = statusInfo[status] || statusInfo['open'];

      const html = `
        <!DOCTYPE html>
        <html>
        <body style="font-family:sans-serif; background:#0f172a;
                     color:#f1f5f9; padding:2rem;">
          <div style="max-width:520px; margin:0 auto;
                      background:#1e293b; border-radius:16px;
                      padding:2rem; border:1px solid #334155;">

            <h2 style="color:#38bdf8; margin-bottom:0.3rem;">
              🏙️ Smart Ballari
            </h2>
            <p style="color:#64748b; font-size:0.85rem;">
              Grievance Status Update
            </p>
            <hr style="border-color:#334155; margin:1rem 0;" />

            <div style="background:#0f172a; border-radius:10px;
                        padding:1rem; margin-bottom:1rem;
                        border-left:4px solid ${info.color};">
              <p style="margin:0; font-size:0.8rem; color:#64748b;">
                Grievance ID
              </p>
              <h3 style="margin:0.2rem 0; color:#38bdf8; letter-spacing:2px;">
                ${issue.grievanceId}
              </h3>
            </div>

            <p style="margin-bottom:0.5rem;">
              Your issue <b>"${issue.title}"</b> has been updated:
            </p>

            <div style="background:${info.color}20; border:1px solid ${info.color};
                        border-radius:10px; padding:1rem; text-align:center;
                        margin:1rem 0;">
              <span style="font-size:2rem;">${info.emoji}</span>
              <p style="font-size:1.1rem; font-weight:bold;
                        color:${info.color}; margin:0.3rem 0;">
                ${info.label}
              </p>
            </div>

            <p style="color:#94a3b8; font-size:0.85rem;">
              Track your issue anytime at:
            </p>
            <a href="http://localhost:3000/pages/tracker.html?id=${issue.grievanceId}"
              style="display:inline-block; margin-top:0.5rem;
                     padding:0.7rem 1.4rem; background:#38bdf8;
                     color:#0f172a; border-radius:8px;
                     text-decoration:none; font-weight:bold;">
              🔍 Track Issue
            </a>

            <hr style="border-color:#334155; margin:1.5rem 0;" />
            <p style="color:#475569; font-size:0.75rem;">
              Smart Ballari Civic Platform &bull; Ballari, Karnataka
            </p>
          </div>
        </body>
        </html>
      `;

      await sendMail({
        to:      issue.reportedBy,
        subject: `[Smart Ballari] Your issue is now ${info.label} — ${issue.grievanceId}`,
        html
      });

      res.json({ sent: true });

    } catch (err) {
      console.error('Mail error:', err.message);
      res.status(500).json({ error: err.message });
    }
  }
);

module.exports = router;