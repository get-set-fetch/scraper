import { assert } from 'chai';
import ConnectionManager from '../../../src/storage/ConnectionManager';
import Connection from '../../../src/storage/base/Connection';
import Project from '../../../src/storage/base/Project';
import Resource from '../../../src/storage/base/Resource';

export default function crudResource(conn: Connection) {
  describe(`CRUD Resource using ${conn.config.client}`, () => {
    let ExtResource: typeof Resource;
    let expectedResource: Resource;
    let project: Project;
    let connMng: ConnectionManager;

    before(async () => {
      connMng = new ConnectionManager(conn);
      await connMng.connect();
      const ExtProject = await connMng.getProject();

      // Queue and Resource are linked to a project instance, create a project to add the linkage
      project = new ExtProject({ name: 'projA' });
      await project.save();

      ExtResource = ExtProject.ExtResource;
    });

    beforeEach(async () => {
      expectedResource = new ExtResource({
        url: 'urlA',
        depth: 1,
        scrapedAt: new Date(new Date().setMilliseconds(0)), // round up to seconds
      });
      expectedResource.id = await expectedResource.save();

      // saving the resources, adds the missing fields as null, add that to expected resource
      Object.assign(expectedResource, {
        data: null,
        content: null,
        status: null,
        contentType: null,
        parent: null,
        actions: null,
      });
    });

    afterEach(async () => {
      await ExtResource.delAll();
    });

    after(async () => {
      await project.del();
      await connMng.close();
    });

    it(`${conn.config.client} resource get`, async () => {
      const resourceById = await ExtResource.get(expectedResource.id);
      assert.deepEqual(resourceById.toJSON(), expectedResource.toJSON());
    });

    it(`${conn.config.client} resource getPagedResources - offset, limit`, async () => {
      await ExtResource.delAll();
      for (let i = 1; i < 4; i += 1) {
        const resource = new ExtResource({ url: `urlA${i}`, content: [ [ `title${i}` ] ] });
        // eslint-disable-next-line no-await-in-loop
        await resource.save();
      }

      const page1Resources = await ExtResource.getPagedResources({ offset: 0, limit: 2 });
      const page1Urls = page1Resources.map(resource => resource.url);
      const page1Content = page1Resources.map(resource => resource.content);
      assert.sameMembers(page1Urls, [ 'urlA1', 'urlA2' ]);
      assert.sameDeepMembers(page1Content, [ [ [ 'title1' ] ], [ [ 'title2' ] ] ]);

      const page2Resources = await ExtResource.getPagedResources({ offset: 2, limit: 2 });
      const page2Urls = page2Resources.map(resource => resource.url);
      const page2Content = page2Resources.map(resource => resource.content);
      assert.sameMembers(page2Urls, [ 'urlA3' ]);
      assert.sameDeepMembers(page2Content, [ [ [ 'title3' ] ] ]);
    });

    it(`${conn.config.client} resource getPagedResources - cols, offset, limit`, async () => {
      await ExtResource.delAll();
      for (let i = 1; i < 4; i += 1) {
        const resource = new ExtResource({ url: `urlA${i}`, content: [ [ `title${i}` ] ] });
        // eslint-disable-next-line no-await-in-loop
        await resource.save();
      }

      const page1Resources = await ExtResource.getPagedResources({ offset: 0, limit: 2, cols: [ 'url' ] });
      const page1Urls = page1Resources.map(resource => resource.url);
      const page1Content = page1Resources.map(resource => resource.content);
      assert.sameMembers(page1Urls, [ 'urlA1', 'urlA2' ]);
      assert.sameDeepMembers(page1Content, [ undefined, undefined ]);

      const page2Resources = await ExtResource.getPagedResources({ offset: 2, limit: 2, cols: [ 'url' ] });
      const page2Urls = page2Resources.map(resource => resource.url);
      const page2Content = page2Resources.map(resource => resource.content);
      assert.sameMembers(page2Urls, [ 'urlA3' ]);
      assert.sameDeepMembers(page2Content, [ undefined ]);
    });

    it(`${conn.config.client} resource getPagedResources - cols, whereNotNull(data, content)`, async () => {
      await ExtResource.delAll();
      for (let i = 1; i < 5; i += 1) {
        const resource = new ExtResource({ url: `urlA${i}` });
        if (i % 2 === 0) {
          resource.content = [ [ `title${i}` ] ];
        }
        else {
          const buffer = Buffer.from(`data${i}`);
          resource.data = Uint8Array.from(buffer);
        }
        // eslint-disable-next-line no-await-in-loop
        await resource.save();
      }

      const textResources = await ExtResource.getPagedResources({ whereNotNull: [ 'content' ], cols: [ 'url', 'content' ] });
      const page1Urls = textResources.map(resource => resource.url);
      const page1Content = textResources.map(resource => resource.content);
      assert.sameMembers(page1Urls, [ 'urlA2', 'urlA4' ]);
      assert.sameDeepMembers(page1Content, [ [ [ 'title2' ] ], [ [ 'title4' ] ] ]);

      const binaryResources = await ExtResource.getPagedResources({ whereNotNull: [ 'data' ], cols: [ 'url', 'data' ] });
      const page2Urls = binaryResources.map(resource => resource.url);
      const page2Content = binaryResources.map(resource => Buffer.from(resource.data).toString('utf8'));
      assert.sameMembers(page2Urls, [ 'urlA1', 'urlA3' ]);
      assert.sameDeepMembers(page2Content, [ 'data1', 'data3' ]);
    });

    it(`${conn.config.client} resource del`, async () => {
      await expectedResource.del();

      const actualResource = await ExtResource.get(expectedResource.id);
      assert.isUndefined(actualResource);
    });

    it(`${conn.config.client} resource delAll`, async () => {
      await ExtResource.delAll();
      const actualResource = await ExtResource.get(expectedResource.id);

      assert.isUndefined(actualResource);
    });
  });
}
