/* eslint-disable @typescript-eslint/no-empty-function */
import fs from 'fs';
import { assert } from 'chai';
import { SinonSandbox, createSandbox } from 'sinon';
import CsvExporter from '../../../src/export/CsvExporter';
import KnexProject from '../../../src/storage/knex/KnexProject';
import Exporter from '../../../src/export/Exporter';

describe('CsvExporter', () => {
  let sandbox:SinonSandbox;
  let exporter: Exporter;
  let project;
  let content: string;
  const lineSeparator = '\n';

  beforeEach(() => {
    content = '';
    sandbox = createSandbox();
    project = sandbox.createStubInstance(KnexProject);

    sandbox.stub(fs, 'createWriteStream').returns(<any>{
      write: (val: string) => {
        content += val;
      },
      close: () => {},
    });

    exporter = new CsvExporter(project, 'fileA.csv');
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('array values - single selector', async () => {
    project.plugins = [ { getContentKeys: () => [ 'colA' ] } ];
    project.getPagedResources.onCall(0).returns([
      { url: 'urlA', content: [ [ 'A1 content' ], [ 'A2 content' ] ] },
      { url: 'urlB', content: [ [ 'A3 content' ] ] },
    ]);
    project.getPagedResources.onCall(1).returns([]);
    await exporter.export();

    const expectedContent = `url,colA
      urlA,"A1 content"
      urlA,"A2 content"
      urlB,"A3 content"`
      .split(lineSeparator).map(csvLine => csvLine.trim()).join(lineSeparator);

    assert.strictEqual(content, expectedContent);
  });

  it('array values - multiple selectors', async () => {
    project.plugins = [ { getContentKeys: () => [ 'colA', 'colB' ] } ];
    project.getPagedResources.onCall(0).returns([
      { url: 'urlA', content: [ [ 'A1 content', 'B1 content' ], [ 'A2 content', 'B2 content' ] ] },
      { url: 'urlB', content: [ [ 'A3 content', 'B3 content' ] ] },
    ]);
    project.getPagedResources.onCall(1).returns([]);
    await exporter.export();

    const expectedContent = `url,colA,colB
      urlA,"A1 content","B1 content"
      urlA,"A2 content","B2 content"
      urlB,"A3 content","B3 content"`
      .split(lineSeparator).map(csvLine => csvLine.trim()).join(lineSeparator);

    assert.strictEqual(content, expectedContent);
  });
});
