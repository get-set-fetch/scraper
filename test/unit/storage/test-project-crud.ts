import { assert } from 'chai';
import Connection from '../../../src/storage/base/Connection';
import Project from '../../../src/storage/base/Project';
import Resource from '../../../src/storage/base/Resource';
import ConnectionManager from '../../../src/storage/ConnectionManager';

export default function crudProject(conn: Connection) {
  describe(`CRUD Project using ${conn.config.client}`, () => {
    let ExtProject: typeof Project;
    let expectedProject: Project;
    let connMng: ConnectionManager;

    before(async () => {
      connMng = new ConnectionManager(conn);
      await connMng.connect();
      ExtProject = await connMng.getProject();
    });

    beforeEach(async () => {
      expectedProject = new ExtProject({ name: 'projectA', pluginOpts: [ { name: 'pluginA', propA: 'valA' } ] });
      expectedProject.id = await expectedProject.save();
    });

    afterEach(async () => {
      await ExtProject.delAll();
    });

    after(async () => {
      await connMng.close();
    });

    it(`${conn.config.client} project get`, async () => {
      const projectById = await ExtProject.get(expectedProject.id);
      assert.isDefined(projectById.queue);
      assert.isDefined(projectById.logger);
      assert.deepEqual(projectById.toJSON(), expectedProject.toJSON());

      const projectByName = await ExtProject.get(expectedProject.name);
      assert.isDefined(projectByName.queue);
      assert.isDefined(projectByName.logger);
      assert.deepEqual(projectByName.toJSON(), expectedProject.toJSON());
    });

    it(`${conn.config.client} project getResourcesToScrape`, async () => {
      const projectByName = await ExtProject.get(expectedProject.name);

      const resourcesToBeInserted = [];
      for (let i = 0; i < 50; i += 1) {
        resourcesToBeInserted.push({ url: `http://sitea.com/a${i}.html` });
      }
      await projectByName.queue.normalizeAndAdd(resourcesToBeInserted);

      let queueCount = await projectByName.queue.count();
      assert.strictEqual(queueCount, 50);

      const toScrapePromises = [];
      for (let i = 0; i < 40; i += 1) {
        toScrapePromises.push(projectByName.queue.getResourcesToScrape(1));
      }
      const resourcesToScrape:Resource[] = (await Promise.all(toScrapePromises)).flat();
      await Promise.all(resourcesToScrape.map(resource => resource.save()));

      const [ resourceToScrape ] = resourcesToScrape;
      assert.isUndefined(resourceToScrape.status);
      assert.isNumber(resourceToScrape.queueEntryId);

      queueCount = await projectByName.queue.count();
      assert.strictEqual(queueCount, 50);

      const resourceCount = await projectByName.Constructor.ExtResource.count();
      assert.strictEqual(resourceCount, 40);
    });

    it(`${conn.config.client} project normalizeAndAdd`, async () => {
      const projectById = await ExtProject.get(expectedProject.id);
      await projectById.queue.normalizeAndAdd([
        { url: 'http://siteA.com/other1.html' },
        { url: 'http://siteA.com/other2.html' },
        { url: 'http://siteA.com/other3.html', depth: 2 },
        { url: 'invalid-url', depth: 2 },
      ], 2);

      const resources = await projectById.queue.getAll();
      assert.sameDeepMembers(
        resources.map(({ url, depth }) => ({ url, depth })),
        [
          { url: 'http://sitea.com/other1.html', depth: 0 },
          { url: 'http://sitea.com/other2.html', depth: 0 },
          { url: 'http://sitea.com/other3.html', depth: 2 },
        ],
      );
    });

    it(`${conn.config.client} project addFromFile`, async () => {
      const projectById = await ExtProject.get(expectedProject.id);
      await projectById.queue.addFromFile('test/acceptance/cli/resources/unnormalized-resources.csv', 2);

      const resources = await projectById.queue.getAll();
      assert.sameDeepMembers(
        resources.map(({ url, depth }) => ({ url, depth })),
        [
          { url: 'http://sitea.com/other1.html', depth: 0 },
          { url: 'http://sitea.com/other2.html', depth: 0 },
        ],
      );
    });

    it(`${conn.config.client} project addFromFile single entry`, async () => {
      const projectById = await ExtProject.get(expectedProject.id);
      await projectById.queue.addFromFile('test/acceptance/cli/resources/resources-single-entry.csv', 2);

      const resources = await projectById.queue.getAll();
      assert.sameDeepMembers(
        resources.map(({ url, depth }) => ({ url, depth })),
        [
          { url: 'http://sitea.com/other1.html', depth: 0 },
        ],
      );
    });

    it(`${conn.config.client} project update`, async () => {
      Object.assign(expectedProject, {
        pluginOpts: [
          {
            name: 'pluginA1',
            propA1: 'valA1',
          },
        ],
      });
      await expectedProject.update();

      const actualProject = await ExtProject.get(expectedProject.id);

      const extractProjInfo = proj => [ 'id', 'name', 'pluginOpts' ].reduce(
        (acc, propKey) => {
          acc[propKey] = proj[propKey];
          return acc;
        },
        {},
      );
      assert.deepEqual(extractProjInfo(actualProject), extractProjInfo(expectedProject));
    });

    it(`${conn.config.client} project del`, async () => {
      await expectedProject.del();

      const actualProject = await ExtProject.get(expectedProject.id);
      assert.isUndefined(actualProject);
    });

    it(`${conn.config.client} project delAll`, async () => {
      await ExtProject.delAll();
      const actualProject = await ExtProject.get(expectedProject.id);

      assert.isUndefined(actualProject);
    });

    it(`${conn.config.client} project.queue.add`, async () => {
      const projectById = await ExtProject.get(expectedProject.id);
      const resources:Partial<Resource>[] = [];
      for (let i = 0; i < 50; i += 1) {
        resources.push({ url: `url${i}` });
      }
      await projectById.queue.add(resources);
      const savedResources = await projectById.queue.getAll();

      assert.strictEqual(savedResources.length, 50);
    });

    it(`${conn.config.client} project.queue.add with ignored conflict`, async () => {
      const projectById = await ExtProject.get(expectedProject.id);
      const resources:Partial<Resource>[] = [];

      for (let i = 0; i < 20; i += 1) {
        resources.push({ url: `url${i}` });
      }
      await projectById.queue.add(resources);
      let savedResources = await projectById.queue.getAll();
      assert.strictEqual(savedResources.length, 20);

      for (let i = 0; i < 50; i += 1) {
        resources.push({ url: `url${i}` });
      }
      await projectById.queue.add(resources);
      savedResources = await projectById.queue.getAll();
      assert.strictEqual(savedResources.length, 50);
    });

    it(`${conn.config.client} project.queue.count`, async () => {
      const projectById = await ExtProject.get(expectedProject.id);

      const resources:Partial<Resource>[] = [];
      for (let i = 0; i < 50; i += 1) {
        resources.push({ url: `url${i}` });
      }
      await projectById.queue.add(resources);

      const resourceNo = await projectById.queue.count();
      assert.strictEqual(resourceNo, 50);
    });
  });
}
