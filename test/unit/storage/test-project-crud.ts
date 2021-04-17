import { assert } from 'chai';
import Project, { IStaticProject } from '../../../src/storage/base/Project';
import Storage from '../../../src/storage/base/Storage';

export default function crudProject(storage: Storage) {
  describe(`CRUD Project using ${storage.config.client}`, () => {
    let Project: IStaticProject;
    let expectedProject: Project;

    before(async () => {
      ({ Project } = await storage.connect());
    });

    beforeEach(async () => {
      expectedProject = new Project({ name: 'projectA', url: 'http://sitea.com/index.html', pluginOpts: [ { name: 'pluginA', propA: 'valA' } ] });
      expectedProject.id = await expectedProject.save();
    });

    afterEach(async () => {
      await Project.delAll();
    });

    after(async () => {
      await storage.close();
    });

    it(`${storage.config.client} project get`, async () => {
      const projectById = await Project.get(expectedProject.id);
      assert.deepEqual({ ...projectById, logger: undefined }, { ...expectedProject, logger: undefined });

      const projectByName = await Project.get(expectedProject.name);
      assert.deepEqual({ ...projectByName, logger: undefined }, { ...expectedProject, logger: undefined });

      const resourceToCrawl = await projectByName.getResourceToScrape();
      assert.strictEqual(resourceToCrawl.projectId, projectById.id);
      assert.strictEqual(resourceToCrawl.url, projectById.url);
      assert.isTrue(resourceToCrawl.scrapeInProgress);

      const resourceNo = await projectByName.countResources();
      assert.strictEqual(resourceNo, 1);
    });

    it(`${storage.config.client} project batchInsertResources uriNormalization = false`, async () => {
      const projectById = await Project.get(expectedProject.id);
      await projectById.batchInsertResources([
        { url: 'http://siteA.com/other1.html' },
        { url: 'http://siteA.com/other2.html', depth: 2 },
      ]);

      const resources = await projectById.getResources();
      assert.sameDeepMembers(
        resources.map(({ url, depth, projectId }) => ({ url, depth, projectId })),
        [
          { url: 'http://sitea.com/index.html', depth: 0, projectId: expectedProject.id },
          { url: 'http://siteA.com/other1.html', depth: 0, projectId: expectedProject.id },
          { url: 'http://siteA.com/other2.html', depth: 2, projectId: expectedProject.id },
        ],
      );
    });

    it(`${storage.config.client} project batchInsertResources uriNormalization = true`, async () => {
      const projectById = await Project.get(expectedProject.id);
      await projectById.batchInsertResources([
        { url: 'http://siteA.com/other1.html' },
        { url: 'http://siteA.com/other2.html', depth: 2 },
        { url: 'invalid-url', depth: 2 },
      ], 500, true);

      const resources = await projectById.getResources();
      assert.sameDeepMembers(
        resources.map(({ url, depth, projectId }) => ({ url, depth, projectId })),
        [
          { url: 'http://sitea.com/index.html', depth: 0, projectId: expectedProject.id },
          { url: 'http://sitea.com/other1.html', depth: 0, projectId: expectedProject.id },
          { url: 'http://sitea.com/other2.html', depth: 2, projectId: expectedProject.id },
        ],
      );
    });

    it(`${storage.config.client} project batchInsertResourcesFromFile uriNormalization = false`, async () => {
      const projectById = await Project.get(expectedProject.id);
      await projectById.batchInsertResourcesFromFile('test/acceptance/cli/resources.csv');

      const resources = await projectById.getResources();
      assert.sameDeepMembers(
        resources.map(({ url, depth, projectId }) => ({ url, depth, projectId })),
        [
          { url: 'http://sitea.com/index.html', depth: 0, projectId: expectedProject.id },
          { url: 'http://sitea.com/other1.html', depth: 0, projectId: expectedProject.id },
          { url: 'http://sitea.com/other2.html', depth: 0, projectId: expectedProject.id },
          { url: 'http://sitea.com/other3.html', depth: 0, projectId: expectedProject.id },
        ],
      );
    });

    it(`${storage.config.client} project batchInsertResourcesFromFile uriNormalization = true`, async () => {
      const projectById = await Project.get(expectedProject.id);
      await projectById.batchInsertResourcesFromFile('test/acceptance/cli/unnormalized-resources.csv', 500, true);

      const resources = await projectById.getResources();
      assert.sameDeepMembers(
        resources.map(({ url, depth, projectId }) => ({ url, depth, projectId })),
        [
          { url: 'http://sitea.com/index.html', depth: 0, projectId: expectedProject.id },
          { url: 'http://sitea.com/other1.html', depth: 0, projectId: expectedProject.id },
          { url: 'http://sitea.com/other2.html', depth: 0, projectId: expectedProject.id },
        ],
      );
    });

    it(`${storage.config.client} project update`, async () => {
      Object.assign(expectedProject, {
        url: 'http://sitea.com/b.html',
        pluginOpts: [
          {
            name: 'pluginA1',
            propA1: 'valA1',
          },
        ],
      });
      await expectedProject.update();

      const actualProject = await Project.get(expectedProject.id);
      assert.deepEqual({ ...actualProject, logger: undefined }, { ...expectedProject, logger: undefined });
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

    it(`${storage.config.client} project normalize url`, async () => {
      assert.strictEqual(new Project({ name: 'projectN', url: 'http://siten.com' }).url, 'http://siten.com/');
      assert.strictEqual(new Project({ name: 'projectN', url: 'http://wWw.CaPs.com' }).url, 'http://www.caps.com/');
    });
  });
}
