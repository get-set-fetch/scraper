import http, { IncomingMessage, OutgoingHttpHeaders } from 'http';
import https, { Agent, RequestOptions } from 'https';
import dns from 'dns';
import { pipeline, Writable } from 'stream';
import zlib from 'zlib';
import { SecureContextOptions } from 'tls';
import { getLogger } from '../../logger/Logger';
import { SchemaType } from '../../schema/SchemaHelper';
import Resource from '../../storage/base/Resource';
import { Protocol } from '../url-utils';
import BaseFetchPlugin, { FetchError } from './BaseFetchPlugin';

const enum DNS_RESOLUTION {
  LOOKUP = 'lookup',
  RESOLVE = 'resolve'
}

export default class NodeFetchPlugin extends BaseFetchPlugin {
  static get schema() {
    return {
      type: 'object',
      title: 'Node Fetch Plugin',
      description: 'fetch resources via nodejs https/http',
      properties: {
        headers: {
          type: 'object',
          additionalProperties: {
            type: 'string',
          },
          default: {
            'Accept-Encoding': 'br,gzip,deflate',
          },
        },
        tlsCheck: {
          type: 'boolean',
          default: true,
          description: 'Check server certificate, certificate and hostname match',
        },
        connectTimeout: {
          type: 'number',
          default: 10 * 1000,
        },
        readTimeout: {
          type: 'number',
          default: 20 * 1000,
        },
        dnsResolution: {
          type: 'string',
          default: 'lookup',
          title: 'DNS Resolution',
          description: 'Use "lookup" to take into account local configuration files like /etc/hosts. Use "resolve" to always perform dns queries over the network.',
        },
      },
    } as const;
  }

  logger = getLogger('NodeFetchPlugin');
  opts: SchemaType<typeof NodeFetchPlugin.schema>;
  agent: Agent;

  constructor(opts: SchemaType<typeof NodeFetchPlugin.schema> = {}) {
    super(opts);

    if (!this.opts.tlsCheck) {
      this.agent = new Agent({
        // disable cert/server match for tls connections
        checkServerIdentity: () => undefined,
        // ignore any tls related errors
        rejectUnauthorized: false,
      });
    }
  }

  getRequestFnc(protocol: string): (options: RequestOptions, callback?: (res: http.IncomingMessage) => void) => http.ClientRequest {
    switch (protocol) {
      case 'https:':
        return https.request;
      case 'http:':
        return http.request;
      default:
        throw new Error('protocol must be either https or http');
    }
  }

  async getRequestOptions(url:URL, resource: Resource):Promise<RequestOptions & SecureContextOptions> {
    const { hostname, protocol, pathname } = url;
    let reqHost = hostname;

    if (this.opts.dnsResolution === DNS_RESOLUTION.RESOLVE) {
      reqHost = await new Promise((resolve, reject) => {
        dns.resolve(hostname, (err, records) => {
          /*
          just take the 1st return ip address,
          this plugin doesn't have capabilities to retry multiple urls/ips for a single resource
          */
          if (err) {
            reject(err);
          }
          else {
            this.logger.debug(`${hostname} resolved to ${records[0]}`);
            resolve(records[0]);
          }
        });
      });
    }

    const reqHeaders: OutgoingHttpHeaders = {
      Host: hostname,
      'Accept-Encoding': 'br,gzip,deflate',
      ...(<object> this.opts.headers),
    };

    return {
      method: 'GET',
      defaultPort: protocol === Protocol.HTTPS ? 443 : 80,
      path: pathname,
      host: reqHost,
      headers: reqHeaders,
      timeout: this.opts.connectTimeout,
      rejectUnauthorized: this.opts.tlsCheck,
      agent: protocol === Protocol.HTTPS && !this.opts.tlsCheck ? this.agent : undefined,
      ...resource.proxy,
    };
  }

  async fetch(resource: Resource): Promise<Partial<Resource>> {
    return new Promise(async (resolve, reject) => {
      try {
        const url = new URL(resource.url);
        const requestFnc = this.getRequestFnc(url.protocol);
        const opts = await this.getRequestOptions(url, resource);
        this.logger.debug(opts, 'Request Options');

        const req = requestFnc(opts, (res: IncomingMessage) => {
          try {
            const { statusCode, headers } = res;

            this.logger.debug(`status code for ${resource.url} : ${statusCode}`);

            // don't have access to initial redirect status can't chain back to the original redirect one, always put 301
            if (this.isRedirectStatus(statusCode)) {
              reject(new FetchError(statusCode, new URL(headers.location, resource.url).toString()));
            }

            // don't proceed further unless we have a valid status
            if (!this.isValidStatus(statusCode)) {
              reject(new FetchError(statusCode));
            }

            const contentType = this.getContentType(headers['content-type']);

            const chunks = [];
            const output = new Writable({
              write(chunk, encoding, done) {
                chunks.push(Buffer.from(chunk));
                done();
              },
            });

            const onComplete = err => {
              if (err) {
                reject(err);
              }
              else {
                const buffer = Buffer.concat(chunks);
                resolve({ data: buffer, contentType, status: statusCode });
              }
            };
            this.logger.debug(res.headers, `response headers for ${resource.url}`);

            switch (res.headers['content-encoding']) {
              case 'br':
                pipeline(res, zlib.createBrotliDecompress(), output, onComplete);
                break;
              case 'gzip':
                pipeline(res, zlib.createGunzip(), output, onComplete);
                break;
              case 'deflate':
                pipeline(res, zlib.createInflate(), output, onComplete);
                break;
              default:
                pipeline(res, output, onComplete);
                break;
            }
          }
          catch (err) {
            reject(err);
          }
        });

        req.setTimeout(this.opts.readTimeout, () => {
          req.destroy(new FetchError(408));
        });

        req.on('error', err => {
          req.destroy();
          reject(err);
        });

        req.end();
      }
      catch (err) {
        reject(err);
      }
    });
  }
}
