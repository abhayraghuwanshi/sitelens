// Google Tag Manager or Google Analytics 4 for kauzl.com's public pages (home,
// tools, guides), so Kauzl can show its own traffic in the live demo. Loaded
// as <script defer src="/tools/assets/ga.js" data-ga="GTM-… or G-…"> because
// the site's CSP allows no inline scripts; it does nothing without an ID.
(function () {
  var me = document.currentScript;
  var id = me && me.getAttribute('data-ga');
  if (!id || !/^(GTM|G)-[A-Z0-9]+$/.test(id)) return;
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;
  var src;
  if (id.indexOf('GTM-') === 0) {
    // Tag Manager: the container decides which tags fire (GA4 and others).
    window.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
    src = 'https://www.googletagmanager.com/gtm.js?id=' + encodeURIComponent(id);
  } else {
    gtag('js', new Date());
    gtag('config', id);
    src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id);
  }
  var s = document.createElement('script');
  s.async = true;
  s.src = src;
  document.head.appendChild(s);
})();
