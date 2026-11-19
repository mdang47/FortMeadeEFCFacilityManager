/* Personnel Management — the only frontend configuration.
 *
 * Rename the app by changing APP_NAME (and manifest.json, which the browser
 * reads on its own). API_URL is the public Apps Script web app. The spreadsheet
 * ID does not belong here. Set that only in the Apps Script project
 * (backend/Config.gs).
 *
 * Demo mode (fake people, this browser only):
 *   open any page with ?demo=1 (sticks for this tab), or set USE_MOCK to true.
 *   ?demo=0 clears the tab override and uses the settings below.
 */
var PM_CONFIG = {
  APP_NAME: 'Personnel Management',
  APP_SHORT_NAME: 'Personnel',
  TAGLINE: 'Status, leave, and personnel tools for the office',
  LOCATION_LINE: 'Your office',
  API_URL: 'https://script.google.com/macros/s/AKfycbxAq4wnk2TH_cDpf5d1DcRTNfXmTr8lddFkb-AqyasfxBELxMU8ODOaHxdj5Cnv8sVV/exec',
  USE_MOCK: false
};

function pmReadSearch() {
  try {
    if (typeof location === 'undefined' || !location) return '';
    return String(location.search || '');
  } catch (err) {
    return '';
  }
}

function pmReadDemoSticky() {
  try {
    if (typeof sessionStorage === 'undefined' || !sessionStorage) return '';
    return sessionStorage.getItem('pm-demo') || '';
  } catch (err) {
    return '';
  }
}

function pmWriteDemoSticky(value) {
  try {
    if (typeof sessionStorage === 'undefined' || !sessionStorage) return;
    if (value) sessionStorage.setItem('pm-demo', '1');
    else sessionStorage.removeItem('pm-demo');
  } catch (err) {}
}

/* search is the page query string. sticky is '1' when this tab already chose demo. */
function pmShouldUseMock(config, search, sticky) {
  var query = String(search || '');
  if (/[?&]demo=1(?:&|$)/.test(query)) return true;
  if (/[?&]demo=0(?:&|$)/.test(query)) {
    if (!config || config.USE_MOCK || !config.API_URL) return true;
    return false;
  }
  if (sticky === '1') return true;
  if (!config || config.USE_MOCK || !config.API_URL) return true;
  return false;
}

function pmUseMock() {
  var search = pmReadSearch();
  if (/[?&]demo=1(?:&|$)/.test(search)) pmWriteDemoSticky(true);
  else if (/[?&]demo=0(?:&|$)/.test(search)) pmWriteDemoSticky(false);
  var sticky = /[?&]demo=0(?:&|$)/.test(search) ? '' : pmReadDemoSticky();
  return pmShouldUseMock(PM_CONFIG, search, sticky);
}

if (typeof module === 'object' && module.exports) {
  module.exports = { pmShouldUseMock: pmShouldUseMock, PM_CONFIG: PM_CONFIG };
}
