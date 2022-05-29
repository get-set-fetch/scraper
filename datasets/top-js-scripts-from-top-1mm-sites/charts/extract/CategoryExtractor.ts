import fs from 'fs';

const labels = new Map([
  [ 'jquery', 'jQuery' ],
  [ 'jquery-migrate', 'jQuery Migrate' ],
  [ 'recaptcha/api', 'Google reCAPTCHA' ],
  [ 'slick', 'slick' ],
  [ 'owl.carousel', 'Owl Carousel' ],
  [ 'modernizr', 'Modernizr' ],
  [ 'underscore', 'Underscore' ],
  [ 'i18n', 'i18n' ],
  [ 'email-decode', 'Cloudflare Email Decode' ],

  [ 'gtag', 'Google Analytics' ],
  [ 'wordpress-stats', 'WordPress Stats and Insights' ],
  [ 'frontend-gtag', 'Google Analytics For Wordpress' ],
  [ 'cloudflare-insights', 'Cloudflare Insights' ],
  [ 'www.google-analytics.com/analytics', 'Google Analytics Old Version' ],

  [ 'wordpress-core', 'WordPress Core' ],
  [ 'wordpress-elementor', 'WordPress Elementor' ],
  [ 'wordpress-js-composer', 'WordPress Visual Composer' ],
  [ 'wp-util', 'WordPress Utilities' ],
  [ 'gravityforms', 'Gravity Forms' ],

  [ 'adsbygoogle', 'Google Adsense' ],
  [ 'gpt', 'Google Publisher Tags' ],

  [ 'lazyload', 'LazyLoad' ],
  [ 'lazysizes', 'LazySizes' ],
  [ 'autoptimize', 'WordPress Autoptimize' ],
  [ 'rocket-loader', 'Cloudflare Rocket Loader' ],

  [ 'jquery.cookie', 'jQuery Cookie' ],
  [ 'js.cookie', 'JavaScript Cookie' ],
  [ 'cookieconsent', 'Cookie Consent' ],
  [ 'cookie-law-info-public', 'Cookie Law Info' ],
  [ 'otsdkstub', 'OneTrust Cookies Consent' ],
  [ 'cookie-notice/front', 'Cookie Notice' ],

  [ 'bootstrap', 'Bootstrap' ],
  [ 'wordpress-contact-form-7', 'WordPress Contact Form 7' ],
  [ 'jquery/ui/core', 'jQuery UI' ],
  [ 'jquery-ui', 'jQuery UI' ],
  [ 'imagesloaded', 'imagesLoaded' ],
  [ 'jquery.flexslider', 'jQuery FlexSlider' ],
  [ 'popper', 'Popper' ],
  [ 'jquery.magnific-popup', 'jQuery Magnific Popup' ],
  [ 'jquery.fancybox', 'jQuery Fancybox' ],
  [ 'google-maps', 'Google Maps' ],

]);

const categories = new Map([
  [ 'Utils', [
    'jquery', 'jquery-migrate', 'recaptcha/api', 'slick', 'owl.carousel', 'modernizr', 'underscore', 'i18n',
    'email-decode',
  ] ],

  [ 'Analytics', [
    'gtag', 'wordpress-stats', 'frontend-gtag', 'cloudflare-insights', 'www.google-analytics.com/analytics',
    'gtm4wp-form-move-tracker',
  ] ],

  [ 'CMS', [
    'wordpress-core', 'wordpress-elementor', 'wordpress-js-composer', 'wp-util', 'gravityforms',
  ] ],

  [ 'Advertising', [
    'adsbygoogle', 'gpt',
  ] ],

  [ 'Optimization', [
    'lazyload', 'lazysizes', 'autoptimize', 'rocket-loader', 'imagesLoaded', 'smush-lazy-load', 'optimize',
  ] ],

  [ 'Cookies', [
    'jquery.cookie', 'js.cookie', 'cookieconsent', 'cookie-law-info-public', 'otsdkstub', 'cookie-notice/front',
    'consent.cookiebot.com/uc',
  ] ],

  [ 'UI Widgets', [
    'bootstrap', 'wordpress-contact-form-7', 'jquery/ui/core', 'imagesloaded', 'jquery-ui',
    'jquery.flexslider', 'popper', 'jquery.magnific-popup', 'jquery.fancybox', 'google-maps',
  ] ],

]);

/*
loading:
  require, webpack

utils:
  jquery, jquery-migrate, recaptcha/api, slick, owl.carousel, modernizr, underscore', i18n', email-decode
  skip-link-focus-fix, hoverintent, a11y, jquery.validate, jquery.mousewheel
  moment, translate_a/element, conversion, autocomplete, jquery.matchheight
  modernizr.custom, waypoints, lodash, polyfill.io/polyfill, jquery-noconflict

ui widgets/layout:
  bootstrap, wordpress-contact-form-7, jquery/ui/core, imagesloaded, jquery-ui
  jquery.flexslider, popper, jquery.magnific-popup, jquery.fancybox, google-maps
  datepicker, jquery.easing, jquery.fitvids, mediaelement-and-player,
  wordpress-revolution-slider, mouse, masonry, superfish, mediaelement-migrate
  wp-mediaelement, rbtools, jquery.bxslider, tabs, slider, swiper
  wordpress-divi-theme, jquery.themepunch.revolution, jquery.easing.1.3
  photon, jquery.themepunch.tools, kit.fontawesome.com, forms, jquery.form
  jquery.waypoints, bootstrap.bundle, isotope.pkgd, accordion, lightbox
  jquery.prettyphoto, jquery.touchswipe, jquery.colorbox, onesignalsdk,
  jquery.masonry, webresource.axd, effect
  placeholders.jquery, jquery/ui/menu, sortable, draggable,
  jquery.countdown, tagdiv_theme, webfont,
  jquery.fancybox.pack, tooltip, jquery.sticky,
  theia-sticky-sidebar, fitvids

ecommerce:
  wordpress-woocommerce
  load_feature (shopify)

fonts:

cms:
  wordpress-core, wordpress-elementor, wordpress-js-composer, wp-util, gravityforms
  js.hs-scripts.com (crm), drupal, cldr-resource-pack-us

social media:
  platform.twitter.com/widgets, addthis_widget, static.addtoany.com/menu/page, addtoany
  connect.facebook.net/sdk

frameworks:

*/

export default class CategoryExtractor {
  data:Map<string, Map<string, number>>;

  parse(filepath: string) {
    this.data = new Map();
    const rawData = fs.readFileSync(filepath, { encoding: 'utf8' }).split(/\r?\n|\r/);

    // line example: script,count
    rawData.forEach(line => {
      const row = line.split(',');
      const script = row[0];
      const count = parseInt(row[1], 10);

      const ctg = this.getCategory(script);
      if (ctg !== 'other') {
        const label = labels.get(script) || script;
        if (!this.data.has(ctg)) this.data.set(ctg, new Map());
        if (!this.data.get(ctg).get(label)) this.data.get(ctg).set(label, 0);
        this.data.get(ctg).set(label, this.data.get(ctg).get(label) + count);
      }
    });

    console.log(this.data);
  }

  getCategory(script: string) {
    let foundCtg;
    categories.forEach(
      (scripts, ctg) => {
        if (scripts.includes(script)) foundCtg = ctg;
      },
    );

    return foundCtg || 'other';
  }

  toCsv() {
    const header = 'category,script,value';
    const content = [];
    this.data.forEach(
      (scripts, ctg) => {
        scripts.forEach(
          (count, script) => content.push([ ctg, script, count ]),
        );
      },
    );

    return `${header}\n${content.join('\n')}`;
  }
}
