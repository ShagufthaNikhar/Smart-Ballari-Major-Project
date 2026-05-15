const express = require('express');
const router  = express.Router();

const API_KEY = process.env.OPENWEATHER_API_KEY;
const LAT     = process.env.OPENWEATHER_LAT;
const LON     = process.env.OPENWEATHER_LON;
const CITY    = process.env.OPENWEATHER_CITY;

// GET /api/city/weather
router.get('/weather', async (req, res) => {
  try {
    const r = await fetch(
      `https://api.openweathermap.org/data/2.5/weather` +
      `?q=${CITY}&appid=${API_KEY}&units=metric`
    );
    const data = await r.json();

    res.json({
      city:        data.name,
      temp:        Math.round(data.main.temp),
      feels_like:  Math.round(data.main.feels_like),
      humidity:    data.main.humidity,
      description: data.weather[0].description,
      icon:        data.weather[0].icon,
      wind:        data.wind.speed,
      visibility:  data.visibility / 1000  // km
    });
  } catch (err) {
    res.status(500).json({ error: 'Weather fetch failed' });
  }
});

// GET /api/city/aqi
router.get('/aqi', async (req, res) => {
  try {
    const r = await fetch(
      `https://api.openweathermap.org/data/2.5/air_pollution` +
      `?lat=${LAT}&lon=${LON}&appid=${API_KEY}`
    );
    const data = await r.json();
    const comp = data.list[0].components;
    const aqi  = data.list[0].main.aqi;

    const aqiLabels = {
      1: { label: 'Good',      color: '#22c55e' },
      2: { label: 'Fair',      color: '#84cc16' },
      3: { label: 'Moderate',  color: '#f59e0b' },
      4: { label: 'Poor',      color: '#ef4444' },
      5: { label: 'Very Poor', color: '#7c3aed' }
    };

    res.json({
      aqi,
      ...aqiLabels[aqi],
      pm2_5: comp.pm2_5.toFixed(1),
      pm10:  comp.pm10.toFixed(1),
      co:    comp.co.toFixed(1),
      no2:   comp.no2.toFixed(1)
    });
  } catch (err) {
    res.status(500).json({ error: 'AQI fetch failed' });
  }
});

// GET /api/city/all  — single call for dashboard
router.get('/all', async (req, res) => {
  try {
    const [weatherRes, aqiRes, statsRes] = await Promise.all([
      fetch(`http://localhost:${process.env.PORT || 5000}/api/city/weather`),
      fetch(`http://localhost:${process.env.PORT || 5000}/api/city/aqi`),
      fetch(`http://localhost:${process.env.PORT || 5000}/api/issues/stats`)
    ]);

    const [weather, aqi, stats] = await Promise.all([
      weatherRes.json(),
      aqiRes.json(),
      statsRes.json()
    ]);

    res.json({ weather, aqi, stats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;