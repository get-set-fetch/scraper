import http, { IncomingMessage } from 'http';
import https, { RequestOptions } from 'https';
import { getLogger } from '../../logger/Logger';
import { SchemaType } from '../../schema/SchemaHelper';
import Resource from '../../storage/base/Resource';
import BaseFetchPlugin, { FetchError } from './BaseFetchPlugin';

export default class NodeFetchPlugin extends BaseFetchPlugin {
  static get schema() {
    return {
      type: 'object',
      title: 'Node Fetch Plugin',
      description: 'fetch resources via node fetch',
      properties: {
      },
    } as const;
  }

  logger = getLogger('NodeFetchPlugin');
  opts: SchemaType<typeof NodeFetchPlugin.schema>;

  constructor(opts:SchemaType<typeof NodeFetchPlugin.schema> = {}) {
    super(opts);
  }

  async fetch(resource: Resource):Promise<Partial<Resource>> {
    return new Promise((resolve, reject) => {
      const { hostname, protocol } = new URL(resource.url);

      let requestFnc:(options: RequestOptions, callback?: (res: http.IncomingMessage) => void) => http.ClientRequest;
      switch (protocol) {
        case 'https:':
          requestFnc = https.request;
          break;
        case 'http:':
          requestFnc = http.request;
          break;
        default:
          reject(new Error('protocol must be either https or http'));
      }

      const proxyOpts = {
        host: '127.0.0.1',
        port: 8080,
      };

      const opts: RequestOptions = {
        method: 'GET',
        path: resource.url,
        headers: {
          Host: hostname,
        },
      };

      const req = requestFnc({ ...opts, ...proxyOpts }, (res:IncomingMessage) => {
        const { statusCode, headers } = res;

        // don't have access to initial redirect status can't chain back to the original redirect one, always put 301
        if (this.isRedirectStatus(statusCode)) {
          reject(new FetchError(statusCode, headers.location));
        }

        // don't proceed further unless we have a valid status
        if (!this.isValidStatus(statusCode)) {
          reject(new FetchError(statusCode));
        }

        const contentType = this.getContentType(headers['content-type']);

        const chunks = [];
        res
          .on('data', chunk => chunks.push(Buffer.from(chunk)))
          .on('end', () => {
            const buffer = Buffer.concat(chunks);
            resolve({ data: buffer, contentType, status: statusCode });
          });
      });

      req.on('error', err => {
        reject(err);
      });
      req.end();
    });
  }
}
