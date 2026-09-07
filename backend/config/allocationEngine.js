const Issue      = require('../models/Issue');
const Resource   = require('../models/Resource');
const Deployment = require('../models/Deployment');
const Alert      = require('../models/Alert');
const WARD_COORDS = require('./wardCoords');

// ── ISSUE TYPE → RESOURCE TYPE ────────────────────────
const ISSUE_RESOURCE_MAP = {
  sanitation: 'garbage-truck',
  road:       'police-van',
  water:      'water-tanker',
  electric:   'police-van',
  other:      'police-van'
};

// ── AREAS ─────────────────────────────────────────────
// Real Ballari City Corporation D2D wards (from the division-wise vehicle
// list), replacing the six placeholder neighborhood names. Every area the
// allocation engine reasons about is now a ward that an actual vehicle is
// assigned to. Labelled "Ward N" because for issue-matching to work,
// Issue.location.address needs to contain the same "Ward N" string -
// see the integration note below computeDemandScore.
const AREAS = Object.keys(WARD_COORDS)
  .map(n => `Ward ${n}`)
  .sort((a, b) => parseInt(a.split(' ')[1]) - parseInt(b.split(' ')[1]));

// ── HAVERSINE ─────────────────────────────────────────
function haversine(lat1, lon1, lat2, lon2) {
  const R  = 6371;
  const dL = ((lat2 - lat1) * Math.PI) / 180;
  const dO = ((lon2 - lon1) * Math.PI) / 180;
  const a  =
    Math.sin(dL / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dO / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── COMPUTE DEMAND SCORE ──────────────────────────────
// ML STUB — currently rule-based weighted scoring
//
// INTEGRATION NOTE: area is now a "Ward N" string. The regex match against
// Issue.location.address only finds complaints if citizens'/field reports
// actually carry the ward name in the address text. If your Issue records
// are geocoded (lat/lng) instead, replace this regex match with a
// point-in-radius or point-in-ward-polygon lookup using WARD_COORDS.
async function computeDemandScore(area, resourceType) {
  const now     = new Date();
  const since24 = new Date(now - 24 * 3600 * 1000);
  const since72 = new Date(now - 72 * 3600 * 1000);

  // Map resource type back to issue categories
  const categoryMap = {
    'garbage-truck': ['sanitation'],
    'water-tanker':  ['water'],
    'ambulance':     ['medical', 'accident'],
    'police-van':    ['crime', 'road', 'electric', 'other'],
    'fire-truck':    ['fire']
  };
  const categories = categoryMap[resourceType] || [];

  // Count recent issues in area
  const recent24 = await Issue.countDocuments({
    'location.address': { $regex: area, $options: 'i' },
    category:  { $in: categories },
    createdAt: { $gte: since24 }
  });

  const recent72 = await Issue.countDocuments({
    'location.address': { $regex: area, $options: 'i' },
    category:  { $in: categories },
    createdAt: { $gte: since72 }
  });

  const openIssues = await Issue.countDocuments({
    'location.address': { $regex: area, $options: 'i' },
    category: { $in: categories },
    status:   { $ne: 'resolved' }
  });

  // Active alerts for this area
  const activeAlerts = await Alert.countDocuments({
    area:     { $regex: area, $options: 'i' },
    isActive: true
  });

  // Weighted demand score
  // ML STUB — replace with trained regression model
  const score =
    (recent24  * 3.0) +   // High weight: last 24h complaints
    (recent72  * 1.5) +   // Medium: last 72h trend
    (openIssues * 2.0) +  // High: unresolved backlog
    (activeAlerts * 4.0); // Critical: active system alerts

  /*
  ── ML REPLACEMENT (future) ──────────────────────────
  const features = [
    recent24, recent72, openIssues, activeAlerts,
    new Date().getHours() / 24,   // time of day factor
    new Date().getDay() / 7,      // day of week factor
    crowdDensity / 5000           // normalized crowd
  ];

  const score = await callMLModel('/api/ml/demand-score', features);
  ─────────────────────────────────────────────────── */

  return {
    score:        parseFloat(score.toFixed(2)),
    breakdown: {
      recent24,
      recent72,
      openIssues,
      activeAlerts
    }
  };
}

// ── GENERATE ALLOCATION PLAN ──────────────────────────
async function generateAllocationPlan(resourceType = null) {
  const plan     = [];
  const types    = resourceType
    ? [resourceType]
    : ['garbage-truck', 'ambulance', 'water-tanker',
       'police-van', 'fire-truck'];

  for (const type of types) {
    // Get available resources
    const available = await Resource.find({
      type,
      status: 'available'
    });

    if (!available.length) {
      plan.push({
        resourceType: type,
        available:    0,
        deployed:     0,
        recommendations: [{
          action:   'procure',
          message:  `No available ${type}s. Request additional units.`,
          priority: 'high'
        }]
      });
      continue;
    }

    // Score each area
    const areaScores = [];
    for (const area of AREAS) {
      const demand = await computeDemandScore(area, type);
      areaScores.push({ area, ...demand });
    }

    // Sort by score descending
    areaScores.sort((a, b) => b.score - a.score);

    // Match resources to top demand areas
    const recommendations = [];
    const toAssign = areaScores.filter(a => a.score > 0)
                               .slice(0, available.length);

    for (let i = 0; i < toAssign.length; i++) {
      const area     = toAssign[i];
      const resource = available[i];
      if (!resource) break;

      // Find nearest available resource to area
      const areaCoords = getAreaCoords(area.area);
      let nearest = available[0];
      let minDist = Infinity;

      available.forEach(r => {
        if (!r.location?.lat) return;
        const dist = haversine(
          areaCoords.lat, areaCoords.lng,
          r.location.lat, r.location.lng
        );
        if (dist < minDist) { minDist = dist; nearest = r; }
      });

      recommendations.push({
        action:       'deploy',
        resource:     nearest.name,
        resourceId:   nearest._id,
        toArea:       area.area,
        priority:     area.score > 20 ? 'critical'
                    : area.score > 10 ? 'high'
                    : area.score > 5  ? 'medium'
                    : 'low',
        demandScore:  area.score,
        breakdown:    area.breakdown,
        distance:     minDist !== Infinity
                      ? parseFloat(minDist.toFixed(2))
                      : null,
        message:      buildDeployMessage(nearest, area)
      });
    }

    // Areas with no demand
    const idleResources = available.length - toAssign.length;

    const totalDeployed = await Resource.countDocuments({
      type, status: 'deployed'
    });

    plan.push({
      resourceType:    type,
      available:       available.length,
      deployed:        totalDeployed,
      recommendations,
      idleResources,
      summary:         buildSummary(type, recommendations)
    });
  }

  return plan;
}

// ── AUTO-DEPLOY ───────────────────────────────────────
async function autoDeployResource(resourceId, area, reason, userId) {
  const resource = await Resource.findById(resourceId);
  if (!resource || resource.status !== 'available') {
    throw new Error('Resource not available');
  }

  const areaCoords = getAreaCoords(area);

  // Update resource status
  await Resource.findByIdAndUpdate(resourceId, {
    status:      'deployed',
    assignedTo:  area,
    lastDeployed: new Date(),
    location: {
      ...resource.location,
      lat:  areaCoords.lat,
      lng:  areaCoords.lng,
      area: area
    }
  });

  // Create deployment record
  const demand = await computeDemandScore(area, resource.type);
  const deployment = await Deployment.create({
    resourceId,
    resourceName: resource.name,
    resourceType: resource.type,
    area,
    reason,
    priority:    demand.score > 20 ? 'critical'
               : demand.score > 10 ? 'high'
               : demand.score > 5  ? 'medium'
               : 'low',
    demandScore: demand.score,
    createdBy:   userId
  });

  return { resource, deployment };
}

// ── RECALL RESOURCE ───────────────────────────────────
async function recallResource(resourceId) {
  const resource = await Resource.findById(resourceId);
  if (!resource) throw new Error('Resource not found');

  await Resource.findByIdAndUpdate(resourceId, {
    status:      'returning',
    assignedTo:  null
  });

  // After 5 min sim — mark available
  setTimeout(async () => {
    await Resource.findByIdAndUpdate(resourceId, {
      status:      'available',
      currentLoad: 0
    });
  }, 5 * 60 * 1000);

  // Complete deployment record
  await Deployment.findOneAndUpdate(
    { resourceId, status: 'active' },
    { status: 'completed', completedAt: new Date() }
  );

  return resource;
}

// ── HOTSPOT ANALYSIS ──────────────────────────────────
async function getHotspots(resourceType) {
  const categoryMap = {
    'garbage-truck': ['sanitation'],
    'water-tanker':  ['water'],
    'ambulance':     ['medical', 'accident'],
    'police-van':    ['crime', 'road', 'electric', 'other'],
    'fire-truck':    ['fire']
  };
  const categories = categoryMap[resourceType] || [];

  const hotspots = [];
  for (const area of AREAS) {
    const demand = await computeDemandScore(area, resourceType);
    const coords = getAreaCoords(area);
    hotspots.push({
      area,
      lat:   coords.lat,
      lng:   coords.lng,
      score: demand.score,
      breakdown: demand.breakdown
    });
  }

  return hotspots.sort((a, b) => b.score - a.score);
}

// ── HELPERS ───────────────────────────────────────────
// area is a "Ward N" label; look up its centroid in WARD_COORDS.
// Falls back to the city center if the ward number is unknown.
function getAreaCoords(area) {
  const match = /Ward (\d+)/.exec(area || '');
  const wardNum = match ? match[1] : null;
  return WARD_COORDS[wardNum] || { lat: 15.1394, lng: 76.9214 };
}

function buildDeployMessage(resource, area) {
  const typeVerb = {
    'garbage-truck': 'collect waste from',
    'ambulance':     'provide medical cover in',
    'water-tanker':  'supply water to',
    'police-van':    'patrol and assist in',
    'fire-truck':    'stand by in'
  };
  const verb = typeVerb[resource.type] || 'deploy to';
  return `Send ${resource.name} to ${verb} ${area.area}
          (demand score: ${area.score})`;
}

function buildSummary(type, recs) {
  const critical = recs.filter(r => r.priority === 'critical').length;
  const high     = recs.filter(r => r.priority === 'high').length;
  if (!recs.length) return `No deployment needed for ${type}`;
  if (critical > 0) return `URGENT: Deploy ${critical} ${type}(s) immediately`;
  if (high > 0)     return `Deploy ${high} ${type}(s) to high-demand areas`;
  return `${recs.length} ${type}(s) should be repositioned`;
}

module.exports = {
  generateAllocationPlan,
  autoDeployResource,
  recallResource,
  getHotspots,
  computeDemandScore
};