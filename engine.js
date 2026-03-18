function esc(s){if(!s)return '';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function advPortrait(adv, mood, size, shape) {
  if (!adv) return '';
  size = size || 36;
  mood = mood || 'neutral';
  shape = shape || 'circle';
  if (adv.portrait) {
    var radius = shape === 'circle' ? '50%' : '6px';
    var h = shape === 'square' ? Math.round(size * 1.15) : size;
    return '<img src="' + adv.portrait + '/' + mood + '.png" style="width:' + size + 'px;height:' + h + 'px;object-fit:cover;object-position:top;border-radius:' + radius + ';vertical-align:middle" alt="' + esc(adv.name) + '">';
  }
  return '<span style="font-size:' + size + 'px;line-height:1;vertical-align:middle">' + (adv.emoji || '') + '</span>';
}

// ═══════════════ SAVE / RESUME ═══════════════
function saveGame() {
  try { localStorage.setItem('ad_save', JSON.stringify(G)); } catch(e) {}
}
function hasSavedGame() {
  return !!localStorage.getItem('ad_save');
}
function loadSavedGame() {
  var saved = localStorage.getItem('ad_save');
  if (!saved) return false;
  try {
    G = JSON.parse(saved);
    showScreen('game-screen');
    initTicker();
    renderMain();
    updateHUD();
    renderInvestStrip();
    return true;
  } catch(e) {
    localStorage.removeItem('ad_save');
    return false;
  }
}
function clearSave() {
  localStorage.removeItem('ad_save');
}

// ═══════════════ STATE ═══════════════
let G = {
  charName:'', charEmoji:'', charTraits:[], orgId:null,
  missionId:null, priorities:{}, stats:{}, missionStars:0,
  round:0, apRemaining:0, history:[], pendingQueue:[],
  roundActions:[], usedScenarioIds:[], usedInboxIds:[],
  channelQueues: { monitor: [], folder: [], keys: [] },
  phoneMessages: [],
  activeUnlocks:[], promotionLevel:0,
  actionsThisRound:0, inboxDelivered:0,
  roundInboxQueue:[], pendingInbox:[],
  // Persistent inbox
  inboxMessages:[], // {id, scenario, unread, expired, timerRemaining}
  // Coalition strikes
  coalitionStrikes:{}, // {coalitionId: strikeCount}
  // Budget system
  budget: 0, budgetMax: 100, budgetIncomeThisYear: 0, budgetSpentThisYear: 0,
  investmentPool: 0, investmentsUsed: 0, pendingReserves: [],
  _allocBudget: 100, _allocMin: 1, _allocMax: 55,
  // Political clout system
  politicalPosition: 50, // 0=far-left, 50=center, 100=far-right
  politicalClout: 20, // 0-100, total political capital accumulated
  // Advisor system
  selectedAdvisors: [],
  advisorBonusLog: [],
  currentAdvisorBonusMultiplier: 1.0
};

// ═══════════════ UTILS ═══════════════

// Backward-compat: migrate advisors → advisorPool
if (!GAME_DATA.advisorPool && GAME_DATA.advisors) {
  GAME_DATA.advisorPool = GAME_DATA.advisors.map(function(a) {
    return Object.assign({}, a, {
      type: 'internal',
      statModifiers: a.statModifiers || {},
      politicalLean: a.politicalLean || 0,
      cloutBonus: a.cloutBonus || 0,
      expertise: a.expertise || [],
      budgetBonus: a.budgetBonus || 0
    });
  });
}
if (!GAME_DATA.config.advisorSlots) GAME_DATA.config.advisorSlots = 3;
if (!GAME_DATA.config.advisorBonusStacking) GAME_DATA.config.advisorBonusStacking = 'best';
if (!GAME_DATA.conversations) GAME_DATA.conversations = [];
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  var isGame = (id === 'game-screen');
  var isIntro = (id === 'intro-screen');
  var strip = document.getElementById('invest-strip');
  var bannerEl = document.getElementById('hud-banner-el');
  var hudEl = document.getElementById('hud-el');
  var inboxStrip = document.getElementById('inbox-strip');
  var lpTicker = document.getElementById('lp-ticker');
  if(strip) strip.style.display = isGame ? '' : 'none';
  if(bannerEl) bannerEl.style.display = isGame ? '' : 'none';
  if(hudEl) hudEl.style.display = isGame ? '' : 'none';
  if(inboxStrip) inboxStrip.style.display = 'none';
  if(lpTicker) lpTicker.style.display = isIntro ? '' : 'none';
  if(isGame) setTimeout(function(){ updateHUD(); }, 10);
  if (id === 'advisor-screen') renderAdvisorSelection();
  if (id === 'budget-screen') initBudget(false);
  if (id === 'promo-budget-screen') initBudget(true);
  window.scrollTo(0,0);
}
function shuffle(arr) {
  const a=[...arr];
  for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}
  return a;
}
function barColor(v) {
  if(v>=80) return '#d4a843';
  if(v>=60) return '#4ade80';
  if(v>=40) return '#60a5fa';
  if(v>=25) return '#f59e0b';
  return '#ef4444';
}


// ═══ CONSTITUENCY SEGMENTS SYSTEM ═══
// Calculates starting segment approvals based on org political position
function initSegmentApprovals(orgId) {
  var segments = GAME_DATA.config.segments || [];
  var orgPos = G.politicalPosition || getOrgStartingPosition(orgId);
  G.segmentApproval = {};
  G.segmentHistory = {}; // track per-segment trends
  
  segments.forEach(function(seg) {
    var base = seg.baseStartApproval;
    // Political alignment adjustment: compare org position to segment center
    var diff = Math.abs(orgPos - seg.politicalCenter);
    var comfortRange = seg.comfortRange || 20;
    var maxAdj = 15;
    
    var adjustment;
    if (diff <= comfortRange / 3) {
      // Very close: positive bonus
      adjustment = maxAdj * (1 - diff / (comfortRange / 3)) * 0.8;
    } else if (diff <= comfortRange) {
      // Within comfort range: smaller penalty
      adjustment = -(diff - comfortRange / 3) / (comfortRange * 0.67) * (maxAdj * 0.6);
    } else {
      // Outside comfort range: sharper penalty
      var excess = diff - comfortRange;
      adjustment = -(maxAdj * 0.6) - (excess / 50) * (maxAdj * 0.4);
    }
    
    adjustment = Math.max(-maxAdj, Math.min(maxAdj, adjustment));
    G.segmentApproval[seg.id] = Math.max(5, Math.min(95, Math.round(base + adjustment)));
    G.segmentHistory[seg.id] = [];
  });
}

// Calculate weighted composite trust from segment approvals
function computeCompositeTrust() {
  var segments = GAME_DATA.config.segments || [];
  if (!segments.length || !G.segmentApproval) return G.stats.trust || 50;
  
  var allOrgs = (GAME_DATA.organizations || []).concat(GAME_DATA.nationalOrganizations || []);
  var org = allOrgs.find(function(o) { return o.id === G.orgId; });
  var weights = (org && org.segmentWeights) || {};
  
  var totalWeight = 0;
  var weightedSum = 0;
  segments.forEach(function(seg) {
    var w = weights[seg.id] || seg.populationBaseline;
    var approval = G.segmentApproval[seg.id] || 50;
    weightedSum += approval * w;
    totalWeight += w;
  });
  
  return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 50;
}

// Apply segment divergence based on communityConsensus and politicalLean
function applySegmentEffects(trustDelta, choice, scenario) {
  var segments = GAME_DATA.config.segments || [];
  if (!segments.length || !G.segmentApproval) return '';
  
  var consensus = (scenario && scenario.communityConsensus !== undefined) ? scenario.communityConsensus : 0.5;
  var lean = (choice && choice.politicalLean) || 0;
  var overrides = (choice && choice.segmentOverrides) || {};
  var divergence = 1 - consensus;
  var scalingFactor = 2.5; // controls how much segments diverge
  
  var chips = '';
  var allOrgs = (GAME_DATA.organizations || []).concat(GAME_DATA.nationalOrganizations || []);
  var org = allOrgs.find(function(o) { return o.id === G.orgId; });
  var weights = (org && org.segmentWeights) || {};
  
  segments.forEach(function(seg) {
    var segEffect;
    
    // Check for manual override
    if (overrides[seg.id] !== undefined) {
      segEffect = overrides[seg.id];
    } else if (lean === 0 && divergence < 0.1) {
      // No political signal + high consensus = flat effect
      segEffect = trustDelta;
    } else {
      // Consensus-based divergence formula
      // Convert politicalLean (-10 to +10) to position shift (0-100 scale)
      var choicePosition = 50 + lean * 5;
      // How well does this choice align with this segment?
      var segDist = Math.abs(choicePosition - seg.politicalCenter);
      var comfort = seg.comfortRange || 20;
      var alignmentBonus;
      
      if (segDist <= comfort / 2) {
        // Good alignment: bonus
        alignmentBonus = (1 - segDist / (comfort / 2)) * scalingFactor;
      } else if (segDist <= comfort) {
        // Neutral zone
        alignmentBonus = -(segDist - comfort / 2) / (comfort / 2) * scalingFactor * 0.5;
      } else {
        // Poor alignment: penalty that scales with distance
        alignmentBonus = -scalingFactor * 0.5 - ((segDist - comfort) / 30) * scalingFactor;
      }
      
      segEffect = trustDelta + (alignmentBonus * divergence * Math.abs(trustDelta > 0 ? Math.max(1, trustDelta / 3) : Math.min(-1, trustDelta / 3)));
    }
    
    segEffect = Math.round(segEffect);
    var old = G.segmentApproval[seg.id] || 50;
    G.segmentApproval[seg.id] = Math.max(0, Math.min(100, old + segEffect));
    
    // Track for trend arrows
    if (!G.segmentHistory[seg.id]) G.segmentHistory[seg.id] = [];
    G.segmentHistory[seg.id].push(segEffect);
  });
  
  // Update composite trust
  G.stats.trust = computeCompositeTrust();
  
  // Generate segment chips for UI
  var significantChanges = [];
  segments.forEach(function(seg) {
    var hist = G.segmentHistory[seg.id] || [];
    var lastChange = hist.length > 0 ? hist[hist.length - 1] : 0;
    var w = weights[seg.id] || seg.populationBaseline;
    if (Math.abs(lastChange) >= 3 && w >= 10) {
      significantChanges.push({ name: seg.name, delta: lastChange });
    }
  });
  
  // Show top 2-3 most impactful segment changes
  significantChanges.sort(function(a, b) { return Math.abs(b.delta) - Math.abs(a.delta); });
  significantChanges.slice(0, 3).forEach(function(sc) {
    var cls = sc.delta > 0 ? 'seg-chip-pos' : 'seg-chip-neg';
    chips += '<span class="seg-chip ' + cls + '">' + (sc.delta > 0 ? '+' : '') + sc.delta + ' ' + sc.name + '</span>';
  });
  
  return chips;
}

// Get segment trend arrow
function segmentTrend(segId) {
  var hist = (G.segmentHistory && G.segmentHistory[segId]) || [];
  if (hist.length < 2) return '<span class="seg-trend seg-trend-flat">→</span>';
  var recent = hist.slice(-3);
  var sum = recent.reduce(function(a, b) { return a + b; }, 0);
  if (sum > 2) return '<span class="seg-trend seg-trend-up">↑</span>';
  if (sum < -2) return '<span class="seg-trend seg-trend-dn">↓</span>';
  return '<span class="seg-trend seg-trend-flat">→</span>';
}

// Render segment tooltip HTML for HUD
function renderSegmentTooltip() {
  var segments = GAME_DATA.config.segments || [];
  if (!segments.length || !G.segmentApproval) return '';
  
  var allOrgs = (GAME_DATA.organizations || []).concat(GAME_DATA.nationalOrganizations || []);
  var org = allOrgs.find(function(o) { return o.id === G.orgId; });
  var weights = (org && org.segmentWeights) || {};
  
  var html = '<div class="seg-tooltip" id="seg-tooltip">';
  html += '<div class="seg-header"><span>Segment</span><span>Approval · Weight</span></div>';
  
  segments.forEach(function(seg) {
    var v = Math.round(G.segmentApproval[seg.id] || 50);
    var w = weights[seg.id] || seg.populationBaseline;
    var col = v >= 60 ? '#4ade80' : v >= 40 ? '#fbbf24' : '#f87171';
    html += '<div class="seg-row">';
    html += '<span class="seg-name">' + seg.name + '</span>';
    html += '<div class="seg-bar-wrap"><div class="seg-bar" style="width:' + v + '%;background:' + col + '"></div></div>';
    html += '<span class="seg-val" style="color:' + col + '">' + v + '</span>';
    html += '<span class="seg-weight">' + w + '%</span>';
    html += segmentTrend(seg.id);
    html += '</div>';
  });
  
  html += '</div>';
  return html;
}

// Record segment snapshot for history
function snapshotSegments() {
  if (!G.segmentApproval) return;
  var snap = {};
  Object.keys(G.segmentApproval).forEach(function(k) { snap[k] = G.segmentApproval[k]; });
  if (!G.segmentSnapshots) G.segmentSnapshots = [];
  G.segmentSnapshots.push({ round: G.round, approvals: snap });
}

// #2: Three-tier mission alignment
function getMissionAlignment(choice) {
  const al = Array.isArray(choice.missionAligned) ? choice.missionAligned : [];
  const op = Array.isArray(choice.missionOpposed) ? choice.missionOpposed : [];
  if (al.includes(G.missionId)) return 'aligned';
  if (op.includes(G.missionId)) return 'opposed';
  return 'neutral';
}

function missionBadgeHTML(choice) {
  const a = getMissionAlignment(choice);
  if (a === 'aligned') return '<span class="m-badge aligned">✓ Mission</span>';
  if (a === 'opposed') return '<span class="m-badge opposed">✗ Mission</span>';
  return ''; // neutral: no badge
}

// #7: Check if a scenario applies to current org
function scenarioApplies(scenario) {
  const allOrgs = [...GAME_DATA.organizations, ...GAME_DATA.nationalOrganizations];
  const org = allOrgs.find(o => o.id === G.orgId);
  if (!org) return false;
  
  // Check org level
  const level = scenario.orgLevel || 'both';
  const orgLvl = org.orgLevel || (GAME_DATA.nationalOrganizations.find(o=>o.id===G.orgId) ? 'national' : 'local');
  if (level !== 'both' && level !== orgLvl) return false;
  
  // Check categories
  const cats = scenario.categories || ['all'];
  if (cats.includes('all')) return true;
  const orgCats = org.scenarioCategories || org.politicalTilt || [];
  return cats.some(c => orgCats.includes(c));
}

// #7: Complexity-weighted scenario picking
function pickScenario(type) {
  const eligible = GAME_DATA.scenarios.filter(s =>
    !G.usedScenarioIds.includes(s.id) && scenarioApplies(s) && s.trigger === type
  );
  if (!eligible.length) {
    const any = GAME_DATA.scenarios.filter(s => !G.usedScenarioIds.includes(s.id) && scenarioApplies(s));
    return any.length ? weightedPick(any) : null;
  }
  return weightedPick(eligible);
}

function weightedPick(scenarios) {
  const totalRounds = GAME_DATA.config.totalRounds || 6;
  const targetComplexity = 1 + ((G.round - 1) / Math.max(1, totalRounds - 1)) * 4; // 1 to 5
  const weights = scenarios.map(s => {
    const c = s.complexity || 3;
    const dist = Math.abs(c - targetComplexity);
    return Math.max(0.1, 5 - dist); // Higher weight when closer to target
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < scenarios.length; i++) {
    r -= weights[i];
    if (r <= 0) return scenarios[i];
  }
  return scenarios[scenarios.length - 1];
}

// #6: Pick weighted outcome from a choice
function pickOutcome(choice) {
  const outcomes = choice.outcomes || [{text: choice.outcome || '', effects: choice.effects || {}, weight: 100, conditions: [], contextNote: ''}];
  if (outcomes.length === 1) return outcomes[0];
  
  // Calculate effective weights
  const effectiveWeights = outcomes.map(o => {
    let w = o.weight || 50;
    // Apply conditions
    (o.conditions || []).forEach(cond => {
      if (cond.type === 'stat') {
        const val = G.stats[cond.stat] || 0;
        if (cond.operator === 'above' && val > cond.threshold) w += cond.modifier || 0;
        if (cond.operator === 'below' && val < cond.threshold) w += cond.modifier || 0;
      } else if (cond.type === 'missionStars') {
        w += (G.missionStars * (cond.perStar || 0));
      }
    });
    return Math.max(0, w);
  });
  
  const total = effectiveWeights.reduce((a, b) => a + b, 0);
  if (total === 0) return outcomes[0];
  let r = Math.random() * total;
  for (let i = 0; i < outcomes.length; i++) {
    r -= effectiveWeights[i];
    if (r <= 0) return outcomes[i];
  }
  return outcomes[outcomes.length - 1];
}

// ═══════════════ INIT INTRO ═══════════════
function checkPassword() {
  var pw = document.getElementById('pw-input').value;
  var correct = GAME_DATA.config.gamePassword || '';
  if (!correct || pw === correct) {
    showScreen('intro-screen');
  } else {
    document.getElementById('pw-err').textContent = 'Incorrect password. Please try again.';
    document.getElementById('pw-input').value = '';
    document.getElementById('pw-input').focus();
  }
}

var lpHasChosen = false;
function lpPickChoice(idx) {
  if (lpHasChosen) return;
  lpHasChosen = true;
  var pt = GAME_DATA.config.pageText?.introScreen;
  if (!pt || !pt.choices || !pt.choices[idx]) return;
  var choice = pt.choices[idx];
  var buttons = document.querySelectorAll('.cold-choice');
  buttons.forEach(function(btn, i) {
    if (i === idx) btn.classList.add('chosen');
    else btn.classList.add('faded');
  });
  document.getElementById('lp-outcome-text').textContent = choice.outcome;
  document.getElementById('lp-outcome-chips').innerHTML = (choice.chips||[]).map(function(c) {
    return '<span class="cold-chip ' + esc(c.cls) + '">' + esc(c.label) + '</span>';
  }).join('');
  var marker = document.getElementById('lp-pol-marker');
  marker.style.left = (50 + (choice.polShift||0)) + '%';
  var shiftEl = document.getElementById('lp-pol-shift');
  shiftEl.textContent = choice.polLabel || '';
  shiftEl.className = 'pol-shift-lp-text ' + (choice.polClass || '');
  document.getElementById('lp-seg-bars').innerHTML = (choice.segments||[]).map(function(s) {
    var valCls = s.val > 0 ? 'seg-val-pos' : (s.val < 0 ? 'seg-val-neg' : '');
    var barCls = s.val > 0 ? 'positive' : (s.val < 0 ? 'negative' : '');
    var valStr = (s.val > 0 ? '+' : '') + s.val;
    return '<div class="seg-row-lp"><span class="seg-name-lp">' + esc(s.name) + '</span><div class="seg-bar-bg-lp"><div class="seg-bar-fill-lp ' + barCls + '" style="width:0%" data-target="' + s.pct + '"></div></div><span class="seg-val-lp ' + valCls + '">' + valStr + '</span></div>';
  }).join('');
  document.getElementById('lp-outcome').classList.add('visible');
  setTimeout(function() {
    document.querySelectorAll('.seg-bar-fill-lp').forEach(function(b) { b.style.width = b.getAttribute('data-target') + '%'; });
  }, 250);
  setTimeout(function() { document.getElementById('lp-transition').classList.add('visible'); }, 1200);
  ['lp-reveal','lp-depth','lp-advisors','lp-headlines','lp-bottom'].forEach(function(id,i) {
    setTimeout(function() {
      var el = document.getElementById(id);
      if(el) el.classList.add('revealed');
    }, 1800 + i*600);
  });
  // Mark that the player has seen the cold open
  try { localStorage.setItem('ad_intro_seen', '1'); } catch(e) {}
  // Update CTA button text
  setTimeout(function() {
    document.getElementById('lp-cta-btn').textContent = pt.ctaButtonPost || 'Begin \u2192';
  }, 1800);
  setTimeout(function() {
    document.getElementById('lp-outcome').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 100);
}

function initIntro() {
  var pt = GAME_DATA.config.pageText?.introScreen;
  if (!pt) return;
  // Check if returning player — skip cold open, show reveal immediately
  var introSeen = false;
  try { introSeen = localStorage.getItem('ad_intro_seen') === '1'; } catch(e) {}
  if (introSeen) {
    var header = document.getElementById('landing-header');
    var coldWrap = document.querySelector('.cold-open-wrap');
    if (header) header.style.display = 'none';
    if (coldWrap) coldWrap.style.display = 'none';
    ['lp-reveal','lp-depth','lp-advisors','lp-headlines','lp-bottom'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) { el.classList.add('revealed'); el.style.animation = 'none'; }
    });
  }
  // Header
  var k = document.getElementById('lp-kicker'); if(k) k.textContent = pt.kicker || '';
  var t = document.getElementById('lp-title'); if(t) t.textContent = pt.title || '';
  // Scenario
  var st = document.getElementById('lp-scenario-title'); if(st) st.textContent = pt.scenarioTitle || '';
  var sb = document.getElementById('lp-scenario-body'); if(sb) sb.textContent = pt.scenarioBody || '';
  var cl = document.getElementById('lp-choices-label'); if(cl) cl.textContent = pt.choicesLabel || 'What do you do?';
  // Choices
  var choicesEl = document.getElementById('lp-choices');
  var keys = ['A','B','C','D','E'];
  if (choicesEl && pt.choices) {
    choicesEl.innerHTML = pt.choices.map(function(c, i) {
      return '<button class="cold-choice" onclick="lpPickChoice(' + i + ')"><span class="cold-choice-key">' + keys[i] + '.</span> ' + esc(c.text) + '</button>';
    }).join('');
  }
  // Transition
  var tt = document.getElementById('lp-transition-text'); if(tt) tt.textContent = pt.transitionText || '';
  // Reveal
  var dt = document.getElementById('lp-divider-text'); if(dt) dt.textContent = pt.revealDivider || '';
  var rh = document.getElementById('lp-reveal-h1');
  if(rh) rh.innerHTML = esc(pt.revealTitle || '') + '<br><span>' + esc(pt.revealTitleAccent || '') + '</span>';
  var rs = document.getElementById('lp-reveal-sub'); if(rs) rs.textContent = pt.revealSubtitle || '';
  var rp = document.getElementById('lp-reveal-premise'); if(rp) rp.textContent = pt.revealPremise || '';
  // Stakes with formatting
  var rstakes = document.getElementById('lp-reveal-stakes');
  if (rstakes && pt.revealStakes) {
    var stakesHtml = esc(pt.revealStakes);
    stakesHtml = stakesHtml.replace(/promoted to lead a national organization/, '<span class="stakes-promote">promoted to lead a national organization</span>');
    stakesHtml = stakesHtml.replace(/your board will fire you/, '<span class="stakes-fire">your board will fire you</span>');
    rstakes.innerHTML = stakesHtml;
  }
  var cb = document.getElementById('lp-cta-btn'); if(cb) cb.textContent = 'Accept the Position \u2192';
  var ctag = document.getElementById('lp-cta-tagline'); if(ctag) ctag.textContent = pt.ctaTagline || '';
  // Show Continue button if a saved game exists
  var hasSave = hasSavedGame();
  var continueBtn = document.getElementById('lp-continue-btn');
  if (continueBtn) continueBtn.style.display = hasSave ? '' : 'none';
  var continueBtnBottom = document.getElementById('lp-continue-btn-bottom');
  if (continueBtnBottom) continueBtnBottom.style.display = hasSave ? '' : 'none';
  // Depth
  var dl = document.getElementById('lp-depth-label'); if(dl) dl.textContent = pt.depthLabel || '';
  var dg = document.getElementById('lp-depth-grid');
  if (dg && pt.depthItems) {
    dg.innerHTML = pt.depthItems.map(function(item) {
      var iconH = item.icon.indexOf('building') >= 0 ? 56 : 48;
      var iconHtml = item.icon.indexOf('art/') === 0 ?
        '<img src="' + item.icon + '" style="height:' + iconH + 'px;width:auto;display:block;margin:0 auto 8px;filter:drop-shadow(1px 2px 4px rgba(0,0,0,0.12))">' :
        '<span class="lp-depth-icon">' + item.icon + '</span>';
      return '<div class="lp-depth-item">' + iconHtml + '<div class="lp-depth-title">' + esc(item.title) + '</div><div class="lp-depth-desc">' + esc(item.desc) + '</div></div>';
    }).join('');
  }
  // Advisor preview
  var advPreview = document.getElementById('lp-advisors-grid');
  if (advPreview) {
    var pool = GAME_DATA.advisorPool || [];
    var previewAdvs = pool.slice(0, 6);
    advPreview.innerHTML = previewAdvs.map(function(adv) {
      var portraitHtml = adv.portrait ?
        '<img src="' + adv.portrait + '/neutral.png" style="width:56px;height:64px;object-fit:cover;object-position:top;border-radius:6px;filter:drop-shadow(1px 2px 4px rgba(0,0,0,0.12))">' :
        '<span style="font-size:36px">' + adv.emoji + '</span>';
      return '<div class="lp-advisor-card">' + portraitHtml +
        '<div class="lp-advisor-name">' + esc(adv.name) + '</div>' +
        '<div class="lp-advisor-role">' + esc(adv.role) + '</div></div>';
    }).join('');
  }
  // Headlines
  var hl = document.getElementById('lp-headline-label'); if(hl) hl.textContent = pt.headlinesLabel || '';
  var hc = document.getElementById('lp-headline-clips');
  if (hc && pt.headlines) {
    hc.innerHTML = pt.headlines.map(function(h) {
      return '<div class="lp-clip-card"><div class="lp-clip-masthead">' + esc(h.pub) + '</div><div class="lp-clip-headline">' + esc(h.text) + '</div><div class="lp-clip-rule"></div></div>';
    }).join('');
  }
  // Bottom
  var bt = document.getElementById('lp-bottom-text'); if(bt) bt.textContent = pt.bottomText || '';
  // Ticker
  var tc = document.getElementById('lp-ticker-content');
  if (tc && pt.tickerHeadlines) {
    var tickerHtml = pt.tickerHeadlines.map(function(h) {
      return '<span class="lp-ticker-hl">' + esc(h) + '</span><span class="lp-ticker-sep">\u25C6</span>';
    }).join('');
    tc.innerHTML = tickerHtml + tickerHtml; // duplicate for seamless loop
  }
  // Scroll down on arrow click — scroll by roughly one viewport height
  window.scrollDownHint = function() {
    window.scrollBy({ top: window.innerHeight * 0.7, behavior: 'smooth' });
  };
  // Scroll hint arrow — hide when user scrolls near bottom or leaves intro screen
  var scrollHint = document.getElementById('lp-scroll-hint');
  if (scrollHint) {
    var introScreen = document.getElementById('intro-screen');
    function checkScrollHint() {
      if (!introScreen || !introScreen.classList.contains('active')) { scrollHint.classList.add('hidden'); return; }
      // Check if the bottom CTA or ticker is visible — means we're at the bottom
      var bottomEl = document.getElementById('lp-bottom') || document.getElementById('lp-ticker');
      if (bottomEl) {
        var rect = bottomEl.getBoundingClientRect();
        var visible = rect.top < window.innerHeight;
        scrollHint.classList.toggle('hidden', visible);
      }
    }
    window.addEventListener('scroll', checkScrollHint, { passive: true });
    window.addEventListener('resize', checkScrollHint);
    setInterval(checkScrollHint, 500);
    checkScrollHint();
  }
}

// ═══════════════ CHARACTER ═══════════════
function initChar() {
  G.charTraits=[]; G.charEmoji='';
  document.getElementById('emoji-grid').innerHTML = GAME_DATA.avatarEmojis.map(e=>
    `<button class="emoji-btn" onclick="selectEmoji('${e}')">${e}</button>`).join('');
  document.getElementById('trait-label').textContent = `Select ${GAME_DATA.config.traitsToSelect} Traits`;
  document.getElementById('traits-grid').innerHTML = GAME_DATA.characterTraits.map(t=>`
    <div class="trait-card" id="tc-${t.id}" onclick="toggleTrait('${t.id}')">
      <div class="trait-name">${t.name}</div>
      <div class="trait-desc">${t.description}</div>
      <div class="trait-fx">${Object.entries(t.statModifiers).map(([k,v])=>
        `<span class="trait-tag ${v>0?'trait-pos':'trait-neg'}">${v>0?'+':''}${v} ${k}</span>`).join('')}${t.budgetBonus?`<span class="trait-tag ${t.budgetBonus>0?'trait-pos':'trait-neg'}">${t.budgetBonus>0?'+':''}${t.budgetBonus} Budget</span>`:''}
      </div>
    </div>`).join('');
  const ni=document.getElementById('char-name');
  if(ni){ni.value='';ni.classList.remove('err');}
  document.getElementById('name-err').classList.remove('show');
}
function selectEmoji(e){
  G.charEmoji=e;var ee=document.getElementById('emoji-err');if(ee)ee.classList.remove('show');
  document.querySelectorAll('.emoji-btn').forEach(b=>b.classList.toggle('selected',b.textContent===e));
}
function onNameInput(){ document.getElementById('name-err').classList.remove('show'); document.getElementById('char-name').classList.remove('err'); }
function toggleTrait(id){
  const max=GAME_DATA.config.traitsToSelect;
  if(G.charTraits.includes(id)){
    G.charTraits=G.charTraits.filter(t=>t!==id);
    document.getElementById('tc-'+id).classList.remove('selected');
  } else {
    if(G.charTraits.length>=max) return;
    G.charTraits.push(id);
    document.getElementById('tc-'+id).classList.add('selected');
  }
  document.querySelectorAll('.trait-card').forEach(c=>{
    const tid=c.id.replace('tc-','');
    c.classList.toggle('disabled', G.charTraits.length>=max && !G.charTraits.includes(tid));
  });
}
function tryAdvanceChar(){
  G.charName=document.getElementById('char-name').value.trim();
  if(!G.charName){
    document.getElementById('name-err').classList.add('show');
    document.getElementById('char-name').classList.add('err');
    document.getElementById('char-name').focus();
    return;
  }
  if(!G.charEmoji){
    document.getElementById('emoji-err').classList.add('show');
    return;
  }
  if(G.charTraits.length<GAME_DATA.config.traitsToSelect){
    document.getElementById('trait-err').classList.add('show');
    return;
  }
  showScreen('org-screen');
}

// ═══════════════ ORG ═══════════════
function initOrg(){
  document.getElementById('org-grid').innerHTML = GAME_DATA.organizations.map(o=>{
    const mods=Object.entries(o.statModifiers||{}).filter(([k])=>k!=='budget');
    const bc = GAME_DATA.config.budgetConfig || {};
    const orgBudget = (o.budgetOverrides?.startingBudget) || bc.startingBudget || 100;
    return `<div class="card" id="oc-${o.id}" onclick="selectOrg('${o.id}')">
      <span class="card-badge ${o.badgeClass}">${o.badge}</span>
      <h3>${o.name}</h3>
      <p style="margin-bottom:0">${o.description}</p>
      ${o.traits?.length?`<ul class="card-traits">${o.traits.map(t=>`<li>${t}</li>`).join('')}</ul>`:''}
      <div class="org-budget-tag">💰 Starting Budget: ${orgBudget}</div>
      ${mods.length?`<div class="card-mods">${mods.map(([k,v])=>`<span class="chip ${v>0?'chip-pos':'chip-neg'}">${v>0?'+':''}${v} ${k}</span>`).join('')}</div>`:''}
    </div>`;
  }).join('');
}
function selectOrg(id){
  G.orgId=id;
  document.querySelectorAll('#org-grid .card').forEach(c=>c.classList.remove('selected'));
  document.getElementById('oc-'+id)?.classList.add('selected');
  document.getElementById('org-next-btn').disabled=false;
}
function goToMission(){ initMission(); showScreen('mission-screen'); }

// ═══════════════ MISSION ═══════════════
function initMission(){
  G.missionId=null;
  document.getElementById('mission-next-btn').disabled=true;
  document.getElementById('mission-list').innerHTML=GAME_DATA.missions.map(m=>{
    const locked=!m.availableTo.includes(G.orgId);
    const chips=Object.entries(m.statBonus||{}).map(([k,v])=>`<span class="chip ${v>0?'chip-pos':'chip-neg'}">${v>0?'+':''}${v} ${k}</span>`).join('');
    return `<div class="mission-card ${locked?'locked':''}" id="mc-${m.id}" onclick="${locked?'':` selectMission('${m.id}')`}">
      <h3>${m.name}${locked?' <span style="font-size:10px;color:var(--muted);font-weight:400">(not available for your org)</span>':''}</h3>
      <p>${m.description}</p>
      ${!locked&&chips?`<div class="chip-row">${chips}</div>`:''}
    </div>`;
  }).join('');
}
function selectMission(id){
  G.missionId=id;
  document.querySelectorAll('.mission-card').forEach(c=>c.classList.remove('selected'));
  document.getElementById('mc-'+id).classList.add('selected');
  document.getElementById('mission-next-btn').disabled=false;
}

// ═══════════════ BUDGET ALLOCATION (Priorities) ═══════════════
function getOrgStartingBudget(orgId) {
  const allOrgs=[...GAME_DATA.organizations,...GAME_DATA.nationalOrganizations];
  const org=allOrgs.find(o=>o.id===orgId);
  const bc = GAME_DATA.config.budgetConfig || {};
  return (org?.budgetOverrides?.startingBudget) || bc.startingBudget || 100;
}

function initBudget(promo=false){
  const gridId=promo?'promo-pri-grid':'pri-grid';
  const poolId=promo?'promo-pool-display':'pool-display';
  const px=promo?'pp':'p';

  // Show warning box if configured
  if (!promo) {
    var warnBox = document.getElementById('pri-warning-box');
    var warnText = (GAME_DATA.config.pageText?.budgetScreen?.warningText) || '';
    if (warnBox) {
      if (warnText) { warnBox.innerHTML = '<strong>Warning:</strong> ' + esc(warnText); warnBox.style.display = 'block'; }
      else { warnBox.style.display = 'none'; }
    }
  }

  // Calculate baselines from org + traits + mission + advisors
  const allOrgs=[...GAME_DATA.organizations,...GAME_DATA.nationalOrganizations];
  const org=allOrgs.find(o=>o.id===G.orgId);
  const mission=GAME_DATA.missions.find(m=>m.id===G.missionId);
  const pool = GAME_DATA.advisorPool || [];

  var baselines = {};
  var baselineBreakdown = {};
  GAME_DATA.stats.forEach(function(s){
    baselines[s.id] = 0;
    baselineBreakdown[s.id] = [];
    // Org bonus
    var orgMod = (org && org.statModifiers && org.statModifiers[s.id]) || 0;
    if(orgMod !== 0) { baselines[s.id] += orgMod; baselineBreakdown[s.id].push({source: org.name, value: orgMod}); }
    // Mission bonus
    var misMod = (mission && mission.statBonus && mission.statBonus[s.id]) || 0;
    if(misMod !== 0) { baselines[s.id] += misMod; baselineBreakdown[s.id].push({source: mission.name, value: misMod}); }
    // Trait bonuses
    (G.charTraits||[]).forEach(function(tid){
      var t = GAME_DATA.characterTraits.find(function(t){return t.id===tid});
      var traitMod = (t && t.statModifiers && t.statModifiers[s.id]) || 0;
      if(traitMod !== 0) { baselines[s.id] += traitMod; baselineBreakdown[s.id].push({source: t.name, value: traitMod}); }
    });
    // Advisor bonuses
    (G.selectedAdvisors||[]).forEach(function(advId){
      var adv = pool.find(function(a){return a.id===advId});
      var advMod = (adv && adv.statModifiers && adv.statModifiers[s.id]) || 0;
      if(advMod !== 0) { baselines[s.id] += advMod; baselineBreakdown[s.id].push({source: adv.name, value: advMod}); }
    });
  });

  // Allocation points from org
  var allocPoints = (org && org.allocationPoints) || 50;
  G._baselines = baselines;

  // Pre-fill allocations so every stat starts at least at MIN_START (25)
  var MIN_START = 25;
  G.priorities = {};
  var usedForFloor = 0;
  GAME_DATA.stats.forEach(function(s){
    var base = baselines[s.id] || 0;
    if (base < MIN_START) {
      var needed = MIN_START - base;
      // Round up to nearest 5 for clean UI
      needed = Math.ceil(needed / 5) * 5;
      G.priorities[s.id] = needed;
      usedForFloor += needed;
    } else {
      G.priorities[s.id] = 0;
    }
  });
  var discretionary = allocPoints - usedForFloor;
  G._allocBudget = allocPoints;
  G._allocMin = 0;
  G._allocMax = allocPoints;

  // Scale for display: max bar represents ~80 (baseline + max possible allocation)
  var maxDisplay = 80;

  document.getElementById(gridId).innerHTML=GAME_DATA.stats.map(function(s){
    var base = baselines[s.id];
    var alloc = G.priorities[s.id];
    var total = Math.max(0, base + alloc);
    var basePct = Math.max(0, Math.min(100, (Math.abs(base) / maxDisplay) * 100));
    var allocPct = (alloc / maxDisplay) * 100;
    var isNeg = base < 0;

    // Breakdown tooltip text
    var breakdownItems = baselineBreakdown[s.id].map(function(b){
      return (b.value>0?'+':'')+b.value+' '+esc(b.source);
    }).join(', ');
    var breakdownText = breakdownItems || 'No bonuses';

    return '<div class="pri-row-v2">' +
      '<div class="pri-row-header">' +
        '<span class="pri-label">' + s.label + '</span>' +
        '<span class="pri-total" id="' + px + 't-' + s.id + '">' + total + '</span>' +
      '</div>' +
      '<div class="pri-bar-track">' +
        (isNeg ?
          '<div class="pri-bar-penalty" style="width:' + basePct + '%"></div>' :
          '<div class="pri-bar-base" style="width:' + basePct + '%"></div>'
        ) +
        '<div class="pri-bar-alloc" id="' + px + 'b-' + s.id + '" style="width:' + allocPct + '%;left:' + (isNeg ? 0 : basePct) + '%"></div>' +
      '</div>' +
      '<div class="pri-row-controls">' +
        '<span class="pri-baseline-tag ' + (isNeg?'penalty':'bonus') + '">' +
          (isNeg ? '' : '+') + base + ' starting ' + (isNeg?'penalty':'bonus') +
        '</span>' +
        '<span class="pri-breakdown">' + breakdownText + '</span>' +
        '<div class="pri-buttons">' +
          '<button class="pri-btn pri-minus" onclick="adjustPri(\'' + s.id + '\',-5,\'' + px + '\',\'' + poolId + '\')">−</button>' +
          '<span class="pri-alloc-val" id="' + px + 'v-' + s.id + '">+' + alloc + '</span>' +
          '<button class="pri-btn pri-plus" onclick="adjustPri(\'' + s.id + '\',5,\'' + px + '\',\'' + poolId + '\')">+</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }).join('');
  refreshPool(px,poolId);
}

function adjustPri(id, delta, px, poolId){
  var total = G._allocBudget || 50;
  var current = G.priorities[id] || 0;
  var newVal = current + delta;
  
  // Floor at 0 (can't allocate negative)
  if(newVal < 0) return;
  // Ceiling at pool total
  if(newVal > total) return;
  
  // Check pool availability
  var used = Object.values(G.priorities).reduce(function(a,b){return a+b;},0);
  var poolLeft = total - used;
  if(delta > 0 && poolLeft < delta) return;
  
  G.priorities[id] = newVal;
  document.getElementById(px+'v-'+id).textContent = '+' + newVal;
  
  // Update bar
  var maxDisplay = 80;
  var base = (G._baselines && G._baselines[id]) || 0;
  var basePct = Math.max(0, Math.min(100, (Math.abs(base) / maxDisplay) * 100));
  var allocPct = (newVal / maxDisplay) * 100;
  var bar = document.getElementById(px+'b-'+id);
  if(bar) {
    bar.style.width = allocPct + '%';
    bar.style.left = (base < 0 ? 0 : basePct) + '%';
  }
  
  // Update total display
  var totalVal = Math.max(0, base + newVal);
  var totalEl = document.getElementById(px+'t-'+id);
  if(totalEl) totalEl.textContent = totalVal;
  
  refreshPool(px, poolId);
  // Live check priority floors for warning display
  if (!px || px === 'p') checkPriorityFloors();
}

// Legacy compat
function updatePri(id,nv,px,poolId){ adjustPri(id, parseInt(nv) - (G.priorities[id]||0), px, poolId); }
function refreshPool(px,poolId){
  const total = G._allocBudget || 100;
  const used=Object.values(G.priorities).reduce((a,b)=>a+b,0);
  const left=total-used;
  const el=document.getElementById(poolId);
  if(!el) return;
  el.textContent=left;
  el.className='pool-num '+(left===0?'done':left<0?'over':'ok');
}

// ═══════════════ ADVISOR SELECTION ═══════════════
function renderAdvisorSelection() {
  var pool = GAME_DATA.advisorPool || [];
  var slots = GAME_DATA.config.advisorSlots || 3;
  G.selectedAdvisors = [];
  var grid = document.getElementById('advisor-grid');
  if (!grid) return;
  var errEl = document.getElementById('advisor-err');
  if (errEl) {
    errEl.textContent = 'Please select ' + slots + ' advisor' + (slots !== 1 ? 's' : '');
    errEl.classList.remove('show');
  }
  grid.innerHTML = pool.map(function(adv) {
    var typeCls = adv.type === 'external' ? 'advisor-type-external' : 'advisor-type-internal';
    var typeLabel = adv.type === 'external' ? 'External' : 'Internal';
    // Stat modifier chips
    var statChips = Object.entries(adv.statModifiers || {}).map(function(e) {
      var statDef = GAME_DATA.stats.find(function(s){return s.id === e[0]});
      var label = statDef ? statDef.label : e[0];
      return '<span class="chip chip-pos">+' + e[1] + ' ' + esc(label) + '</span>';
    }).join('');
    // Political lean
    var leanText = '';
    if (adv.politicalLean < -2) leanText = '← Leans Left';
    else if (adv.politicalLean > 2) leanText = 'Leans Right →';
    else leanText = 'Center';
    // Clout bonus
    var cloutText = adv.cloutBonus ? '⚡+' + adv.cloutBonus + ' Clout' : '';
    // Budget bonus
    var budgetText = adv.budgetBonus ? '💰+' + adv.budgetBonus + ' Budget' : '';
    return '<div class="advisor-card" data-advisor-id="' + esc(adv.id) + '" onclick="toggleAdvisorSelection(\'' + esc(adv.id) + '\')">' +
      '<div class="advisor-card-header">' +
        '<span class="advisor-card-emoji">' + advPortrait(adv, 'neutral', 56, 'square') + '</span>' +
        '<div><div class="advisor-card-name">' + esc(adv.name) + '</div>' +
        '<div class="advisor-card-role">' + esc(adv.role) + '</div></div>' +
      '</div>' +
      '<span class="advisor-card-type ' + typeCls + '">' + typeLabel + '</span>' +
      '<div class="advisor-card-bio">' + esc(adv.bio) + '</div>' +
      '<div class="advisor-card-stats">' + statChips + '</div>' +
      '<div class="advisor-card-lean">' + esc(leanText) + '</div>' +
      (cloutText ? '<div class="advisor-card-clout">' + cloutText + '</div>' : '') +
      (budgetText ? '<div class="advisor-card-clout">' + budgetText + '</div>' : '') +
    '</div>';
  }).join('');
}

function toggleAdvisorSelection(advId) {
  var slots = GAME_DATA.config.advisorSlots || 3;
  var idx = G.selectedAdvisors.indexOf(advId);
  if (idx >= 0) {
    G.selectedAdvisors.splice(idx, 1);
  } else {
    if (G.selectedAdvisors.length >= slots) {
      return; // silently block — cards are grayed out
    }
    G.selectedAdvisors.push(advId);
  }
  // Update visual selection state + gray out unselected when at max
  var atMax = G.selectedAdvisors.length >= slots;
  var cards = document.querySelectorAll('.advisor-card');
  cards.forEach(function(card) {
    var id = card.getAttribute('data-advisor-id');
    var isSelected = G.selectedAdvisors.includes(id);
    card.classList.toggle('selected', isSelected);
    card.classList.toggle('disabled', atMax && !isSelected);
  });
  // Update hint at top
  var hintEl = document.getElementById('advisor-hint');
  if (hintEl) {
    var remaining = slots - G.selectedAdvisors.length;
    if (remaining > 0) {
      hintEl.innerHTML = 'Select <strong>' + remaining + '</strong> more advisor' + (remaining !== 1 ? 's' : '') + ' to continue';
      hintEl.style.borderColor = 'rgba(184,134,11,0.25)';
    } else {
      hintEl.innerHTML = '✓ Advisory team complete — <strong>' + slots + '</strong> advisors selected';
      hintEl.style.borderColor = '#27ae60';
    }
  }
  // Update error message
  var errEl = document.getElementById('advisor-err');
  if (errEl) {
    errEl.classList.remove('show');
  }
}

function validateAdvisorSelection() {
  var slots = GAME_DATA.config.advisorSlots || 3;
  if (G.selectedAdvisors.length !== slots) {
    var errEl = document.getElementById('advisor-err');
    if (errEl) {
      var remaining = slots - G.selectedAdvisors.length;
      errEl.textContent = 'Please select ' + remaining + ' more advisor' + (remaining !== 1 ? 's' : '');
      errEl.classList.add('show');
    }
    return false;
  }
  return true;
}

function goToBudget() {
  if (!validateAdvisorSelection()) return;
  // Auto-allocate stats: compute baselines, distribute evenly, enforce floor of 30
  autoAllocateStats();
  startGame();
}

function autoAllocateStats() {
  var allOrgs = [...GAME_DATA.organizations, ...GAME_DATA.nationalOrganizations];
  var org = allOrgs.find(function(o){ return o.id === G.orgId; });
  var mission = GAME_DATA.missions.find(function(m){ return m.id === G.missionId; });
  var pool = GAME_DATA.advisorPool || [];
  var FLOOR = 30;

  // Compute baselines from org + traits + mission + advisors
  var baselines = {};
  GAME_DATA.stats.forEach(function(s) {
    baselines[s.id] = 0;
    var orgMod = (org && org.statModifiers && org.statModifiers[s.id]) || 0;
    baselines[s.id] += orgMod;
    var misMod = (mission && mission.statBonus && mission.statBonus[s.id]) || 0;
    baselines[s.id] += misMod;
    (G.charTraits || []).forEach(function(tid) {
      var t = GAME_DATA.characterTraits.find(function(t){ return t.id === tid; });
      var traitMod = (t && t.statModifiers && t.statModifiers[s.id]) || 0;
      baselines[s.id] += traitMod;
    });
    (G.selectedAdvisors || []).forEach(function(advId) {
      var adv = pool.find(function(a){ return a.id === advId; });
      var advMod = (adv && adv.statModifiers && adv.statModifiers[s.id]) || 0;
      baselines[s.id] += advMod;
    });
  });

  G._baselines = baselines;

  // Get allocation points from org
  var allocPoints = (org && org.allocationPoints) || 50;

  // First pass: bring any stat below FLOOR up to FLOOR
  var priorities = {};
  var usedForFloor = 0;
  GAME_DATA.stats.forEach(function(s) {
    var base = baselines[s.id] || 0;
    if (base < FLOOR) {
      priorities[s.id] = FLOOR - base;
      usedForFloor += priorities[s.id];
    } else {
      priorities[s.id] = 0;
    }
  });

  // Distribute remaining points evenly across all stats
  var remaining = Math.max(0, allocPoints - usedForFloor);
  var statCount = GAME_DATA.stats.length;
  var perStat = Math.floor(remaining / statCount);
  var leftover = remaining - (perStat * statCount);
  GAME_DATA.stats.forEach(function(s, i) {
    priorities[s.id] += perStat;
    if (i < leftover) priorities[s.id] += 1;
  });

  G.priorities = priorities;
  G._allocBudget = allocPoints;
}

// ═══════════════ START GAME ═══════════════
function checkPriorityFloors() {
  var baselines = G._baselines || {};
  var MIN_START = 25;
  var dangerStats = [];
  GAME_DATA.stats.forEach(function(s) {
    var total = (baselines[s.id] || 0) + (G.priorities[s.id] || 0);
    if (total < MIN_START) {
      dangerStats.push({ label: s.label, value: total, needed: MIN_START - total });
    }
  });
  var warnEl = document.getElementById('pri-floor-warning');
  var btn = document.getElementById('briefing-btn');
  if (!warnEl) return;
  if (dangerStats.length > 0) {
    var html = '<strong>\u26a0\ufe0f Some stats are dangerously low</strong><br>';
    html += '<span style="font-size:12px;opacity:0.85">If any stat starts below ' + MIN_START + ', you risk an immediate board crisis. Allocate more points to:</span>';
    html += '<ul style="margin:6px 0 0 16px;padding:0">';
    dangerStats.forEach(function(d) {
      html += '<li><strong>' + d.label + '</strong> is at <strong style="color:#c0392b">' + d.value + '</strong> \u2014 needs <strong>+' + d.needed + ' more</strong></li>';
    });
    html += '</ul>';
    warnEl.innerHTML = html;
    warnEl.style.display = 'block';
    btn.disabled = true;
    btn.style.opacity = '0.4';
    btn.style.cursor = 'not-allowed';
  } else {
    warnEl.style.display = 'none';
    btn.disabled = false;
    btn.style.opacity = '';
    btn.style.cursor = '';
  }
}

function goToBriefing() {
  var baselines = G._baselines || {};
  var MIN_START = 25;
  var blocked = false;
  GAME_DATA.stats.forEach(function(s) {
    var total = (baselines[s.id] || 0) + (G.priorities[s.id] || 0);
    if (total < MIN_START) blocked = true;
  });
  if (blocked) {
    checkPriorityFloors();
    return;
  }
  initBriefing();
  showScreen('briefing-screen');
}

function initBriefing() {
  var bs = GAME_DATA.config.pageText?.briefingScreen;
  if (!bs) return;
  var el;
  el = document.getElementById('briefing-step'); if(el) el.textContent = bs.stepLabel || '';
  el = document.getElementById('briefing-heading'); if(el) el.textContent = bs.heading || '';
  el = document.getElementById('briefing-desc'); if(el) el.textContent = bs.description || '';
  var advLine = document.getElementById('briefing-advisor-line');
  if(advLine) advLine.innerHTML = (bs.advisorName ? advPortrait(OUTGOING_ED, 'neutral', 36) + ' ' + esc(bs.advisorName) : '') + (bs.advisorRole ? ' <span style="font-weight:400;opacity:0.7;font-size:12px">· ' + esc(bs.advisorRole) + '</span>' : '');
  el = document.getElementById('briefing-opening-text'); if(el) el.textContent = '"' + (bs.openingQuote || '') + '"';
  var itemsEl = document.getElementById('briefing-items');
  if(itemsEl && bs.items) {
    itemsEl.innerHTML = bs.items.map(function(item) {
      var bgStyle = item.style === 'danger' ? 'background:#fdf2f2;border-radius:8px;padding:14px 18px;margin-bottom:20px' :
                    item.style === 'success' ? 'background:#f0f7f0;border-radius:8px;padding:14px 18px;margin-bottom:20px' :
                    'margin-bottom:20px';
      var titleColor = item.style === 'danger' ? 'color:#8b1a1a' :
                       item.style === 'success' ? 'color:#1a5c1a' : 'color:#1a1510';
      return '<div style="' + bgStyle + '">' +
        '<div style="font-weight:700;font-size:15px;margin-bottom:8px;' + titleColor + '">' + (item.icon || '') + ' ' + esc(item.title) + '</div>' +
        '<div style="font-size:13px">' + esc(item.text) + '</div>' +
      '</div>';
    }).join('');
  }
}

function toggleHelpPanel() {
  var panel = document.getElementById('help-panel');
  var overlay = document.getElementById('help-overlay');
  if (!panel || !overlay) return;
  var isOpen = panel.style.display !== 'none';
  panel.style.display = isOpen ? 'none' : 'block';
  overlay.style.display = isOpen ? 'none' : 'block';
  if (!isOpen) {
    // Populate help content from briefing data
    var bs = GAME_DATA.config.pageText?.briefingScreen;
    var body = document.getElementById('help-panel-body');
    var title = document.getElementById('help-panel-title');
    if (title && bs && bs.helpButtonLabel) title.textContent = bs.helpButtonLabel;
    if (body && bs && bs.items) {
      body.innerHTML = bs.items.map(function(item) {
        return '<div style="margin-bottom:14px"><div style="font-weight:700;font-size:13px;margin-bottom:4px">' + (item.icon||'') + ' ' + esc(item.title) + '</div><div style="font-size:12px;line-height:1.6;color:var(--muted)">' + esc(item.text) + '</div></div>';
      }).join('') +
      '<div style="margin-top:8px;padding-top:12px;border-top:1px solid var(--border);font-size:12px;color:var(--muted);line-height:1.7">' +
        '<div style="margin-bottom:10px"><strong>⭐ Mission Stars:</strong> Your mission stars reflect how consistently you stay true to your stated priorities. Lose all your stars and the board loses confidence. Earn bonus stars through mission-aligned decisions — they boost your year-end score.</div>' +
        '<div style="margin-bottom:10px"><strong>💰 Budget:</strong> You earn budget each round from base income and fundraising. Spend it on investments, or save for emergencies. Some choices and crises cost budget. Running out limits your options.</div>' +
        '<div style="margin-bottom:10px"><strong>👥 Segments:</strong> Community Trust is the weighted average of how different groups feel about you — Orthodox, Reform, Conservative, unaffiliated, young adults, older adults. A decision that thrills one group may alienate another.</div>' +
        '<div><strong>⚖️ Political Capital:</strong> Your political position (left to right) and clout affect which coalitions, allies, and choices are available to you.</div>' +
      '</div>';
    }
  }
}

// ═══════════════ IN-GAME COACHING WARNINGS ═══════════════
// Each unique warning fires at most once across the entire game.
// They fire readily in Year 1, and any that haven't fired yet can still fire in later years.
var OUTGOING_ED = { name: 'Avi Rosen', emoji: '\ud83d\udc68\u200d\ud83d\udcbc', portrait: 'art/advisors/avi_rosen' };

var COACHING_MESSAGES = {
  stat_yellow: [
    "Keep an eye on {stat}. If it drops much further, the board will start asking questions.",
    "{stat} is slipping. You may want to prioritize it in your next action.",
    "Your {stat} is getting into uncomfortable territory. The board notices these trends."
  ],
  stat_red: [
    "\ud83d\udea8 {stat} is critically low. If it hits 20, the board will call an emergency meeting and your tenure could end.",
    "\ud83d\udea8 {stat} is in the danger zone. One more bad outcome and you could be out.",
    "\ud83d\udea8 Crisis warning: {stat} is near the point of no return."
  ],
  final_round_stars: [
    "You\u2019re heading into the final round with no mission stars. The board will see this as a failure of vision \u2014 regardless of your other numbers.",
    "Zero mission stars going into the last round. Without a clear mission, the board has no reason to renew your contract."
  ],
  final_round_avg: [
    "Your stats are averaging below 40 heading into the final round. At this rate, the board won\u2019t renew your contract.",
    "The numbers aren\u2019t good. You need a strong final round to avoid a bad year-end review."
  ],
  penultimate_warning: [
    "{stat} is below 35 with two rounds to go. You still have time to turn this around \u2014 but not much.",
    "Heads up: {stat} is trending low. Consider making it a priority over the next two rounds."
  ]
};

function pickCoachMsg(category) {
  var msgs = COACHING_MESSAGES[category] || [''];
  return msgs[Math.floor(Math.random() * msgs.length)];
}

function showCoachingWarning(msg, level) {
  var bgColor = level === 'red' ? '#fdf2f2' : level === 'yellow' ? '#fefce8' : '#f0f4ff';
  var borderColor = level === 'red' ? '#e8a0a0' : level === 'yellow' ? '#e8d44d' : '#a0b4e8';
  var textColor = level === 'red' ? '#8b1a1a' : level === 'yellow' ? '#7a6b1a' : '#1a3a6b';
  var div = document.createElement('div');
  div.className = 'game-notification';
  div.style.background = bgColor;
  div.style.color = textColor;
  div.style.borderLeft = '4px solid ' + borderColor;
  div.innerHTML = '<button class="notif-close" onclick="event.stopPropagation();this.parentNode.remove()">\u2715</button>' +
    '<div style="font-weight:700;margin-bottom:4px;display:flex;align-items:center;gap:8px">' + advPortrait(OUTGOING_ED, 'concerned', 32) + ' ' + OUTGOING_ED.name + '</div>' +
    '<div style="font-size:12px;line-height:1.5">' + msg + '</div>';
  div.onclick = function(){ div.remove(); };
  document.body.appendChild(div);
  positionNotification(div);
  setTimeout(function(){ if(div.parentNode) div.remove(); }, 8000);
}

// ═══════════════ ONBOARDING TUTORIAL ═══════════════
var ONBOARDING_STEPS = [
  {
    mood: 'neutral',
    msg: 'Let me be honest with you about what you\'re walking into. This job is a balancing act \u2014 and the board is always watching.',
    label: 'What do I need to know?'
  },
  {
    mood: 'neutral',
    msg: 'You have <strong>3 actions</strong> each round. Click an object on your desk to spend one. Your phone is free \u2014 inbox messages don\'t cost actions.',
    label: 'Got it. What am I trying to do?'
  },
  {
    mood: 'concerned',
    msg: 'Watch your three stats up top: <strong>Trust, Morale, and Donors</strong>. If any one of them drops to 20 or below, the board calls an emergency meeting and your tenure ends immediately.',
    label: 'How do I win?'
  },
  {
    mood: 'approving',
    msg: 'At year\'s end, the board evaluates your overall performance. Score above <strong>80</strong> and you\'ll be offered a promotion to a national organization. Stay above <strong>40</strong> and you keep your job. Below that\u2026 well, don\'t go below that.',
    label: 'Any other advice?'
  },
  {
    mood: 'neutral',
    msg: 'You have a <strong>budget</strong> you can invest in your organization \u2014 marketing campaigns, security upgrades, staff development, signature events. Use the investment bar to spend wisely. These don\'t cost actions but they do cost money.',
    label: 'One more thing?'
  },
  {
    mood: 'concerned',
    msg: 'One more thing \u2014 every round, your stats <strong>naturally decay</strong> as community attention fades, donors expect fresh results, and staff energy flags. You have to keep running just to stay in place. There are no perfect choices in this job. Every decision has a cost. The best leaders are the ones who know which costs they can afford.',
    label: 'Let\'s do this \u2192'
  }
];

function isFirstPlay() {
  return !localStorage.getItem('ad_onboarded');
}

function showOnboarding() {
  if (!isFirstPlay()) return;
  showOnboardingStep(0);
}

function showOnboardingStep(idx) {
  if (idx >= ONBOARDING_STEPS.length) {
    localStorage.setItem('ad_onboarded', '1');
    return;
  }
  var step = ONBOARDING_STEPS[idx];
  var div = document.createElement('div');
  div.className = 'game-notification onboarding-notif';
  div.style.background = '#f0f4ff';
  div.style.color = '#1a3a6b';
  div.style.borderLeft = '4px solid #a0b4e8';
  div.style.cursor = 'default';
  div.innerHTML =
    '<button style="position:absolute;top:6px;right:8px;background:none;border:none;color:#8899bb;font-size:14px;cursor:pointer;padding:2px 6px;line-height:1" onclick="event.stopPropagation();this.closest(\'.onboarding-notif\').remove();localStorage.setItem(\'ad_onboarded\',\'1\')" title="Skip tutorial">\u2715</button>' +
    '<div style="font-weight:700;margin-bottom:6px;display:flex;align-items:center;gap:8px">' + advPortrait(OUTGOING_ED, step.mood, 36) + ' ' + OUTGOING_ED.name + '</div>' +
    '<div style="font-size:12px;line-height:1.6;margin-bottom:10px">' + step.msg + '</div>' +
    '<div style="display:flex;justify-content:space-between;align-items:center">' +
      '<span style="font-size:10px;color:#8899bb">' + (idx + 1) + ' of ' + ONBOARDING_STEPS.length + '</span>' +
      '<button style="background:#1a1a2e;color:#faf8f4;border:none;padding:6px 14px;font-family:\'Merriweather Sans\',sans-serif;font-size:11px;font-weight:600;cursor:pointer;letter-spacing:0.5px" onclick="event.stopPropagation();this.closest(\'.onboarding-notif\').remove();showOnboardingStep(' + (idx + 1) + ')">' + step.label + '</button>' +
    '</div>';
  document.body.appendChild(div);
  positionNotification(div);
}

function checkCoachingWarnings() {
  // Lifetime tracking: each unique warning fires at most once across the whole game
  if (!G._coachWarningsLifetime) G._coachWarningsLifetime = {};
  // Per-round cooldown so we don't spam multiple warnings per action within a round
  if (!G._coachWarningsThisRound) G._coachWarningsThisRound = {};

  // Avi's onboarding replaces the old closing advice for first-time players

  var totalRounds = GAME_DATA.config.totalRounds || 6;
  var isFinalRound = G.round >= totalRounds;
  var isPenultimate = G.round >= totalRounds - 1;
  var warnings = [];
  
  GAME_DATA.stats.forEach(function(s) {
    var val = G.stats[s.id] || 50;
    var redKey = 'red_' + s.id;
    var yellowKey = 'yellow_' + s.id;
    var penultKey = 'penult_' + s.id;
    
    if (val <= 25 && !G._coachWarningsLifetime[redKey] && !G._coachWarningsThisRound[redKey]) {
      warnings.push({ msg: pickCoachMsg('stat_red').replace('{stat}', s.label), level: 'red', priority: 1, key: redKey });
    } else if (val <= 30 && !G._coachWarningsLifetime[yellowKey] && !G._coachWarningsThisRound[yellowKey]) {
      warnings.push({ msg: pickCoachMsg('stat_yellow').replace('{stat}', s.label), level: 'yellow', priority: 2, key: yellowKey });
    } else if (isPenultimate && !isFinalRound && val < 35 && !G._coachWarningsLifetime[penultKey] && !G._coachWarningsThisRound[penultKey]) {
      warnings.push({ msg: pickCoachMsg('penultimate_warning').replace('{stat}', s.label), level: 'yellow', priority: 3, key: penultKey });
    }
  });
  
  if (isFinalRound) {
    if (G.missionStars <= 0 && !G._coachWarningsLifetime['stars'] && !G._coachWarningsThisRound['stars']) {
      warnings.push({ msg: pickCoachMsg('final_round_stars'), level: 'red', priority: 1, key: 'stars' });
    }
    var statSum = 0; var statCount = 0;
    GAME_DATA.stats.forEach(function(s) { statSum += G.stats[s.id] || 0; statCount++; });
    if (statCount > 0 && (statSum / statCount) < 40 && !G._coachWarningsLifetime['avg'] && !G._coachWarningsThisRound['avg']) {
      warnings.push({ msg: pickCoachMsg('final_round_avg'), level: 'red', priority: 1, key: 'avg' });
    }
  }
  
  warnings.sort(function(a, b) { return a.priority - b.priority; });
  var shown = 0;
  warnings.forEach(function(w) {
    if (shown >= 2) return;
    G._coachWarningsLifetime[w.key] = true;
    G._coachWarningsThisRound[w.key] = true;
    setTimeout(function() { showCoachingWarning(w.msg, w.level); }, 1500 + shown * 1200);
    shown++;
  });
}

function startGame(){
  clearSave();
  const org=GAME_DATA.organizations.find(o=>o.id===G.orgId);
  const mission=GAME_DATA.missions.find(m=>m.id===G.missionId);
  
  // Stats = baseline (from org+traits+mission+advisors) + player allocation
  // Baselines were computed in initBudget and stored in G._baselines
  var baselines = G._baselines || {};
  GAME_DATA.stats.forEach(s=>{
    var base = baselines[s.id] || 0;
    var alloc = G.priorities[s.id] || 0;
    G.stats[s.id]=Math.max(0, Math.min(100, base + alloc));
  });
  
  G.missionStars=GAME_DATA.config.missionStartStars||3;
  G.activeUnlocks=[];
  G.charTraits.forEach(tid=>{
    const t=GAME_DATA.characterTraits.find(t=>t.id===tid);
    if(t) G.activeUnlocks=G.activeUnlocks.concat(t.unlocksChoices||[]);
  });
  G.round=0; G.history=[]; G.usedScenarioIds=[]; G.usedInboxIds=[];G.activeCoalitions=[];G.declinedCoalitions=[];G.brokenCoalitions=[];G.statHistory=[];gazetteEvents=[]; G.promotionLevel=0;
  G.inboxMessages=[]; G.coalitionStrikes={};
  G.advisorBonusLog = [];
  G.currentAdvisorBonusMultiplier = 1.0;
  // Initialize in-game budget (separate from priority allocation)
  var bc = GAME_DATA.config.budgetConfig || {};
  var orgBudgetOverrides = org.budgetOverrides || {};
  G.budget = orgBudgetOverrides.startingBudget || bc.startingBudget || 100;
  // Apply trait budget bonuses
  G.charTraits.forEach(function(tid){
    var t = GAME_DATA.characterTraits.find(function(t){return t.id===tid});
    if(t && t.budgetBonus) G.budget += t.budgetBonus;
  });
  // Apply mission budget bonus
  if(mission.budgetBonus) G.budget += mission.budgetBonus;
  // Apply org startingBudgetBonus
  if(orgBudgetOverrides.startingBudgetBonus) G.budget += orgBudgetOverrides.startingBudgetBonus;
  
  // Apply selected advisor budget bonuses
  var pool = GAME_DATA.advisorPool || [];
  G.selectedAdvisors.forEach(function(advId) {
    var adv = pool.find(function(a) { return a.id === advId; });
    if (!adv) return;
    if (adv.budgetBonus) G.budget += adv.budgetBonus;
  });
  
  G.budgetMax = G.budget;
  G.budgetIncomeThisYear = 0; G.budgetSpentThisYear = 0;
  G.orgOperatingCost = orgBudgetOverrides.operatingCost || bc.operatingCostPerRound || 8;
  G.orgBaseIncome = orgBudgetOverrides.baseIncome || bc.baseIncomePerRound || 5;
  var totalRounds = GAME_DATA.config.totalRounds || 6;
  G.investmentPool = totalRounds * (bc.investmentsPerYear || 1);
  G.investmentsUsed = 0;
  G.pendingReserves = [];
  // Initialize political position based on org
  G.politicalPosition = getOrgStartingPosition(G.orgId);
  G.politicalClout = getOrgStartingClout(G.orgId);
  // Trait modifiers for politics
  G.charTraits.forEach(function(tid){
    var t = GAME_DATA.characterTraits.find(function(t){return t.id===tid});
    if(t && t.id === 'political_operator') { G.politicalClout += 10; }
    if(t && t.id === 'grassroots_organizer') { G.politicalPosition -= 3; G.politicalClout += 5; }
  });
  // Apply advisor political lean and clout
  G.selectedAdvisors.forEach(function(advId) {
    var adv = pool.find(function(a) { return a.id === advId; });
    if (!adv) return;
    if (adv.politicalLean) G.politicalPosition += adv.politicalLean;
    if (adv.cloutBonus) G.politicalClout += adv.cloutBonus;
  });
  // Initialize constituency segments
  initSegmentApprovals(G.orgId);
  G.stats.trust = computeCompositeTrust();

  showScreen('game-screen');
  initTicker();
  beginRound();
  // Show onboarding tutorial for first-time players
  setTimeout(showOnboarding, 600);
}

function startPromoGame(){
  clearSave();
  const org=GAME_DATA.nationalOrganizations.find(o=>o.id===G.orgId);
  const orgBudget = getOrgStartingBudget(G.orgId);
  const n = GAME_DATA.stats.length;
  const evenSplit = orgBudget / n;
  
  GAME_DATA.stats.forEach(s=>{
    let v=s.startBase+10;
    if(org.statModifiers&&org.statModifiers[s.id]) v+=org.statModifiers[s.id];
    const alloc = G.priorities[s.id] || evenSplit;
    const offset = Math.round(((alloc - evenSplit) / evenSplit) * 15);
    v+=offset;
    G.stats[s.id]=Math.max(5,Math.min(100,v));
  });
  G.missionStars=GAME_DATA.config.missionStartStars||3;
  G.round=0; G.history=[]; G.usedScenarioIds=[]; G.usedInboxIds=[]; G.promotionLevel=1;
  G.inboxMessages=[]; G.coalitionStrikes={};
  // Initialize budget for national org
  var bc = GAME_DATA.config.budgetConfig || {};
  var orgBudgetOverrides = org.budgetOverrides || {};
  G.budget = orgBudgetOverrides.startingBudget || bc.startingBudget || 120;
  if(orgBudgetOverrides.startingBudgetBonus) G.budget += orgBudgetOverrides.startingBudgetBonus;
  G.budgetMax = G.budget;
  G.budgetIncomeThisYear = 0; G.budgetSpentThisYear = 0;
  G.orgOperatingCost = orgBudgetOverrides.operatingCost || bc.operatingCostPerRound || 8;
  G.orgBaseIncome = orgBudgetOverrides.baseIncome || bc.baseIncomePerRound || 5;
  // National investment pool: rounds × national multiplier
  var totalRounds = GAME_DATA.config.totalRounds || 6;
  G.investmentPool = totalRounds * (bc.nationalInvestmentsPerYear || 2);
  G.investmentsUsed = 0;
  G.pendingReserves = [];
  // Carry forward political position, boost clout for national level
  G.politicalPosition = G.politicalPosition; // keep from local
  // Initialize constituency segments for national org
  initSegmentApprovals(G.orgId);
  G.stats.trust = computeCompositeTrust();
  G.politicalClout = Math.min(100, G.politicalClout + 15); // promotion clout bonus
  
  showScreen('game-screen');
  initTicker();
  beginRound();
}

// ═══════════════ ROUND ═══════════════
// ═══════════════ ROUND ENTROPY ═══════════════
// Stats naturally decay each round to simulate organizational entropy
var ENTROPY_MESSAGES = [
  "Between crises, attention drifts. Relationships require maintenance.",
  "Time erodes what you don\u2019t actively sustain.",
  "Donors ask \u2018what have you done for me lately?\u2019 Staff energy flags.",
  "The community\u2019s memory is short. Last month\u2019s victory is already fading.",
  "Entropy is the default state of organizations. Progress requires constant effort.",
  "Board members grow restless. Volunteers drift to other causes.",
  "Institutional momentum slows without constant attention.",
  "The news cycle moves on. Your last win is already yesterday\u2019s story."
];

function applyEntropy() {
  var FLOOR = 25;
  var statIds = GAME_DATA.stats.map(function(s) { return s.id; });
  var chips = '';
  var anyDecayed = false;

  statIds.forEach(function(statId) {
    var current = G.stats[statId] || 50;
    if (current <= FLOOR) return; // don't decay below floor
    var decay = Math.floor(Math.random() * 3) + 2; // 2-4
    // Don't let decay push below floor
    decay = Math.min(decay, current - FLOOR);
    if (decay <= 0) return;

    if (statId === 'trust' && G.segmentApproval) {
      // Decay each segment individually
      var segments = GAME_DATA.config.segments || [];
      segments.forEach(function(seg) {
        var segVal = G.segmentApproval[seg.id] || 50;
        if (segVal <= FLOOR) return;
        var segDecay = Math.floor(Math.random() * 3) + 2;
        segDecay = Math.min(segDecay, segVal - FLOOR);
        if (segDecay > 0) {
          G.segmentApproval[seg.id] = segVal - segDecay;
        }
      });
      G.stats.trust = computeCompositeTrust();
      var newVal = G.stats.trust;
      var effectiveDecay = current - newVal;
      if (effectiveDecay > 0) {
        var lbl = GAME_DATA.stats.find(function(s){return s.id===statId;})?.label || statId;
        chips += '<span class="chip chip-neg">-' + effectiveDecay + ' ' + lbl + '</span>';
        anyDecayed = true;
      }
    } else {
      G.stats[statId] = current - decay;
      var lbl = GAME_DATA.stats.find(function(s){return s.id===statId;})?.label || statId;
      chips += '<span class="chip chip-neg">-' + decay + ' ' + lbl + '</span>';
      anyDecayed = true;
    }
  });

  if (anyDecayed) {
    var msg = ENTROPY_MESSAGES[Math.floor(Math.random() * ENTROPY_MESSAGES.length)];
    var div = document.createElement('div');
    div.className = 'game-notification notif-entropy';
    div.innerHTML = '<button class="notif-close" onclick="event.stopPropagation();this.parentNode.remove()">\u2715</button>' +
      '<div style="font-weight:700;margin-bottom:5px">\u23f3 Time Passes</div>' +
      '<div style="font-size:12px;opacity:0.9;margin-bottom:6px;font-style:italic">' + msg + '</div>' +
      '<div>' + chips + '</div>';
    div.onclick = function(){ div.remove(); };
    document.body.appendChild(div);
    positionNotification(div);
    setTimeout(function(){ if(div.parentNode) div.remove(); }, 7000);
  }
}

function beginRound(){
  G.round++;
  if(G.round>GAME_DATA.config.totalRounds){endYear();return;}
  
  // Record stat snapshot for momentum tracking
  recordStatSnapshot();
  
  // Apply stat momentum (Feature 6)
  if(G.round > 1) applyMomentum();
  
  // Apply round entropy (natural stat decay)
  if(G.round > 1) applyEntropy();
  
  // Check coaching warnings (Year 1 only)
  if(G.round > 1) checkCoachingWarnings();
  
  // Apply coalition benefits (Feature 5)
  applyCoalitionBenefits();
  
  // Budget: auto income and operating costs
  if(G.round > 1) {
    var bc = GAME_DATA.config.budgetConfig || {};
    var fundStatId = bc.fundraisingStatId || 'donors';
    var fundMult = bc.fundraisingIncomeMultiplier || 0.12;
    var income = Math.round((G.orgBaseIncome || 5) + (G.stats[fundStatId] || 50) * fundMult);
    var costs = G.orgOperatingCost || 8;
    G.budget += income - costs;
    G.budgetIncomeThisYear += income;
    G.budgetSpentThisYear += costs;
    // Process pending reserve returns
    var returnedReserves = 0;
    G.pendingReserves = (G.pendingReserves||[]).filter(function(r) {
      r.roundsLeft--;
      if(r.roundsLeft <= 0) { returnedReserves += r.amount; return false; }
      return true;
    });
    if(returnedReserves > 0) {
      G.budget += returnedReserves;
      G.budgetIncomeThisYear += returnedReserves;
      var div = document.createElement('div');
      div.className = 'game-notification';
      div.innerHTML = '<div style="font-weight:700;margin-bottom:3px">🏦 Reserve Matured</div><div style="font-size:12px;opacity:0.9">Your reserve investment returned +' + returnedReserves + ' budget.</div>';
      div.onclick = function(){div.remove()};
      document.body.appendChild(div);
      positionNotification(div);
      setTimeout(function(){if(div.parentNode)div.remove()}, 5000);
    }
    if(G.budget < 0) G.budget = 0; // Floor at 0
    // Update budgetMax if budget grew beyond starting
    if(G.budget > G.budgetMax) G.budgetMax = G.budget;
    // Budget crisis notification
    if(G.budget <= 10 && G.budget + costs - income <= 10) {
      // Was already low — no repeat warning
    } else if(G.budget <= 10) {
      var div = document.createElement('div');
      div.className = 'game-notification notif-warning';
      div.innerHTML = '<div style="font-weight:700;margin-bottom:3px">⚠️ Budget Crisis</div><div style="font-size:12px;opacity:0.9">Your budget is critically low. Some choices may be unavailable until finances improve.</div>';
      div.onclick = function(){div.remove()};
      document.body.appendChild(div);
      positionNotification(div);
      setTimeout(function(){if(div.parentNode)div.remove()}, 6000);
    }
  }
  
  // Tick coalition durations
  tickCoalitionDurations();
  
  G.apRemaining=GAME_DATA.config.actionPointsPerRound;
  G.roundActions=[]; G.pendingQueue=[];
  G.channelQueues = null; // Reset so distributeScenarios re-picks
  G._coachWarningsThisRound = {}; // Reset coaching warning cooldown
  G.actionsThisRound=0; G.inboxDelivered=0;
  // #7: Pick inbox scenarios using category system
  const pool=GAME_DATA.inboxScenarios.filter(s=>!G.usedInboxIds.includes(s.id) && scenarioApplies(s));
  const picked = weightedPickMultiple(pool, GAME_DATA.config.inboxPerRound||2);
  G.roundInboxQueue = picked;
  G.pendingInbox = []; // No longer used for interrupts
  
  // Deliver inbox messages to persistent inbox panel
  // #20: Don't show toast notifications on first round — wait until player takes first action
  picked.forEach(function(sc){
    G.usedInboxIds.push(sc.id);
    var msg = {id:sc.id, scenario:sc, unread:true, expired:false, timerRemaining: sc.expiresIn||null, deliveredRound:G.round, toastShown: false};
    G.inboxMessages.push(msg);
    if(G.actionsThisRound > 0 || G.round > 1) {
      showInboxToast(sc);
      msg.toastShown = true;
    }
  });
  
  updateHUD();
  updateInboxPanel();
  
  // Between-round flow: coalition offer → ticker update → main
  if(G.round > 1) {
    // Feed gazette headlines into ticker
    feedTickerHeadlines();
    var coalOffer = checkCoalitionOffers();
    if(coalOffer){
        showCoalitionOffer(coalOffer);
      return;
    }
  }
  afterCoalitionCheck();
}

// Called after coalition offer is accepted/declined (or skipped)
function afterCoalitionCheck(){
  // Gazette headlines now go to ticker, not popup
  endRoundContinue();
}

function endRoundContinue(){
  renderMain();
  saveGame();
}

function weightedPickMultiple(scenarios, count) {
  const result = [];
  let remaining = [...scenarios];
  for (let i = 0; i < count && remaining.length > 0; i++) {
    const pick = weightedPick(remaining);
    if (pick) {
      result.push(pick);
      remaining = remaining.filter(s => s.id !== pick.id);
    }
  }
  return result;
}

function updateHUD(){
  const allOrgs=[...GAME_DATA.organizations,...GAME_DATA.nationalOrganizations];
  const org=allOrgs.find(o=>o.id===G.orgId);
  document.getElementById('hud-char-emoji').textContent=G.charEmoji;
  document.getElementById('hud-char-name').textContent=G.charName;
  document.getElementById('hud-org-name').textContent=org?.name||'';

  // Recalculate composite trust from segments
  if (G.segmentApproval) {
    G.stats.trust = computeCompositeTrust();
  }
  document.getElementById('hud-meters').innerHTML=GAME_DATA.stats.map(s=>{
    const v=Math.round(G.stats[s.id]||0);
    const isTrust = s.id === 'trust' && G.segmentApproval;
    return `<div class="meter${isTrust?' trust-meter':''}">
      <span class="m-label">${s.label}</span>
      <div class="m-bar-wrap"><div class="m-bar" style="width:${v}%;background:${barColor(v)}"></div></div>
      <span class="m-val">${v}${momentumArrow(s.id)}</span>
      ${isTrust ? renderSegmentTooltip() : ''}
    </div>`;
  }).join('');
  
  // Budget display with coins illustration
  var budgetBagsEl = document.getElementById('hud-budget-bags');
  var budgetValEl = document.getElementById('hud-budget-val');
  if(budgetBagsEl) {
    budgetBagsEl.innerHTML = '<img src="art/coins.png" style="width:24px;height:auto;vertical-align:middle"><span style="font-family:\'Merriweather\',serif;font-weight:700;font-size:13px;margin-left:4px;vertical-align:middle">' + Math.round(G.budget) + '</span>';
  }
  if(budgetValEl) {
    budgetValEl.style.display = 'none';
  }

  // Mission stars with star illustration
  const max=GAME_DATA.config.missionMaxStars||5;
  var starsHtml = '';
  for(var si=0;si<max;si++) {
    if(si<G.missionStars) starsHtml += '<img src="art/star.png" style="width:18px;height:18px;vertical-align:middle">';
    else starsHtml += '<img src="art/star.png" style="width:18px;height:18px;vertical-align:middle;opacity:0.25;filter:grayscale(0.5)">';
  }
  var starsEl = document.getElementById('hud-stars');
  starsEl.innerHTML = starsHtml;

  // AP pips are now rendered inline in renderMain, not here
  
  // Coalition badges - now in dedicated strip below investments
  var coalStrip = document.getElementById('coalition-strip');
  var coalInner = document.getElementById('coalition-strip-inner');
  if(coalStrip && coalInner) {
    if((G.activeCoalitions||[]).length > 0) {
      coalStrip.style.display = '';
      coalInner.innerHTML = '<span class="coalition-strip-label">Active Coalitions</span>' + renderCoalitionBadges();
    } else {
      coalStrip.style.display = 'none';
    }
  }
  
  // Inbox strip - horizontal bar above ticker
  updateInboxStrip();
  
  // #8: End Round only enabled when AP = 0 (now inline, handled in renderMain)
  
  // Render investment strip
  renderInvestStrip();
  
  // Update political clout display
  updatePoliticsHUD();
}

// ═══════════════ DESK / CHANNEL DISTRIBUTION ═══════════════
function distributeScenarios() {
  // Pre-pick scenarios for this round and split across desk objects
  var channels = ['monitor', 'folder', 'keys'];
  G.channelQueues = { monitor: [], folder: [], keys: [] };

  // How many scenarios to pre-pick (one per AP remaining + a couple extra)
  var needed = (G.apRemaining || 0) + 2;
  var picked = [];
  for (var i = 0; i < needed; i++) {
    var eligible = GAME_DATA.scenarios.filter(function(s) {
      return !G.usedScenarioIds.includes(s.id) && !picked.includes(s.id) && scenarioApplies(s);
    });
    if (eligible.length === 0) break;
    var sc = weightedPick(eligible);
    if (sc) picked.push(sc.id);
  }

  // Distribute picked scenarios across channels
  picked.forEach(function(scenarioId) {
    var sc = GAME_DATA.scenarios.find(function(s) { return s.id === scenarioId; });
    if (!sc) return;
    var ch = sc.channel || 'any';
    if (ch !== 'any' && G.channelQueues[ch]) {
      G.channelQueues[ch].push(scenarioId);
    } else {
      // Distribute to channel with fewest items
      var min = channels.reduce(function(a, b) {
        return G.channelQueues[a].length <= G.channelQueues[b].length ? a : b;
      });
      G.channelQueues[min].push(scenarioId);
    }
  });
}

// ═══════════════ MAIN RENDER ═══════════════
function renderMain(){
  var el=document.getElementById('game-inner');
  var disabled=G.apRemaining<=0;

  // Ensure channel queues are populated
  if (!G.channelQueues || !G.channelQueues.monitor) distributeScenarios();

  // Round info
  var ri = GAME_DATA.config.roundNames[G.round-1]||{year:'',round:'',hebrew:'',english:''};
  var totalRounds = GAME_DATA.config.totalRounds || 6;
  var roundHeading = 'Round ' + G.round + ' of ' + totalRounds + ' — ' + ri.year;
  if (ri.hebrew) roundHeading += ' — ' + ri.hebrew + ' / ' + ri.english;

  // End round button (only when AP = 0)
  var endRoundHtml = disabled ? '<button class="btn btn-sm btn-primary ap-end" onclick="endRound()" style="margin-top:12px">End Round \u2192</button>' : '';

  // --- Phone (inbox) ---
  var activeInbox = (G.inboxMessages||[]).filter(function(m){ return !m.expired; });
  var phoneBadge = activeInbox.length > 0 ? '<div class="desk-obj-badge desk-obj-badge-red">' + activeInbox.length + '</div>' : '';
  var phoneRingClass = activeInbox.some(function(m){ return m.unread; }) ? ' desk-ring-once' : '';

  var phoneScreenHtml = '';
  if (activeInbox.length > 0) {
    phoneScreenHtml = '<div class="desk-phone-status"><span>Inbox</span><span>' + activeInbox.length + ' msg</span></div>';
    phoneScreenHtml += '<div class="desk-phone-messages">';
    activeInbox.forEach(function(m) {
      var sc = m.scenario || {};
      var urgent = m.timerRemaining ? '<span class="desk-phone-alert">\u2757</span>' : '';
      phoneScreenHtml += '<div class="desk-phone-msg" onclick="event.stopPropagation();openInboxMessage(\'' + m.id + '\')">';
      phoneScreenHtml += '<div class="desk-phone-from">' + urgent + esc(sc.from || 'Unknown') + '<span class="desk-phone-time">' + (m.timerRemaining ? m.timerRemaining + ' rd' : '') + '</span></div>';
      phoneScreenHtml += '<div class="desk-phone-subj">' + esc(sc.subject || sc.title || '') + '</div>';
      phoneScreenHtml += '</div>';
    });
    phoneScreenHtml += '</div>';
    phoneScreenHtml += '<div class="desk-phone-fade"></div>';
  } else {
    phoneScreenHtml = '<div class="desk-phone-empty">No messages</div>';
  }

  // --- Monitor / Folder / Keys badges & disabled state ---
  var monQ = G.channelQueues.monitor || [];
  var folQ = G.channelQueues.folder || [];
  var keyQ = G.channelQueues.keys || [];

  function deskBadge(count) {
    return count > 0 ? '<div class="desk-obj-badge">' + count + '</div>' : '';
  }

  var monDisabled = (disabled || monQ.length === 0) ? ' disabled' : '';
  var folDisabled = (disabled || folQ.length === 0) ? ' disabled' : '';
  var keyDisabled = (disabled || keyQ.length === 0) ? ' disabled' : '';

  // --- Monitor screen (static desktop atmosphere) ---
  var monScreen = '<div class="desk-mon-desktop">'
    + '<div class="desk-mon-win" style="top:8%;left:5%;width:55%;height:50%">'
    + '<div class="desk-mon-win-bar desk-mon-win-bar-green"><span class="desk-mon-dot desk-mon-dot-r"></span><span class="desk-mon-dot desk-mon-dot-y"></span><span class="desk-mon-dot desk-mon-dot-g"></span><span class="desk-mon-win-title">Budget — Q' + G.round + '</span></div>'
    + '<div class="desk-mon-win-body"><div class="desk-mon-chart">'
    + '<div class="desk-mon-chart-bar" style="height:40%;background:#6aa84f"></div>'
    + '<div class="desk-mon-chart-bar" style="height:65%;background:#6aa84f"></div>'
    + '<div class="desk-mon-chart-bar" style="height:50%;background:#e69138"></div>'
    + '<div class="desk-mon-chart-bar" style="height:80%;background:#6aa84f"></div>'
    + '<div class="desk-mon-chart-bar" style="height:35%;background:#e69138"></div>'
    + '</div></div></div>'
    + '<div class="desk-mon-win" style="top:15%;left:35%;width:58%;height:45%">'
    + '<div class="desk-mon-win-bar desk-mon-win-bar-purple"><span class="desk-mon-dot desk-mon-dot-r"></span><span class="desk-mon-dot desk-mon-dot-y"></span><span class="desk-mon-dot desk-mon-dot-g"></span><span class="desk-mon-win-title">The Forward</span></div>'
    + '<div class="desk-mon-win-body"><div class="desk-mon-win-line" style="width:80%;background:#999"></div><div class="desk-mon-win-line" style="width:60%;background:#bbb"></div><div class="desk-mon-win-line" style="width:70%;background:#bbb"></div></div></div>'
    + '<div class="desk-mon-win" style="top:50%;left:10%;width:50%;height:35%">'
    + '<div class="desk-mon-win-bar desk-mon-win-bar-gray"><span class="desk-mon-dot desk-mon-dot-r"></span><span class="desk-mon-dot desk-mon-dot-y"></span><span class="desk-mon-dot desk-mon-dot-g"></span><span class="desk-mon-win-title">Email Draft</span></div>'
    + '<div class="desk-mon-win-body"><div class="desk-mon-win-line" style="width:90%;background:#ccc"></div><div class="desk-mon-win-line" style="width:45%;background:#ccc"></div></div></div>'
    + '</div>'
    + '<div class="desk-mon-taskbar"><div class="desk-mon-taskbar-item active">Budget</div><div class="desk-mon-taskbar-item">News</div><div class="desk-mon-taskbar-item">Mail</div></div>';

  el.innerHTML = ''
    + (disabled ? '<div style="padding:13px 17px;background:#fffdf5;border:1.5px solid var(--gold);margin-bottom:18px;font-size:13px;color:var(--muted);"><strong style="color:var(--ink)">No actions remaining.</strong> Click "End Round" below to continue.</div>' : '')
    + '<div style="margin-bottom:28px">'
    + '<div class="section-header">'
    + '<span class="step-ind">' + roundHeading + '</span>'
    + '<h2>Your Desk</h2>'
    + '<p>You have <strong>' + G.apRemaining + '</strong> action' + (G.apRemaining !== 1 ? 's' : '') + ' remaining.</p>'
    + endRoundHtml
    + '</div>'
    + '<div class="desk-objects">'

    // Phone
    + '<div class="desk-obj desk-obj-phone' + phoneRingClass + '" id="desk-phone" onclick="toggleInbox()">'
    + phoneBadge
    + '<div class="desk-phone-wrap">'
    + '<img class="desk-phone-img" src="art/phone.png" />'
    + '<div class="desk-phone-screen">' + phoneScreenHtml + '</div>'
    + '</div>'
    + '<div class="desk-obj-sub">Free to answer</div>'
    + '</div>'

    // Monitor
    + '<div class="desk-obj desk-obj-monitor' + monDisabled + '" onclick="deskAction(\'monitor\')">'
    + deskBadge(monQ.length)
    + '<div class="desk-monitor-wrap">'
    + '<img class="desk-monitor-img" src="art/monitor.png" />'
    + '<div class="desk-monitor-screen">' + monScreen + '</div>'
    + '</div>'
    + '<div class="desk-obj-sub">1 action each</div>'
    + '</div>'

    // Folder
    + '<div class="desk-obj desk-obj-folder' + folDisabled + '" onclick="deskAction(\'folder\')">'
    + deskBadge(folQ.length)
    + '<img class="desk-folder-img" src="art/folder.png" />'
    + '<div class="desk-obj-sub">1 action each</div>'
    + '</div>'

    // Keys
    + '<div class="desk-obj desk-obj-keys' + keyDisabled + '" onclick="deskAction(\'keys\')">'
    + deskBadge(keyQ.length)
    + '<img class="desk-keys-img" src="art/keys.png" />'
    + '<div class="desk-obj-label">Out &amp; About</div>'
    + '<div class="desk-obj-sub">1 action each</div>'
    + '</div>'

    + '</div>'
    + '</div>'

    // Action log
    + '<div class="invest-toggle-bar">'
    + (G.roundActions.length > 0 ? '<button class="log-toggle-btn" onclick="toggleActionLog()">\uD83D\uDCCB Action Log <span class="log-btn-count">' + G.roundActions.length + '</span></button>' : '')
    + '</div>'
    + '<div class="action-log-panel" id="action-log-panel">'
    + G.roundActions.map(function(a) {
        return '<div class="act-result">'
          + '<div class="act-result-title">' + a.icon + ' ' + a.name + '</div>'
          + '<div class="act-result-text">' + a.outcomeText + '</div>'
          + '<div class="chip-row">' + a.chips + '</div>'
          + '</div>';
      }).join('')
    + '</div>';
}

// ═══════════════ DESK ACTION ═══════════════
function deskAction(channel) {
  if (G.apRemaining <= 0) return;
  var queue = G.channelQueues[channel];
  if (!queue || queue.length === 0) return;

  // Pull next scenario from this channel's queue
  var scenarioId = queue.shift();
  G.apRemaining--;
  G.actionsThisRound++;

  // Tick persistent inbox timers
  tickInboxTimers();

  // Show deferred inbox toasts after first action
  (G.inboxMessages||[]).forEach(function(msg) {
    if(!msg.toastShown && !msg.expired) {
      showInboxToast(msg.scenario);
      msg.toastShown = true;
    }
  });

  updateHUD();
  updateInboxPanel();
  if(checkFailure()) return;

  // Find and execute the scenario
  var sc = GAME_DATA.scenarios.find(function(s) { return s.id === scenarioId; });
  if (!sc) { renderMain(); return; }

  G.usedScenarioIds.push(sc.id);
  G.history.push('Round ' + G.round + ' — Desk: ' + channel);

  // Check for breaking news BEFORE normal scenario
  var bn = checkBreakingNews();
  if (bn) {
    // Restore the action — breaking news is free
    G.apRemaining++;
    G.actionsThisRound--;
    // Put the scenario back in the channel queue
    queue.unshift(scenarioId);
    G.usedScenarioIds.pop(); // undo the push above
    G.history.pop();
    showBreakingNews(bn);
    return;
  }

  renderScenario(sc);
}

// ═══════════════ ACTION (legacy) ═══════════════
function doAction(actionId){
  if(G.apRemaining<=0) return;
  const action=GAME_DATA.actions.find(a=>a.id===actionId);
  if(!action) return;
  var budgetCost = action.budgetCost || 0;
  if(budgetCost > G.budget) return; // can't afford
  if(budgetCost > 0) { G.budget -= budgetCost; G.budgetSpentThisYear += budgetCost; }
  // Apply budget effect (e.g. fundraise adds budget, advocacy costs budget)
  var bfx = action.budgetEffect || 0;
  if(bfx > 0) { G.budget += bfx; G.budgetIncomeThisYear += bfx; }
  else if(bfx < 0) { G.budget += bfx; G.budgetSpentThisYear += Math.abs(bfx); }
  if(G.budget < 0) G.budget = 0;
  if(G.budget > G.budgetMax) G.budgetMax = G.budget;
  const chips=applyEffects(action.baseEffects);
  var budgetChip = '';
  if(budgetCost > 0) budgetChip += '<span class="chip chip-neg">-' + budgetCost + ' Budget</span>';
  if(bfx > 0) budgetChip += '<span class="chip chip-pos">+' + bfx + ' Budget</span>';
  else if(bfx < 0) budgetChip += '<span class="chip chip-neg">' + bfx + ' Budget</span>';
  G.apRemaining-=action.cost;
  G.actionsThisRound++;
  G.roundActions.push({icon:action.icon,name:action.name,outcomeText:action.outcomeText,chips:chips+budgetChip});
  G.history.push('Round '+G.round+' — '+action.name);
  
  // Tick persistent inbox timers
  tickInboxTimers();
  
  // #20: Show deferred inbox toasts after first action
  (G.inboxMessages||[]).forEach(function(msg) {
    if(!msg.toastShown && !msg.expired) {
      showInboxToast(msg.scenario);
      msg.toastShown = true;
    }
  });
  
  updateHUD();
  updateInboxPanel();
  if(checkFailure()) return;

  // Feature 4: Check for breaking news BEFORE normal scenario
  var bn = checkBreakingNews();
  if(bn){
    // Queue normal scenario for after breaking news
    const sc=pickScenario(action.triggersEventType);
    G.pendingQueue = sc ? ['scenario:'+sc.id] : [];
    showBreakingNews(bn);
    return;
  }

  // #4: Only queue the scenario for this action.
  const sc=pickScenario(action.triggersEventType);
  G.pendingQueue = sc ? ['scenario:'+sc.id] : [];
  processQueue();
}

function processQueue(){
  if(G.pendingQueue.length===0){
    // Inbox is now persistent panel — no interrupts
    renderMain();
    return;
  }
  const [type,id]=G.pendingQueue.shift().split(':');
  if(type==='scenario'){
    const s=GAME_DATA.scenarios.find(x=>x.id===id);
    if(s){G.usedScenarioIds.push(s.id);renderScenario(s);return;}
  }
  processQueue();
}

// ═══════════════ SCENARIO ═══════════════
function renderScenario(s){
  const valid=s.choices.filter(c=>!c.requiresUnlock||G.activeUnlocks.includes(c.requiresUnlock));
  // Auto-infer political lean for choices
  valid.forEach(function(c){ inferPoliticalLean(c, s); });
  const advisorHtml = renderAdvisorQuotes(s);
  // Reset advisor bonus multiplier for new scenario
  G.currentAdvisorBonusMultiplier = 1.0;
  document.getElementById('game-inner').innerHTML=`
    <div class="event-card">
      <span class="event-tag">${s.tag}</span>
      <div class="event-title">${s.title}</div>
      <div class="event-body">${s.body}</div>
      ${advisorHtml}
      <div class="event-choices">
        ${valid.map((c,i)=>{
          var bCost = c.budgetCost || 0;
          var canAfford = bCost <= G.budget;
          var costTag = bCost > 0 ? '<span class="choice-budget-tag'+ (!canAfford?' unaffordable':'') +'">💰 '+bCost+' budget'+ (!canAfford?' (insufficient)':'') +'</span>' : '';
          var lockBudget = bCost > 0 && !canAfford;
          var lockPolitical = isChoicePoliticallyLocked(c);
          var isLocked = lockBudget || lockPolitical;
          var recBadge = getAdvisorRecommendationBadge(s, i);
          return `<button class="ev-choice${isLocked?' budget-locked':''}" ${isLocked?'disabled':''}onclick="chooseScenario('${s.id}',${i})">
            <span class="ev-key">${String.fromCharCode(65+i)}.</span>${c.text}
            ${costTag}
            ${missionBadgeHTML(c)}
            ${renderPoliticalTag(c)}
            ${renderCoalitionWarnings(c)}
            ${renderChoiceAdvisorQuote(c)}
            ${recBadge}
          </button>`;
        }).join('')}
      </div>
    </div>`;
}

function chooseScenario(sid,idx){
  const s=GAME_DATA.scenarios.find(x=>x.id===sid);
  const valid=s.choices.filter(c=>!c.requiresUnlock||G.activeUnlocks.includes(c.requiresUnlock));
  const c=valid[idx];
  
  // Political lock check
  if (isChoicePoliticallyLocked(c)) return;
  
  // Budget cost
  var bCost = c.budgetCost || 0;
  if(bCost > G.budget) return;
  if(bCost > 0) { G.budget -= bCost; G.budgetSpentThisYear += bCost; }
  var budgetChip = bCost > 0 ? '<span class="chip chip-neg">-' + bCost + ' Budget</span>' : '';
  
  // #6: Pick from weighted outcomes
  const outcome = pickOutcome(c);
  
  // Apply political effectiveness modifier to outcome effects (only if scenario is politically relevant)
  var modifiedEffects = Object.assign({}, outcome.effects);
  var isPolitical = s.politicallyRelevant !== false; // default true for backward compat, but editor can set false
  if (isPolitical) {
    applyPoliticalModifier(modifiedEffects);
  }
  
  // Apply advisor recommendation bonus
  var advisorBonus = getAdvisorBonus(s, idx);
  var advisorChips = '';
  var advisorContextNote = '';
  if (advisorBonus.effects) {
    Object.keys(advisorBonus.effects).forEach(function(stat) {
      modifiedEffects[stat] = (modifiedEffects[stat] || 0) + advisorBonus.effects[stat];
    });
    advisorChips = advisorBonus.chips;
    advisorContextNote = advisorBonus.explanation || '';
    G.advisorBonusLog.push({scenarioId: s.id, choiceIndex: idx, effects: advisorBonus.effects});
  }
  // Reset advisor bonus multiplier after use
  G.currentAdvisorBonusMultiplier = 1.0;
  
  const chips=applyEffects(modifiedEffects, c, s);
  
  // Apply political lean/clout
  inferPoliticalLean(c, s);
  var polChips = applyPoliticalEffects(c);
  
  // Political outcome flavor text (only for political scenarios)
  var polFlavor = isPolitical ? politicalOutcomeModifier(outcome) : '';
  
  // Apply budgetEffect from outcome
  var obfx = outcome.budgetEffect || 0;
  if(obfx > 0) { G.budget += obfx; G.budgetIncomeThisYear += obfx; budgetChip += '<span class="chip chip-pos">+' + obfx + ' Budget</span>'; }
  else if(obfx < 0) { G.budget += obfx; G.budgetSpentThisYear += Math.abs(obfx); budgetChip += '<span class="chip chip-neg">' + obfx + ' Budget</span>'; }
  if(G.budget < 0) G.budget = 0;
  if(G.budget > G.budgetMax) G.budgetMax = G.budget;
  
  // #2: Three-tier mission alignment
  const alignment = getMissionAlignment(c);
  const maxS=GAME_DATA.config.missionMaxStars||5;
  let sc='';
  if(alignment==='aligned'){G.missionStars=Math.min(maxS,G.missionStars+1);sc=`<span class="chip chip-star-up">+1 Mission</span>`;}
  else if(alignment==='opposed'){G.missionStars=Math.max(0,G.missionStars-1);sc=`<span class="chip chip-star-dn">-1 Mission</span>`;}
  // neutral: no star change, no chip
  
  recordEvent('choiceMade', {scenarioId:s.id, choiceIndex:idx});
  checkCoalitionViolations(c);
  checkCoalitionStrikes(c);
  G.history.push('EVENT: '+s.title+' → '+c.text.substring(0,55)+'...');
  updateHUD();
  if(checkFailure()) return;
  
  // Check for afterScenario conversation trigger
  var afterConv = checkAfterScenarioConversation(s.id, idx);
  
  // #5: pass chosen choice text, #10: pass context note
  var contextParts = [];
  if (outcome.contextNote) contextParts.push(outcome.contextNote);
  if (advisorContextNote) contextParts.push(advisorContextNote);
  if (polFlavor) contextParts.push(polFlavor);
  var contextWithPol = contextParts.join('<br>');
  showOutcome(s.title, c.text, outcome.text, chips+sc+budgetChip+polChips+advisorChips, contextWithPol, function(){
    if (afterConv) {
      showConversation(afterConv.id, function(){ processQueue(); });
    } else {
      processQueue();
    }
  });
}

// ═══════════════ INBOX ═══════════════
function renderInbox(s){
  // Mark as read in inbox
  var msg = (G.inboxMessages||[]).find(function(m){return m.id===s.id});
  if(msg) msg.unread = false;
  updateInboxPanel();
  updateHUD();
  // Close inbox panel
  var panel = document.getElementById('inbox-panel');
  if(panel) panel.classList.remove('open');
  var overlay = document.getElementById('inbox-overlay');
  if(overlay) overlay.classList.remove('open');
  
  const valid=s.choices.filter(c=>!c.requiresUnlock||G.activeUnlocks.includes(c.requiresUnlock));
  // Auto-infer political lean for inbox choices
  valid.forEach(function(c){ inferPoliticalLean(c, s); });
  document.getElementById('game-inner').innerHTML=`
    <div class="inbox-card">
      <div class="inbox-head">
        <div class="inbox-from">${s.tag==='Email'?'📧':'💬'} ${s.from}</div>
        <div class="inbox-subj">${s.subject}${msg && msg.timerRemaining !== null && !msg.expired ? '<span class="inbox-timer">🔴 URGENT</span>' : ''}</div>
      </div>
      <div class="inbox-body">${s.body}</div>
      ${renderAdvisorQuotes(s)}
      <div class="inbox-choices">
        <div class="label" style="margin-bottom:7px">How do you respond?</div>
        ${valid.map((c,i)=>{
          var bCost = c.budgetCost || 0;
          var canAfford = bCost <= G.budget;
          var costTag = bCost > 0 ? '<span class="choice-budget-tag'+ (!canAfford?' unaffordable':'') +'">💰 '+bCost+' budget'+ (!canAfford?' (insufficient)':'') +'</span>' : '';
          var lockBudget = bCost > 0 && !canAfford;
          var lockPolitical = isChoicePoliticallyLocked(c);
          var isLocked = lockBudget || lockPolitical;
          return `<button class="ev-choice${isLocked?' budget-locked':''}" ${isLocked?'disabled ':''}onclick="chooseInbox('${s.id}',${i})">
            <span class="ev-key">${String.fromCharCode(65+i)}.</span>${c.text}
            ${costTag}
            ${missionBadgeHTML(c)}
            ${renderPoliticalTag(c)}
            ${renderCoalitionWarnings(c)}
            ${renderChoiceAdvisorQuote(c)}
          </button>`;
        }).join('')}
      </div>
    </div>`;
}

function chooseInbox(sid,idx){
  const s=GAME_DATA.inboxScenarios.find(x=>x.id===sid);
  const valid=s.choices.filter(c=>!c.requiresUnlock||G.activeUnlocks.includes(c.requiresUnlock));
  const c=valid[idx];
  
  // Political lock check
  if (isChoicePoliticallyLocked(c)) return;
  
  // Budget cost
  var bCost = c.budgetCost || 0;
  if(bCost > G.budget) return;
  if(bCost > 0) { G.budget -= bCost; G.budgetSpentThisYear += bCost; }
  var budgetChip = bCost > 0 ? '<span class="chip chip-neg">-' + bCost + ' Budget</span>' : '';
  
  const outcome = pickOutcome(c);
  
  // Apply political effectiveness modifier (only if politically relevant)
  var modifiedEffects = Object.assign({}, outcome.effects);
  var isPolitical = s.politicallyRelevant !== false;
  if (isPolitical) {
    applyPoliticalModifier(modifiedEffects);
  }
  
  // Apply advisor recommendation bonus
  var advisorBonus = getAdvisorBonus(s, idx);
  var advisorChips = '';
  var advisorContextNote = '';
  if (advisorBonus.effects) {
    Object.keys(advisorBonus.effects).forEach(function(stat) {
      modifiedEffects[stat] = (modifiedEffects[stat] || 0) + advisorBonus.effects[stat];
    });
    advisorChips = advisorBonus.chips;
    advisorContextNote = advisorBonus.explanation || '';
    G.advisorBonusLog.push({scenarioId: s.id, choiceIndex: idx, effects: advisorBonus.effects});
  }
  G.currentAdvisorBonusMultiplier = 1.0;
  
  const chips=applyEffects(modifiedEffects, c, s);
  
  // Apply political lean/clout
  inferPoliticalLean(c, s);
  var polChips = applyPoliticalEffects(c);
  var polFlavor = isPolitical ? politicalOutcomeModifier(outcome) : '';
  
  // Apply budgetEffect from outcome
  var obfx = outcome.budgetEffect || 0;
  if(obfx > 0) { G.budget += obfx; G.budgetIncomeThisYear += obfx; budgetChip += '<span class="chip chip-pos">+' + obfx + ' Budget</span>'; }
  else if(obfx < 0) { G.budget += obfx; G.budgetSpentThisYear += Math.abs(obfx); budgetChip += '<span class="chip chip-neg">' + obfx + ' Budget</span>'; }
  if(G.budget < 0) G.budget = 0;
  if(G.budget > G.budgetMax) G.budgetMax = G.budget;
  
  const alignment = getMissionAlignment(c);
  const maxS=GAME_DATA.config.missionMaxStars||5;
  let sc='';
  if(alignment==='aligned'){G.missionStars=Math.min(maxS,G.missionStars+1);sc=`<span class="chip chip-star-up">+1 Mission</span>`;}
  else if(alignment==='opposed'){G.missionStars=Math.max(0,G.missionStars-1);sc=`<span class="chip chip-star-dn">-1 Mission</span>`;}
  
  recordEvent('choiceMade', {scenarioId:s.id, choiceIndex:idx});
  checkCoalitionViolations(c);
  checkCoalitionStrikes(c);
  // Remove from inbox messages (answered)
  G.inboxMessages = (G.inboxMessages||[]).filter(function(m){return m.id!==s.id});
  updateInboxPanel();
  G.history.push('MESSAGE: '+s.subject+' → '+c.text.substring(0,55)+'...');
  updateHUD();
  if(checkFailure()) return;
  var contextParts = [];
  if (outcome.contextNote) contextParts.push(outcome.contextNote);
  if (advisorContextNote) contextParts.push(advisorContextNote);
  if (polFlavor) contextParts.push(polFlavor);
  var contextWithPol = contextParts.join('<br>');
  showOutcome(s.subject, c.text, outcome.text, chips+sc+budgetChip+polChips+advisorChips, contextWithPol, ()=>processQueue());
}

// ═══════════════ OUTCOME ═══════════════
// #5: Shows chosen choice, #10: Shows context note
function showOutcome(title, choiceText, outcomeText, chips, contextNote, cb){
  const id='oc'+Date.now();
  document.getElementById('game-inner').innerHTML=`
    <div class="outcome-panel">
      <h3>${title}</h3>
      <div class="outcome-your-choice">
        <span class="label">Your Decision</span>
        ${choiceText}
      </div>
      <p>${outcomeText}</p>
      <div class="chip-row" style="margin-bottom:16px">${chips}</div>
      ${contextNote ? `<div class="context-note">${contextNote}</div>` : ''}
      <button id="${id}" class="btn btn-primary" style="margin-top:16px">Continue →</button>
    </div>`;
  document.getElementById(id).onclick=cb;
}

// ═══════════════ EFFECTS ═══════════════
function applyEffects(fx, choice, scenario){
  let chips='';
  for(const [stat,delta] of Object.entries(fx||{})){
    if(!GAME_DATA.stats.find(s=>s.id===stat)) continue;
    if(stat === 'trust' && G.segmentApproval) {
      // Route trust through constituency segments
      var segChips = applySegmentEffects(delta, choice || null, scenario || null);
      const compositeV = Math.round(G.stats.trust || 0);
      if(delta!==0){
        // Wrap trust chip with hover tooltip for segment details
        chips+=`<span class="chip-hover-wrap"><span class="chip ${delta>0?'chip-pos':'chip-neg'}">${delta>0?'+':''}${delta} Trust</span>`;
        if(segChips) chips += '<span class="chip-hover-tooltip">' + segChips + '</span>';
        chips += '</span>';
      }
    } else {
      G.stats[stat]=Math.max(0,Math.min(100,(G.stats[stat]||0)+delta));
      if(delta!==0){
        const lbl=GAME_DATA.stats.find(s=>s.id===stat)?.label||stat;
        chips+=`<span class="chip ${delta>0?'chip-pos':'chip-neg'}">${delta>0?'+':''}${delta} ${lbl}</span>`;
      }
    }
  }
  return chips;
}

// ═══════════════ FAILURE ═══════════════
function checkFailure(){
  const thr=GAME_DATA.config.failureBarThreshold||20;
  const bad=GAME_DATA.stats.find(s=>(G.stats[s.id]||0)<=thr);
  if(bad){
    renderEndScreen(0,true,`Your ${bad.label} stat fell to a critical level. The board has called an emergency meeting.`);
    showScreen('end-screen');
    return true;
  }
  // Fire coaching warnings after each action (Year 1 only, non-fatal)
  checkCoachingWarnings();
  return false;
}

// ═══════════════ END ROUND ═══════════════
// #8: This is only callable when AP = 0
function endRound(){
  if(G.apRemaining > 0) return; // safety check
  beginRound();
}

// ═══════════════ YEAR END ═══════════════
function endYear(){
  const w=GAME_DATA.config.scoreWeights;
  let score=0,tw=0;
  GAME_DATA.stats.forEach(s=>{const wt=w[s.id]||0.25;score+=(G.stats[s.id]||0)*wt;tw+=wt;});
  score=Math.round(score/tw);
  
  // Budget health bonus/penalty (capped at +/- 5 points)
  var budgetMod = G.budget >= 60 ? 5 : G.budget >= 40 ? 2 : G.budget >= 20 ? 0 : G.budget >= 10 ? -3 : -5;
  score += budgetMod;
  
  // Political effectiveness bonus/penalty (capped at +/- 4 points)
  var polEff = getPoliticalEffectiveness();
  var polMod = polEff >= 1.05 ? 4 : polEff >= 0.95 ? 2 : polEff >= 0.8 ? 0 : polEff >= 0.6 ? -2 : -4;
  score += polMod;
  
  // #3: Mission star scoring
  const starPoints = GAME_DATA.config.missionStarPoints || 5;
  const starBonus = G.missionStars * starPoints;
  score += starBonus;
  score = Math.min(100, score); // cap at 100
  
  // #3: 0 mission stars = automatic loss
  if(G.missionStars <= 0){
    renderEndScreen(score, true, 'You lost all mission stars. Without a clear mission, your board has lost confidence in your leadership.');
    showScreen('end-screen');
    return;
  }
  
  const fail=GAME_DATA.config.failureScoreThreshold||40;
  const promo=GAME_DATA.config.promotionThreshold||80;
  if(score<fail){renderEndScreen(score,false,null,false,false,false);showScreen('end-screen');return;}
  if(score>=promo){
    if(G.promotionLevel>=1){renderEndScreen(score,false,null,true,false,false);}
    else{renderEndScreen(score,false,null,false,true,false);}
    showScreen('end-screen');return;
  }
  renderEndScreen(score,false,null,false,false,true);
  showScreen('end-screen');
}

function renderEndScreen(score,forcedFail,forcedMsg,retirement=false,promotion=false,anotherYear=false){
  clearSave();
  const titleEl=document.getElementById('end-title');
  const subtitleEl=document.getElementById('end-subtitle');
  titleEl.innerHTML=retirement?"A Distinguished <span>Career</span>":promotion?"You've Been <span>Promoted</span>":anotherYear?"End of <span>Year</span>":"Your Tenure <span>Has Ended</span>";
  subtitleEl.textContent=retirement?'A well-earned rest awaits':promotion?'A larger stage awaits':'';

  let heading,verdict,grade='';
  if(forcedFail){
    heading='Crisis'; verdict=forcedMsg||'Multiple organizational indicators reached critical levels.';
  } else if(retirement){
    heading='A Distinguished Career'; grade='A+';
    verdict="You led at the local level, earned a promotion to the national stage, and succeeded again. Multiple organizations are vying for your board seat. You've earned your retirement — and the community knows it.";
  } else if(promotion){
    heading='Exceptional Leadership'; grade='A';
    verdict='Your performance has attracted national attention. You are being recruited to lead a larger organization. Choose your next challenge wisely.';
  } else {
    const t=GAME_DATA.scoring.thresholds.find(t=>score>=t.min)||GAME_DATA.scoring.thresholds[GAME_DATA.scoring.thresholds.length-1];
    heading=t.heading; grade=t.grade;
    verdict=anotherYear?t.verdict+' The board has decided to give you one more year.':t.verdict;
  }

  document.getElementById('end-heading').textContent=heading;

  // Add illustration to end screen
  var endIllustration = document.getElementById('end-illustration');
  if (!endIllustration) {
    endIllustration = document.createElement('img');
    endIllustration.id = 'end-illustration';
    endIllustration.style.cssText = 'width:140px;height:auto;display:block;margin:16px auto;filter:drop-shadow(2px 4px 8px rgba(0,0,0,0.1))';
    var endHeading = document.getElementById('end-heading');
    if (endHeading) endHeading.parentNode.insertBefore(endIllustration, endHeading);
  }
  if (forcedFail) {
    endIllustration.src = 'art/warning-sign.png';
    endIllustration.alt = 'Crisis';
  } else if (retirement) {
    endIllustration.src = 'art/trophy-chalice.png';
    endIllustration.alt = 'Retirement';
  } else if (promotion) {
    endIllustration.src = 'art/trophy-chalice.png';
    endIllustration.alt = 'Promotion';
  } else if (score < 40) {
    endIllustration.src = 'art/conference-table.png';
    endIllustration.alt = 'Board Meeting';
  } else {
    endIllustration.src = 'art/calendar.png';
    endIllustration.alt = 'Another Year';
  }
  endIllustration.style.display = 'block';

  document.getElementById('end-score').textContent=forcedFail?'—':score;
  document.getElementById('end-grade').textContent=grade?'Grade: '+grade:'';
  document.getElementById('end-verdict').textContent=verdict;
  document.getElementById('end-meters').innerHTML=GAME_DATA.stats.map(s=>{
    const v=Math.round(G.stats[s.id]||0);
    return `<div><span class="end-m-label">${s.label}</span><span class="end-m-val" style="color:${barColor(v)}">${v}</span></div>`;
  }).join('')+`<div><span class="end-m-label">Budget</span><span class="end-m-val" style="color:${G.budget>=40?'#b8860b':G.budget>=20?'#e67e22':'#c0392b'}"><img src="art/coins.png" style="width:16px;vertical-align:middle"> ${Math.round(G.budget)}</span></div>`+`<div><span class="end-m-label">Politics</span><span class="end-m-val" style="color:#6b7280;font-size:14px">${getPositionLabel(G.politicalPosition)}</span></div>`+`<div><span class="end-m-label">Clout</span><span class="end-m-val" style="color:#b8860b">⚡${Math.round(G.politicalClout)}</span></div>`+`<div><span class="end-m-label">Mission</span><span class="end-m-val" style="color:var(--gold)">${Array.from({length:GAME_DATA.config.missionMaxStars||5},(_, i)=>i<G.missionStars?'<img src="art/star.png" style="width:14px;height:14px;vertical-align:middle">':'<img src="art/star.png" style="width:14px;height:14px;vertical-align:middle;opacity:0.25;filter:grayscale(0.5)">').join('')}</span></div>`+`<div class="budget-summary" style="grid-column:1/-1"><strong>Budget Summary:</strong> Income this year: +${G.budgetIncomeThisYear} · Spent: -${G.budgetSpentThisYear} · Net: ${G.budgetIncomeThisYear - G.budgetSpentThisYear >= 0 ? '+' : ''}${G.budgetIncomeThisYear - G.budgetSpentThisYear} · Investments made: ${G.investmentsUsed||0} · <strong>Political:</strong> ${getPositionLabel(G.politicalPosition)} with ${Math.round(G.politicalClout)} clout (${getEffectivenessDesc().label} effectiveness)</div>`;

  const actEl=document.getElementById('end-actions');
  actEl.innerHTML='';
  if(retirement){
    actEl.innerHTML='<button class="btn btn-gold" onclick="restartSameCharacter()">Play Again (Same Character) \u2192</button><button class="btn btn-secondary" onclick="resetGame()">New Character \u2192</button>';
  } else if(promotion){
    const b=document.createElement('button');
    b.className='btn btn-gold'; b.textContent='Choose Your Next Organization \u2192'; b.onclick=showPromoScreen;
    actEl.appendChild(b);
    const b2=document.createElement('button');
    b2.className='btn btn-secondary'; b2.textContent='Restart (Same Character)'; b2.onclick=restartSameCharacter;
    actEl.appendChild(b2);
    const b3=document.createElement('button');
    b3.className='btn btn-secondary'; b3.textContent='New Character'; b3.onclick=resetGame;
    actEl.appendChild(b3);
  } else if(anotherYear){
    const b=document.createElement('button');
    b.className='btn btn-primary'; b.textContent='Begin Another Year \u2192';
    b.onclick=()=>{G.round=0;G.usedScenarioIds=[];G.usedInboxIds=[];G.budgetIncomeThisYear=0;G.budgetSpentThisYear=0;G.investmentsUsed=0;G.investmentUses={};var bc=GAME_DATA.config.budgetConfig||{};var totalRounds=GAME_DATA.config.totalRounds||6;G.investmentPool=totalRounds*(G.promotionLevel>0?(bc.nationalInvestmentsPerYear||2):(bc.investmentsPerYear||1));G._coachWarningsThisRound={};showScreen('game-screen');beginRound();};
    actEl.appendChild(b);
    const b2=document.createElement('button');
    b2.className='btn btn-secondary'; b2.textContent='Restart (Same Character)'; b2.onclick=restartSameCharacter;
    actEl.appendChild(b2);
    const b3=document.createElement('button');
    b3.className='btn btn-secondary'; b3.textContent='New Character'; b3.onclick=resetGame;
    actEl.appendChild(b3);
  } else {
    actEl.innerHTML='<button class="btn btn-primary" onclick="restartSameCharacter()">Try Again (Same Character) \u2192</button><button class="btn btn-secondary" onclick="resetGame()">New Character \u2192</button>';
  }
}

// ═══════════════ PROMOTION ═══════════════
function showPromoScreen(){
  const org=GAME_DATA.organizations.find(o=>o.id===G.orgId);
  const eligible=org?.promotionEligible||['center'];
  const natOrgs=GAME_DATA.nationalOrganizations.filter(o=>{
    const tilts = Array.isArray(o.politicalTilt) ? o.politicalTilt : [o.politicalTilt];
    return eligible.some(e => tilts.includes(e));
  });
  document.getElementById('promo-list').innerHTML=natOrgs.map(o=>{
    const mods=Object.entries(o.statModifiers||{}).filter(([k])=>k!=='budget');
    const bc = GAME_DATA.config.budgetConfig || {};
    const orgBudget = (o.budgetOverrides?.startingBudget) || bc.startingBudget || 120;
    return `<div class="card" id="poc-${o.id}" onclick="selectPromoOrg('${o.id}')">
      <span class="card-badge ${o.badgeClass}">${o.badge}</span>
      <h3>${o.name}</h3>
      <p style="margin-bottom:0">${o.description}</p>
      ${o.traits?.length?`<ul class="card-traits">${o.traits.map(t=>`<li>${t}</li>`).join('')}</ul>`:''}
      <div class="org-budget-tag">💰 Starting Budget: ${orgBudget}</div>
      ${mods.length?`<div class="card-mods">${mods.map(([k,v])=>`<span class="chip ${v>0?'chip-pos':'chip-neg'}">${v>0?'+':''}${v} ${k}</span>`).join('')}</div>`:''}
      <div style="margin-top:14px"><button class="btn btn-primary btn-sm">Select This Organization →</button></div>
    </div>`;
  }).join('');
  showScreen('promo-screen');
}

function selectPromoOrg(id){
  G.orgId=id;
  autoAllocateStats();
  startPromoGame();
}

// ═══════════════ RESET ═══════════════
function resetGame(){
  clearSave();
  G={charName:'',charEmoji:'',charTraits:[],orgId:null,missionId:null,priorities:{},stats:{},missionStars:0,round:0,apRemaining:0,history:[],pendingQueue:[],roundActions:[],usedScenarioIds:[],usedInboxIds:[],activeUnlocks:[],promotionLevel:0,actionsThisRound:0,inboxDelivered:0,roundInboxQueue:[],pendingInbox:[],inboxMessages:[],coalitionStrikes:{},budget:0,budgetMax:100,budgetIncomeThisYear:0,budgetSpentThisYear:0,orgOperatingCost:0,orgBaseIncome:0,investmentPool:0,investmentsUsed:0,investmentUses:{},pendingReserves:[],_allocBudget:100,_allocMin:1,_allocMax:55,politicalPosition:50,politicalClout:20,segmentApproval:null,segmentHistory:{},segmentSnapshots:[],_coachWarningsLifetime:{},_coachWarningsThisRound:{}};
  
  var ticker = document.getElementById('news-ticker');
  if(ticker) ticker.classList.remove('active');
  initChar();initOrg();initBudget();showScreen('char-screen');
}

function restartSameCharacter(){
  var savedName = G.charName;
  var savedEmoji = G.charEmoji;
  var savedTraits = G.charTraits.slice();
  var savedOrg = G.orgId;
  var savedMission = G.missionId;
  var savedAdvisors = (G.selectedAdvisors||[]).slice();
  
  G.priorities = {};
  G.stats = {};
  G.missionStars = 0;
  G.round = 0;
  G.apRemaining = 0;
  G.history = [];
  G.pendingQueue = [];
  G.roundActions = [];
  G.usedScenarioIds = [];
  G.usedInboxIds = [];
  G.activeUnlocks = [];
  G.promotionLevel = 0;
  G.actionsThisRound = 0;
  G.inboxDelivered = 0;
  G.roundInboxQueue = [];
  G.pendingInbox = [];
  G.inboxMessages = [];
  G.coalitionStrikes = {};
  G.activeCoalitions = [];
  G.declinedCoalitions = [];
  G.brokenCoalitions = [];
  G.statHistory = [];
  G.advisorBonusLog = [];
  G.currentAdvisorBonusMultiplier = 1.0;
  G.budget = 0;
  G.budgetMax = 100;
  G.budgetIncomeThisYear = 0;
  G.budgetSpentThisYear = 0;
  G.orgOperatingCost = 0;
  G.orgBaseIncome = 0;
  G.investmentPool = 0;
  G.investmentsUsed = 0;
  G.investmentUses = {};
  G.pendingReserves = [];
  G.politicalPosition = 50;
  G.politicalClout = 20;
  G.segmentApproval = null;
  G.segmentHistory = {};
  G.segmentSnapshots = [];
  G._coachWarningsLifetime = {};
  G._coachWarningsThisRound = {};
  
  G.charName = savedName;
  G.charEmoji = savedEmoji;
  G.charTraits = savedTraits;
  G.orgId = savedOrg;
  G.missionId = savedMission;
  G.selectedAdvisors = savedAdvisors;
  
  var ticker = document.getElementById('news-ticker');
  if(ticker) ticker.classList.remove('active');
  
  initBudget();
  showScreen('budget-screen');
}

// ═══════════════ INVESTMENT STRIP ═══════════════
function renderInvestStrip() {
  var el = document.getElementById('invest-strip-inner');
  if(!el) return;
  var investments = GAME_DATA.investments || [];
  if(investments.length === 0) { el.innerHTML = ''; return; }
  var remaining = (G.investmentPool || 0) - (G.investmentsUsed || 0);
  G.investmentUses = G.investmentUses || {};
  
  if(remaining <= 0) {
    el.innerHTML = '<span class="invest-strip-label">Investments</span><span class="invest-strip-empty">No investments remaining this year</span>';
    return;
  }
  
  var sorted = investments.slice().sort(function(a, b) {
    var aExhausted = (a.maxUses > 0 && ((G.investmentUses||{})[a.id]||0) >= a.maxUses) ? 1 : 0;
    var bExhausted = (b.maxUses > 0 && ((G.investmentUses||{})[b.id]||0) >= b.maxUses) ? 1 : 0;
    return aExhausted - bExhausted;
  });
  
  var pills = sorted.map(function(inv) {
    var canAfford = inv.budgetCost <= G.budget;
    var usedCount = (G.investmentUses || {})[inv.id] || 0;
    var maxUses = inv.maxUses != null ? inv.maxUses : -1;
    var exhausted = maxUses > 0 && usedCount >= maxUses;
    var isDisabled = !canAfford || remaining <= 0 || exhausted;
    var usesText = '';
    if(maxUses === 1 && exhausted) usesText = ' · done';
    else if(maxUses > 1) usesText = ' · ' + usedCount + '/' + maxUses;
    return '<div class="invest-pill' + (isDisabled ? ' pill-disabled' : '') + '" onclick="' + (isDisabled ? '' : "openInvestModalTo('"+inv.id+"')") + '" title="' + inv.name + ': ' + inv.description + '">' +
      '<span class="pill-icon">' + inv.icon + '</span>' +
      '<span class="pill-name">' + inv.name + '</span>' +
      '<span class="pill-cost">' + inv.budgetCost + '</span>' +
      (usesText ? '<span class="pill-uses">' + usesText + '</span>' : '') +
    '</div>';
  }).join('');
  
  el.innerHTML = '<span class="invest-strip-label">Investments (' + remaining + ')</span>' + pills;
  // Show scroll fade and arrow if content overflows
  var strip = document.getElementById('invest-strip');
  var wrap = strip ? strip.querySelector('.invest-strip-wrap') : null;
  if(strip && wrap) {
    // Ensure fade and arrow elements exist (create once)
    if(!wrap.querySelector('.invest-strip-fade')) {
      var fade = document.createElement('div');
      fade.className = 'invest-strip-fade';
      fade.onclick = function(e){ e.stopPropagation(); scrollInvestStrip(); };
      wrap.appendChild(fade);
      var arrow = document.createElement('span');
      arrow.className = 'invest-scroll-arrow';
      arrow.textContent = '›';
      arrow.onclick = function(e){ e.stopPropagation(); scrollInvestStrip(); };
      wrap.appendChild(arrow);
    }
    strip.classList.remove('has-overflow');
    setTimeout(function(){
      if(el.scrollWidth > el.clientWidth) {
        strip.classList.add('has-overflow');
        el.onscroll = function() {
          var atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 10;
          strip.classList.toggle('has-overflow', !atEnd);
        };
      }
    }, 50);
  }
}

function scrollInvestStrip() {
  var el = document.getElementById('invest-strip-inner');
  if (!el) return;
  el.scrollBy({ left: 200, behavior: 'smooth' });
}

function openInvestModalTo(invId) {
  openInvestModal();
  // Highlight the specific investment card
  setTimeout(function() {
    var cards = document.querySelectorAll('.invest-card');
    cards.forEach(function(c) {
      var cardInvId = c.getAttribute('data-inv-id');
      if(cardInvId === invId) {
        c.style.outline = '3px solid var(--gold)';
        c.style.outlineOffset = '2px';
        c.style.boxShadow = '0 0 20px rgba(184,134,11,0.3)';
        c.scrollIntoView({behavior:'smooth', block:'center'});
      }
    });
  }, 100);
}

// ═══════════════ INVESTMENT SYSTEM ═══════════════
function openInvestModal() {
  var overlay = document.getElementById('invest-modal-overlay');
  var body = document.getElementById('invest-modal-body');
  body.innerHTML = renderInvestmentContent();
  overlay.classList.add('open');
}
function closeInvestModal() {
  document.getElementById('invest-modal-overlay').classList.remove('open');
}
function toggleActionLog() {
  var panel = document.getElementById('action-log-panel');
  if(panel) panel.classList.toggle('open');
}

function renderInvestmentContent() {
  var investments = GAME_DATA.investments || [];
  if(investments.length === 0) return '';
  var remaining = (G.investmentPool || 0) - (G.investmentsUsed || 0);
  G.investmentUses = G.investmentUses || {};
  
  function investEffectChips(fx) {
    return Object.entries(fx||{}).map(function(e) {
      var k = e[0], v = e[1];
      if(v===0) return '';
      var lbl = (GAME_DATA.stats.find(function(s){return s.id===k})||{}).label || k;
      return '<span class="chip '+(v>0?'chip-pos':'chip-neg')+'">'+(v>0?'+':'')+v+' '+lbl+'</span>';
    }).filter(Boolean).join('');
  }
  
  return '<div class="invest-header">' +
      '<h3>💰 Investments</h3>' +
      '<span class="invest-pool-tag">' + remaining + ' investment' + (remaining !== 1 ? 's' : '') + ' remaining this year</span>' +
    '</div>' +
    '<p style="font-size:12px;color:var(--muted);margin-bottom:14px">Spend budget on strategic investments. These don\'t cost actions.</p>' +
    '<div class="invest-cards">' +
    investments.slice().sort(function(a, b) {
      var aEx = (a.maxUses > 0 && ((G.investmentUses||{})[a.id]||0) >= a.maxUses) ? 1 : 0;
      var bEx = (b.maxUses > 0 && ((G.investmentUses||{})[b.id]||0) >= b.maxUses) ? 1 : 0;
      return aEx - bEx;
    }).map(function(inv) {
      var canAfford = inv.budgetCost <= G.budget;
      var hasPool = remaining > 0;
      var usedCount = (G.investmentUses || {})[inv.id] || 0;
      var maxUses = inv.maxUses != null ? inv.maxUses : -1;
      var exhausted = maxUses > 0 && usedCount >= maxUses;
      var isDisabled = !canAfford || !hasPool || exhausted;
      var costClass = !canAfford ? ' unaffordable' : '';
      var usesLabel = '';
      if(maxUses === 1) {
        usesLabel = exhausted ? '<div class="invest-uses-tag exhausted">&#10007; Already purchased</div>' : '<div class="invest-uses-tag">One-time only</div>';
      } else if(maxUses > 1) {
        usesLabel = '<div class="invest-uses-tag' + (exhausted?' exhausted':'') + '">' + usedCount + '/' + maxUses + ' used</div>';
      } else {
        usesLabel = usedCount > 0 ? '<div class="invest-uses-tag">Used ' + usedCount + '&times;</div>' : '';
      }
      var disabledReason = '';
      if(exhausted) disabledReason = ' (limit reached)';
      else if(!canAfford) disabledReason = ' (insufficient)';
      else if(!hasPool) disabledReason = ' (no investments left)';
      return '<div class="invest-card' + (isDisabled ? ' disabled' : '') + '" data-inv-id="' + inv.id + '" onclick="' + (isDisabled ? '' : "makeInvestment('"+inv.id+"')") + '">' +
        '<span class="invest-icon">' + inv.icon + '</span>' +
        '<div class="invest-name">' + inv.name + '</div>' +
        '<div class="invest-desc">' + inv.description + '</div>' +
        '<div class="invest-cost' + costClass + '">💰 ' + inv.budgetCost + ' budget' + disabledReason + '</div>' +
        '<div class="invest-effects">' + investEffectChips(inv.effects) + '</div>' +
        usesLabel +
      '</div>';
    }).join('') +
    '</div>';
}

function makeInvestment(invId) {
  var inv = (GAME_DATA.investments||[]).find(function(i){return i.id===invId});
  if(!inv) return;
  var remaining = (G.investmentPool || 0) - (G.investmentsUsed || 0);
  if(remaining <= 0) return;
  if(inv.budgetCost > G.budget) return;
  
  // Check maxUses
  G.investmentUses = G.investmentUses || {};
  var usedCount = G.investmentUses[inv.id] || 0;
  var maxUses = inv.maxUses != null ? inv.maxUses : -1;
  if(maxUses > 0 && usedCount >= maxUses) return;
  
  // Deduct budget
  G.budget -= inv.budgetCost;
  G.budgetSpentThisYear += inv.budgetCost;
  G.investmentsUsed = (G.investmentsUsed || 0) + 1;
  G.investmentUses[inv.id] = usedCount + 1;
  if(G.budget < 0) G.budget = 0;
  
  // Apply stat effects
  var chips = applyEffects(inv.effects);
  var budgetChip = '<span class="chip chip-neg">-' + inv.budgetCost + ' Budget</span>';
  
  // Handle delayed budget return (e.g. reserves)
  if(inv.budgetReturn && inv.budgetReturnDelay) {
    G.pendingReserves = G.pendingReserves || [];
    G.pendingReserves.push({amount: inv.budgetReturn, roundsLeft: inv.budgetReturnDelay});
    budgetChip += '<span class="chip chip-star-up">🏦 +' + inv.budgetReturn + ' in ' + inv.budgetReturnDelay + ' rounds</span>';
  }
  
  G.roundActions.push({icon: inv.icon, name: inv.name, outcomeText: inv.outcomeText, chips: chips + budgetChip});
  G.history.push('INVEST: ' + inv.name + ' (-' + inv.budgetCost + ' budget)');
  
  updateHUD();
  if(checkFailure()) { closeInvestModal(); return; }
  // Re-render modal content
  document.getElementById('invest-modal-body').innerHTML = renderInvestmentContent();
  renderMain();
}
// ═══════════════ POLITICAL CLOUT SYSTEM ═══════════════

// Get starting political position based on org
function getOrgStartingPosition(orgId) {
  var positions = {
    'left': 25, 'right': 75, 'center': 50, 'jcc': 48,
    'nat_left': 22, 'nat_right': 78, 'nat_center': 50, 'nat_jcc': 48
  };
  return positions[orgId] || 50;
}

// Get starting political clout based on org
function getOrgStartingClout(orgId) {
  var clouts = {
    'left': 15, 'right': 15, 'center': 25, 'jcc': 10,
    'nat_left': 30, 'nat_right': 30, 'nat_center': 40, 'nat_jcc': 20
  };
  return clouts[orgId] || 15;
}

// Get a label for the current political position
function getPositionLabel(pos) {
  if (pos <= 15) return 'Far Left';
  if (pos <= 30) return 'Left';
  if (pos <= 42) return 'Center-Left';
  if (pos <= 58) return 'Center';
  if (pos <= 70) return 'Center-Right';
  if (pos <= 85) return 'Right';
  return 'Far Right';
}

// Calculate political effectiveness multiplier
// Center-left (35-45) is optimal for American Jewish leadership
// Exponentially harder at extremes, harder on far-right than far-left
// BIPARTISAN TRAP: Staying centered (35-65) limits influence — access everywhere, influence nowhere
function getPoliticalEffectiveness() {
  var pos = G.politicalPosition;
  var clout = G.politicalClout;
  
  // Position modifier: center-left is ideal (around 40), with asymmetric penalties
  var optimalPos = 40; // slightly left of center
  var dist = Math.abs(pos - optimalPos);
  var positionMod;
  
  if (dist <= 10) {
    // Sweet spot: center to center-left
    positionMod = 1.0 + (clout / 400); // small clout bonus
  } else if (dist <= 25) {
    // Moderate lean: still effective
    positionMod = 0.95 - (dist - 10) * 0.01;
  } else if (dist <= 40) {
    // Strong lean: penalties start
    var penalty = (dist - 25) * 0.02;
    // Asymmetry: right-leaning gets slightly more penalty
    if (pos > optimalPos) penalty *= 1.3;
    positionMod = 0.8 - penalty;
  } else {
    // Extreme: exponential penalty
    var extreme = (dist - 40) * 0.04;
    if (pos > optimalPos) extreme *= 1.5; // far-right is harder
    positionMod = 0.5 - extreme;
  }
  
  // BIPARTISAN TRAP: if position is in the center zone (35-65) AND clout is moderate,
  // cap effectiveness — you have access but limited real influence
  var isCentrist = pos >= 35 && pos <= 65;
  if (isCentrist && clout < 50) {
    // Centrists need MORE clout to be effective — access doesn't equal influence
    var centristPenalty = (50 - clout) / 200; // up to 0.25 penalty for zero clout centrists
    positionMod -= centristPenalty;
  }
  
  // Clout modifier: high clout helps, but only on your side of the spectrum
  var cloutMod = clout / 200; // 0 to 0.5 bonus
  
  // Combined: position sets the base, clout enhances it
  var total = Math.max(0.3, Math.min(1.3, positionMod + cloutMod));
  return total;
}

// Check if player is in the bipartisan trap zone
function isInBipartisanTrap() {
  var pos = G.politicalPosition;
  var clout = G.politicalClout;
  return pos >= 35 && pos <= 65 && clout < 50;
}

// Get effectiveness description for the UI
function getEffectivenessDesc() {
  var eff = getPoliticalEffectiveness();
  var trap = isInBipartisanTrap();
  if (trap) return { label: 'Centrist Trap', cls: 'pol-eff-penalty', desc: 'You have access everywhere but influence nowhere. Staying centered limits your political power. Build more clout or take a clearer position to increase your effectiveness.' };
  if (eff >= 1.1) return { label: 'Strong', cls: 'pol-eff-bonus', desc: 'Your political relationships are a real asset. Doors open for you.' };
  if (eff >= 0.95) return { label: 'Good', cls: 'pol-eff-bonus', desc: 'Well-positioned in the political landscape. Most doors are open.' };
  if (eff >= 0.8) return { label: 'Normal', cls: 'pol-eff-neutral', desc: 'Adequate political standing. Some relationships could be stronger.' };
  if (eff >= 0.6) return { label: 'Strained', cls: 'pol-eff-penalty', desc: 'Your political position is limiting some opportunities.' };
  return { label: 'Isolated', cls: 'pol-eff-penalty', desc: 'Your political alignment has closed many doors. Rebuilding will take time.' };
}

// Apply political lean from a choice
function applyPoliticalEffects(choice) {
  var lean = choice.politicalLean || 0; // negative = left, positive = right
  var cloutGain = choice.cloutEffect || 0;
  var chips = '';
  
  if (lean !== 0) {
    G.politicalPosition = Math.max(0, Math.min(100, G.politicalPosition + lean));
    var dir = lean < 0 ? '← Left' : 'Right →';
    var cls = lean < 0 ? 'chip-pol-left' : 'chip-pol-right';
    chips += '<span class="chip ' + cls + '">' + (lean > 0 ? '+' : '') + lean + ' ' + dir + '</span>';
  }
  if (cloutGain !== 0) {
    // BIPARTISAN TRAP: centrist clout growth is slower
    var pos = G.politicalPosition;
    var isCentrist = pos >= 35 && pos <= 65;
    if (isCentrist && cloutGain > 0) {
      // Centrists earn clout at 60% rate — broad access dilutes real influence
      var reduced = Math.max(1, Math.round(cloutGain * 0.6));
      G.politicalClout = Math.max(0, Math.min(100, G.politicalClout + reduced));
      chips += '<span class="chip chip-pol-clout">' + (reduced > 0 ? '+' : '') + reduced + ' Clout <span style="font-size:8px;opacity:0.7">(centrist penalty)</span></span>';
    } else {
      G.politicalClout = Math.max(0, Math.min(100, G.politicalClout + cloutGain));
      chips += '<span class="chip chip-pol-clout">' + (cloutGain > 0 ? '+' : '') + cloutGain + ' Clout</span>';
    }
  }
  return chips;
}

// Check if a choice is locked due to political position
function isChoicePoliticallyLocked(choice) {
  if (!choice.politicalRequirement) return false;
  var req = choice.politicalRequirement;
  if (req.maxPosition !== undefined && G.politicalPosition > req.maxPosition) return true;
  if (req.minPosition !== undefined && G.politicalPosition < req.minPosition) return true;
  if (req.minClout !== undefined && G.politicalClout < req.minClout) return true;
  return false;
}

// Get political lock reason for display
function getPoliticalLockReason(choice) {
  if (!choice.politicalRequirement) return '';
  var req = choice.politicalRequirement;
  if (req.maxPosition !== undefined && G.politicalPosition > req.maxPosition) 
    return 'Too right-leaning (' + getPositionLabel(G.politicalPosition) + ')';
  if (req.minPosition !== undefined && G.politicalPosition < req.minPosition) 
    return 'Too left-leaning (' + getPositionLabel(G.politicalPosition) + ')';
  if (req.minClout !== undefined && G.politicalClout < req.minClout) 
    return 'Insufficient political clout (' + Math.round(G.politicalClout) + '/' + req.minClout + ')';
  return '';
}

// Render political lean tag on a choice
function renderPoliticalTag(choice) {
  var lean = choice.politicalLean || 0;
  var clout = choice.cloutEffect || 0;
  var tags = '';
  if (lean < -3) tags += '<span class="choice-pol-tag lean-left">⬅ Left</span>';
  else if (lean < 0) tags += '<span class="choice-pol-tag lean-left">← Leans Left</span>';
  else if (lean > 3) tags += '<span class="choice-pol-tag lean-right">Right ➡</span>';
  else if (lean > 0) tags += '<span class="choice-pol-tag lean-right">Leans Right →</span>';
  if (clout >= 5) tags += '<span class="choice-pol-tag lean-center">⚡+Clout</span>';
  // Political lock indicator
  if (isChoicePoliticallyLocked(choice)) {
    tags += '<span class="choice-pol-tag" style="background:#ead4d4;color:#4a1a1a">🔒 ' + getPoliticalLockReason(choice) + '</span>';
  }
  return tags;
}

// Modify outcome text based on political effectiveness
function politicalOutcomeModifier(outcome) {
  var eff = getPoliticalEffectiveness();
  // Check if the net effects are positive or negative
  var netEffect = 0;
  if (outcome.effects) {
    Object.values(outcome.effects).forEach(function(v) { netEffect += v; });
  }
  if (eff >= 1.05 && netEffect > 0) return '<span style="color:#5b21b6;font-size:12px;font-style:italic">Your political capital amplified the positive outcomes.</span>';
  if (eff >= 1.05 && netEffect < 0) return '<span style="color:#5b21b6;font-size:12px;font-style:italic">Your political capital softened the blow somewhat.</span>';
  if (eff <= 0.65 && netEffect < 0) return '<span style="color:#5b21b6;font-size:12px;font-style:italic">Your political isolation made the fallout worse.</span>';
  if (eff <= 0.65 && netEffect > 0) return '<span style="color:#5b21b6;font-size:12px;font-style:italic">Your limited political capital reduced the impact of this win.</span>';
  return '';
}

// Apply political effectiveness to stat effects (modifies effects in place)
function applyPoliticalModifier(effects) {
  var eff = getPoliticalEffectiveness();
  if (Math.abs(eff - 1.0) < 0.05) return; // close enough to 1.0, no modification
  var modified = {};
  Object.keys(effects).forEach(function(k) {
    var v = effects[k];
    if (v > 0) {
      // Positive effects get scaled by effectiveness
      modified[k] = Math.round(v * eff);
    } else {
      // Negative effects: lower effectiveness means worse penalties
      modified[k] = Math.round(v * (2 - eff));
    }
  });
  Object.assign(effects, modified);
}

// Update the HUD political display
function updatePoliticsHUD() {
  var pos = G.politicalPosition;
  var clout = G.politicalClout;
  var pct = Math.max(2, Math.min(98, pos));
  
  // Marker position
  var marker = document.getElementById('pol-marker');
  var glow = document.getElementById('pol-marker-glow');
  if (marker) marker.style.left = pct + '%';
  if (glow) {
    glow.style.left = pct + '%';
    // Glow size based on clout
    var glowSize = 10 + (clout / 100) * 8;
    glow.style.width = glowSize + 'px';
    glow.style.height = glowSize + 'px';
    glow.style.background = 'rgba(184,134,11,' + (0.15 + clout/200) + ')';
  }
  
  // Labels
  var posLabel = document.getElementById('pol-pos-label');
  if (posLabel) posLabel.textContent = getPositionLabel(pos);
  var cloutVal = document.getElementById('pol-clout-val');
  if (cloutVal) cloutVal.textContent = '⚡' + Math.round(clout);
  
  // Detail panel
  var dPos = document.getElementById('pol-d-position');
  if (dPos) dPos.textContent = getPositionLabel(pos) + ' (' + Math.round(pos) + ')';
  var dClout = document.getElementById('pol-d-clout');
  if (dClout) dClout.textContent = Math.round(clout) + '/100';
  var dMarker = document.getElementById('pol-d-marker');
  if (dMarker) dMarker.style.left = pct + '%';
  
  var effInfo = getEffectivenessDesc();
  var dEff = document.getElementById('pol-d-eff');
  if (dEff) dEff.textContent = effInfo.label;
  var dEffBar = document.getElementById('pol-d-eff-bar');
  if (dEffBar) { dEffBar.className = 'pol-effectiveness ' + effInfo.cls; dEffBar.textContent = effInfo.desc; }
  var dDesc = document.getElementById('pol-d-desc');
  if (dDesc) {
    var tips = [];
    var trap = isInBipartisanTrap();
    if (trap) {
      tips.push('⚠️ BIPARTISAN TRAP: You sit in the political center with moderate clout. In American Jewish politics, centrism gives you access to everyone but deep influence over no one. Your clout grows 40% slower and your effectiveness is capped until you either build significantly more clout (50+) or commit to a clearer political lean.');
    } else if (pos < 30) {
      tips.push('Strong progressive relationships, limited conservative access.');
    } else if (pos > 70) {
      tips.push('Strong conservative relationships, limited progressive access.');
    } else {
      tips.push('Broad access across the political spectrum.');
    }
    if (!trap) {
      if (clout >= 60) tips.push('High clout amplifies your influence.');
      else if (clout <= 20) tips.push('Low clout limits your effectiveness. Build more political relationships.');
    }
    dDesc.textContent = tips.join(' ');
  }
}

function togglePolDetail(evt) {
  evt.stopPropagation();
  var detail = document.getElementById('pol-detail');
  if (detail) detail.classList.toggle('open');
  // Close on outside click
  if (detail && detail.classList.contains('open')) {
    setTimeout(function() {
      document.addEventListener('click', closePolDetail, {once:true});
    }, 10);
  }
}
function closePolDetail() {
  var detail = document.getElementById('pol-detail');
  if (detail) detail.classList.remove('open');
}

// Add political lean data to scenarios that don't have it (auto-infer from context)
function inferPoliticalLean(choice, scenario) {
  // If explicitly set, use it
  if (choice.politicalLean !== undefined) return;
  if (choice.cloutEffect !== undefined) return;
  
  // Auto-infer based on mission alignment patterns
  var leftMissions = ['israel_peace', 'social_justice', 'antisemitism_left'];
  var rightMissions = ['israel_security', 'antisemitism_right'];
  var centerMissions = ['antisemitism_all', 'diaspora_unity', 'community_hub', 'jewish_identity'];
  
  var aligned = choice.missionAligned || [];
  var leftScore = aligned.filter(function(m){return leftMissions.includes(m)}).length;
  var rightScore = aligned.filter(function(m){return rightMissions.includes(m)}).length;
  var centerScore = aligned.filter(function(m){return centerMissions.includes(m)}).length;
  
  if (leftScore > rightScore && leftScore > 0) {
    choice.politicalLean = -(1 + leftScore);
    choice.cloutEffect = leftScore;
  } else if (rightScore > leftScore && rightScore > 0) {
    choice.politicalLean = (1 + rightScore);
    choice.cloutEffect = rightScore;
  } else if (centerScore > 0) {
    choice.politicalLean = 0;
    choice.cloutEffect = centerScore + 1; // bipartisan work builds more clout
  } else {
    choice.politicalLean = 0;
    choice.cloutEffect = 0;
  }
}

// ═══════════════ BOOT ═══════════════
initIntro(); initChar(); initOrg(); initBudget();

// ═══ ADVISOR SYSTEM ═══
// Renders scenario-level advisor quotes as Option C (between body and choices)
function renderAdvisorQuotes(scenario) {
  if (!scenario.advisorQuotes || !scenario.advisorQuotes.length) return '';
  var pool = GAME_DATA.advisorPool || GAME_DATA.advisors || [];
  var selected = G.selectedAdvisors && G.selectedAdvisors.length > 0 ? G.selectedAdvisors : pool.map(function(a){return a.id});
  
  var bubbles = scenario.advisorQuotes
    .filter(function(q) { return selected.includes(q.advisorId); })
    .map(function(q) {
      var adv = pool.find(function(a){return a.id === q.advisorId});
      if (!adv) return '';
      // Check for beforeScenario conversation trigger on this advisor
      var convIcon = '';
      var conv = checkBeforeScenarioConversation(scenario.id, q.advisorId);
      if (conv) {
        convIcon = '<span class="advisor-talk-icon" onclick="event.stopPropagation();startAdvisorConversation(\'' + esc(conv.id) + '\',\'' + esc(scenario.id) + '\')" title="Talk to ' + esc(adv.name) + '">💬</span>';
      }
      var mood = q.mood || 'neutral';
      return '<div class="advisor-bubble"><span class="advisor-avatar">' + advPortrait(adv, mood, 40) + '</span><div class="advisor-meta"><span class="advisor-name">' + esc(adv.name) + ' \u2014 ' + esc(adv.role) + convIcon + '</span><span class="advisor-text">\u201c' + esc(q.text) + '\u201d</span></div></div>';
    }).filter(Boolean).join('');
  
  if(!bubbles) return '';
  return '<div class="advisor-panel"><div class="advisor-panel-label">\ud83d\udcac Your advisors weigh in</div>' + bubbles + '</div>';
}

// Renders per-choice advisor quote (Option B)
function renderChoiceAdvisorQuote(choice) {
  if (!choice.advisorQuote) return '';
  var pool = GAME_DATA.advisorPool || GAME_DATA.advisors || [];
  var adv = pool.find(function(a){return a.id === choice.advisorQuote.advisorId});
  if (!adv) return '';
  var mood = choice.advisorQuote.mood || 'neutral';
  return '<div class="choice-advisor"><span class="choice-advisor-avatar">' + advPortrait(adv, mood, 32) + '</span><div><span class="choice-advisor-name">' + esc(adv.name) + ':</span> \u201c' + esc(choice.advisorQuote.text) + '\u201d</div></div>';
}

// ═══ ADVISOR RECOMMENDATION BADGES ═══
function getAdvisorRecommendationBadge(scenario, choiceIndex) {
  var pool = GAME_DATA.advisorPool || GAME_DATA.advisors || [];
  var selected = G.selectedAdvisors || [];
  var recs = (scenario.advisorQuotes || [])
    .filter(function(q) {
      return q.recommendsChoice === choiceIndex && selected.includes(q.advisorId);
    })
    .map(function(q) {
      var adv = pool.find(function(a){return a.id === q.advisorId});
      return adv ? { adv: adv, explicit: q.explicit } : null;
    })
    .filter(Boolean);
  
  if (recs.length === 0) return '';
  var names = recs.map(function(r) { 
    return advPortrait(r.adv, 'approving', 16) + ' ' + r.adv.name.split(' ')[0] + "'s pick";
  }).join(', ');
  return '<span class="advisor-rec-wrap">' + names + '</span>';
}

// ═══ ADVISOR BONUS CALCULATION ═══
function getAdvisorBonus(scenario, choiceIndex) {
  var pool = GAME_DATA.advisorPool || GAME_DATA.advisors || [];
  var selected = G.selectedAdvisors || [];
  var mode = GAME_DATA.config.advisorBonusStacking || 'best';
  
  var matching = (scenario.advisorQuotes || []).filter(function(q) {
    return q.recommendsChoice === choiceIndex && q.effectModifier && selected.includes(q.advisorId);
  });
  
  if (matching.length === 0) return { effects: null, chips: '' };
  
  if (mode === 'best') {
    // Find the single best total modifier
    var best = matching.reduce(function(prev, curr) {
      var prevTotal = Object.values(prev.effectModifier).reduce(function(a,b){return a+b}, 0);
      var currTotal = Object.values(curr.effectModifier).reduce(function(a,b){return a+b}, 0);
      return currTotal > prevTotal ? curr : prev;
    });
    var adv = pool.find(function(a){return a.id === best.advisorId});
    // Apply advisor conversation multiplier
    var multiplier = G.currentAdvisorBonusMultiplier || 1.0;
    var modifiedEffect = {};
    Object.entries(best.effectModifier).forEach(function(e) {
      modifiedEffect[e[0]] = Math.round(e[1] * multiplier);
    });
    var chips = Object.entries(modifiedEffect).map(function(e) {
      var sign = e[1] > 0 ? '+' : '';
      var statLabel = (GAME_DATA.stats.find(function(s){return s.id === e[0]}) || {}).label || e[0];
      return '<span class="chip chip-advisor">' + sign + e[1] + ' ' + statLabel + ' (' + (adv ? adv.name.split(' ')[0] : '?') + ')</span>';
    }).join('');
    // Build human-readable explanation
    var advName = adv ? adv.name.split(' ')[0] : 'Your advisor';
    var explanationParts = Object.entries(modifiedEffect).map(function(e) {
      var statLabel = (GAME_DATA.stats.find(function(s){return s.id === e[0]}) || {}).label || e[0];
      return (e[1] > 0 ? '+' : '') + e[1] + ' ' + statLabel;
    });
    var explanation = '<span style="color:#7a5800;font-size:12px;font-style:italic">' + advName + ' backed your decision (' + explanationParts.join(', ') + ').</span>';
    return { effects: modifiedEffect, chips: chips, explanation: explanation };
  } else {
    // Stack all
    var combined = {};
    var multiplier = G.currentAdvisorBonusMultiplier || 1.0;
    matching.forEach(function(q) {
      Object.entries(q.effectModifier).forEach(function(e) {
        combined[e[0]] = (combined[e[0]] || 0) + Math.round(e[1] * multiplier);
      });
    });
    var chipParts = [];
    Object.entries(combined).forEach(function(e) {
      var sign = e[1] > 0 ? '+' : '';
      var statLabel = (GAME_DATA.stats.find(function(s){return s.id === e[0]}) || {}).label || e[0];
      chipParts.push('<span class="chip chip-advisor">' + sign + e[1] + ' ' + statLabel + ' (advisors)</span>');
    });
    var stackExplanation = '<span style="color:#7a5800;font-size:12px;font-style:italic">Your advisors collectively influenced this outcome.</span>';
    return { effects: combined, chips: chipParts.join(''), explanation: stackExplanation };
  }
}

// ═══ CONVERSATION TRIGGERS ═══
function checkAfterScenarioConversation(scenarioId, choiceIndex) {
  var convs = GAME_DATA.conversations || [];
  return convs.find(function(conv) {
    if (!conv.trigger || conv.trigger.type !== 'afterScenario') return false;
    if (conv.trigger.scenarioId !== scenarioId) return false;
    if (conv.trigger.choiceIndex !== null && conv.trigger.choiceIndex !== undefined && conv.trigger.choiceIndex !== choiceIndex) return false;
    // Check org applicability
    if (conv.applicableOrgs && conv.applicableOrgs.length > 0 && !conv.applicableOrgs.includes(G.orgId)) return false;
    // For advisor type, check if advisor is selected
    if (conv.type === 'advisor') {
      if (!G.selectedAdvisors || !G.selectedAdvisors.includes(conv.advisorId)) return false;
    }
    return true;
  }) || null;
}

function checkBeforeScenarioConversation(scenarioId, advisorId) {
  var convs = GAME_DATA.conversations || [];
  return convs.find(function(conv) {
    if (!conv.trigger || conv.trigger.type !== 'beforeScenario') return false;
    if (conv.trigger.scenarioId !== scenarioId) return false;
    // For advisor type, check both advisor match and selection
    if (conv.type === 'advisor') {
      if (conv.advisorId !== advisorId) return false;
      if (!G.selectedAdvisors || !G.selectedAdvisors.includes(conv.advisorId)) return false;
    }
    // Check org applicability
    if (conv.applicableOrgs && conv.applicableOrgs.length > 0 && !conv.applicableOrgs.includes(G.orgId)) return false;
    return true;
  }) || null;
}

// ═══ CONVERSATION SYSTEM ═══
var convState = null; // current conversation state

function showConversation(convId, callback) {
  var conv = (GAME_DATA.conversations || []).find(function(c){return c.id === convId});
  if (!conv) { if (callback) callback(); return; }
  
  var pool = GAME_DATA.advisorPool || GAME_DATA.advisors || [];
  var charName, charEmoji, charRole, charContext;
  
  var charPortraitObj = null;
  if (conv.type === 'advisor') {
    var adv = pool.find(function(a){return a.id === conv.advisorId});
    if (!adv) { if (callback) callback(); return; }
    charName = adv.name;
    charEmoji = adv.emoji;
    charRole = adv.role;
    charContext = 'Advisor conversation';
    charPortraitObj = adv;
  } else {
    // character type
    charName = conv.character.name;
    charEmoji = conv.character.emoji;
    charRole = conv.character.role;
    charContext = conv.character.context || '';
    charPortraitObj = conv.character;
  }
  
  convState = {
    conv: conv,
    currentNode: 'n0',
    disposition: conv.startDisposition || 50,
    turnCount: 0,
    totalNodes: conv.totalNodes || Object.keys(conv.nodes).length,
    callback: callback
  };
  
  // Populate UI
  document.getElementById('conv-avatar').innerHTML = advPortrait(charPortraitObj, 'neutral', 52, 'square');
  document.getElementById('conv-char-name').textContent = charName;
  document.getElementById('conv-char-role').textContent = charRole;
  document.getElementById('conv-context').textContent = charContext;
  document.getElementById('conv-transcript').innerHTML = '';
  document.getElementById('conv-choices').innerHTML = '';
  
  // Build turn track pips
  var pipHtml = '<span class="conv-turn-label">Turns remaining</span>';
  for (var i = 0; i < convState.totalNodes; i++) {
    pipHtml += '<div class="conv-turn-pip' + (i === 0 ? ' current' : '') + '"></div>';
  }
  document.getElementById('conv-turn-track').innerHTML = pipHtml;
  
  updateDispositionMeter();
  
  // Show overlay, hide game inner
  document.getElementById('conv-overlay').style.display = '';
  document.querySelector('.game-main').style.display = 'none';
  
  // Show first node with typing animation
  showConversationNode();
}

function updateDispositionMeter() {
  if (!convState) return;
  var d = Math.max(0, Math.min(100, convState.disposition));
  var fill = document.getElementById('disp-fill');
  var word = document.getElementById('disp-word');
  
  fill.style.width = d + '%';
  
  var label, colorClass;
  if (d >= 70) { label = 'Receptive'; colorClass = 'disp-receptive'; }
  else if (d >= 50) { label = 'Warming'; colorClass = 'disp-warming'; }
  else if (d >= 35) { label = 'Guarded'; colorClass = 'disp-guarded'; }
  else if (d >= 20) { label = 'Frustrated'; colorClass = 'disp-frustrated'; }
  else { label = 'Hostile'; colorClass = 'disp-hostile'; }
  
  word.textContent = label;
  // Remove old color classes and add new one
  fill.className = 'disp-fill ' + colorClass;
  word.className = 'disp-word ' + colorClass;
}

function showConversationNode() {
  if (!convState) return;
  var node = convState.conv.nodes[convState.currentNode];
  if (!node) { resolveConversation(); return; }
  
  var transcript = document.getElementById('conv-transcript');
  var choices = document.getElementById('conv-choices');
  choices.innerHTML = '';
  
  // Show typing indicator
  var typingDiv = document.createElement('div');
  typingDiv.className = 'conv-bubble conv-bubble-npc';
  typingDiv.innerHTML = '<div class="typing-indicator"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></div>';
  transcript.appendChild(typingDiv);
  transcript.scrollTop = transcript.scrollHeight;
  
  setTimeout(function() {
    // Replace typing with actual message
    typingDiv.innerHTML = '<div class="bubble-text">' + node.characterLine + '</div>';
    transcript.scrollTop = transcript.scrollHeight;
    
    // Show response choices
    if (node.responses && node.responses.length > 0) {
      var choicesHtml = node.responses.map(function(r, i) {
        return '<button class="conv-response" data-approach="' + esc(r.approach) + '" onclick="pickConversationResponse(' + i + ')">' +
          esc(r.text) +
        '</button>';
      }).join('');
      choices.innerHTML = choicesHtml;
    }
  }, 900);
}

function pickConversationResponse(responseIdx) {
  if (!convState) return;
  var node = convState.conv.nodes[convState.currentNode];
  if (!node || !node.responses || !node.responses[responseIdx]) return;
  var response = node.responses[responseIdx];
  
  var transcript = document.getElementById('conv-transcript');
  var choices = document.getElementById('conv-choices');
  
  // Clear choices immediately
  choices.innerHTML = '';
  
  // Add player bubble
  var playerDiv = document.createElement('div');
  playerDiv.className = 'conv-bubble conv-bubble-player';
  playerDiv.innerHTML = '<div class="bubble-text">' + esc(response.text) + '</div>';
  transcript.appendChild(playerDiv);
  transcript.scrollTop = transcript.scrollHeight;
  
  // Apply disposition delta
  convState.disposition += (response.dispositionDelta || 0);
  convState.disposition = Math.max(0, Math.min(100, convState.disposition));
  updateDispositionMeter();
  
  // Update turn pips
  convState.turnCount++;
  var pips = document.querySelectorAll('#conv-turn-track .conv-turn-pip');
  pips.forEach(function(pip, i) {
    pip.classList.remove('current', 'past');
    if (i < convState.turnCount) pip.classList.add('past');
    if (i === convState.turnCount) pip.classList.add('current');
  });
  
  // Navigate to next node
  var nextNode = response.next;
  if (nextNode === 'end' || !nextNode) {
    // Resolve after a short delay
    setTimeout(function() { resolveConversation(); }, 600);
  } else {
    convState.currentNode = nextNode;
    setTimeout(function() { showConversationNode(); }, 400);
  }
}

function resolveConversation() {
  if (!convState) return;
  var conv = convState.conv;
  var disposition = convState.disposition;
  
  // Find matching outcome (highest minDisposition threshold that disposition meets)
  var outcomes = (conv.outcomes || []).slice().sort(function(a,b) { return b.minDisposition - a.minDisposition; });
  var outcome = outcomes.find(function(o) { return disposition >= o.minDisposition; }) || outcomes[outcomes.length - 1];
  
  if (!outcome) {
    endConversation();
    return;
  }
  
  // Build outcome display
  var transcript = document.getElementById('conv-transcript');
  var choices = document.getElementById('conv-choices');
  choices.innerHTML = '';
  
  var outcomeDiv = document.createElement('div');
  outcomeDiv.className = 'conv-outcome';
  
  var heading = outcome.heading || 'Outcome';
  var text = outcome.text || '';
  
  // Build effect chips
  var chipHtml = '';
  if (outcome.effects) {
    Object.entries(outcome.effects).forEach(function(e) {
      var sign = e[1] > 0 ? '+' : '';
      var statLabel = (GAME_DATA.stats.find(function(s){return s.id === e[0]}) || {}).label || e[0];
      chipHtml += '<span class="chip ' + (e[1] > 0 ? 'chip-pos' : 'chip-neg') + '">' + sign + e[1] + ' ' + statLabel + '</span>';
    });
  }
  if (outcome.budgetEffect) {
    var bsign = outcome.budgetEffect > 0 ? '+' : '';
    chipHtml += '<span class="chip ' + (outcome.budgetEffect > 0 ? 'chip-pos' : 'chip-neg') + '">' + bsign + outcome.budgetEffect + ' Budget</span>';
  }
  
  outcomeDiv.innerHTML = '<div class="conv-outcome-heading">' + esc(heading) + '</div>' +
    '<div class="conv-outcome-text">' + esc(text) + '</div>' +
    (chipHtml ? '<div class="chip-row" style="margin:10px 0">' + chipHtml + '</div>' : '') +
    '<button class="btn btn-primary" onclick="endConversation()" style="margin-top:12px">Continue →</button>';
  
  transcript.appendChild(outcomeDiv);
  transcript.scrollTop = transcript.scrollHeight;
  
  // Apply effects to game state
  if (outcome.effects) {
    Object.entries(outcome.effects).forEach(function(e) {
      var statId = e[0];
      var delta = e[1];
      if (statId === 'trust' && G.segmentApproval) {
        applySegmentEffects(delta, null, null);
      } else if (G.stats.hasOwnProperty(statId) || GAME_DATA.stats.find(function(s){return s.id===statId})) {
        G.stats[statId] = Math.max(0, Math.min(100, (G.stats[statId] || 0) + delta));
      }
    });
  }
  if (outcome.budgetEffect) {
    G.budget += outcome.budgetEffect;
    if (outcome.budgetEffect > 0) G.budgetIncomeThisYear += outcome.budgetEffect;
    else G.budgetSpentThisYear += Math.abs(outcome.budgetEffect);
    if (G.budget < 0) G.budget = 0;
    if (G.budget > G.budgetMax) G.budgetMax = G.budget;
  }
  
  // For advisor conversations, store the multiplier
  if (conv.type === 'advisor' && outcome.modifiesAdvisorBonus !== undefined) {
    G.currentAdvisorBonusMultiplier = outcome.modifiesAdvisorBonus;
  }
  
  updateHUD();
}

function endConversation() {
  var cb = convState ? convState.callback : null;
  convState = null;
  
  // Hide overlay, show game inner
  document.getElementById('conv-overlay').style.display = 'none';
  document.querySelector('.game-main').style.display = '';
  
  if (cb) cb();
}

function startAdvisorConversation(convId, scenarioId) {
  // Store current scenario context, then show conversation
  // When done, re-render the scenario
  var scenario = GAME_DATA.scenarios.find(function(s){return s.id === scenarioId});
  showConversation(convId, function() {
    // After conversation, re-render the scenario with any advisor bonus multiplier applied
    if (scenario) renderScenario(scenario);
  });
}
var gazetteEvents = [];
function recordEvent(evtType, data) {
  gazetteEvents.push(Object.assign({type:evtType, round:G.round}, data||{}));
}
function showGazette() {
  var headlines = pickGazetteHeadlines();
  if (headlines.length === 0) return endRoundContinue();
  var rn = GAME_DATA.config.roundNames && GAME_DATA.config.roundNames[G.round-1];
  var dateStr = rn ? rn.english + ' \u2014 ' + rn.year : 'Round ' + G.round;
  var storiesHtml = headlines.map(function(h){
    return '<div class="gazette-story"><div class="gazette-headline">' + esc(h.headline) + '</div><div class="gazette-subline">' + esc(h.subline) + '</div></div>';
  }).join('');
  var overlay = document.createElement('div');
  overlay.className = 'gazette-overlay';
  overlay.innerHTML = '<div class="gazette"><div class="gazette-header"><span class="gazette-title">\u2721 The Jewish Gazette</span><span class="gazette-date">' + esc(dateStr) + '</span></div><div class="gazette-body">' + storiesHtml + '<button class="gazette-continue" onclick="this.closest(\'.gazette-overlay\').remove();endRoundContinue()">Continue \u2192</button></div></div>';
  document.body.appendChild(overlay);
}
function pickGazetteHeadlines() {
  var templates = GAME_DATA.gazetteTemplates || [];
  var matched = [];
  var stats = G.stats || {};
  templates.forEach(function(t) {
    var tr = t.trigger;
    if (tr.type === 'choiceMade') {
      if (gazetteEvents.some(function(e){return e.type==='choiceMade' && e.scenarioId===tr.scenarioId && e.choiceIndex===tr.choiceIndex && e.round===G.round})) matched.push(t);
    } else if (tr.type === 'statAbove') {
      var sv = tr.stat === 'budget' ? (G.budget||0) : (stats[tr.stat]||50);
      if (sv > tr.threshold) matched.push(t);
    } else if (tr.type === 'statBelow') {
      var sv2 = tr.stat === 'budget' ? (G.budget||0) : (stats[tr.stat]||50);
      if (sv2 < tr.threshold) matched.push(t);
    } else if (tr.type === 'momentumUp') {
      if (getStatMomentum(tr.stat) > 0) matched.push(t);
    } else if (tr.type === 'momentumDown') {
      if (getStatMomentum(tr.stat) < 0) matched.push(t);
    } else if (tr.type === 'coalitionFormed') {
      if (gazetteEvents.some(function(e){return e.type==='coalitionFormed' && e.round===G.round})) matched.push(t);
    } else if (tr.type === 'coalitionBroken') {
      if (gazetteEvents.some(function(e){return e.type==='coalitionBroken' && e.round===G.round})) matched.push(t);
    } else if (tr.type === 'inboxExpired') {
      if (gazetteEvents.some(function(e){return e.type==='inboxExpired' && e.round===G.round})) matched.push(t);
    } else if (tr.type === 'missionStarsHigh') {
      if ((G.missionStars||0) >= (GAME_DATA.config.missionMaxStars||5)-1) matched.push(t);
    } else if (tr.type === 'missionStarsLow') {
      if ((G.missionStars||0) <= 1) matched.push(t);
    }
  });
  // Pick up to 2 matched + 1 generic filler
  var picked = shuffle(matched).slice(0, 2);
  if (picked.length < 3) {
    var generics = templates.filter(function(t){return t.trigger.type==='generic'});
    picked = picked.concat(shuffle(generics).slice(0, 3 - picked.length));
  }
  return picked.slice(0, 3);
}
function shuffle(arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random()*(i+1)); var t=a[i]; a[i]=a[j]; a[j]=t; }
  return a;
}

// ═══ NOTIFICATION STACKING ═══
function positionNotification(el) {
  var existing = document.querySelectorAll('.game-notification');
  var topOffset = 80; // below HUD
  existing.forEach(function(n) {
    if (n !== el) {
      topOffset = Math.max(topOffset, n.offsetTop + n.offsetHeight + 8);
    }
  });
  el.style.top = topOffset + 'px';
}

// ═══ TIMED INBOX SYSTEM (Persistent Inbox) ═══
function tickInboxTimers() {
  var expired = [];
  (G.inboxMessages||[]).forEach(function(msg) {
    if (msg.timerRemaining !== null && !msg.expired) {
      msg.timerRemaining--;
      if (msg.timerRemaining <= 0) {
        msg.expired = true;
        msg.unread = false;
        expired.push(msg);
      }
    }
  });
  expired.forEach(function(msg) {
    var sc = msg.scenario;
    if (sc && sc.expiredOutcome) {
      var fx = sc.expiredOutcome.effects || {};
      Object.keys(fx).forEach(function(k){
        if(k === 'trust' && G.segmentApproval) {
          applySegmentEffects(fx[k], null, null);
        } else {
          G.stats[k] = Math.max(0, Math.min(100, (G.stats[k]||50) + fx[k]));
        }
      });
      // Apply budget effect on expired
      var ebfx = sc.expiredOutcome.budgetEffect || 0;
      if(ebfx !== 0) { G.budget += ebfx; if(ebfx < 0) G.budgetSpentThisYear += Math.abs(ebfx); else G.budgetIncomeThisYear += ebfx; if(G.budget < 0) G.budget = 0; }
      recordEvent('inboxExpired', {scenarioId:msg.id});
      // Show expired notification with stat impacts
      var fxChips = Object.keys(fx).map(function(k){
        var lbl = (GAME_DATA.stats.find(function(s){return s.id===k})||{}).label || k;
        var v = fx[k];
        return '<span style="display:inline-block;font-size:10px;font-weight:700;padding:2px 6px;margin:2px 2px 0 0;border-radius:2px;' + (v>0?'background:#d4ead4;color:#1a4a1a':'background:#ead4d4;color:#4a1a1a') + '">' + (v>0?'+':'') + v + ' ' + esc(lbl) + '</span>';
      }).join('');
      var div = document.createElement('div');
      div.className = 'game-notification notif-expired';
      div.innerHTML = '<button class="notif-close" onclick="event.stopPropagation();this.parentNode.remove()">✕</button><div style="font-weight:700;margin-bottom:6px">\u23f0 Expired: ' + esc(sc.subject||sc.title) + '</div><div style="font-size:12px;opacity:0.95;line-height:1.5;margin-bottom:6px">' + esc(sc.expiredOutcome.text) + '</div>' + (fxChips ? '<div>' + fxChips + '</div>' : '');
      div.onclick = function(){div.remove()};
      document.body.appendChild(div);
      positionNotification(div);
      setTimeout(function(){if(div.parentNode)div.remove()}, 8000);
    }
  });
}

// ═══ PERSISTENT INBOX PANEL ═══
function toggleInbox() {
  var panel = document.getElementById('inbox-panel');
  var overlay = document.getElementById('inbox-overlay');
  panel.classList.toggle('open');
  overlay.classList.toggle('open');
}

function updateInboxStrip() {
  // Inbox strip removed — inbox is now accessed via the phone desk object
  var strip = document.getElementById('inbox-strip');
  if(strip) strip.classList.remove('active');
  return;
  var items = document.getElementById('inbox-strip-items');
  if(!strip || !items) return;
  var msgs = (G.inboxMessages||[]).filter(function(m){return !m.expired});
  if(msgs.length === 0) {
    strip.classList.remove('active');
    return;
  }
  strip.classList.add('active');
  items.innerHTML = msgs.map(function(msg) {
    var sc = msg.scenario;
    var icon = sc.tag === 'Email' ? '📧' : '💬';
    var subj = sc.subject || sc.from || 'Message';
    if(subj.length > 35) subj = subj.substring(0,34) + '…';
    var urgent = msg.timerRemaining !== null ? '<span class="pill-urgent"> URGENT</span>' : '';
    var cls = msg.unread ? ' unread' : '';
    return '<div class="inbox-strip-pill' + cls + '" onclick="openInboxMessage(\'' + msg.id + '\')">' +
      '<span class="pill-icon">' + icon + '</span>' + esc(subj) + urgent + '</div>';
  }).join('');
  // Overflow fade/arrow
  var wrap = strip.querySelector('.inbox-strip-wrap');
  if(wrap) {
    if(!wrap.querySelector('.inbox-strip-fade')) {
      var fade = document.createElement('div');
      fade.className = 'inbox-strip-fade';
      wrap.appendChild(fade);
      var arrow = document.createElement('span');
      arrow.className = 'inbox-scroll-arrow';
      arrow.textContent = '›';
      wrap.appendChild(arrow);
    }
    strip.classList.remove('has-overflow');
    setTimeout(function(){
      if(items.scrollWidth > items.clientWidth) {
        strip.classList.add('has-overflow');
        items.onscroll = function() {
          var atEnd = items.scrollLeft + items.clientWidth >= items.scrollWidth - 10;
          strip.classList.toggle('has-overflow', !atEnd);
        };
      }
    }, 50);
  }
}

function showInboxToast(sc) {
  var div = document.createElement('div');
  div.className = 'game-notification notif-toast';
  div.innerHTML = '<span class="inbox-toast-icon">📬</span> New message from <strong>' + esc(sc.from) + '</strong>';
  div.onclick = function(){ div.remove(); toggleInbox(); };
  document.body.appendChild(div);
  positionNotification(div);
  setTimeout(function(){if(div.parentNode)div.remove()}, 4000);
}

function updateInboxPanel() {
  var body = document.getElementById('inbox-panel-body');
  if(!body) return;
  var msgs = (G.inboxMessages||[]).slice().reverse(); // newest first
  if(msgs.length === 0) {
    body.innerHTML = '<div class="inbox-empty">No messages yet.</div>';
    return;
  }
  body.innerHTML = msgs.map(function(msg) {
    var sc = msg.scenario;
    var timerHtml = '';
    if(msg.expired) {
      timerHtml = '<span class="inbox-msg-expired-tag">EXPIRED</span>';
    } else if(msg.timerRemaining !== null) {
      timerHtml = '<span class="inbox-msg-timer">🔴 URGENT</span>';
    }
    var clickHandler = msg.expired ? '' : 'onclick="openInboxMessage(\''+msg.id+'\')"';
    return '<div class="inbox-msg' + (msg.unread?' unread':'') + (msg.expired?' expired':'') + '" ' + clickHandler + '>' +
      '<div class="inbox-msg-from">' + (sc.tag==='Email'?'📧':'💬') + ' ' + esc(sc.from) + '</div>' +
      '<div class="inbox-msg-subj">' + esc(sc.subject) + timerHtml + '</div>' +
      '<div class="inbox-msg-preview">' + esc(sc.body).substring(0,100) + '</div>' +
    '</div>';
  }).join('');
}

function openInboxMessage(msgId) {
  var msg = (G.inboxMessages||[]).find(function(m){return m.id===msgId});
  if(!msg || msg.expired) return;
  renderInbox(msg.scenario);
}

// ═══ NEWS TICKER SYSTEM ═══
var tickerHeadlines = [];
var rssFetched = false;
var rssHeadlines = [];

var FALLBACK_HEADLINES = [
  "Federation Announces Record Annual Campaign",
  "New Hillel Director Named at State University", 
  "Community Centers Report Record Summer Camp Enrollment",
  "Jewish Day School Opens New STEM Wing",
  "Interfaith Seder Draws Standing-Room Crowd",
  "Holocaust Museum Unveils New Digital Archive",
  "Birthright Announces Expanded Winter Trip Offerings",
  "Local JCC Hosts Annual Book Festival",
  "Synagogue Membership Trends Shift Toward Younger Families",
  "Jewish Film Festival Opens With Documentary Premiere",
  "Hadassah Chapter Celebrates Centennial Anniversary",
  "PJ Library Reaches Milestone of 1 Million Books Distributed",
  "Jewish Community Foundation Awards Record Grants",
  "New Kosher Restaurant Opens Downtown to Rave Reviews",
  "Jewish Federation Partners With Food Bank for Holiday Drive",
  "Moishe House Expands to Three New Cities",
  "Conservative Movement Reports Growth in B'nai Mitzvah Numbers",
  "Jewish Summer Camp Scholarship Fund Doubles in Size"
];

function initTicker() {
  var tickerEl = document.getElementById('news-ticker');
  if(!tickerEl) return;
  tickerEl.classList.add('active');
  tickerHeadlines = [];
  // Start with fallbacks + any game headlines
  buildTickerContent();
  // Try RSS fetch
  fetchRSSHeadlines();
}

function fetchRSSHeadlines() {
  if(rssFetched) { buildTickerContent(); return; }
  var rssUrl = 'https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent('https://forward.com/feed/');
  fetch(rssUrl).then(function(r){return r.json()}).then(function(data){
    if(data && data.items && data.items.length > 0) {
      rssHeadlines = data.items.slice(0,12).map(function(item){return {text: item.title, link: item.link || ''};});
    }
    rssFetched = true;
    buildTickerContent();
  }).catch(function(){
    rssFetched = true;
    buildTickerContent();
  });
}

function feedTickerHeadlines() {
  // Add gazette-style game headlines to ticker
  var headlines = pickGazetteHeadlines();
  var allOrgs = [...GAME_DATA.organizations, ...GAME_DATA.nationalOrganizations];
  var org = allOrgs.find(function(o){return o.id===G.orgId});
  var orgName = org ? org.name : 'Organization';
  headlines.forEach(function(h) {
    var hl = h.headline.replace(/\bOrganization\b/g, orgName).replace(/\bYour org\b/gi, orgName);
    tickerHeadlines.push({text: hl, type: 'game'});
  });
  buildTickerContent();
}

function buildTickerContent() {
  var el = document.getElementById('ticker-content');
  if(!el) return;
  
  // Mix: game headlines + RSS + fallback fillers
  var items = [];
  
  // Add game headlines
  tickerHeadlines.forEach(function(h){
    items.push('<span class="ticker-item game-headline">' + esc(h.text) + '</span><span class="ticker-sep">◆</span>');
  });
  
  // Add RSS headlines (if available) — clickable links to original articles
  var rss = rssHeadlines.length > 0 ? rssHeadlines : [];
  rss.forEach(function(h){
    var text = typeof h === 'string' ? h : h.text;
    var link = typeof h === 'object' ? h.link : '';
    if(link) {
      items.push('<span class="ticker-item rss-headline"><a href="' + esc(link) + '" target="_blank" rel="noopener">' + esc(text) + '</a></span><span class="ticker-sep">◆</span>');
    } else {
      items.push('<span class="ticker-item rss-headline">' + esc(text) + '</span><span class="ticker-sep">◆</span>');
    }
  });
  
  // If still < 8 items, pad with fallback
  var fallbacks = shuffle(FALLBACK_HEADLINES);
  var needed = Math.max(0, 8 - items.length);
  for(var i = 0; i < needed && i < fallbacks.length; i++) {
    items.push('<span class="ticker-item filler-headline">' + esc(fallbacks[i]) + '</span><span class="ticker-sep">◆</span>');
  }
  
  // Duplicate for seamless loop
  var html = items.join('');
  el.innerHTML = html + html;
  
  // Adjust speed based on content length (faster)
  var duration = Math.max(17, items.length * 2.1);
  el.style.setProperty('--ticker-duration', duration + 's');
}

// ═══ COALITION STRIKE SYSTEM ═══
function checkCoalitionStrikes(choice) {
  var endangers = choice.endangersCoalition || [];
  if(!endangers.length) return;
  var defaultMax = GAME_DATA.config.coalitionStrikeMax || 3;
  
  endangers.forEach(function(coalId) {
    var ac = (G.activeCoalitions||[]).find(function(c){return c.id === coalId});
    if(!ac) return;
    if(!G.coalitionStrikes) G.coalitionStrikes = {};
    G.coalitionStrikes[coalId] = (G.coalitionStrikes[coalId]||0) + 1;
    var max = ac.strikeMax || defaultMax;
    
    if(G.coalitionStrikes[coalId] >= max) {
      // Coalition breaks from strikes
      var fx = (ac.violationPenalty||{}).effects || {};
      Object.keys(fx).forEach(function(k){
        if(k === 'trust' && G.segmentApproval) { applySegmentEffects(fx[k], null, null); }
        else { G.stats[k] = Math.max(0, Math.min(100, (G.stats[k]||50) + fx[k])); }
      });
      // Apply budget and clout penalties
      var bfxStrike = (ac.violationPenalty||{}).budgetEffect || 0;
      if(bfxStrike < 0) { G.budget += bfxStrike; G.budgetSpentThisYear += Math.abs(bfxStrike); if(G.budget < 0) G.budget = 0; }
      var cloutStrike = ac.breakCloutPenalty || (ac.violationPenalty||{}).cloutEffect || 0;
      if(cloutStrike !== 0) { G.politicalClout = Math.max(0, Math.min(100, G.politicalClout + cloutStrike)); }
      recordEvent('coalitionBroken', {coalitionId:ac.id, reason:'strikes'});
      if (!G.brokenCoalitions) G.brokenCoalitions = [];
      G.brokenCoalitions.push(ac.id);
      // Notify
      var div = document.createElement('div');
      div.className = 'game-notification notif-broken';
      div.innerHTML = '<div style="font-weight:700;margin-bottom:4px">\ud83d\udea8 Coalition Broken: ' + esc(ac.name) + '</div><div style="font-size:12px;opacity:0.9">Too many choices that endangered this partnership.</div>';
      div.onclick = function(){div.remove()};
      document.body.appendChild(div);
      positionNotification(div);
      setTimeout(function(){if(div.parentNode)div.remove()}, 7000);
      G.activeCoalitions = (G.activeCoalitions||[]).filter(function(c){return c.id!==ac.id});
    } else {
      // Warning notification
      var remaining = max - G.coalitionStrikes[coalId];
      var div = document.createElement('div');
      div.className = 'game-notification notif-warning';
      div.innerHTML = '<div style="font-weight:700;margin-bottom:3px">⚠️ Coalition Warning: ' + esc(ac.name) + '</div><div style="font-size:12px;opacity:0.9">Strike ' + G.coalitionStrikes[coalId] + '/' + max + ' — ' + remaining + ' more and this partnership ends.</div>';
      div.onclick = function(){div.remove()};
      document.body.appendChild(div);
      positionNotification(div);
      setTimeout(function(){if(div.parentNode)div.remove()}, 5000);
    }
  });
  updateHUD();
}

function renderCoalitionWarnings(choice) {
  var warnings = '';
  var warned = {};
  
  // 1. Explicit endangersCoalition tags
  var endangers = choice.endangersCoalition || [];
  endangers.forEach(function(coalId){
    var ac = (G.activeCoalitions||[]).find(function(c){return c.id===coalId});
    if(ac) {
      var defaultMax = GAME_DATA.config.coalitionStrikeMax || 3;
      var strikes = (G.coalitionStrikes||{})[coalId] || 0;
      var max = ac.strikeMax || defaultMax;
      warnings += '<span class="m-badge opposed">\u26a1 Risks ' + esc(ac.name).substring(0,15) + ' (' + strikes + '/' + max + ')</span>';
      warned[ac.id] = true;
    }
  });
  
  // 2. Auto-detect: choice missionAligned vs active avoidMission constraints
  var aligned = choice.missionAligned || [];
  if (aligned.length > 0) {
    (G.activeCoalitions||[]).forEach(function(ac) {
      if (warned[ac.id]) return;
      (ac.constraints||[]).forEach(function(con) {
        if (con.type === 'avoidMission' && !warned[ac.id]) {
          var conflict = con.missionIds.some(function(mid){ return aligned.includes(mid); });
          if (conflict) {
            var defaultMax = GAME_DATA.config.coalitionStrikeMax || 3;
            var strikes = (G.coalitionStrikes||{})[ac.id] || 0;
            var max = ac.strikeMax || defaultMax;
            warnings += '<span class="m-badge opposed">\u26a0\ufe0f Risks ' + esc(ac.name).substring(0,15) + ' (' + strikes + '/' + max + ')</span>';
            warned[ac.id] = true;
          }
        }
      });
    });
  }
  
  // 3. Auto-detect: maintainStat constraints near violation
  var worstEffects = {};
  (choice.outcomes||[]).forEach(function(o) {
    var fx = o.effects || {};
    Object.keys(fx).forEach(function(k) {
      if (worstEffects[k] === undefined || fx[k] < worstEffects[k]) worstEffects[k] = fx[k];
    });
  });
  (G.activeCoalitions||[]).forEach(function(ac) {
    if (warned[ac.id]) return;
    (ac.constraints||[]).forEach(function(con) {
      if (con.type === 'maintainStat' && !warned[ac.id]) {
        var currentVal = G.stats[con.stat] || 50;
        var worstDelta = worstEffects[con.stat] || 0;
        if (worstDelta < 0 && (currentVal + worstDelta) <= (con.above || 0)) {
          var statLabel = (GAME_DATA.stats.find(function(s){return s.id===con.stat})||{}).label || con.stat;
          warnings += '<span class="m-badge opposed">\u26a0\ufe0f Could break ' + esc(ac.name).substring(0,15) + ' (' + statLabel + ' near ' + con.above + ')</span>';
          warned[ac.id] = true;
        }
      }
    });
  });
  
  return warnings;
}

// ═══ BREAKING NEWS SYSTEM ═══
var breakingNewsFired = {};
function checkBreakingNews() {
  var pool = (GAME_DATA.breakingNews||[]).filter(function(bn) {
    if (bn.once && breakingNewsFired[bn.id]) return false;
    if (bn.minRound && G.round < bn.minRound) return false;
    if (bn.maxRound && G.round > bn.maxRound) return false;
    return true;
  });
  for (var i = 0; i < pool.length; i++) {
    if (Math.random()*100 < (pool[i].probability||0)) {
      breakingNewsFired[pool[i].id] = true;
      return pool[i];
    }
  }
  return null;
}
function showBreakingNews(bn) {
  G.currentBreakingNews = bn;
  var overlay = document.getElementById('bn-overlay');
  var screen = document.getElementById('bn-tv-screen');
  if (!overlay || !screen) return;
  var advHtml = renderAdvisorQuotes(bn);
  var choicesHtml = bn.choices.map(function(c, ci) {
    inferPoliticalLean(c, bn);
    var align = getMissionAlignment(c);
    var badge = missionBadgeHTML(c);
    var locked = c.requiresUnlock && !(G.activeUnlocks||[]).includes(c.requiresUnlock);
    var bCost = c.budgetCost || 0;
    var cantAfford = bCost > 0 && bCost > G.budget;
    var polLocked = isChoicePoliticallyLocked(c);
    var isDisabled = locked || cantAfford || polLocked;
    var coalWarn = renderCoalitionWarnings(c);
    var polTag = renderPoliticalTag(c);
    var choiceAdv = renderChoiceAdvisorQuote(c);
    var costTag = bCost > 0 ? '<span class="choice-budget-tag' + (cantAfford?' unaffordable':'') + '">\ud83d\udcb0 ' + bCost + ' budget' + (cantAfford?' (insufficient)':'') + '</span>' : '';
    return '<button class="bn-choice' + (isDisabled?' locked':'') + '" ' + (isDisabled?'disabled':'onclick="pickBreakingChoice('+ci+')"') + '>' + badge + coalWarn + polTag + costTag + esc(c.text) + (locked?' \ud83d\udd12':'') + choiceAdv + '</button>';
  }).join('');
  screen.innerHTML =
    '<div class="bn-ticker-bar"><span class="bn-ticker-label">\u26a0 BREAKING</span><span class="bn-ticker-scroll">Developing story \u2014 community response underway</span></div>' +
    '<div class="bn-screen-inner">' +
      '<div class="bn-tag">' + esc(bn.tag) + '</div>' +
      '<div class="bn-title">' + esc(bn.title) + '</div>' +
      '<div class="bn-body">' + esc(bn.body) + '</div>' +
      advHtml +
      '<div class="bn-choices">' + choicesHtml + '</div>' +
    '</div>';
  // Fade in
  setTimeout(function() { overlay.classList.add('active'); }, 50);
}
function pickBreakingChoice(ci) {
  var bn = G.currentBreakingNews;
  if (!bn) return;
  var choice = bn.choices[ci];
  if (isChoicePoliticallyLocked(choice)) return;
  // Budget cost
  var bCost = choice.budgetCost || 0;
  if(bCost > G.budget) return;
  if(bCost > 0) { G.budget -= bCost; G.budgetSpentThisYear += bCost; }
  var budgetChip = bCost > 0 ? '<span class="chip chip-neg">-' + bCost + ' Budget</span>' : '';
  var outcome = pickOutcome(choice);
  // Apply political effectiveness modifier
  var modifiedEffects = Object.assign({}, outcome.effects);
  applyPoliticalModifier(modifiedEffects);
  
  // Apply advisor recommendation bonus
  var advisorBonus = getAdvisorBonus(bn, ci);
  var advisorChips = '';
  var advisorContextNote = '';
  if (advisorBonus.effects) {
    Object.keys(advisorBonus.effects).forEach(function(stat) {
      modifiedEffects[stat] = (modifiedEffects[stat] || 0) + advisorBonus.effects[stat];
    });
    advisorChips = advisorBonus.chips;
    advisorContextNote = advisorBonus.explanation || '';
    G.advisorBonusLog.push({scenarioId: bn.id, choiceIndex: ci, effects: advisorBonus.effects});
  }
  G.currentAdvisorBonusMultiplier = 1.0;
  
  var chips = applyEffects(modifiedEffects, choice, bn);
  // Apply political lean/clout
  inferPoliticalLean(choice, bn);
  var polChips = applyPoliticalEffects(choice);
  var polFlavor = politicalOutcomeModifier(outcome);
  // Apply budgetEffect from outcome
  var obfx = outcome.budgetEffect || 0;
  if(obfx > 0) { G.budget += obfx; G.budgetIncomeThisYear += obfx; budgetChip += '<span class="chip chip-pos">+' + obfx + ' Budget</span>'; }
  else if(obfx < 0) { G.budget += obfx; G.budgetSpentThisYear += Math.abs(obfx); budgetChip += '<span class="chip chip-neg">' + obfx + ' Budget</span>'; }
  if(G.budget < 0) G.budget = 0;
  if(G.budget > G.budgetMax) G.budgetMax = G.budget;
  recordEvent('choiceMade', {scenarioId:bn.id, choiceIndex:ci});
  var align = getMissionAlignment(choice);
  var maxS = GAME_DATA.config.missionMaxStars||5;
  var sc = '';
  if (align === 'aligned'){G.missionStars=Math.min(maxS,(G.missionStars||0)+1);sc='<span class="chip chip-star-up">+1 Mission</span>';}
  else if (align === 'opposed'){G.missionStars=Math.max(0,(G.missionStars||0)-1);sc='<span class="chip chip-star-dn">-1 Mission</span>';}
  checkCoalitionViolations(choice);
  checkCoalitionStrikes(choice);
  G.history.push('BREAKING: '+bn.title+' \u2192 '+choice.text.substring(0,55)+'...');
  updateHUD();
  if(checkFailure()) return;
  G.currentBreakingNews = null;
  G.pendingQueue = []; // Don't auto-play any queued scenario
  var contextParts = [];
  if (outcome.contextNote) contextParts.push(outcome.contextNote);
  if (advisorContextNote) contextParts.push(advisorContextNote);
  if (polFlavor) contextParts.push(polFlavor);
  var contextWithPol = contextParts.join('<br>');
  // Close TV overlay and show outcome in the TV screen
  var screen = document.getElementById('bn-tv-screen');
  if (screen) {
    screen.innerHTML =
      '<div class="bn-ticker-bar"><span class="bn-ticker-label">\u26a0 BREAKING</span><span class="bn-ticker-scroll">Developing story \u2014 details emerging</span></div>' +
      '<div class="bn-screen-inner">' +
        '<div class="bn-tag">Outcome</div>' +
        '<div class="bn-outcome-choice"><span style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#999;display:block;margin-bottom:4px">Your Decision</span>' + esc(choice.text) + '</div>' +
        '<div class="bn-body">' + outcome.text + '</div>' +
        '<div class="chip-row" style="margin-bottom:12px">' + chips+sc+budgetChip+polChips+advisorChips + '</div>' +
        (contextWithPol ? '<div class="bn-context">' + contextWithPol + '</div>' : '') +
        '<button class="bn-continue" onclick="closeBreakingNews()">Return to your desk \u2192</button>' +
      '</div>';
  }
}

function closeBreakingNews() {
  if (G.currentBreakingNews) return; // Don't allow closing while choices are pending
  var overlay = document.getElementById('bn-overlay');
  if (overlay) overlay.classList.remove('active');
  updateHUD();
  renderMain();
  renderInvestStrip();
}

// ═══ COALITION SYSTEM ═══
function checkCoalitionOffers() {
  var offers = (GAME_DATA.coalitionOffers||[]).filter(function(co) {
    if (co.offeredByRound > G.round) return false;
    if ((G.activeCoalitions||[]).some(function(ac){return ac.id===co.id})) return false;
    if ((G.declinedCoalitions||[]).includes(co.id)) return false;
    if ((G.brokenCoalitions||[]).includes(co.id)) return false;
    return true;
  });
  if (offers.length === 0 || (G.activeCoalitions||[]).length >= 3) return null;
  // Offer one at random
  return offers[Math.floor(Math.random()*offers.length)];
}
function showCoalitionOffer(co) {
  var benefitText = Object.entries(co.benefits.perRound||{}).map(function(e){return '+'+e[1]+' '+e[0]+'/round'}).join(', ');
  if(co.benefits.budgetPerRound) benefitText += (benefitText?', ':'')+'+'+co.benefits.budgetPerRound+' budget/round';
  var constraintText = (co.constraints||[]).map(function(c){return c.description}).join('; ');
  
  // Political info
  var politicalChips = '';
  var lean = co.politicalLean || 0;
  if (lean < 0) politicalChips += '<span style="display:inline-block;background:#dbeafe;color:#1e40af;font-size:11px;font-weight:700;padding:2px 8px;border-radius:4px;margin-right:4px">\u2190 Leans Left (' + lean + ')</span>';
  else if (lean > 0) politicalChips += '<span style="display:inline-block;background:#fde8e8;color:#9b1c1c;font-size:11px;font-weight:700;padding:2px 8px;border-radius:4px;margin-right:4px">Leans Right \u2192 (+' + lean + ')</span>';
  if (co.acceptClout) politicalChips += '<span style="display:inline-block;background:#f3e8ff;color:#6b21a8;font-size:11px;font-weight:700;padding:2px 8px;border-radius:4px;margin-right:4px">\u26a1+' + co.acceptClout + ' Clout</span>';
  
  // Break penalty summary
  var breakText = '';
  var breakClout = co.breakCloutPenalty || 0;
  var breakFx = (co.violationPenalty||{}).effects || {};
  var breakBudget = (co.violationPenalty||{}).budgetEffect || 0;
  var breakParts = [];
  if (breakClout) breakParts.push(breakClout + ' Clout');
  Object.entries(breakFx).forEach(function(e) { if(e[1] < 0) breakParts.push(e[1] + ' ' + e[0]); });
  if (breakBudget < 0) breakParts.push(breakBudget + ' budget');
  if (breakParts.length) breakText = breakParts.join(', ');
  
  // Decline penalty
  var declineText = '';
  if (co.declinePenalty) {
    var dp = co.declinePenalty;
    var dpParts = [];
    Object.entries(dp.effects||{}).forEach(function(e){ if(e[1] < 0) dpParts.push(e[1] + ' ' + e[0]); });
    if (dp.budgetEffect && dp.budgetEffect < 0) dpParts.push(dp.budgetEffect + ' budget');
    if (dpParts.length) declineText = dpParts.join(', ');
  }

  var overlay = document.createElement('div');
  overlay.className = 'coalition-offer-overlay';
  overlay.id = 'coalition-offer-overlay';
  overlay.innerHTML = '<div class="coalition-card"><h2>\ud83e\udd1d Coalition Offer</h2><h3>' + esc(co.name) + '</h3><p>' + esc(co.description) + '</p>' +
    '<div class="coalition-benefit">\u2705 Benefits: ' + esc(benefitText) + (co.duration ? ' ('+co.duration+' rounds)' : ' (permanent)') + '</div>' +
    (politicalChips ? '<div style="margin:8px 0">' + politicalChips + '</div>' : '') +
    '<div class="coalition-constraint">\u26a0\ufe0f Constraint: ' + esc(constraintText) + '</div>' +
    (breakText ? '<div style="margin:6px 0;font-size:12px;color:#8b1a1a">\ud83d\udea8 If broken: ' + esc(breakText) + '</div>' : '') +
    '<div class="coalition-btns"><button class="coalition-accept" onclick="acceptCoalition(\'' + co.id + '\')">Accept Partnership</button>' +
    '<button class="coalition-decline" onclick="declineCoalition(\'' + co.id + '\')">' + (declineText ? 'Decline (' + esc(declineText) + ')' : 'Decline') + '</button></div></div>';
  document.body.appendChild(overlay);
}
function acceptCoalition(coId) {
  var co = (GAME_DATA.coalitionOffers||[]).find(function(c){return c.id===coId});
  if (!co) return;
  if (!G.activeCoalitions) G.activeCoalitions = [];
  G.activeCoalitions.push({id:co.id, name:co.name, remaining:co.duration||999, benefits:co.benefits, constraints:co.constraints, violationPenalty:co.violationPenalty, strikeMax:co.strikeMax||null, breakCloutPenalty:co.breakCloutPenalty||0});
  recordEvent('coalitionFormed', {coalitionId:co.id});
  // Apply political lean and clout on acceptance
  var lean = co.politicalLean || 0;
  if (lean !== 0) {
    G.politicalPosition = Math.max(0, Math.min(100, G.politicalPosition + lean));
  }
  var clout = co.acceptClout || 0;
  if (clout !== 0) {
    G.politicalClout = Math.max(0, Math.min(100, G.politicalClout + clout));
  }
  var el = document.getElementById('coalition-offer-overlay');
  if (el) el.remove();
  updateHUD();
  afterCoalitionCheck();
}
function declineCoalition(coId) {
  if (!G.declinedCoalitions) G.declinedCoalitions = [];
  G.declinedCoalitions.push(coId);
  // Apply decline penalty if any
  var co = (GAME_DATA.coalitionOffers||[]).find(function(c){return c.id===coId});
  if (co && co.declinePenalty) {
    var dp = co.declinePenalty;
    var fx = dp.effects || {};
    Object.keys(fx).forEach(function(k){
      if(k === 'trust' && G.segmentApproval) { applySegmentEffects(fx[k], null, null); }
      else { G.stats[k] = Math.max(0, Math.min(100, (G.stats[k]||50) + fx[k])); }
    });
    if (dp.budgetEffect) { G.budget += dp.budgetEffect; G.budgetSpentThisYear += Math.abs(dp.budgetEffect); if(G.budget < 0) G.budget = 0; }
    // Show decline penalty notification
    var div = document.createElement('div');
    div.className = 'game-notification notif-warning';
    div.innerHTML = '<div style="font-weight:700;margin-bottom:4px">Partnership Declined: ' + esc(co.name) + '</div><div style="font-size:12px;opacity:0.9">' + esc(dp.text||'The offer was declined.') + '</div>';
    div.onclick = function(){div.remove()};
    document.body.appendChild(div);
    positionNotification(div);
    setTimeout(function(){if(div.parentNode)div.remove()}, 6000);
    updateHUD();
  }
  var el = document.getElementById('coalition-offer-overlay');
  if (el) el.remove();
  afterCoalitionCheck();
}
function applyCoalitionBenefits() {
  (G.activeCoalitions||[]).forEach(function(ac) {
    var perRound = (ac.benefits||{}).perRound || {};
    Object.keys(perRound).forEach(function(k){
      if(k === 'trust' && G.segmentApproval) {
          applySegmentEffects(perRound[k], null, null);
        } else {
          G.stats[k] = Math.max(0, Math.min(100, (G.stats[k]||50) + perRound[k]));
        }
    });
    // Budget benefit per round
    var budgetPR = (ac.benefits||{}).budgetPerRound || 0;
    if(budgetPR > 0) { G.budget += budgetPR; G.budgetIncomeThisYear += budgetPR; }
    if(G.budget > G.budgetMax) G.budgetMax = G.budget;
  });
}
function checkCoalitionViolations(choice) {
  var broken = [];
  (G.activeCoalitions||[]).forEach(function(ac) {
    (ac.constraints||[]).forEach(function(con) {
      if (con.type === 'avoidMission') {
        var align = choice.missionAligned || [];
        if (con.missionIds.some(function(mid){return align.includes(mid)})) broken.push(ac);
      } else if (con.type === 'maintainStat') {
        if ((G.stats[con.stat]||50) < (con.above||0)) broken.push(ac);
      }
    });
  });
  // Remove duplicates
  var seen = {};
  broken = broken.filter(function(ac){if(seen[ac.id])return false;seen[ac.id]=true;return true;});
  broken.forEach(function(ac) {
    // Apply penalty
    var fx = (ac.violationPenalty||{}).effects || {};
    Object.keys(fx).forEach(function(k){
      if(k === 'trust' && G.segmentApproval) { applySegmentEffects(fx[k], null, null); }
      else { G.stats[k] = Math.max(0, Math.min(100, (G.stats[k]||50) + fx[k])); }
    });
    // Apply budget penalty
    var bfxPen = (ac.violationPenalty||{}).budgetEffect || 0;
    if(bfxPen < 0) { G.budget += bfxPen; G.budgetSpentThisYear += Math.abs(bfxPen); }
    if(G.budget < 0) G.budget = 0;
    // Apply political clout penalty for breaking coalition
    var cloutPen = ac.breakCloutPenalty || (ac.violationPenalty||{}).cloutEffect || 0;
    if(cloutPen !== 0) { G.politicalClout = Math.max(0, Math.min(100, G.politicalClout + cloutPen)); }
    recordEvent('coalitionBroken', {coalitionId:ac.id});
    if (!G.brokenCoalitions) G.brokenCoalitions = [];
    G.brokenCoalitions.push(ac.id);
    // Notify
    var div = document.createElement('div');
    div.className = 'game-notification notif-broken';
    div.innerHTML = '<div style="font-weight:700;margin-bottom:4px">\ud83d\udea8 Coalition Broken: ' + esc(ac.name) + '</div><div style="font-size:12px;opacity:0.9">' + esc((ac.violationPenalty||{}).text||'The partnership has ended.') + '</div>';
    div.onclick = function(){div.remove()};
    document.body.appendChild(div);
    positionNotification(div);
    setTimeout(function(){if(div.parentNode)div.remove()}, 7000);
  });
  G.activeCoalitions = (G.activeCoalitions||[]).filter(function(ac){return !broken.some(function(b){return b.id===ac.id})});
}
function tickCoalitionDurations() {
  (G.activeCoalitions||[]).forEach(function(ac){
    if (ac.remaining < 999) ac.remaining--;
  });
  var expired = (G.activeCoalitions||[]).filter(function(ac){return ac.remaining<=0});
  expired.forEach(function(ac){
    recordEvent('coalitionExpired', {coalitionId:ac.id});
  });
  G.activeCoalitions = (G.activeCoalitions||[]).filter(function(ac){return ac.remaining>0});
}
function renderCoalitionBadges() {
  var defaultMax = GAME_DATA.config.coalitionStrikeMax || 3;
  var html = '';
  (G.activeCoalitions||[]).forEach(function(ac) {
    var strikes = (G.coalitionStrikes||{})[ac.id] || 0;
    var max = ac.strikeMax || defaultMax;
    var warn = strikes >= max - 1;
    html += '<span class="coal-badge' + (warn?' warning':'') + '" onclick="showCoalitionPopover(event,\'' + ac.id + '\')">\ud83e\udd1d ' + esc(ac.name).substring(0,18);
    if(strikes > 0) html += ' <span class="coal-strikes">' + strikes + '/' + max + ' ⚡</span>';
    html += '</span>';
  });
  return html;
}

function showCoalitionPopover(evt, coalId) {
  evt.stopPropagation();
  // Remove any existing popover
  closeCoalitionPopover();
  var ac = (G.activeCoalitions||[]).find(function(c){return c.id===coalId});
  if(!ac) return;
  var co = (GAME_DATA.coalitionOffers||[]).find(function(c){return c.id===coalId});
  var defaultMax = GAME_DATA.config.coalitionStrikeMax || 3;
  var strikes = (G.coalitionStrikes||{})[coalId] || 0;
  var max = ac.strikeMax || defaultMax;
  var benefitText = Object.entries((ac.benefits||{}).perRound||{}).map(function(e){return '+'+e[1]+' '+e[0]+'/round'}).join(', ');
  var constraintText = (ac.constraints||[]).map(function(c){return c.description}).join('; ');
  
  // Strike pips
  var pipsHtml = '';
  for(var i = 0; i < max; i++) {
    pipsHtml += '<span class="coal-strike-pip' + (i < strikes ? ' filled' : '') + '"></span>';
  }
  
  var overlay = document.createElement('div');
  overlay.className = 'coal-popover-overlay';
  overlay.onclick = closeCoalitionPopover;
  document.body.appendChild(overlay);
  
  var pop = document.createElement('div');
  pop.className = 'coal-popover';
  pop.id = 'coal-popover-active';
  pop.innerHTML = '<button class="coal-popover-close" onclick="closeCoalitionPopover()">✕</button>' +
    '<div class="coal-popover-name">🤝 ' + esc(ac.name) + '</div>' +
    (co && co.description ? '<div class="coal-popover-desc">' + esc(co.description) + '</div>' : '') +
    '<div class="coal-popover-row"><strong>Benefits:</strong> ' + esc(benefitText || 'None') + '</div>' +
    '<div class="coal-popover-row"><strong>Constraint:</strong> ' + esc(constraintText || 'None') + '</div>' +
    (ac.remaining < 999 ? '<div class="coal-popover-row"><strong>Duration:</strong> ' + ac.remaining + ' round' + (ac.remaining!==1?'s':'') + ' remaining</div>' : '<div class="coal-popover-row"><strong>Duration:</strong> Permanent</div>') +
    '<div class="coal-popover-strikes"><strong>Strikes:&nbsp;</strong> ' + pipsHtml + ' <span style="margin-left:6px;color:var(--muted)">' + strikes + '/' + max + '</span></div>';
  
  // Position near click
  var x = Math.min(evt.clientX, window.innerWidth - 340);
  var y = evt.clientY + 10;
  if(y + 250 > window.innerHeight) y = evt.clientY - 200;
  pop.style.left = Math.max(10, x) + 'px';
  pop.style.top = Math.max(10, y) + 'px';
  document.body.appendChild(pop);
}

function closeCoalitionPopover() {
  var existing = document.getElementById('coal-popover-active');
  if(existing) existing.remove();
  var overlays = document.querySelectorAll('.coal-popover-overlay');
  overlays.forEach(function(o){o.remove()});
}

// ═══ STAT MOMENTUM ═══
function recordStatSnapshot() {
  if (!G.statHistory) G.statHistory = [];
  var snap = {};
  Object.keys(G.stats||{}).forEach(function(k){snap[k]=G.stats[k]});
    snapshotSegments();
  G.statHistory.push(snap);
}
function getStatMomentum(statId) {
  var history = G.statHistory || [];
  var window = GAME_DATA.config.momentumWindow || 2;
  if (history.length < window + 1) return 0;
  var recent = history.slice(-window-1);
  var allUp = true, allDown = true;
  for (var i = 1; i < recent.length; i++) {
    if ((recent[i][statId]||50) <= (recent[i-1][statId]||50)) allUp = false;
    if ((recent[i][statId]||50) >= (recent[i-1][statId]||50)) allDown = false;
  }
  if (allUp) return 1;
  if (allDown) return -1;
  return 0;
}
function applyMomentum() {
  var bonus = GAME_DATA.config.momentumBonus || 2;
  var penalty = GAME_DATA.config.momentumPenalty || 3;
  (GAME_DATA.stats||[]).forEach(function(s) {
    var m = getStatMomentum(s.id);
    if (m > 0) G.stats[s.id] = Math.min(100, (G.stats[s.id]||50) + bonus);
    else if (m < 0) G.stats[s.id] = Math.max(0, (G.stats[s.id]||50) - penalty);
  });
}
function momentumArrow(statId) {
  var m = getStatMomentum(statId);
  if (m > 0) return '<span class="stat-trend up">\u2191</span>';
  if (m < 0) return '<span class="stat-trend down">\u2193</span>';
  return '<span class="stat-trend flat">\u2192</span>';
}

