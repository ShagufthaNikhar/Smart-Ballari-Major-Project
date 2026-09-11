const express    = require('express');
const router     = express.Router();
const verifyToken = require('../middleware/verifyToken');
const requireRole = require('../middleware/requireRole');
const Issue      = require('../models/Issue');
const Alert      = require('../models/Alert');
const Resource   = require('../models/Resource');
const Incident   = require('../models/Incident');
const CitizenTrust = require('../models/CitizenTrust');
const Event      = require('../models/Event');
const Deployment = require('../models/Deployment');
const { getBusPositions } = require('../config/busSimulator');
const { runRules }       = require('../config/ruleEngine');


// ── FULL CITY PULSE ───────────────────────────────────
// Single endpoint — powers central dashboard
router.get('/city-pulse', async (req, res) => {
  try {
    const now    = new Date();
    const since1h = new Date(now - 3600000);
    const since24h = new Date(now - 86400000);
    const since7d  = new Date(now - 7 * 86400000);

    const [
      // Issues
      totalIssues, openIssues, resolvedToday,
      criticalIssues, recentIssues,
      // Alerts
      activeAlerts, criticalAlerts,
      // Resources
      availableResources, deployedResources,
      // Emergency
      activeIncidents,
      // Community
      totalCitizens, topCitizen,
      // Events
      activeEvents,
      // Deployments
      recentDeployments,
      // Live data
      busPositions
    ] = await Promise.all([
      Issue.countDocuments(),
      Issue.countDocuments({ status: 'open' }),
      Issue.countDocuments({
        status: 'resolved',
        updatedAt: { $gte: since24h }
      }),
      Issue.countDocuments({ priority: 'critical' }),
      Issue.find({ status: 'open' })
        .sort({ createdAt: -1 }).limit(5)
        .select('title category status priority voteScore createdAt'),

      Alert.countDocuments({ isActive: true }),
      Alert.countDocuments({ isActive: true, severity: 'critical' }),

      Resource.countDocuments({ status: 'available' }),
      Resource.countDocuments({ status: 'deployed' }),

      Incident.countDocuments({ status: 'active' }),

      CitizenTrust.countDocuments(),
      CitizenTrust.findOne().sort({ score: -1 })
        .select('email score level'),

      Event.countDocuments({ status: 'active' }),

      Deployment.find({ status: 'active' })
        .sort({ dispatchedAt: -1 }).limit(5)
        .select('resourceName resourceType area priority dispatchedAt'),

      // Live data (may fail gracefully)
      Promise.resolve(getBusPositions()).catch(() => [])
    ]);

    // Issue trend (last 7 days)
    const issueTrend = await buildIssueTrend(since7d);

    // Category breakdown
    const categoryBreakdown = await Issue.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Resolution rate
    const resolutionRate = totalIssues > 0
      ? Math.round((resolvedToday / Math.max(openIssues, 1)) * 100)
      : 0;

    // System health score (0-100)
    const healthScore = calculateHealthScore({
      openIssues, criticalAlerts, activeIncidents,
      availableResources
    });

    res.json({
      timestamp: now,
      health:    { score: healthScore, ...healthLabel(healthScore) },
      issues: {
        total:      totalIssues,
        open:       openIssues,
        resolvedToday,
        critical:   criticalIssues,
        recent:     recentIssues,
        trend:      issueTrend,
        categories: categoryBreakdown
      },
      alerts: {
        active:   activeAlerts,
        critical: criticalAlerts
      },
      resources: {
        available: availableResources,
        deployed:  deployedResources,
        deployments: recentDeployments
      },
      emergency: {
        activeIncidents
      },
      community: {
        totalCitizens,
        topCitizen
      },
      transport: {
        activeBuses: busPositions.length,
        buses:       busPositions.slice(0, 3)
      },
      events: {
        active: activeEvents
      },
      resolutionRate
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── CITIZEN PULSE (lighter version) ───────────────────
router.get('/citizen-pulse', async (req, res) => {
  try {
    const email = req.query.email;
    const now   = new Date();
    const since24h = new Date(now - 86400000);

    const [
      myIssues, activeAlerts, busPositions
    ] = await Promise.all([
      email
        ? Issue.find({ reportedBy: email })
            .sort({ createdAt: -1 }).limit(5)
        : Promise.resolve([]),
      Alert.find({ isActive: true, severity: { $in: ['critical','warning'] } })
        .sort({ createdAt: -1 }).limit(3)
        .select('title severity area message'),
      Promise.resolve(getBusPositions()).catch(() => [])
    ]);

    const myTrust = email
      ? await CitizenTrust.findOne({ email })
      : null;

    res.json({
      timestamp:  now,
      myIssues,
      alerts:     activeAlerts,
      buses:      busPositions.slice(0, 3),
      myTrust:    myTrust
        ? { score: myTrust.score, level: myTrust.level,
            badges: myTrust.badges?.length || 0 }
        : null
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── RUN ALL SYSTEMS ───────────────────────────────────
// Admin only. This fires the rule engine on demand, which is a nontrivial
// aggregation — trivial to abuse as a DoS while open.
router.post('/run-all', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const results = {};

    const newAlerts = await runRules();
    results.newAlerts = newAlerts.length;

    res.json({
      success: true,
      ...results,
      timestamp: new Date()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── HELPERS ───────────────────────────────────────────
async function buildIssueTrend(since) {
  const issues = await Issue.find({ createdAt: { $gte: since } })
    .select('createdAt status');

  const days = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short'
    });
    days[key] = { reported: 0, resolved: 0 };
  }

  issues.forEach(issue => {
    const key = new Date(issue.createdAt).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short'
    });
    if (days[key]) {
      days[key].reported++;
      if (issue.status === 'resolved') days[key].resolved++;
    }
  });

  return Object.entries(days).map(([date, val]) => ({
    date, ...val
  }));
}

function calculateHealthScore({
  openIssues, criticalAlerts, activeIncidents,
  availableResources
}) {
  let score = 100;
  score -= Math.min(openIssues * 0.5, 20);
  score -= criticalAlerts * 5;
  score -= activeIncidents * 8;
  if (availableResources === 0) score -= 10;
  return Math.max(0, Math.round(score));
}

function healthLabel(score) {
  if (score >= 85) return { label: 'Excellent', color: '#22c55e' };
  if (score >= 70) return { label: 'Good',      color: '#38bdf8' };
  if (score >= 55) return { label: 'Fair',      color: '#f59e0b' };
  if (score >= 40) return { label: 'Poor',      color: '#ef4444' };
  return                  { label: 'Critical',  color: '#7c3aed' };
}

module.exports = router;