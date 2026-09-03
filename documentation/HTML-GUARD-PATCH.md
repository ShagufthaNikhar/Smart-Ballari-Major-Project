# Adding guards to the dashboard pages

## 1. Every page must load as a module

`guard.js` and `firebase-config.js` are ES modules. A plain `<script src>`
cannot import them, so this fails silently and the guard never runs.

```diff
-  <script src="../js/app.js"></script>
-  <script src="../js/citizen-dashboard.js"></script>
+  <script type="module" src="../js/app.js"></script>
+  <script type="module" src="../js/citizen-dashboard.js"></script>
```

Apply to `citizen-dashboard.html`, `admin-dashboard.html`,
`officer-dashboard.html` and `city-dashboard.html`.

If `app.js` uses top-level `var`/`function` that other scripts rely on
globally, module scope will break that. Attach what is shared to `window`
explicitly, or leave `app.js` as a classic script and only modularise the
page-specific file.

## 2. Guard at the top of each page script

```js
// citizen-dashboard.js
import { guard, apiFetch } from './guard.js';

const me = await guard(['citizen']);
if (!me) throw new Error('redirecting');   // stop the rest of the file

document.getElementById('ch-name').textContent = me.name || me.email;
```

```js
// officer-dashboard.js
const me = await guard(['officer']);
```

```js
// admin-dashboard.js
const me = await guard(['admin']);
```

`city-dashboard.html` is public city data — no guard needed.

This is a UX guard. It stops a citizen landing on a blank broken admin page.
The real boundary is the 403 from the API, which is why it is safe that this
runs in the browser.

## 3. dashboard.html → officer-dashboard.html

Rename the file, then:

**Delete the shared-page machinery.** A page that hides an admin panel with
CSS is one devtools edit away from showing it:

```diff
-    /* Admin-only section */
-    .admin-only { display: none; }
```

```diff
-      <div id="admin-export" class="admin-only">
-        <button ... onclick="exportCSV()">⬇️ Export CSV</button>
-      </div>
```

Move Export CSV to `admin-dashboard.html`, where the page itself is
admin-guarded. Make sure the export uses `toAdminView`, not raw documents —
a CSV of raw issues is every citizen's email in one file.

**Delete the Reported By column.** An officer works the queue; they do not
need the reporter's email to fix a pothole.

```diff
             <th>Status</th>
-            <th>Reported By</th>
             <th>Date</th>
```

And in the drawer:

```diff
-      <div class="drawer-row"><span>Reported By</span><b id="d-by"></b></div>
```

**Add the missing statuses** to the filter:

```diff
       <select id="f-status">
         <option value="">All Status</option>
         <option value="open">Open</option>
+        <option value="accepted">Accepted</option>
+        <option value="in-progress">In Progress</option>
         <option value="resolved">Resolved</option>
+        <option value="rejected">Rejected</option>
       </select>
```

**Add the missing badge styles:**

```css
.badge-accepted    { background: #3b82f6; color: white;   }
.badge-in-progress { background: #f59e0b; color: #0f172a; }
.badge-rejected    { background: #64748b; color: white;   }
```

**Rewire the action buttons.** They currently call
`PATCH /api/issues/:id/status`, which no longer exists:

| Button | New call |
|---|---|
| Accept | `POST /api/officer/issues/{grievanceId}/accept` |
| In Progress | `PATCH /api/officer/issues/{grievanceId}/status` `{status:'in-progress'}` |
| Resolve | `POST /api/officer/issues/{grievanceId}/resolve` `{remarks, evidenceUrl}` |
| Delete | admin only — move to the admin dashboard |

Note these key on `grievanceId`, not `_id`.

## 4. admin-dashboard.html is missing your spec

It is a good city-ops view, but the admin module in your spec also needs:
Officers, Departments, Assign Complaints. Those map to endpoints that exist
now:

- `GET /api/admin/officers` — with `openIssues` workload per officer
- `GET /api/admin/departments`
- `POST /api/admin/issues/:grievanceId/assign`
- `POST /api/admin/issues/:grievanceId/reroute`
- `PATCH /api/admin/users/:id/role`

The reroute UI is the one worth building: `aiSuggestedCategory` vs
`category` tells you exactly which issues the classifier and the citizen
disagreed on.