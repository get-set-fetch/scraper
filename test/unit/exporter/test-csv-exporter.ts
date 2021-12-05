/* eslint-disable @typescript-eslint/no-empty-function */
import fs from 'fs';
import { assert } from 'chai';
import { SinonSandbox, createSandbox } from 'sinon';
import CsvExporter from '../../../src/export/CsvExporter';
import Project from '../../../src/storage/base/Project';
import ConnectionManager from '../../../src/storage/ConnectionManager';

describe('CsvExporter', () => {
  let sandbox:SinonSandbox;
  let exporter: CsvExporter;
  let project;
  let content: string;
  const lineSeparator = '\n';

  beforeEach(() => {
    content = '';
    sandbox = createSandbox();
    project = sandbox.createStubInstance(Project);

    sandbox.stub(fs, 'createWriteStream').returns(<any>{
      write: (val: string) => {
        content += val;
      },
      close: () => {},
    });

    sandbox.stub(ConnectionManager, 'clone').returns(
      <any>sandbox.createStubInstance(
        ConnectionManager,
        <any>{ getProject: { get: () => project } },
      ),
    );

    exporter = new CsvExporter({ filepath: 'fileA.csv' });
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('array values - single selector', async () => {
    sandbox.stub(exporter, 'getContentKeys').returns([ 'colA' ]);
    project.getPagedResources.onCall(0).returns([
      { url: 'urlA', content: [ [ 'A1 content' ], [ 'A2 content' ] ] },
      { url: 'urlB', content: [ [ 'A3 content' ] ] },
    ]);
    project.getPagedResources.onCall(1).returns([]);
    await exporter.export(project);

    const expectedContent = `url,colA
      urlA,"A1 content"
      urlA,"A2 content"
      urlB,"A3 content"`
      .split(lineSeparator).map(csvLine => csvLine.trim()).join(lineSeparator);

    assert.strictEqual(content, expectedContent);
  });

  it('array values - single selector - empty content', async () => {
    sandbox.stub(exporter, 'getContentKeys').returns([ 'colA' ]);
    project.getPagedResources.onCall(0).returns([
      { url: 'urlA', content: [ [ 'A1 content' ] ] },
      { url: 'urlB', content: [ [ ] ] },
      { url: 'urlC', content: [ ] },
    ]);
    project.getPagedResources.onCall(1).returns([]);
    await exporter.export(project);

    const expectedContent = `url,colA
      urlA,"A1 content"
      urlB
      urlC`
      .split(lineSeparator).map(csvLine => csvLine.trim()).join(lineSeparator);

    assert.strictEqual(content, expectedContent);
  });

  it('array values - multiple selectors', async () => {
    sandbox.stub(exporter, 'getContentKeys').returns([ 'colA', 'colB' ]);
    project.getPagedResources.onCall(0).returns([
      { url: 'urlA', content: [ [ 'A1 content', 'B1 content' ], [ 'A2 content', 'B2 content' ] ] },
      { url: 'urlB', content: [ [ 'A3 content', 'B3 content' ] ] },
    ]);
    project.getPagedResources.onCall(1).returns([]);
    await exporter.export(project);

    const expectedContent = `url,colA,colB
      urlA,"A1 content","B1 content"
      urlA,"A2 content","B2 content"
      urlB,"A3 content","B3 content"`
      .split(lineSeparator).map(csvLine => csvLine.trim()).join(lineSeparator);

    assert.strictEqual(content, expectedContent);
  });
});
