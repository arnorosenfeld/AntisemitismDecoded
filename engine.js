// ═══ GITHUB CONFIG ═══
let ghConfig = { username:'', repo:'', token:'', branch:'main', filename:'index.html', password:'' };
let GD = null;
let sessionPassword = 'admin1234';

// ═══ DEFAULT GAME DATA (seeds editor on first use, before GitHub is connected) ═══
const DEFAULT_GD = EDITOR_DATA;

// ═══ LOGIN ═══
function doLogin() {
  const pw = document.getElementById('login-pw').value;
  if (pw === sessionPassword) {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('editor-screen').style.display = 'block';
    loadStoredConfig();
    const cached = localStorage.getItem('gd_cache');
    if (cached) {
      try { GD = JSON.parse(cached); sessionPassword = GD.config.editorPassword || sessionPassword; }
      catch(e) { GD = JSON.parse(JSON.stringify(DEFAULT_GD)); }
    } else {
      GD = JSON.parse(JSON.stringify(DEFAULT_GD));
      setTimeout(() => setStatus('Loaded default data. Pull from GitHub to edit live data.', 'saving'), 100);
    }
    populateAllPanels();
  } else {
    document.getElementById('login-error').textContent = 'Incorrect password.';
  }
}
function logout() {
  document.getElementById('login-screen').style.display = '';
  document.getElementById('editor-screen').style.display = 'none';
  document.getElementById('login-pw').value = '';
  document.getElementById('login-error').textContent = '';
}

// ═══ GITHUB CONFIG STORAGE ═══
function loadStoredConfig() {
  const stored = localStorage.getItem('gh_config');
  if (stored) {
    try {
      ghConfig = { ...ghConfig, ...JSON.parse(stored) };
      document.getElementById('gh-username').value = ghConfig.username || '';
      document.getElementById('gh-repo').value = ghConfig.repo || '';
      document.getElementById('gh-token').value = ghConfig.token || '';
    } catch(e) {}
  }
  updateGhStatusLine();
  // Show restore indicator
  const sfLine = document.getElementById('sf-status-line');
  const cached = localStorage.getItem('gd_cache');
  if (sfLine && cached) sfLine.textContent = 'Restored from cache';
}
function updateGhStatusLine() {
  const el = document.getElementById('sf-status-line');
  if (!el) return;
  if (ghConfig.username && ghConfig.repo) {
    el.textContent = ghConfig.username + '/' + ghConfig.repo;
  } else {
    el.textContent = 'No saved data yet';
  }
}
function toggleGhSettings() {
  const panel = document.getElementById('gh-settings-panel');
  panel.classList.toggle('open');
  // Load config values when opening
  if (panel.classList.contains('open')) {
    document.getElementById('gh-username').value = ghConfig.username || '';
    document.getElementById('gh-repo').value = ghConfig.repo || '';
    document.getElementById('gh-token').value = ghConfig.token || '';
  }
}
function clearGithubConfig() {
  if (!confirm('Clear all GitHub settings?')) return;
  ghConfig = { username:'', repo:'', token:'', branch:'main', filename:'index.html', password:'' };
  localStorage.removeItem('gh_config');
  document.getElementById('gh-username').value = '';
  document.getElementById('gh-repo').value = '';
  document.getElementById('gh-token').value = '';
  updateGhStatusLine();
  setStatus('GitHub config cleared.', 'success');
}
function updatePassword() {
  const np = document.getElementById('gh-pw-new').value;
  const cp = document.getElementById('gh-pw-confirm').value;
  if (!np) { setStatus('Enter a new password.', 'error'); return; }
  if (np !== cp) { setStatus('Passwords do not match.', 'error'); return; }
  if (!GD) { setStatus('No game data loaded.', 'error'); return; }
  GD.config.editorPassword = np;
  sessionPassword = np;
  localStorage.setItem('gd_cache', JSON.stringify(GD));
  document.getElementById('gh-pw-success').classList.add('show');
  document.getElementById('gh-pw-new').value = '';
  document.getElementById('gh-pw-confirm').value = '';
  setTimeout(() => document.getElementById('gh-pw-success').classList.remove('show'), 6000);
}
function exportCodeOnly() {
  if (!GD) { setStatus('No game data loaded.', 'error'); return; }
  // Download just the GAME_DATA as a JS snippet
  const blob = new Blob(['const GAME_DATA = ' + JSON.stringify(GD, null, 2) + ';'], {type: 'text/javascript'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'game-data.js';
  a.click();
}
function resetToDefaults() {
  if (!confirm('Reset all game data to built-in defaults? This cannot be undone.')) return;
  GD = JSON.parse(JSON.stringify(DEFAULT_GD));
  localStorage.setItem('gd_cache', JSON.stringify(GD));
  populateAllPanels();
  setStatus('Reset to defaults.', 'success');
}
function saveGithubConfig() {
  ghConfig.username = document.getElementById('gh-username').value.trim();
  ghConfig.repo = document.getElementById('gh-repo').value.trim();
  ghConfig.token = document.getElementById('gh-token').value.trim();
  ghConfig.branch = 'main';
  ghConfig.filename = 'index.html';
  localStorage.setItem('gh_config', JSON.stringify(ghConfig));
  updateGhStatusLine();
  setStatus('GitHub settings saved.', 'success');
}

// ═══ GITHUB API ═══
async function loadFromGithub() {
  if (!ghConfig.username || !ghConfig.repo || !ghConfig.token) { setStatus('Fill in GitHub config first.', 'error'); return; }
  setStatus('Pulling from GitHub...', 'saving');
  try {
    const url = `https://api.github.com/repos/${ghConfig.username}/${ghConfig.repo}/contents/${ghConfig.filename}?ref=${ghConfig.branch}`;
    const res = await fetch(url, { headers: { Authorization: `token ${ghConfig.token}`, Accept: 'application/vnd.github.v3+json' } });
    if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
    const data = await res.json();
    const content = atob(data.content.replace(/\n/g,''));
    GD = extractGameData(content);
    if (!GD) throw new Error('Could not find GAME_DATA block in file.');
    sessionPassword = GD.config.editorPassword || sessionPassword;
    if (ghConfig.password) GD.config.editorPassword = ghConfig.password;
    localStorage.setItem('gd_cache', JSON.stringify(GD));
    populateAllPanels();
    setStatus('Loaded from GitHub ✓', 'success');
  } catch(e) { setStatus('Error: ' + e.message, 'error'); }
}

function extractGameData(html) {
  const match = html.match(/\/\* GAME_DATA_START \*\/([\s\S]*?)\/\* GAME_DATA_END \*\//);
  if (!match) return null;
  const jsStr = match[1].replace(/^\s*const GAME_DATA\s*=\s*/, '').replace(/;\s*$/, '').trim();
  try { return JSON.parse(jsStr); } catch(e) {
    try { return (new Function('return ' + jsStr))(); } catch(e2) { return null; }
  }
}

async function saveToGithub() {
  if (!ghConfig.username || !ghConfig.repo || !ghConfig.token) { toggleGhSettings(); setStatus('Configure GitHub settings first.', 'error'); return; }
  if (!GD) { setStatus('No game data loaded. Pull from GitHub first.', 'error'); return; }
  if (ghConfig.password) GD.config.editorPassword = ghConfig.password;
  const btn = document.getElementById('publish-btn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Publishing…'; }
  setStatus('Publishing to GitHub...', 'saving');
  try {
    const url = `https://api.github.com/repos/${ghConfig.username}/${ghConfig.repo}/contents/${ghConfig.filename}?ref=${ghConfig.branch}`;
    const getRes = await fetch(url, { headers: { Authorization: `token ${ghConfig.token}`, Accept: 'application/vnd.github.v3+json' } });
    if (!getRes.ok) throw new Error(`GitHub API error: ${getRes.status}`);
    const fileData = await getRes.json();
    const sha = fileData.sha;
    const currentContent = atob(fileData.content.replace(/\n/g,''));
    const newDataBlock = `/* GAME_DATA_START */\nconst GAME_DATA = ${JSON.stringify(GD, null, 2)};\n/* GAME_DATA_END */`;
    const newContent = currentContent.replace(/\/\* GAME_DATA_START \*\/[\s\S]*?\/\* GAME_DATA_END \*\//, newDataBlock);
    const putRes = await fetch(url, {
      method: 'PUT',
      headers: { Authorization: `token ${ghConfig.token}`, Accept: 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Update game data via editor', content: btoa(unescape(encodeURIComponent(newContent))), sha, branch: ghConfig.branch })
    });
    if (!putRes.ok) { const e = await putRes.json(); throw new Error(`Push error: ${putRes.status} — ${e.message}`); }
    localStorage.setItem('gd_cache', JSON.stringify(GD));
    setStatus('✓ Published! Live in ~60s.', 'success');
    const sfLine = document.getElementById('sf-status-line');
    if (sfLine) sfLine.textContent = 'Published: ' + new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
  } catch(e) { setStatus('Error: ' + e.message, 'error'); } finally {
    const btn = document.getElementById('publish-btn');
    if (btn) { btn.disabled = false; btn.textContent = '🚀 Publish to GitHub'; }
  }
}

function setStatus(msg, type) {
  const el = document.getElementById('status-msg');
  if (el) { el.textContent = msg; el.className = 'status-msg status-' + type; }
  if (type === 'success') { if (el) setTimeout(() => { el.textContent = ''; }, 5000); }
  // Also show a toast notification
  showToast(msg, type === 'success' ? 'ok' : type === 'error' ? 'err' : 'info');
  // Update sidebar status line
  const sfLine = document.getElementById('sf-status-line');
  if (sfLine && type === 'success') sfLine.textContent = msg;
}

function showToast(msg, type) {
  let toast = document.getElementById('publish-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'publish-toast';
    toast.className = 'publish-toast';
    document.body.appendChild(toast);
  }
  toast.className = 'publish-toast ' + (type||'info');
  toast.textContent = msg;
  toast.style.opacity = '1';
  clearTimeout(toast._t);
  if (type !== 'info') toast._t = setTimeout(() => { toast.style.opacity = '0'; }, 5000);
}

// ═══ PANEL NAVIGATION ═══
const PANEL_TITLES = {
  github: 'GitHub / Save', config: 'Global Config', traits: 'Character Traits', avatars: 'Emoji Avatars',
  orgs: 'Local Organizations', 'nat-orgs': 'National Organizations', missions: 'Missions',
  actions: 'Actions', scenarios: 'Scenarios / Events', inbox: 'Inbox Scenarios',
  scoring: 'Scoring Thresholds', text: 'Page Text', stats: 'Stat Configuration',
  advisors: 'Advisor Pool', gazette: 'Jewish Gazette', breaking: 'Breaking News', coalitions: 'Coalition Offers',
  conversations: 'Conversations'
};
function showPanel(id, navEl) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('panel-' + id).classList.add('active');
  if (navEl) navEl.classList.add('active');
  document.getElementById('panel-title').textContent = PANEL_TITLES[id] || id;
}

// ═══ POPULATE ALL ═══

// ═══ POPULATE ALL ═══
function populateAllPanels() {
  populateConfig(); populateTraits(); populateAvatars();
  populateOrgs(); populateNatOrgs(); populateMissions();
  populateActions(); populateScenarios(); populateInbox();
  populateScoring(); populateText(); populateStats();
}

// ═══ CONFIG ═══
function populateConfig() {
  const c = GD.config;
  document.getElementById('cfg-gameTitle').value = c.gameTitle || '';
  document.getElementById('cfg-totalRounds').value = c.totalRounds || 6;
  document.getElementById('cfg-actionPointsPerRound').value = c.actionPointsPerRound || 3;
  document.getElementById('cfg-startingBudget').value = c.startingBudget || 500000;
  document.getElementById('cfg-traitsToSelect').value = c.traitsToSelect || 2;
  document.getElementById('cfg-priorityTotal').value = c.priorityTotal || 150;
  document.getElementById('cfg-priorityMin').value = c.priorityMin || 10;
  document.getElementById('cfg-priorityMax').value = c.priorityMax || 70;
  document.getElementById('cfg-missionStartStars').value = c.missionStartStars || 3;
  document.getElementById('cfg-missionMaxStars').value = c.missionMaxStars || 5;
  document.getElementById('cfg-failureBarThreshold').value = c.failureBarThreshold || 20;
  document.getElementById('cfg-failureScoreThreshold').value = c.failureScoreThreshold || 40;
  document.getElementById('cfg-promotionThreshold').value = c.promotionThreshold || 80;
  document.getElementById('cfg-inboxPerRound').value = c.inboxPerRound || 2;
  document.getElementById('cfg-missionStarPoints').value = c.missionStarPoints || 5;
  // Budget system config
  const bc = c.budgetConfig || {};
  document.getElementById('cfg-bc-startingBudget').value = bc.startingBudget || 100;
  document.getElementById('cfg-bc-operatingCostPerRound').value = bc.operatingCostPerRound || 8;
  document.getElementById('cfg-bc-baseIncomePerRound').value = bc.baseIncomePerRound || 5;
  document.getElementById('cfg-bc-fundraisingIncomeMultiplier').value = bc.fundraisingIncomeMultiplier || 0.12;
  const w = c.scoreWeights || {};
  const swEl = document.getElementById('score-weights-inputs');
  if(swEl) {
    swEl.innerHTML = (GD.stats||[]).map(s => `<div class="stat-input-group"><label>${s.label}</label><input type="number" step="0.05" id="cfg-w-${s.id}" value="${w[s.id]||0.25}" min="0" max="1" /></div>`).join('');
  }
  renderRoundNamesEditor();
  // Advisor config
  var advSlotsEl = document.getElementById('cfg-advisorSlots');
  if(advSlotsEl) advSlotsEl.value = c.advisorSlots || 3;
  var advStackEl = document.getElementById('cfg-advisorBonusStacking');
  if(advStackEl) advStackEl.value = c.advisorBonusStacking || 'best';
}

function renderRoundNamesEditor() {
  const rn = GD.config.roundNames || [];
  document.getElementById('round-names-list').innerHTML = rn.map((r,i) => `
    <div class="form-row five" style="margin-bottom:6px;align-items:end">
      <div class="form-group"><label>Year</label><input id="rn-year-${i}" value="${esc(r.year||'')}" /></div>
      <div class="form-group"><label>Round</label><input id="rn-round-${i}" value="${esc(r.round||'')}" /></div>
      <div class="form-group"><label>Hebrew</label><input id="rn-heb-${i}" value="${esc(r.hebrew||'')}" /></div>
      <div class="form-group"><label>English</label><input id="rn-eng-${i}" value="${esc(r.english||'')}" /></div>
      <div><button class="btn btn-danger btn-sm" onclick="deleteRoundName(${i})">×</button></div>
    </div>`).join('');
}

function addRoundName() {
  if(!GD.config.roundNames) GD.config.roundNames = [];
  GD.config.roundNames.push({year:'',round:'',hebrew:'',english:''});
  renderRoundNamesEditor();
}
function deleteRoundName(i) {
  GD.config.roundNames.splice(i,1);
  renderRoundNamesEditor();
}

function saveConfig() {
  const c = GD.config;
  c.gameTitle = document.getElementById('cfg-gameTitle').value;
  c.totalRounds = parseInt(document.getElementById('cfg-totalRounds').value) || 6;
  c.actionPointsPerRound = parseInt(document.getElementById('cfg-actionPointsPerRound').value) || 3;
  c.startingBudget = parseInt(document.getElementById('cfg-startingBudget').value) || 500000;
  c.traitsToSelect = parseInt(document.getElementById('cfg-traitsToSelect').value) || 2;
  c.priorityTotal = parseInt(document.getElementById('cfg-priorityTotal').value) || 150;
  c.priorityMin = parseInt(document.getElementById('cfg-priorityMin').value) || 10;
  c.priorityMax = parseInt(document.getElementById('cfg-priorityMax').value) || 70;
  c.missionStartStars = parseInt(document.getElementById('cfg-missionStartStars').value) || 3;
  c.missionMaxStars = parseInt(document.getElementById('cfg-missionMaxStars').value) || 5;
  c.failureBarThreshold = parseInt(document.getElementById('cfg-failureBarThreshold').value) || 20;
  c.failureScoreThreshold = parseInt(document.getElementById('cfg-failureScoreThreshold').value) || 40;
  c.promotionThreshold = parseInt(document.getElementById('cfg-promotionThreshold').value) || 80;
  c.inboxPerRound = parseInt(document.getElementById('cfg-inboxPerRound').value) || 2;
  c.missionStarPoints = parseInt(document.getElementById('cfg-missionStarPoints').value) || 5;
  // Budget system config
  if(!c.budgetConfig) c.budgetConfig = {};
  c.budgetConfig.startingBudget = parseInt(document.getElementById('cfg-bc-startingBudget').value) || 100;
  c.budgetConfig.operatingCostPerRound = parseInt(document.getElementById('cfg-bc-operatingCostPerRound').value) || 8;
  c.budgetConfig.baseIncomePerRound = parseInt(document.getElementById('cfg-bc-baseIncomePerRound').value) || 5;
  c.budgetConfig.fundraisingIncomeMultiplier = parseFloat(document.getElementById('cfg-bc-fundraisingIncomeMultiplier').value) || 0.12;
  // Score weights
  c.scoreWeights = {};
  (GD.stats||[]).forEach(s => {
    const el = document.getElementById('cfg-w-'+s.id);
    if(el) c.scoreWeights[s.id] = parseFloat(el.value) || 0.25;
  });
  // Round names
  const rn = [];
  let ri = 0;
  while(document.getElementById('rn-year-'+ri)) {
    rn.push({year:document.getElementById('rn-year-'+ri).value,round:document.getElementById('rn-round-'+ri).value,hebrew:document.getElementById('rn-heb-'+ri).value,english:document.getElementById('rn-eng-'+ri).value});
    ri++;
  }
  c.roundNames = rn;
  // Advisor config
  var advSlotsEl = document.getElementById('cfg-advisorSlots');
  if(advSlotsEl) c.advisorSlots = parseInt(advSlotsEl.value) || 3;
  var advStackEl = document.getElementById('cfg-advisorBonusStacking');
  if(advStackEl) c.advisorBonusStacking = advStackEl.value || 'best';
  localStorage.setItem('gd_cache', JSON.stringify(GD));
  setStatus('Config saved.', 'success');
}

// ═══ TRAITS ═══
function populateTraits() {
  document.getElementById('traits-list').innerHTML = GD.characterTraits.map((t,i) => renderTraitCard(t,i) + renderTraitForm(t,i)).join('');
}
function renderTraitCard(t, i) {
  return `<div class="item-card" id="tr-card-${i}" onclick="toggleEdit('tr',${i})">
    <span class="expand-icon" id="tr-exp-${i}">▸</span>
    <div class="item-card-info">
      <div class="item-card-name">${esc(t.name)}</div>
      <div class="item-card-desc">${esc(t.description).substring(0,80)}</div>
    </div>
    <div class="item-card-actions"><button class="btn btn-danger btn-sm" onclick="event.stopPropagation();deleteTrait(${i})">Delete</button></div>
  </div>`;
}
function renderTraitForm(t, i) {
  const stats = GD.stats || [];
  return `<div class="item-edit-form" id="tr-form-${i}" style="display:none">
    <div class="form-row"><div class="form-group"><label>Name</label><input id="tr-name-${i}" value="${esc(t.name)}" /></div><div class="form-group"><label>Description</label><input id="tr-desc-${i}" value="${esc(t.description)}" /></div></div>
    <div class="form-group" style="margin-bottom:8px"><label>Unlocks Choices (comma-sep IDs)</label><input id="tr-unlocks-${i}" value="${(t.unlocksChoices||[]).join(',')}" /></div>
    <div class="stat-inputs cols-4" style="margin-bottom:11px">
      ${stats.map(s=>`<div class="stat-input-group"><label>${s.label}</label><input type="number" id="tr-fx-${i}-${s.id}" value="${(t.statModifiers||{})[s.id]||0}" /></div>`).join('')}
    </div>
    <button class="btn btn-primary btn-sm" onclick="saveTrait(${i})">Save</button>
  </div>`;
}
function saveTrait(i) {
  const t = GD.characterTraits[i];
  t.name = document.getElementById('tr-name-'+i).value;
  t.description = document.getElementById('tr-desc-'+i).value;
  t.unlocksChoices = document.getElementById('tr-unlocks-'+i).value.split(',').map(s=>s.trim()).filter(Boolean);
  t.statModifiers = {};
  (GD.stats||[]).forEach(s => { const v = parseInt(document.getElementById('tr-fx-'+i+'-'+s.id)?.value)||0; if(v!==0) t.statModifiers[s.id]=v; });
  localStorage.setItem('gd_cache', JSON.stringify(GD)); setStatus('Trait saved.','success'); populateTraits();
}
function deleteTrait(i) { if(!confirm('Delete?'))return; GD.characterTraits.splice(i,1); localStorage.setItem('gd_cache',JSON.stringify(GD)); populateTraits(); }
function addTrait() {
  GD.characterTraits.push({id:'trait_'+Date.now(),name:'New Trait',description:'',statModifiers:{},unlocksChoices:[]});
  localStorage.setItem('gd_cache',JSON.stringify(GD)); populateTraits();
}

// ═══ AVATARS ═══
function populateAvatars() { document.getElementById('avatars-textarea').value=(GD.avatarEmojis||[]).join('\n'); }
function saveAvatars() {
  GD.avatarEmojis = document.getElementById('avatars-textarea').value.split('\n').map(s=>s.trim()).filter(Boolean);
  localStorage.setItem('gd_cache',JSON.stringify(GD)); setStatus('Avatars saved.','success');
}

// ═══ ORGS ═══
function populateOrgs() {
  document.getElementById('orgs-list').innerHTML = GD.organizations.map((o,i) => renderOrgCard(o,i,'org') + renderOrgForm(o,i,'org')).join('');
}
function renderOrgCard(o, i, prefix) {
  const raw = o.scenarioCategories||o.politicalTilt||[];
  const cats = (Array.isArray(raw)?raw:[raw]).join(', ');
  return `<div class="item-card" id="${prefix}-card-${i}" onclick="toggleEdit('${prefix}',${i})">
    <span class="expand-icon" id="${prefix}-exp-${i}">▸</span>
    <div class="item-card-info">
      <div class="item-card-name">${esc(o.name)}</div>
      <div class="item-card-desc">${o.badge} · ${cats}</div>
    </div>
  </div>`;
}
function renderOrgForm(o, i, prefix) {
  const stats = GD.stats || [];
  const tilt = Array.isArray(o.politicalTilt) ? o.politicalTilt[0] : (o.politicalTilt||'center');
  const scats = o.scenarioCategories || [];
  return `<div class="item-edit-form" id="${prefix}-form-${i}" style="display:none">
    <div class="form-row three">
      <div class="form-group"><label>ID</label><input id="${prefix}-id-${i}" value="${esc(o.id)}" /></div>
      <div class="form-group"><label>Name</label><input id="${prefix}-name-${i}" value="${esc(o.name)}" /></div>
      <div class="form-group"><label>Badge</label><input id="${prefix}-badge-${i}" value="${esc(o.badge)}" /></div>
    </div>
    <div class="form-group" style="margin-bottom:11px"><label>Description</label><textarea id="${prefix}-desc-${i}" rows="2">${esc(o.description)}</textarea></div>
    <div class="form-group" style="margin-bottom:11px"><label>Traits (one per line)</label><textarea id="${prefix}-traits-${i}" rows="2">${(o.traits||[]).join('\n')}</textarea></div>
    <div class="form-row">
      <div class="form-group"><label>Political Tilt</label>
        <select id="${prefix}-tilt-${i}"><option value="left" ${tilt==='left'?'selected':''}>Left</option><option value="center" ${tilt==='center'?'selected':''}>Center</option><option value="right" ${tilt==='right'?'selected':''}>Right</option><option value="apolitical" ${tilt==='apolitical'?'selected':''}>Apolitical</option></select>
      </div>
      <div class="form-group"><label>Badge Class</label><input id="${prefix}-badgeClass-${i}" value="${esc(o.badgeClass||'')}" /></div>
    </div>
    <div class="form-group" style="margin-bottom:11px"><label>Scenario Categories</label>
      <div class="checkbox-grid">
        <label class="checkbox-item"><input type="checkbox" id="${prefix}-scat-${i}-progressive" ${scats.includes('progressive')?'checked':''} />Progressive</label>
        <label class="checkbox-item"><input type="checkbox" id="${prefix}-scat-${i}-centrist" ${scats.includes('centrist')?'checked':''} />Centrist</label>
        <label class="checkbox-item"><input type="checkbox" id="${prefix}-scat-${i}-conservative" ${scats.includes('conservative')?'checked':''} />Conservative</label>
        <label class="checkbox-item"><input type="checkbox" id="${prefix}-scat-${i}-apolitical" ${scats.includes('apolitical')?'checked':''} />Apolitical</label>
      </div>
    </div>
    <div class="form-row"><div class="form-group"><label>Starting Budget</label><input type="number" id="${prefix}-budget-${i}" value="${o.startingBudget||500000}" /></div>
    <div class="form-group"><label>Promo Eligible (comma-sep)</label><input id="${prefix}-promo-${i}" value="${(o.promotionEligible||[]).join(',')}" /></div></div>
    <div class="form-row three" style="margin-bottom:11px">
      <div class="form-group"><label>Budget Override: Starting</label><input type="number" id="${prefix}-bo-start-${i}" value="${(o.budgetOverrides||{}).startingBudget||''}" placeholder="Default: 100" /></div>
      <div class="form-group"><label>Budget Override: Op Cost/Rnd</label><input type="number" id="${prefix}-bo-opcost-${i}" value="${(o.budgetOverrides||{}).operatingCost||''}" placeholder="Default: 8" /></div>
      <div class="form-group"><label>Budget Override: Base Income</label><input type="number" id="${prefix}-bo-income-${i}" value="${(o.budgetOverrides||{}).baseIncome||''}" placeholder="Default: 5" /></div>
    </div>
    <div class="form-group" style="margin-bottom:11px"><label>Allowed Missions (comma-sep IDs)</label><input id="${prefix}-missions-${i}" value="${(o.allowedMissions||[]).join(',')}" /></div>
    <div class="stat-inputs cols-4" style="margin-bottom:11px">
      ${stats.map(s=>`<div class="stat-input-group"><label>${s.label}</label><input type="number" id="${prefix}-fx-${i}-${s.id}" value="${(o.statModifiers||{})[s.id]||0}" /></div>`).join('')}
    </div>
    ${renderSegWeightsEditor(o, i, prefix)}
    <button class="btn btn-primary btn-sm" onclick="saveOrg(${i},'${prefix}')">Save</button>
  </div>`;
}
function saveOrg(i, prefix) {
  const list = prefix === 'org' ? GD.organizations : GD.nationalOrganizations;
  const o = list[i];
  o.id = document.getElementById(prefix+'-id-'+i).value;
  o.name = document.getElementById(prefix+'-name-'+i).value;
  o.badge = document.getElementById(prefix+'-badge-'+i).value;
  o.badgeClass = document.getElementById(prefix+'-badgeClass-'+i).value;
  o.description = document.getElementById(prefix+'-desc-'+i).value;
  o.traits = document.getElementById(prefix+'-traits-'+i).value.split('\n').filter(Boolean);
  o.politicalTilt = [document.getElementById(prefix+'-tilt-'+i).value];
  o.startingBudget = parseInt(document.getElementById(prefix+'-budget-'+i).value)||500000;
  // Budget overrides
  var boStart = parseInt(document.getElementById(prefix+'-bo-start-'+i)?.value);
  var boOp = parseInt(document.getElementById(prefix+'-bo-opcost-'+i)?.value);
  var boInc = parseInt(document.getElementById(prefix+'-bo-income-'+i)?.value);
  if(boStart || boOp || boInc) { o.budgetOverrides = {}; if(boStart) o.budgetOverrides.startingBudget = boStart; if(boOp) o.budgetOverrides.operatingCost = boOp; if(boInc) o.budgetOverrides.baseIncome = boInc; }
  else { delete o.budgetOverrides; }
  o.promotionEligible = document.getElementById(prefix+'-promo-'+i)?.value.split(',').map(s=>s.trim()).filter(Boolean) || [];
  o.allowedMissions = document.getElementById(prefix+'-missions-'+i)?.value.split(',').map(s=>s.trim()).filter(Boolean) || [];
  const allCats = ['progressive','centrist','conservative','apolitical'];
  o.scenarioCategories = allCats.filter(c => document.getElementById(prefix+'-scat-'+i+'-'+c)?.checked);
  o.statModifiers = {};
  (GD.stats||[]).forEach(s => { const v = parseInt(document.getElementById(prefix+'-fx-'+i+'-'+s.id)?.value)||0; if(v!==0) o.statModifiers[s.id]=v; });
  localStorage.setItem('gd_cache',JSON.stringify(GD)); setStatus('Org saved.','success');
  if(prefix==='org') populateOrgs(); else populateNatOrgs();
}

// ═══ NAT ORGS ═══
function populateNatOrgs() {
  document.getElementById('nat-orgs-list').innerHTML = GD.nationalOrganizations.map((o,i) => renderOrgCard(o,i,'norg') + renderOrgForm(o,i,'norg')).join('');
}
function deleteNatOrg(i) { if(!confirm('Delete?'))return; GD.nationalOrganizations.splice(i,1); localStorage.setItem('gd_cache',JSON.stringify(GD)); populateNatOrgs(); }
function addNatOrg() {
  GD.nationalOrganizations.push({id:'nat_'+Date.now(),name:'New Nat Org',badge:'National',badgeClass:'badge-center',description:'',traits:[],statModifiers:{},allowedMissions:[],politicalTilt:['center'],scenarioCategories:['centrist'],startingBudget:2000000,orgLevel:'national'});
  localStorage.setItem('gd_cache',JSON.stringify(GD)); populateNatOrgs();
}

// ═══ MISSIONS ═══
function populateMissions() {
  document.getElementById('missions-list').innerHTML = GD.missions.map((m,i) => renderMissionCard(m,i) + renderMissionForm(m,i)).join('');
}
function renderMissionCard(m, i) {
  return `<div class="item-card" id="mis-card-${i}" onclick="toggleEdit('mis',${i})">
    <span class="expand-icon" id="mis-exp-${i}">▸</span>
    <div class="item-card-info"><div class="item-card-name">${esc(m.name)}</div><div class="item-card-desc">${esc(m.description).substring(0,80)}</div></div>
    <div class="item-card-actions"><button class="btn btn-danger btn-sm" onclick="event.stopPropagation();deleteMission(${i})">Delete</button></div>
  </div>`;
}
function renderMissionForm(m, i) {
  const stats = GD.stats || [];
  return `<div class="item-edit-form" id="mis-form-${i}" style="display:none">
    <div class="form-row"><div class="form-group"><label>ID</label><input id="mis-id-${i}" value="${esc(m.id)}" /></div><div class="form-group"><label>Name</label><input id="mis-name-${i}" value="${esc(m.name)}" /></div></div>
    <div class="form-group" style="margin-bottom:11px"><label>Description</label><textarea id="mis-desc-${i}" rows="2">${esc(m.description)}</textarea></div>
    <div class="form-group" style="margin-bottom:11px"><label>Available To (comma-sep org IDs)</label><input id="mis-avail-${i}" value="${(m.availableTo||[]).join(',')}" /></div>
    <div class="stat-inputs cols-4" style="margin-bottom:11px">
      ${stats.map(s=>`<div class="stat-input-group"><label>${s.label} bonus</label><input type="number" id="mis-fx-${i}-${s.id}" value="${(m.statBonus||{})[s.id]||0}" /></div>`).join('')}
    </div>
    <button class="btn btn-primary btn-sm" onclick="saveMission(${i})">Save</button>
  </div>`;
}
function saveMission(i) {
  const m = GD.missions[i];
  m.id = document.getElementById('mis-id-'+i).value;
  m.name = document.getElementById('mis-name-'+i).value;
  m.description = document.getElementById('mis-desc-'+i).value;
  m.availableTo = document.getElementById('mis-avail-'+i).value.split(',').map(s=>s.trim()).filter(Boolean);
  m.statBonus = {};
  (GD.stats||[]).forEach(s => { const v = parseInt(document.getElementById('mis-fx-'+i+'-'+s.id)?.value)||0; if(v!==0) m.statBonus[s.id]=v; });
  localStorage.setItem('gd_cache',JSON.stringify(GD)); setStatus('Mission saved.','success'); populateMissions();
}
function deleteMission(i) { if(!confirm('Delete?'))return; GD.missions.splice(i,1); localStorage.setItem('gd_cache',JSON.stringify(GD)); populateMissions(); }
function addMission() {
  GD.missions.push({id:'mission_'+Date.now(),name:'New Mission',description:'',availableTo:[],statBonus:{}});
  localStorage.setItem('gd_cache',JSON.stringify(GD)); populateMissions();
}

// ═══ ACTIONS ═══ (#1: add/delete)
function populateActions() {
  document.getElementById('actions-list').innerHTML = GD.actions.map((a,i) => renderActionCard(a,i) + renderActionForm(a,i)).join('');
}
function renderActionCard(a, i) {
  return `<div class="item-card" id="act-card-${i}" onclick="toggleEdit('act',${i})">
    <span class="expand-icon" id="act-exp-${i}">▸</span>
    <div class="item-card-info"><div class="item-card-name">${a.icon} ${esc(a.name)}</div><div class="item-card-desc">${esc(a.description).substring(0,80)}</div></div>
    <div class="item-card-actions"><button class="btn btn-danger btn-sm" onclick="event.stopPropagation();deleteAction(${i})">Delete</button></div>
  </div>`;
}
function renderActionForm(a, i) {
  const stats = GD.stats || [];
  return `<div class="item-edit-form" id="act-form-${i}" style="display:none">
    <div class="form-row three"><div class="form-group"><label>Name</label><input id="act-name-${i}" value="${esc(a.name)}" /></div><div class="form-group"><label>Icon</label><input id="act-icon-${i}" value="${esc(a.icon)}" /></div><div class="form-group"><label>AP Cost</label><input type="number" id="act-cost-${i}" value="${a.cost||1}" min="1" max="5" /></div></div>
    <div class="form-group" style="margin-bottom:11px"><label>Budget Cost (0 = free)</label><input type="number" id="act-bcost-${i}" value="${a.budgetCost||0}" min="0" /></div>
    <div class="form-group" style="margin-bottom:11px"><label>Description</label><textarea id="act-desc-${i}" rows="2">${esc(a.description)}</textarea></div>
    <div class="form-group" style="margin-bottom:11px"><label>Outcome Text</label><textarea id="act-outcome-${i}" rows="2">${esc(a.outcomeText||'')}</textarea></div>
    <div class="form-group" style="margin-bottom:11px"><label>Triggers Event Type</label><input id="act-trigger-${i}" value="${esc(a.triggersEventType||'community')}" /></div>
    <div class="stat-inputs cols-4" style="margin-bottom:11px">
      ${stats.map(s=>`<div class="stat-input-group"><label>${s.label}</label><input type="number" id="act-fx-${i}-${s.id}" value="${(a.baseEffects||{})[s.id]||0}" /></div>`).join('')}
    </div>
    <button class="btn btn-primary btn-sm" onclick="saveAction(${i})">Save</button>
  </div>`;
}
function saveAction(i) {
  const a = GD.actions[i];
  a.name = document.getElementById('act-name-'+i).value;
  a.icon = document.getElementById('act-icon-'+i).value;
  a.cost = parseInt(document.getElementById('act-cost-'+i).value)||1;
  a.budgetCost = parseInt(document.getElementById('act-bcost-'+i).value)||0;
  a.description = document.getElementById('act-desc-'+i).value;
  a.outcomeText = document.getElementById('act-outcome-'+i).value;
  a.triggersEventType = document.getElementById('act-trigger-'+i).value;
  a.baseEffects = {};
  (GD.stats||[]).forEach(s => { const v = parseInt(document.getElementById('act-fx-'+i+'-'+s.id)?.value)||0; if(v!==0) a.baseEffects[s.id]=v; });
  localStorage.setItem('gd_cache',JSON.stringify(GD)); setStatus('Action saved.','success'); populateActions();
}
function addAction() {
  GD.actions.push({id:'action_'+Date.now(),name:'New Action',icon:'⚡',description:'',cost:1,baseEffects:{},outcomeText:'',triggersEventType:'community'});
  localStorage.setItem('gd_cache',JSON.stringify(GD)); populateActions();
}
function deleteAction(i) { if(!confirm('Delete?'))return; GD.actions.splice(i,1); localStorage.setItem('gd_cache',JSON.stringify(GD)); populateActions(); }
function toggleActionEdit(i) { toggleEdit('act',i); }

// ═══ SCENARIOS ═══ (#2,6,7: categories, 3-tier alignment, multi-outcomes, complexity)
function populateScenarios() {
  document.getElementById('scenarios-list').innerHTML = GD.scenarios.map((s,i) => renderScenarioCard(s,i,'sc') + renderScenarioForm(s,i,'sc')).join('');
}
function renderScenarioCard(s, i, prefix) {
  const cats = (s.categories||['all']).join(', ');
  const cplx = s.complexity||3;
  return `<div class="item-card" id="${prefix}-card-${i}" onclick="toggleEdit('${prefix}',${i})">
    <span class="expand-icon" id="${prefix}-exp-${i}">▸</span>
    <div class="item-card-info"><div class="item-card-name">${esc(s.title||s.subject||'Untitled')}</div>
    <div class="item-card-desc">${esc(s.tag||'')} · ${cats} · ${s.orgLevel||'both'} · ★${cplx} · ${(s.choices||[]).length} choices</div></div>
    <div class="item-card-actions"><button class="btn btn-danger btn-sm" onclick="event.stopPropagation();deleteScenario(${i},'${prefix}')">Delete</button></div>
  </div>`;
}
function renderScenarioForm(s, i, prefix) {
  const allCats = ['all','progressive','centrist','conservative','apolitical'];
  const cats = s.categories || ['all'];
  return `<div class="item-edit-form" id="${prefix}-form-${i}" style="display:none">
    <div class="form-row three">
      <div class="form-group"><label>ID</label><input id="${prefix}-id-${i}" value="${esc(s.id)}" /></div>
      <div class="form-group"><label>Tag</label><input id="${prefix}-tag-${i}" value="${esc(s.tag||'')}" /></div>
      <div class="form-group"><label>Trigger</label><input id="${prefix}-trigger-${i}" value="${esc(s.trigger||'')}" /></div>
    </div>
    <div class="form-group" style="margin-bottom:11px"><label>Title</label><input id="${prefix}-title-${i}" value="${esc(s.title||'')}" /></div>
    <div class="form-group" style="margin-bottom:11px"><label>Body</label><textarea id="${prefix}-body-${i}" rows="3">${esc(s.body||'')}</textarea></div>
    <div class="form-row three">
      <div class="form-group"><label>Categories</label><div class="checkbox-grid">${allCats.map(c=>`<label class="checkbox-item"><input type="checkbox" id="${prefix}-cat-${i}-${c}" ${cats.includes(c)?'checked':''} />${c}</label>`).join('')}</div></div>
      <div class="form-group"><label>Org Level</label><select id="${prefix}-lvl-${i}"><option value="both" ${(s.orgLevel||'both')==='both'?'selected':''}>Both</option><option value="local" ${s.orgLevel==='local'?'selected':''}>Local</option><option value="national" ${s.orgLevel==='national'?'selected':''}>National</option></select></div>
      <div class="form-group"><label>Complexity (1-5)</label><input type="number" id="${prefix}-cplx-${i}" value="${s.complexity||3}" min="1" max="5" /></div>
    </div>
    <div style="margin:8px 0;padding:6px 10px;background:#f8f5ff;border:1px solid #e0d8f0;display:flex;align-items:center;gap:10px">
      <label class="checkbox-item" style="font-weight:700"><input type="checkbox" id="${prefix}-polrel-${i}" ${s.politicallyRelevant!==false?'checked':''} style="accent-color:#6366f1" /> ⚖️ Politically Relevant</label>
      <span style="font-size:10px;color:var(--muted);font-style:italic">When checked, political effectiveness modifies stat outcomes for this scenario</span>
    </div>
    <h3 style="font-size:13px;margin:14px 0 8px">Choices</h3>
    <div class="choices-editor" id="${prefix}-choices-${i}">${(s.choices||[]).map((c,ci)=>renderChoiceEditor(c,i,ci,prefix)).join('')}</div>
    <button class="add-btn" style="margin-top:8px" onclick="addChoice(${i},'${prefix}')">+ Add Choice</button>
    ${renderAdvisorQuotesEditor(s, i, prefix)}
    <div style="margin-top:14px"><button class="btn btn-primary btn-sm" onclick="saveScenario(${i},'${prefix}')">Save Scenario</button></div>
  </div>`;
}
function renderChoiceEditor(c, si, ci, prefix) {
  const missions = GD.missions || [];
  const aligned = c.missionAligned || [];
  const opposed = c.missionOpposed || [];
  const outcomes = c.outcomes || [{text:c.outcome||'',effects:c.effects||{},weight:100,conditions:[],contextNote:''}];
  var hasPol = (c.politicalLean !== undefined && c.politicalLean !== 0) || (c.cloutEffect !== undefined && c.cloutEffect !== 0);
  return `<div class="choice-editor" id="${prefix}-choice-${si}-${ci}">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <span style="font-family:'Merriweather',serif;font-weight:900;font-size:17px;color:var(--gold)">${String.fromCharCode(65+ci)}</span>
      <button class="btn btn-danger btn-sm" onclick="deleteChoice(${si},${ci},'${prefix}')">Delete</button>
    </div>
    <div class="form-group" style="margin-bottom:6px"><label>Choice Text</label><textarea id="${prefix}-ctext-${si}-${ci}" rows="2">${esc(c.text||'')}</textarea></div>
    <div class="form-group" style="margin-bottom:6px"><label>Requires Unlock</label><input id="${prefix}-cunlock-${si}-${ci}" value="${esc(c.requiresUnlock||'')}" placeholder="blank = always available" /></div>
    <div class="form-group" style="margin-bottom:6px"><label>Budget Cost (0 = free)</label><input type="number" id="${prefix}-cbcost-${si}-${ci}" value="${c.budgetCost||0}" min="0" /></div>
    <div style="margin-bottom:8px;padding:8px;background:${hasPol?'#f0f0ff':'#f8f8f8'};border:1px solid ${hasPol?'#6366f1':'var(--border)'}">
      <label style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);display:flex;align-items:center;gap:6px;margin-bottom:6px;cursor:pointer" onclick="togglePolFields('${prefix}',${si},${ci})">
        <input type="checkbox" id="${prefix}-cpol-${si}-${ci}" ${hasPol?'checked':''} style="accent-color:#6366f1" /> ⚖️ Political Impact
      </label>
      <div id="${prefix}-polfields-${si}-${ci}" style="display:${hasPol?'block':'none'}">
        <div class="form-row three" style="margin-bottom:4px">
          <div class="form-group"><label>Political Lean</label><input type="number" id="${prefix}-cpollean-${si}-${ci}" value="${c.politicalLean||0}" min="-10" max="10" /><div class="form-hint">-10=hard left, +10=hard right, 0=none</div></div>
          <div class="form-group"><label>Clout Effect</label><input type="number" id="${prefix}-cpolclout-${si}-${ci}" value="${c.cloutEffect||0}" min="-10" max="10" /><div class="form-hint">Political capital gained/lost</div></div>
          <div class="form-group"><label>Min Clout Required</label><input type="number" id="${prefix}-cpolminclout-${si}-${ci}" value="${(c.politicalRequirement||{}).minClout||0}" min="0" max="100" /><div class="form-hint">0 = no requirement</div></div>
        </div>
      </div>
    </div>
    <div style="margin-bottom:8px"><label style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);display:block;margin-bottom:5px">Mission Alignment</label>
    <div style="display:flex;flex-direction:column;gap:2px">${missions.map(m=>{
      const st = aligned.includes(m.id)?'aligned':opposed.includes(m.id)?'opposed':'neutral';
      return `<div style="display:flex;align-items:center;gap:8px;font-size:12px"><span style="width:170px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(m.name)}</span><select id="${prefix}-calign-${si}-${ci}-${m.id}" style="font-size:11px;padding:2px"><option value="neutral" ${st==='neutral'?'selected':''}>Neutral</option><option value="aligned" ${st==='aligned'?'selected':''}>✓ Aligned</option><option value="opposed" ${st==='opposed'?'selected':''}>✗ Opposed</option></select></div>`;
    }).join('')}</div></div>
    <label style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);display:block;margin-bottom:5px">Outcomes (${outcomes.length})</label>
    ${outcomes.map((o,oi)=>renderOutcomeEditor(si,ci,oi,o,prefix)).join('')}
    <button class="add-btn" style="padding:6px;font-size:11px;margin-top:4px" onclick="addOutcome(${si},${ci},'${prefix}')">+ Add Outcome</button>
  </div>`;
}
function renderOutcomeEditor(si, ci, oi, o, prefix) {
  const stats = GD.stats || [];
  return `<div style="background:#f8f5ee;border:1px solid var(--border);padding:9px;margin-bottom:4px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px"><span style="font-size:11px;font-weight:700;color:var(--gold)">Outcome ${oi+1}</span>${oi>0?`<button class="btn btn-danger btn-sm" style="padding:2px 6px;font-size:9px" onclick="deleteOutcome(${si},${ci},${oi},'${prefix}')">×</button>`:''}</div>
    <div class="form-group" style="margin-bottom:5px"><label>Text</label><textarea id="${prefix}-otext-${si}-${ci}-${oi}" rows="2">${esc(o.text||'')}</textarea></div>
    <div class="form-row" style="margin-bottom:5px"><div class="form-group"><label>Weight %</label><input type="number" id="${prefix}-owt-${si}-${ci}-${oi}" value="${o.weight||100}" min="0" /></div><div class="form-group"><label>Context Note</label><input id="${prefix}-onote-${si}-${ci}-${oi}" value="${esc(o.contextNote||'')}" placeholder="optional info box" /></div></div>
    <div class="stat-inputs cols-4" style="margin-bottom:5px">${stats.map(s=>`<div class="stat-input-group"><label>${s.label}</label><input type="number" id="${prefix}-ofx-${si}-${ci}-${oi}-${s.id}" value="${(o.effects||{})[s.id]||0}" /></div>`).join('')}</div>
    <div style="font-size:10px;color:var(--muted)">Conditions: ${(o.conditions||[]).length?JSON.stringify(o.conditions):'None'} <button style="font-size:9px;cursor:pointer;border:1px solid var(--border);background:none;padding:1px 4px" onclick="editConditions(${si},${ci},${oi},'${prefix}')">Edit</button></div>
  </div>`;
}
function addOutcome(si, ci, prefix) {
  const list = prefix==='sc'?GD.scenarios:GD.inboxScenarios;
  const c = list[si].choices[ci];
  if(!c.outcomes) c.outcomes=[{text:c.outcome||'',effects:c.effects||{},weight:100,conditions:[],contextNote:''}];
  c.outcomes.push({text:'',effects:{},weight:50,conditions:[],contextNote:''});
  localStorage.setItem('gd_cache',JSON.stringify(GD));
  prefix==='sc'?populateScenarios():populateInbox();
}
function deleteOutcome(si,ci,oi,prefix) {
  const list = prefix==='sc'?GD.scenarios:GD.inboxScenarios;
  if((list[si].choices[ci].outcomes||[]).length<=1) return;
  list[si].choices[ci].outcomes.splice(oi,1);
  localStorage.setItem('gd_cache',JSON.stringify(GD));
  prefix==='sc'?populateScenarios():populateInbox();
}
function editConditions(si,ci,oi,prefix) {
  const list = prefix==='sc'?GD.scenarios:GD.inboxScenarios;
  const o = (list[si].choices[ci].outcomes||[])[oi];
  if(!o) return;
  const input = prompt('Conditions JSON:\n[{"type":"stat","stat":"morale","operator":"above","threshold":80,"modifier":15}]\nor [{"type":"missionStars","perStar":5}]\nCurrent: '+JSON.stringify(o.conditions||[]));
  if(input===null) return;
  try { o.conditions=JSON.parse(input); localStorage.setItem('gd_cache',JSON.stringify(GD)); prefix==='sc'?populateScenarios():populateInbox(); }
  catch(e) { alert('Invalid JSON'); }
}
function saveScenario(i, prefix) {
  const list = prefix==='sc'?GD.scenarios:GD.inboxScenarios;
  const s = list[i];
  s.id = document.getElementById(prefix+'-id-'+i)?.value||s.id;
  s.tag = document.getElementById(prefix+'-tag-'+i)?.value||'';
  s.trigger = document.getElementById(prefix+'-trigger-'+i)?.value||'';
  s.title = document.getElementById(prefix+'-title-'+i)?.value||s.title;
  s.body = document.getElementById(prefix+'-body-'+i)?.value||'';
  const allCats=['all','progressive','centrist','conservative','apolitical'];
  s.categories = allCats.filter(c=>document.getElementById(prefix+'-cat-'+i+'-'+c)?.checked);
  if(!s.categories.length) s.categories=['all'];
  s.orgLevel = document.getElementById(prefix+'-lvl-'+i)?.value||'both';
  s.complexity = parseInt(document.getElementById(prefix+'-cplx-'+i)?.value)||3;
  // Political relevance flag
  var polRelEl = document.getElementById(prefix+'-polrel-'+i);
  s.politicallyRelevant = polRelEl ? polRelEl.checked : true;
  const missions = GD.missions||[];
  s.choices = [];
  let ci=0;
  while(document.getElementById(prefix+'-ctext-'+i+'-'+ci)) {
    const text = document.getElementById(prefix+'-ctext-'+i+'-'+ci).value;
    const unlock = document.getElementById(prefix+'-cunlock-'+i+'-'+ci)?.value||null;
    const aligned=[],opposed=[];
    missions.forEach(m=>{
      const v=document.getElementById(prefix+'-calign-'+i+'-'+ci+'-'+m.id)?.value||'neutral';
      if(v==='aligned') aligned.push(m.id); else if(v==='opposed') opposed.push(m.id);
    });
    // Political impact fields
    var polLean = parseInt(document.getElementById(prefix+'-cpollean-'+i+'-'+ci)?.value)||0;
    var polClout = parseInt(document.getElementById(prefix+'-cpolclout-'+i+'-'+ci)?.value)||0;
    var polMinClout = parseInt(document.getElementById(prefix+'-cpolminclout-'+i+'-'+ci)?.value)||0;
    var polReq = {};
    if(polMinClout > 0) polReq.minClout = polMinClout;
    const outcomes=[];
    let oi=0;
    while(document.getElementById(prefix+'-otext-'+i+'-'+ci+'-'+oi)) {
      const effects={};
      (GD.stats||[]).forEach(st=>{const v=parseInt(document.getElementById(prefix+'-ofx-'+i+'-'+ci+'-'+oi+'-'+st.id)?.value)||0;if(v)effects[st.id]=v;});
      const existingO = (list[i]?.choices?.[ci]?.outcomes||[])[oi];
      outcomes.push({text:document.getElementById(prefix+'-otext-'+i+'-'+ci+'-'+oi).value,effects,weight:parseInt(document.getElementById(prefix+'-owt-'+i+'-'+ci+'-'+oi)?.value)||100,contextNote:document.getElementById(prefix+'-onote-'+i+'-'+ci+'-'+oi)?.value||'',conditions:existingO?.conditions||[]});
      oi++;
    }
    s.choices.push({id:'c'+ci,text,requiresUnlock:unlock||null,missionAligned:aligned,missionOpposed:opposed,outcomes,budgetCost:parseInt(document.getElementById(prefix+'-cbcost-'+i+'-'+ci)?.value)||0,politicalLean:polLean,cloutEffect:polClout,politicalRequirement:Object.keys(polReq).length?polReq:undefined});
    ci++;
  }
  // Save advisor quotes with recommendation fields
  s.advisorQuotes = readAdvisorQuotes(i, prefix);
  // Save highStakes from the checkbox
  var hsCheck = document.querySelector('#'+prefix+'-form-'+i+' .hs-check');
  s.highStakes = hsCheck ? hsCheck.checked : !!s.highStakes;
  localStorage.setItem('gd_cache',JSON.stringify(GD)); setStatus('Scenario saved.','success');
}
function addChoice(si, prefix) {
  const list = prefix==='sc'?GD.scenarios:GD.inboxScenarios;
  list[si].choices.push({id:'c'+list[si].choices.length,text:'',requiresUnlock:null,missionAligned:[],missionOpposed:[],outcomes:[{text:'',effects:{},weight:100,conditions:[],contextNote:''}]});
  localStorage.setItem('gd_cache',JSON.stringify(GD));
  prefix==='sc'?populateScenarios():populateInbox();
}
function deleteChoice(si,ci,prefix) {
  const list = prefix==='sc'?GD.scenarios:GD.inboxScenarios;
  list[si].choices.splice(ci,1);
  localStorage.setItem('gd_cache',JSON.stringify(GD));
  prefix==='sc'?populateScenarios():populateInbox();
}
function deleteScenario(i,prefix) {
  if(!confirm('Delete?'))return;
  const list = prefix==='sc'?GD.scenarios:GD.inboxScenarios;
  list.splice(i,1); localStorage.setItem('gd_cache',JSON.stringify(GD));
  prefix==='sc'?populateScenarios():populateInbox();
}
function addScenario() {
  GD.scenarios.push({id:'sc_'+Date.now(),tag:'Event',trigger:'community',title:'New Scenario',body:'',categories:['all'],orgLevel:'both',complexity:3,choices:[]});
  localStorage.setItem('gd_cache',JSON.stringify(GD)); populateScenarios();
}

// ═══ INBOX ═══
function populateInbox() {
  document.getElementById('inbox-list').innerHTML = GD.inboxScenarios.map((s,i) => renderInboxCard(s,i) + renderInboxForm(s,i)).join('');
}
function renderInboxCard(s, i) {
  const cats = (s.categories||['all']).join(', ');
  return `<div class="item-card" id="ib-card-${i}" onclick="toggleEdit('ib',${i})">
    <span class="expand-icon" id="ib-exp-${i}">▸</span>
    <div class="item-card-info"><div class="item-card-name">${esc(s.subject||'Untitled')}</div>
    <div class="item-card-desc">${esc(s.from||'')} · ${cats} · ★${s.complexity||3} · ${(s.choices||[]).length} choices</div></div>
    <div class="item-card-actions"><button class="btn btn-danger btn-sm" onclick="event.stopPropagation();deleteInbox(${i})">Delete</button></div>
  </div>`;
}
function renderInboxForm(s, i) {
  const allCats = ['all','progressive','centrist','conservative','apolitical'];
  const cats = s.categories||['all'];
  return `<div class="item-edit-form" id="ib-form-${i}" style="display:none">
    <div class="form-row three">
      <div class="form-group"><label>ID</label><input id="ib-id-${i}" value="${esc(s.id)}" /></div>
      <div class="form-group"><label>Tag</label><input id="ib-tag-${i}" value="${esc(s.tag||'')}" /></div>
      <div class="form-group"><label>From</label><input id="ib-from-${i}" value="${esc(s.from||'')}" /></div>
    </div>
    <div class="form-group" style="margin-bottom:11px"><label>Subject</label><input id="ib-subj-${i}" value="${esc(s.subject||'')}" /></div>
    <div class="form-group" style="margin-bottom:11px"><label>Body</label><textarea id="ib-body-${i}" rows="3">${esc(s.body||'')}</textarea></div>
    <div class="form-row three">
      <div class="form-group"><label>Categories</label><div class="checkbox-grid">${allCats.map(c=>`<label class="checkbox-item"><input type="checkbox" id="ib-cat-${i}-${c}" ${cats.includes(c)?'checked':''} />${c}</label>`).join('')}</div></div>
      <div class="form-group"><label>Org Level</label><select id="ib-lvl-${i}"><option value="both" ${(s.orgLevel||'both')==='both'?'selected':''}>Both</option><option value="local" ${s.orgLevel==='local'?'selected':''}>Local</option><option value="national" ${s.orgLevel==='national'?'selected':''}>National</option></select></div>
      <div class="form-group"><label>Complexity (1-5)</label><input type="number" id="ib-cplx-${i}" value="${s.complexity||3}" min="1" max="5" /></div>
    </div>
    <div style="margin:8px 0;padding:6px 10px;background:#f8f5ff;border:1px solid #e0d8f0;display:flex;align-items:center;gap:10px">
      <label class="checkbox-item" style="font-weight:700"><input type="checkbox" id="ib-polrel-${i}" ${s.politicallyRelevant!==false?'checked':''} style="accent-color:#6366f1" /> ⚖️ Politically Relevant</label>
      <span style="font-size:10px;color:var(--muted);font-style:italic">When checked, political effectiveness modifies stat outcomes</span>
    </div>
    <h3 style="font-size:13px;margin:14px 0 8px">Choices</h3>
    <div class="choices-editor">${(s.choices||[]).map((c,ci)=>renderChoiceEditor(c,i,ci,'ib')).join('')}</div>
    <button class="add-btn" style="margin-top:8px" onclick="addChoice(${i},'ib')">+ Add Choice</button>
    <div style="margin-top:14px"><button class="btn btn-primary btn-sm" onclick="saveInbox(${i})">Save Inbox</button></div>
  </div>`;
}
function saveInbox(i) {
  // Reuse saveScenario with ib prefix, but also save inbox-specific fields
  const s = GD.inboxScenarios[i];
  s.id = document.getElementById('ib-id-'+i)?.value||s.id;
  s.tag = document.getElementById('ib-tag-'+i)?.value||'';
  s.from = document.getElementById('ib-from-'+i)?.value||'';
  s.subject = document.getElementById('ib-subj-'+i)?.value||'';
  s.body = document.getElementById('ib-body-'+i)?.value||'';
  const allCats=['all','progressive','centrist','conservative','apolitical'];
  s.categories = allCats.filter(c=>document.getElementById('ib-cat-'+i+'-'+c)?.checked);
  if(!s.categories.length) s.categories=['all'];
  s.orgLevel = document.getElementById('ib-lvl-'+i)?.value||'both';
  s.complexity = parseInt(document.getElementById('ib-cplx-'+i)?.value)||3;
  // Political relevance
  var polRelEl = document.getElementById('ib-polrel-'+i);
  s.politicallyRelevant = polRelEl ? polRelEl.checked : true;
  const missions = GD.missions||[];
  s.choices = [];
  let ci=0;
  while(document.getElementById('ib-ctext-'+i+'-'+ci)) {
    const text = document.getElementById('ib-ctext-'+i+'-'+ci).value;
    const unlock = document.getElementById('ib-cunlock-'+i+'-'+ci)?.value||null;
    const aligned=[],opposed=[];
    missions.forEach(m=>{const v=document.getElementById('ib-calign-'+i+'-'+ci+'-'+m.id)?.value||'neutral';if(v==='aligned')aligned.push(m.id);else if(v==='opposed')opposed.push(m.id);});
    // Political impact fields
    var polLean = parseInt(document.getElementById('ib-cpollean-'+i+'-'+ci)?.value)||0;
    var polClout = parseInt(document.getElementById('ib-cpolclout-'+i+'-'+ci)?.value)||0;
    var polMinClout = parseInt(document.getElementById('ib-cpolminclout-'+i+'-'+ci)?.value)||0;
    var polReq = {};
    if(polMinClout > 0) polReq.minClout = polMinClout;
    const outcomes=[];
    let oi=0;
    while(document.getElementById('ib-otext-'+i+'-'+ci+'-'+oi)) {
      const effects={};
      (GD.stats||[]).forEach(st=>{const v=parseInt(document.getElementById('ib-ofx-'+i+'-'+ci+'-'+oi+'-'+st.id)?.value)||0;if(v)effects[st.id]=v;});
      const existingO=(GD.inboxScenarios[i]?.choices?.[ci]?.outcomes||[])[oi];
      outcomes.push({text:document.getElementById('ib-otext-'+i+'-'+ci+'-'+oi).value,effects,weight:parseInt(document.getElementById('ib-owt-'+i+'-'+ci+'-'+oi)?.value)||100,contextNote:document.getElementById('ib-onote-'+i+'-'+ci+'-'+oi)?.value||'',conditions:existingO?.conditions||[]});
      oi++;
    }
    s.choices.push({id:'c'+ci,text,requiresUnlock:unlock||null,missionAligned:aligned,missionOpposed:opposed,outcomes,budgetCost:parseInt(document.getElementById('ib-cbcost-'+i+'-'+ci)?.value)||0,politicalLean:polLean,cloutEffect:polClout,politicalRequirement:Object.keys(polReq).length?polReq:undefined});
    ci++;
  }
  localStorage.setItem('gd_cache',JSON.stringify(GD)); setStatus('Inbox saved.','success');
}
function deleteInbox(i) { if(!confirm('Delete?'))return; GD.inboxScenarios.splice(i,1); localStorage.setItem('gd_cache',JSON.stringify(GD)); populateInbox(); }
function addInboxScenario() {
  GD.inboxScenarios.push({id:'inbox_'+Date.now(),tag:'Email',from:'',subject:'New Message',body:'',categories:['all'],orgLevel:'both',complexity:3,choices:[]});
  localStorage.setItem('gd_cache',JSON.stringify(GD)); populateInbox();
}

// ═══ SCORING ═══
function populateScoring() {
  const th = GD.scoring?.thresholds || [];
  document.getElementById('scoring-list').innerHTML = th.map((t,i) => `
    <div style="background:white;border:1px solid var(--border);padding:12px;margin-bottom:8px">
      <div class="form-row four">
        <div class="form-group"><label>Min Score</label><input type="number" id="th-min-${i}" value="${t.min}" /></div>
        <div class="form-group"><label>Grade</label><input id="th-grade-${i}" value="${esc(t.grade)}" /></div>
        <div class="form-group"><label>Heading</label><input id="th-heading-${i}" value="${esc(t.heading)}" /></div>
        <div><button class="btn btn-danger btn-sm" style="margin-top:18px" onclick="deleteThreshold(${i})">×</button></div>
      </div>
      <div class="form-group"><label>Verdict</label><textarea id="th-verdict-${i}" rows="2">${esc(t.verdict)}</textarea></div>
      <button class="btn btn-primary btn-sm" style="margin-top:6px" onclick="saveThreshold(${i})">Save</button>
    </div>`).join('');
}
function saveThreshold(i) {
  const t = GD.scoring.thresholds[i];
  t.min = parseInt(document.getElementById('th-min-'+i).value)||0;
  t.grade = document.getElementById('th-grade-'+i).value;
  t.heading = document.getElementById('th-heading-'+i).value;
  t.verdict = document.getElementById('th-verdict-'+i).value;
  localStorage.setItem('gd_cache',JSON.stringify(GD)); setStatus('Threshold saved.','success');
}
function deleteThreshold(i) { GD.scoring.thresholds.splice(i,1); localStorage.setItem('gd_cache',JSON.stringify(GD)); populateScoring(); }

// ═══ TEXT ═══ (#11: full page text)
function populateText() {
  const pt = GD.config.pageText||{};
  const i = pt.introScreen||{};
  // Password
  document.getElementById('txt-gamePassword').value = GD.config.gamePassword||'';
  // Header
  document.getElementById('txt-lpKicker').value = i.kicker||'';
  document.getElementById('txt-lpTitle').value = i.title||'';
  // Scenario
  document.getElementById('txt-lpScenTitle').value = i.scenarioTitle||'';
  document.getElementById('txt-lpScenBody').value = i.scenarioBody||'';
  document.getElementById('txt-lpChoicesLabel').value = i.choicesLabel||'What do you do?';
  renderLpChoicesEditor(i.choices||[]);
  // Reveal
  document.getElementById('txt-lpTransition').value = i.transitionText||'';
  document.getElementById('txt-lpDivider').value = i.revealDivider||'';
  document.getElementById('txt-lpRevealTitle').value = i.revealTitle||'';
  document.getElementById('txt-lpRevealAccent').value = i.revealTitleAccent||'';
  document.getElementById('txt-lpRevealSub').value = i.revealSubtitle||'';
  document.getElementById('txt-lpPremise').value = i.revealPremise||'';
  document.getElementById('txt-lpStakes').value = i.revealStakes||'';
  document.getElementById('txt-lpCtaPost').value = i.ctaButtonPost||'';
  document.getElementById('txt-lpCtaTagline').value = i.ctaTagline||'';
  document.getElementById('txt-lpBottomText').value = i.bottomText||'';
  // Depth
  document.getElementById('txt-lpDepthLabel').value = i.depthLabel||'';
  renderLpDepthEditor(i.depthItems||[]);
  // Headlines
  document.getElementById('txt-lpHeadlinesLabel').value = i.headlinesLabel||'';
  renderLpHeadlinesEditor(i.headlines||[]);
  // Ticker
  document.getElementById('txt-lpTicker').value = (i.tickerHeadlines||[]).join('\n');
  // Other screens
  const ch=pt.charScreen||{};
  document.getElementById('txt-charStepLabel').value=ch.stepLabel||'';
  document.getElementById('txt-charHeading').value=ch.heading||'';
  document.getElementById('txt-charDesc').value=ch.description||'';
  const og=pt.orgScreen||{};
  document.getElementById('txt-orgStepLabel').value=og.stepLabel||'';
  document.getElementById('txt-orgHeading').value=og.heading||'';
  document.getElementById('txt-orgDesc').value=og.description||'';
  const ms=pt.missionScreen||{};
  document.getElementById('txt-misStepLabel').value=ms.stepLabel||'';
  document.getElementById('txt-misHeading').value=ms.heading||'';
  document.getElementById('txt-misDesc').value=ms.description||'';
  const bd=pt.budgetScreen||{};
  document.getElementById('txt-budStepLabel').value=bd.stepLabel||'';
  document.getElementById('txt-budHeading').value=bd.heading||'';
  document.getElementById('txt-budDesc').value=bd.description||'';
  const gm=pt.gameScreen||{};
  document.getElementById('txt-gameActionH').value=gm.actionHeading||'';
  document.getElementById('txt-gameEndBtn').value=gm.endRoundButton||'';
  document.getElementById('txt-gameNoAP').value=gm.noApMessage||'';
  const en=pt.endScreen||{};
  document.getElementById('txt-endFail').value=en.failureTitle||'';
  document.getElementById('txt-endYear').value=en.anotherYearTitle||'';
  document.getElementById('txt-endPromo').value=en.promotionTitle||'';
  document.getElementById('txt-endRetire').value=en.retirementTitle||'';
}

// ─── Landing page choices editor ───
var _lpChoices = [];
function renderLpChoicesEditor(choices) {
  _lpChoices = JSON.parse(JSON.stringify(choices||[]));
  var el = document.getElementById('lp-choices-editor');
  el.innerHTML = _lpChoices.map(function(c, ci) {
    var chipsHtml = (c.chips||[]).map(function(ch, chi) {
      return '<span style="display:inline-flex;gap:4px;align-items:center;background:#f0ede8;padding:2px 6px;border-radius:3px;font-size:11px"><input style="width:60px;font-size:11px;border:1px solid #ccc;padding:1px 4px" value="'+esc(ch.label)+'" onchange="_lpChoices['+ci+'].chips['+chi+'].label=this.value" /><select style="font-size:10px" onchange="_lpChoices['+ci+'].chips['+chi+'].cls=this.value"><option value="chip-green"'+(ch.cls==='chip-green'?' selected':'')+'>Green</option><option value="chip-red"'+(ch.cls==='chip-red'?' selected':'')+'>Red</option><option value="chip-gold"'+(ch.cls==='chip-gold'?' selected':'')+'>Gold</option></select><button style="border:none;background:none;cursor:pointer;color:#999" onclick="_lpChoices['+ci+'].chips.splice('+chi+',1);renderLpChoicesEditor(_lpChoices)">&times;</button></span>';
    }).join(' ');
    var segsHtml = (c.segments||[]).map(function(s, si) {
      return '<div style="display:flex;gap:4px;align-items:center;margin-bottom:2px"><input style="width:75px;font-size:11px" value="'+esc(s.name)+'" onchange="_lpChoices['+ci+'].segments['+si+'].name=this.value" /><input type="number" style="width:40px;font-size:11px" value="'+s.val+'" onchange="_lpChoices['+ci+'].segments['+si+'].val=+this.value" title="val" /><input type="number" style="width:40px;font-size:11px" value="'+s.pct+'" onchange="_lpChoices['+ci+'].segments['+si+'].pct=+this.value" title="bar%" /><button style="border:none;background:none;cursor:pointer;color:#999;font-size:12px" onclick="_lpChoices['+ci+'].segments.splice('+si+',1);renderLpChoicesEditor(_lpChoices)">&times;</button></div>';
    }).join('');
    return '<div style="background:white;border:1px solid var(--border);padding:12px;margin-top:8px"><div style="display:flex;justify-content:space-between;margin-bottom:6px"><strong style="font-size:12px">Choice '+(ci+1)+'</strong><button class="btn btn-sm" style="color:#c0392b" onclick="_lpChoices.splice('+ci+',1);renderLpChoicesEditor(_lpChoices)">Remove</button></div>'+
      '<div class="form-group"><label>Choice Text</label><textarea rows="2" style="width:100%" onchange="_lpChoices['+ci+'].text=this.value">'+esc(c.text)+'</textarea></div>'+
      '<div class="form-group"><label>Outcome Text</label><textarea rows="3" style="width:100%" onchange="_lpChoices['+ci+'].outcome=this.value">'+esc(c.outcome)+'</textarea></div>'+
      '<div class="form-group"><label>Stat Chips</label><div style="display:flex;flex-wrap:wrap;gap:4px">'+chipsHtml+'<button class="btn btn-sm" onclick="_lpChoices['+ci+'].chips.push({label:\'+1 New\',cls:\'chip-green\'});renderLpChoicesEditor(_lpChoices)">+ Chip</button></div></div>'+
      '<div class="form-row"><div class="form-group"><label>Pol Shift (-100 to 100)</label><input type="number" style="width:80px" value="'+(c.polShift||0)+'" onchange="_lpChoices['+ci+'].polShift=+this.value" /></div><div class="form-group"><label>Pol Label</label><input value="'+esc(c.polLabel||'')+'" onchange="_lpChoices['+ci+'].polLabel=this.value" /></div><div class="form-group"><label>Pol Class</label><select onchange="_lpChoices['+ci+'].polClass=this.value"><option value="pol-shift-left"'+(c.polClass==='pol-shift-left'?' selected':'')+'>Left</option><option value="pol-shift-center"'+(c.polClass==='pol-shift-center'?' selected':'')+'>Center</option><option value="pol-shift-right"'+(c.polClass==='pol-shift-right'?' selected':'')+'>Right</option></select></div></div>'+
      '<div class="form-group"><label>Segments (name / value / bar%)</label>'+segsHtml+'<button class="btn btn-sm" onclick="_lpChoices['+ci+'].segments.push({name:\'New\',val:0,pct:50});renderLpChoicesEditor(_lpChoices)">+ Segment</button></div></div>';
  }).join('');
}
function addLpChoice() {
  _lpChoices.push({text:'New choice',outcome:'Outcome text',chips:[],polShift:0,polLabel:'No Shift',polClass:'pol-shift-center',segments:[]});
  renderLpChoicesEditor(_lpChoices);
}

// ─── Depth items editor ───
var _lpDepth = [];
function renderLpDepthEditor(items) {
  _lpDepth = JSON.parse(JSON.stringify(items||[]));
  var el = document.getElementById('lp-depth-editor');
  el.innerHTML = _lpDepth.map(function(d, di) {
    return '<div style="background:white;border:1px solid var(--border);padding:10px;margin-top:6px"><div style="display:flex;justify-content:space-between;margin-bottom:4px"><strong style="font-size:11px">Item '+(di+1)+'</strong><button class="btn btn-sm" style="color:#c0392b" onclick="_lpDepth.splice('+di+',1);renderLpDepthEditor(_lpDepth)">Remove</button></div>'+
      '<div class="form-row"><div class="form-group"><label>Icon (emoji)</label><input style="width:50px" value="'+esc(d.icon)+'" onchange="_lpDepth['+di+'].icon=this.value" /></div><div class="form-group"><label>Title</label><input value="'+esc(d.title)+'" onchange="_lpDepth['+di+'].title=this.value" /></div></div>'+
      '<div class="form-group"><label>Description</label><textarea rows="2" style="width:100%" onchange="_lpDepth['+di+'].desc=this.value">'+esc(d.desc)+'</textarea></div></div>';
  }).join('');
}
function addLpDepthItem() { _lpDepth.push({icon:'📌',title:'New Item',desc:''}); renderLpDepthEditor(_lpDepth); }

// ─── Headlines editor ───
var _lpHeadlines = [];
function renderLpHeadlinesEditor(items) {
  _lpHeadlines = JSON.parse(JSON.stringify(items||[]));
  var el = document.getElementById('lp-headlines-editor');
  el.innerHTML = _lpHeadlines.map(function(h, hi) {
    return '<div style="display:flex;gap:6px;align-items:center;margin-top:4px"><input style="width:160px;font-size:12px" placeholder="Publication" value="'+esc(h.pub)+'" onchange="_lpHeadlines['+hi+'].pub=this.value" /><input style="flex:1;font-size:12px" placeholder="Headline" value="'+esc(h.text)+'" onchange="_lpHeadlines['+hi+'].text=this.value" /><button style="border:none;background:none;cursor:pointer;color:#999" onclick="_lpHeadlines.splice('+hi+',1);renderLpHeadlinesEditor(_lpHeadlines)">&times;</button></div>';
  }).join('');
}
function addLpHeadline() { _lpHeadlines.push({pub:'New Publication',text:'New Headline'}); renderLpHeadlinesEditor(_lpHeadlines); }

function saveText() {
  if(!GD.config.pageText) GD.config.pageText={};
  const pt=GD.config.pageText;
  GD.config.gamePassword = document.getElementById('txt-gamePassword').value;
  pt.introScreen = {
    kicker: document.getElementById('txt-lpKicker').value,
    title: document.getElementById('txt-lpTitle').value,
    scenarioTitle: document.getElementById('txt-lpScenTitle').value,
    scenarioBody: document.getElementById('txt-lpScenBody').value,
    choicesLabel: document.getElementById('txt-lpChoicesLabel').value,
    choices: _lpChoices,
    transitionText: document.getElementById('txt-lpTransition').value,
    revealDivider: document.getElementById('txt-lpDivider').value,
    revealTitle: document.getElementById('txt-lpRevealTitle').value,
    revealTitleAccent: document.getElementById('txt-lpRevealAccent').value,
    revealSubtitle: document.getElementById('txt-lpRevealSub').value,
    revealPremise: document.getElementById('txt-lpPremise').value,
    revealStakes: document.getElementById('txt-lpStakes').value,
    ctaButtonPost: document.getElementById('txt-lpCtaPost').value,
    ctaTagline: document.getElementById('txt-lpCtaTagline').value,
    bottomText: document.getElementById('txt-lpBottomText').value,
    depthLabel: document.getElementById('txt-lpDepthLabel').value,
    depthItems: _lpDepth,
    headlinesLabel: document.getElementById('txt-lpHeadlinesLabel').value,
    headlines: _lpHeadlines,
    tickerHeadlines: document.getElementById('txt-lpTicker').value.split('\n').filter(function(l){return l.trim();})
  };
  pt.charScreen={stepLabel:document.getElementById('txt-charStepLabel').value,heading:document.getElementById('txt-charHeading').value,description:document.getElementById('txt-charDesc').value};
  pt.orgScreen={stepLabel:document.getElementById('txt-orgStepLabel').value,heading:document.getElementById('txt-orgHeading').value,description:document.getElementById('txt-orgDesc').value};
  pt.missionScreen={stepLabel:document.getElementById('txt-misStepLabel').value,heading:document.getElementById('txt-misHeading').value,description:document.getElementById('txt-misDesc').value};
  pt.budgetScreen={stepLabel:document.getElementById('txt-budStepLabel').value,heading:document.getElementById('txt-budHeading').value,description:document.getElementById('txt-budDesc').value};
  pt.gameScreen={actionHeading:document.getElementById('txt-gameActionH').value,endRoundButton:document.getElementById('txt-gameEndBtn').value,noApMessage:document.getElementById('txt-gameNoAP').value};
  pt.endScreen={failureTitle:document.getElementById('txt-endFail').value,anotherYearTitle:document.getElementById('txt-endYear').value,promotionTitle:document.getElementById('txt-endPromo').value,retirementTitle:document.getElementById('txt-endRetire').value};
  localStorage.setItem('gd_cache',JSON.stringify(GD)); setStatus('All page text saved.','success');
}

// ═══ STATS ═══
function populateStats() {
  document.getElementById('stats-list').innerHTML = (GD.stats||[]).map((s,i) => `
    <div style="background:white;border:1px solid var(--border);padding:12px;margin-bottom:8px">
      <div class="form-row four">
        <div class="form-group"><label>ID</label><input id="st-id-${i}" value="${esc(s.id)}" /></div>
        <div class="form-group"><label>Label</label><input id="st-label-${i}" value="${esc(s.label)}" /></div>
        <div class="form-group"><label>Start Base</label><input type="number" id="st-base-${i}" value="${s.startBase||50}" /></div>
        <div><button class="btn btn-primary btn-sm" style="margin-top:18px" onclick="saveStat(${i})">Save</button></div>
      </div>
    </div>`).join('');
}
function saveStat(i) {
  const s = GD.stats[i];
  s.id = document.getElementById('st-id-'+i).value;
  s.label = document.getElementById('st-label-'+i).value;
  s.startBase = parseInt(document.getElementById('st-base-'+i).value)||50;
  localStorage.setItem('gd_cache',JSON.stringify(GD)); setStatus('Stat saved.','success');
}

// ═══ TOGGLE & ESCAPE ═══
function toggleEdit(prefix, i) {
  const card = document.getElementById(prefix+'-card-'+i);
  const form = document.getElementById(prefix+'-form-'+i);
  const exp = document.getElementById(prefix+'-exp-'+i);
  if(!card||!form) return;
  const isOpen = card.classList.contains('open');
  card.classList.toggle('open', !isOpen);
  form.style.display = isOpen ? 'none' : 'block';
  if(exp) exp.textContent = isOpen ? '▸' : '▾';
}
function esc(str) { return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }



// ═══ MOMENTUM CONFIG ═══
function populateMomentumConfig(){
  var c = GD.config;
  var el;
  el = document.getElementById('cfg-momentumWindow'); if(el) el.value = c.momentumWindow || 2;
  el = document.getElementById('cfg-momentumBonus'); if(el) el.value = c.momentumBonus || 2;
  el = document.getElementById('cfg-momentumPenalty'); if(el) el.value = c.momentumPenalty || 3;
}
function saveMomentumConfig(){
  var c = GD.config;
  var el;
  el = document.getElementById('cfg-momentumWindow'); if(el) c.momentumWindow = parseInt(el.value)||2;
  el = document.getElementById('cfg-momentumBonus'); if(el) c.momentumBonus = parseInt(el.value)||2;
  el = document.getElementById('cfg-momentumPenalty'); if(el) c.momentumPenalty = parseInt(el.value)||3;
}

// ═══ POLITICAL MECHANICS ═══
function togglePolFields(prefix, si, ci) {
  var cb = document.getElementById(prefix+'-cpol-'+si+'-'+ci);
  var fields = document.getElementById(prefix+'-polfields-'+si+'-'+ci);
  if(cb && fields) {
    fields.style.display = cb.checked ? 'block' : 'none';
    if(!cb.checked) {
      // Clear values when unchecked
      var lean = document.getElementById(prefix+'-cpollean-'+si+'-'+ci);
      var clout = document.getElementById(prefix+'-cpolclout-'+si+'-'+ci);
      var minC = document.getElementById(prefix+'-cpolminclout-'+si+'-'+ci);
      if(lean) lean.value = 0;
      if(clout) clout.value = 0;
      if(minC) minC.value = 0;
    }
  }
}

function populatePoliticsConfig() {
  var pc = GD.config.politicsConfig || {};
  var el;
  el = document.getElementById('pol-optimalPos'); if(el) el.value = pc.optimalPosition || 40;
  el = document.getElementById('pol-sweetSpot'); if(el) el.value = pc.sweetSpotRange || 10;
  el = document.getElementById('pol-rightPenalty'); if(el) el.value = pc.rightPenaltyMult || 1.3;
  el = document.getElementById('pol-trapLow'); if(el) el.value = pc.trapLow || 35;
  el = document.getElementById('pol-trapHigh'); if(el) el.value = pc.trapHigh || 65;
  el = document.getElementById('pol-centristCloutRate'); if(el) el.value = pc.centristCloutRate || 0.6;
  // Show org positions
  var posDiv = document.getElementById('pol-org-positions');
  if(posDiv) {
    var allOrgs = (GD.organizations||[]).concat(GD.nationalOrganizations||[]);
    posDiv.innerHTML = allOrgs.map(function(o){
      var pos = (o.politicalStartPosition !== undefined) ? o.politicalStartPosition : '(default)';
      var clout = (o.politicalStartClout !== undefined) ? o.politicalStartClout : '(default)';
      return '<div style="padding:3px 0">' + esc(o.name) + ': Position=' + pos + ', Clout=' + clout + '</div>';
    }).join('');
  }
}

function savePoliticsConfig() {
  if(!GD.config.politicsConfig) GD.config.politicsConfig = {};
  var pc = GD.config.politicsConfig;
  pc.optimalPosition = parseInt(document.getElementById('pol-optimalPos')?.value)||40;
  pc.sweetSpotRange = parseInt(document.getElementById('pol-sweetSpot')?.value)||10;
  pc.rightPenaltyMult = parseFloat(document.getElementById('pol-rightPenalty')?.value)||1.3;
  pc.trapLow = parseInt(document.getElementById('pol-trapLow')?.value)||35;
  pc.trapHigh = parseInt(document.getElementById('pol-trapHigh')?.value)||65;
  pc.centristCloutRate = parseFloat(document.getElementById('pol-centristCloutRate')?.value)||0.6;
  localStorage.setItem('gd_cache', JSON.stringify(GD));
  setStatus('Political config saved.', 'success');
}

// ═══ ADVISOR POOL PANEL ═══
var ADV_PERSONALITIES = ['cautious','idealist','pragmatist','principled','strategic','activist','transactional','calculated'];
var ADV_EXPERTISE_OPTS = ['fundraise','community','advocacy','governance','crisis','donors'];

function setDirty() { localStorage.setItem('gd_cache', JSON.stringify(GD)); }

function populateAdvisors(){
  var list = document.getElementById('advisors-list');
  if(!list) return;
  var pool = GD.advisorPool || [];
  list.innerHTML = pool.map(function(a,i){
    return renderAdvisorCard(a,i) + renderAdvisorForm(a,i);
  }).join('');
}

function renderAdvisorCard(a, i){
  var typeBadge = a.type === 'external' ? '<span class="tag tag-blue">External</span>' : '<span class="tag tag-green">Internal</span>';
  var modChips = Object.entries(a.statModifiers||{}).map(function(e){
    var s = (GD.stats||[]).find(function(st){return st.id===e[0]});
    return '<span class="tag tag-gold">+'+e[1]+' '+(s?s.label:e[0])+'</span>';
  }).join('');
  return '<div class="item-card" id="adv-card-'+i+'" onclick="toggleEdit(\'adv\','+i+')">'+
    '<span class="expand-icon" id="adv-exp-'+i+'">▸</span>'+
    '<div class="item-card-info"><div class="item-card-name">'+esc(a.emoji)+' '+esc(a.name)+' — '+esc(a.role)+'</div>'+
    '<div class="item-card-desc">'+typeBadge+' '+modChips+' · '+esc(a.personality)+' · Lean: '+a.politicalLean+' · Clout: '+a.cloutBonus+'</div></div>'+
    '<div class="item-card-actions"><button class="btn btn-danger btn-sm" onclick="event.stopPropagation();deleteAdvisor('+i+')">Delete</button></div></div>';
}

function renderAdvisorForm(a, i){
  var stats = GD.stats||[];
  var expertise = a.expertise || [];
  return '<div class="item-edit-form" id="adv-form-'+i+'" style="display:none">'+
    '<div class="form-row three">'+
      '<div class="form-group"><label>Name</label><input id="adv-name-'+i+'" value="'+esc(a.name)+'" /></div>'+
      '<div class="form-group"><label>Role</label><input id="adv-role-'+i+'" value="'+esc(a.role)+'" /></div>'+
      '<div class="form-group"><label>Emoji</label><input id="adv-emoji-'+i+'" value="'+esc(a.emoji)+'" style="font-size:18px" /></div>'+
    '</div>'+
    '<div class="form-group" style="margin-bottom:11px"><label>Bio</label><textarea id="adv-bio-'+i+'" rows="2">'+esc(a.bio||'')+'</textarea></div>'+
    '<div class="form-row three">'+
      '<div class="form-group"><label>Type</label><select id="adv-type-'+i+'"><option value="internal"'+(a.type==='internal'?' selected':'')+'>Internal</option><option value="external"'+(a.type==='external'?' selected':'')+'>External</option></select></div>'+
      '<div class="form-group"><label>Personality</label><select id="adv-pers-'+i+'">'+ADV_PERSONALITIES.map(function(p){return '<option value="'+p+'"'+(a.personality===p?' selected':'')+'>'+p+'</option>';}).join('')+'</select></div>'+
      '<div class="form-group"><label>ID</label><input id="adv-id-'+i+'" value="'+esc(a.id)+'" /></div>'+
    '</div>'+
    '<div class="form-section" style="margin-top:12px;margin-bottom:12px"><label style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);display:block;margin-bottom:6px">Stat Modifiers</label>'+
    '<div class="stat-inputs cols-4">'+stats.map(function(s){
      return '<div class="stat-input-group"><label>'+s.label+'</label><input type="number" id="adv-mod-'+i+'-'+s.id+'" value="'+((a.statModifiers||{})[s.id]||0)+'" /></div>';
    }).join('')+'</div></div>'+
    '<div class="form-row four">'+
      '<div class="form-group"><label>Political Lean</label><input type="number" id="adv-lean-'+i+'" value="'+(a.politicalLean||0)+'" min="-10" max="10" /><div class="form-hint">-10 left, +10 right</div></div>'+
      '<div class="form-group"><label>Clout Bonus</label><input type="number" id="adv-clout-'+i+'" value="'+(a.cloutBonus||0)+'" min="0" max="15" /></div>'+
      '<div class="form-group"><label>Budget Bonus</label><input type="number" id="adv-budget-'+i+'" value="'+(a.budgetBonus||0)+'" min="0" max="10" /></div>'+
    '</div>'+
    '<div style="margin:12px 0"><label style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);display:block;margin-bottom:6px">Expertise</label>'+
    '<div class="checkbox-grid">'+ADV_EXPERTISE_OPTS.map(function(e){
      return '<label class="checkbox-item"><input type="checkbox" id="adv-exp-'+i+'-'+e+'" '+(expertise.includes(e)?'checked':'')+' />'+e+'</label>';
    }).join('')+'</div></div>'+
    '<div style="margin-top:14px"><button class="btn btn-primary btn-sm" onclick="saveAdvisor('+i+')">Save Advisor</button></div>'+
  '</div>';
}

function saveAdvisor(i){
  var pool = GD.advisorPool || [];
  var a = pool[i]; if(!a) return;
  a.id = document.getElementById('adv-id-'+i).value || a.id;
  a.name = document.getElementById('adv-name-'+i).value;
  a.role = document.getElementById('adv-role-'+i).value;
  a.emoji = document.getElementById('adv-emoji-'+i).value;
  a.bio = document.getElementById('adv-bio-'+i).value;
  a.type = document.getElementById('adv-type-'+i).value;
  a.personality = document.getElementById('adv-pers-'+i).value;
  a.politicalLean = parseInt(document.getElementById('adv-lean-'+i).value)||0;
  a.cloutBonus = parseInt(document.getElementById('adv-clout-'+i).value)||0;
  a.budgetBonus = parseInt(document.getElementById('adv-budget-'+i).value)||0;
  a.statModifiers = {};
  (GD.stats||[]).forEach(function(s){
    var v = parseInt(document.getElementById('adv-mod-'+i+'-'+s.id)?.value)||0;
    if(v) a.statModifiers[s.id] = v;
  });
  a.expertise = ADV_EXPERTISE_OPTS.filter(function(e){
    var el = document.getElementById('adv-exp-'+i+'-'+e);
    return el && el.checked;
  });
  setDirty(); setStatus('Advisor saved.','success'); populateAdvisors();
}

function addAdvisor(){
  if(!GD.advisorPool) GD.advisorPool = [];
  GD.advisorPool.push({id:'adv_'+Date.now(),name:'New Advisor',role:'Role',emoji:'👤',
    personality:'cautious',type:'internal',bio:'',
    statModifiers:{},politicalLean:0,cloutBonus:0,expertise:[],budgetBonus:0});
  setDirty(); populateAdvisors();
}

function deleteAdvisor(i){
  if(!confirm('Delete this advisor?')) return;
  (GD.advisorPool||[]).splice(i,1);
  setDirty(); populateAdvisors();
}

// ═══ GAZETTE PANEL ═══
function populateGazette(){
  var list = document.getElementById('gazette-list');
  if(!list) return;
  var templates = GD.gazetteTemplates || [];
  list.innerHTML = templates.map(function(t,i){
    var trigDesc = t.trigger.type;
    if(t.trigger.scenarioId) trigDesc += ':' + t.trigger.scenarioId;
    if(t.trigger.stat) trigDesc += ':' + t.trigger.stat;
    return '<div class="item-card"><div class="item-header"><span style="font-size:12px;color:var(--muted)">'+esc(trigDesc)+'</span><div><button class="edit-btn" onclick="editGazette('+i+')">Edit</button><button class="del-btn" onclick="deleteGazette('+i+')">✕</button></div></div><div class="item-detail"><strong>'+esc(t.headline)+'</strong><br><em>'+esc(t.subline||'')+'</em></div></div>';
  }).join('');
}
function editGazette(i){
  var t = (GD.gazetteTemplates||[])[i]; if(!t) return;
  var h = prompt('Headline:', t.headline); if(h===null) return; t.headline = h;
  var s = prompt('Subline:', t.subline||''); if(s!==null) t.subline = s;
  var tt = prompt('Trigger type (generic/choiceMade/statAbove/statBelow/momentumUp/momentumDown/coalitionFormed/coalitionBroken/inboxExpired/missionStarsHigh/missionStarsLow):', t.trigger.type);
  if(tt!==null) t.trigger.type = tt;
  populateGazette(); setDirty();
}
function addGazetteTemplate(){
  if(!GD.gazetteTemplates) GD.gazetteTemplates = [];
  GD.gazetteTemplates.push({trigger:{type:'generic'},headline:'New Headline',subline:'Subline text'});
  populateGazette(); setDirty();
}
function deleteGazette(i){
  if(!confirm('Delete this headline template?')) return;
  GD.gazetteTemplates.splice(i,1); populateGazette(); setDirty();
}

// ═══ BREAKING NEWS PANEL ═══
function populateBreaking(){
  var list = document.getElementById('breaking-list');
  if(!list) return;
  var items = GD.breakingNews || [];
  list.innerHTML = items.map(function(bn,i){
    return '<div class="item-card"><div class="item-header"><span>🚨 <strong>'+esc(bn.title)+'</strong></span><div><button class="edit-btn" onclick="editBreaking('+i+')">Edit</button><button class="del-btn" onclick="deleteBreaking('+i+')">✕</button></div></div><div class="item-detail">Prob: '+bn.probability+'% · Rounds '+bn.minRound+'-'+bn.maxRound+' · '+(bn.once?'Once':'Repeatable')+' · '+bn.choices.length+' choices</div></div>';
  }).join('');
}
function editBreaking(i){
  var bn = (GD.breakingNews||[])[i]; if(!bn) return;
  var title = prompt('Title:', bn.title); if(title===null) return; bn.title = title;
  var body = prompt('Body:', bn.body); if(body!==null) bn.body = body;
  var prob = prompt('Probability (0-100):', bn.probability); if(prob!==null) bn.probability = parseInt(prob)||10;
  var minR = prompt('Min round:', bn.minRound); if(minR!==null) bn.minRound = parseInt(minR)||1;
  var maxR = prompt('Max round:', bn.maxRound); if(maxR!==null) bn.maxRound = parseInt(maxR)||6;
  bn.once = confirm('Fire only once per game?');
  populateBreaking(); setDirty();
}
function addBreakingNews(){
  if(!GD.breakingNews) GD.breakingNews = [];
  GD.breakingNews.push({id:'bn_'+Date.now(),tag:'BREAKING',title:'New Breaking Event',body:'Description...',trigger:'any',probability:10,minRound:1,maxRound:6,once:true,categories:['all'],orgLevel:'both',complexity:3,choices:[]});
  populateBreaking(); setDirty();
}
function deleteBreaking(i){
  if(!confirm('Delete this breaking news event?')) return;
  GD.breakingNews.splice(i,1); populateBreaking(); setDirty();
}

// ═══ COALITIONS PANEL ═══
function populateCoalitions(){
  var list = document.getElementById('coalitions-list');
  if(!list) return;
  var items = GD.coalitionOffers || [];
  list.innerHTML = items.map(function(co,i){
    var benefitStr = Object.entries(co.benefits.perRound||{}).map(function(e){return '+'+e[1]+' '+e[0]}).join(', ');
    var constraintStr = (co.constraints||[]).map(function(c){return c.description}).join('; ');
    return '<div class="item-card"><div class="item-header"><span>🤝 <strong>'+esc(co.name)+'</strong></span><div><button class="edit-btn" onclick="editCoalition('+i+')">Edit</button><button class="del-btn" onclick="deleteCoalition('+i+')">✕</button></div></div><div class="item-detail">Benefits: '+esc(benefitStr)+' · Constraint: '+esc(constraintStr).substring(0,60)+'<br>Offered by round '+co.offeredByRound+' · Duration: '+(co.duration||'permanent')+'</div></div>';
  }).join('');
}
function editCoalition(i){
  var co = (GD.coalitionOffers||[])[i]; if(!co) return;
  var name = prompt('Name:', co.name); if(name===null) return; co.name = name;
  var desc = prompt('Description:', co.description); if(desc!==null) co.description = desc;
  var round = prompt('Offered by round:', co.offeredByRound); if(round!==null) co.offeredByRound = parseInt(round)||1;
  var dur = prompt('Duration (rounds, 0=permanent):', co.duration||0); if(dur!==null) co.duration = parseInt(dur)||0;
  populateCoalitions(); setDirty();
}
function addCoalition(){
  if(!GD.coalitionOffers) GD.coalitionOffers = [];
  GD.coalitionOffers.push({id:'coal_'+Date.now(),name:'New Coalition',description:'Description...',offeredByRound:1,benefits:{perRound:{trust:2}},constraints:[{type:'maintainStat',stat:'trust',above:40,description:'Must maintain trust above 40'}],violationPenalty:{effects:{trust:-5},text:'The coalition has ended.'},duration:0});
  populateCoalitions(); setDirty();
}
function deleteCoalition(i){
  if(!confirm('Delete this coalition offer?')) return;
  GD.coalitionOffers.splice(i,1); populateCoalitions(); setDirty();
}

// ═══ ADVISOR QUOTES ON SCENARIO FORMS ═══
// Full advisor quotes editor with recommendation fields (Phase 5)
function renderAdvisorQuotesEditor(scenario, si, prefix){
  var hs = scenario.highStakes ? 'checked' : '';
  var quotes = scenario.advisorQuotes || [];
  var pool = GD.advisorPool || [];
  var choices = scenario.choices || [];
  var stats = GD.stats || [];
  var html = '<div class="form-section" style="margin-top:12px"><label><input type="checkbox" class="hs-check" '+hs+' /> High Stakes (show advisor quotes)</label>';
  html += '<div class="aq-list" style="margin-top:8px">';
  quotes.forEach(function(q, qi){
    var adv = pool.find(function(a){return a.id===q.advisorId}) || {};
    html += '<div class="aq-item" style="border:1px solid var(--border);padding:10px;margin:6px 0;background:var(--white)">';
    // Row 1: advisor select + delete
    html += '<div style="display:flex;gap:8px;align-items:center;margin-bottom:6px">';
    html += '<select class="aq-advisor" id="'+prefix+'-aqadv-'+si+'-'+qi+'" style="font-size:12px;padding:4px;min-width:160px">';
    html += '<option value="">— Select Advisor —</option>';
    pool.forEach(function(a){ html += '<option value="'+a.id+'"'+(q.advisorId===a.id?' selected':'')+'>'+a.emoji+' '+esc(a.name)+'</option>'; });
    html += '</select>';
    html += '<button class="btn btn-danger btn-sm" style="margin-left:auto;padding:3px 8px;font-size:10px" onclick="deleteAdvisorQuote('+si+','+qi+',\''+prefix+'\')">✕</button>';
    html += '</div>';
    // Row 2: quote text
    html += '<div class="form-group" style="margin-bottom:8px"><label>Quote Text</label><textarea class="aq-text" id="'+prefix+'-aqtext-'+si+'-'+qi+'" rows="2" style="font-size:12px">'+esc(q.text||'')+'</textarea></div>';
    // Row 3: recommendation fields
    html += '<div class="form-row three" style="margin-bottom:6px">';
    html += '<div class="form-group"><label>Recommends Choice</label><select id="'+prefix+'-aqrec-'+si+'-'+qi+'" style="font-size:12px">';
    html += '<option value=""'+(q.recommendsChoice==null?' selected':'')+'>None</option>';
    choices.forEach(function(c,ci){ html += '<option value="'+ci+'"'+(q.recommendsChoice===ci?' selected':'')+'>'+String.fromCharCode(65+ci)+': '+esc((c.text||'').substring(0,35))+'</option>'; });
    html += '</select></div>';
    html += '<div class="form-group"><label>Explicit?</label><select id="'+prefix+'-aqexpl-'+si+'-'+qi+'" style="font-size:12px"><option value="true"'+(q.explicit!==false?' selected':'')+'>Yes — show badge</option><option value="false"'+(q.explicit===false?' selected':'')+'>No — hidden</option></select></div>';
    html += '</div>';
    // Row 4: effect modifier per stat
    html += '<div style="margin-top:4px"><label style="font-size:9px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:var(--muted);display:block;margin-bottom:4px">Effect Modifier (bonus when player picks recommended choice)</label>';
    html += '<div class="stat-inputs cols-4" style="margin-bottom:0">'+stats.map(function(s){
      return '<div class="stat-input-group"><label>'+s.label+'</label><input type="number" id="'+prefix+'-aqefx-'+si+'-'+qi+'-'+s.id+'" value="'+((q.effectModifier||{})[s.id]||0)+'" style="font-size:12px;padding:5px" /></div>';
    }).join('')+'</div>';
    html += '</div>';
    html += '</div>'; // end .aq-item
  });
  html += '</div><button class="add-btn" style="font-size:11px;margin-top:4px" onclick="addAdvisorQuote('+si+',\''+prefix+'\')">+ Add Advisor Quote</button></div>';
  return html;
}

function addAdvisorQuote(si, prefix){
  var list = prefix==='sc'?GD.scenarios:GD.inboxScenarios;
  var s = list[si]; if(!s) return;
  if(!s.advisorQuotes) s.advisorQuotes = [];
  s.advisorQuotes.push({advisorId:'',text:'',recommendsChoice:null,effectModifier:{},explicit:true});
  setDirty();
  prefix==='sc'?populateScenarios():populateInbox();
}

function deleteAdvisorQuote(si, qi, prefix){
  var list = prefix==='sc'?GD.scenarios:GD.inboxScenarios;
  var s = list[si]; if(!s||!s.advisorQuotes) return;
  s.advisorQuotes.splice(qi,1);
  setDirty();
  prefix==='sc'?populateScenarios():populateInbox();
}

function readAdvisorQuotes(si, prefix){
  var list = prefix==='sc'?GD.scenarios:GD.inboxScenarios;
  var s = list[si]; if(!s) return [];
  var existing = s.advisorQuotes || [];
  var stats = GD.stats || [];
  var quotes = [];
  var qi = 0;
  while(document.getElementById(prefix+'-aqadv-'+si+'-'+qi)){
    var advisorId = document.getElementById(prefix+'-aqadv-'+si+'-'+qi).value;
    var text = document.getElementById(prefix+'-aqtext-'+si+'-'+qi).value;
    var recVal = document.getElementById(prefix+'-aqrec-'+si+'-'+qi).value;
    var recommendsChoice = recVal==='' ? null : parseInt(recVal);
    var explicit = document.getElementById(prefix+'-aqexpl-'+si+'-'+qi).value !== 'false';
    var effectModifier = {};
    stats.forEach(function(st){
      var v = parseInt(document.getElementById(prefix+'-aqefx-'+si+'-'+qi+'-'+st.id)?.value)||0;
      if(v) effectModifier[st.id] = v;
    });
    quotes.push({advisorId:advisorId,text:text,recommendsChoice:recommendsChoice,effectModifier:effectModifier,explicit:explicit});
    qi++;
  }
  return quotes;
}

// ═══ CONVERSATION BUILDER PANEL ═══

function populateConversations(){
  var list = document.getElementById('conversations-list');
  if(!list) return;
  var convs = GD.conversations || [];
  list.innerHTML = convs.map(function(c,i){
    return renderConversationCard(c,i) + renderConversationForm(c,i);
  }).join('');
}

function renderConversationCard(c, i){
  var typeBadge = c.type==='advisor' ?
    '<span class="tag tag-blue">Advisor</span>' :
    '<span class="tag tag-green">Character</span>';
  var charName = '';
  if(c.type==='advisor'){
    var adv = (GD.advisorPool||[]).find(function(a){return a.id===c.advisorId});
    charName = adv ? adv.emoji+' '+adv.name : c.advisorId||'(unlinked)';
  } else {
    charName = (c.character||{}).emoji+' '+(c.character||{}).name || '(unnamed)';
  }
  var trig = c.trigger||{};
  var trigDesc = trig.type||'?';
  if(trig.scenarioId) trigDesc += ' → '+trig.scenarioId;
  if(trig.choiceIndex!=null) trigDesc += ' [choice '+trig.choiceIndex+']';
  var nodeCount = Object.keys(c.nodes||{}).length;
  var outcomeCount = (c.outcomes||[]).length;
  return '<div class="item-card" id="conv-card-'+i+'" onclick="toggleEdit(\'conv\','+i+')">'+
    '<span class="expand-icon" id="conv-exp-'+i+'">▸</span>'+
    '<div class="item-card-info"><div class="item-card-name">'+esc(c.id)+'</div>'+
    '<div class="item-card-desc">'+typeBadge+' '+esc(charName)+' · '+esc(trigDesc)+' · '+nodeCount+' nodes · '+outcomeCount+' outcomes</div></div>'+
    '<div class="item-card-actions"><button class="btn btn-danger btn-sm" onclick="event.stopPropagation();deleteConversation('+i+')">Delete</button></div></div>';
}

function renderConversationForm(c, i){
  var stats = GD.stats||[];
  var pool = GD.advisorPool||[];
  var scenarios = GD.scenarios||[];
  var orgs = GD.organizations||[];
  var trig = c.trigger||{};
  var char = c.character||{};
  var applicableOrgs = c.applicableOrgs||[];
  var nodeIds = Object.keys(c.nodes||{});
  var nodeEntries = nodeIds.map(function(nid){ return {id:nid, node:c.nodes[nid]}; });

  var html = '<div class="item-edit-form" id="conv-form-'+i+'" style="display:none">';

  // ── Basic Info ──
  html += '<div class="form-row three">';
  html += '<div class="form-group"><label>ID</label><input id="conv-id-'+i+'" value="'+esc(c.id)+'" /></div>';
  html += '<div class="form-group"><label>Type</label><select id="conv-type-'+i+'" onchange="convTypeChanged('+i+')">';
  html += '<option value="character"'+(c.type==='character'?' selected':'')+'>Character</option>';
  html += '<option value="advisor"'+(c.type==='advisor'?' selected':'')+'>Advisor</option>';
  html += '</select></div>';
  html += '<div class="form-group"><label>Start Disposition (0-100)</label><input type="number" id="conv-startdisp-'+i+'" value="'+(c.startDisposition||50)+'" min="0" max="100" /></div>';
  html += '</div>';

  // ── Applicable Orgs ──
  html += '<div style="margin-bottom:10px"><label style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);display:block;margin-bottom:4px">Applicable Orgs</label>';
  html += '<div class="checkbox-grid">';
  orgs.forEach(function(o){
    html += '<label class="checkbox-item"><input type="checkbox" id="conv-org-'+i+'-'+o.id+'" '+(applicableOrgs.includes(o.id)?'checked':'')+' />'+esc(o.name||o.id)+'</label>';
  });
  html += '</div></div>';

  // ── Character Info (shown when type=character) ──
  html += '<div id="conv-charblock-'+i+'" style="display:'+(c.type==='character'?'block':'none')+';border:1px solid var(--border);padding:10px;margin-bottom:10px;background:#f9f8f5">';
  html += '<label style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);display:block;margin-bottom:6px">Character Info</label>';
  html += '<div class="form-row four">';
  html += '<div class="form-group"><label>Name</label><input id="conv-charname-'+i+'" value="'+esc(char.name||'')+'" /></div>';
  html += '<div class="form-group"><label>Emoji</label><input id="conv-charemoji-'+i+'" value="'+esc(char.emoji||'')+'" style="font-size:18px" /></div>';
  html += '<div class="form-group"><label>Role</label><input id="conv-charrole-'+i+'" value="'+esc(char.role||'')+'" /></div>';
  html += '</div>';
  html += '<div class="form-group" style="margin-bottom:0"><label>Context</label><input id="conv-charctx-'+i+'" value="'+esc(char.context||'')+'" /></div>';
  html += '</div>';

  // ── Advisor Link (shown when type=advisor) ──
  html += '<div id="conv-advblock-'+i+'" style="display:'+(c.type==='advisor'?'block':'none')+';margin-bottom:10px">';
  html += '<div class="form-group"><label>Linked Advisor</label><select id="conv-advid-'+i+'">';
  html += '<option value="">— Select Advisor —</option>';
  pool.forEach(function(a){
    html += '<option value="'+a.id+'"'+(c.advisorId===a.id?' selected':'')+'>'+a.emoji+' '+esc(a.name)+' ('+a.id+')</option>';
  });
  html += '</select></div></div>';

  // ── Trigger Config ──
  html += '<div style="border:1px solid var(--border);padding:10px;margin-bottom:10px;background:#f5f5ff">';
  html += '<label style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);display:block;margin-bottom:6px">Trigger</label>';
  html += '<div class="form-row three">';
  html += '<div class="form-group"><label>Type</label><select id="conv-trigtype-'+i+'">';
  ['afterScenario','beforeScenario','roundStart','standalone'].forEach(function(t){
    html += '<option value="'+t+'"'+(trig.type===t?' selected':'')+'>'+t+'</option>';
  });
  html += '</select></div>';
  html += '<div class="form-group"><label>Scenario ID</label><select id="conv-trigscn-'+i+'">';
  html += '<option value="">— None —</option>';
  scenarios.forEach(function(s){
    html += '<option value="'+s.id+'"'+(trig.scenarioId===s.id?' selected':'')+'>'+esc(s.id)+' ('+esc(s.title||'')+')</option>';
  });
  html += '</select></div>';
  html += '<div class="form-group"><label>Choice Index</label><input type="number" id="conv-trigci-'+i+'" value="'+(trig.choiceIndex!=null?trig.choiceIndex:'')+'" placeholder="blank = any" min="0" max="10" /></div>';
  html += '</div></div>';

  // ── Node Editor ──
  html += '<div style="margin-bottom:12px">';
  html += '<label style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--ink);display:block;margin-bottom:8px">Nodes ('+nodeEntries.length+')</label>';
  nodeEntries.forEach(function(entry, ni){
    html += renderConvNodeEditor(i, ni, entry.id, entry.node, nodeIds);
  });
  html += '<button class="add-btn" style="font-size:11px;margin-top:6px" onclick="addConvNode('+i+')">+ Add Node</button>';
  html += '</div>';

  // ── Outcomes Editor ──
  html += '<div style="margin-bottom:12px">';
  html += '<label style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--ink);display:block;margin-bottom:8px">Outcomes ('+(c.outcomes||[]).length+')</label>';
  (c.outcomes||[]).forEach(function(o, oi){
    html += renderConvOutcomeEditor(i, oi, o, c.type);
  });
  html += '<button class="add-btn" style="font-size:11px;margin-top:6px" onclick="addConvOutcome('+i+')">+ Add Outcome</button>';
  html += '</div>';

  // ── Save Button ──
  html += '<div style="margin-top:14px"><button class="btn btn-primary btn-sm" onclick="saveConversation('+i+')">Save Conversation</button></div>';
  html += '</div>';
  return html;
}

function renderConvNodeEditor(ci, ni, nodeId, node, allNodeIds){
  var responses = node.responses||[];
  var html = '<div style="border:1px solid var(--border);padding:10px;margin-bottom:8px;background:var(--white)">';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">';
  html += '<span style="font-family:\'Merriweather\',serif;font-weight:900;font-size:14px;color:var(--gold)">Node '+ni+'</span>';
  html += '<button class="btn btn-danger btn-sm" style="padding:3px 8px;font-size:10px" onclick="deleteConvNode('+ci+','+ni+')">✕ Delete Node</button>';
  html += '</div>';
  html += '<div class="form-group" style="margin-bottom:6px"><label>Node ID</label><input id="conv-nid-'+ci+'-'+ni+'" value="'+esc(nodeId)+'" style="font-family:monospace;font-size:12px" /></div>';
  html += '<div class="form-group" style="margin-bottom:8px"><label>Character Line</label><textarea id="conv-nline-'+ci+'-'+ni+'" rows="3" style="font-size:12px">'+esc(node.characterLine||'')+'</textarea></div>';

  // Responses
  html += '<label style="font-size:9px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:var(--muted);display:block;margin-bottom:4px">Responses ('+responses.length+')</label>';
  responses.forEach(function(r, ri){
    html += '<div style="border:1px dashed var(--border);padding:8px;margin-bottom:6px;background:#fafaf7">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">';
    html += '<span style="font-size:11px;font-weight:700;color:var(--gold)">Response '+String.fromCharCode(65+ri)+'</span>';
    html += '<button class="btn btn-danger btn-sm" style="padding:2px 6px;font-size:9px" onclick="deleteConvResponse('+ci+','+ni+','+ri+')">✕</button>';
    html += '</div>';
    html += '<div class="form-group" style="margin-bottom:4px"><label>Text</label><textarea id="conv-rtext-'+ci+'-'+ni+'-'+ri+'" rows="2" style="font-size:12px">'+esc(r.text||'')+'</textarea></div>';
    html += '<div class="form-row three">';
    html += '<div class="form-group"><label>Approach</label><input id="conv-rappr-'+ci+'-'+ni+'-'+ri+'" value="'+esc(r.approach||'')+'" style="font-size:12px" /></div>';
    html += '<div class="form-group"><label>Disposition Δ</label><input type="number" id="conv-rdelta-'+ci+'-'+ni+'-'+ri+'" value="'+(r.dispositionDelta||0)+'" style="font-size:12px" /></div>';
    html += '<div class="form-group"><label>Next Node</label><select id="conv-rnext-'+ci+'-'+ni+'-'+ri+'" style="font-size:12px">';
    html += '<option value="end"'+(r.next==='end'?' selected':'')+'>— end —</option>';
    allNodeIds.forEach(function(nid){
      html += '<option value="'+nid+'"'+(r.next===nid?' selected':'')+'>'+esc(nid)+'</option>';
    });
    html += '</select></div>';
    html += '</div>';
    html += '</div>';
  });
  html += '<button class="add-btn" style="font-size:10px;padding:4px 8px;margin-top:2px" onclick="addConvResponse('+ci+','+ni+')">+ Add Response</button>';
  html += '</div>';
  return html;
}

function renderConvOutcomeEditor(ci, oi, o, convType){
  var stats = GD.stats||[];
  var html = '<div style="border:1px solid var(--border);padding:10px;margin-bottom:6px;background:#f8f5ee">';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">';
  html += '<span style="font-size:11px;font-weight:700;color:var(--gold)">Outcome '+(oi+1)+'</span>';
  html += '<button class="btn btn-danger btn-sm" style="padding:2px 6px;font-size:9px" onclick="deleteConvOutcome('+ci+','+oi+')">✕</button>';
  html += '</div>';
  html += '<div class="form-row three" style="margin-bottom:6px">';
  html += '<div class="form-group"><label>Min Disposition</label><input type="number" id="conv-omin-'+ci+'-'+oi+'" value="'+(o.minDisposition||0)+'" min="0" max="100" /></div>';
  html += '<div class="form-group"><label>Heading</label><input id="conv-ohead-'+ci+'-'+oi+'" value="'+esc(o.heading||'')+'" /></div>';
  html += '<div class="form-group"><label>Budget Effect</label><input type="number" id="conv-obudget-'+ci+'-'+oi+'" value="'+(o.budgetEffect||0)+'" /></div>';
  html += '</div>';
  html += '<div class="form-group" style="margin-bottom:6px"><label>Text</label><textarea id="conv-otext-'+ci+'-'+oi+'" rows="2" style="font-size:12px">'+esc(o.text||'')+'</textarea></div>';
  // Stat effects
  html += '<div style="margin-bottom:6px"><label style="font-size:9px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:var(--muted);display:block;margin-bottom:4px">Stat Effects</label>';
  html += '<div class="stat-inputs cols-4">'+stats.map(function(s){
    return '<div class="stat-input-group"><label>'+s.label+'</label><input type="number" id="conv-oefx-'+ci+'-'+oi+'-'+s.id+'" value="'+((o.effects||{})[s.id]||0)+'" style="font-size:12px;padding:5px" /></div>';
  }).join('')+'</div></div>';
  // Advisor bonus multiplier (only for advisor type)
  html += '<div id="conv-oadvmod-wrap-'+ci+'-'+oi+'" style="display:'+(convType==='advisor'?'block':'none')+'">';
  html += '<div class="form-group"><label>Modifies Advisor Bonus (multiplier)</label><input type="number" step="0.5" id="conv-oadvmod-'+ci+'-'+oi+'" value="'+(o.modifiesAdvisorBonus!=null?o.modifiesAdvisorBonus:'')+'" placeholder="e.g. 1.5" /></div>';
  html += '</div>';
  html += '</div>';
  return html;
}

function convTypeChanged(i){
  var type = document.getElementById('conv-type-'+i).value;
  var charBlock = document.getElementById('conv-charblock-'+i);
  var advBlock = document.getElementById('conv-advblock-'+i);
  if(charBlock) charBlock.style.display = type==='character'?'block':'none';
  if(advBlock) advBlock.style.display = type==='advisor'?'block':'none';
  // Toggle advisor bonus fields on outcomes
  var convs = GD.conversations||[];
  var outcomes = (convs[i]||{}).outcomes||[];
  outcomes.forEach(function(_,oi){
    var wrap = document.getElementById('conv-oadvmod-wrap-'+i+'-'+oi);
    if(wrap) wrap.style.display = type==='advisor'?'block':'none';
  });
}

function saveConversation(i){
  var convs = GD.conversations;
  if(!convs||!convs[i]) return;
  var c = convs[i];
  c.id = document.getElementById('conv-id-'+i).value||c.id;
  c.type = document.getElementById('conv-type-'+i).value;
  c.startDisposition = parseInt(document.getElementById('conv-startdisp-'+i).value)||50;

  // Applicable orgs
  var orgs = GD.organizations||[];
  c.applicableOrgs = orgs.map(function(o){return o.id;}).filter(function(oid){
    var el = document.getElementById('conv-org-'+i+'-'+oid);
    return el && el.checked;
  });

  // Character / advisor
  if(c.type==='character'){
    c.character = {
      name: document.getElementById('conv-charname-'+i).value||'',
      emoji: document.getElementById('conv-charemoji-'+i).value||'',
      role: document.getElementById('conv-charrole-'+i).value||'',
      context: document.getElementById('conv-charctx-'+i).value||''
    };
    delete c.advisorId;
  } else {
    c.advisorId = document.getElementById('conv-advid-'+i).value||'';
    delete c.character;
  }

  // Trigger
  var trigType = document.getElementById('conv-trigtype-'+i).value;
  var trigScn = document.getElementById('conv-trigscn-'+i).value;
  var trigCi = document.getElementById('conv-trigci-'+i).value;
  c.trigger = { type: trigType };
  if(trigScn) c.trigger.scenarioId = trigScn;
  if(trigCi!=='') c.trigger.choiceIndex = parseInt(trigCi);
  else c.trigger.choiceIndex = null;

  // Nodes - read from DOM
  var newNodes = {};
  var ni = 0;
  while(document.getElementById('conv-nid-'+i+'-'+ni)){
    var nodeId = document.getElementById('conv-nid-'+i+'-'+ni).value||('n'+ni);
    var charLine = document.getElementById('conv-nline-'+i+'-'+ni).value||'';
    var responses = [];
    var ri = 0;
    while(document.getElementById('conv-rtext-'+i+'-'+ni+'-'+ri)){
      responses.push({
        text: document.getElementById('conv-rtext-'+i+'-'+ni+'-'+ri).value||'',
        approach: document.getElementById('conv-rappr-'+i+'-'+ni+'-'+ri).value||'',
        dispositionDelta: parseInt(document.getElementById('conv-rdelta-'+i+'-'+ni+'-'+ri).value)||0,
        next: document.getElementById('conv-rnext-'+i+'-'+ni+'-'+ri).value||'end'
      });
      ri++;
    }
    newNodes[nodeId] = { characterLine:charLine, responses:responses };
    ni++;
  }
  c.nodes = newNodes;
  c.totalNodes = Object.keys(newNodes).length;

  // Outcomes
  var outcomes = [];
  var oi = 0;
  while(document.getElementById('conv-omin-'+i+'-'+oi)){
    var effects = {};
    (GD.stats||[]).forEach(function(s){
      var v = parseInt(document.getElementById('conv-oefx-'+i+'-'+oi+'-'+s.id)?.value)||0;
      if(v) effects[s.id] = v;
    });
    var out = {
      minDisposition: parseInt(document.getElementById('conv-omin-'+i+'-'+oi).value)||0,
      heading: document.getElementById('conv-ohead-'+i+'-'+oi).value||'',
      text: document.getElementById('conv-otext-'+i+'-'+oi).value||'',
      effects: effects,
      budgetEffect: parseInt(document.getElementById('conv-obudget-'+i+'-'+oi).value)||0
    };
    // Advisor bonus multiplier
    var advModEl = document.getElementById('conv-oadvmod-'+i+'-'+oi);
    if(advModEl && advModEl.value!==''){
      out.modifiesAdvisorBonus = parseFloat(advModEl.value);
    }
    outcomes.push(out);
    oi++;
  }
  c.outcomes = outcomes;

  setDirty(); setStatus('Conversation saved.','success'); populateConversations();
}

function addConversation(){
  if(!GD.conversations) GD.conversations = [];
  GD.conversations.push({
    id: 'conv_'+Date.now(),
    type: 'character',
    character: {name:'New Character',emoji:'👤',role:'Role',context:''},
    trigger: {type:'afterScenario',scenarioId:'',choiceIndex:null},
    applicableOrgs: [],
    startDisposition: 50,
    totalNodes: 1,
    nodes: {
      n0: { characterLine:'Enter character dialogue here...', responses:[
        {text:'Response option',approach:'Approach',dispositionDelta:0,next:'end'}
      ]}
    },
    outcomes: [
      {minDisposition:0,heading:'Default Outcome',text:'Outcome text.',effects:{},budgetEffect:0}
    ]
  });
  setDirty(); populateConversations();
}

function deleteConversation(i){
  if(!confirm('Delete this conversation?')) return;
  (GD.conversations||[]).splice(i,1);
  setDirty(); populateConversations();
}

function addConvNode(ci){
  var convs = GD.conversations||[];
  var c = convs[ci]; if(!c) return;
  if(!c.nodes) c.nodes = {};
  var existingIds = Object.keys(c.nodes);
  var newId = 'n'+existingIds.length;
  while(c.nodes[newId]) newId = 'n'+(parseInt(newId.replace('n',''))+1);
  c.nodes[newId] = { characterLine:'', responses:[{text:'',approach:'',dispositionDelta:0,next:'end'}] };
  c.totalNodes = Object.keys(c.nodes).length;
  setDirty(); populateConversations();
}

function deleteConvNode(ci, ni){
  var convs = GD.conversations||[];
  var c = convs[ci]; if(!c||!c.nodes) return;
  var nodeIds = Object.keys(c.nodes);
  if(nodeIds.length<=1){ alert('Cannot delete the last node.'); return; }
  if(!confirm('Delete node "'+nodeIds[ni]+'"?')) return;
  delete c.nodes[nodeIds[ni]];
  c.totalNodes = Object.keys(c.nodes).length;
  setDirty(); populateConversations();
}

function addConvResponse(ci, ni){
  var convs = GD.conversations||[];
  var c = convs[ci]; if(!c||!c.nodes) return;
  var nodeIds = Object.keys(c.nodes);
  var node = c.nodes[nodeIds[ni]]; if(!node) return;
  if(!node.responses) node.responses = [];
  node.responses.push({text:'',approach:'',dispositionDelta:0,next:'end'});
  setDirty(); populateConversations();
}

function deleteConvResponse(ci, ni, ri){
  var convs = GD.conversations||[];
  var c = convs[ci]; if(!c||!c.nodes) return;
  var nodeIds = Object.keys(c.nodes);
  var node = c.nodes[nodeIds[ni]]; if(!node||!node.responses) return;
  node.responses.splice(ri,1);
  setDirty(); populateConversations();
}

function addConvOutcome(ci){
  var convs = GD.conversations||[];
  var c = convs[ci]; if(!c) return;
  if(!c.outcomes) c.outcomes = [];
  c.outcomes.push({minDisposition:0,heading:'',text:'',effects:{},budgetEffect:0});
  setDirty(); populateConversations();
}

function deleteConvOutcome(ci, oi){
  var convs = GD.conversations||[];
  var c = convs[ci]; if(!c||!c.outcomes) return;
  c.outcomes.splice(oi,1);
  setDirty(); populateConversations();
}

// ═══ POPULATE ALL (override) ═══
function populateAllPanelsV2(){
  if(origPopulateAll) origPopulateAll();
  populateMomentumConfig();
  populateAdvisors();
  populateGazette();
  populateBreaking();
  populateCoalitions();
  populateConversations();
}
// Override the populate call
if(typeof populateAllPanels === 'function'){
  var _origPop = populateAllPanels;
  populateAllPanels = function(){
    _origPop();
    populateMomentumConfig();
    populateAdvisors();
    populateGazette();
    populateBreaking();
    populateCoalitions();
    populateConversations();
  };
}

// ═══ SAVE CONFIG HOOK ═══
var origSaveConfig = typeof saveConfig === 'function' ? saveConfig : null;
if(origSaveConfig){
  var _origSave = saveConfig;
  saveConfig = function(){
    _origSave();
    saveMomentumConfig();
  };
}


// ═══ SEGMENTS ═══
function populateSegments() {
  var segs = GD.config.segments || [];
  var grid = document.getElementById('segments-config-grid');
  if (!grid) return;
  grid.innerHTML = segs.map(function(seg, i) {
    return '<div class="seg-config-card">' +
      '<h4>' + esc(seg.name) + ' <span style="font-size:10px;color:var(--muted)">('+seg.id+')</span></h4>' +
      '<div class="form-row three">' +
      '<div class="form-group"><label>Pop Baseline %</label><input type="number" id="seg-pop-'+i+'" value="'+seg.populationBaseline+'" min="1" max="50" /></div>' +
      '<div class="form-group"><label>Political Center</label><input type="number" id="seg-pol-'+i+'" value="'+seg.politicalCenter+'" min="0" max="100" /></div>' +
      '<div class="form-group"><label>Comfort Range</label><input type="number" id="seg-comfort-'+i+'" value="'+(seg.comfortRange||20)+'" min="5" max="50" /></div>' +
      '</div>' +
      '<div class="form-row three">' +
      '<div class="form-group"><label>Base Start Approval</label><input type="number" id="seg-base-'+i+'" value="'+seg.baseStartApproval+'" min="20" max="80" /></div>' +
      '<div class="form-group"><label>Donation Rate</label><input type="number" step="0.01" id="seg-don-'+i+'" value="'+seg.donationRate+'" min="0" max="1" /></div>' +
      '<div class="form-group"><label>Floor / Ceiling</label><input id="seg-fc-'+i+'" value="'+seg.floor+'/'+seg.ceiling+'" /></div>' +
      '</div>' +
      '</div>';
  }).join('');
}

function saveSegments() {
  var segs = GD.config.segments || [];
  segs.forEach(function(seg, i) {
    seg.populationBaseline = parseInt(document.getElementById('seg-pop-'+i).value) || seg.populationBaseline;
    seg.politicalCenter = parseInt(document.getElementById('seg-pol-'+i).value) || seg.politicalCenter;
    seg.comfortRange = parseInt(document.getElementById('seg-comfort-'+i).value) || 20;
    seg.baseStartApproval = parseInt(document.getElementById('seg-base-'+i).value) || seg.baseStartApproval;
    seg.donationRate = parseFloat(document.getElementById('seg-don-'+i).value) || seg.donationRate;
    var fc = (document.getElementById('seg-fc-'+i).value || '').split('/');
    if (fc.length === 2) { seg.floor = parseInt(fc[0])||5; seg.ceiling = parseInt(fc[1])||30; }
  });
  localStorage.setItem('gd_cache', JSON.stringify(GD));
  showToast('Segment config saved', 'success');
}

// Add segment weight editor to org forms
function renderSegWeightsEditor(orgObj, orgIdx, prefix) {
  var segs = GD.config.segments || [];
  var weights = orgObj.segmentWeights || {};
  var html = '<div style="margin-top:10px;margin-bottom:10px"><label style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);display:block;margin-bottom:6px">Segment Weights (must sum to 100%)</label>';
  html += '<div class="seg-weights-grid">';
  segs.forEach(function(seg) {
    var v = weights[seg.id] || Math.round(100 / segs.length);
    html += '<div class="seg-weight-item"><label>' + esc(seg.name) + ' (' + seg.floor + '-' + seg.ceiling + '%)</label>';
    html += '<input type="number" id="' + prefix + '-segw-' + orgIdx + '-' + seg.id + '" value="' + v + '" min="' + (seg.floor||0) + '" max="' + (seg.ceiling||100) + '" onchange="validateSegWeights(\'' + prefix + '\',' + orgIdx + ')" /></div>';
  });
  html += '</div>';
  html += '<div class="seg-weight-total" id="' + prefix + '-segwtotal-' + orgIdx + '">Total: calculating...</div>';
  html += '</div>';
  return html;
}

function validateSegWeights(prefix, idx) {
  var segs = GD.config.segments || [];
  var total = 0;
  segs.forEach(function(seg) {
    var el = document.getElementById(prefix + '-segw-' + idx + '-' + seg.id);
    if (el) total += parseInt(el.value) || 0;
  });
  var totalEl = document.getElementById(prefix + '-segwtotal-' + idx);
  if (totalEl) {
    totalEl.textContent = 'Total: ' + total + '%';
    totalEl.className = 'seg-weight-total ' + (total === 100 ? 'valid' : 'invalid');
  }
}

function readSegWeights(prefix, idx) {
  var segs = GD.config.segments || [];
  var weights = {};
  segs.forEach(function(seg) {
    var el = document.getElementById(prefix + '-segw-' + idx + '-' + seg.id);
    if (el) weights[seg.id] = parseInt(el.value) || 0;
  });
  return weights;
}

// Add communityConsensus to scenario forms
function renderConsensusField(scenario, si, prefix) {
  var val = scenario.communityConsensus !== undefined ? scenario.communityConsensus : 0.5;
  return '<div class="form-group" style="margin-bottom:8px"><label>Community Consensus (0=max divergence, 1=full agreement)</label>' +
    '<div style="display:flex;align-items:center;gap:8px">' +
    '<input type="range" class="consensus-slider" id="' + prefix + '-consensus-' + si + '" min="0" max="1" step="0.05" value="' + val + '" oninput="document.getElementById(\'' + prefix + '-consensus-val-' + si + '\').textContent=this.value" />' +
    '<span class="consensus-val" id="' + prefix + '-consensus-val-' + si + '">' + val + '</span>' +
    '</div></div>';
}

// Add per-segment override fields to choice editor
function renderSegOverrides(choice, si, ci, prefix) {
  var segs = GD.config.segments || [];
  var overrides = choice.segmentOverrides || {};
  var hasAny = Object.keys(overrides).length > 0;
  var html = '<details style="margin-top:6px"><summary style="font-size:10px;font-weight:600;cursor:pointer;color:var(--gold)">Segment Overrides (optional' + (hasAny ? ' — ' + Object.keys(overrides).length + ' set' : '') + ')</summary>';
  html += '<div class="seg-override-grid">';
  segs.forEach(function(seg) {
    var v = overrides[seg.id] !== undefined ? overrides[seg.id] : '';
    html += '<div><label>' + seg.name + '</label><input type="number" id="' + prefix + '-segov-' + si + '-' + ci + '-' + seg.id + '" value="' + v + '" placeholder="auto" /></div>';
  });
  html += '</div></details>';
  return html;
}

function readSegOverrides(prefix, si, ci) {
  var segs = GD.config.segments || [];
  var overrides = {};
  segs.forEach(function(seg) {
    var el = document.getElementById(prefix + '-segov-' + si + '-' + ci + '-' + seg.id);
    if (el && el.value !== '') {
      overrides[seg.id] = parseInt(el.value) || 0;
    }
  });
  return Object.keys(overrides).length > 0 ? overrides : undefined;
}

