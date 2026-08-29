<!-- <!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Smart Ballari — Home</title>
  <link rel="stylesheet" href="../css/style.css" />
</head>
<body>

  <nav id="navbar"></nav>

  <main class="home-main">

   Hero
    <section class="hero">
      <div class="hero-content">
        <h1>Welcome to <span>Smart Ballari</span></h1>
        <p>Report civic issues, track resolutions, and help build a better Ballari.</p>
        <div class="hero-btns">
          <a href="map.html" class="btn-primary">🗺️ View Map</a>
          <a href="report.html" class="btn-secondary">📌 Report Issue</a>
        </div>
      </div>
      <div class="hero-stats">
        <div class="stat-card" id="stat-total">
          <h2 id="total-issues">--</h2>
          <p>Total Issues</p>
        </div>
        <div class="stat-card" id="stat-resolved">
          <h2 id="resolved-issues">--</h2>
          <p>Resolved</p>
        </div>
        <div class="stat-card" id="stat-pending">
          <h2 id="pending-issues">--</h2>
          <p>Pending</p>
        </div>
      </div>
    </section>

    //Quick Actions — role-aware 
    <section class="quick-actions" id="quick-actions"></section>

   //Recent Issues Feed 
    <section class="feed">
      <h2>📍 Recent Issues in Ballari</h2>
      <div class="feed-list" id="feed-list">
        <p class="loading">Loading issues...</p>
      </div>
    </section>
    // Municipality Updates Panel 
<section class="updates-section">
  <div class="updates-header">
    <h2>🏛️ Municipality Updates</h2>
    <div class="area-filter">
      <label style="color:#94a3b8; font-size:0.85rem;">Filter by Area:</label>
      <select id="area-select" onchange="loadUpdates()">
        <option value="all">All Areas</option>
        <option value="ballari-city">Ballari City</option>
        <option value="hospet">Hospet</option>
        <option value="siruguppa">Siruguppa</option>
        <option value="sandur">Sandur</option>
        <option value="kudligi">Kudligi</option>
      </select>
    </div>
  </div>
  <div id="updates-list" class="updates-list">
    <p style="color:#64748b;">Loading updates...</p>
  </div>
</section>


  </main>

  <script src="../js/app.js"></script>
  <script src="../js/home.js"></script>
</body>
</html>-->

<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Smart Ballari — Home</title>
  <link rel="stylesheet" href="../css/style.css" />
  <style>
    /* ── HERO ── */
    .hero-new {
      position: relative;
      min-height: 520px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 3rem 1.5rem;
      background:
        linear-gradient(180deg, rgba(6,12,24,0.75) 0%, rgba(6,12,24,0.55) 45%, rgba(6,12,24,0.85) 100%),
        url('../images/ballari-fort.png') center 60% / cover no-repeat;
    }

    .hero-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.4rem 1rem;
      border-radius: 999px;
      background: rgba(255,255,255,0.12);
      backdrop-filter: blur(6px);
      border: 1px solid rgba(255,255,255,0.18);
      color: #f1f5f9;
      font-size: 0.8rem;
      font-weight: 600;
      margin-bottom: 1.4rem;
    }

    .hero-badge .dot {
      width: 8px; height: 8px;
      border-radius: 50%;
      background: #22c55e;
      box-shadow: 0 0 8px #22c55e;
    }

    .hero-new h1 {
      font-size: clamp(2.2rem, 6vw, 3.6rem);
      font-weight: 800;
      color: #f8fafc;
      line-height: 1.1;
      margin-bottom: 1rem;
      letter-spacing: -0.02em;
    }

    .hero-new h1 span {
      background: linear-gradient(135deg, #38bdf8, #7c3aed);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
    }

    .hero-new .hero-subtitle {
      max-width: 640px;
      color: #cbd5e1;
      font-size: 1.05rem;
      line-height: 1.6;
      margin-bottom: 2.2rem;
    }

    .hero-search {
      width: 100%;
      max-width: 620px;
      display: flex;
      align-items: center;
      gap: 0.6rem;
      background: rgba(15,23,42,0.55);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 999px;
      padding: 0.5rem 0.5rem 0.5rem 1.2rem;
    }

    .hero-search input {
      flex: 1;
      background: transparent;
      border: none;
      outline: none;
      color: #f1f5f9;
      font-size: 0.95rem;
    }

    .hero-search input::placeholder { color: #94a3b8; }

    .hero-search button {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      background: linear-gradient(135deg, #38bdf8, #0ea5e9);
      color: #0f172a;
      border: none;
      padding: 0.7rem 1.4rem;
      border-radius: 999px;
      font-weight: 700;
      font-size: 0.92rem;
      cursor: pointer;
      white-space: nowrap;
    }

    .hero-search button:hover { filter: brightness(1.08); }

    .hero-quicklinks {
      display: flex;
      gap: 0.8rem;
      margin-top: 1.4rem;
      flex-wrap: wrap;
      justify-content: center;
    }

    .hero-quicklinks a {
      color: #e2e8f0;
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.15);
      padding: 0.45rem 1rem;
      border-radius: 999px;
      font-size: 0.82rem;
      text-decoration: none;
      transition: background 0.15s;
    }

    .hero-quicklinks a:hover { background: rgba(255,255,255,0.16); }

    /* ── STATS STRIP (moved below hero) ── */
    .stats-strip {
      display: flex;
      justify-content: center;
      gap: 1.2rem;
      flex-wrap: wrap;
      padding: 1.6rem 1.5rem;
      background: #0b1220;
      border-bottom: 1px solid #1e293b;
    }

    .stats-strip .stat-card {
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 14px;
      padding: 1rem 1.6rem;
      text-align: center;
      min-width: 140px;
    }

    .stats-strip .stat-card h2 {
      color: #38bdf8;
      font-size: 1.6rem;
      margin: 0;
    }

    .stats-strip .stat-card p {
      color: #94a3b8;
      font-size: 0.8rem;
      margin: 0.2rem 0 0;
    }

    @media (max-width: 640px) {
      .hero-search { flex-wrap: wrap; border-radius: 20px; padding: 0.8rem; }
      .hero-search input { width: 100%; }
      .hero-search button { width: 100%; justify-content: center; }
    }
  </style>
</head>
<body>

  <nav id="navbar"></nav>

  <main class="home-main">

    <!-- Hero -->
    <section class="hero-new">
      <div class="hero-badge">
        <span class="dot"></span> Ballari Smart City Platform
      </div>

      <h1>Your City, <span>Smarter</span></h1>

      <p class="hero-subtitle">
        One app for everything — transport, schools, jobs, places, civic issues and city updates for Ballari.
      </p>

      <form class="hero-search" onsubmit="handleHeroSearch(event)">
        <input
          type="text"
          id="hero-search-input"
          placeholder="Search jobs, places, services, alerts..."
        />
        <button type="submit">Search →</button>
      </form>

      <div class="hero-quicklinks">
        <a href="map.html">🗺️ View Map</a>
        <a href="report.html">📌 Report Issue</a>
      </div>
    </section>

    <!-- Stats -->
    <section class="stats-strip">
      <div class="stat-card" id="stat-total">
        <h2 id="total-issues">--</h2>
        <p>Total Issues</p>
      </div>
      <div class="stat-card" id="stat-resolved">
        <h2 id="resolved-issues">--</h2>
        <p>Resolved</p>
      </div>
      <div class="stat-card" id="stat-pending">
        <h2 id="pending-issues">--</h2>
        <p>Pending</p>
      </div>
    </section>

    <!-- Quick Actions — role-aware -->
    <section class="quick-actions" id="quick-actions"></section>

    <!-- Recent Issues Feed -->
    <section class="feed">
      <h2>📍 Recent Issues in Ballari</h2>
      <div class="feed-list" id="feed-list">
        <p class="loading">Loading issues...</p>
      </div>
    </section>

    <!-- Municipality Updates Panel -->
    <section class="updates-section">
      <div class="updates-header">
        <h2>🏛️ Municipality Updates</h2>
        <div class="area-filter">
          <label style="color:#94a3b8; font-size:0.85rem;">Filter by Area:</label>
          <select id="area-select" onchange="loadUpdates()">
            <option value="all">All Areas</option>
            <option value="ballari-city">Ballari City</option>
            <option value="hospet">Hospet</option>
            <option value="siruguppa">Siruguppa</option>
            <option value="sandur">Sandur</option>
            <option value="kudligi">Kudligi</option>
          </select>
        </div>
      </div>
      <div id="updates-list" class="updates-list">
        <p style="color:#64748b;">Loading updates...</p>
      </div>
    </section>

  </main>

  <script>
    function handleHeroSearch(e) {
      e.preventDefault();
      const q = document.getElementById('hero-search-input').value.trim();
      if (!q) return;
      // Adjust the target page/query param to match your actual search route
      window.location.href = `search.html?q=${encodeURIComponent(q)}`;
    }
  </script>

  <script src="../js/app.js"></script>
  <script src="../js/home.js"></script>
</body>
</html>
