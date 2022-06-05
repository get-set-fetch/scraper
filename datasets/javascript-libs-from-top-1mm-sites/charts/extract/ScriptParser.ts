/* eslint-disable no-continue */
import fs from 'fs';
import { addToNestedMap } from '../../../utils/map';

export default class ScriptParser {
  keywords: Set<string>;
  invalidURLs: string[] = [];

  // based on script.src URL, count frequency under Map<hostname, Map<pathname, count>>
  scripts:Map<string, Map<string, number>>;

  constructor() {
    this.keywords = this.generateKeywords();
    this.scripts = new Map();
  }

  parse(filepath: string):Promise<Map<string, Map<string, number>>> {
    return new Promise(resolve => {
      let lastRow = '';
      let parsedRows = 0;
      const readable = fs.createReadStream(filepath);
      readable.setEncoding('utf8');
      let headerRemoved = false;

      readable.on('error', error => {
        console.error(`error: ${error.message}`);
      });

      readable.on('data', (chunk: string) => {
        let rows = `${lastRow}${chunk}`.split(/\r?\n(?=http)|\r(?=http)/);

        if (!headerRemoved) {
          rows = rows.slice(1);
          headerRemoved = true;
        }

        lastRow = rows.pop();
        parsedRows += rows.length;
        rows.forEach(row => this.parseRow(row.toLowerCase()));

        process.stdout.write(`\r${parsedRows} rows parsed`.padEnd(30, ' '));
      });

      readable.on('end', () => {
        if (lastRow) {
          this.parseRow(lastRow);
        }
        fs.writeFileSync('../invalid-urls.csv', this.invalidURLs.join('\n'));
        resolve(this.scripts);
      });
    });
  }

  parseRow(row: string) {
    // only add a hostname/pathname script once per scraped URL
    const addedScripts: string[] = [];

    // data:text/javascript;base64,
    const sanitizedRow = row.replace(/"data:[^"]+"/g, '').replace(/"|\r?\n|\r|/g, '');
    const vals = sanitizedRow.split(',');

    for (let i = 1; i < vals.length; i += 1) {
      const isInlineScript = vals[i] === '<inline>';
      if (isInlineScript) continue;

      const isInvalidScript = /function\s*\(|^(http)*:*[/\\]+$/.test(vals[i]);
      if (isInvalidScript) continue;

      try {
        const url = new URL(vals[i], vals[0]);
        const script = this.getScriptName(url);

        // script name can be empty when url is absolute without a pathname
        if (script.length > 0 && !addedScripts.includes(script)) {
          addToNestedMap(this.scripts, url.hostname, script);
          addedScripts.push(script);
        }
      }
      catch (err) {
        this.invalidURLs.push(vals[i]);
      }
    }
  }

  getScriptName(url: URL) {
    const { pathname, hostname } = url;

    // group well known scripts (identified from non-grouped parsing) based on hostname
    switch (hostname) {
      case 'stats.wp.com':
        return 'wordpress-stats';
      case 'maps.googleapis.com':
        return 'google-maps';
      case 'static.cloudflareinsights.com':
        return 'cloudflare-insights';
      default:
    }

    // remove suffix starting from '.js'
    // const sanitizedPathname = pathname.replace(/\.min\.js|\.js.*/, '');
    const pathFrags = this.getSanitizedFrags(pathname); // sanitizedPathname.split('/').filter(pathFrag => pathFrag.length > 0);

    // on scripts with empty pathnames use the hostname
    if (pathFrags.length === 0) return hostname;

    const scriptFrags = [];
    let lastFrag: string;
    do {
      lastFrag = pathFrags.pop();
      scriptFrags.push(lastFrag);
    }
    while (lastFrag && this.isGenericKeyword(lastFrag));

    // for paths with just generic keywords (like js/menu.js) use the hostname
    if (!lastFrag) return `${hostname}${scriptFrags.reverse().join('/')}`;

    // detect wordpress plugins: wp-content/plugins/plugin-name/
    const wpPluginMatch = pathname.match(/\/wp-content\/plugins\/([^/]+)\//);
    if (wpPluginMatch && wpPluginMatch[1]) return `wordpress-${wpPluginMatch[1]}`;

    // detect wordpress core
    if (/\/wp-includes\/.*(wp-polyfill|wp-embed|regenerator-runtime|hooks|comment-reply)/.test(pathname)) return 'wordpress-core';

    return scriptFrags.reverse().join('/');
  }

  getSanitizedFrags(pathname: string) {
    // remove suffix starting from '.min.js',
    const sanitizedPathname = pathname.replace(/\.min\.js|\.js.*/, '');

    const pathFrags = sanitizedPathname.split('/');
    return pathFrags.map(pathFrag => this.getSanitizedFrag(pathFrag)).filter(pathFrag => pathFrag);
  }

  getSanitizedFrag(pathFrag: string) {
    const pathSegments = pathFrag.split('-').filter(seg => seg);

    const a = pathSegments
      .filter(pathSegment => !(
      // more then 4 digits in a fragment => unique id not related to script name
        pathSegment.match(/\d/g)?.length >= 4

      // ignore frags like min.en
      || /^min$|^min\..{0,2}$/.test(pathSegment)

      // ignore frags like en_US
      || /^en_.{0,2}$/.test(pathSegment)

      // ignore frags like v_1.2.3
      || /^v*[_.\d]+$/.test(pathSegment)

      // ignore certain fixed fragments
      || [ 'js' ].includes(pathSegment)
      ))
      .join('-');

    return a;
  }

  generateKeywords() {
    return new Set([
      'index', 'core', 'script', 'scripts', 'main', 'custom', 'js', 'includes', 'api', 'ui', 'frontend', 'dialog', 'navigation',
      'front', 'common', 'app', 'widget', 'widgets', 'asset', 'assets', 'function', 'functions', 'plugin', 'plugins',
      'polyfill', 'polyfills', 'theme', 'menu', 'all', 'vendor', 'sdk', 'public', 'site', 'init', 'admin', 'platform',
      'wow', 'ajax', 'select', 'select2', 'chunk', 'chunks', 'element', 'global', 'analytics', 'page', 'loader', 'bundle', 'legacy',
      'min', 'embed', 'px', 'modern', 'uc', 'form', 'javascript', 'static', 'file', 'files', 'feature', 'features', 'cache',
      'storefront', 'dist', 'framework', 'button', 'buttons', 'base', 'home', 'datepicker',
    ]);
  }

  isGenericKeyword(name: string):boolean {
    const trimmName = name.replace(/\.js|\.min\.js/, '');
    return this.keywords.has(trimmName) || /^v\d*$|^[.\d]+$/.test(trimmName);
  }
}
