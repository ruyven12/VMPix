(function () {
      if (window.screen && window.screen.orientation && typeof window.screen.orientation.lock === 'function') {
        window.screen.orientation.lock('portrait').catch(() => {});
      }

      const topbar = document.querySelector('.mockup-topbar');
      const topbarLogoButton = document.querySelector('.mockup-topbar-logo-button');
      const backgroundVideo = document.querySelector('.mockup-background-video');
      const dollReveal = document.querySelector('.mockup-doll-reveal');
      const welcomeCopy = document.querySelector('.mockup-welcome-copy');
      const mockupStage = document.querySelector('.mockup-stage');
      const libraryOverlay = document.querySelector('.mockup-library-overlay');
      const aboutOverlay = document.querySelector('section.mockup-about-overlay:not(.mockup-library-overlay):not(.mockup-pricing-overlay)');
      const pricingOverlay = document.querySelector('.mockup-pricing-overlay');
      const aboutSlot = document.querySelector('.mockup-about-slot');
      const pricingSlot = document.querySelector('.mockup-pricing-slot');
      const aboutHitbox = document.querySelector('.mockup-about-hitbox');
      const pricingHitbox = document.querySelector('.mockup-pricing-hitbox');
      const aboutMenu = document.querySelector('.mockup-about-menu');
      const aboutMenuReverse = document.querySelector('.mockup-about-menu-reverse');
      const pricingMenu = document.querySelector('.mockup-pricing-menu');
      const pricingMenuReverse = document.querySelector('.mockup-pricing-menu-reverse');
      const pricingPanes = Array.from(document.querySelectorAll('[data-pricing-pane]'));
      const pricingTitleVideos = Array.from(document.querySelectorAll('[data-pricing-title-video]'));
      const pricingNavButtons = Array.from(document.querySelectorAll('[data-pricing-nav]'));
      const pricingTransferScan = pricingOverlay.querySelector('.mockup-pricing-transfer-scan');
      const pricingTitle = pricingOverlay.querySelector('.mockup-pricing-title');
      const pricingContent = pricingOverlay.querySelector('.mockup-pricing-content');
      const pricingArrowWraps = {
        prev: document.querySelector('[data-pricing-arrow-wrap="prev"]'),
        next: document.querySelector('[data-pricing-arrow-wrap="next"]')
      };
      if (!topbar || !topbarLogoButton || !backgroundVideo || !dollReveal || !welcomeCopy || !mockupStage || !libraryOverlay || !aboutOverlay || !pricingOverlay || !aboutSlot || !pricingSlot || !aboutHitbox || !pricingHitbox || !aboutMenu || !aboutMenuReverse || !pricingMenu || !pricingMenuReverse) return;

      const createPanel = ({ key, route, slot, hitbox, menu, reverseMenu, overlay }) => {
        const copy = overlay.querySelector('.mockup-about-copy');
        const sectionVideo = overlay.querySelector('.mockup-about-section-video');
        const titleVideo = overlay.querySelector('.mockup-about-title-video');
        const title = overlay.querySelector('.mockup-about-title');
        if (!copy || !sectionVideo || !title || !slot || !hitbox) return null;
        return { key, route, slot, hitbox, menu, reverseMenu, overlay, copy, sectionVideo, titleVideo };
      };

      const panels = {
        library: createPanel({
          key: 'library',
          route: '/testing/portfolio',
          slot: topbarLogoButton,
          hitbox: topbarLogoButton,
          menu: null,
          reverseMenu: null,
          overlay: libraryOverlay
        }),
        about: createPanel({
          key: 'about',
          route: '/testing/about',
          slot: aboutSlot,
          hitbox: aboutHitbox,
          menu: aboutMenu,
          reverseMenu: aboutMenuReverse,
          overlay: aboutOverlay
        }),
        pricing: createPanel({
          key: 'pricing',
          route: '/testing/pricing',
          slot: pricingSlot,
          hitbox: pricingHitbox,
          menu: pricingMenu,
          reverseMenu: pricingMenuReverse,
          overlay: pricingOverlay
        })
      };
      if (!panels.library || !panels.about || !panels.pricing) return;

      const PANEL_LOOP_START = 1.52;
      const PANEL_LOOP_END = 4.92;
      const PRICING_REVEAL_DELAY_MS = 180;
      const ROUTE_HOME = '/testing/home';
      const ROUTE_MUSIC = '/testing/music';
      let isTransitioning = false;
      let activePanelKey = '';
      let panelLoopTimer = 0;
      let panelStageTimerIds = [];
      let pricingMenuDelayTimer = 0;
      let shellRoutePath = '';
      const musicRowCanvasCleanups = [];
      let hasInitializedMusicStatusSignals = false;
      let hasInitializedWrestlingStatusSignals = false;
      let hasPreloadedLibraryGlassImages = false;

      const initMusicStatusSignals = () => {
        if (hasInitializedMusicStatusSignals) return;
        const cards = Array.from(document.querySelectorAll('.mockup-library-status-node.is-music-card'));
        if (!cards.length) return;
        hasInitializedMusicStatusSignals = true;
        const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const mobileSignalMode = (window.matchMedia && window.matchMedia('(max-width: 720px)').matches)
          || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);

        cards.forEach((card, cardIndex) => {
          if (card.dataset.musicSignalReady === 'true') return;
          card.dataset.musicSignalReady = 'true';
          const canvas = card.querySelector('.mockup-library-status-signal-canvas');
          if (!canvas) return;
          const context = canvas.getContext('2d', { alpha: true, desynchronized: true });
          if (!context) return;

          let width = 0;
          let height = 0;
          let dpr = 1;
          let animationFrameId = 0;
          let lastTime = 0;
          let tick = Math.random() * 1000;
          const particles = Array.from({ length: mobileSignalMode ? 160 : 272 }, (_, index) => {
            const direction = index % 2 === 0 ? 1 : -1;
            return {
              x: Math.random(),
              y: 0.16 + Math.random() * 0.66,
              drift: (Math.random() * 0.12 + 0.04) * direction,
              speed: 0.18 + Math.random() * 0.36,
              radius: 0.8 + Math.random() * 1.8,
              alpha: 0.16 + Math.random() * 0.26,
              hue: Math.random() > 0.72 ? 'gold' : Math.random() > 0.46 ? 'pink' : 'cyan',
              mode: Math.random() > 0.76 ? 'sigil' : 'ember'
            };
          });

          const resize = () => {
            const bounds = canvas.getBoundingClientRect();
            width = Math.max(1, Math.round(bounds.width));
            height = Math.max(1, Math.round(bounds.height));
            dpr = Math.min(window.devicePixelRatio || 1, mobileSignalMode ? 1.5 : 2);
            canvas.width = Math.round(width * dpr);
            canvas.height = Math.round(height * dpr);
            context.setTransform(dpr, 0, 0, dpr, 0, 0);
          };

          const resetParticle = (particle) => {
            particle.x = Math.random();
            particle.y = 0.14 + Math.random() * 0.68;
            particle.drift = (Math.random() * 0.12 + 0.04) * (Math.random() > 0.5 ? 1 : -1);
            particle.speed = 0.18 + Math.random() * 0.36;
            particle.radius = 0.8 + Math.random() * 1.8;
            particle.alpha = 0.16 + Math.random() * 0.26;
            particle.hue = Math.random() > 0.72 ? 'gold' : Math.random() > 0.46 ? 'pink' : 'cyan';
            particle.mode = Math.random() > 0.76 ? 'sigil' : 'ember';
          };

          const particleColor = (particle, alphaScale = 1) => {
            const alpha = Math.min(1, particle.alpha * alphaScale);
            if (particle.hue === 'gold') return `rgba(255, 205, 122, ${alpha})`;
            if (particle.hue === 'pink') return `rgba(255, 138, 192, ${alpha})`;
            return `rgba(122, 228, 255, ${alpha})`;
          };

          const drawParticle = (particle, index) => {
            const x = particle.x * width;
            const y = particle.y * height;
            const flicker = 0.82 + 0.18 * Math.sin(tick * 3.6 + index * 1.7);
            const radius = particle.radius * flicker;

            if (particle.mode === 'sigil') {
              context.strokeStyle = particleColor(particle, 0.88 * flicker);
              context.lineWidth = 1;
              context.beginPath();
              context.moveTo(x - radius * 1.6, y);
              context.lineTo(x + radius * 1.6, y);
              context.moveTo(x, y - radius * 1.6);
              context.lineTo(x, y + radius * 1.6);
              context.stroke();
              return;
            }

            context.fillStyle = particleColor(particle, flicker);
            context.beginPath();
            context.arc(x, y, radius, 0, Math.PI * 2);
            context.fill();

            context.fillStyle = particleColor(particle, 0.22 * flicker);
            context.beginPath();
            context.arc(x, y, radius * 3.1, 0, Math.PI * 2);
            context.fill();
          };

          const draw = (timestamp) => {
            if (!width || !height) resize();
            if (prefersReducedMotion) {
              tick = 0;
            } else {
              const delta = lastTime ? Math.min((timestamp - lastTime) / 1000, 0.05) : 0.016;
              lastTime = timestamp;
              tick += delta;
            }

            context.clearRect(0, 0, width, height);

            const midY = height * 0.5;
            const bandGradient = context.createLinearGradient(0, 0, width, 0);
            bandGradient.addColorStop(0, 'rgba(255, 126, 172, 0)');
            bandGradient.addColorStop(0.2, 'rgba(255, 126, 172, 0.1)');
            bandGradient.addColorStop(0.5, 'rgba(132, 227, 255, 0.22)');
            bandGradient.addColorStop(0.8, 'rgba(255, 188, 112, 0.1)');
            bandGradient.addColorStop(1, 'rgba(255, 188, 112, 0)');
            context.strokeStyle = bandGradient;
            context.lineWidth = 1;
            context.beginPath();
            context.moveTo(width * 0.17, midY);
            context.lineTo(width * 0.83, midY);
            context.stroke();

            const waveformOpacity = prefersReducedMotion ? 0.16 : 0.28;
            for (let lineIndex = 0; lineIndex < 2; lineIndex += 1) {
              const amplitude = height * (lineIndex === 0 ? 0.1 : 0.065);
              const phase = lineIndex === 0 ? 0 : 1.4;
              const verticalOffset = lineIndex === 0 ? -1.5 : 2.5;
              context.strokeStyle = lineIndex === 0
                ? `rgba(122, 228, 255, ${waveformOpacity})`
                : `rgba(255, 146, 194, ${waveformOpacity * 0.8})`;
              context.lineWidth = lineIndex === 0 ? 1.2 : 1;
              context.beginPath();
              const samples = 72;
              for (let step = 0; step <= samples; step += 1) {
                const ratio = step / samples;
                const x = width * ratio;
                const edgeFade = Math.max(0, Math.min(1, ratio < 0.14 ? ratio / 0.14 : ratio > 0.86 ? (1 - ratio) / 0.14 : 1));
                const wave =
                  Math.sin(ratio * 20 + tick * 3.4 + phase) * amplitude * 0.48 +
                  Math.sin(ratio * 44 - tick * 2.6 + phase * 0.7) * amplitude * 0.22;
                const y = midY + verticalOffset + wave * edgeFade;
                if (step === 0) context.moveTo(x, y);
                else context.lineTo(x, y);
              }
              context.stroke();
            }

            const barCount = Math.max(mobileSignalMode ? 18 : 24, Math.round(width / (mobileSignalMode ? 13 : 11)));
            const usableWidth = width * (mobileSignalMode ? 0.76 : 0.8);
            const startX = (width - usableWidth) / 2;
            const gap = mobileSignalMode ? 2 : 2.25;
            const barWidth = Math.max(4, (usableWidth - gap * (barCount - 1)) / barCount);
            for (let barIndex = 0; barIndex < barCount; barIndex += 1) {
              const ratio = barCount <= 1 ? 0.5 : barIndex / (barCount - 1);
              const centered = Math.abs(ratio - 0.5) / 0.5;
              const envelope = 1 - centered * 0.36;
              const pulse =
                0.48 +
                0.28 * Math.sin(tick * 5.1 + barIndex * 0.42 + cardIndex) +
                0.16 * Math.sin(tick * 9.6 - barIndex * 0.78);
              const randomPeak = 0.12 * (Math.sin(tick * 2.7 + barIndex * 1.9) + 1);
              const heightFactor = Math.max(0.14, envelope * (pulse + randomPeak));
              const barHeight = Math.min(height * 0.56, height * 0.12 + height * 0.42 * heightFactor);
              const x = startX + barIndex * (barWidth + gap);
              const y = midY - barHeight / 2;
              const barGradient = context.createLinearGradient(x, y, x, y + barHeight);
              barGradient.addColorStop(0, 'rgba(255, 210, 146, 0.48)');
              barGradient.addColorStop(0.44, 'rgba(255, 142, 186, 0.44)');
              barGradient.addColorStop(1, 'rgba(122, 228, 255, 0.39)');
              context.fillStyle = barGradient;
              context.fillRect(x, y, barWidth, barHeight);
              context.fillStyle = 'rgba(122, 228, 255, 0.052)';
              context.fillRect(x, midY - 0.5, barWidth, 1);
            }

            particles.forEach((particle, index) => {
              drawParticle(particle, index);
              if (prefersReducedMotion) return;
              particle.x += particle.drift * 0.0014;
              particle.y -= particle.speed * 0.00145;
              if (particle.y < 0.14 || particle.x < -0.08 || particle.x > 1.08) {
                resetParticle(particle);
                particle.y = 0.72 + Math.random() * 0.18;
              }
            });

            if (!prefersReducedMotion) {
              animationFrameId = window.requestAnimationFrame(draw);
            }
          };

          resize();
          draw(0);

          let resizeObserver = null;
          if (typeof ResizeObserver === 'function') {
            resizeObserver = new ResizeObserver(() => {
              resize();
            });
            resizeObserver.observe(card);
          } else {
            window.addEventListener('resize', resize);
          }

          musicRowCanvasCleanups.push(() => {
            if (animationFrameId) window.cancelAnimationFrame(animationFrameId);
            if (resizeObserver) {
              resizeObserver.disconnect();
            } else {
              window.removeEventListener('resize', resize);
            }
          });
        });
      };

      const initWrestlingStatusSignals = () => {
        if (hasInitializedWrestlingStatusSignals) return;
        const cards = Array.from(document.querySelectorAll('.mockup-library-status-node.is-wrestling-card'));
        if (!cards.length) return;
        hasInitializedWrestlingStatusSignals = true;
        const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const mobileSignalMode = (window.matchMedia && window.matchMedia('(max-width: 720px)').matches)
          || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);

        cards.forEach((card) => {
          if (card.dataset.wrestlingSignalReady === 'true') return;
          card.dataset.wrestlingSignalReady = 'true';
          const canvas = card.querySelector('.mockup-library-wrestling-canvas');
          if (!canvas) return;
          const context = canvas.getContext('2d', { alpha: true, desynchronized: true });
          if (!context) return;

          let width = 0;
          let height = 0;
          let dpr = 1;
          let animationFrameId = 0;
          let lastTime = 0;
          let tick = Math.random() * 1000;
          const particles = Array.from({ length: mobileSignalMode ? 120 : 180 }, () => ({
            x: 0.12 + Math.random() * 0.76,
            y: 0.5 + Math.random() * 0.38,
            dx: (Math.random() - 0.5) * 0.12,
            dy: 0.08 + Math.random() * 0.16,
            radius: 0.8 + Math.random() * 1.6,
            alpha: 0.12 + Math.random() * 0.16,
            hue: Math.random() > 0.58 ? 'gold' : 'ember'
          }));
          const bursts = Array.from({ length: mobileSignalMode ? 4 : 6 }, (_, index) => ({
            anchorX: 0.24 + (index / Math.max(1, (mobileSignalMode ? 2 : 4))) * 0.52 + (Math.random() - 0.5) * 0.06,
            anchorY: 0.56 + Math.random() * 0.18,
            radius: mobileSignalMode ? 16 + Math.random() * 10 : 20 + Math.random() * 16,
            spokeCount: mobileSignalMode ? 8 + Math.floor(Math.random() * 4) : 10 + Math.floor(Math.random() * 6),
            life: Math.random(),
            speed: 0.32 + Math.random() * 0.28,
            alpha: 0.28 + Math.random() * 0.2
          }));
          const streaks = Array.from({ length: mobileSignalMode ? 36 : 54 }, (_, index) => ({
            side: index % 2 === 0 ? -1 : 1,
            t: Math.random(),
            speed: 0.24 + Math.random() * 0.2,
            length: 10 + Math.random() * 12,
            alpha: 0.2 + Math.random() * 0.18
          }));

          const particleColor = (particle, alphaScale = 1) => {
            const alpha = Math.min(1, particle.alpha * alphaScale);
            return particle.hue === 'gold'
              ? `rgba(255, 208, 132, ${alpha})`
              : `rgba(255, 130, 96, ${alpha})`;
          };

          const resize = () => {
            const bounds = canvas.getBoundingClientRect();
            width = Math.max(1, Math.round(bounds.width));
            height = Math.max(1, Math.round(bounds.height));
            dpr = Math.min(window.devicePixelRatio || 1, mobileSignalMode ? 1.5 : 2);
            canvas.width = Math.round(width * dpr);
            canvas.height = Math.round(height * dpr);
            context.setTransform(dpr, 0, 0, dpr, 0, 0);
          };

          const resetParticle = (particle) => {
            particle.x = 0.12 + Math.random() * 0.76;
            particle.y = 0.62 + Math.random() * 0.26;
            particle.dx = (Math.random() - 0.5) * 0.12;
            particle.dy = 0.08 + Math.random() * 0.16;
            particle.radius = 0.8 + Math.random() * 1.6;
            particle.alpha = 0.12 + Math.random() * 0.16;
            particle.hue = Math.random() > 0.58 ? 'gold' : 'ember';
          };

          const resetBurst = (burst, index) => {
            burst.anchorX = 0.22 + (index / Math.max(1, (mobileSignalMode ? 2 : 4))) * 0.56 + (Math.random() - 0.5) * 0.08;
            burst.anchorY = 0.58 + Math.random() * 0.18;
            burst.radius = mobileSignalMode ? 16 + Math.random() * 10 : 20 + Math.random() * 16;
            burst.spokeCount = mobileSignalMode ? 8 + Math.floor(Math.random() * 4) : 10 + Math.floor(Math.random() * 6);
            burst.life = 0;
            burst.speed = 0.32 + Math.random() * 0.28;
            burst.alpha = 0.28 + Math.random() * 0.2;
          };

          const resetStreak = (streak) => {
            streak.t = 0;
            streak.speed = 0.24 + Math.random() * 0.2;
            streak.length = 10 + Math.random() * 12;
            streak.alpha = 0.2 + Math.random() * 0.18;
          };

          const draw = (timestamp) => {
            if (!width || !height) resize();
            if (prefersReducedMotion) {
              tick = 0;
            } else {
              const delta = lastTime ? Math.min((timestamp - lastTime) / 1000, 0.05) : 0.016;
              lastTime = timestamp;
              tick += delta;
            }

            context.clearRect(0, 0, width, height);

            const centerX = width * 0.5;
            const centerY = height * 0.5;

            particles.forEach((particle) => {
              const x = particle.x * width;
              const y = particle.y * height;
              context.fillStyle = particleColor(particle);
              context.beginPath();
              context.arc(x, y, particle.radius, 0, Math.PI * 2);
              context.fill();
              context.fillStyle = particleColor(particle, 0.26);
              context.beginPath();
              context.arc(x, y, particle.radius * 2.8, 0, Math.PI * 2);
              context.fill();

              if (!prefersReducedMotion) {
                particle.x += particle.dx * 0.0022;
                particle.y -= particle.dy * 0.0028;
                if (particle.y < 0.08 || particle.x < -0.06 || particle.x > 1.06) {
                  resetParticle(particle);
                }
              }
            });

            bursts.forEach((burst, index) => {
              const burstX = burst.anchorX * width;
              const burstY = burst.anchorY * height;
              const progress = burst.life;
              const bloomStrength = Math.sin(progress * Math.PI);
              const bloomRadius = burst.radius * (0.24 + bloomStrength * 0.72);
              const bloomGradient = context.createRadialGradient(burstX, burstY, 0, burstX, burstY, bloomRadius);
              bloomGradient.addColorStop(0, `rgba(255, 236, 190, ${burst.alpha * bloomStrength * 0.42})`);
              bloomGradient.addColorStop(0.42, `rgba(255, 172, 110, ${burst.alpha * bloomStrength * 0.22})`);
              bloomGradient.addColorStop(1, 'rgba(255, 96, 68, 0)');
              context.fillStyle = bloomGradient;
              context.beginPath();
              context.arc(burstX, burstY, bloomRadius, 0, Math.PI * 2);
              context.fill();

              for (let spokeIndex = 0; spokeIndex < burst.spokeCount; spokeIndex += 1) {
                const angle = ((Math.PI * 2) / burst.spokeCount) * spokeIndex;
                const inner = burst.radius * 0.08;
                const outer = burst.radius * (0.24 + bloomStrength * 0.98);
                const startX = burstX + Math.cos(angle) * inner;
                const startY = burstY + Math.sin(angle) * inner;
                const endX = burstX + Math.cos(angle) * outer;
                const endY = burstY + Math.sin(angle) * outer;
                const gradient = context.createLinearGradient(startX, startY, endX, endY);
                gradient.addColorStop(0, `rgba(255, 255, 220, ${burst.alpha * bloomStrength * 0.22})`);
                gradient.addColorStop(0.6, `rgba(255, 188, 118, ${burst.alpha * bloomStrength * 0.86})`);
                gradient.addColorStop(1, 'rgba(255, 116, 78, 0)');
                context.strokeStyle = gradient;
                context.lineWidth = mobileSignalMode ? 1.1 : 1.35;
                context.beginPath();
                context.moveTo(startX, startY);
                context.lineTo(endX, endY);
                context.stroke();
              }

              if (!prefersReducedMotion) {
                burst.life += burst.speed * 0.012;
                if (burst.life >= 1) resetBurst(burst, index);
              }
            });

            streaks.forEach((streak, index) => {
              const launchX = centerX + streak.side * width * 0.08 + (Math.random() - 0.5) * width * 0.54;
              const progress = streak.t;
              const x = launchX + streak.side * width * 0.08 * progress;
              const y = height * 0.9 - height * 0.46 * progress + Math.sin((progress * Math.PI) + index) * 2.2;
              const rotationPhase = (Math.sin(tick * 2.2 + index * 0.31) + 1) * 0.5;
              const angle = rotationPhase * (Math.PI / 2);
              const dx = Math.cos(angle) * streak.length;
              const dy = Math.sin(angle) * streak.length;
              const startX = x - dx * 0.5;
              const startY = y + dy * 0.5;
              const endX = x + dx * 0.5;
              const endY = y - dy * 0.5;
              const gradient = context.createLinearGradient(startX, startY, endX, endY);
              gradient.addColorStop(0, 'rgba(255, 112, 88, 0)');
              gradient.addColorStop(0.44, `rgba(255, 176, 98, ${streak.alpha * 0.7})`);
              gradient.addColorStop(1, `rgba(255, 238, 186, ${streak.alpha})`);
              context.strokeStyle = gradient;
              context.lineWidth = mobileSignalMode ? 1 : 1.2;
              context.beginPath();
              context.moveTo(startX, startY);
              context.lineTo(endX, endY);
              context.stroke();

              if (!prefersReducedMotion) {
                streak.t += streak.speed * 0.014;
                if (streak.t >= 1) resetStreak(streak);
              }
            });

            if (!prefersReducedMotion) {
              animationFrameId = window.requestAnimationFrame(draw);
            }
          };

          resize();
          draw(0);

          let resizeObserver = null;
          if (typeof ResizeObserver === 'function') {
            resizeObserver = new ResizeObserver(() => {
              resize();
            });
            resizeObserver.observe(card);
          } else {
            window.addEventListener('resize', resize);
          }

          musicRowCanvasCleanups.push(() => {
            if (animationFrameId) window.cancelAnimationFrame(animationFrameId);
            if (resizeObserver) {
              resizeObserver.disconnect();
            } else {
              window.removeEventListener('resize', resize);
            }
          });
        });
      };
      let hasAppliedInitialShellState = false;
      const libraryPhotoAtmos = libraryOverlay ? libraryOverlay.querySelector('.mockup-library-photo-atmos') : null;
      const libraryPhotoPanes = libraryPhotoAtmos ? Array.from(libraryPhotoAtmos.querySelectorAll('.mockup-library-photo-pane')) : [];
      const LIBRARY_GLASS_IMAGES = [
        'assets/testing-portfolio/glass-photo-1.jpg',
        'assets/testing-portfolio/glass-photo-2.jpg',
        'assets/testing-portfolio/glass-photo-3.jpg',
        'assets/testing-portfolio/glass-photo-4.jpg',
        'assets/testing-portfolio/glass-photo-5.jpg',
        'assets/testing-portfolio/glass-photo-6.jpg',
        'assets/testing-portfolio/glass-photo-7.jpg',
        'assets/testing-portfolio/glass-photo-8.jpg'
      ];
      const libraryGlassState = {
        timer: 0,
        activePaneIndex: 0,
        activeImageIndex: -1
      };

      try {
        const initialShellRoute = new URLSearchParams(window.location.search).get('shellRoute');
        if (initialShellRoute === ROUTE_HOME || initialShellRoute === panels.library.route || initialShellRoute === panels.about.route || initialShellRoute === panels.pricing.route) {
          shellRoutePath = initialShellRoute;
        }
      } catch (_) {}

      const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

      const isCompactViewport = () => {
        const width = window.innerWidth || document.documentElement.clientWidth || 0;
        const height = window.innerHeight || document.documentElement.clientHeight || 0;
        return width <= 760 || (width <= 900 && height > width);
      };

      const syncMobileShellMode = () => {
        const compact = isCompactViewport();
        document.body.classList.toggle('mockup-mobile-shell', compact);
        if (!compact || !activePanelKey) return;
        const activePanel = getActivePanel();
        if (!activePanel) return;
        resetPanelTransforms(activePanel);
        activePanel.overlay.classList.add('is-visible', 'is-expanded', 'is-energized', 'is-content-visible');
      };

      const randomBetween = (min, max) => min + (Math.random() * (max - min));
      const isMobileOptimizedViewport = () => window.innerWidth <= 720;

      const getNextLibraryGlassImage = () => {
        if (!LIBRARY_GLASS_IMAGES.length) return '';
        if (LIBRARY_GLASS_IMAGES.length === 1) return LIBRARY_GLASS_IMAGES[0];
        let nextIndex = Math.floor(Math.random() * LIBRARY_GLASS_IMAGES.length);
        if (nextIndex === libraryGlassState.activeImageIndex) {
          nextIndex = (nextIndex + 1) % LIBRARY_GLASS_IMAGES.length;
        }
        libraryGlassState.activeImageIndex = nextIndex;
        return LIBRARY_GLASS_IMAGES[nextIndex];
      };

      const applyLibraryGlassFrame = (pane, immediate = false) => {
        if (!pane) return;
        const imageUrl = getNextLibraryGlassImage();
        if (!imageUrl) return;
        const mobileViewport = isMobileOptimizedViewport();
        pane.style.backgroundImage = `
          linear-gradient(135deg, rgba(255, 98, 146, ${mobileViewport ? '0.08' : '0.12'}), rgba(132, 227, 255, ${mobileViewport ? '0.05' : '0.08'})),
          url("${imageUrl}")
        `;
        pane.style.setProperty('--library-photo-scale', mobileViewport ? '1.08' : randomBetween(1.12, 1.3).toFixed(3));
        pane.style.setProperty('--library-photo-shift-x', `${mobileViewport ? 0 : randomBetween(-26, 26).toFixed(1)}px`);
        pane.style.setProperty('--library-photo-shift-y', `${mobileViewport ? 0 : randomBetween(-18, 18).toFixed(1)}px`);
        pane.style.setProperty('--library-photo-rotate', `${mobileViewport ? 0 : randomBetween(-2.6, 2.6).toFixed(2)}deg`);
        if (immediate) {
          pane.classList.add('is-active');
        }
      };

      const preloadLibraryGlassImages = () => {
        if (hasPreloadedLibraryGlassImages || !LIBRARY_GLASS_IMAGES.length) return;
        hasPreloadedLibraryGlassImages = true;
        const preload = () => {
          LIBRARY_GLASS_IMAGES.slice(0, isMobileOptimizedViewport() ? 3 : LIBRARY_GLASS_IMAGES.length).forEach((src) => {
            const image = new Image();
            image.decoding = 'async';
            image.src = src;
          });
        };
        if ('requestIdleCallback' in window) {
          window.requestIdleCallback(preload, { timeout: 1200 });
        } else {
          window.setTimeout(preload, 300);
        }
      };

      const cycleLibraryGlass = (immediate = false) => {
        if (!libraryPhotoPanes.length) return;
        const nextIndex = immediate ? 0 : (libraryGlassState.activePaneIndex + 1) % libraryPhotoPanes.length;
        const nextPane = libraryPhotoPanes[nextIndex];
        const prevPane = libraryPhotoPanes[libraryGlassState.activePaneIndex];
        applyLibraryGlassFrame(nextPane, immediate);
        void nextPane.offsetWidth;
        nextPane.classList.remove('is-exiting');
        nextPane.classList.add('is-active');
        if (!immediate && prevPane && prevPane !== nextPane) {
          prevPane.classList.remove('is-active');
          prevPane.classList.add('is-exiting');
        }
        if (immediate && prevPane && prevPane !== nextPane) {
          prevPane.classList.remove('is-active', 'is-exiting');
        }
        libraryGlassState.activePaneIndex = nextIndex;
      };

      const startLibraryGlass = () => {
        if (!libraryPhotoPanes.length || libraryGlassState.timer) return;
        libraryPhotoPanes.forEach((pane) => pane.classList.remove('is-active', 'is-exiting'));
        libraryGlassState.activePaneIndex = 0;
        libraryGlassState.activeImageIndex = -1;
        cycleLibraryGlass(true);
        if (isMobileOptimizedViewport()) return;
        libraryGlassState.timer = window.setInterval(() => {
          if (activePanelKey !== 'library') return;
          cycleLibraryGlass(false);
        }, 6800);
      };

      const stopLibraryGlass = () => {
        if (libraryGlassState.timer) {
          window.clearInterval(libraryGlassState.timer);
          libraryGlassState.timer = 0;
        }
        libraryPhotoPanes.forEach((pane) => pane.classList.remove('is-active', 'is-exiting'));
      };

      const armLogoGateway = async () => {
        topbarLogoButton.classList.remove('is-arming');
        void topbarLogoButton.offsetWidth;
        topbarLogoButton.classList.add('is-arming');
        await wait(210);
        topbarLogoButton.classList.remove('is-arming');
      };

      const clearPricingMenuDelay = () => {
        if (pricingMenuDelayTimer) {
          window.clearTimeout(pricingMenuDelayTimer);
          pricingMenuDelayTimer = 0;
        }
      };

      const clearPanelStageTimers = () => {
        panelStageTimerIds.forEach((timerId) => window.clearTimeout(timerId));
        panelStageTimerIds = [];
      };

      const updatePricingArrowVisibility = (mode) => {
        if (pricingArrowWraps.prev) {
          pricingArrowWraps.prev.hidden = mode !== 'hire';
        }
        if (pricingArrowWraps.next) {
          pricingArrowWraps.next.hidden = mode !== 'prints';
        }
      };

      const syncPricingTitleVideo = (mode, options = {}) => {
        const { restart = false } = options;
        pricingTitleVideos.forEach((video) => {
          const isActive = video.dataset.pricingTitleVideo === mode;
          if (!isActive) {
            try {
              video.pause();
              video.currentTime = 0;
            } catch (_) {}
            return;
          }
          if (restart) {
            playVideoFromStart(video);
            return;
          }
          try {
            const playPromise = video.play();
            if (playPromise && typeof playPromise.catch === 'function') {
              playPromise.catch(() => {});
            }
          } catch (_) {}
        });
      };

      const getPricingPaneByMode = (mode) => pricingPanes.find((pane) => pane.dataset.pricingPane === mode) || null;

      const setPricingMode = (mode, options = {}) => {
        const { animate = false, restartTitle = false, direction = 'next' } = options;
        const nextMode = mode === 'hire' ? 'hire' : 'prints';
        const currentMode = pricingOverlay.dataset.pricingMode === 'hire' ? 'hire' : 'prints';
        const currentPane = getPricingPaneByMode(currentMode);
        const nextPane = getPricingPaneByMode(nextMode);
        const shouldAnimate = animate && currentMode !== nextMode && currentPane && nextPane;

        pricingOverlay.dataset.pricingMode = nextMode;
        updatePricingArrowVisibility(nextMode);

        pricingPanes.forEach((pane) => {
          pane.classList.remove('is-switching');
          pane.classList.remove('is-entering');
          pane.classList.remove('is-leaving');
          pane.removeAttribute('data-swipe-direction');
        });

        [pricingTitle, pricingContent].forEach((element) => {
          if (!element) return;
          element.classList.remove('is-module-leaving');
          element.classList.remove('is-module-entering');
          element.removeAttribute('data-module-direction');
        });

        pricingOverlay.classList.remove('is-transitioning-pane');
        if (pricingTransferScan) {
          pricingTransferScan.removeAttribute('data-scan-direction');
        }

        if (shouldAnimate) {
          [pricingTitle, pricingContent].forEach((element) => {
            if (!element) return;
            element.dataset.moduleDirection = direction;
            element.classList.add('is-module-leaving');
          });

          if (pricingTransferScan) {
            pricingTransferScan.dataset.scanDirection = direction;
            void pricingTransferScan.offsetWidth;
          }
          pricingOverlay.classList.add('is-transitioning-pane');

          window.setTimeout(() => {
            pricingOverlay.dataset.pricingMode = nextMode;
            updatePricingArrowVisibility(nextMode);

            currentPane.hidden = false;
            currentPane.classList.remove('is-active');
            currentPane.classList.add('is-leaving');
            currentPane.dataset.swipeDirection = direction;

            nextPane.hidden = false;
            nextPane.classList.add('is-active', 'is-entering', 'is-switching');
            nextPane.dataset.swipeDirection = direction;

            [pricingTitle, pricingContent].forEach((element) => {
              if (!element) return;
              element.classList.remove('is-module-leaving');
              element.classList.add('is-module-entering');
            });

            syncPricingTitleVideo(nextMode, { restart: restartTitle || animate });
          }, 170);

          window.setTimeout(() => {
            currentPane.hidden = true;
            currentPane.classList.remove('is-leaving');
            currentPane.removeAttribute('data-swipe-direction');
          }, 620);

          window.setTimeout(() => {
            pricingOverlay.classList.remove('is-transitioning-pane');
            if (pricingTransferScan) {
              pricingTransferScan.removeAttribute('data-scan-direction');
            }
          }, 480);

          window.setTimeout(() => {
            nextPane.classList.remove('is-entering');
            nextPane.classList.remove('is-switching');
            nextPane.removeAttribute('data-swipe-direction');
            [pricingTitle, pricingContent].forEach((element) => {
              if (!element) return;
              element.classList.remove('is-module-entering');
              element.removeAttribute('data-module-direction');
            });
          }, 760);
        } else {
          pricingOverlay.dataset.pricingMode = nextMode;
          updatePricingArrowVisibility(nextMode);
          pricingPanes.forEach((pane) => {
            const isActive = pane.dataset.pricingPane === nextMode;
            pane.hidden = !isActive;
            pane.classList.toggle('is-active', isActive);
            if (isActive && animate) {
              void pane.offsetWidth;
              pane.classList.add('is-switching');
              window.setTimeout(() => {
                pane.classList.remove('is-switching');
              }, 760);
            }
          });
          syncPricingTitleVideo(nextMode, { restart: restartTitle || animate });
        }
      };

      setPricingMode('prints');

      const queuePanelStage = (fn, delay) => {
        const timerId = window.setTimeout(fn, delay);
        panelStageTimerIds.push(timerId);
      };

      const getPathname = () => shellRoutePath || window.location.pathname || '';

      const getCurrentRoute = () => {
        const pathname = getPathname();
        if (pathname === ROUTE_MUSIC) return ROUTE_MUSIC;
        if (pathname === panels.library.route) return panels.library.route;
        if (pathname === panels.about.route) return panels.about.route;
        if (pathname === panels.pricing.route) return panels.pricing.route;
        return ROUTE_HOME;
      };

      const applyInitialShellState = () => {
        if (hasAppliedInitialShellState) return;
        hasAppliedInitialShellState = true;
        if (getCurrentRoute() === panels.library.route || getCurrentRoute() === ROUTE_MUSIC) {
          applyPanelStateImmediately(panels.library);
          return;
        }
        if (getCurrentRoute() === panels.about.route) {
          applyPanelStateImmediately(panels.about);
          return;
        }
        if (getCurrentRoute() === panels.pricing.route) {
          applyPanelStateImmediately(panels.pricing);
          return;
        }
        applyHomeStateImmediately();
      };

      const updateRoute = (route, mode = 'pushState') => {
        if (getPathname() === route) return;
        shellRoutePath = route;
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
      };

      const playVideoFromStart = (video, playbackRate = 1) => {
        if (!video) return Promise.resolve();
        try {
          video.currentTime = 0;
          video.playbackRate = playbackRate;
        } catch (_) {}
        const playPromise = video.play();
        if (playPromise && typeof playPromise.catch === 'function') {
          return playPromise.catch(() => {});
        }
        return Promise.resolve();
      };

      const waitForVideoEnd = (video, fallbackMs) =>
        new Promise((resolve) => {
          if (!video) {
            resolve();
            return;
          }
          let settled = false;
          let timeoutId = 0;
          const done = () => {
            if (settled) return;
            settled = true;
            video.removeEventListener('ended', done);
            if (timeoutId) window.clearTimeout(timeoutId);
            resolve();
          };
          video.addEventListener('ended', done, { once: true });
          timeoutId = window.setTimeout(done, fallbackMs);
        });

      const playPanelMenu = (panel) => {
        if (!panel || !panel.menu || !panel.reverseMenu) return;
        panel.menu.classList.remove('is-hidden');
        panel.reverseMenu.classList.add('is-hidden');
        try {
          panel.menu.currentTime = 0;
        } catch (_) {}
        try {
          panel.reverseMenu.pause();
          panel.reverseMenu.currentTime = 0;
        } catch (_) {}
        const panelMenuPromise = playVideoFromStart(panel.menu);
        if (panelMenuPromise && typeof panelMenuPromise.catch === 'function') {
          panelMenuPromise.catch(() => {});
        }
      };

      const playPricingMenu = () => {
        clearPricingMenuDelay();
        panels.pricing.menu.classList.remove('is-hidden');
        panels.pricing.reverseMenu.classList.add('is-hidden');
        try {
          panels.pricing.menu.currentTime = 0;
        } catch (_) {}
        try {
          panels.pricing.reverseMenu.pause();
          panels.pricing.reverseMenu.currentTime = 0;
        } catch (_) {}
        pricingMenuDelayTimer = window.setTimeout(() => {
          pricingMenuDelayTimer = 0;
          const pricingMenuPromise = playVideoFromStart(panels.pricing.menu);
          if (pricingMenuPromise && typeof pricingMenuPromise.catch === 'function') {
            pricingMenuPromise.catch(() => {});
          }
        }, PRICING_REVEAL_DELAY_MS);
      };

      const getActivePanel = () => panels[activePanelKey] || null;

      const replayPanelLoop = () => {
        const panel = getActivePanel();
        if (!panel) return;
        try {
          panel.sectionVideo.currentTime = PANEL_LOOP_START;
          const replayPromise = panel.sectionVideo.play();
          if (replayPromise && typeof replayPromise.catch === 'function') {
            replayPromise.catch(() => {});
          }
        } catch (_) {}
      };

      const stopPanelLoopWatcher = () => {
        if (panelLoopTimer) {
          window.clearInterval(panelLoopTimer);
          panelLoopTimer = 0;
        }
      };

      const setPanelExpandOrigin = (panel) => {
        if (!panel) return;
        const stageRect = mockupStage.getBoundingClientRect();
        const slotRect = panel.slot.getBoundingClientRect();
        const slotCenterX = slotRect.left + (slotRect.width / 2);
        const slotCenterY = slotRect.top + (slotRect.height / 2);
        const stageCenterX = stageRect.left + (stageRect.width / 2);
        const stageCenterY = stageRect.top + (stageRect.height / 2);
        const translateX = slotCenterX - stageCenterX;
        const translateY = slotCenterY - stageCenterY;
        const scaleX = Math.max(slotRect.width / Math.max(stageRect.width, 1), 0.08);
        const scaleY = Math.max(slotRect.height / Math.max(stageRect.height, 1), 0.08);

        panel.overlay.style.setProperty('--about-expand-x', `${translateX}px`);
        panel.overlay.style.setProperty('--about-expand-y', `${translateY}px`);
        panel.overlay.style.setProperty('--about-expand-scale-x', scaleX.toFixed(4));
        panel.overlay.style.setProperty('--about-expand-scale-y', scaleY.toFixed(4));
      };

      const startPanelLoopWatcher = (panel) => {
        stopPanelLoopWatcher();
        if (!panel) return;
        panelLoopTimer = window.setInterval(() => {
          if (activePanelKey !== panel.key) return;
          if (panel.sectionVideo.paused || panel.sectionVideo.seeking) return;
          if (panel.sectionVideo.currentTime >= PANEL_LOOP_END) {
            replayPanelLoop();
          }
        }, 24);
      };

      const hideAllHomeMenus = () => {
        Object.values(panels).forEach((panel) => {
          if (!panel.menu || !panel.reverseMenu) return;
          panel.menu.classList.add('is-hidden');
          panel.reverseMenu.classList.add('is-hidden');
          try {
            panel.menu.pause();
            panel.menu.currentTime = 0;
          } catch (_) {}
          try {
            panel.reverseMenu.pause();
            panel.reverseMenu.currentTime = 0;
          } catch (_) {}
        });
      };

      const resetPanelTransforms = (panel) => {
        if (!panel) return;
        panel.overlay.style.setProperty('--about-expand-x', '0px');
        panel.overlay.style.setProperty('--about-expand-y', '0px');
        panel.overlay.style.setProperty('--about-expand-scale-x', '1');
        panel.overlay.style.setProperty('--about-expand-scale-y', '1');
      };

      const applyPanelStateImmediately = (panel) => {
        if (!panel) return;
        clearPanelStageTimers();
        stopPanelLoopWatcher();
        Object.values(panels).forEach((entry) => {
          entry.hitbox.disabled = true;
          entry.overlay.classList.remove('is-visible', 'is-expanded', 'is-energized', 'is-content-visible', 'is-closing');
          entry.overlay.setAttribute('aria-hidden', 'true');
          try {
            entry.sectionVideo.pause();
            entry.sectionVideo.currentTime = 0;
          } catch (_) {}
          if (entry.titleVideo) {
            try {
              entry.titleVideo.pause();
              entry.titleVideo.currentTime = 0;
            } catch (_) {}
          }
        });
        if (welcomeCopy) {
          welcomeCopy.classList.add('is-hidden');
        }
        hideAllHomeMenus();
        mockupStage.classList.add('is-panel-open');
        panel.overlay.classList.remove('is-closing');
        panel.overlay.classList.add('is-visible', 'is-expanded', 'is-energized', 'is-content-visible');
        panel.overlay.setAttribute('aria-hidden', 'false');
        activePanelKey = panel.key;
        if (panel.key === 'library') {
          initMusicStatusSignals();
          initWrestlingStatusSignals();
          startLibraryGlass();
        } else {
          stopLibraryGlass();
        }
        try {
          panel.sectionVideo.pause();
          panel.sectionVideo.currentTime = PANEL_LOOP_START;
        } catch (_) {}
        const panelPlayPromise = panel.sectionVideo.play();
        if (panelPlayPromise && typeof panelPlayPromise.catch === 'function') {
          panelPlayPromise.catch(() => {});
        }
        if (panel.key === 'pricing') {
          setPricingMode('prints', { restartTitle: true });
        }
        if (panel.titleVideo) {
          try {
            panel.titleVideo.pause();
            panel.titleVideo.currentTime = panel.titleVideo.duration || 9999;
          } catch (_) {}
        }
        startPanelLoopWatcher(panel);
      };

      const applyHomeStateImmediately = () => {
        clearPanelStageTimers();
        stopPanelLoopWatcher();
        Object.values(panels).forEach((panel) => {
          panel.overlay.classList.remove('is-visible', 'is-expanded', 'is-energized', 'is-content-visible', 'is-closing');
          panel.overlay.setAttribute('aria-hidden', 'true');
          panel.hitbox.disabled = false;
          resetPanelTransforms(panel);
          try {
            panel.sectionVideo.pause();
            panel.sectionVideo.currentTime = 0;
          } catch (_) {}
          if (panel.titleVideo) {
            try {
              panel.titleVideo.pause();
              panel.titleVideo.currentTime = 0;
            } catch (_) {}
          }
        });
        stopLibraryGlass();
        mockupStage.classList.remove('is-panel-open');
        activePanelKey = '';
        setPricingMode('prints');
        if (welcomeCopy) {
          welcomeCopy.classList.remove('is-hidden');
          welcomeCopy.classList.add('is-visible');
        }
        playPanelMenu(panels.about);
        playPricingMenu();
      };

      const openPanelSequence = async (panel, options = {}) => {
        const { updateBrowserRoute = true } = options;
        if (!panel || isTransitioning || activePanelKey) return;
        isTransitioning = true;
        Object.values(panels).forEach((entry) => {
          entry.hitbox.disabled = true;
        });
        if (welcomeCopy) {
          welcomeCopy.classList.add('is-hidden');
        }
        hideAllHomeMenus();
        clearPricingMenuDelay();
        if (panel.menu) {
          try {
            panel.menu.pause();
          } catch (_) {}
        }
        await playVideoFromStart(panel.reverseMenu, 2.5);
        await waitForVideoEnd(panel.reverseMenu, 200);
        setPanelExpandOrigin(panel);
        clearPanelStageTimers();
        Object.values(panels).forEach((entry) => {
          if (entry !== panel) {
            entry.overlay.classList.remove('is-visible', 'is-expanded', 'is-energized', 'is-content-visible', 'is-closing');
            entry.overlay.setAttribute('aria-hidden', 'true');
          }
        });
        panel.overlay.classList.remove('is-expanded', 'is-energized', 'is-content-visible', 'is-closing');
        mockupStage.classList.add('is-panel-open');
        panel.overlay.classList.add('is-visible');
        panel.overlay.setAttribute('aria-hidden', 'false');
        activePanelKey = panel.key;
        if (panel.key === 'library') {
          initMusicStatusSignals();
          initWrestlingStatusSignals();
          startLibraryGlass();
        } else {
          stopLibraryGlass();
        }
        if (panel.key === 'pricing') {
          setPricingMode('prints', { restartTitle: true });
        }
        await playVideoFromStart(panel.sectionVideo);
        await playVideoFromStart(panel.titleVideo);
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => {
            panel.overlay.classList.add('is-expanded');
          });
        });
        queuePanelStage(() => {
          panel.overlay.classList.add('is-energized');
        }, 240);
        queuePanelStage(() => {
          panel.overlay.classList.add('is-content-visible');
        }, isMobileOptimizedViewport() ? 260 : 320);
        startPanelLoopWatcher(panel);
        if (updateBrowserRoute) {
          updateRoute(panel.route);
        }
        isTransitioning = false;
      };

      const closeActivePanelSequence = async (options = {}) => {
        const { updateBrowserRoute = true } = options;
        const panel = getActivePanel();
        if (isTransitioning || !panel) return;
        isTransitioning = true;
        clearPanelStageTimers();
        stopPanelLoopWatcher();
        panel.overlay.classList.add('is-closing');
        panel.overlay.classList.remove('is-content-visible');
        panel.overlay.classList.remove('is-energized');
        try {
          panel.sectionVideo.pause();
          panel.sectionVideo.currentTime = 0;
        } catch (_) {}
        if (panel.titleVideo) {
          try {
            panel.titleVideo.pause();
            panel.titleVideo.currentTime = 0;
          } catch (_) {}
        }
        await wait(500);
        panel.overlay.classList.remove('is-visible');
        await wait(260);
        panel.overlay.classList.remove('is-expanded');
        panel.overlay.classList.remove('is-closing');
        panel.overlay.setAttribute('aria-hidden', 'true');
        stopLibraryGlass();
        mockupStage.classList.remove('is-panel-open');
        activePanelKey = '';
        setPricingMode('prints');
        playPanelMenu(panels.about);
        playPricingMenu();
        Object.values(panels).forEach((entry) => {
          entry.hitbox.disabled = false;
          resetPanelTransforms(entry);
        });
        if (welcomeCopy) {
          welcomeCopy.classList.remove('is-hidden');
          welcomeCopy.classList.add('is-visible');
        }
        if (updateBrowserRoute) {
          updateRoute(ROUTE_HOME);
        }
        isTransitioning = false;
      };

      const playPromise = backgroundVideo.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {});
      }

      try {
        dollReveal.currentTime = 0;
      } catch (_) {}

      const revealPromise = dollReveal.play();
      if (revealPromise && typeof revealPromise.catch === 'function') {
        revealPromise.catch(() => {});
      }

      window.setTimeout(() => {
        topbar.classList.add('is-visible');
      }, 520);

      window.setTimeout(() => {
        if (welcomeCopy) {
          welcomeCopy.classList.add('is-visible');
        }
      }, 760);

      window.setTimeout(() => {
        applyInitialShellState();
      }, 900);

      aboutHitbox.addEventListener('click', () => {
        openPanelSequence(panels.about);
      });

      topbarLogoButton.addEventListener('click', () => {
        if (isTransitioning || activePanelKey) return;
        armLogoGateway().then(() => {
          openPanelSequence(panels.library);
        });
      });

      pricingHitbox.addEventListener('click', () => {
        openPanelSequence(panels.pricing);
      });

      pricingNavButtons.forEach((button) => {
        button.addEventListener('click', () => {
          if (activePanelKey !== panels.pricing.key || isTransitioning) return;
          button.classList.remove('is-pressed');
          void button.offsetWidth;
          button.classList.add('is-pressed');
          window.setTimeout(() => {
            button.classList.remove('is-pressed');
          }, 320);
          if (button.dataset.pricingNav === 'next') {
            setPricingMode('hire', { animate: true, direction: 'next' });
            return;
          }
          setPricingMode('prints', { animate: true, direction: 'prev' });
        });
      });

      Object.values(panels).forEach((panel) => {
        panel.overlay.addEventListener('click', (event) => {
          if (activePanelKey !== panel.key || isTransitioning) return;
          if (panel.copy.contains(event.target)) return;
          closeActivePanelSequence();
        });

        panel.sectionVideo.addEventListener('ended', () => {
          if (activePanelKey !== panel.key) return;
          replayPanelLoop();
        });
      });

      window.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        closeActivePanelSequence();
      });

      window.addEventListener('popstate', () => {
        const route = getCurrentRoute();
        if (route === ROUTE_MUSIC) {
          if (activePanelKey === panels.library.key) return;
          if (activePanelKey) {
            applyPanelStateImmediately(panels.library);
            return;
          }
          openPanelSequence(panels.library, { updateBrowserRoute: false });
          return;
        }
        if (route === panels.library.route) {
          if (activePanelKey === panels.library.key) return;
          if (activePanelKey) {
            applyPanelStateImmediately(panels.library);
            return;
          }
          openPanelSequence(panels.library, { updateBrowserRoute: false });
          return;
        }
        if (route === panels.about.route) {
          if (activePanelKey === panels.about.key) return;
          if (activePanelKey) {
            applyPanelStateImmediately(panels.about);
            return;
          }
          openPanelSequence(panels.about, { updateBrowserRoute: false });
          return;
        }
        if (route === panels.pricing.route) {
          if (activePanelKey === panels.pricing.key) return;
          if (activePanelKey) {
            applyPanelStateImmediately(panels.pricing);
            return;
          }
          openPanelSequence(panels.pricing, { updateBrowserRoute: false });
          return;
        }
        if (!activePanelKey) return;
        closeActivePanelSequence({ updateBrowserRoute: false });
      });

      window.addEventListener('beforeunload', () => {
        stopPanelLoopWatcher();
        clearPanelStageTimers();
        clearPricingMenuDelay();
        musicRowCanvasCleanups.forEach((cleanup) => cleanup());
      });

      window.addEventListener('message', (event) => {
        const data = event && event.data;
        if (!data || data.type !== 'vmTestingRouteSync') return;
        const nextRoute =
          data.route === ROUTE_MUSIC
            ? ROUTE_MUSIC
            : data.route === panels.library.route
            ? panels.library.route
            : data.route === panels.about.route
            ? panels.about.route
            : data.route === panels.pricing.route
              ? panels.pricing.route
              : ROUTE_HOME;
        shellRoutePath = nextRoute;
        if (!hasAppliedInitialShellState) {
          applyInitialShellState();
          return;
        }
        if (nextRoute === ROUTE_MUSIC) {
          if (activePanelKey !== panels.library.key) {
            if (activePanelKey) {
              applyPanelStateImmediately(panels.library);
            } else {
              openPanelSequence(panels.library, { updateBrowserRoute: false });
            }
          }
          return;
        }
        if (nextRoute === panels.library.route) {
          if (activePanelKey !== panels.library.key) {
            if (activePanelKey) {
              applyPanelStateImmediately(panels.library);
            } else {
              openPanelSequence(panels.library, { updateBrowserRoute: false });
            }
          }
          return;
        }
        if (nextRoute === panels.about.route) {
          if (activePanelKey !== panels.about.key) {
            if (activePanelKey) {
              applyPanelStateImmediately(panels.about);
            } else {
              openPanelSequence(panels.about, { updateBrowserRoute: false });
            }
          }
          return;
        }
        if (nextRoute === panels.pricing.route) {
          if (activePanelKey !== panels.pricing.key) {
            if (activePanelKey) {
              applyPanelStateImmediately(panels.pricing);
            } else {
              openPanelSequence(panels.pricing, { updateBrowserRoute: false });
            }
          }
          return;
        }
        if (activePanelKey) {
          closeActivePanelSequence({ updateBrowserRoute: false });
          return;
        }
        applyHomeStateImmediately();
      });

      window.addEventListener('resize', () => {
        syncMobileShellMode();
        if (!activePanelKey) return;
        resetPanelTransforms(getActivePanel());
      });

      if (getCurrentRoute() !== ROUTE_HOME) {
        window.requestAnimationFrame(() => {
          applyInitialShellState();
        });
      }

      syncMobileShellMode();
      preloadLibraryGlassImages();

      if (getPathname() !== getCurrentRoute()) {
        updateRoute(getCurrentRoute(), 'replaceState');
      }
    })();
