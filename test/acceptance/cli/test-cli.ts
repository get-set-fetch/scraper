import { assert } from 'chai';
import { join } from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import { GsfServer, ScrapingSuite } from '@get-set-fetch/test-utils';
import Storage from '../../../src/storage/base/Storage';
import { IStaticProject } from '../../../src/storage/base/Project';
import KnexStorage from '../../../src/storage/knex/KnexStorage';
import { pipelines, mergePluginOpts } from '../../../src/pipelines/pipelines';
import { completionPercentage } from '../../../src/cli/cli';

describe('Command Line Interface', () => {
  let srv: GsfServer;
  let storage: Storage;
  let Project: IStaticProject;
  let config;

  before(async () => {
    // do some file cleanup on tmp dir containing export files
    fs.readdirSync(join(__dirname, '..', '..', 'tmp')).forEach(file => {
      if (file !== '.gitkeep') {
        fs.unlinkSync(join(__dirname, '..', '..', 'tmp', file));
      }
    });

    /*
    init storage, ALL config files db settings point to the same sqlite db: test/tmp/db.sqlite
    we need a storage instance for cleaning up the db and adding projects before invoking cli
    */
    config = JSON.parse(fs.readFileSync(join(__dirname, 'config', 'config-single-page-single-content-entry.json')).toString('utf-8'));
    config.storage.connection.filename = join(__dirname, 'config', config.storage.connection.filename);
    storage = new KnexStorage(config.storage);
    ({ Project } = await storage.connect());

    // init gsf web server
    const test = ScrapingSuite.getTests().find(test => test.title === 'Static - Single Page - Single Content Entry');
    srv = new GsfServer();
    srv.start();
    srv.update(test.vhosts);
  });

  beforeEach(async () => {
    await Project.delAll();
  });

  after(async () => {
    await storage.close();
    srv.stop();
  });

  it('completionPercentage', async () => {
    assert.strictEqual(completionPercentage(1, 1), 0);
    assert.strictEqual(completionPercentage(4, 3), 25);
    assert.strictEqual(completionPercentage(3, 2), 33.33);
    assert.strictEqual(completionPercentage(1, 0), 100);
  });

  it('--version', async () => {
    const packageFile = fs.readFileSync(join(__dirname, '../../../package.json')).toString('utf-8');
    const { version } = JSON.parse(packageFile);

    const stdout = await new Promise<string>(resolve => exec(
      './gsfscrape --version',
      { cwd: join(__dirname, '../../../bin') },
      (err, stdout) => resolve(stdout.trim()),
    ));
    assert.strictEqual(stdout, `@get-set-fetch/scraper - v${version}`);
  });

  it('--config --loglevel error', async () => {
    const stdout = await new Promise<string>(resolve => exec(
      './gsfscrape --config ../test/acceptance/cli/config/config-single-page-single-content-entry.json --loglevel error',
      { cwd: join(__dirname, '../../../bin') },
      (err, stdout) => {
        resolve(stdout);
      },
    ));

    const lastLine = stdout.split('/n').pop().trim();
    assert.isTrue(/using sqlite file/.test(lastLine), 'last stdout line should mention sqlite file');
  });

  it('--config --loglevel info --logdestination', async () => {
    const stdout = await new Promise<string>(resolve => exec(
      './gsfscrape --config ../test/acceptance/cli/config/config-single-page-single-content-entry.json --loglevel info --logdestination ../test/tmp/scrape.log',
      { cwd: join(__dirname, '../../../bin') },
      (err, stdout) => {
        resolve(stdout);
      },
    ));

    const lastLine = stdout.split('/n').pop().trim();
    assert.isTrue(/using sqlite file/.test(lastLine), 'last stdout line should mention sqlite file');

    const logContent = fs.readFileSync(join(__dirname, '../../tmp/scrape.log')).toString('utf-8');

    // check new project was created
    assert.isTrue(/New project sitea.com saved/.test(logContent), '"new project saved" log entry not found');

    // check resource was scraped
    assert.isTrue(/Resource http:\/\/sitea.com\/index.html successfully scraped/.test(logContent), '"resource successfully scraped" log entry not found');

    // check project scraping is complete
    assert.isTrue(/Project sitea.com scraping complete/.test(logContent), '"project scraping complete" log entry not found');
  });

  it('new project --config --loglevel info', async () => {
    const stdout = await new Promise<string>(resolve => exec(
      './gsfscrape --config ../test/acceptance/cli/config/config-single-page-single-content-entry.json --loglevel info',
      { cwd: join(__dirname, '../../../bin') },
      (err, stdout) => {
        resolve(stdout);
      },
    ));

    // check new project was created
    assert.isTrue(/New project sitea.com saved/.test(stdout), '"new project saved" log entry not found');

    // check resource was scraped
    assert.isTrue(/Resource http:\/\/sitea.com\/index.html successfully scraped/.test(stdout), '"resource successfully scraped" log entry not found');

    // check scraping status
    assert.isTrue(/progress \(scraped \/ total resources\): 1 \/ 1 \| 100%/.test(stdout), '"Scrape progress ... 100%" log entry not found');

    // check project scraping is complete
    assert.isTrue(/Project sitea.com scraping complete/.test(stdout), '"project scraping complete" log entry not found');
  });

  it('existing project --config --loglevel info --overwrite', async () => {
    const project = new Project({
      name: 'sitea.com',
      pluginOpts: mergePluginOpts(pipelines[config.scrape.pipeline].defaultPluginOpts, config.scrape.pluginOpts),
    });
    await project.save();
    await project.batchInsertResources(config.scrape.resources);

    const stdout = await new Promise<string>(resolve => exec(
      './gsfscrape --config ../test/acceptance/cli/config/config-single-page-single-content-entry.json --loglevel info --overwrite',
      { cwd: join(__dirname, '../../../bin') },
      (err, stdout) => {
        resolve(stdout);
      },
    ));

    assert.isTrue(/Overwriting project sitea.com/.test(stdout), '"Overwriting project sitea.com" log entry not found');
  });

  it('existing project --config --loglevel info --overwrite false', async () => {
    const project = new Project({
      name: 'sitea.com',
      pluginOpts: mergePluginOpts(pipelines[config.scrape.pipeline].defaultPluginOpts, config.scrape.pluginOpts),
    });
    await project.save();
    await project.batchInsertResources(config.scrape.resources);

    // by default overwrite is false, just make sure --overwrite flag is not present
    const stdout = await new Promise<string>(resolve => exec(
      './gsfscrape --config ../test/acceptance/cli/config/config-single-page-single-content-entry.json --loglevel info',
      { cwd: join(__dirname, '../../../bin') },
      (err, stdout) => {
        resolve(stdout);
      },
    ));

    assert.isTrue(/Existing project sitea.com will be used/.test(stdout), '"Existing project sitea.com will be used" log entry not found');
  });

  it('new project --config --loglevel info --export', async () => {
    // by default overwrite is false, just make sure --overwrite flag is not present
    const stdout = await new Promise<string>(resolve => exec(
      './gsfscrape --config ../test/acceptance/cli/config/config-single-page-single-content-entry.json --loglevel info --export ../test/tmp/export.csv',
      { cwd: join(__dirname, '../../../bin') },
      (err, stdout) => {
        resolve(stdout);
      },
    ));

    assert.isTrue(/scraped data will be exported to/.test(stdout), '"scraped data will be exported to" log entry not found');
    assert.isTrue(/export.csv .+ done/.test(stdout), '"export.csv done" log entry not found');

    const csvContent:string[] = fs.readFileSync(join(__dirname, '..', '..', 'tmp', 'export.csv')).toString('utf-8').split('\n');
    assert.sameOrderedMembers(
      [
        'url,h1',
        'http://sitea.com/index.html,"Main Header 1"',
      ],
      csvContent,
    );
  });

  it('new project with custom plugin --config --loglevel debug --export', async () => {
    // by default overwrite is false, just make sure --overwrite flag is not present
    const stdout = await new Promise<string>(resolve => exec(
      './gsfscrape --config ../test/acceptance/cli/config/config-single-page-single-content-entry-custom-plugin.json --loglevel info --export ../test/tmp/export.csv',
      { cwd: join(__dirname, '../../../bin') },
      (err, stdout) => {
        resolve(stdout);
      },
    ));

    assert.isTrue(/scraped data will be exported to/.test(stdout), '"scraped data will be exported to" log entry not found');
    assert.isTrue(/export.csv .+ done/.test(stdout), '"export.csv done" log entry not found');

    const csvContent:string[] = fs.readFileSync(join(__dirname, '..', '..', 'tmp', 'export.csv')).toString('utf-8').split('\n');
    assert.sameOrderedMembers(
      [
        'url,h1,h1Length',
        'http://sitea.com/index.html,"Main Header 1",23',
      ],
      csvContent,
    );
  });

  it('new project --config --loglevel info --export missing --exportType', async () => {
    // by default overwrite is false, just make sure --overwrite flag is not present
    const { stdout, stderr } = await new Promise<{stdout: string, stderr: string}>(resolve => exec(
      './gsfscrape --config ../test/acceptance/cli/config/config-single-page-single-content-entry.json --loglevel info --export ../test/tmp/export.txt',
      { cwd: join(__dirname, '../../../bin') },
      (err, stdout, stderr) => {
        resolve({ stdout, stderr });
      },
    ));

    assert.isTrue(/scraped data will be exported to/.test(stdout), '"scraped data will be exported to" log entry not found');
    assert.isTrue(/missing --exportType/.test(stderr), '"missing --exportType" log entry not found');
  });

  it('existing projects --discover --loglevel info --export', async () => {
    const projectA = new Project({
      name: 'projectA',
      pluginOpts: mergePluginOpts(pipelines[config.scrape.pipeline].defaultPluginOpts, config.scrape.pluginOpts),
    });
    await projectA.save();
    await projectA.batchInsertResources(config.scrape.resources);

    const projectB = new Project({
      name: 'projectB',
      pluginOpts: mergePluginOpts(pipelines[config.scrape.pipeline].defaultPluginOpts, config.scrape.pluginOpts),
    });
    await projectB.save();
    await projectB.batchInsertResources(config.scrape.resources);

    // by default overwrite is false, just make sure --overwrite flag is not present
    const stdout = await new Promise<string>(resolve => exec(
      './gsfscrape --config ../test/acceptance/cli/config/config-single-page-single-content-entry.json --discover --loglevel info --export ../test/tmp/export.csv',
      { cwd: join(__dirname, '../../../bin') },
      (err, stdout) => {
        resolve(stdout);
      },
    ));

    assert.isTrue(/export-projectA.csv .+ done/.test(stdout), '"export-projectA.csv done" log entry not found');
    assert.isTrue(/export-projectB.csv .+ done/.test(stdout), '"export-projectB.csv done" log entry not found');

    const csvContentA:string[] = fs.readFileSync(join(__dirname, '..', '..', 'tmp', 'export-projectA.csv')).toString('utf-8').split('\n');
    const csvContentB:string[] = fs.readFileSync(join(__dirname, '..', '..', 'tmp', 'export-projectB.csv')).toString('utf-8').split('\n');
    const expectedContent = [
      'url,h1',
      'http://sitea.com/index.html,"Main Header 1"',
    ];

    assert.sameOrderedMembers(expectedContent, csvContentA);
    assert.sameOrderedMembers(expectedContent, csvContentB);
  });

  it('new project with invalid relative resources path', async () => {
    const { stderr } = await new Promise<{stderr: string, stdout: string}>(resolve => exec(
      './gsfscrape --config ../test/acceptance/cli/config/config-with-invalid-external-resources.json',
      { cwd: join(__dirname, '../../../bin') },
      (err, stdout, stderr) => {
        resolve({ stdout, stderr });
      },
    ));

    assert.isTrue(/non-existent-resources\.csv does not exist/.test(stderr), '"non-existent-resources.csv does not exist" log entry not found');
  });

  it('new project with invalid relative config path', async () => {
    const { stderr } = await new Promise<{stderr: string, stdout: string}>(resolve => exec(
      './gsfscrape --config config.json',
      { cwd: join(__dirname, '../../../bin') },
      (err, stdout, stderr) => {
        resolve({ stdout, stderr });
      },
    ));

    assert.isTrue(/config\.json does not exist/.test(stderr), '"config.json does not exist" log entry not found');
  });

  it('new project with invalid absolute config path', async () => {
    const { stderr } = await new Promise<{stderr: string, stdout: string}>(resolve => exec(
      './gsfscrape --config /home/config.json',
      { cwd: join(__dirname, '../../../bin') },
      (err, stdout, stderr) => {
        resolve({ stdout, stderr });
      },
    ));

    assert.isTrue(/\/home\/config\.json does not exist/.test(stderr), '"home/config.json does not exist" log entry not found');
  });

  it('new project with invalid relative logdestination path', async () => {
    const { stderr } = await new Promise<{stderr: string, stdout: string}>(resolve => exec(
      './gsfscrape --config ../test/acceptance/cli/config/config-with-external-resources.json --logdestination dirA/scraper.log',
      { cwd: join(__dirname, '../../../bin') },
      (err, stdout, stderr) => {
        resolve({ stdout, stderr });
      },
    ));

    assert.isTrue(/dirA does not exist/.test(stderr), '"log dirpath does not exist" log entry not found');
  });

  it('new project with invalid absolute logdestination path', async () => {
    const { stderr } = await new Promise<{stderr: string, stdout: string}>(resolve => exec(
      './gsfscrape --config ../test/acceptance/cli/config/config-with-external-resources.json --logdestination /home/dirA/scraper.log',
      { cwd: join(__dirname, '../../../bin') },
      (err, stdout, stderr) => {
        resolve({ stdout, stderr });
      },
    ));

    assert.isTrue(/\/home\/dirA does not exist/.test(stderr), '"log dirpath does not exist" log entry not found');
  });

  it('new project with external resources --scrape --loglevel info --export', async () => {
    const { stdout } = await new Promise<{stderr: string, stdout: string}>(resolve => exec(
      './gsfscrape --config ../test/acceptance/cli/config/config-with-external-resources.json --loglevel info --export ../test/tmp/export.csv',
      { cwd: join(__dirname, '../../../bin') },
      (err, stdout, stderr) => {
        resolve({ stdout, stderr });
      },
    ));

    assert.isTrue(/3 total resources inserted/.test(stdout), '"3 total resources inserted" log entry not found');
    assert.isTrue(/inserting resources from .+resources.csv done/.test(stdout), '"inserting resources from .. resource.csv done" log entry not found');

    assert.isTrue(/index.html successfully scraped/.test(stdout), '"index.html successfully scraped" log entry not found');
    assert.isTrue(/other1.html successfully scraped/.test(stdout), '"other1.html successfully scraped" log entry not found');
    assert.isTrue(/other2.html successfully scraped/.test(stdout), '"other2.html successfully scraped" log entry not found');
    assert.isTrue(/other3.html successfully scraped/.test(stdout), '"other3.html successfully scraped" log entry not found');
    assert.isTrue(/Project sitea.com scraping complete/.test(stdout), '"project scraping complete" log entry not found');

    // check scraping status
    assert.isTrue(/progress \(scraped \/ total resources\): 1 \/ 4 \| 25%/.test(stdout), '"Scrape progress ... 25%" log entry not found');
    assert.isTrue(/progress \(scraped \/ total resources\): 4 \/ 4 \| 100%/.test(stdout), '"Scrape progress ... 100%" log entry not found');

    const csvContent:string[] = fs.readFileSync(join(__dirname, '..', '..', 'tmp', 'export.csv')).toString('utf-8').split('\n');

    // a single valid entry since otherN.html pages have null content
    const expectedContent = [
      'url,h1',
      'http://sitea.com/index.html,"Main Header 1"',
    ];

    assert.sameOrderedMembers(expectedContent, csvContent);
  });
});
