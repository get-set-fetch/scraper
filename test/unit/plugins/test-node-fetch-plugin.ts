import { assert } from 'chai';
import { SinonSandbox, createSandbox } from 'sinon';
import http, { ClientRequest } from 'http';
import { Readable } from 'stream';
import { gzipSync } from 'zlib';
import NodeFetchPlugin from '../../../src/plugins/default/NodeFetchPlugin';
import Resource from '../../../src/storage/base/Resource';

describe('NodeFetchPlugin', () => {
  let sandbox:SinonSandbox;
  const plugin: NodeFetchPlugin = new NodeFetchPlugin();

  beforeEach(() => {
    sandbox = createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('fetch no compression', async () => {
    const htmlContent = '<body></body>';
    const clientRequestStub = sandbox.createStubInstance(ClientRequest);
    sandbox.stub(plugin, 'getRequestFnc').returns((opts, callback) => {
      const response = Readable.from(htmlContent);

      callback(<any>Object.assign(response, {
        statusCode: 201,
        headers: {
          'content-encoding': '',
        },
      }));

      return <any>clientRequestStub;
    });

    const result = await plugin.fetch(<Resource>{ url: 'http://sitea.com' });
    assert.strictEqual(result.data.toString(), htmlContent);
    assert.isTrue(clientRequestStub.end.calledOnce);
  });

  it('fetch gzip', async () => {
    const htmlContent = '<body></body>';
    const clientRequestStub = sandbox.createStubInstance(ClientRequest);
    sandbox.stub(plugin, 'getRequestFnc').returns((opts, callback) => {
      const response = Readable.from(gzipSync(htmlContent));
      callback(<any>Object.assign(response, {
        statusCode: 201,
        headers: {
          'content-encoding': 'gzip',
        },
      }));

      return <any>clientRequestStub;
    });

    const result = await plugin.fetch(<Resource>{ url: 'http://sitea.com' });
    assert.strictEqual((<Buffer>result.data).toString('utf8'), htmlContent);
    assert.isTrue(clientRequestStub.end.calledOnce);
  });

  it('fetch read timeout', async () => {
    const srv = http.createServer((req, res) => {
      setTimeout(() => {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.write('<body></body>');
        res.end();
      }, 1 * 1000);
    });
    srv.listen(8000);

    plugin.opts.readTimeout = 0.5 * 1000;
    let timeoutError;
    try {
      await plugin.fetch(<Resource>{ url: 'http://sitea.com', proxy: { host: '127.0.0.1', port: 8000 } });
    }
    catch (err) {
      timeoutError = err;
    }

    srv.close();

    assert.strictEqual(timeoutError.status, 408);
  });
});
