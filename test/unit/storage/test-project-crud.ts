import { assert } from 'chai';
import Project, { IStaticProject } from '../../../src/storage/base/Project';
import Resource from '../../../src/storage/base/Resource';
import Storage from '../../../src/storage/base/Storage';
import ModelStorage from '../../../src/storage/ModelStorage';

export default function crudProject(storage: Storage) {
  describe(`CRUD Project using ${storage.config.client}`, () => {
    let Project: IStaticProject;
    let expectedProject: Project;
    let modelStorage: ModelStorage;

    before(async () => {
      modelStorage = new ModelStorage(storage);
      await modelStorage.connect();
      ({ Project } = await modelStorage.getModels());
    });

    beforeEach(async () => {
      expectedProject = new Project({ name: 'projectA', pluginOpts: [ { name: 'pluginA', propA: 'valA' } ] });
      expectedProject.id = await expectedProject.save();
    });

    afterEach(async () => {
      await Project.delAll();
    });

    after(async () => {
      await modelStorage.close();
    });

    it(`${storage.config.client} project get`, async () => {
      const projectById = await Project.get(expectedProject.id);
      assert.isDefined(projectById.queue);
      assert.isDefined(projectById.logger);
      assert.deepEqual(projectById.toJSON(), expectedProject.toJSON());

      const projectByName = await Project.get(expectedProject.name);
      assert.isDefined(projectByName.queue);
      assert.isDefined(projectByName.logger);
      assert.deepEqual(projectByName.toJSON(), expectedProject.toJSON());
    });

    it(`${storage.config.client} project getResourcesToScrape`, async () => {
      const projectByName = await Project.get(expectedProject.name);

      const resourcesToBeInserted = [];
      for (let i = 0; i < 50; i += 1) {
        resourcesToBeInserted.push({ url: `http://sitea.com/a${i}.html` });
      }
      await projectByName.queue.batchInsertResources(resourcesToBeInserted);

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

      const resourceCount = await projectByName.Constructor.models.Resource.count();
      assert.strictEqual(resourceCount, 40);
    });

    it(`${storage.config.client} project batchInsertResources`, async () => {
      const projectById = await Project.get(expectedProject.id);
      await projectById.queue.batchInsertResources([
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

    it(`${storage.config.client} project batchInsertResourcesFromFile`, async () => {
      const projectById = await Project.get(expectedProject.id);
      await projectById.queue.batchInsertResourcesFromFile('test/acceptance/cli/resources/unnormalized-resources.csv', 2);

      const resources = await projectById.queue.getAll();
      assert.sameDeepMembers(
        resources.map(({ url, depth }) => ({ url, depth })),
        [
          { url: 'http://sitea.com/other1.html', depth: 0 },
          { url: 'http://sitea.com/other2.html', depth: 0 },
        ],
      );
    });

    it(`${storage.config.client} project batchInsertResourcesFromFile single entry`, async () => {
      const projectById = await Project.get(expectedProject.id);
      await projectById.queue.batchInsertResourcesFromFile('test/acceptance/cli/resources/resources-single-entry.csv', 2);

      const resources = await projectById.queue.getAll();
      assert.sameDeepMembers(
        resources.map(({ url, depth }) => ({ url, depth })),
        [
          { url: 'http://sitea.com/other1.html', depth: 0 },
        ],
      );
    });

    it(`${storage.config.client} project update`, async () => {
      Object.assign(expectedProject, {
        pluginOpts: [
          {
            name: 'pluginA1',
            propA1: 'valA1',
          },
        ],
      });
      await expectedProject.update();

      const actualProject = await Project.get(expectedProject.id);

      const extractProjInfo = proj => [ 'id', 'name', 'pluginOpts' ].reduce(
        (acc, propKey) => {
          acc[propKey] = proj[propKey];
          return acc;
        },
        {},
      );
      assert.deepEqual(extractProjInfo(actualProject), extractProjInfo(expectedProject));
    });

    it(`${storage.config.client} project del`, async () => {
      await expectedProject.del();

      const actualProject = await Project.get(expectedProject.id);
      assert.isUndefined(actualProject);
    });

    it(`${storage.config.client} project delAll`, async () => {
      await Project.delAll();
      const actualProject = await Project.get(expectedProject.id);

      assert.isUndefined(actualProject);
    });

    it(`${storage.config.client} project.queue.add`, async () => {
      const projectById = await Project.get(expectedProject.id);
      const resources:Partial<Resource>[] = [];
      for (let i = 0; i < 50; i += 1) {
        resources.push({ url: `url${i}` });
      }
      await projectById.queue.add(resources);
      const savedResources = await projectById.queue.getAll();

      assert.strictEqual(savedResources.length, 50);
    });

    it(`${storage.config.client} project.queue.add with ignored conflict`, async () => {
      const projectById = await Project.get(expectedProject.id);
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

    it(`${storage.config.client} project.queue.count`, async () => {
      const projectById = await Project.get(expectedProject.id);

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
