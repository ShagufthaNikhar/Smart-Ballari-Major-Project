const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { initSimulator, tick } = require('./config/busSimulator');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
console.log("MONGO_URI:", process.env.MONGO_URI);
// MongoDB Connect
mongoose.connect(process.env.MONGO_URI)

  .then(async() => { 
    console.log('✅ MongoDB Connected');
    // Start bus simulator after DB ready
    await initSimulator();
    // Tick every 2 seconds — moves buses along route
    setInterval(tick,2000);
  })
  .catch(err => console.log('❌ DB Error:', err));

// Test Route
app.get('/', (req, res) => {
  res.json({ message: 'Smart Ballari API running 🚀' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

const issueRoutes = require('./routes/issues');
app.use('/api/issues', issueRoutes);

const updateRoutes = require('./routes/updates');
app.use('/api/updates', updateRoutes);

const cityRoutes = require('./routes/city');
app.use('/api/city', cityRoutes);

const notifyRoutes = require('./routes/notifications');
app.use('/api/notify', notifyRoutes);

const transportRoutes = require('./routes/transport');
app.use('/api/transport', transportRoutes);

const emergencyRoutes = require('./routes/emergency');
app.use('/api/emergency', emergencyRoutes);

const aiRoutes = require('./routes/ai');
app.use('/api/ai', aiRoutes);

const alertRoutes = require('./routes/alerts');
app.use('/api/alerts', alertRoutes);

const { runRules, autoResolve } = require('./config/ruleEngine');

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('✅ MongoDB Connected');

    await initSimulator();
    setInterval(tick, 2000);

    // Run rule engine every 10 minutes
    await runRules();
    setInterval(async () => {
      await runRules();
      await autoResolve();
    }, 10 * 60 * 1000);
  });

  const crowdRoutes = require('./routes/crowd');
app.use('/api/crowd', crowdRoutes);

// Wire surge detection into rule engine interval
const { detectSurge } = require('./config/crowdEngine');

// Add inside the setInterval for rules:
setInterval(async () => {
  await runRules();
  await autoResolve();
  await detectSurge();  // ← add this line
}, 10 * 60 * 1000);

const twinRoutes = require('./routes/twin');
app.use('/api/twin', twinRoutes);

const heritageRoutes = require('./routes/heritage');
app.use('/api/heritage', heritageRoutes);

const weatherRoutes = require('./routes/weather');
app.use('/api/weather', weatherRoutes);

const resourceRoutes = require('./routes/resources');
app.use('/api/resources', resourceRoutes);

const assistantRoutes = require('./routes/assistant');
app.use('/api/assistant', assistantRoutes);

const communityRoutes = require('./routes/community');
app.use('/api/community', communityRoutes);

const lifestyleRoutes = require('./routes/lifestyle');
app.use('/api/lifestyle', lifestyleRoutes);

const servicesRoutes = require('./routes/services');
app.use('/api/services', servicesRoutes);

const integrationRoutes = require('./routes/integration');
app.use('/api/integration', integrationRoutes);