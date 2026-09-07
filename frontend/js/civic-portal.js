const CP_BACKEND = window.SB_API;


/* =========================================================
   PAGE LOAD
========================================================= */

document.addEventListener('DOMContentLoaded', () => {

  loadCouncillors();

  loadProjects();

});



/* =========================================================
   WARD COUNCILLOR DIRECTORY
========================================================= */

/*
  REAL WARD COUNCILLOR DATA
  --------------------------
  Ward 1 to Ward 39, sorted by ward number.
*/

const WARD_COUNCILLORS = [
  { ward: 1,  name: 'Hanuman Ji',           phone: '9632262552', position: 'Member of the Standing Committee on Accounts' },
  { ward: 2,  name: 'K Eramma',             phone: '9900338036', position: 'Corporation Member' },
  { ward: 3,  name: 'M Prabhajan Kumar',    phone: '8105123456', position: 'Corporation Member' },
  { ward: 4,  name: 'D Triveni',            phone: '9449245659', position: 'Urban Planning and Development Standing Committee Member' },
  { ward: 5,  name: 'H Rajasekhar',         phone: '9986179944', position: 'Tax, Finance and Appeals Standing Committee Member' },
  { ward: 6,  name: 'MK Padma Roja',        phone: '8861687779', position: 'Urban Planning and Development Standing Committee Member' },
  { ward: 7,  name: 'Umadevi',              phone: '9448678399', position: 'Public Health, Education and Social Justice Standing Committee Member' },
  { ward: 8,  name: 'M Ramanjineyalu',      phone: '9845156157', position: 'Corporation Member' },
  { ward: 9,  name: 'Jabbar Saab',          phone: '9972983055', position: 'Public Health, Education and Social Justice Standing Committee Member' },
  { ward: 10, name: 'K Tilak Kumar',        phone: '9590566666', position: 'Corporation Member' },
  { ward: 11, name: 'N Govinda Rajulu',     phone: '9880812340', position: 'Member of the Standing Committee on Accounts' },
  { ward: 12, name: 'K.A. Chetana',         phone: '9448260089', position: 'Member of the Standing Committee on Accounts' },
  { ward: 13, name: 'C Ibrahim',            phone: '9448386879', position: 'Corporation Member' },
  { ward: 14, name: 'B Rathnamma',          phone: '9035339999', position: 'Tax, Finance and Appeals Standing Committee Member' },
  { ward: 15, name: 'Noor Mohammed',        phone: '9980373998', position: 'Tax, Finance and Appeals Standing Committee Member' },
  { ward: 16, name: 'Nagaratna',            phone: '9741609477', position: 'Member of the Standing Committee on Accounts' },
  { ward: 17, name: 'Poet K Honnappa',      phone: '9611255999', position: 'Chairman of the Standing Committee on Urban Planning and Development' },
  { ward: 18, name: 'M Nandish',            phone: '9449566666', position: 'Tax, Finance and Appeals Standing Committee Member' },
  { ward: 19, name: 'K.S. Ashoka Kumar',    phone: '9060739999', position: 'Corporation Member' },
  { ward: 20, name: 'Param Vivek',          phone: '9886594707', position: 'Chairman of the Standing Committee on Reproductive Health, Education and Social Justice' },
  { ward: 21, name: 'S Surekha Gowda',      phone: '7892901792', position: 'Member of the Standing Committee on Accounts' },
  { ward: 22, name: 'Hanumanthappa.K',      phone: '9845447779', position: 'Chairman of the Standing Committee on Accounts' },
  { ward: 23, name: 'P Gadeppa',            phone: '9448056580', position: 'Honorable Mayor' },
  { ward: 24, name: 'T Srinivas Motkar',    phone: '9980777688', position: 'Member of the Standing Committee on Accounts' },
  { ward: 25, name: 'M Govindarajalu',      phone: '9845148984', position: 'Corporation Member' },
  { ward: 26, name: 'D Sukhumvit',          phone: '9066616666', position: 'Corporation Member' },
  { ward: 27, name: 'Niaz Ahmed',           phone: '9740264246', position: 'Urban Planning and Development Standing Committee Member' },
  { ward: 28, name: 'Mubeena B',            phone: '7795306538', position: 'Honorable Deputy Mayor' },
  { ward: 29, name: 'G Shilpa',             phone: '9845358850', position: 'Public Health, Education and Social Justice Standing Committee Member' },
  { ward: 30, name: 'S.M.D. Asif Bhash',    phone: '9342678786', position: 'Tax, Finance and Appeals Standing Committee Member' },
  { ward: 31, name: 'Shweta B',             phone: '8050466186', position: 'Tax, Finance and Appeals Standing Committee Member' },
  { ward: 32, name: 'K Manjula',            phone: '8277477308', position: 'Urban Planning and Development Standing Committee Member' },
  { ward: 33, name: 'B Janaki',             phone: '9986175553', position: 'Public Health, Education and Social Justice Standing Committee Member' },
  { ward: 34, name: 'M Rajeshwari',         phone: '9448922883', position: 'Public Health, Education and Social Justice Standing Committee Member' },
  { ward: 35, name: 'V Srinivasulu',        phone: '9483566667', position: 'Corporation Member' },
  { ward: 36, name: 'P Kalpana',            phone: '9663284666', position: 'Corporation Member' },
  { ward: 37, name: 'Malan Bee',            phone: '9148714355', position: 'Urban Planning and Development Standing Committee Member' },
  { ward: 38, name: 'V.Kubera',             phone: '9986606667', position: 'Chairman of the Standing Committee on Taxation, Finance and Appeals' },
  { ward: 39, name: 'P Sasikala',           phone: '9901359999', position: 'Public Health, Education and Social Justice Standing Committee Member' }
];


function loadCouncillors() {

  const el = document.getElementById('cp-councillors');

  if (!el) return;

  const data = WARD_COUNCILLORS;

  if (!Array.isArray(data) || !data.length) {

    el.innerHTML =
      '<p class="cp-empty">No councillor data available yet.</p>';

    return;

  }

  el.innerHTML = data.map(c => `

    <div class="cp-councillor-card">

      <div class="cp-avatar">
        ${(c.name || '?')
          .trim()
          .charAt(0)
          .toUpperCase()}
      </div>


      <div class="cp-councillor-info">

        <div class="name">
          ${escapeHtml(c.name || 'Unknown')}
        </div>


        <div class="meta">

          Ward
          ${escapeHtml(c.ward ?? '—')}

          ${
            c.position
              ? ` · ${escapeHtml(c.position)}`
              : ''
          }

        </div>

      </div>


      ${
        c.phone
          ? `
            <a
              class="cp-call-btn"
              href="tel:${escapeHtml(c.phone)}"
              title="Call"
            >
              📞
            </a>
          `
          : ''
      }

    </div>

  `).join('');

}



/* =========================================================
   BUDGET DATA
========================================================= */

/*
  VERIFIED 2025-26 BUDGET ALLOCATIONS
  -----------------------------------

  Amounts are in LAKHS.

  IMPORTANT:
  These are BUDGET ALLOCATIONS.

  They are NOT treated as:
    - money spent
    - percentage completed
    - work started
    - work completed

  until actual project-status/expenditure data
  is available from the backend.
*/

const BUDGET_PROJECTS = [

  /* =======================================================
     WATER
  ======================================================== */

  {
    name: 'Bulk Water Maintenance',
    category: 'Water',
    department: 'Water Supply',
    financialYear: '2025-26',
    budgetLakhs: 300
  },

  {
    name: 'Bulk Water Supply Pump-House Maintenance',
    category: 'Water',
    department: 'Water Supply',
    financialYear: '2025-26',
    budgetLakhs: 150
  },

  {
    name: 'Water Booster Pump-House Maintenance',
    category: 'Water',
    department: 'Water Supply',
    financialYear: '2025-26',
    budgetLakhs: 100
  },

  {
    name: 'OHT / Cistern Tank Maintenance',
    category: 'Water',
    department: 'Water Supply',
    financialYear: '2025-26',
    budgetLakhs: 60
  },

  {
    name: 'PAC Powder for Water Treatment Plant',
    category: 'Water',
    department: 'Water Supply',
    financialYear: '2025-26',
    budgetLakhs: 130
  },

  {
    name: 'Water Pipeline Works',
    category: 'Water',
    department: 'Water Supply',
    financialYear: '2025-26',
    budgetLakhs: 220
  },

  {
    name: 'Water Tanker Expenses',
    category: 'Water',
    department: 'Water Supply',
    financialYear: '2025-26',
    budgetLakhs: 10
  },

  {
    name: 'Borewell Materials',
    category: 'Water',
    department: 'Water Supply',
    financialYear: '2025-26',
    budgetLakhs: 30
  },

  {
    name: 'Borewell Rejuvenation / Flushing',
    category: 'Water',
    department: 'Water Supply',
    financialYear: '2025-26',
    budgetLakhs: 20
  },


  /* =======================================================
     SEWERAGE
  ======================================================== */

  {
    name: 'Underground Drainage Works',
    category: 'Sewerage',
    department: 'UGD',
    financialYear: '2025-26',
    budgetLakhs: 300
  },

  {
    name: 'UGD Monthly Manpower Maintenance',
    category: 'Sewerage',
    department: 'UGD',
    financialYear: '2025-26',
    budgetLakhs: 350
  },


  /* =======================================================
     SOLID WASTE MANAGEMENT
  ======================================================== */

  {
    name: 'Solid Waste Management Plant Development',
    category: 'Solid Waste Management',
    department: 'SWM',
    financialYear: '2025-26',
    budgetLakhs: 1386
  },

  {
    name: 'SWM Fuel Expenses',
    category: 'Solid Waste Management',
    department: 'SWM',
    financialYear: '2025-26',
    budgetLakhs: 650
  },

  {
    name: 'SWM Vehicle / Container Repairs and Purchases',
    category: 'Solid Waste Management',
    department: 'SWM',
    financialYear: '2025-26',
    budgetLakhs: 125
  },

  {
    name: 'New SWM Machinery',
    category: 'Solid Waste Management',
    department: 'SWM',
    financialYear: '2025-26',
    budgetLakhs: 100
  },

  {
    name: 'MRF Wet / Dry Waste O&M',
    category: 'Solid Waste Management',
    department: 'SWM',
    financialYear: '2025-26',
    budgetLakhs: 100
  },

  {
    name: 'SWM Vehicle Parking Shed',
    category: 'Solid Waste Management',
    department: 'SWM',
    financialYear: '2025-26',
    budgetLakhs: 50
  },

  {
    name: 'SWM Zone Maintenance / Outsourcing',
    category: 'Solid Waste Management',
    department: 'SWM',
    financialYear: '2025-26',
    budgetLakhs: 550
  },


  /* =======================================================
     ROADS
  ======================================================== */

  {
    name: 'Road Repairs and Maintenance',
    category: 'Roads',
    department: 'Engineering',
    financialYear: '2025-26',
    budgetLakhs: 75
  },

  {
    name: 'Natural Calamity Road Repairs',
    category: 'Roads',
    department: 'Engineering',
    financialYear: '2025-26',
    budgetLakhs: 50
  },

  {
    name: 'Pothole Filling Machine O&M / AMC',
    category: 'Roads',
    department: 'Engineering',
    financialYear: '2025-26',
    budgetLakhs: 75
  },

  {
    name: 'Road / Street Name / Sign Boards',
    category: 'Roads',
    department: 'Engineering',
    financialYear: '2025-26',
    budgetLakhs: 75
  },

  {
    name: 'Roadside Drain Maintenance',
    category: 'Roads',
    department: 'Engineering',
    financialYear: '2025-26',
    budgetLakhs: 50
  },


  /* =======================================================
     STREET LIGHTING
  ======================================================== */

  {
    name: 'Street Light / CCMS Maintenance',
    category: 'Street Lighting',
    department: 'Electrical',
    financialYear: '2025-26',
    budgetLakhs: 470
  },

  {
    name: 'Pole Shifting / New Poles',
    category: 'Street Lighting',
    department: 'Electrical',
    financialYear: '2025-26',
    budgetLakhs: 75
  },

  {
    name: 'Street Lighting Inspection / Consultancy',
    category: 'Street Lighting',
    department: 'Electrical',
    financialYear: '2025-26',
    budgetLakhs: 50
  },


  /* =======================================================
     PARKS & ENVIRONMENT
  ======================================================== */

  {
    name: 'Park Maintenance',
    category: 'Parks & Environment',
    department: 'Parks',
    financialYear: '2025-26',
    budgetLakhs: 80
  },

  {
    name: 'Tree Development / Plantation',
    category: 'Parks & Environment',
    department: 'Parks',
    financialYear: '2025-26',
    budgetLakhs: 30
  },

  {
    name: 'Playground Development',
    category: 'Parks & Environment',
    department: 'Parks',
    financialYear: '2025-26',
    budgetLakhs: 50
  },

  {
    name: 'Lakes / Parks / Gardens',
    category: 'Parks & Environment',
    department: 'Parks',
    financialYear: '2025-26',
    budgetLakhs: 120
  },

  {
    name: 'Greening / Development of Major Circles',
    category: 'Parks & Environment',
    department: 'Parks',
    financialYear: '2025-26',
    budgetLakhs: 50
  },


  /* =======================================================
     PUBLIC AMENITIES
  ======================================================== */

  {
    name: 'Public Toilet Repair / Maintenance',
    category: 'Public Amenities',
    department: 'Civic Amenities',
    financialYear: '2025-26',
    budgetLakhs: 120
  },

  {
    name: 'Class-II Toilet Development',
    category: 'Public Amenities',
    department: 'Civic Amenities',
    financialYear: '2025-26',
    budgetLakhs: 25
  },

  {
    name: 'Crematorium Development',
    category: 'Public Amenities',
    department: 'Civic Amenities',
    financialYear: '2025-26',
    budgetLakhs: 400
  },


  /* =======================================================
     HEALTH
  ======================================================== */

  {
    name: 'Night Hospital / Free Health Camp',
    category: 'Health',
    department: 'Health',
    financialYear: '2025-26',
    budgetLakhs: 10
  },

  {
    name: 'Health Awareness / IEC',
    category: 'Health',
    department: 'Health',
    financialYear: '2025-26',
    budgetLakhs: 30
  },

  {
    name: 'Fogging',
    category: 'Health',
    department: 'Health',
    financialYear: '2025-26',
    budgetLakhs: 10
  },

  {
    name: 'Poura Karmika Health Checkup / Insurance',
    category: 'Health',
    department: 'Health',
    financialYear: '2025-26',
    budgetLakhs: 30
  },


  /* =======================================================
     WELFARE
  ======================================================== */

  {
    name: 'SC / ST Welfare',
    category: 'Welfare',
    department: 'Welfare',
    financialYear: '2025-26',
    budgetLakhs: 160.48
  },

  {
    name: 'Urban Poor Welfare',
    category: 'Welfare',
    department: 'Welfare',
    financialYear: '2025-26',
    budgetLakhs: 48.28
  },

  {
    name: 'Physically Challenged Welfare',
    category: 'Welfare',
    department: 'Welfare',
    financialYear: '2025-26',
    budgetLakhs: 33.29
  }

];



/* =========================================================
   FORMAT MONEY
========================================================= */

function formatLakhs(value) {

  const amount =
    Number(value || 0);


  if (amount >= 100) {

    return `₹${(
      amount / 100
    ).toFixed(2)} Cr`;

  }


  return `₹${amount.toFixed(2)} L`;

}



/* =========================================================
   CALCULATE CATEGORY TOTAL
========================================================= */

function getCategoryTotal(
  projects,
  category
) {

  return projects

    .filter(
      p => p.category === category
    )

    .reduce(
      (sum, p) =>
        sum +
        Number(
          p.budgetLakhs || 0
        ),
      0
    );

}



/* =========================================================
   BUDGET SUMMARY
========================================================= */

function renderBudgetSummary(
  projects
) {

  const el =
    document.getElementById(
      'cp-budget-summary'
    );


  if (!el) return;


  const categories = [

    {
      name: 'Water',
      icon: '💧'
    },

    {
      name: 'Sewerage',
      icon: '🚰'
    },

    {
      name: 'Solid Waste Management',
      icon: '♻️'
    },

    {
      name: 'Roads',
      icon: '🛣️'
    },

    {
      name: 'Parks & Environment',
      icon: '🌳'
    },

    {
      name: 'Street Lighting',
      icon: '💡'
    },

    {
      name: 'Public Amenities',
      icon: '🏛️'
    },

    {
      name: 'Health',
      icon: '🏥'
    }

  ];


  el.innerHTML =
    categories.map(category => {

      const amount =
        getCategoryTotal(
          projects,
          category.name
        );


      return `

        <div class="cp-budget-card">

          <div class="icon">
            ${category.icon}
          </div>

          <div class="label">
            ${escapeHtml(
              category.name
            )}
          </div>

          <div class="amount">
            ${formatLakhs(amount)}
          </div>

          <div class="sub">
            Budget allocation
          </div>

        </div>

      `;

    }).join('');

}



/* =========================================================
   RENDER PROJECTS
========================================================= */

function renderProjects() {

  const yearSelect =
    document.getElementById(
      'cp-budget-year'
    );


  const categorySelect =
    document.getElementById(
      'cp-budget-category'
    );


  const el =
    document.getElementById(
      'cp-projects'
    );


  const count =
    document.getElementById(
      'cp-project-count'
    );


  if (
    !yearSelect ||
    !categorySelect ||
    !el
  ) {

    return;

  }


  const year =
    yearSelect.value;


  const category =
    categorySelect.value;


  let projects =
    BUDGET_PROJECTS.filter(
      p =>
        p.financialYear === year
    );


  if (category !== 'all') {

    projects =
      projects.filter(
        p =>
          p.category === category
      );

  }


  if (count) {

    count.textContent =
      `${projects.length} item${
        projects.length === 1
          ? ''
          : 's'
      }`;

  }


  if (!projects.length) {

    el.innerHTML = `

      <p class="cp-empty">

        No budget data available
        for this category and year yet.

      </p>

    `;

    return;

  }


  /*
    Largest allocations first
  */

  projects.sort(
    (a, b) =>
      Number(b.budgetLakhs || 0) -
      Number(a.budgetLakhs || 0)
  );


  el.innerHTML =
    projects.map(p => {

      return `

        <div class="cp-project-card">


          <div class="cp-project-top">


            <div>

              <div class="cp-project-name">

                ${escapeHtml(
                  p.name ||
                  'Untitled project'
                )}

              </div>


              <div class="cp-project-meta">

                ${escapeHtml(
                  p.category || ''
                )}

                ·

                ${escapeHtml(
                  p.department || ''
                )}

                ·

                ${escapeHtml(
                  p.financialYear || ''
                )}

              </div>

            </div>


            <div class="cp-budget-amount">

              <div class="value">

                ${formatLakhs(
                  p.budgetLakhs
                )}

              </div>

              <div class="label">

                allocated

              </div>

            </div>


          </div>


          <!-- Allocation indicator -->

          <div class="cp-budget-bar">

            <div
              class="cp-budget-bar-fill"
            ></div>

          </div>


          <span class="cp-budget-status">

            Budgeted

          </span>


        </div>

      `;

    }).join('');

}



/* =========================================================
   LOAD PROJECTS
========================================================= */

function loadProjects() {

  const yearSelect =
    document.getElementById(
      'cp-budget-year'
    );


  const categorySelect =
    document.getElementById(
      'cp-budget-category'
    );


  if (
    !yearSelect ||
    !categorySelect
  ) {

    return;

  }


  /*
    Start with 2025-26 because
    that is the budget dataset
    currently loaded here.
  */

  yearSelect.value =
    '2025-26';


  function refreshBudget() {

    const yearProjects =
      BUDGET_PROJECTS.filter(
        p =>
          p.financialYear ===
          yearSelect.value
      );


    renderBudgetSummary(
      yearProjects
    );


    renderProjects();

  }


  refreshBudget();


  yearSelect.addEventListener(
    'change',
    refreshBudget
  );


  categorySelect.addEventListener(
    'change',
    renderProjects
  );

}



/* =========================================================
   HTML ESCAPING
========================================================= */

function escapeHtml(text) {

  return String(
    text ?? ''
  )

    .replace(
      /&/g,
      '&amp;'
    )

    .replace(
      /</g,
      '&lt;'
    )

    .replace(
      />/g,
      '&gt;'
    )

    .replace(
      /"/g,
      '&quot;'
    )

    .replace(
      /'/g,
      '&#039;'
    );

}