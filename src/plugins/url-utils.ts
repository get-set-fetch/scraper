export const enum Protocol {
  HTTPS = 'https:', HTTP = 'http:'
}

/**
 * URL normalization including adding protocol prefix if missing.
 * Mostly used in batch insert jobs.
 * @param rawUrl - input url
 * @param defaultProtocol - protocol to add if one is not present, defaults to https
 * @throws error on invalid urls
 * @returns normalized url
 */
export function normalizeUrl(rawUrl: string, defaultProtocol:string = Protocol.HTTPS):string {
  if (!this.isURL(rawUrl)) throw new Error(`error normalizing url: ${rawUrl}`);

  // if protocol is missing, add default one
  const fullUrl = rawUrl.split('//').length === 1 ? `${defaultProtocol}//${rawUrl}` : rawUrl;
  return new URL(fullUrl).toString();
}

/**
 * Identify the csv column containing an url
 * @param csvRow - csv row with columns separated by ','
 */
export function getUrlColIdx(csvRow: string):number {
  const urlIdx = csvRow.split(',').map(col => col.trim()).findIndex(col => this.isURL(col));
  if (urlIdx === -1) throw new Error(`could not detect url column from ${csvRow}`);
  return urlIdx;
}

/**
 * Check if a url is valid based on regex. Protocol prefix is optional.
 * @param url - input candidate
 * @returns - whether or not the input url is valid
 */
export function isURL(url: string):boolean {
  return /([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}/.test(url.toLowerCase());
}
