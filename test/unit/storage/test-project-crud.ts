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
      assert.deepEqual(projectById, expectedProject);

      const projectByName = await Project.get(expectedProject.name);
      assert.deepEqual(projectByName, expectedProject);

      const resourceToCrawl = await projectByName.getResourceToCrawl();
      assert.strictEqual(resourceToCrawl.projectId, projectById.id);
      assert.strictEqual(resourceToCrawl.url, projectById.url);
      assert.isTrue(resourceToCrawl.scrapeInProgress);

      const resourceNo = await projectByName.countResources();
      assert.strictEqual(resourceNo, 1);
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
      assert.deepEqual(actualProject, expectedProject);
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
