const HistoricalData = require('../models/HistoricalData');
const Alert          = require('../models/Alert');
const Issue          = require('../models/Issue');

// ── RULE DEFINITIONS ──────────────────────────────────
const RULES = [

  // ── WATER RULES ──────────────────────────────────────
  {
    id:        'water-low-pressure',
    type:      'water',
    name:      'Low Water Pressure',
    check:     async () => {
      const recent = await HistoricalData.find({
        type:      'water',
        timestamp: { $gte: daysAgo(1) }
      });

      const alerts = [];
      const byArea = groupBy(recent, 'area');

      for (const [area, readings] of Object.entries(byArea)) {
        const avg = average(readings.map(r => r.value));
        if (avg < 2.5) {
          alerts.push({
            type:        'water',
            severity:    avg < 1.5 ? 'critical' : 'warning',
            title:       `⚠️ Low Water Pressure — ${area}`,
            message:     `Average pressure in ${area} is ${avg.toFixed(1)} bar
                         (normal: 3–5 bar). Possible pipe leak or supply issue.`,
            area,
            triggeredBy: 'water-low-pressure',
            value:       avg,
            threshold:   2.5
          });
        }
      }
      return alerts;
    }
  },

  {
    id:   'water-complaint-spike',
    type: 'water',
    name: 'Water Complaint Spike',
    check: async () => {
      const count = await Issue.countDocuments({
        category:  'water',
        createdAt: { $gte: daysAgo(1) }
      });

      if (count >= 5) {
        return [{
          type:        'water',
          severity:    count >= 10 ? 'critical' : 'warning',
          title:       `💧 Water Complaints Surging`,
          message:     `${count} water-related complaints filed in last 24 hrs.
                       Possible area-wide supply disruption.`,
          area:        'Multiple Areas',
          triggeredBy: 'water-complaint-spike',
          value:       count,
          threshold:   5
        }];
      }
      return [];
    }
  },

  // ── TRAFFIC RULES ─────────────────────────────────────
  {
    id:   'traffic-peak-surge',
    type: 'traffic',
    name: 'Traffic Peak Surge',
    check: async () => {
      const hour    = new Date().getHours();
      const isPeak  = (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 20);
      if (!isPeak) return [];

      const recent = await HistoricalData.find({
        type:      'traffic',
        timestamp: { $gte: hoursAgo(2) }
      });

      const alerts = [];
      const byArea = groupBy(recent, 'area');

      for (const [area, readings] of Object.entries(byArea)) {
        const avg = average(readings.map(r => r.value));
        if (avg > 1000) {
          alerts.push({
            type:        'traffic',
            severity:    avg > 1300 ? 'critical' : 'warning',
            title:       `🚦 Heavy Traffic — ${area}`,
            message:     `Traffic density at ${Math.round(avg)} vehicles/hr
                         in ${area}. Advising alternate routes.`,
            area,
            triggeredBy: 'traffic-peak-surge',
            value:       avg,
            threshold:   1000
          });
        }
      }
      return alerts;
    }
  },

  // ── POWER RULES ───────────────────────────────────────
  {
    id:   'power-frequent-outages',
    type: 'power',
    name: 'Frequent Power Outages',
    check: async () => {
      const recent = await HistoricalData.find({
        type:      'power',
        timestamp: { $gte: daysAgo(3) }
      });

      const byArea  = groupBy(recent, 'area');
      const alerts  = [];

      for (const [area, readings] of Object.entries(byArea)) {
        const total = readings.reduce((s, r) => s + r.value, 0);
        if (total >= 5) {
          alerts.push({
            type:        'power',
            severity:    total >= 10 ? 'critical' : 'warning',
            title:       `⚡ Power Instability — ${area}`,
            message:     `${total} outages recorded in ${area} over last 3 days.
                         Infrastructure inspection recommended.`,
            area,
            triggeredBy: 'power-frequent-outages',
            value:       total,
            threshold:   5
          });
        }
      }
      return alerts;
    }
  },

  {
    id:   'power-complaint-spike',
    type: 'power',
    name: 'Power Complaint Spike',
    check: async () => {
      const count = await Issue.countDocuments({
        category:  'electric',
        createdAt: { $gte: hoursAgo(6) }
      });

      if (count >= 3) {
        return [{
          type:        'power',
          severity:    'warning',
          title:       `⚡ Electricity Complaints Rising`,
          message:     `${count} electricity complaints in last 6 hours.
                       Possible grid fault or transformer issue.`,
          area:        'Multiple Areas',
          triggeredBy: 'power-complaint-spike',
          value:       count,
          threshold:   3
        }];
      }
      return [];
    }
  },

  // ── SANITATION RULES ──────────────────────────────────
  {
    id:   'sanitation-complaint-spike',
    type: 'sanitation',
    name: 'Sanitation Complaint Spike',
    check: async () => {
      const count = await Issue.countDocuments({
        category:  'sanitation',
        createdAt: { $gte: daysAgo(2) }
      });

      if (count >= 8) {
        return [{
          type:        'sanitation',
          severity:    count >= 15 ? 'critical' : 'warning',
          title:       `🗑️ Garbage Collection Alert`,
          message:     `${count} sanitation complaints in 48 hours.
                       Missed collection likely in affected areas.`,
          area:        'Multiple Areas',
          triggeredBy: 'sanitation-complaint-spike',
          value:       count,
          threshold:   8
        }];
      }
      return [];
    }
  },

  // ── CROWD RULES ───────────────────────────────────────
  {
    id:   'crowd-market-day',
    type: 'crowd',
    name: 'Market Day Crowd Surge',
    check: async () => {
      const dow = new Date().getDay();
      const isMarketDay = dow === 0 || dow === 3;
      if (!isMarketDay) return [];

      return [{
        type:        'crowd',
        severity:    'info',
        title:       `👥 Market Day — High Crowd Expected`,
        message:     `Today is a market day. KSRTC Stand and surrounding
                     areas expected to have 2000–4000 people. Extra
                     transport and policing recommended.`,
        area:        'KSRTC Stand',
        triggeredBy: 'crowd-market-day',
        value:       3000,
        threshold:   2000
      }];
    }
  },

  // ── GENERAL ISSUE SPIKE ───────────────────────────────
  {
    id:   'general-issue-spike',
    type: 'surge',
    name: 'General Issue Spike',
    check: async () => {
      const count = await Issue.countDocuments({
        createdAt: { $gte: hoursAgo(3) }
      });

      if (count >= 10) {
        return [{
          type:        'surge',
          severity:    'critical',
          title:       `🚨 Issue Surge Detected`,
          message:     `${count} civic issues reported in last 3 hours.
                       Possible major incident or infrastructure failure.
                       All departments on alert.`,
          area:        'City-wide',
          triggeredBy: 'general-issue-spike',
          value:       count,
          threshold:   10
        }];
      }
      return [];
    }
  }
];

// ── RUN ALL RULES ─────────────────────────────────────
async function runRules() {
  const newAlerts = [];

  for (const rule of RULES) {
    try {
      const triggered = await rule.check();

      for (const alertData of triggered) {
        // Dedup — don't re-create if same rule fired in last 30 mins
        const existing = await Alert.findOne({
          triggeredBy: alertData.triggeredBy,
          isActive:    true,
          createdAt:   { $gte: minutesAgo(30) }
        });

        if (!existing) {
          const alert = await Alert.create(alertData);
          newAlerts.push(alert);
          console.log(`🚨 Alert: ${alert.title}`);
        }
      }
    } catch (err) {
      console.error(`Rule ${rule.id} failed:`, err.message);
    }
  }

  return newAlerts;
}

// ── AUTO-RESOLVE ──────────────────────────────────────
async function autoResolve() {
  // Mark alerts older than 6 hours as resolved
  const result = await Alert.updateMany(
    {
      isActive:  true,
      createdAt: { $lt: hoursAgo(6) }
    },
    {
      isActive:   false,
      resolvedAt: new Date()
    }
  );

  if (result.modifiedCount > 0) {
    console.log(`✅ Auto-resolved ${result.modifiedCount} old alerts`);
  }
}

// ── TREND ANALYSIS ────────────────────────────────────
async function getTrends(type, area, days = 7) {
  const data = await HistoricalData.find({
    type,
    ...(area && { area }),
    timestamp: { $gte: daysAgo(days) }
  }).sort({ timestamp: 1 });

  if (!data.length) return null;

  const values    = data.map(d => d.value);
  const avg       = average(values);
  const max       = Math.max(...values);
  const min       = Math.min(...values);

  // Simple linear trend
  const firstHalf  = average(values.slice(0, Math.floor(values.length / 2)));
  const secondHalf = average(values.slice(Math.floor(values.length / 2)));
  const trend      = secondHalf > firstHalf
    ? 'increasing'
    : secondHalf < firstHalf
    ? 'decreasing'
    : 'stable';

  return { avg, max, min, trend, count: values.length };
}

// ── PREDICTION (rule-based → ML-ready) ───────────────
async function predict(type, area) {
  const trend  = await getTrends(type, area, 7);
  if (!trend) return null;

  const predictions = {
    water: () => ({
      prediction: trend.avg < 3
        ? 'Water pressure likely to remain low tomorrow'
        : 'Water supply expected to be normal',
      confidence: trend.trend === 'increasing' ? 65 : 75,
      action:     trend.avg < 3
        ? 'Pre-position tanker trucks'
        : 'No action needed'
    }),
    traffic: () => ({
      prediction: trend.trend === 'increasing'
        ? 'Traffic congestion expected to worsen this week'
        : 'Traffic levels should remain manageable',
      confidence: 70,
      action: trend.trend === 'increasing'
        ? 'Deploy traffic police at peak hours'
        : 'Standard operations'
    }),
    power: () => ({
      prediction: trend.avg > 2
        ? 'Power instability likely to continue'
        : 'Power supply expected to stabilize',
      confidence: 68,
      action: trend.avg > 2
        ? 'Alert BESCOM for grid inspection'
        : 'Monitor normally'
    }),
    crowd: () => ({
      prediction: 'Crowd surge expected on next market day (Sun/Wed)',
      confidence: 85,
      action:     'Pre-deploy KSRTC extra buses and traffic police'
    })
  };

  const fn = predictions[type];
  if (!fn) return null;

  return {
    type, area,
    trend: trend.trend,
    avg:   parseFloat(trend.avg.toFixed(2)),
    ...fn()
  };
}

// ── HELPERS ───────────────────────────────────────────
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function hoursAgo(n) {
  return new Date(Date.now() - n * 3600 * 1000);
}

function minutesAgo(n) {
  return new Date(Date.now() - n * 60 * 1000);
}

function average(arr) {
  return arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
}

function groupBy(arr, key) {
  return arr.reduce((groups, item) => {
    const g = item[key];
    if (!groups[g]) groups[g] = [];
    groups[g].push(item);
    return groups;
  }, {});
}

module.exports = { runRules, autoResolve, getTrends, predict };