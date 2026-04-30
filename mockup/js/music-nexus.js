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
  let deferredRoutePath = '';
  let releaseFootprintTimer = 0;
  let lockedFootprintHeight = '';
  const SHOWS_ROLODEX_ENDPOINT = 'https://music-archive-3lfa.onrender.com/show-index.json';
  const SHOWS_ROLODEX_CACHE_KEY = 'vm_testing_music_shows_rolodex_v1';
  const SHOWS_ROLODEX_TTL_MS = 1000 * 60 * 30;
  let showsRolodexRowsCache = null;
  let showsRolodexLoadPromise = null;

  function escapeRolodexHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }

  function escapeRolodexAttr(value) {
    return escapeRolodexHtml(value).replace(/`/g, '&#96;');
  }

  function readRolodexField(row, keys) {
    const source = row && typeof row === 'object' ? row : {};
    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i];
      const value = source[key];
      if (value == null) continue;
      const text = String(value).trim();
      if (text) return text;
    }
    return '';
  }

  function decodeRolodexText(value) {
    let text = String(value == null ? '' : value).trim();
    if (!text) return '';
    for (let i = 0; i < 3; i += 1) {
      const next = text
        .replace(/&amp;/gi, '&')
        .replace(/&apos;|&#0*39;|&#x0*27;/gi, "'")
        .replace(/&quot;|&#0*34;|&#x0*22;/gi, '"')
        .replace(/&lsquo;|&rsquo;/gi, "'")
        .replace(/&ldquo;|&rdquo;/gi, '"');
      if (next === text) break;
      text = next;
    }
    return text.replace(/[\u2018\u2019\u201B\u2032`]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/\s+/g, ' ').trim();
  }

  function parseRolodexCsvLine(line) {
    const out = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        out.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    out.push(cur.trim());
    return out;
  }

  function parseRolodexRows(text, contentType) {
    const raw = String(text || '').trim();
    if (!raw) return [];
    if (String(contentType || '').toLowerCase().includes('json') || /^[\[{]/.test(raw)) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
        if (Array.isArray(parsed && parsed.shows)) return parsed.shows;
        if (Array.isArray(parsed && parsed.rows)) return parsed.rows;
      } catch (_) {}
    }

    const lines = raw.split(/\r?\n/).filter(function (line) { return line.trim(); });
    const header = parseRolodexCsvLine(lines.shift() || '').map(function (h) { return h.toLowerCase(); });
    if (!header.length) return [];
    return lines.map(function (line) {
      const cols = parseRolodexCsvLine(line);
      const row = {};
      header.forEach(function (key, index) {
        if (key) row[key] = cols[index] || '';
      });
      return row;
    });
  }

  function getRolodexDateValue(raw) {
    const text = String(raw || '').replace(/\b(\d{1,2})(st|nd|rd|th)\b/gi, '$1').trim();
    if (!text) return 0;
    const parsed = Date.parse(text);
    if (Number.isFinite(parsed)) return parsed;
    const match = text.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/);
    if (!match) return 0;
    let year = Number(match[3]);
    if (year < 100) year = year >= 70 ? 1900 + year : 2000 + year;
    const date = new Date(year, Number(match[1]) - 1, Number(match[2])).getTime();
    return Number.isFinite(date) ? date : 0;
  }

  function getRolodexYear(raw) {
    const text = String(raw || '').trim();
    const explicit = text.match(/\b(19\d{2}|20\d{2})\b/);
    if (explicit) return Number(explicit[1]);
    const match = text.match(/\b\d{1,2}[\/\-.]\d{1,2}[\/\-.](\d{2})\b/);
    if (!match) return null;
    const year = Number(match[1]);
    return Number.isFinite(year) ? (year >= 70 ? 1900 + year : 2000 + year) : null;
  }

  function normalizeRolodexShow(row) {
    const source = row && typeof row === 'object' ? row : {};
    const rawDate = readRolodexField(source, ['pretty_date', 'show_date', 'date', 'Date']);
    const title = decodeRolodexText(readRolodexField(source, ['show_name', 'show', 'title', 'event', 'event_name', 'name'])) || rawDate || 'Untitled Show';
    const venue = decodeRolodexText(readRolodexField(source, ['show_venue', 'venue', 'Venue'])) || 'Venue TBA';
    const city = decodeRolodexText(readRolodexField(source, ['show_city', 'city', 'City']));
    const state = decodeRolodexText(readRolodexField(source, ['show_state', 'state', 'State']));
    const location = [city, state].filter(Boolean).join(', ') || 'Location TBA';
    const bands = [];
    for (let i = 1; i <= 20; i += 1) {
      const band = decodeRolodexText(readRolodexField(source, ['band_' + i, 'band' + i]));
      if (band) bands.push(band);
    }
    return {
      date: decodeRolodexText(rawDate),
      rawDate: rawDate,
      title: title,
      venue: venue,
      location: location,
      bands: bands,
      count: bands.length,
      poster: readRolodexField(source, ['poster_url', 'show_poster', 'poster', 'image', 'image_url', 'show_url']),
      sortValue: getRolodexDateValue(rawDate)
    };
  }

  async function fetchShowsRolodexRows() {
    if (Array.isArray(showsRolodexRowsCache)) return showsRolodexRowsCache;
    if (showsRolodexLoadPromise) return showsRolodexLoadPromise;

    showsRolodexLoadPromise = (async function () {
      try {
        const cached = sessionStorage.getItem(SHOWS_ROLODEX_CACHE_KEY);
        if (cached) {
          const payload = JSON.parse(cached);
          if (payload && Array.isArray(payload.rows) && Date.now() - Number(payload.t || 0) < SHOWS_ROLODEX_TTL_MS) {
            showsRolodexRowsCache = payload.rows;
            return showsRolodexRowsCache;
          }
        }
      } catch (_) {}

      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timeout = controller ? window.setTimeout(function () {
        try { controller.abort(); } catch (_) {}
      }, 25000) : 0;
      try {
        const response = await fetch(SHOWS_ROLODEX_ENDPOINT, {
          cache: 'no-store',
          signal: controller ? controller.signal : undefined
        });
        if (!response.ok) throw new Error('Shows endpoint returned HTTP ' + response.status);
        const contentType = response.headers ? String(response.headers.get('content-type') || '') : '';
        const text = await response.text();
        const rows = parseRolodexRows(text, contentType);
        showsRolodexRowsCache = rows;
        try {
          sessionStorage.setItem(SHOWS_ROLODEX_CACHE_KEY, JSON.stringify({ t: Date.now(), rows: rows }));
        } catch (_) {}
        return rows;
      } finally {
        if (timeout) window.clearTimeout(timeout);
        showsRolodexLoadPromise = null;
      }
    })();

    return showsRolodexLoadPromise;
  }

  function groupRolodexShows(rows) {
    const grouped = {};
    (Array.isArray(rows) ? rows : []).forEach(function (row) {
      const show = normalizeRolodexShow(row);
      const year = getRolodexYear(show.rawDate || show.date);
      if (!Number.isFinite(year)) return;
      if (!grouped[year]) grouped[year] = [];
      grouped[year].push(show);
    });
    Object.keys(grouped).forEach(function (year) {
      grouped[year].sort(function (a, b) {
        if (b.sortValue !== a.sortValue) return b.sortValue - a.sortValue;
        return String(a.title).localeCompare(String(b.title));
      });
    });
    return grouped;
  }

  function renderShowsRolodexYears(root) {
    const state = root.__showsRolodexState;
    const yearsEl = root.querySelector('[data-shows-rolodex-years]');
    if (!state || !yearsEl) return;
    yearsEl.innerHTML = state.years.map(function (year) {
      const active = String(year) === String(state.year);
      return '<button class="shows-rolodex-year' + (active ? ' is-active' : '') + '" type="button" data-shows-year="' + escapeRolodexAttr(year) + '" aria-pressed="' + (active ? 'true' : 'false') + '">' + escapeRolodexHtml(year) + '</button>';
    }).join('');
    const activeBtn = yearsEl.querySelector('.shows-rolodex-year.is-active');
    if (activeBtn) {
      try { activeBtn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' }); } catch (_) {}
    }
  }

  function fitShowsRolodexTitle(card) {
    const title = card && card.querySelector('.shows-rolodex-title');
    const wrap = card && card.querySelector('.shows-rolodex-title-wrap');
    if (!title || !wrap) return;
    title.style.transform = 'scale(1)';
    title.style.setProperty('--shows-title-spacing', '.04em');
    const available = Math.max(1, wrap.clientWidth - 20);
    const natural = Math.max(1, title.scrollWidth);
    if (natural > available) {
      const scale = Math.max(0.34, Math.min(1, available / natural));
      title.style.transform = 'scale(' + scale.toFixed(3) + ')';
      if (scale < 0.58) title.style.setProperty('--shows-title-spacing', '.015em');
    }
  }

  function fitShowsRolodexTitles(root) {
    if (!root) return;
    window.requestAnimationFrame(function () {
      Array.from(root.querySelectorAll('.shows-rolodex-card')).forEach(fitShowsRolodexTitle);
    });
  }

  function renderShowsRolodexDeck(root) {
    const state = root.__showsRolodexState;
    const deck = root.querySelector('[data-shows-rolodex-deck]');
    if (!state || !deck) return;
    const shows = state.grouped[String(state.year)] || [];
    if (!shows.length) {
      deck.innerHTML = '<article class="shows-rolodex-card is-active"><div class="shows-rolodex-date">' + escapeRolodexHtml(state.year || 'Shows') + '</div><div class="shows-rolodex-title-wrap"><div class="shows-rolodex-title">No Shows Loaded</div></div><div class="shows-rolodex-title-mark"></div><div class="shows-rolodex-poster" aria-hidden="true"></div><div class="shows-rolodex-meta">Live shows will appear here when data is available.</div></article>';
      return;
    }
    state.index = ((state.index % shows.length) + shows.length) % shows.length;
    deck.innerHTML = shows.map(function (show, index) {
      const active = index === state.index;
      const prev = shows.length > 2 && index === ((state.index - 1 + shows.length) % shows.length);
      const next = shows.length > 1 && index === ((state.index + 1) % shows.length);
      const cardClass = active ? ' is-active' : (prev ? ' is-prev' : (next ? ' is-next' : ' is-hidden'));
      const poster = show.poster ? ' style="--shows-poster-img:url(\'' + escapeRolodexAttr(show.poster) + '\')"' : '';
      const bandText = show.count ? show.count + ' bands logged' : 'Lineup TBA';
      return '' +
        '<article class="shows-rolodex-card' + cardClass + '" data-show-index="' + index + '">' +
          '<div class="shows-rolodex-date"><span>' + escapeRolodexHtml(show.date || show.rawDate || 'Date TBA') + '</span></div>' +
          '<div class="shows-rolodex-title-wrap"><div class="shows-rolodex-title" title="' + escapeRolodexAttr(show.title) + '">' + escapeRolodexHtml(show.title) + '</div></div>' +
          '<div class="shows-rolodex-title-mark" aria-hidden="true"></div>' +
          '<div class="shows-rolodex-poster' + (show.poster ? ' has-poster' : '') + '"' + poster + ' aria-label="Show poster visual"></div>' +
          '<div class="shows-rolodex-location" title="' + escapeRolodexAttr(show.venue + ' - ' + show.location) + '">' +
            '<span class="shows-rolodex-pin" aria-hidden="true"></span>' +
            '<span class="shows-rolodex-location-text">' +
              '<span class="shows-rolodex-venue">' + escapeRolodexHtml(show.venue) + '</span>' +
              '<span class="shows-rolodex-location-sep" aria-hidden="true"></span>' +
              '<span class="shows-rolodex-city">' + escapeRolodexHtml(show.location) + '</span>' +
            '</span>' +
          '</div>' +
          '<div class="shows-rolodex-supporting" aria-hidden="true">' + escapeRolodexHtml(bandText) + '</div>' +
        '</article>';
    }).join('');
    deck.classList.toggle('has-single-show', shows.length <= 1);
    fitShowsRolodexTitles(root);
  }

  function pulseShowsRolodex(root, className, duration) {
    if (!root) return;
    root.classList.remove(className);
    void root.offsetWidth;
    root.classList.add(className);
    window.clearTimeout(root['__' + className]);
    root['__' + className] = window.setTimeout(function () {
      root.classList.remove(className);
    }, duration || 520);
  }

  function setShowsRolodexYear(root, year) {
    const state = root && root.__showsRolodexState;
    if (!state || !state.grouped[String(year)]) return;
    if (String(state.year) === String(year)) return;
    const oldYear = Number(state.year);
    const nextYear = Number(year);
    root.style.setProperty('--shows-deck-dir', Number.isFinite(oldYear) && Number.isFinite(nextYear) && nextYear < oldYear ? '1' : '-1');
    state.year = String(year);
    state.index = 0;
    renderShowsRolodexYears(root);
    pulseShowsRolodex(root, 'is-year-changing', 560);
    window.setTimeout(function () {
      renderShowsRolodexDeck(root);
    }, 130);
  }

  function moveShowsRolodex(root, delta) {
    const state = root && root.__showsRolodexState;
    if (!state) return;
    const shows = state.grouped[String(state.year)] || [];
    if (!shows.length) return;
    state.index += delta;
    root.classList.toggle('is-nav-prev', delta < 0);
    root.classList.toggle('is-nav-next', delta > 0);
    renderShowsRolodexDeck(root);
    pulseShowsRolodex(root, 'is-card-shuttering', 620);
    window.setTimeout(function () {
      root.classList.remove('is-nav-prev', 'is-nav-next');
    }, 640);
  }

  function initShowsRolodex(dashboard) {
    const root = dashboard && dashboard.querySelector('[data-shows-rolodex]');
    if (!root) return;
    if (root.dataset.bound === '1') {
      fitShowsRolodexTitles(root);
      return;
    }

    const deck = root.querySelector('[data-shows-rolodex-deck]');
    const yearsEl = root.querySelector('[data-shows-rolodex-years]');
    root.__showsRolodexState = { grouped: {}, years: [], year: '', index: 0 };
    if (deck) {
      deck.innerHTML = '<article class="shows-rolodex-card is-active"><div class="shows-rolodex-date">Loading</div><div class="shows-rolodex-title-wrap"><div class="shows-rolodex-title">Shows Loading</div></div><div class="shows-rolodex-title-mark"></div><div class="shows-rolodex-poster" aria-hidden="true"></div><div class="shows-rolodex-meta">Loading live show data.</div></article>';
    }
    if (yearsEl) {
      yearsEl.innerHTML = '<button class="shows-rolodex-year is-active" type="button" disabled>Loading</button>';
    }

    root.addEventListener('click', function (event) {
      const yearBtn = event.target.closest('[data-shows-year]');
      if (yearBtn && root.contains(yearBtn)) {
        setShowsRolodexYear(root, yearBtn.getAttribute('data-shows-year'));
        return;
      }
      if (event.target.closest('[data-shows-nav="prev"]')) {
        moveShowsRolodex(root, -1);
        return;
      }
      if (event.target.closest('[data-shows-nav="next"]')) {
        moveShowsRolodex(root, 1);
      }
    });
    root.__showsRolodexResize = function () {
      fitShowsRolodexTitles(root);
    };
    window.addEventListener('resize', root.__showsRolodexResize, { passive: true });
    if (window.visualViewport) window.visualViewport.addEventListener('resize', root.__showsRolodexResize, { passive: true });

    fetchShowsRolodexRows().then(function (rows) {
      const grouped = groupRolodexShows(rows);
      const years = Object.keys(grouped).sort(function (a, b) { return Number(b) - Number(a); });
      const state = root.__showsRolodexState;
      state.grouped = grouped;
      state.years = years;
      state.year = years[0] || '';
      state.index = 0;
      root.classList.toggle('is-empty', !years.length);
      renderShowsRolodexYears(root);
      renderShowsRolodexDeck(root);
    }).catch(function (error) {
      root.classList.add('is-empty');
      if (yearsEl) yearsEl.innerHTML = '<button class="shows-rolodex-year is-active" type="button" disabled>Offline</button>';
      if (deck) {
        deck.innerHTML = '<article class="shows-rolodex-card is-active"><div class="shows-rolodex-date">Shows</div><div class="shows-rolodex-title-wrap"><div class="shows-rolodex-title">Data Unavailable</div></div><div class="shows-rolodex-title-mark"></div><div class="shows-rolodex-poster" aria-hidden="true"></div><div class="shows-rolodex-meta">Live show data could not be loaded.</div></article>';
      }
      try { console.warn('[testing music shows] rolodex data unavailable', error); } catch (_) {}
    });

    root.dataset.bound = '1';
  }

  function installShowsRolodexMarkup(dashboard) {
    const pane = dashboard && dashboard.querySelector('[data-dashboard-pane="shows"]');
    if (pane && pane.dataset.rolodexInstalled !== '1') {
      pane.innerHTML = '' +
        '<div class="shows-rolodex" data-shows-rolodex aria-label="Shows rolodex">' +
          '<section class="shows-rolodex-years" aria-label="Show years">' +
            '<div class="shows-rolodex-year-grid" data-shows-rolodex-years role="tablist" aria-label="Select show year"></div>' +
          '</section>' +
          '<section class="shows-rolodex-carousel" aria-label="Shows carousel">' +
            '<button class="shows-rolodex-nav shows-rolodex-prev" type="button" data-shows-nav="prev" aria-label="Previous show">&lsaquo;</button>' +
            '<div class="shows-rolodex-swap-flash" aria-hidden="true"></div>' +
            '<div class="shows-rolodex-deck" data-shows-rolodex-deck></div>' +
            '<button class="shows-rolodex-nav shows-rolodex-next" type="button" data-shows-nav="next" aria-label="Next show">&rsaquo;</button>' +
          '</section>' +
        '</div>';
      pane.dataset.rolodexInstalled = '1';
    }

    const sidePane = dashboard && dashboard.querySelector('[data-dashboard-side-pane="shows"]');
    if (sidePane && sidePane.dataset.rolodexCleared !== '1') {
      sidePane.innerHTML = '';
      sidePane.dataset.rolodexCleared = '1';
      sidePane.setAttribute('aria-hidden', 'true');
    }
  }

  function getMusicDashboardMarkup() {
    return `
      <section class="mockup-music-dashboard" aria-hidden="true" data-dashboard-state="hidden" data-active-mode="bands">
        <div class="mockup-music-dashboard-shell">
          <header class="mockup-music-dashboard-topbar">
            <div class="top-left">
              <div class="eyebrow nexus-eyebrow" data-dashboard-title data-text="The Music Nexus">The Music Nexus</div>
            </div>
            <div class="top-stats">
              <div class="stat">Total Bands:<strong>12</strong></div>
              <div class="stat">Active:<strong>12</strong></div>
            </div>
          </header>

          <div class="mockup-music-dashboard-modebar">
            <div class="section-kicker">View Mode</div>
            <div class="mode-smartmenu" aria-label="Archive mode selector">
              <div class="mode-smartmenu-track" aria-hidden="true"></div>
              <button aria-pressed="true" class="mode-smartcard mode-smartcard-bands active" data-dashboard-mode="bands" type="button">
                <span class="mode-smart-label">Bands</span>
              </button>
              <button aria-pressed="false" class="mode-smartcard mode-smartcard-muted" data-dashboard-mode="shows" type="button">
                <span class="mode-smart-label">Shows</span>
              </button>
              <button aria-pressed="false" class="mode-smartcard mode-smartcard-muted" data-dashboard-mode="people" type="button">
                <span class="mode-smart-label">People</span>
              </button>
            </div>
          </div>

          <div class="mockup-music-dashboard-content">
            <section class="center-panel">
              <div class="mode-pane mode-pane-bands is-visible" data-dashboard-pane="bands">
                <div class="radar">
                  <div class="sweep"></div>
                  <div class="radar-orbit orbit-1"></div>
                  <div class="radar-orbit orbit-2"></div>
                  <div class="radar-orbit orbit-3"></div>
                  <div class="radar-spark radar-spark-1"></div>
                  <div class="radar-spark radar-spark-2"></div>
                  <div class="radar-spark radar-spark-3"></div>
                  <div class="radar-scanline radar-scanline-1"></div>
                  <div class="radar-scanline radar-scanline-2"></div>
                  <div class="axis"></div>
                  <div class="axis2"></div>
                  <div class="axis3"></div>
                  <div class="radar-guide-ring guide-outer"></div>
                  <div class="radar-guide-ring guide-mid"></div>
                  <div class="radar-guide-ring guide-inner"></div>
                  <div class="radar-spoke spoke-1"></div>
                  <div class="radar-spoke spoke-2"></div>
                  <div class="radar-spoke spoke-3"></div>
                  <div class="radar-spoke spoke-4"></div>
                  <div class="radar-structure-ring sr-1"></div>
                  <div class="radar-structure-ring sr-2"></div>
                  <div class="radar-structure-ring sr-3"></div>
                  <div class="radar-structure-ring sr-4"></div>
                  <div class="radar-structure-spoke rs-1"></div>
                  <div class="radar-structure-spoke rs-2"></div>
                  <div class="radar-structure-spoke rs-3"></div>
                  <div class="radar-structure-spoke rs-4"></div>
                  <div class="radar-structure-microspoke rms-1"></div>
                  <div class="radar-structure-microspoke rms-2"></div>
                  <div class="radar-structure-microspoke rms-3"></div>
                  <div class="radar-structure-microspoke rms-4"></div>
                  <div class="radar-structure-microspoke rms-5"></div>
                  <div class="radar-structure-microspoke rms-6"></div>
                  <div class="radar-structure-microspoke rms-7"></div>
                  <div class="radar-structure-microspoke rms-8"></div>
                  <div class="radar-structure-tick-ring tr-outer"></div>
                  <div class="radar-structure-tick-ring tr-mid"></div>
                  <div class="radar-structure-core-shell"></div>
                  <div class="radar-fine-ring fr-1"></div>
                  <div class="radar-fine-ring fr-2"></div>
                  <div class="radar-fine-ring fr-3"></div>
                  <div class="radar-inner-tick-ring"></div>
                  <div class="radar-quadrant-mark qm-1"></div>
                  <div class="radar-quadrant-mark qm-2"></div>
                  <div class="radar-target-bracket tb-1"></div>
                  <div class="radar-target-bracket tb-2"></div>
                  <div class="radar-core-reticle"></div>
                  <div class="ring r1"></div>
                  <div class="ring r2"></div>
                  <div class="ring r3"></div>
                  <div class="ring r4"></div>
                  <div class="ring r5"></div>
                  <div class="ring-ghost g1"></div>
                  <div class="ring-ghost g2"></div>
                  <div class="core">
                    <div class="big">C</div>
                    <div class="small">2 Bands</div>
                  </div>
                  <div class="radar-letter-ring" data-dashboard-radar-letter-ring></div>
                  <div class="radar-node-ring" data-dashboard-radar-node-ring></div>
                </div>
              </div>

              <div class="mode-pane mode-pane-shows" data-dashboard-pane="shows">
                <div class="shows-stage shows-stage-premium">
                  <div class="shows-stage-header">
                    <div class="shows-stage-kicker">Shows Timeline</div>
                    <div class="shows-stage-title">Signal Rail Archive</div>
                    <div class="shows-stage-subline">Chronology feed · lock a show to route its archive detail on the right</div>
                  </div>
                  <div class="shows-timeline-shroud"></div>
                  <div class="shows-timeline" role="list">
                    <span class="shows-year is-2024">2024</span>
                    <span class="shows-year is-2023">2023</span>
                    <span class="shows-year is-2022">2022</span>

                    <button class="shows-timeline-item is-active" data-dashboard-show="warehouse" type="button">
                      <span class="shows-timeline-node"></span>
                      <span class="shows-timeline-date">Nov <strong>08</strong></span>
                      <span class="shows-timeline-name">Warehouse Live</span>
                      <span class="shows-timeline-meta">Houston, TX · Headline Night · 42 photos</span>
                      <span class="shows-timeline-badge">Prime</span>
                    </button>
                    <button class="shows-timeline-item" data-dashboard-show="deep-elm" type="button">
                      <span class="shows-timeline-node is-cyan"></span>
                      <span class="shows-timeline-date">Sep <strong>21</strong></span>
                      <span class="shows-timeline-name">Deep Ellum Art Co.</span>
                      <span class="shows-timeline-meta">Dallas, TX · Regional Pull · 31 photos</span>
                      <span class="shows-timeline-badge">Live</span>
                    </button>
                    <button class="shows-timeline-item" data-dashboard-show="mohawk" type="button">
                      <span class="shows-timeline-node is-amber"></span>
                      <span class="shows-timeline-date">Jul <strong>13</strong></span>
                      <span class="shows-timeline-name">The Mohawk</span>
                      <span class="shows-timeline-meta">Austin, TX · Outdoor Set · 27 photos</span>
                      <span class="shows-timeline-badge">Field</span>
                    </button>
                    <button class="shows-timeline-item" data-dashboard-show="barracuda" type="button">
                      <span class="shows-timeline-node"></span>
                      <span class="shows-timeline-date">Mar <strong>10</strong></span>
                      <span class="shows-timeline-name">Barracuda</span>
                      <span class="shows-timeline-meta">Austin, TX · Club Night · 18 photos</span>
                      <span class="shows-timeline-badge">Club</span>
                    </button>
                    <button class="shows-timeline-item" data-dashboard-show="southside" type="button">
                      <span class="shows-timeline-node is-cyan"></span>
                      <span class="shows-timeline-date">Nov <strong>04</strong></span>
                      <span class="shows-timeline-name">South Side Ballroom</span>
                      <span class="shows-timeline-meta">Dallas, TX · Touring Package · 35 photos</span>
                      <span class="shows-timeline-badge">Tour</span>
                    </button>
                    <button class="shows-timeline-item" data-dashboard-show="masquerade" type="button">
                      <span class="shows-timeline-node is-amber"></span>
                      <span class="shows-timeline-date">Dec <strong>09</strong></span>
                      <span class="shows-timeline-name">The Masquerade</span>
                      <span class="shows-timeline-meta">Atlanta, GA · Full Night Capture · 27 photos</span>
                      <span class="shows-timeline-badge">Vault</span>
                    </button>
                  </div>
                </div>
              </div>

              <div class="mode-pane mode-pane-people" data-dashboard-pane="people">
                <div class="people-stage">
                  <div class="people-stage-header">
                    <div class="people-stage-kicker">People Archive</div>
                    <div class="people-stage-title">Signal Roster Archive</div>
                    <div class="people-stage-subline">Lock a person node to route their archive profile on the right</div>
                  </div>
                  <div class="people-grid" role="list">
                    <button class="people-card is-active" data-dashboard-person="joe" type="button">
                      <span class="people-card-avatar"></span>
                      <span class="people-card-name">Joe Smith</span>
                      <span class="people-card-role">Photographer</span>
                      <span class="people-card-count">82 shows logged</span>
                      <span class="people-card-rail" aria-hidden="true"></span>
                    </button>
                    <button class="people-card" data-dashboard-person="alex" type="button">
                      <span class="people-card-avatar is-cyan"></span>
                      <span class="people-card-name">Alex Rodriguez</span>
                      <span class="people-card-role">Photographer</span>
                      <span class="people-card-count">64 shows logged</span>
                      <span class="people-card-rail" aria-hidden="true"></span>
                    </button>
                    <button class="people-card" data-dashboard-person="mike" type="button">
                      <span class="people-card-avatar is-amber"></span>
                      <span class="people-card-name">Mike Davis</span>
                      <span class="people-card-role">Musician</span>
                      <span class="people-card-count">19 bands linked</span>
                      <span class="people-card-rail" aria-hidden="true"></span>
                    </button>
                    <button class="people-card" data-dashboard-person="sara" type="button">
                      <span class="people-card-avatar is-violet"></span>
                      <span class="people-card-name">Sara Kane</span>
                      <span class="people-card-role">Promoter</span>
                      <span class="people-card-count">47 shows routed</span>
                      <span class="people-card-rail" aria-hidden="true"></span>
                    </button>
                    <button class="people-card" data-dashboard-person="taylor" type="button">
                      <span class="people-card-avatar is-green"></span>
                      <span class="people-card-name">Taylor James</span>
                      <span class="people-card-role">Promoter</span>
                      <span class="people-card-count">36 show notes</span>
                      <span class="people-card-rail" aria-hidden="true"></span>
                    </button>
                    <button class="people-card" data-dashboard-person="lindsay" type="button">
                      <span class="people-card-avatar"></span>
                      <span class="people-card-name">Lindsay W.</span>
                      <span class="people-card-role">Photographer</span>
                      <span class="people-card-count">29 archive pulls</span>
                      <span class="people-card-rail" aria-hidden="true"></span>
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <aside class="right-panel">
              <div class="mode-pane mode-pane-bands is-visible" data-dashboard-side-pane="bands">
                <h2>Letter C</h2>
                <div class="subcount">2 Bands</div>
                <div class="card active">
                  <div class="avatar"></div>
                  <div class="card-meta">
                    <div class="card-name">Chaos Machine</div>
                    <div class="card-sub">2/8</div>
                  </div>
                </div>
                <div class="card">
                  <div class="avatar dark"></div>
                  <div class="card-meta">
                    <div class="card-name">Conscious Cadaver</div>
                    <div class="card-sub">Archive Node</div>
                  </div>
                </div>
                <div class="right-spacer"></div>
                <div class="explore">
                  <span>Explore C</span>
                  <span>›</span>
                </div>
              </div>

              <div class="mode-pane mode-pane-people" data-dashboard-side-pane="people">
                <div class="people-detail is-visible" data-dashboard-person-detail="joe">
                  <div class="people-detail-ring"></div>
                  <div class="people-detail-avatar"></div>
                  <h2>Joe Smith</h2>
                  <div class="subcount">Photographer</div>
                  <div class="people-detail-meta">
                    <div><span>First Seen</span><strong>04.12.2016</strong></div>
                    <div><span>Total Shows</span><strong>82</strong></div>
                    <div><span>Total Bands</span><strong>34</strong></div>
                    <div><span>Location</span><strong>Houston, TX</strong></div>
                  </div>
                  <div class="people-detail-focus">
                    <span>Current Focus</span>
                    <div class="people-detail-chiprow">
                      <b class="people-detail-chip">Photo Pit</b>
                      <b class="people-detail-chip">Touring</b>
                      <b class="people-detail-chip">Archive Lead</b>
                    </div>
                  </div>
                  <div class="people-detail-list">
                    <div class="people-detail-row"><span>Recent Show</span><strong>Warehouse Live</strong></div>
                    <div class="people-detail-row"><span>Linked Band</span><strong>Chaos Machine</strong></div>
                    <div class="people-detail-row"><span>Archive Route</span><strong>Houston / Touring / 2024</strong></div>
                  </div>
                </div>
                <div class="people-detail" data-dashboard-person-detail="alex">
                  <div class="people-detail-ring"></div>
                  <div class="people-detail-avatar is-cyan"></div>
                  <h2>Alex Rodriguez</h2>
                  <div class="subcount">Photographer</div>
                  <div class="people-detail-meta">
                    <div><span>First Seen</span><strong>06.21.2017</strong></div>
                    <div><span>Total Shows</span><strong>64</strong></div>
                    <div><span>Total Bands</span><strong>28</strong></div>
                    <div><span>Location</span><strong>Portland, ME</strong></div>
                  </div>
                  <div class="people-detail-focus">
                    <span>Current Focus</span>
                    <div class="people-detail-chiprow">
                      <b class="people-detail-chip">Documentary</b>
                      <b class="people-detail-chip">East Coast</b>
                    </div>
                  </div>
                  <div class="people-detail-list">
                    <div class="people-detail-row"><span>Recent Show</span><strong>State Theatre</strong></div>
                    <div class="people-detail-row"><span>Linked Band</span><strong>Signal Fires</strong></div>
                    <div class="people-detail-row"><span>Archive Route</span><strong>Portland / Documentary / 2024</strong></div>
                  </div>
                </div>
                <div class="people-detail" data-dashboard-person-detail="mike">
                  <div class="people-detail-ring"></div>
                  <div class="people-detail-avatar is-amber"></div>
                  <h2>Mike Davis</h2>
                  <div class="subcount">Musician</div>
                  <div class="people-detail-meta">
                    <div><span>First Seen</span><strong>05.07.2017</strong></div>
                    <div><span>Total Shows</span><strong>63</strong></div>
                    <div><span>Total Bands</span><strong>19</strong></div>
                    <div><span>Location</span><strong>Austin, TX</strong></div>
                  </div>
                  <div class="people-detail-focus">
                    <span>Current Focus</span>
                    <div class="people-detail-chiprow">
                      <b class="people-detail-chip">Performer</b>
                      <b class="people-detail-chip">Texas</b>
                    </div>
                  </div>
                  <div class="people-detail-list">
                    <div class="people-detail-row"><span>Recent Show</span><strong>The Mohawk</strong></div>
                    <div class="people-detail-row"><span>Linked Band</span><strong>Current Route</strong></div>
                    <div class="people-detail-row"><span>Archive Route</span><strong>Austin / Performer / 2024</strong></div>
                  </div>
                </div>
                <div class="people-detail" data-dashboard-person-detail="sara">
                  <div class="people-detail-ring"></div>
                  <div class="people-detail-avatar is-violet"></div>
                  <h2>Sara Kane</h2>
                  <div class="subcount">Promoter</div>
                  <div class="people-detail-meta">
                    <div><span>First Seen</span><strong>03.11.2017</strong></div>
                    <div><span>Total Shows</span><strong>47</strong></div>
                    <div><span>Total Bands</span><strong>18</strong></div>
                    <div><span>Location</span><strong>Dallas, TX</strong></div>
                  </div>
                  <div class="people-detail-focus">
                    <span>Current Focus</span>
                    <div class="people-detail-chiprow">
                      <b class="people-detail-chip">Promoter</b>
                      <b class="people-detail-chip">Routing</b>
                    </div>
                  </div>
                  <div class="people-detail-list">
                    <div class="people-detail-row"><span>Recent Show</span><strong>Deep Ellum Art Co.</strong></div>
                    <div class="people-detail-row"><span>Linked Venue</span><strong>Dallas Circuit</strong></div>
                    <div class="people-detail-row"><span>Archive Route</span><strong>Dallas / Routing / 2023</strong></div>
                  </div>
                </div>
                <div class="people-detail" data-dashboard-person-detail="taylor">
                  <div class="people-detail-ring"></div>
                  <div class="people-detail-avatar is-green"></div>
                  <h2>Taylor James</h2>
                  <div class="subcount">Promoter</div>
                  <div class="people-detail-meta">
                    <div><span>First Seen</span><strong>11.08.2021</strong></div>
                    <div><span>Total Shows</span><strong>36</strong></div>
                    <div><span>Total Bands</span><strong>13</strong></div>
                    <div><span>Location</span><strong>Nashville, TN</strong></div>
                  </div>
                  <div class="people-detail-focus">
                    <span>Current Focus</span>
                    <div class="people-detail-chiprow">
                      <b class="people-detail-chip">Promoter</b>
                      <b class="people-detail-chip">Southeast</b>
                      <b class="people-detail-chip">Notes</b>
                    </div>
                  </div>
                  <div class="people-detail-list">
                    <div class="people-detail-row"><span>Recent Show</span><strong>Basement East</strong></div>
                    <div class="people-detail-row"><span>Linked Venue</span><strong>Nashville Circuit</strong></div>
                    <div class="people-detail-row"><span>Archive Route</span><strong>Nashville / Promoter / 2023</strong></div>
                  </div>
                </div>
                <div class="people-detail" data-dashboard-person-detail="lindsay">
                  <div class="people-detail-ring"></div>
                  <div class="people-detail-avatar"></div>
                  <h2>Lindsay W.</h2>
                  <div class="subcount">Photographer</div>
                  <div class="people-detail-meta">
                    <div><span>First Seen</span><strong>07.13.2024</strong></div>
                    <div><span>Total Shows</span><strong>29</strong></div>
                    <div><span>Total Bands</span><strong>12</strong></div>
                    <div><span>Location</span><strong>Buffalo, NY</strong></div>
                  </div>
                  <div class="people-detail-focus">
                    <span>Current Focus</span>
                    <div class="people-detail-chiprow">
                      <b class="people-detail-chip">Photo Pit</b>
                      <b class="people-detail-chip">Tour Support</b>
                    </div>
                  </div>
                  <div class="people-detail-list">
                    <div class="people-detail-row"><span>Recent Show</span><strong>Barracuda</strong></div>
                    <div class="people-detail-row"><span>Linked Band</span><strong>Archive Assist</strong></div>
                    <div class="people-detail-row"><span>Archive Route</span><strong>Buffalo / Tour Support / 2024</strong></div>
                  </div>
                </div>
                <div class="explore">
                  <span>Open Person Profile</span>
                  <span>›</span>
                </div>
              </div>

              <div class="mode-pane mode-pane-shows" data-dashboard-side-pane="shows">
                <div class="shows-detail is-visible" data-dashboard-show-detail="warehouse">
                  <div class="shows-detail-ring"></div>
                  <div class="shows-detail-poster"></div>
                  <h2>Warehouse Live</h2>
                  <div class="subcount">11.08.2024 · Houston, TX</div>
                  <div class="shows-detail-meta">
                    <div><span>Venue</span><strong>Warehouse Live</strong></div>
                    <div><span>Bands</span><strong>4</strong></div>
                    <div><span>People</span><strong>12</strong></div>
                    <div><span>Status</span><strong>Archived</strong></div>
                  </div>
                  <div class="shows-detail-focus">
                    <span>Show Snapshot</span>
                    <div class="shows-detail-chiprow">
                      <b class="shows-detail-chip">Headliner</b>
                      <b class="shows-detail-chip">42 Photos</b>
                      <b class="shows-detail-chip">Night Shoot</b>
                    </div>
                  </div>
                  <div class="shows-detail-list">
                    <div class="shows-detail-row"><span>Top Band</span><strong>Chaos Machine</strong></div>
                    <div class="shows-detail-row"><span>Primary Person</span><strong>Joe Smith</strong></div>
                    <div class="shows-detail-row"><span>Archive Route</span><strong>Houston / 2024 / Nov</strong></div>
                  </div>
                </div>
                <div class="shows-detail" data-dashboard-show-detail="deep-elm">
                  <div class="shows-detail-ring"></div>
                  <div class="shows-detail-poster is-cyan"></div>
                  <h2>Deep Ellum Art Co.</h2>
                  <div class="subcount">09.21.2024 · Dallas, TX</div>
                  <div class="shows-detail-meta">
                    <div><span>Venue</span><strong>Deep Ellum Art Co.</strong></div>
                    <div><span>Bands</span><strong>3</strong></div>
                    <div><span>People</span><strong>9</strong></div>
                    <div><span>Status</span><strong>Archived</strong></div>
                  </div>
                  <div class="shows-detail-focus">
                    <span>Show Snapshot</span>
                    <div class="shows-detail-chiprow">
                      <b class="shows-detail-chip">Regional</b>
                      <b class="shows-detail-chip">31 Photos</b>
                      <b class="shows-detail-chip">Signal Pull</b>
                    </div>
                  </div>
                  <div class="shows-detail-list">
                    <div class="shows-detail-row"><span>Top Band</span><strong>Signal Fires</strong></div>
                    <div class="shows-detail-row"><span>Primary Person</span><strong>Sara Kane</strong></div>
                    <div class="shows-detail-row"><span>Archive Route</span><strong>Dallas / 2024 / Sep</strong></div>
                  </div>
                </div>
                <div class="shows-detail" data-dashboard-show-detail="mohawk">
                  <div class="shows-detail-ring"></div>
                  <div class="shows-detail-poster is-amber"></div>
                  <h2>The Mohawk</h2>
                  <div class="subcount">07.13.2024 · Austin, TX</div>
                  <div class="shows-detail-meta">
                    <div><span>Venue</span><strong>The Mohawk</strong></div>
                    <div><span>Bands</span><strong>5</strong></div>
                    <div><span>People</span><strong>11</strong></div>
                    <div><span>Status</span><strong>Archived</strong></div>
                  </div>
                  <div class="shows-detail-focus">
                    <span>Show Snapshot</span>
                    <div class="shows-detail-chiprow">
                      <b class="shows-detail-chip">Outdoor</b>
                      <b class="shows-detail-chip">27 Photos</b>
                      <b class="shows-detail-chip">Sunset Set</b>
                    </div>
                  </div>
                  <div class="shows-detail-list">
                    <div class="shows-detail-row"><span>Top Band</span><strong>Current Route</strong></div>
                    <div class="shows-detail-row"><span>Primary Person</span><strong>Mike Davis</strong></div>
                    <div class="shows-detail-row"><span>Archive Route</span><strong>Austin / 2024 / Jul</strong></div>
                  </div>
                </div>
                <div class="shows-detail" data-dashboard-show-detail="barracuda">
                  <div class="shows-detail-ring"></div>
                  <div class="shows-detail-poster"></div>
                  <h2>Barracuda</h2>
                  <div class="subcount">03.10.2024 · Austin, TX</div>
                  <div class="shows-detail-meta">
                    <div><span>Venue</span><strong>Barracuda</strong></div>
                    <div><span>Bands</span><strong>2</strong></div>
                    <div><span>People</span><strong>7</strong></div>
                    <div><span>Status</span><strong>Archived</strong></div>
                  </div>
                  <div class="shows-detail-focus">
                    <span>Show Snapshot</span>
                    <div class="shows-detail-chiprow">
                      <b class="shows-detail-chip">Club Night</b>
                      <b class="shows-detail-chip">18 Photos</b>
                      <b class="shows-detail-chip">Tight Room</b>
                    </div>
                  </div>
                  <div class="shows-detail-list">
                    <div class="shows-detail-row"><span>Top Band</span><strong>Archive Assist</strong></div>
                    <div class="shows-detail-row"><span>Primary Person</span><strong>Lindsay W.</strong></div>
                    <div class="shows-detail-row"><span>Archive Route</span><strong>Austin / 2024 / Mar</strong></div>
                  </div>
                </div>
                <div class="shows-detail" data-dashboard-show-detail="southside">
                  <div class="shows-detail-ring"></div>
                  <div class="shows-detail-poster is-cyan"></div>
                  <h2>South Side Ballroom</h2>
                  <div class="subcount">11.04.2023 · Dallas, TX</div>
                  <div class="shows-detail-meta">
                    <div><span>Venue</span><strong>South Side Ballroom</strong></div>
                    <div><span>Bands</span><strong>4</strong></div>
                    <div><span>People</span><strong>10</strong></div>
                    <div><span>Status</span><strong>Archived</strong></div>
                  </div>
                  <div class="shows-detail-focus">
                    <span>Show Snapshot</span>
                    <div class="shows-detail-chiprow">
                      <b class="shows-detail-chip">Tour Stop</b>
                      <b class="shows-detail-chip">35 Photos</b>
                      <b class="shows-detail-chip">Wide Room</b>
                    </div>
                  </div>
                  <div class="shows-detail-list">
                    <div class="shows-detail-row"><span>Top Band</span><strong>Sleep Token</strong></div>
                    <div class="shows-detail-row"><span>Primary Person</span><strong>Taylor James</strong></div>
                    <div class="shows-detail-row"><span>Archive Route</span><strong>Dallas / 2023 / Nov</strong></div>
                  </div>
                </div>
                <div class="shows-detail" data-dashboard-show-detail="masquerade">
                  <div class="shows-detail-ring"></div>
                  <div class="shows-detail-poster is-amber"></div>
                  <h2>The Masquerade</h2>
                  <div class="subcount">12.09.2022 · Atlanta, GA</div>
                  <div class="shows-detail-meta">
                    <div><span>Venue</span><strong>The Masquerade</strong></div>
                    <div><span>Bands</span><strong>4</strong></div>
                    <div><span>People</span><strong>8</strong></div>
                    <div><span>Status</span><strong>Archived</strong></div>
                  </div>
                  <div class="shows-detail-focus">
                    <span>Show Snapshot</span>
                    <div class="shows-detail-chiprow">
                      <b class="shows-detail-chip">Vault</b>
                      <b class="shows-detail-chip">27 Photos</b>
                      <b class="shows-detail-chip">Long Set</b>
                    </div>
                  </div>
                  <div class="shows-detail-list">
                    <div class="shows-detail-row"><span>Top Band</span><strong>Bad Omens</strong></div>
                    <div class="shows-detail-row"><span>Primary Person</span><strong>Alex Rodriguez</strong></div>
                    <div class="shows-detail-row"><span>Archive Route</span><strong>Atlanta / 2022 / Dec</strong></div>
                  </div>
                </div>
                <div class="explore">
                  <span>Open Show Archive</span>
                  <span>›</span>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>
    `;
  }

  function buildDashboardTitle(title) {
    if (!title || title.dataset.built === '1') return;
    title.dataset.built = '1';
    const source = String(title.getAttribute('data-text') || title.textContent || '').trim();
    if (!source) return;
    const wrap = document.createElement('span');
    wrap.className = 'nexus-eyebrow-wrap';
    Array.from(source).forEach(function (ch) {
      const span = document.createElement('span');
      span.className = ch === ' ' ? 'nexus-eyebrow-gap' : 'nexus-eyebrow-char';
      span.textContent = ch;
      wrap.appendChild(span);
    });
    title.textContent = '';
    title.appendChild(wrap);
  }

  function buildDashboardRadar(dashboard) {
    const letterRing = dashboard.querySelector('[data-dashboard-radar-letter-ring]');
    const nodeRing = dashboard.querySelector('[data-dashboard-radar-node-ring]');
    if (!letterRing || !nodeRing || dashboard.dataset.radarBound === '1') return;

    const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', '#'];
    const highlightMap = { C: 'red', Y: 'red', S: 'cyan', M: 'cyan' };
    const nodeSpecs = [
      { angle: -38, radius: 29.6, tone: 'red', hollow: false },
      { angle: -6, radius: 30.2, tone: 'cyan', hollow: false },
      { angle: 32, radius: 29.4, tone: 'red', hollow: true },
      { angle: 62, radius: 27.8, tone: 'red', hollow: false },
      { angle: 108, radius: 29.0, tone: 'red', hollow: false },
      { angle: 144, radius: 30.0, tone: 'cyan', hollow: true },
      { angle: 170, radius: 29.0, tone: 'red', hollow: false },
      { angle: 214, radius: 28.8, tone: 'cyan', hollow: false },
      { angle: 248, radius: 29.0, tone: 'amber', hollow: false },
      { angle: 286, radius: 30.0, tone: 'cyan', hollow: true },
      { angle: 320, radius: 28.8, tone: 'cyan', hollow: false },
      { angle: 338, radius: 27.8, tone: 'red', hollow: false }
    ];

    function placeRadarNodes() {
      const radius = window.matchMedia('(max-width: 640px)').matches ? 40.6 : 41.8;
      const startAngle = -82;
      const step = 360 / letters.length;
      letterRing.innerHTML = '';
      nodeRing.innerHTML = '';

      letters.forEach(function (ch, index) {
        const angle = (startAngle + index * step) * Math.PI / 180;
        const letter = document.createElement('div');
        letter.className = 'letter' + (highlightMap[ch] ? ' ' + highlightMap[ch] : '');
        letter.textContent = ch;
        letter.style.left = (50 + Math.cos(angle) * radius).toFixed(2) + '%';
        letter.style.top = (50 + Math.sin(angle) * radius).toFixed(2) + '%';
        letterRing.appendChild(letter);
      });

      nodeSpecs.forEach(function (spec, index) {
        const angle = spec.angle * Math.PI / 180;
        const node = document.createElement('div');
        node.className = 'node ' + spec.tone + (spec.hollow ? ' hollow' : '');
        node.style.left = (50 + Math.cos(angle) * spec.radius).toFixed(2) + '%';
        node.style.top = (50 + Math.sin(angle) * spec.radius).toFixed(2) + '%';
        node.style.animationDelay = (index * 0.2).toFixed(2) + 's';
        nodeRing.appendChild(node);
      });
    }

    placeRadarNodes();
    window.addEventListener('resize', placeRadarNodes, { passive: true });
    dashboard.dataset.radarBound = '1';
  }

  function bindDashboard(overlay) {
    const dashboard = overlay.querySelector('.mockup-music-dashboard');
    if (!dashboard || dashboard.dataset.bound === '1') return;

    installShowsRolodexMarkup(dashboard);

    const modeButtons = Array.from(dashboard.querySelectorAll('[data-dashboard-mode]'));
    const centerPanes = Array.from(dashboard.querySelectorAll('[data-dashboard-pane]'));
    const sidePanes = Array.from(dashboard.querySelectorAll('[data-dashboard-side-pane]'));
    const peopleCards = Array.from(dashboard.querySelectorAll('[data-dashboard-person]'));
    const peopleDetails = Array.from(dashboard.querySelectorAll('[data-dashboard-person-detail]'));
    const showCards = Array.from(dashboard.querySelectorAll('[data-dashboard-show]'));
    const showDetails = Array.from(dashboard.querySelectorAll('[data-dashboard-show-detail]'));

    buildDashboardTitle(dashboard.querySelector('[data-dashboard-title]'));
    buildDashboardRadar(dashboard);

    function setActivePerson(person) {
      peopleCards.forEach(function (card) {
        const isActive = card.getAttribute('data-dashboard-person') === person;
        card.classList.toggle('is-active', isActive);
        card.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      });
      peopleDetails.forEach(function (detail) {
        detail.classList.toggle('is-visible', detail.getAttribute('data-dashboard-person-detail') === person);
      });
    }

    function setActiveShow(show) {
      showCards.forEach(function (card) {
        const isActive = card.getAttribute('data-dashboard-show') === show;
        card.classList.toggle('is-active', isActive);
        card.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      });
      showDetails.forEach(function (detail) {
        detail.classList.toggle('is-visible', detail.getAttribute('data-dashboard-show-detail') === show);
      });
    }

    function syncPanes(mode) {
      centerPanes.forEach(function (pane) {
        pane.classList.toggle('is-visible', pane.getAttribute('data-dashboard-pane') === mode);
      });
      sidePanes.forEach(function (pane) {
        pane.classList.toggle('is-visible', pane.getAttribute('data-dashboard-side-pane') === mode);
      });
    }

    function setMode(mode) {
      dashboard.dataset.activeMode = mode;
      modeButtons.forEach(function (button) {
        const buttonMode = button.getAttribute('data-dashboard-mode');
        const isActive = buttonMode === mode;
        button.classList.toggle('active', isActive);
        button.classList.toggle('mode-smartcard-bands', buttonMode === 'bands' && isActive);
        button.classList.toggle('mode-smartcard-muted', !isActive);
        button.classList.toggle('mode-smartcard-neutral', false);
        button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      });
      syncPanes(mode);
      if (mode === 'people') {
        setActivePerson('joe');
      } else if (mode === 'shows') {
        window.requestAnimationFrame(function () {
          initShowsRolodex(dashboard);
        });
      }
    }

    modeButtons.forEach(function (button) {
      button.addEventListener('click', function () {
        setMode(button.getAttribute('data-dashboard-mode') || 'bands');
      });
    });

    peopleCards.forEach(function (card) {
      card.addEventListener('click', function () {
        setActivePerson(card.getAttribute('data-dashboard-person') || 'joe');
      });
    });

    showCards.forEach(function (card) {
      card.addEventListener('click', function () {
        setActiveShow(card.getAttribute('data-dashboard-show') || 'warehouse');
      });
    });

    dashboard.__setDashboardMode = function (mode) {
      setMode(mode || 'bands');
    };
    dashboard.__showDashboard = function (mode) {
      dashboard.dataset.dashboardState = 'visible';
      dashboard.setAttribute('aria-hidden', 'false');
      setMode(mode || dashboard.dataset.activeMode || 'bands');
    };
    dashboard.__hideDashboard = function () {
      dashboard.dataset.dashboardState = 'hidden';
      dashboard.setAttribute('aria-hidden', 'true');
      setMode('bands');
      setActivePerson('joe');
      setActiveShow('warehouse');
    };

    setMode('bands');
    dashboard.dataset.bound = '1';
  }

  function setPortfolioSuppressed(isSuppressed) {
    libraryOverlay.classList.toggle('is-music-source-suppressed', Boolean(isSuppressed));
    if (hostCopyText) {
      hostCopyText.toggleAttribute('inert', Boolean(isSuppressed));
      hostCopyText.setAttribute('aria-hidden', isSuppressed ? 'true' : 'false');
    }
  }

  function getShellPathname() {
    return localRoutePath || window.location.pathname || '';
  }

  function isMobileMusicHandoffViewport() {
    const width = window.innerWidth || document.documentElement.clientWidth || 0;
    return width <= 720 || document.body.classList.contains('mockup-mobile-shell');
  }

  function syncTestingRoute(route, mode, options = {}) {
    const deferHistory = !!options.deferHistory;
    const previousPath = getShellPathname();
    if (!route) {
      localRoutePath = '';
      deferredRoutePath = '';
      return;
    }
    localRoutePath = route;
    if (deferHistory) {
      deferredRoutePath = route;
      return;
    }
    const shouldCommit = previousPath !== route || deferredRoutePath === route;
    deferredRoutePath = '';
    if (!shouldCommit) return;
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
          ${getMusicDashboardMarkup()}
        </div>
      </div>
    `;

    host.appendChild(overlay);
    bindV14Sequence(overlay);
    bindDashboard(overlay);

    overlay.addEventListener('click', function (event) {
      if (event.target === overlay) {
        closeMusicOverlay();
      }
    });

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
    const filterButtons = Array.from(overlay.querySelectorAll('.nexus-filter-btn'));
    const filterChamber = overlay.querySelector('.placeholder');
    const filterDeploy = overlay.querySelector('.nexus-filter-deploy');
    const filterPrompt = overlay.querySelector('.filter-prompt');
    const modeIndicator = overlay.querySelector('.mode-indicator');
    const modeIndicatorText = overlay.querySelector('.mode-indicator-text');
    const dashboard = overlay.querySelector('.mockup-music-dashboard');

    if (!root || !startButton || !startStack || !intro || !titleWrap || !titleZone || !filterButtons.length || !filterChamber || !filterDeploy || !filterPrompt || !modeIndicator || !modeIndicatorText) {
      return;
    }

    if (titleZone.parentElement !== filterChamber) {
      filterChamber.insertBefore(titleZone, filterChamber.firstChild);
    }
    let introStack = filterChamber.querySelector('.mockup-music-intro-stack');
    if (!introStack) {
      introStack = document.createElement('div');
      introStack.className = 'mockup-music-intro-stack';
      filterChamber.insertBefore(introStack, filterChamber.firstChild);
    }
    if (titleZone.parentElement !== introStack) {
      introStack.appendChild(titleZone);
    }
    const startWrap = overlay.querySelector('.chamber-start-wrap');
    if (startWrap && startWrap.parentElement !== introStack) {
      introStack.appendChild(startWrap);
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

    function revealDashboard(mode) {
      if (!dashboard) return;
      dashboard.__showDashboard && dashboard.__showDashboard(mode);
      overlay.classList.add('is-dashboard-revealed');
      root.classList.add('is-dashboard-handoff');
    }

    function handoffToDashboard(mode) {
      if (state.hasTransferredFilter) return;
      state.hasTransferredFilter = true;
      const selectedMode = mode || 'bands';
      const selectedButton = filterButtons.find(function (button) {
        return button.getAttribute('data-mode') === selectedMode;
      }) || filterButtons[0];
      const selectedLabelEl = selectedButton && selectedButton.querySelector('.filter-label');
      const selectedLabel = selectedLabelEl ? selectedLabelEl.textContent.trim() : 'Bands';

      positionFilterRow();
      filterDeploy.classList.add('is-locked', 'is-complete');
      filterPrompt.classList.remove('is-active');
      filterPrompt.classList.add('is-hidden');
      filterChamber.classList.add('mode-transfer');
      setFilterMode(selectedMode);

      filterButtons.forEach(function (button) {
        const isSelected = button === selectedButton;
        button.classList.remove('is-deploying', 'is-ready', 'is-confirming', 'is-blinking', 'is-transferring');
        button.classList.toggle('is-selected', isSelected);
        button.classList.toggle('is-fading', !isSelected);
      });

      pulseChamber();
      activateModeIndicator(selectedLabel);

      schedule(function () {
        revealDashboard(selectedMode);
      }, 180);
    }

    function resetSequence() {
      clearTimers();
      state.hasTransferredFilter = false;
      startStack.classList.remove('is-launching');
      root.classList.remove('is-intro-fading');
      setFilterMode('');
      root.classList.remove('is-dashboard-handoff');
      overlay.classList.remove('is-dashboard-revealed');
      clearTransferStates();
      filterPrompt.classList.remove('is-active', 'is-hidden');
      filterButtons.forEach(function (button) {
        button.classList.remove('is-deploying', 'is-ready');
        button.style.removeProperty('--deploy-x');
        button.style.removeProperty('--deploy-delay');
      });
      filterDeploy.style.transform = 'translate(-50%, -50%)';
      if (dashboard && typeof dashboard.__hideDashboard === 'function') {
        dashboard.__hideDashboard();
      }
    }

    filterButtons.forEach(function (button) {
      button.addEventListener('mouseenter', function () {
        const selected = getSelectedButton();
        if (selected || state.hasTransferredFilter) return;
        setFilterMode(button.getAttribute('data-mode'));
      });

      button.addEventListener('mouseleave', function () {
        const selected = getSelectedButton();
        if (selected) {
          setFilterMode(selected.getAttribute('data-mode'));
        } else if (!state.hasTransferredFilter) {
          setFilterMode('');
        }
      });
    });

    startButton.addEventListener('click', function () {
      if (startStack.classList.contains('is-launching')) return;
      startStack.classList.add('is-launching');
      root.classList.add('is-intro-fading');
      schedule(function () {
        handoffToDashboard('bands');
      }, 220);
    });

    window.addEventListener('resize', function () {
      if (overlay.getAttribute('aria-hidden') === 'true') return;
      positionFilterRow();
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
    setPortfolioSuppressed(true);
    libraryOverlay.classList.add('is-music-branch-transitioning');
    void overlay.offsetWidth;
    const revealOverlay = function () {
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
    };
    if (isMobileMusicHandoffViewport()) {
      revealOverlay();
      return;
    }
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(revealOverlay);
    });
  }

  function closeMusicOverlay(options = {}) {
    const routeMode = options.routeMode || 'pushState';
    if (!musicOverlay || overlayPhase === 'idle') return;
    clearOverlayTimers();
    syncTestingRoute(PORTFOLIO_ROUTE, routeMode, { deferHistory: true });
    lockMusicFootprint();
    overlayPhase = 'closing';
    setPortfolioSuppressed(false);
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
      setPortfolioSuppressed(true);
      return;
    }

    if (wantsPortfolio && libraryOverlay.classList.contains('is-music-branch-open')) {
      closeMusicOverlay({ routeMode: 'replaceState' });
      return;
    }

    if (!wantsMusic && overlayPhase === 'idle') {
      setPortfolioSuppressed(false);
    }
  }

  libraryOverlay.addEventListener('click', function (event) {
    const trigger = event.target.closest(musicSelectors);
    if (!trigger || !libraryOverlay.contains(trigger)) return;
    if (
      !libraryOverlay.classList.contains('is-expanded') &&
      !libraryOverlay.classList.contains('is-visible') &&
      !libraryOverlay.classList.contains('is-content-visible')
    ) return;
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
