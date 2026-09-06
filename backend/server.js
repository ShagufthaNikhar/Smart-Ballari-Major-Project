require('dotenv').config();

const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');

const { initSimulator, tick }      = require('./config/busSimulator');
const { runRules, autoResolve }    = require('./config/ruleEngine');
const { detectSurge }              = require('./config/crowdEngine');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ── ROUTES ──────────────────────────────────────────
app.get('/', (req, res) => res.json({ message: 'Smart Ballari API running' }));

app.use('/api/auth',        require('./routes/auth'));
app.use('/api/me',          require('./routes/me'));          // role lookup for the frontend

// Three modules
app.use('/api/issues',      require('./routes/issues'));      // public + citizen
app.use('/api/officer',     require('./routes/officer'));     // role: officer
app.use('/api/admin',       require('./routes/admin'));       // role: admin

app.use('/api/updates',     require('./routes/updates'));
app.use('/api/city',        require('./routes/city'));
app.use('/api/notify',      require('./routes/notifications'));
app.use('/api/transport',   require('./routes/transport'));
app.use('/api/emergency',   require('./routes/emergency'));
app.use('/api/ai',          require('./routes/ai'));
app.use('/api/alerts',      require('./routes/alerts'));
app.use('/api/crowd',       require('./routes/crowd'));
app.use('/api/twin',        require('./routes/twin'));
app.use('/api/heritage',    require('./routes/heritage'));
app.use('/api/civic',       require('./routes/civic'));
app.use('/api/explore',     require('./routes/explore'));
app.use('/api/weather',     require('./routes/weather'));
app.use('/api/resources',   require('./routes/resources'));
app.use('/api/assistant',   require('./routes/assistant'));
app.use('/api/community',   require('./routes/community'));
app.use('/api/lifestyle',   require('./routes/lifestyle'));
app.use('/api/services',    require('./routes/services'));
app.use('/api/integration', require('./routes/integration'));

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// Catch-all error handler. Without this, a thrown error in an async route
// hangs the request until the client times out.
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Server error' });
});

// ── STARTUP ─────────────────────────────────────────
// ONE connect, ONE set of intervals. The original file called
// mongoose.connect() twice (double bus simulator) and scheduled
// runRules/autoResolve in two places (rules fired twice per cycle).
const PORT = process.env.PORT || 5000;

mongoose.connection.on('error',        e => console.error('Mongo error:', e.message));
mongoose.connection.on('disconnected', () => console.warn('Mongo disconnected'));
mongoose.connection.on('reconnected',  () => console.log('Mongo reconnected'));

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('MongoDB Connected');

    await initSimulator();
    setInterval(tick, 2000);

    // Give the connection pool time to settle before the rule engine
    // fires six concurrent aggregations. Running them the instant
    // connect() resolves was producing ECONNRESET on every rule.
    setTimeout(async () => {
      try {
        await runRules();
      } catch (err) {
        console.error('Initial rule run failed:', err.message);
      }
    }, 15000);

    setInterval(async () => {
      try {
        await runRules();
        await autoResolve();
        await detectSurge();
      } catch (err) {
        console.error('Scheduled job failed:', err.message);
      }
    }, 10 * 60 * 1000);

    // Listen only after the DB is up, so no request hits a dead connection.
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch(err => {
    console.error('DB Error:', err);
    process.exit(1);
  });

module.exports = app;