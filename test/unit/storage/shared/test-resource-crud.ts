import { assert } from 'chai';
import Resource, { IStaticResource } from '../../../../src/storage/base/Resource';
import Storage from '../../../../src/storage/base/Storage';

export default function crudResource(storage: Storage) {
  describe(`CRUD Resource using ${storage.constructor.name}`, () => {
    let Resource: IStaticResource;
    let expectedResource: Resource;

    before(async () => {
      await storage.connect();
      Resource = storage.Resource;
    });

    beforeEach(async () => {
      expectedResource = new Resource({ siteId: 1, url: 'urlA', depth: 1, scrapedAt: new Date() });
      expectedResource.id = await expectedResource.save();

      // saving the resources, adds the missing fields as null, add that to expected resource
      Object.assign(expectedResource, {
        blob: null,
        content: null,
        contentType: null,
        parent: null,
      });
    });

    afterEach(async () => {
      await Resource.delAll();
    });

    after(async () => {
      await storage.close();
    });

    it('get', async () => {
      const resourceById = await Resource.get(expectedResource.id);
      assert.deepEqual(resourceById, expectedResource);
    });

    it('update', async () => {
      Object.assign(expectedResource, {
        url: 'urlB',
        content: { h1: 'titleA' },
      });
      await expectedResource.update();

      const actualResource = await Resource.get(expectedResource.id);
      assert.deepEqual(actualResource, expectedResource);
    });

    it('del', async () => {
      await expectedResource.del();

      const actualResource = await Resource.get(expectedResource.id);
      assert.isUndefined(actualResource);
    });

    it('delAll', async () => {
      await Resource.delAll();
      const actualResource = await Resource.get(expectedResource.id);

      assert.isUndefined(actualResource);
    });
  });
}
