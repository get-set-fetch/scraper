import { assert } from 'chai';
import Site, { IStaticSite } from '../../../src/storage/base/Site';
import Storage from '../../../src/storage/base/Storage';

export default function crudSite(storage: Storage) {
  describe(`CRUD Site using ${storage.config.client}`, () => {
    let Site: IStaticSite;
    let expectedSite: Site;

    before(async () => {
      ({ Site } = await storage.connect());
    });

    beforeEach(async () => {
      expectedSite = new Site({ name: 'siteA', url: 'http://sitea.com/index.html', pluginOpts: [ { name: 'pluginA', propA: 'valA' } ] });
      expectedSite.id = await expectedSite.save();
    });

    afterEach(async () => {
      await Site.delAll();
    });

    after(async () => {
      await storage.close();
    });

    it(`${storage.config.client} site get`, async () => {
      const siteById = await Site.get(expectedSite.id);
      assert.deepEqual(siteById, expectedSite);

      const siteByName = await Site.get(expectedSite.name);
      assert.deepEqual(siteByName, expectedSite);

      const resourceToCrawl = await siteByName.getResourceToCrawl();
      assert.strictEqual(resourceToCrawl.siteId, siteById.id);
      assert.strictEqual(resourceToCrawl.url, siteById.url);
      assert.isTrue(resourceToCrawl.scrapeInProgress);

      const resourceNo = await siteByName.countResources();
      assert.strictEqual(resourceNo, 1);
    });

    it(`${storage.config.client} site update`, async () => {
      Object.assign(expectedSite, {
        url: 'http://sitea.com/b.html',
        pluginOpts: [
          {
            name: 'pluginA1',
            propA1: 'valA1',
          },
        ],
      });
      await expectedSite.update();

      const actualSite = await Site.get(expectedSite.id);
      assert.deepEqual(actualSite, expectedSite);
    });

    it(`${storage.config.client} site del`, async () => {
      await expectedSite.del();

      const actualSite = await Site.get(expectedSite.id);
      assert.isUndefined(actualSite);
    });

    it(`${storage.config.client} site delAll`, async () => {
      await Site.delAll();
      const actualSite = await Site.get(expectedSite.id);

      assert.isUndefined(actualSite);
    });

    it(`${storage.config.client} site normalize url`, async () => {
      assert.strictEqual(new Site({ name: 'siteN', url: 'http://siten.com' }).url, 'http://siten.com/');
      assert.strictEqual(new Site({ name: 'siteN', url: 'http://wWw.CaPs.com' }).url, 'http://www.caps.com/');
    });
  });
}
