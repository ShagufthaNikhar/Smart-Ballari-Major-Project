const Event        = require('../models/Event');
const CrowdReading = require('../models/CrowdReading');
const Alert        = require('../models/Alert');

// ── DENSITY THRESHOLDS ────────────────────────────────
const DENSITY = {
  low:      { max: 1000,  label: 'Low',      color: '#22c55e', action: null },
  moderate: { max: 2500,  label: 'Moderate', color: '#f59e0b', action: 'monitor' },
  high:     { max: 5000,  label: 'High',     color: '#ef4444',
              action: 'alert-transport' },
  critical: { max: Infinity, label: 'Critical', color: '#7c3aed',
              action: 'alert-all' }
};

function getDensityLevel(count) {
  if (count > 5000) return 'critical';
  if (count > 2500) return 'high';
  if (count > 1000) return 'moderate';
  return 'low';
}

// ── PREDICT CROWD FOR NEXT 24H ────────────────────────
async function predictCrowd(area = null) {
  const now       = new Date();
  const in24h     = new Date(now.getTime() + 24 * 3600 * 1000);

  // Get upcoming events
  const eventFilter = {
    startTime: { $lte: in24h },
    endTime:   { $gte: now },
    status:    { $in: ['upcoming', 'active'] }
  };
  if (area) eventFilter.area = area;

  const events = await Event.find(eventFilter);

  // Get historical baseline from same day of week
  const dow     = now.getDay();
  const hour    = now.getHours();

  const historical = await CrowdReading.find({
    ...(area && { area }),
    timestamp: {
      $gte: new Date(now.getTime() - 28 * 86400000)  // last 4 weeks
    }
  });

  // Group by area
  const byArea = {};
  historical.forEach(r => {
    if (!byArea[r.area]) byArea[r.area] = [];
    byArea[r.area].push(r.count);
  });

  // Baseline average per area
  const baselines = {};
  for (const [a, counts] of Object.entries(byArea)) {
    baselines[a] = Math.round(
      counts.reduce((s, c) => s + c, 0) / counts.length
    );
  }

  // Build predictions
  const predictions = [];

  for (const event of events) {
    const baseline = baselines[event.area] || 500;
    const predicted = Math.round(
      baseline * 0.4 + event.expectedCrowd * 0.6
    );

    const density = getDensityLevel(predicted);
    const cfg     = DENSITY[density];

    predictions.push({
      area:          event.area,
      eventName:     event.name,
      eventType:     event.type,
      eventId:       event._id,
      startTime:     event.startTime,
      endTime:       event.endTime,
      baseline,
      expectedCrowd: event.expectedCrowd,
      predicted,
      density,
      densityLabel:  cfg.label,
      color:         cfg.color,
      action:        cfg.action,
      location:      event.location
    });
  }

  // Add baseline predictions for areas with no events
  const areas = ['Gandhi Nagar','KSRTC Stand','Nehru Gunj',
                 'Cantonment','Old Town','Hospet Road'];

  for (const a of areas) {
    const hasEvent = predictions.some(p => p.area === a);
    if (!hasEvent) {
      const baseline = baselines[a] || 500;

      // Weekend boost
      const isWeekend = dow === 0 || dow === 6;
      const predicted = Math.round(
        baseline * (isWeekend ? 1.4 : 1.0)
      );

      const density = getDensityLevel(predicted);
      predictions.push({
        area:         a,
        eventName:    null,
        predicted,
        baseline,
        density,
        densityLabel: DENSITY[density].label,
        color:        DENSITY[density].color,
        action:       DENSITY[density].action,
        location:     null
      });
    }
  }

  return predictions;
}

// ── DETECT SURGE ──────────────────────────────────────
async function detectSurge() {
  const now     = new Date();
  const in2h    = new Date(now.getTime() + 2 * 3600 * 1000);
  const alerts  = [];

  // Check active + upcoming events starting within 2h
  const events = await Event.find({
    startTime:       { $lte: in2h },
    endTime:         { $gte: now },
    status:          { $in: ['upcoming', 'active'] },
    surgeTriggered:  false
  });

  for (const event of events) {
    const density = getDensityLevel(event.expectedCrowd);
    if (density === 'low') continue;

    const cfg = DENSITY[density];

    // Fire surge alert
    const alertData = {
      type:        'crowd',
      severity:    density === 'critical' ? 'critical' : 'warning',
      title:       `👥 Crowd Surge — ${event.area}`,
      message:     buildSurgeMessage(event, density),
      area:        event.area,
      triggeredBy: 'crowd-surge-detector',
      value:       event.expectedCrowd,
      threshold:   1000
    };

    // Dedup check
    const existing = await Alert.findOne({
      triggeredBy: 'crowd-surge-detector',
      area:        event.area,
      isActive:    true,
      createdAt:   { $gte: new Date(now - 60 * 60000) }
    });

    if (!existing) {
      await Alert.create(alertData);
      alerts.push(alertData);

      // Mark event as triggered
      await Event.findByIdAndUpdate(event._id, {
        surgeTriggered: true,
        status: event.startTime <= now ? 'active' : 'upcoming'
      });

      console.log(`🚨 Surge alert: ${event.name} — ${density}`);
    }
  }

  return alerts;
}

// ── SURGE MESSAGE ─────────────────────────────────────
function buildSurgeMessage(event, density) {
  const actions = {
    moderate: 'Monitor situation. Standard operations.',
    high: [
      `Alert KSRTC for extra buses on ${event.area} route.`,
      `Notify traffic police for crowd management.`
    ].join(' '),
    critical: [
      `CRITICAL: ${event.area} expecting ${event.expectedCrowd}+ people.`,
      `Deploy emergency transport + police immediately.`,
      `Pre-position ambulance at nearest hospital.`
    ].join(' ')
  };

  return [
    `Event: "${event.name}" starts at`,
    `${new Date(event.startTime).toLocaleTimeString('en-IN')}.`,
    `Expected crowd: ${event.expectedCrowd.toLocaleString()} people.`,
    actions[density] || 'Monitor situation.'
  ].join(' ');
}

// ── LIVE CROWD SNAPSHOT ───────────────────────────────
async function getLiveCrowd() {
  const areas = [
    { name: 'Gandhi Nagar',  lat: 15.1394, lng: 76.9214 },
    { name: 'KSRTC Stand',   lat: 15.1350, lng: 76.9250 },
    { name: 'Nehru Gunj',    lat: 15.1420, lng: 76.9180 },
    { name: 'Cantonment',    lat: 15.1480, lng: 76.9120 },
    { name: 'Old Town',      lat: 15.1450, lng: 76.9150 },
    { name: 'Hospet Road',   lat: 15.1300, lng: 76.9370 }
  ];

  const now    = new Date();
  const result = [];

  for (const area of areas) {
    // Latest reading
    const latest = await CrowdReading.findOne({ area: area.name })
      .sort({ timestamp: -1 });

    // Check for active event
    const activeEvent = await Event.findOne({
      area:      area.name,
      status:    'active',
      startTime: { $lte: now },
      endTime:   { $gte: now }
    });

    let count   = latest?.count || 500;
    let source  = 'historical';

    if (activeEvent) {
      // Boost by event crowd
      count  = Math.round(count * 0.3 + activeEvent.expectedCrowd * 0.7);
      source = 'event';
    }

    // Add time-of-day factor
    const hour   = now.getHours();
    const factor = hour >= 8 && hour <= 20 ? 1.2 : 0.6;
    count = Math.round(count * factor);

    const density = getDensityLevel(count);

    result.push({
      ...area,
      count,
      density,
      densityLabel: DENSITY[density].label,
      color:        DENSITY[density].color,
      activeEvent:  activeEvent?.name || null,
      source,
      timestamp:    now
    });
  }

  return result;
}

module.exports = {
  predictCrowd, detectSurge,
  getLiveCrowd, getDensityLevel, DENSITY
};