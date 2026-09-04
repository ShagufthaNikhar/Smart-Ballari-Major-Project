// ===================================================================
//  Smart Ballari — runtime configuration
//
//  The API base URL used to be hard-coded as 'http://localhost:5000' in 30
//  separate files, which meant deploying involved editing 30 files and
//  missing one produced a page that silently failed against localhost.
//
//  This file is the only place that address exists now. It is loaded as a
//  plain <script> BEFORE every other script on every page, and publishes the
//  value on `window` so that classic scripts and ES modules can both read it
//  without an import.
//
//  To deploy: change API_PROD below. Nothing else.
// ===================================================================
(function () {
  'use strict';

  const API_DEV  = 'http://localhost:5000';
  const API_PROD = 'https://REPLACE-ME.onrender.com';   // ← set before deploying

  const host    = window.location.hostname;
  const isLocal = host === 'localhost' ||
                  host === '127.0.0.1' ||
                  host === '' ||                    // file:// during testing
                  host.startsWith('192.168.') ||    // phone on the same wifi
                  host.startsWith('10.');

  // Read this as window.SB_API. Deliberately NOT a bare top-level `const`:
  // app.js and every page script share one global scope, so a plain
  // `const SB_API` here would collide the moment anything else declared it.
  window.SB_API = isLocal ? API_DEV : API_PROD;

  if (isLocal) console.log('[Smart Ballari] API →', window.SB_API);
})();