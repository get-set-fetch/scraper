export const enum Protocol {
  HTTPS = 'https:', HTTP = 'http:'
}

/**
 * URL normalization including adding protocol prefix if missing
 * make sure we don't end up with equivalent but syntactically different URIs
 * ex: http://sitea.com, http://sitea.com/, http://SitEa.com
 */
export function normalizeUrl(rawUrl: string, defaultProtocol:string = Protocol.HTTPS):string {
  try {
    if (!this.isURL(rawUrl)) throw new Error(`error normalizing url: ${rawUrl}`);

    // if protocol is missing, add default one
    const fullUrl = rawUrl.split('//').length === 1 ? `${defaultProtocol}//${rawUrl}` : rawUrl;
    return new URL(fullUrl).toString();
  }
  catch (err) {
    this.logger.error(err);
  }

  return undefined;
}

/**
 * Identify the csv column containing an url
 * @param csvRow - csv row with columns separated by ','
 */
export function getUrlColIdx(csvRow: string):number {
  return csvRow.split(',').map(col => col.trim()).findIndex(col => this.isURL(col));
}

/**
 * Check if a url is valid based on regex. Protocol prefix is optional.
 * @param url - input candidate
 * @returns - whether or not the input url is valid
 */
export function isURL(url: string):boolean {
  return /([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}/.test(url.toLowerCase());
}
