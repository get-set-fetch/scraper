import { assert } from 'chai';
import { SinonSandbox, createSandbox } from 'sinon';
import { ClientRequest } from 'http';
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
});
