/* mockup-music-click-script */
(function () {
  if (window.__mockupMusicNexusLegacyDisabled !== false) return;
  const libraryOverlay = document.querySelector('.mockup-library-overlay');
  if (!libraryOverlay) return;

  const musicSelectors = [
    '.mockup-library-status-node.is-music-card',
    '.mockup-library-scope-card.is-primary',
    '.mockup-library-entry-card.is-music-active',
    '.mockup-library-utility-value.is-music-active'
  ].join(',');

  const host = libraryOverlay.querySelector('.mockup-about-copy');
  if (!host) return;

  let musicOverlay = null;
  let lastTrigger = null;

  function ensureMusicOverlay() {
    if (musicOverlay) return musicOverlay;

    const overlay = document.createElement('div');
    overlay.className = 'mockup-music-branch-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = `
      <div class="mockup-music-branch-panel">
        <div class="mockup-music-branch-grid"></div>
        <div class="mockup-music-branch-scan"></div>
        <div class="mockup-music-branch-rail" aria-hidden="true">
          <span></span><span></span><span></span>
        </div>
        <div class="mockup-music-branch-content mockup-music-nexus">
          <button class="mockup-music-branch-close is-visually-hidden" type="button" aria-label="Close music panel">×</button>

          <div class="mockup-music-nexus-hero">
            <div class="mockup-music-nexus-copy">
              <div class="mockup-music-nexus-titlebar" aria-label="Music Nexus title frame">
                <span class="mockup-music-nexus-title-chevron left" aria-hidden="true"></span>
                <span class="mockup-music-nexus-title-rail left" aria-hidden="true"></span>
                <h3 class="mockup-music-branch-title mockup-music-title-reveal" data-text="The Music Nexus">The Music Nexus</h3>
                <span class="mockup-music-nexus-title-rail right" aria-hidden="true"></span>
                <span class="mockup-music-nexus-title-chevron right" aria-hidden="true"></span>
              </div>
              <p class="mockup-music-branch-subtitle">Welcome to the Music Nexus, a central hub to (for now) my journey through my life attending music shows and capturing memories along the way. This is one of the longest-running projects that I have going in my arsenal.</div></p>
            </div>

            <div class="mockup-music-nexus-visual" aria-hidden="true">
              <div class="mockup-music-nexus-visual-grid"></div>
              <div class="mockup-music-nexus-visual-noise"></div>
              <div class="mockup-music-nexus-visual-particles">
                <span></span><span></span><span></span><span></span><span></span><span></span>
                <span></span><span></span><span></span><span></span><span></span><span></span>
              </div>
              <div class="mockup-music-nexus-visual-frame">
                <span class="mockup-music-nexus-corner tl"></span>
                <span class="mockup-music-nexus-corner tr"></span>
                <span class="mockup-music-nexus-corner bl"></span>
                <span class="mockup-music-nexus-corner br"></span>

                <div class="mockup-music-nexus-topband"><span></span><span></span><span></span><span></span></div>

                <div class="mockup-music-nexus-side left">
                  <span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span>
                </div>
                <div class="mockup-music-nexus-side right">
                  <span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span>
                </div>

                <div class="mockup-music-nexus-data left">
                  <div class="mockup-music-nexus-data-line"></div>
                  <div class="mockup-music-nexus-data-line"></div>
                  <div class="mockup-music-nexus-data-line"></div>
                </div>
                <div class="mockup-music-nexus-data right">
                  <div class="mockup-music-nexus-data-line"></div>
                  <div class="mockup-music-nexus-data-line"></div>
                  <div class="mockup-music-nexus-data-line"></div>
                </div>

                

<div class="mockup-music-nexus-shell" aria-hidden="true">
  <div class="mockup-music-nexus-shell-header">
    <button class="mockup-music-nexus-shell-tab is-active" type="button">Bands</button>
    <button class="mockup-music-nexus-shell-tab" type="button">People</button>
    <button class="mockup-music-nexus-shell-tab" type="button">Shows</button>
  </div>
  <div class="mockup-music-nexus-shell-body">
    <div class="mockup-music-nexus-shell-column left v26-bands-layout">
      <div class="mockup-music-band-hero">
        <div class="mockup-music-band-title">Archive · Filter By Band</div>
        <p class="mockup-music-band-intro">
          Welcome to the archives, sorted by band. The section keeps the old local / regional / national / international structure
          and letter grouping idea, but recast inside the new HUD shell.
        </p>
        <div class="mockup-music-band-regiontabs">
          <button class="is-active" type="button">Local</button>
          <button type="button">Regional</button>
          <button type="button">National</button>
          <button type="button">International</button>
        </div>
      </div>

      <div class="mockup-music-band-groups">
        <div class="mockup-music-band-groups-head">
          <span>Letter Groupings</span>
          <div class="mockup-music-band-status">
            <i class="good">Done</i>
            <i class="partial">In Progress</i>
            <i class="none">Not Touched</i>
          </div>
        </div>
        <div class="mockup-music-band-lettergrid">
          <b class="active">0-C</b>
          <b>D-G</b>
          <b>H-K</b>
          <b>L-O</b>
          <b>P-S</b>
          <b>T-Z</b>
        </div>
      </div>

      <div class="mockup-music-band-preview">
        <div class="mockup-music-band-preview-main">
          <div class="mockup-music-band-preview-card">
            <strong>Bands</strong>
            <p>Artist-first archive access with expandable local, regional, national, and international groupings.</p>
          </div>
          <div class="mockup-music-band-preview-card">
            <strong>Current Route</strong>
            <p>Start with a region, branch into a letter group, then move outward into the linked band archive shell.</p>
          </div>
        </div>
</div>
    </div>

    <div class="mockup-music-nexus-shell-column right v26-bands-sidebar">
      <div class="mockup-music-band-preview-side">
          <div class="mockup-music-band-micro">
            <span>Region Snapshot</span>
            <em>Local</em>
            <em>Regional</em>
            <em>National</em>
            <em>International</em>
          </div>
    </div>
  </div>
</div>
  </div>
</div>


<div class="mockup-music-nexus-center">
                  <div class="mockup-music-nexus-center-pulse"></div>
                  <div class="mockup-music-nexus-core-ring ring-c"></div>
                  <div class="mockup-music-nexus-core-ring ring-a"></div>
                  <div class="mockup-music-nexus-core-ring ring-b"></div>
                  <div class="mockup-music-nexus-target-ticks">
                    <span></span><span></span><span></span><span></span><span></span><span></span>
                    <span></span><span></span><span></span><span></span><span></span><span></span>
                  </div>
                  <div class="mockup-music-nexus-arrow left"></div>
                  <div class="mockup-music-nexus-arrow right"></div>
                  <div class="mockup-music-nexus-core"></div>
                </div>

                <div class="mockup-music-nexus-pods">
                  <div class="mockup-music-nexus-pod">
                    <div class="mockup-music-nexus-pod-lines"><span></span><span></span></div>
                  </div>
                  <div class="mockup-music-nexus-pod">
                    <div class="mockup-music-nexus-pod-lines"><span></span><span></span></div>
                  </div>
                </div>

                <div class="mockup-music-nexus-bottomband"><span></span><span></span><span></span><span></span></div>
              </div>
              <div class="mockup-music-nexus-sweep"></div>
            </div>
          </div>

        </div>
      </div>
    `;
    host.appendChild(overlay);
    initMusicNexusTitle(overlay);

    overlay.addEventListener('click', function (event) {
      if (event.target === overlay) closeMusicOverlay();
    });
    const closeButton = overlay.querySelector('.mockup-music-branch-close');
    if (closeButton) {
      closeButton.addEventListener('click', function () {
        closeMusicOverlay();
      });
    }

    musicOverlay = overlay;
    return overlay;
  }


  function initMusicNexusTitle(overlay) {
    if (!overlay) return;
    const title = overlay.querySelector('.mockup-music-branch-title.mockup-music-title-reveal');
    if (!title || title.dataset.titleBuilt === '1') return;

    const source = String(title.getAttribute('data-text') || title.textContent || '').trim();
    if (!source) return;

    title.dataset.titleBuilt = '1';
    title.setAttribute('aria-label', source);

    const words = source.split(/\s+/).filter(Boolean);
    const frag = document.createDocumentFragment();
    let charIndex = 0;

    words.forEach(function(word, wordIndex) {
      const wordWrap = document.createElement('span');
      wordWrap.className = 'mockup-music-title-word';

      Array.from(word).forEach(function(ch) {
        const span = document.createElement('span');
        span.className = 'mockup-music-title-char';
        span.textContent = ch;
        span.style.animationDelay = (0.08 + (charIndex * 0.038)) + 's';
        wordWrap.appendChild(span);
        charIndex += 1;
      });

      frag.appendChild(wordWrap);

      if (wordIndex < words.length - 1) {
        const gap = document.createElement('span');
        gap.className = 'mockup-music-title-gap';
        gap.setAttribute('aria-hidden', 'true');
        gap.textContent = ' ';
        frag.appendChild(gap);
      }
    });

    title.textContent = '';
    title.appendChild(frag);
  }

  function setOriginFromTrigger(trigger) {
    if (!trigger) return;
    const triggerRect = trigger.getBoundingClientRect();
    const hostRect = host.getBoundingClientRect();
    const x = Math.max(0, Math.min(hostRect.width, triggerRect.left + triggerRect.width / 2 - hostRect.left));
    const y = Math.max(0, Math.min(hostRect.height, triggerRect.top + triggerRect.height / 2 - hostRect.top));
    const overlay = ensureMusicOverlay();
    overlay.style.setProperty('--music-origin-x', `${x}px`);
    overlay.style.setProperty('--music-origin-y', `${y}px`);
  }

  function armTrigger(trigger) {
    if (lastTrigger && lastTrigger !== trigger) {
      lastTrigger.classList.remove('is-music-click-armed');
    }
    lastTrigger = trigger;
    if (trigger && trigger.classList) {
      trigger.classList.remove('is-music-click-armed');
      void trigger.offsetWidth;
      trigger.classList.add('is-music-click-armed');
    }
  }

  function openMusicOverlay(trigger) {
    const overlay = ensureMusicOverlay();
    armTrigger(trigger);
    setOriginFromTrigger(trigger);
    overlay.classList.remove('is-closing');
    overlay.classList.add('is-mounted');
    void overlay.offsetWidth;
    libraryOverlay.classList.add('is-music-branch-open');
    overlay.classList.add('is-visible');
    overlay.setAttribute('aria-hidden', 'false');
  }

  function closeMusicOverlay() {
    if (!musicOverlay) return;
    libraryOverlay.classList.remove('is-music-branch-open');
    musicOverlay.classList.remove('is-visible');
    musicOverlay.classList.add('is-closing');
    musicOverlay.setAttribute('aria-hidden', 'true');
    if (lastTrigger) lastTrigger.classList.remove('is-music-click-armed');
    window.setTimeout(() => {
      if (!musicOverlay) return;
      musicOverlay.classList.remove('is-mounted', 'is-closing');
    }, 220);
  }

  libraryOverlay.addEventListener('click', function (event) {
    const trigger = event.target.closest(musicSelectors);
    if (!trigger || !libraryOverlay.contains(trigger)) return;

    if (!libraryOverlay.classList.contains('is-expanded') && !libraryOverlay.classList.contains('is-visible')) return;

    event.preventDefault();
    event.stopPropagation();

    if (libraryOverlay.classList.contains('is-music-branch-open')) {
      closeMusicOverlay();
      return;
    }

    openMusicOverlay(trigger);
  }, true);

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && libraryOverlay.classList.contains('is-music-branch-open')) {
      closeMusicOverlay();
    }
  });
})();

/* mockup-music-nexus-v8-script */
(function () {
  if (window.__mockupMusicNexusV14Force !== false) return;
  window.__mockupMusicNexusLegacyDisabled = true;
  const MUSIC_ROUTE = '/testing/music';
  const PORTFOLIO_ROUTE = '/testing/portfolio';

  const libraryOverlay = document.querySelector('.mockup-library-overlay');
  if (!libraryOverlay) return;

  const musicSelectors = [
    '.mockup-library-status-node.is-music-card',
    '.mockup-library-scope-card.is-primary',
    '.mockup-library-entry-card.is-music-active',
    '.mockup-library-utility-value.is-music-active'
  ].join(',');

  const host = libraryOverlay.querySelector('.mockup-about-copy');
  if (!host) return;

  let musicOverlay = null;
  let lastTrigger = null;
  let overlayPhase = 'idle';
  let overlayTimers = [];

  function getShellPathname() {
    return window.location.pathname || '';
  }

  function syncTestingRoute(route, mode) {
    if (!route || getShellPathname() === route) return;
    if (window.parent && window.parent !== window) {
      try {
        window.parent.postMessage({ type: 'vmTestingRoute', route }, '*');
      } catch (_) {}
      return;
    }
    if (!window.history || typeof window.history[mode] !== 'function') return;
    try {
      window.history[mode]({ route }, '', route);
    } catch (_) {}
  }

  function clearOverlayTimers() {
    overlayTimers.forEach(function (timerId) {
      window.clearTimeout(timerId);
    });
    overlayTimers = [];
  }

  function scheduleOverlayStep(callback, delay) {
    const timerId = window.setTimeout(callback, delay);
    overlayTimers.push(timerId);
    return timerId;
  }

  function ensureMusicOverlay() {
    if (musicOverlay) return musicOverlay;

    const overlay = document.createElement('div');
    overlay.className = 'mockup-music-branch-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = `
      <div class="mockup-music-branch-panel">
        <div class="mockup-music-branch-content">
          <button class="mockup-music-branch-close is-visually-hidden" type="button" aria-label="Close music panel">×</button>
          <section class="mockup-nexus-v8" data-sequence-state="idle">
            <div class="mockup-nexus-v8-header">
              <div class="mockup-nexus-v8-header-band">
                <span class="mockup-nexus-v8-corner tl" aria-hidden="true"></span>
                <span class="mockup-nexus-v8-corner tr" aria-hidden="true"></span>
                <span class="mockup-nexus-v8-scanline" aria-hidden="true"></span>
                <div class="mockup-nexus-v8-title-zone">
                  <div class="mockup-nexus-v8-title-wrap">
                    <h3>THE MUSIC NEXUS</h3>
                  </div>
                  <p class="mockup-nexus-v8-intro">Welcome to the Music Nexus, the housing for all things music-related in this journey. This is the culmination of my work in the local scene, and generally the logs of capturing memories from these shows. This area is still in building mode, so check back later.</p>
                </div>
              </div>
            </div>
            <div class="mockup-nexus-v8-chamber">
              <div class="mockup-nexus-v8-filter-prompt">PLEASE SELECT YOUR FILTER</div>
              <div class="mockup-nexus-v8-start-wrap">
                <div class="mockup-nexus-v8-start-stack">
                  <svg class="mockup-nexus-v8-start-orbit" viewBox="0 0 360 360" aria-hidden="true">
                    <defs>
                      <path id="mockupNexusStartOrbitPath" d="M 180,180 m -128,0 a 128,128 0 1,1 256,0 a 128,128 0 1,1 -256,0"></path>
                    </defs>
                    <text>
                      <textPath href="#mockupNexusStartOrbitPath" startOffset="0%">
                        START • ACTIVATE • START • ACTIVATE • START • ACTIVATE •
                      </textPath>
                    </text>
                  </svg>
                  <button class="mockup-nexus-v8-start" type="button" aria-label="Start Music Nexus">
                    <span class="mockup-nexus-v8-start-icon" aria-hidden="true"></span>
                    <span class="mockup-nexus-v8-start-label">Start</span>
                  </button>
                </div>
              </div>
              <span class="mockup-nexus-v8-corner tl" aria-hidden="true"></span>
              <span class="mockup-nexus-v8-corner tr" aria-hidden="true"></span>
              <span class="mockup-nexus-v8-corner bl" aria-hidden="true"></span>
              <span class="mockup-nexus-v8-corner br" aria-hidden="true"></span>
              <span class="mockup-nexus-v8-rail left" aria-hidden="true"></span>
              <span class="mockup-nexus-v8-rail right" aria-hidden="true"></span>
              <span class="mockup-nexus-v8-scanline is-chamber" aria-hidden="true"></span>
              <span class="mockup-nexus-v8-grid" aria-hidden="true"></span>
              <span class="mockup-nexus-v8-aperture" aria-hidden="true"></span>
              <div class="mockup-nexus-v8-filter-deploy" aria-label="Music Nexus filters">
                <button class="mockup-nexus-v8-filter-btn" type="button">Bands</button>
                <button class="mockup-nexus-v8-filter-btn" type="button">Shows</button>
                <button class="mockup-nexus-v8-filter-btn" type="button">People</button>
              </div>
            </div>
          </section>
        </div>
      </div>
    `;
    host.appendChild(overlay);
    bindMusicNexusSequence(overlay);

    overlay.addEventListener('click', function (event) {
      if (event.target === overlay) {
        closeMusicOverlay();
      }
    });

    const closeButton = overlay.querySelector('.mockup-music-branch-close');
    if (closeButton) {
      closeButton.addEventListener('click', function () {
        closeMusicOverlay();
      });
    }

    musicOverlay = overlay;
    return overlay;
  }

  function bindMusicNexusSequence(overlay) {
    if (!overlay || overlay.dataset.sequenceBound === '1') return;

    const nexusRoot = overlay.querySelector('.mockup-nexus-v8');
    const startButton = overlay.querySelector('.mockup-nexus-v8-start');
    const startStack = overlay.querySelector('.mockup-nexus-v8-start-stack');
    const intro = overlay.querySelector('.mockup-nexus-v8-intro');
    const titleWrap = overlay.querySelector('.mockup-nexus-v8-title-wrap');
    const titleZone = overlay.querySelector('.mockup-nexus-v8-title-zone');
    const headerBand = overlay.querySelector('.mockup-nexus-v8-header-band');
    const filterPrompt = overlay.querySelector('.mockup-nexus-v8-filter-prompt');
    const filterButtons = Array.from(overlay.querySelectorAll('.mockup-nexus-v8-filter-btn'));

    if (!nexusRoot || !startButton || !startStack || !titleWrap || !titleZone || !headerBand || !filterPrompt || !filterButtons.length) {
      return;
    }

    const sequenceState = {
      launched: false,
      timers: []
    };

    function clearSequenceTimers() {
      sequenceState.timers.forEach(function (timerId) {
        window.clearTimeout(timerId);
      });
      sequenceState.timers = [];
    }

    function scheduleSequenceStep(callback, delay) {
      const timerId = window.setTimeout(callback, delay);
      sequenceState.timers.push(timerId);
      return timerId;
    }

    function setDockPosition() {
      const titleRect = titleWrap.getBoundingClientRect();
      const bandRect = headerBand.getBoundingClientRect();
      const titleCenterX = titleRect.left + (titleRect.width / 2);
      const titleCenterY = titleRect.top + (titleRect.height / 2);
      const targetCenterX = bandRect.left + (bandRect.width / 2);
      const targetCenterY = bandRect.top + Math.min(44, bandRect.height * 0.32);
      titleWrap.style.setProperty('--title-dock-x', (targetCenterX - titleCenterX) + 'px');
      titleWrap.style.setProperty('--title-dock-y', (targetCenterY - titleCenterY) + 'px');
    }

    function resetSequence() {
      clearSequenceTimers();
      sequenceState.launched = false;
      nexusRoot.dataset.sequenceState = 'idle';
      startStack.classList.remove('is-launching');
      titleZone.classList.remove('is-title-launched');
      if (intro) {
        intro.classList.remove('fade-out');
      }
      filterPrompt.classList.remove('is-active');
      filterButtons.forEach(function (button) {
        button.classList.remove('is-deploying', 'is-ready');
        button.style.removeProperty('--deploy-delay');
        button.style.removeProperty('--deploy-x');
      });
      setDockPosition();
    }

    function deployFilters() {
      nexusRoot.dataset.sequenceState = 'filters-active';
      filterPrompt.classList.remove('is-active');
      void filterPrompt.offsetWidth;
      filterPrompt.classList.add('is-active');

      filterButtons.forEach(function (button, index) {
        button.style.setProperty('--deploy-x', '0px');
        button.style.setProperty('--deploy-delay', (index * 90) + 'ms');
        button.classList.remove('is-deploying', 'is-ready');
        void button.offsetWidth;
        button.classList.add('is-deploying');
        scheduleSequenceStep(function () {
          button.classList.add('is-ready');
        }, (index * 90) + 720);
      });
    }

    function launchTitleAndFilters() {
      setDockPosition();
      titleZone.classList.remove('is-title-launched');
      void titleWrap.offsetWidth;
      titleZone.classList.add('is-title-launched');
      scheduleSequenceStep(function () {
        deployFilters();
      }, 760);
    }

    startButton.addEventListener('click', function () {
      if (sequenceState.launched) return;
      sequenceState.launched = true;
      nexusRoot.dataset.sequenceState = 'start-pressed';
      startStack.classList.add('is-launching');
      scheduleSequenceStep(function () {
        if (intro) {
          intro.classList.add('fade-out');
        }
      }, 760);
      scheduleSequenceStep(function () {
        nexusRoot.dataset.sequenceState = 'title-launching';
        launchTitleAndFilters();
      }, 1320);
    });

    window.addEventListener('resize', function () {
      if (overlay.getAttribute('aria-hidden') === 'true') return;
      setDockPosition();
    });

    overlay.__resetMusicNexusSequence = resetSequence;
    overlay.dataset.sequenceBound = '1';
    resetSequence();
  }

  function setOriginFromTrigger(trigger) {
    if (!trigger) return;
    const triggerRect = trigger.getBoundingClientRect();
    const hostRect = host.getBoundingClientRect();
    const x = Math.max(0, Math.min(hostRect.width, triggerRect.left + (triggerRect.width / 2) - hostRect.left));
    const y = Math.max(0, Math.min(hostRect.height, triggerRect.top + (triggerRect.height / 2) - hostRect.top));
    const overlay = ensureMusicOverlay();
    overlay.style.setProperty('--music-origin-x', `${x}px`);
    overlay.style.setProperty('--music-origin-y', `${y}px`);
  }

  function armTrigger(trigger) {
    if (lastTrigger && lastTrigger !== trigger) {
      lastTrigger.classList.remove('is-music-click-armed');
    }
    lastTrigger = trigger;
    if (trigger && trigger.classList) {
      trigger.classList.remove('is-music-click-armed');
      void trigger.offsetWidth;
      trigger.classList.add('is-music-click-armed');
    }
  }

  function openMusicOverlay(trigger, options = {}) {
    const routeMode = options.routeMode || 'pushState';
    if (overlayPhase !== 'idle') return;
    const overlay = ensureMusicOverlay();
    clearOverlayTimers();
    armTrigger(trigger);
    setOriginFromTrigger(trigger);
    if (typeof overlay.__resetMusicNexusSequence === 'function') {
      overlay.__resetMusicNexusSequence();
    }

    overlay.classList.remove('is-closing');
    overlay.classList.add('is-mounted');
    overlayPhase = 'portfolio-exiting';
    libraryOverlay.classList.add('is-music-branch-transitioning');
    void overlay.offsetWidth;

    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        overlay.classList.add('is-visible');
        overlay.setAttribute('aria-hidden', 'false');
        overlayPhase = 'music-nexus-entering';
        scheduleOverlayStep(function () {
          libraryOverlay.classList.add('is-music-branch-open');
          libraryOverlay.classList.remove('is-music-branch-transitioning');
          overlayPhase = 'music-nexus-active';
          syncTestingRoute(MUSIC_ROUTE, routeMode);
        }, 620);
      });
    });
  }

  function closeMusicOverlay(options = {}) {
    const routeMode = options.routeMode || 'pushState';
    if (!musicOverlay || overlayPhase === 'idle') return;
    clearOverlayTimers();
    overlayPhase = 'closing';
    libraryOverlay.classList.remove('is-music-branch-open');
    libraryOverlay.classList.remove('is-music-branch-transitioning');
    musicOverlay.classList.remove('is-visible');
    musicOverlay.classList.add('is-closing');
    musicOverlay.setAttribute('aria-hidden', 'true');
    if (lastTrigger) {
      lastTrigger.classList.remove('is-music-click-armed');
    }
    scheduleOverlayStep(function () {
      if (!musicOverlay) return;
      musicOverlay.classList.remove('is-mounted', 'is-closing');
      if (typeof musicOverlay.__resetMusicNexusSequence === 'function') {
        musicOverlay.__resetMusicNexusSequence();
      }
      overlayPhase = 'idle';
      syncTestingRoute(PORTFOLIO_ROUTE, routeMode);
    }, 220);
  }

  function syncOverlayToTestingRoute() {
    const pathname = getShellPathname();
    const wantsMusic = pathname === MUSIC_ROUTE;
    const wantsPortfolio = pathname === PORTFOLIO_ROUTE;
    const libraryIsOpen =
      libraryOverlay.classList.contains('is-expanded') ||
      libraryOverlay.classList.contains('is-visible') ||
      libraryOverlay.classList.contains('is-content-visible');

    if (wantsMusic) {
      if (libraryIsOpen && !libraryOverlay.classList.contains('is-music-branch-open') && overlayPhase === 'idle') {
        openMusicOverlay(
          libraryOverlay.querySelector('.mockup-library-entry-card.is-music-active')
            || libraryOverlay.querySelector('.mockup-library-scope-card.is-primary')
            || libraryOverlay.querySelector('.mockup-library-status-node.is-music-card'),
          { routeMode: 'replaceState' }
        );
      }
      return;
    }

    if (wantsPortfolio && libraryOverlay.classList.contains('is-music-branch-open')) {
      closeMusicOverlay({ routeMode: 'replaceState' });
    }
  }

  libraryOverlay.addEventListener('click', function (event) {
    const trigger = event.target.closest(musicSelectors);
    if (!trigger || !libraryOverlay.contains(trigger)) return;

    if (!libraryOverlay.classList.contains('is-expanded') && !libraryOverlay.classList.contains('is-visible')) return;

    event.preventDefault();
    event.stopPropagation();

    if (libraryOverlay.classList.contains('is-music-branch-open')) {
      closeMusicOverlay();
      return;
    }

    openMusicOverlay(trigger);
  }, true);

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && libraryOverlay.classList.contains('is-music-branch-open')) {
      closeMusicOverlay();
    }
  });

  window.addEventListener('popstate', function () {
    window.requestAnimationFrame(syncOverlayToTestingRoute);
  });

  window.addEventListener('message', function (event) {
    const data = event && event.data;
    if (!data || data.type !== 'vmTestingRouteSync') return;
    window.requestAnimationFrame(syncOverlayToTestingRoute);
  });

  window.setTimeout(syncOverlayToTestingRoute, 0);
  window.setTimeout(syncOverlayToTestingRoute, 960);
})();

/* mockup-music-nexus-v14-script */
(function () {
  window.__mockupMusicNexusV14Force = true;
  window.__mockupMusicNexusLegacyDisabled = true;
  const MUSIC_ROUTE = '/testing/music';
  const PORTFOLIO_ROUTE = '/testing/portfolio';

  const libraryOverlay = document.querySelector('.mockup-library-overlay');
  if (!libraryOverlay) return;
  const host = libraryOverlay.querySelector('.mockup-about-copy');
  if (!host) return;
  const hostCopyText = libraryOverlay.querySelector('.mockup-about-copy-text');

  const musicSelectors = [
    '.mockup-library-status-node.is-music-card',
    '.mockup-library-scope-card.is-primary',
    '.mockup-library-entry-card.is-music-active',
    '.mockup-library-utility-value.is-music-active'
  ].join(',');

  let musicOverlay = null;
  let lastTrigger = null;
  let overlayPhase = 'idle';
  let overlayTimers = [];
  let localRoutePath = '';
  let releaseFootprintTimer = 0;
  let lockedFootprintHeight = '';

  function getShellPathname() {
    return localRoutePath || window.location.pathname || '';
  }

  function syncTestingRoute(route, mode, options = {}) {
    const deferHistory = !!options.deferHistory;
    const previousPath = getShellPathname();
    localRoutePath = route || '';
    if (!route || previousPath === route) return;
    if (deferHistory) return;
    if (window.parent && window.parent !== window) {
      try {
        window.parent.postMessage({ type: 'vmTestingRoute', route }, '*');
      } catch (_) {}
      return;
    }
    if (!window.history || typeof window.history[mode] !== 'function') return;
    try {
      window.history[mode]({ route }, '', route);
    } catch (_) {}
  }

  function clearReleaseFootprintTimer() {
    if (releaseFootprintTimer) {
      window.clearTimeout(releaseFootprintTimer);
      releaseFootprintTimer = 0;
    }
  }

  function lockMusicFootprint() {
    clearReleaseFootprintTimer();
    const sourceRect = host.getBoundingClientRect();
    if (!sourceRect.height) return;
    lockedFootprintHeight = Math.ceil(sourceRect.height) + 'px';
    libraryOverlay.style.setProperty('--music-lock-height', lockedFootprintHeight);
    libraryOverlay.classList.add('is-music-footprint-locked');
    host.style.minHeight = lockedFootprintHeight;
    host.style.height = lockedFootprintHeight;
    if (hostCopyText) {
      hostCopyText.style.minHeight = lockedFootprintHeight;
    }
  }

  function releaseMusicFootprint(delay) {
    clearReleaseFootprintTimer();
    releaseFootprintTimer = window.setTimeout(function () {
      libraryOverlay.classList.remove('is-music-footprint-locked');
      libraryOverlay.style.removeProperty('--music-lock-height');
      host.style.removeProperty('min-height');
      host.style.removeProperty('height');
      if (hostCopyText) {
        hostCopyText.style.removeProperty('min-height');
      }
      lockedFootprintHeight = '';
      releaseFootprintTimer = 0;
    }, delay);
  }

  function clearOverlayTimers() {
    overlayTimers.forEach(function (timerId) {
      window.clearTimeout(timerId);
    });
    overlayTimers = [];
  }

  function scheduleOverlayStep(callback, delay) {
    const timerId = window.setTimeout(callback, delay);
    overlayTimers.push(timerId);
    return timerId;
  }

  function ensureMusicOverlay() {
    if (musicOverlay) return musicOverlay;

    const overlay = document.createElement('div');
    overlay.className = 'mockup-music-branch-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = `
      <div class="mockup-music-branch-panel">
        <div class="mockup-music-branch-content">
          <button class="mockup-music-branch-close is-visually-hidden" type="button" aria-label="Close music panel">×</button>
          <div class="mockup-nexus-v14-host">
            <div class="top-module">
              <div class="header-band is-booting">
                <span class="corner tl" aria-hidden="true"></span>
                <span class="corner tr" aria-hidden="true"></span>
                <span class="scanline" aria-hidden="true"></span>
                <div class="title-zone">
                  <div class="title-wrap"><h1>THE MUSIC NEXUS</h1></div>
                  <div class="intro">Welcome to the Music Nexus, the housing for all things music-related in this journey. This is the culmination of my work in the local scene, and generally the logs of capturing memories from these shows. This area is still in building mode, so check back later.</div>
                </div>
                <div class="mode-indicator" aria-hidden="true">
                  <span class="mode-indicator-bracket left"></span>
                  <span class="mode-indicator-text"></span>
                  <span class="mode-indicator-bracket right"></span>
                </div>
              </div>
            </div>
            <div class="placeholder">
              <div class="filter-prompt">Welcome. Please select your desired filter below:</div>
              <div class="chamber-start-wrap">
                <div class="chamber-start-stack">
                  <svg class="hud-start-orbit" viewBox="0 0 360 360" aria-hidden="true">
                    <defs>
                      <path id="mockupV14StartOrbitPath" d="M 180,180 m -128,0 a 128,128 0 1,1 256,0 a 128,128 0 1,1 -256,0"></path>
                    </defs>
                    <text>
                      <textPath href="#mockupV14StartOrbitPath" startOffset="0%">
                        START • ACTIVATE • START • ACTIVATE • START • ACTIVATE •
                      </textPath>
                    </text>
                  </svg>
                  <button class="hud-start" type="button" aria-label="Start Music Nexus">
                    <span class="hud-start-icon" aria-hidden="true"></span>
                    <span class="hud-start-label">Start</span>
                  </button>
                </div>
              </div>
              <span class="corner tl" aria-hidden="true"></span>
              <span class="corner tr" aria-hidden="true"></span>
              <span class="corner bl" aria-hidden="true"></span>
              <span class="corner br" aria-hidden="true"></span>
              <span class="rail left" aria-hidden="true"></span>
              <span class="rail right" aria-hidden="true"></span>
              <span class="scanline" aria-hidden="true"></span>
              <span class="grid" aria-hidden="true"></span>
              <span class="aperture" aria-hidden="true"></span>
              <div class="nexus-filter-deploy" aria-label="Music Nexus filters">
                <button class="nexus-filter-btn filter-bands" type="button" data-mode="bands">
                  <span class="filter-bracket" aria-hidden="true"></span>
                  <span class="filter-scan" aria-hidden="true"></span>
                  <span class="filter-node" aria-hidden="true"></span>
                  <span class="filter-label">Bands</span>
                </button>
                <button class="nexus-filter-btn filter-shows" type="button" data-mode="shows">
                  <span class="filter-bracket" aria-hidden="true"></span>
                  <span class="filter-scan" aria-hidden="true"></span>
                  <span class="filter-node" aria-hidden="true"></span>
                  <span class="filter-label">Shows</span>
                </button>
                <button class="nexus-filter-btn filter-people" type="button" data-mode="people">
                  <span class="filter-bracket" aria-hidden="true"></span>
                  <span class="filter-scan" aria-hidden="true"></span>
                  <span class="filter-node" aria-hidden="true"></span>
                  <span class="filter-label">People</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    host.appendChild(overlay);
    bindV14Sequence(overlay);

    overlay.addEventListener('click', function (event) {
      if (event.target === overlay) {
        closeMusicOverlay();
      }
    });

    const closeButton = overlay.querySelector('.mockup-music-branch-close');
    if (closeButton) {
      closeButton.addEventListener('click', function () {
        closeMusicOverlay();
      });
    }

    musicOverlay = overlay;
    return overlay;
  }

  function bindV14Sequence(overlay) {
    if (!overlay || overlay.dataset.v14Bound === '1') return;

    const root = overlay.querySelector('.mockup-nexus-v14-host');
    const startButton = overlay.querySelector('.hud-start');
    const startStack = overlay.querySelector('.chamber-start-stack');
    const intro = overlay.querySelector('.intro');
    const titleWrap = overlay.querySelector('.title-wrap');
    const titleZone = overlay.querySelector('.title-zone');
    const chamber = overlay.querySelector('.header-band');
    const filterButtons = Array.from(overlay.querySelectorAll('.nexus-filter-btn'));
    const filterChamber = overlay.querySelector('.placeholder');
    const filterDeploy = overlay.querySelector('.nexus-filter-deploy');
    const filterPrompt = overlay.querySelector('.filter-prompt');
    const modeIndicator = overlay.querySelector('.mode-indicator');
    const modeIndicatorText = overlay.querySelector('.mode-indicator-text');

    if (!root || !startButton || !startStack || !intro || !titleWrap || !titleZone || !chamber || !filterButtons.length || !filterChamber || !filterDeploy || !filterPrompt || !modeIndicator || !modeIndicatorText) {
      return;
    }

    const state = {
      timers: [],
      hasTransferredFilter: false
    };

    function clearTimers() {
      state.timers.forEach(function (timerId) {
        window.clearTimeout(timerId);
      });
      state.timers = [];
    }

    function schedule(callback, delay) {
      const timerId = window.setTimeout(callback, delay);
      state.timers.push(timerId);
      return timerId;
    }

    function getDeployOffsets() {
      return [0, 0, 0];
    }

    function getDeployDelays() {
      return [0, 90, 180];
    }

    function positionFilterRow() {
      const chamberRect = filterChamber.getBoundingClientRect();
      const deployRect = filterDeploy.getBoundingClientRect();
      const centerX = (chamberRect.left + chamberRect.width / 2) - (deployRect.left + deployRect.width / 2);
      const centerY = (chamberRect.top + chamberRect.height / 2) - (deployRect.top + deployRect.height / 2);
      filterDeploy.style.transform = 'translate(-50%, -50%) translate3d(' + centerX + 'px,' + centerY + 'px,0)';
    }

    function setFilterMode(mode) {
      filterChamber.classList.remove('mode-bands', 'mode-shows', 'mode-people');
      if (mode) {
        filterChamber.classList.add('mode-' + mode);
      }
    }

    function getSelectedButton() {
      return filterButtons.find(function (item) {
        return item.classList.contains('is-selected');
      }) || null;
    }

    function pulseChamber() {
      filterChamber.classList.remove('mode-pulsing');
      void filterChamber.offsetWidth;
      filterChamber.classList.add('mode-pulsing');
      schedule(function () {
        filterChamber.classList.remove('mode-pulsing');
      }, 260);
    }

    function clearTransferStates() {
      filterButtons.forEach(function (item) {
        item.classList.remove('is-selected', 'is-confirming', 'is-fading', 'is-blinking', 'is-transferring');
      });
      filterDeploy.classList.remove('is-locked', 'is-complete');
      modeIndicator.classList.remove('is-active');
      filterChamber.classList.remove('mode-transfer');
    }

    function activateModeIndicator(label) {
      modeIndicatorText.textContent = label;
      modeIndicator.classList.remove('is-active');
      void modeIndicator.offsetWidth;
      modeIndicator.classList.add('is-active');
    }

    function transferFilterSelection(button) {
      if (state.hasTransferredFilter || !button) return;
      state.hasTransferredFilter = true;

      const selectedMode = button.getAttribute('data-mode');
      const selectedLabelEl = button.querySelector('.filter-label');
      const selectedLabel = selectedLabelEl ? selectedLabelEl.textContent.trim() : button.textContent.trim();

      filterDeploy.classList.add('is-locked');

      filterButtons.forEach(function (item) {
        if (item !== button) {
          item.classList.remove('is-selected', 'is-confirming');
          item.classList.add('is-fading');
        }
      });

      filterPrompt.classList.remove('is-active');
      filterPrompt.classList.add('is-hidden');

      setFilterMode(selectedMode);

      schedule(function () {
        pulseChamber();
        button.classList.remove('is-confirming');
        button.classList.add('is-selected', 'is-blinking');
        filterChamber.classList.add('mode-transfer');
      }, 560);

      schedule(function () {
        button.classList.remove('is-blinking');
        button.classList.add('is-transferring');
      }, 2300);

      schedule(function () {
        filterDeploy.classList.add('is-complete');
        activateModeIndicator(selectedLabel);
      }, 2740);
    }

    function deployFilters() {
      const useOffsets = getDeployOffsets();
      const deployDelays = getDeployDelays();
      positionFilterRow();
      state.hasTransferredFilter = false;
      clearTransferStates();
      filterPrompt.classList.remove('is-active', 'is-hidden');

      filterButtons.forEach(function (button, index) {
        button.style.setProperty('--deploy-x', useOffsets[index] + 'px');
        button.style.setProperty('--deploy-delay', deployDelays[index] + 'ms');
        button.classList.remove('is-deploying', 'is-ready');
        void button.offsetWidth;
        button.classList.add('is-deploying');
        schedule(function () {
          button.classList.add('is-ready');
        }, deployDelays[index] + 720);
      });

      schedule(function () {
        filterPrompt.classList.add('is-active');
      }, 240);
    }

    function launchTitleToCenter() {
      const titleRect = titleWrap.getBoundingClientRect();
      const chamberRect = chamber.getBoundingClientRect();
      const titleCenterX = titleRect.left + (titleRect.width / 2);
      const titleCenterY = titleRect.top + (titleRect.height / 2);
      const targetCenterX = chamberRect.left + (chamberRect.width / 2);
      const targetCenterY = chamberRect.top + (chamberRect.height / 2);
      titleWrap.style.setProperty('--title-dock-x', (targetCenterX - titleCenterX) + 'px');
      titleWrap.style.setProperty('--title-dock-y', (targetCenterY - titleCenterY) + 'px');
      titleZone.classList.remove('is-title-launched');
      void titleWrap.offsetWidth;
      titleZone.classList.add('is-title-launched');
      schedule(function () {
        deployFilters();
      }, 760);
    }

    function resetSequence() {
      clearTimers();
      state.hasTransferredFilter = false;
      startStack.classList.remove('is-launching');
      titleZone.classList.remove('is-title-launched');
      intro.classList.remove('fade-out');
      setFilterMode('');
      clearTransferStates();
      filterPrompt.classList.remove('is-active', 'is-hidden');
      filterButtons.forEach(function (button) {
        button.classList.remove('is-deploying', 'is-ready');
        button.style.removeProperty('--deploy-x');
        button.style.removeProperty('--deploy-delay');
      });
      filterDeploy.style.transform = 'translate(-50%, -50%)';
    }

    filterButtons.forEach(function (button) {
      button.addEventListener('mouseenter', function () {
        const selected = getSelectedButton();
        if (selected) return;
        setFilterMode(button.getAttribute('data-mode'));
      });

      button.addEventListener('mouseleave', function () {
        const selected = getSelectedButton();
        if (selected) {
          setFilterMode(selected.getAttribute('data-mode'));
        } else {
          setFilterMode('');
        }
      });

      button.addEventListener('click', function () {
        if (state.hasTransferredFilter) return;
        const selectedMode = button.getAttribute('data-mode');
        filterButtons.forEach(function (item) {
          item.classList.remove('is-selected', 'is-confirming', 'is-fading', 'is-blinking', 'is-transferring');
        });
        button.classList.add('is-selected', 'is-confirming');
        setFilterMode(selectedMode);
        pulseChamber();
        schedule(function () {
          transferFilterSelection(button);
        }, 620);
      });
    });

    startButton.addEventListener('click', function () {
      if (startStack.classList.contains('is-launching')) return;
      startStack.classList.add('is-launching');
      schedule(function () {
        intro.classList.add('fade-out');
      }, 760);
      schedule(function () {
        launchTitleToCenter();
      }, 820);
    });

    window.addEventListener('resize', function () {
      if (overlay.getAttribute('aria-hidden') === 'true') return;
      positionFilterRow();
      const useOffsets = getDeployOffsets();
      if (!state.hasTransferredFilter) {
        filterPrompt.classList.remove('is-active');
      }
      filterButtons.forEach(function (button, index) {
        button.style.setProperty('--deploy-x', useOffsets[index] + 'px');
      });
    });

    overlay.__resetMusicNexusSequence = resetSequence;
    overlay.dataset.v14Bound = '1';
    resetSequence();
  }

  function setOriginFromTrigger(trigger) {
    if (!trigger) return;
    const triggerRect = trigger.getBoundingClientRect();
    const hostRect = host.getBoundingClientRect();
    const x = Math.max(0, Math.min(hostRect.width, triggerRect.left + (triggerRect.width / 2) - hostRect.left));
    const y = Math.max(0, Math.min(hostRect.height, triggerRect.top + (triggerRect.height / 2) - hostRect.top));
    const overlay = ensureMusicOverlay();
    overlay.style.setProperty('--music-origin-x', `${x}px`);
    overlay.style.setProperty('--music-origin-y', `${y}px`);
  }

  function armTrigger(trigger) {
    if (lastTrigger && lastTrigger !== trigger) {
      lastTrigger.classList.remove('is-music-click-armed');
    }
    lastTrigger = trigger;
    if (trigger && trigger.classList) {
      trigger.classList.remove('is-music-click-armed');
      void trigger.offsetWidth;
      trigger.classList.add('is-music-click-armed');
    }
  }

  function openMusicOverlay(trigger, options = {}) {
    const routeMode = options.routeMode || 'pushState';
    if (overlayPhase !== 'idle') return;
    const overlay = ensureMusicOverlay();
    clearOverlayTimers();
    syncTestingRoute(MUSIC_ROUTE, routeMode, { deferHistory: true });
    lockMusicFootprint();
    armTrigger(trigger);
    setOriginFromTrigger(trigger);
    if (typeof overlay.__resetMusicNexusSequence === 'function') {
      overlay.__resetMusicNexusSequence();
    }
    overlay.classList.remove('is-closing');
    overlay.classList.add('is-mounted');
    overlayPhase = 'portfolio-exiting';
    libraryOverlay.classList.add('is-music-branch-transitioning');
    void overlay.offsetWidth;
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        overlay.classList.add('is-visible');
        overlay.setAttribute('aria-hidden', 'false');
        overlayPhase = 'music-nexus-entering';
        scheduleOverlayStep(function () {
          libraryOverlay.classList.add('is-music-branch-open');
          libraryOverlay.classList.remove('is-music-branch-transitioning');
          overlayPhase = 'music-nexus-active';
          syncTestingRoute(MUSIC_ROUTE, routeMode);
          releaseMusicFootprint(220);
        }, 620);
      });
    });
  }

  function closeMusicOverlay(options = {}) {
    const routeMode = options.routeMode || 'pushState';
    if (!musicOverlay || overlayPhase === 'idle') return;
    clearOverlayTimers();
    syncTestingRoute(PORTFOLIO_ROUTE, routeMode, { deferHistory: true });
    lockMusicFootprint();
    overlayPhase = 'closing';
    libraryOverlay.classList.remove('is-music-branch-open');
    libraryOverlay.classList.remove('is-music-branch-transitioning');
    musicOverlay.classList.remove('is-visible');
    musicOverlay.classList.add('is-closing');
    musicOverlay.setAttribute('aria-hidden', 'true');
    if (lastTrigger) {
      lastTrigger.classList.remove('is-music-click-armed');
    }
    scheduleOverlayStep(function () {
      if (!musicOverlay) return;
      musicOverlay.classList.remove('is-mounted', 'is-closing');
      if (typeof musicOverlay.__resetMusicNexusSequence === 'function') {
        musicOverlay.__resetMusicNexusSequence();
      }
      overlayPhase = 'idle';
      syncTestingRoute(PORTFOLIO_ROUTE, routeMode);
      releaseMusicFootprint(120);
    }, 220);
  }

  function syncOverlayToTestingRoute() {
    const pathname = getShellPathname();
    const wantsMusic = pathname === MUSIC_ROUTE;
    const wantsPortfolio = pathname === PORTFOLIO_ROUTE;
    const libraryIsOpen =
      libraryOverlay.classList.contains('is-expanded') ||
      libraryOverlay.classList.contains('is-visible') ||
      libraryOverlay.classList.contains('is-content-visible');

    if (wantsMusic) {
      if (libraryIsOpen && !libraryOverlay.classList.contains('is-music-branch-open') && overlayPhase === 'idle') {
        openMusicOverlay(
          libraryOverlay.querySelector('.mockup-library-entry-card.is-music-active')
            || libraryOverlay.querySelector('.mockup-library-scope-card.is-primary')
            || libraryOverlay.querySelector('.mockup-library-status-node.is-music-card'),
          { routeMode: 'replaceState' }
        );
      }
      return;
    }

    if (wantsPortfolio && libraryOverlay.classList.contains('is-music-branch-open')) {
      closeMusicOverlay({ routeMode: 'replaceState' });
    }
  }

  libraryOverlay.addEventListener('click', function (event) {
    const trigger = event.target.closest(musicSelectors);
    if (!trigger || !libraryOverlay.contains(trigger)) return;
    if (!libraryOverlay.classList.contains('is-expanded') && !libraryOverlay.classList.contains('is-visible')) return;
    event.preventDefault();
    event.stopPropagation();
    if (libraryOverlay.classList.contains('is-music-branch-open')) {
      closeMusicOverlay();
      return;
    }
    openMusicOverlay(trigger);
  }, true);

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && libraryOverlay.classList.contains('is-music-branch-open')) {
      closeMusicOverlay();
    }
  });

  window.addEventListener('popstate', function () {
    window.requestAnimationFrame(syncOverlayToTestingRoute);
  });

  window.addEventListener('message', function (event) {
    const data = event && event.data;
    if (!data || data.type !== 'vmTestingRouteSync') return;
    localRoutePath = data.route || '';
    window.requestAnimationFrame(syncOverlayToTestingRoute);
  });

  window.setTimeout(syncOverlayToTestingRoute, 0);
  window.setTimeout(syncOverlayToTestingRoute, 960);
})();
