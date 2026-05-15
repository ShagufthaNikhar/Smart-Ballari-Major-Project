const express  = require('express');
const router   = express.Router();
const axios    = require('axios');
const Issue    = require('../models/Issue');
const Resource = require('../models/Resource');
const Alert    = require('../models/Alert');
const Event    = require('../models/Event');
const Responder = require('../models/Responder');

const HF_TOKEN = process.env.HF_API_TOKEN;
const HF_BASE  = 'https://api-inference.huggingface.co/models';

// ── CITY KNOWLEDGE BASE ───────────────────────────────
const CITY_KB = {
  emergencyNumbers: {
    police:    '100',
    fire:      '101',
    ambulance: '108',
    disaster:  '1077',
    women:     '1091',
    ballariPolice: '08392-222100',
    vims:      '08392-235555'
  },
  areas: [
    'Gandhi Nagar', 'Nehru Gunj', 'Cantonment',
    'KSRTC Stand',  'Old Town',   'Hospet Road'
  ],
  busRoutes: {
    'BLR-01': 'Gandhi Nagar → Railway Station',
    'BLR-02': 'KSRTC Stand → Hospet Road',
    'BLR-03': 'Medical College → Tekkalakote'
  },
  heritageSites: [
    'Ballari Fort', 'Virupaksha Temple Hampi',
    'Stone Chariot Hampi', 'Daroji Bear Sanctuary'
  ]
};

// ── INTENT DETECTION ──────────────────────────────────
function detectIntent(message) {
  const lower = message.toLowerCase();

  const intents = [
    {
      name:     'nearest_hospital',
      patterns: ['hospital', 'doctor', 'medical', 'emergency', 'injured',
                 'accident', 'ambulance', 'nearest hospital']
    },
    {
      name:     'nearest_police',
      patterns: ['police', 'theft', 'crime', 'stolen', 'robbery',
                 'nearest police', 'police station']
    },
    {
      name:     'report_issue',
      patterns: ['report', 'complaint', 'pothole', 'water leak',
                 'garbage', 'broken', 'issue', 'problem', 'dirty']
    },
    {
      name:     'track_grievance',
      patterns: ['track', 'status', 'grievance', 'complaint id',
                 'sb-', 'my complaint', 'follow up']
    },
    {
      name:     'bus_routes',
      patterns: ['bus', 'route', 'ksrtc', 'transport', 'blr-',
                 'bus stop', 'bus timing', 'next bus']
    },
    {
      name:     'weather',
      patterns: ['weather', 'rain', 'temperature', 'hot', 'cold',
                 'flood', 'storm', 'aqi', 'air quality']
    },
    {
      name:     'heritage',
      patterns: ['fort', 'temple', 'hampi', 'heritage', 'history',
                 'monument', 'tourist', 'visit', 'ar view']
    },
    {
      name:     'emergency_contacts',
      patterns: ['number', 'contact', 'phone', 'call',
                 'helpline', 'toll free', '100', '108']
    },
    {
      name:     'crowd_info',
      patterns: ['crowd', 'traffic', 'congestion', 'busy',
                 'market', 'avoid', 'dense']
    },
    {
      name:     'resource_status',
      patterns: ['garbage truck', 'tanker', 'ambulance available',
                 'resource', 'vehicle', 'truck']
    },
    {
      name:     'active_alerts',
      patterns: ['alert', 'warning', 'danger', 'safe',
                 'current situation', 'what is happening']
    },
    {
      name:     'general',
      patterns: []
    }
  ];

  for (const intent of intents) {
    if (intent.patterns.some(p => lower.includes(p))) {
      return intent.name;
    }
  }
  return 'general';
}

// ── DATA FETCHERS ─────────────────────────────────────
async function fetchContextData(intent, message) {
  const lower = message.toLowerCase();
  const ctx   = {};

  try {
    switch (intent) {
      case 'nearest_hospital': {
        const hospitals = await Responder.find({ type: 'hospital' })
          .limit(3);
        ctx.hospitals = hospitals.map(h => ({
          name:    h.name,
          phone:   h.phone,
          address: h.address,
          lat:     h.location.lat,
          lng:     h.location.lng
        }));
        ctx.emergency = CITY_KB.emergencyNumbers.ambulance;
        break;
      }
      case 'nearest_police': {
        const police = await Responder.find({ type: 'police' })
          .limit(3);
        ctx.police  = police.map(p => ({
          name:    p.name,
          phone:   p.phone,
          address: p.address
        }));
        ctx.emergency = CITY_KB.emergencyNumbers.police;
        break;
      }
      case 'report_issue': {
        ctx.reportUrl = '/pages/report.html';
        ctx.voiceUrl  = '/pages/voice-report.html';
        ctx.categories = ['road','water','electric','sanitation','other'];
        break;
      }
      case 'track_grievance': {
        // Extract grievance ID from message
        const match = message.toUpperCase().match(/SB-\d{4}-\d{5}/);
        if (match) {
          const issue = await Issue.findOne({
            grievanceId: match[0]
          });
          if (issue) {
            ctx.issue = {
              id:      issue.grievanceId,
              title:   issue.title,
              status:  issue.status,
              category: issue.category
            };
          }
        }
        ctx.trackerUrl = '/pages/tracker.html';
        break;
      }
      case 'bus_routes': {
        ctx.routes    = CITY_KB.busRoutes;
        ctx.liveUrl   = '/pages/transport.html';
        break;
      }
      case 'weather': {
        ctx.weatherUrl = '/pages/satellite.html';
        ctx.alertsUrl  = '/pages/alerts.html';
        break;
      }
      case 'heritage': {
        ctx.sites    = CITY_KB.heritageSites;
        ctx.arUrl    = '/pages/heritage.html';
        break;
      }
      case 'emergency_contacts': {
        ctx.contacts = CITY_KB.emergencyNumbers;
        break;
      }
      case 'crowd_info': {
        ctx.crowdUrl = '/pages/crowd.html';
        ctx.areas    = CITY_KB.areas;
        break;
      }
      case 'resource_status': {
        const resources = await Resource.find({ status: 'available' })
          .limit(5);
        ctx.available = resources.map(r => ({
          name: r.name,
          type: r.type,
          area: r.location?.area
        }));
        break;
      }
      case 'active_alerts': {
        const alerts = await Alert.find({ isActive: true })
          .sort({ createdAt: -1 })
          .limit(3);
        ctx.alerts = alerts.map(a => ({
          title:    a.title,
          severity: a.severity,
          area:     a.area
        }));
        ctx.alertsUrl = '/pages/alerts.html';
        break;
      }
    }
  } catch (err) {
    console.warn('Context fetch error:', err.message);
  }

  return ctx;
}

// ── BUILD SYSTEM PROMPT ───────────────────────────────
function buildSystemPrompt(intent, ctx) {
  let prompt = `You are Smart Ballari City Assistant — a helpful
civic AI for Ballari, Karnataka, India. You help citizens with:
civic issues, emergency services, transport, weather alerts,
heritage sites, and city information.

Always be concise, helpful, and friendly. Reply in 2-4 sentences.
When giving contacts or links, be specific.
Current city context:\n`;

  // Inject relevant context
  if (ctx.hospitals) {
    prompt += `\nNearest hospitals:\n`;
    ctx.hospitals.forEach(h => {
      prompt += `- ${h.name}: ${h.phone} (${h.address})\n`;
    });
    prompt += `Emergency ambulance: ${ctx.emergency}\n`;
  }

  if (ctx.police) {
    prompt += `\nNearest police stations:\n`;
    ctx.police.forEach(p => {
      prompt += `- ${p.name}: ${p.phone}\n`;
    });
    prompt += `Emergency police: ${ctx.emergency}\n`;
  }

  if (ctx.issue) {
    prompt += `\nGrievance found: ${ctx.issue.id}
Status: ${ctx.issue.status}
Title: ${ctx.issue.title}
Category: ${ctx.issue.category}\n`;
  }

  if (ctx.alerts?.length) {
    prompt += `\nActive city alerts:\n`;
    ctx.alerts.forEach(a => {
      prompt += `- [${a.severity.toUpperCase()}] ${a.title}`;
      if (a.area) prompt += ` in ${a.area}`;
      prompt += '\n';
    });
  }

  if (ctx.contacts) {
    prompt += `\nEmergency contacts:
Police: ${ctx.contacts.police}
Ambulance: ${ctx.contacts.ambulance}
Fire: ${ctx.contacts.fire}
VIMS Hospital: ${ctx.contacts.vims}
Ballari Police: ${ctx.contacts.ballariPolice}\n`;
  }

  if (ctx.routes) {
    prompt += `\nBus routes: BLR-01 (Gandhi Nagar→Railway),
BLR-02 (KSRTC→Hospet), BLR-03 (Medical→Tekkalakote)\n`;
  }

  if (ctx.available) {
    prompt += `\nAvailable resources:\n`;
    ctx.available.forEach(r => {
      prompt += `- ${r.name} (${r.type}) at ${r.area}\n`;
    });
  }

  return prompt;
}

// ── CALL HUGGING FACE ─────────────────────────────────
async function callHuggingFace(systemPrompt, userMessage) {
  const MODEL = 'mistralai/Mistral-7B-Instruct-v0.1';

  const prompt = `<s>[INST] ${systemPrompt}

User question: ${userMessage} [/INST]`;

  try {
    const res = await axios.post(
      `${HF_BASE}/${MODEL}`,
      {
        inputs: prompt,
        parameters: {
          max_new_tokens: 200,
          temperature:    0.7,
          top_p:          0.9,
          do_sample:      true,
          return_full_text: false
        }
      },
      {
        headers: {
          Authorization:  `Bearer ${HF_TOKEN}`,
          'Content-Type': 'application/json'
        },
        timeout: 20000
      }
    );

    const generated = res.data[0]?.generated_text || '';
    return generated.trim();

  } catch (err) {
    // Fallback to rule-based response
    return null;
  }
}

// ── RULE-BASED FALLBACK ───────────────────────────────
function ruleFallback(intent, ctx, message) {
  const lower = message.toLowerCase();

  switch (intent) {
    case 'nearest_hospital':
      if (ctx.hospitals?.length) {
        const h = ctx.hospitals[0];
        return `The nearest hospital is **${h.name}** at ${h.address}.
Call them on 📞 ${h.phone}. For emergencies, dial 🚑 ${ctx.emergency}.`;
      }
      return `For medical emergencies, call 🚑 108 (ambulance) or visit
VIMS Hospital at 08392-235555.`;

    case 'nearest_police':
      if (ctx.police?.length) {
        const p = ctx.police[0];
        return `Nearest police: **${p.name}** — 📞 ${p.phone}.
For emergencies, dial 🚨 100.`;
      }
      return `For police emergencies, dial 🚨 100.
Ballari City Police: 08392-222100.`;

    case 'report_issue':
      return `You can report a civic issue using our **Report Form** at
/pages/report.html or use **Voice Reporting** at /pages/voice-report.html
to speak your complaint in Kannada or English.`;

    case 'track_grievance':
      if (ctx.issue) {
        return `Found your grievance **${ctx.issue.id}**!
Title: "${ctx.issue.title}"
Status: **${ctx.issue.status.toUpperCase()}**
Track full details at /pages/tracker.html?id=${ctx.issue.id}`;
      }
      return `Enter your Grievance ID (format: SB-2024-00042) at
/pages/tracker.html to track your complaint status in real-time.`;

    case 'bus_routes':
      return `Ballari has 3 bus routes:
🚍 **BLR-01**: Gandhi Nagar → Railway Station (every 15 mins)
🚍 **BLR-02**: KSRTC Stand → Hospet Road (every 20 mins)
🚍 **BLR-03**: Medical College → Tekkalakote (every 30 mins)
View live GPS tracking at /pages/transport.html`;

    case 'weather':
      return `Check real-time weather, rain alerts, heat zones, and
flood risk maps at /pages/satellite.html.
Current alerts are available at /pages/alerts.html.`;

    case 'heritage':
      return `Ballari region has amazing heritage! Key sites:
🏰 Ballari Fort (17th Century Vijayanagara)
🛕 Virupaksha Temple, Hampi (UNESCO World Heritage)
🗿 Stone Chariot, Vittala Temple Hampi
🌿 Daroji Bear Sanctuary
View AR experiences at /pages/heritage.html!`;

    case 'emergency_contacts':
      return `Emergency Numbers for Ballari:
🚨 Police: 100
🚒 Fire: 101
🚑 Ambulance: 108
📞 VIMS Hospital: 08392-235555
📞 Ballari Police: 08392-222100
👩 Women's Helpline: 1091`;

    case 'crowd_info':
      return `View live crowd density across Ballari areas at
/pages/crowd.html. Gandhi Nagar and KSRTC Stand tend to be
busiest during market days (Sunday & Wednesday).`;

    case 'active_alerts':
      if (ctx.alerts?.length) {
        const alertList = ctx.alerts.map(a =>
          `⚠️ [${a.severity}] ${a.title}${a.area ? ' in '+a.area : ''}`
        ).join('\n');
        return `Current active alerts:\n${alertList}\n
View all alerts at /pages/alerts.html`;
      }
      return `No critical alerts at this time. ✅
Check /pages/alerts.html for the latest city-wide alerts.`;

    default:
      return `I can help you with:
📌 Reporting civic issues
🔍 Tracking grievances (share your SB-XXXX ID)
🚑 Finding nearest hospitals and police
🚍 Bus routes and live tracking
🌤️ Weather and flood alerts
🏰 Heritage sites and AR experiences
🚨 Emergency contacts
What would you like to know?`;
  }
}

// ── BUILD QUICK ACTIONS ───────────────────────────────
function buildQuickActions(intent, ctx) {
  const actions = {
    nearest_hospital: [
      { label: '🗺️ Show on Map',
        action: 'map', data: {
          lat: ctx.hospitals?.[0]?.lat,
          lng: ctx.hospitals?.[0]?.lng,
          name: ctx.hospitals?.[0]?.name
        }},
      { label: '📞 Call Ambulance',  action: 'call', data: '108' },
      { label: '🚨 Report Incident', action: 'link',
        data: '/pages/emergency.html' }
    ],
    nearest_police: [
      { label: '📞 Call Police',     action: 'call', data: '100' },
      { label: '🚨 Emergency Board', action: 'link',
        data: '/pages/emergency.html' }
    ],
    report_issue: [
      { label: '📌 Report Form',  action: 'link',
        data: '/pages/report.html' },
      { label: '🎙️ Voice Report', action: 'link',
        data: '/pages/voice-report.html' },
      { label: '🗺️ Pin on Map',   action: 'link',
        data: '/pages/map.html' }
    ],
    track_grievance: [
      { label: '🔍 Open Tracker', action: 'link',
        data: ctx.issue
          ? `/pages/tracker.html?id=${ctx.issue.id}`
          : '/pages/tracker.html' }
    ],
    bus_routes: [
      { label: '🚍 Live Tracking', action: 'link',
        data: '/pages/transport.html' }
    ],
    weather: [
      { label: '🛰️ Satellite Map', action: 'link',
        data: '/pages/satellite.html' },
      { label: '🔮 View Alerts',   action: 'link',
        data: '/pages/alerts.html' }
    ],
    heritage: [
      { label: '🏰 Heritage Map', action: 'link',
        data: '/pages/heritage.html' },
      { label: '📷 Launch AR',    action: 'link',
        data: '/pages/heritage.html' }
    ],
    crowd_info: [
      { label: '👥 Crowd Map', action: 'link',
        data: '/pages/crowd.html' }
    ],
    active_alerts: [
      { label: '🔮 All Alerts', action: 'link',
        data: '/pages/alerts.html' },
      { label: '🏙️ City Dashboard', action: 'link',
        data: '/pages/city-dashboard.html' }
    ]
  };

  return actions[intent] || [
    { label: '📌 Report Issue',  action: 'link',
      data: '/pages/report.html'    },
    { label: '🔍 Track Issue',   action: 'link',
      data: '/pages/tracker.html'   },
    { label: '🚨 Emergency',     action: 'link',
      data: '/pages/emergency.html' }
  ];
}

// ── MAIN CHAT ENDPOINT ────────────────────────────────
router.post('/chat', async (req, res) => {
  try {
    const { message, history = [] } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'message required' });
    }

    // 1. Detect intent
    const intent = detectIntent(message);

    // 2. Fetch relevant city data
    const ctx = await fetchContextData(intent, message);

    // 3. Build system prompt with context
    const systemPrompt = buildSystemPrompt(intent, ctx);

    // 4. Try Hugging Face first
    let reply = await callHuggingFace(systemPrompt, message);

    // 5. Fallback if HF fails or returns empty
    if (!reply || reply.length < 10) {
      reply = ruleFallback(intent, ctx, message);
    }

    // 6. Build quick action buttons
    const actions = buildQuickActions(intent, ctx);

    // 7. Map data if location available
    const mapData = ctx.hospitals?.[0] || ctx.police?.[0] || null;

    res.json({
      reply,
      intent,
      actions,
      mapData,
      context: {
        hasLiveData: Object.keys(ctx).length > 0
      }
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET suggested questions
router.get('/suggestions', (req, res) => {
  res.json([
    'Nearest hospital to me?',
    'Track grievance SB-2024-00001',
    'Report a pothole',
    'Current weather in Ballari',
    'Bus route from Gandhi Nagar',
    'Emergency contacts',
    'What alerts are active?',
    'Hampi heritage sites',
    'Crowd density near KSRTC',
    'Available ambulances?'
  ]);
});

module.exports = router;