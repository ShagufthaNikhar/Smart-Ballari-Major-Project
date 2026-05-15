const express = require('express');
const router  = express.Router();

const API_KEY = process.env.OPENWEATHER_API_KEY;
const LAT     = process.env.OPENWEATHER_LAT  || '15.1394';
const LON     = process.env.OPENWEATHER_LON  || '76.9214';
const CITY    = process.env.OPENWEATHER_CITY || 'Ballari';

// ── FETCH HELPER ──────────────────────────────────────
async function owFetch(endpoint, params = '') {
  const url = `https://api.openweathermap.org/data/2.5/${endpoint}`
            + `?appid=${API_KEY}&units=metric${params}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OWM error: ${res.status}`);
  return res.json();
}

// GET /api/weather/current
router.get('/current', async (req, res) => {
  try {
    const data = await owFetch('weather', `&q=${CITY}`);
    res.json({
      city:        data.name,
      temp:        Math.round(data.main.temp),
      feels_like:  Math.round(data.main.feels_like),
      humidity:    data.main.humidity,
      pressure:    data.main.pressure,
      description: data.weather[0].description,
      icon:        data.weather[0].icon,
      wind_speed:  data.wind.speed,
      wind_deg:    data.wind.deg,
      visibility:  (data.visibility / 1000).toFixed(1),
      clouds:      data.clouds.all,
      rain_1h:     data.rain?.['1h'] || 0,
      timestamp:   Date.now()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/weather/forecast
// 5-day / 3-hour forecast
router.get('/forecast', async (req, res) => {
  try {
    const data = await owFetch('forecast', `&q=${CITY}`);

    const forecast = data.list.map(item => ({
      time:        item.dt * 1000,
      temp:        Math.round(item.main.temp),
      feels_like:  Math.round(item.main.feels_like),
      humidity:    item.main.humidity,
      description: item.weather[0].description,
      icon:        item.weather[0].icon,
      wind_speed:  item.wind.speed,
      rain_3h:     item.rain?.['3h'] || 0,
      pop:         Math.round((item.pop || 0) * 100),  // % precip probability
      clouds:      item.clouds.all
    }));

    res.json({ city: data.city.name, forecast });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/weather/alerts
// Derived alerts from forecast data
router.get('/alerts', async (req, res) => {
  try {
    const [current, forecastData, aqiData] = await Promise.all([
      owFetch('weather',       `&q=${CITY}`),
      owFetch('forecast',      `&q=${CITY}`),
      owFetch('air_pollution', `&lat=${LAT}&lon=${LON}`)
    ]);

    const alerts  = [];
    const forecast = forecastData.list;

    // ── RAIN ALERT ─────────────────────────────────────
    const heavyRain = forecast.slice(0, 8).filter(
      f => (f.rain?.['3h'] || 0) > 10 || (f.pop || 0) > 0.7
    );

    if (heavyRain.length > 0) {
      const maxRain = Math.max(
        ...heavyRain.map(f => f.rain?.['3h'] || 0)
      );
      alerts.push({
        type:     'rain',
        severity: maxRain > 25 ? 'critical' : 'warning',
        title:    maxRain > 25
          ? '⛈️ Heavy Rain Warning'
          : '🌧️ Rain Expected',
        message:  `${maxRain.toFixed(1)}mm rain expected in next 24hrs.
                   ${maxRain > 25
                     ? 'Flood risk in low-lying areas. Avoid Hospet Road.'
                     : 'Carry umbrella. Minor waterlogging possible.'}`,
        value:    maxRain,
        unit:     'mm',
        time:     heavyRain[0].dt * 1000
      });
    }

    // ── HEAT ALERT ─────────────────────────────────────
    const maxTemp = Math.max(
      ...forecast.slice(0, 8).map(f => f.main.temp)
    );

    if (maxTemp > 40) {
      alerts.push({
        type:     'heat',
        severity: maxTemp > 44 ? 'critical' : 'warning',
        title:    maxTemp > 44
          ? '🔥 Extreme Heat Alert'
          : '☀️ Heat Wave Warning',
        message:  `Temperature expected to reach ${Math.round(maxTemp)}°C.
                   ${maxTemp > 44
                     ? 'Avoid outdoor activity 11am–4pm. Keep hydrated.'
                     : 'Use sunscreen. Stay hydrated. Limit outdoor exposure.'}`,
        value:    Math.round(maxTemp),
        unit:     '°C'
      });
    }

    // ── FLOOD RISK ─────────────────────────────────────
    const totalRain72h = forecast.slice(0, 24)
      .reduce((s, f) => s + (f.rain?.['3h'] || 0), 0);

    if (totalRain72h > 50) {
      const floodZones = getFloodRiskZones(totalRain72h);
      alerts.push({
        type:      'flood',
        severity:  totalRain72h > 100 ? 'critical' : 'warning',
        title:     '🌊 Flood Risk Alert',
        message:   `${totalRain72h.toFixed(0)}mm total rain over 72hrs.
                   Flood risk in: ${floodZones.map(z => z.name).join(', ')}.
                   Pre-position rescue teams.`,
        value:     totalRain72h.toFixed(0),
        unit:      'mm/72h',
        zones:     floodZones
      });
    }

    // ── HIGH WIND ──────────────────────────────────────
    const maxWind = Math.max(
      ...forecast.slice(0, 8).map(f => f.wind.speed)
    );

    if (maxWind > 10) {
      alerts.push({
        type:     'wind',
        severity: maxWind > 20 ? 'critical' : 'info',
        title:    '💨 Strong Wind Advisory',
        message:  `Wind speeds up to ${maxWind.toFixed(1)} m/s expected.
                   Secure loose structures. Avoid outdoor events.`,
        value:    maxWind.toFixed(1),
        unit:     'm/s'
      });
    }

    // ── AQI ALERT ──────────────────────────────────────
    const aqi = aqiData.list[0].main.aqi;
    if (aqi >= 4) {
      alerts.push({
        type:     'aqi',
        severity: aqi === 5 ? 'critical' : 'warning',
        title:    '💨 Poor Air Quality',
        message:  `AQI level ${aqi}/5 — ${['','Good','Fair','Moderate','Poor','Very Poor'][aqi]}.
                   Sensitive groups should avoid outdoor activity.`,
        value:    aqi,
        unit:     'AQI'
      });
    }

    res.json({ alerts, generated: Date.now() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/weather/heatmap
// Heat zone grid for Ballari
router.get('/heatmap', async (req, res) => {
  try {
    const current = await owFetch('weather', `&q=${CITY}`);
    const baseTemp = current.main.temp;

    const zones = generateHeatZones(
      parseFloat(LAT), parseFloat(LON), baseTemp
    );

    res.json({ baseTemp, zones });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/weather/flood-risk
router.get('/flood-risk', async (req, res) => {
  try {
    const forecastData = await owFetch('forecast', `&q=${CITY}`);
    const total72h = forecastData.list.slice(0, 24)
      .reduce((s, f) => s + (f.rain?.['3h'] || 0), 0);

    const zones = getFloodRiskZones(total72h);
    res.json({
      total72h:  parseFloat(total72h.toFixed(1)),
      riskLevel: total72h > 100 ? 'critical'
               : total72h > 50  ? 'high'
               : total72h > 20  ? 'moderate'
               : 'low',
      zones
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── HELPERS ───────────────────────────────────────────
function getFloodRiskZones(rainfall) {
  const baseLat = parseFloat(LAT);
  const baseLng = parseFloat(LON);

  // Low-lying areas of Ballari with flood history
  return [
    {
      name:      'Hospet Road Junction',
      lat:       baseLat - 0.009,
      lng:       baseLng + 0.016,
      risk:      rainfall > 100 ? 'critical'
               : rainfall > 50  ? 'high'
               : 'moderate',
      reason:    'Low elevation, poor drainage'
    },
    {
      name:      'Old Town Nala',
      lat:       baseLat + 0.005,
      lng:       baseLng - 0.006,
      risk:      rainfall > 75 ? 'high' : 'moderate',
      reason:    'Near drainage channel'
    },
    {
      name:      'KSRTC Stand Area',
      lat:       baseLat - 0.004,
      lng:       baseLng + 0.004,
      risk:      rainfall > 60 ? 'high' : 'low',
      reason:    'Concrete surface runoff'
    },
    {
      name:      'Gandhi Nagar Lower',
      lat:       baseLat,
      lng:       baseLng,
      risk:      rainfall > 80 ? 'moderate' : 'low',
      reason:    'Slight depression in terrain'
    }
  ];
}

function generateHeatZones(lat, lng, baseTemp) {
  const zones  = [];
  const offsets = [
    { dlat:  0.000, dlng:  0.000, factor: 1.0, label: 'Gandhi Nagar'  },
    { dlat: -0.004, dlng:  0.004, factor: 1.05, label: 'KSRTC Stand'  },
    { dlat:  0.003, dlng: -0.003, factor: 0.97, label: 'Nehru Gunj'   },
    { dlat:  0.006, dlng:  0.002, factor: 0.93, label: 'Cantonment'   },
    { dlat:  0.005, dlng: -0.006, factor: 1.02, label: 'Old Town'     },
    { dlat: -0.009, dlng:  0.016, factor: 1.08, label: 'Hospet Road'  }
  ];

  offsets.forEach(o => {
    const temp = parseFloat((baseTemp * o.factor).toFixed(1));
    zones.push({
      lat:   lat + o.dlat,
      lng:   lng + o.dlng,
      temp,
      label: o.label,
      level: temp > 44 ? 'extreme'
           : temp > 40 ? 'high'
           : temp > 36 ? 'moderate'
           : 'normal'
    });
  });

  return zones;
}

module.exports = router;