import http, { IncomingMessage, OutgoingHttpHeaders } from 'http';
import https, { RequestOptions } from 'https';
import { pipeline, Writable } from 'stream';
import zlib from 'zlib';
import { getLogger } from '../../logger/Logger';
import { SchemaType } from '../../schema/SchemaHelper';
import Resource from '../../storage/base/Resource';
import { Protocol } from '../url-utils';
import BaseFetchPlugin, { FetchError } from './BaseFetchPlugin';

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
        rejectUnauthorized: {
          type: 'boolean',
          default: true,
        },
      },
    } as const;
  }

  logger = getLogger('NodeFetchPlugin');
  opts: SchemaType<typeof NodeFetchPlugin.schema>;

  constructor(opts:SchemaType<typeof NodeFetchPlugin.schema> = {}) {
    super(opts);
  }

  getRequestFnc(protocol: string):(options: RequestOptions, callback?: (res: http.IncomingMessage) => void) => http.ClientRequest {
    switch (protocol) {
      case 'https:':
        return https.request;
      case 'http:':
        return http.request;
      default:
        throw new Error('protocol must be either https or http');
    }
  }

  async fetch(resource: Resource):Promise<Partial<Resource>> {
    return new Promise((resolve, reject) => {
      const { hostname, protocol, pathname } = new URL(resource.url);

      let requestFnc:(options: RequestOptions, callback?: (res: http.IncomingMessage) => void) => http.ClientRequest;
      try {
        requestFnc = this.getRequestFnc(protocol);
      }
      catch (err) {
        reject(err);
      }

      const reqHeaders:OutgoingHttpHeaders = {
        Host: hostname,
        'Accept-Encoding': 'br,gzip,deflate',
        ...(<object> this.opts.headers),
      };

      const opts: RequestOptions = {
        method: 'GET',
        defaultPort: protocol === Protocol.HTTPS ? 443 : 80,
        path: pathname,
        host: hostname,
        headers: reqHeaders,
        timeout: 10 * 1000,
        rejectUnauthorized: this.opts.rejectUnauthorized,
        ...resource.proxy,
      };
      this.logger.debug(opts, 'Request Options');

      const req = requestFnc(opts, (res:IncomingMessage) => {
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
      });

      req.on('error', err => {
        this.logger.error(opts, 'Error using request options');
        reject(err);
      });
      req.end();
    });
  }
}
