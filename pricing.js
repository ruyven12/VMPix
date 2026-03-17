// Pricing section module
(function () {
  'use strict';

  let _mount = null;

  function trackPricingEvent(eventName, payload) {
    try {
      if (!window.VMPixAnalytics || typeof window.VMPixAnalytics.track !== 'function') return;
      window.VMPixAnalytics.track(eventName, Object.assign({
        source: 'pricing_page',
        section: 'pricing'
      }, payload || {}));
    } catch (_) {}
  }

  function render(mountEl) {
    if (!mountEl) return;
    _mount = mountEl;

    _mount.innerHTML = `
      <div style="max-width:760px; margin:0 auto; opacity:.9; font-size:14px; line-height:1.6; letter-spacing:.04em; text-transform:none;">
        <div style="font-size:24px; text-transform:uppercase; text-decoration:underline;"><strong>Pricing for Prints</strong></div><br>

        <div style="opacity:.85; margin-bottom:16px;">
          All photographs on this site that were not taken with a cell phone are available for purchase in a variety of formats. These images have been used for posters, signed wrestler prints, trading cards, and other promotional and personal projects.
        </div>

        <div style="opacity:.85; margin-bottom:20px;">
          The pricing below reflects my current print options. I strive to keep pricing straightforward and affordable. If you have a specific size, quantity, or use in mind that isn’t listed, please feel free to reach out — I’m always happy to discuss custom options.
        </div>

        <div style="font-size:20px; text-decoration:underline;"><strong>Print Pricing (Per Quantity)</strong></div><br>
        <div style="opacity:.9; margin-bottom:24px;">
          Set of 8 Wallet Prints – $7<br>
          4×6 – $1<br>
          5×7 – $3<br>
          8×10 – $5<br>
          8×12 – $7<br>
          11×14 – $8<br>
          12×18 – $15<br>
          20×30 – $40<br>
          24×36 – $50
        </div>

        <div style="font-size:24px; text-transform:uppercase; text-decoration:underline;"><strong>Pricing for Hire</strong></div><br>
        <div style="opacity:.85;">
          While I frequently photograph music shows and wrestling events, my work is not limited to those areas. I have experience covering weddings, professional business events, promotional shoots, and a wide range of other projects.
          <br><br>
          Pricing for hired work is primarily based on travel requirements and time commitment. I believe in offering fair and reasonable rates and am flexible depending on the scope of the project. For inquiries or to discuss your specific needs, please reach out through the Contact section.
        </div>
      </div>
    `;
  }

  function onEnter() {
    trackPricingEvent('pricing_view', {
      subsection: '',
      entity_type: 'page',
      entity_id: '/pricing',
      entity_label: 'Pricing'
    });
  }
  function destroy() {
    if (_mount) {
      _mount.innerHTML = '';
      _mount = null;
    }
  }

  window.Pricing = { render, onEnter, destroy };
})();
