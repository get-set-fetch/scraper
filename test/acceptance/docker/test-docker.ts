import { assert } from 'chai';
import { join } from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import { GsfServer, ScrapingSuite } from '@get-set-fetch/test-utils';

/*
Each test builds then runs a gsf variant docker image.
The build process is straight-forward, just use a series of build time variables --build-arg to specify what gets downloaded / installed.
When running the image we need access to the host localhost where the web server serving the to-be-scraped resources is running.
This can be achieved by specifing the proxy host from config/base-config.json as host.docker.internal.
For linux the gsf container needs the --add-host host.docker.internal:host-gateway option.
https://stackoverflow.com/questions/24319662/from-inside-of-a-docker-container-how-do-i-connect-to-the-localhost-of-the-mach

When running in systems with multiple loopback adapters, specify the host for nodejs http.createServer instance,
otherwise unspecified ip address 0.0.0.0 is being used causing complications. GsfServer is now listening on 127.0.0.1 by default.
*/

describe('Docker', () => {
  let srv: GsfServer;

  before(async () => {
    // init gsf web server
    const test = ScrapingSuite.getTests().find(test => test.title === 'Static - Single Page - Single Content Entry');
    srv = new GsfServer();
    srv.start();
    srv.update(test.vhosts);
  });

  beforeEach(async () => {
    // do some file cleanup on tmp dir containing export, config, sqlite files
    fs.readdirSync(join(__dirname, '..', '..', 'tmp')).forEach(file => {
      if (file !== '.gitkeep') {
        fs.unlinkSync(join(__dirname, '..', '..', 'tmp', file));
      }
    });
  });

  after(async () => {
    srv.stop();
  });

  it('--build-arg DOM_CLIENT=cheerio --build-arg STORAGE=sqlite --build-arg VERSION=source', async () => {
    // build image
    const dockerBuildStdout = await new Promise<string>(resolve => exec(
      'docker build --progress=plain -t getsetfetch . --build-arg DOM_CLIENT=cheerio --build-arg STORAGE=sqlite --build-arg VERSION=source',
      { cwd: join(__dirname, '../../../docker') },
      (err, stdout, stderr) => {
        console.log(err);
        console.log(stdout);
        console.log(stderr);
        resolve(stderr.trim());
      },
    ));

    // check image was succesfully built
    assert.isTrue(/naming to docker.io\/library\/getsetfetch/.test(dockerBuildStdout), '"naming to docker.io/library/getsetfetch" docker build entry not found');

    // create full config file
    const config = JSON.parse(fs.readFileSync(join(__dirname, 'config', 'base-config.json')).toString('utf-8'));
    Object.assign(config, {
      storage: {
        client: 'sqlite3',
        useNullAsDefault: true,
        connection: {
          filename: 'gsf.sqlite',
        },
      },
      dom: {
        client: 'cheerio',
      },
    });

    config.scrape.pipeline = 'dom-static-content';
    fs.writeFileSync(join(__dirname, '../../tmp/config.json'), JSON.stringify(config));

    // start container, mount ./tmp/data as ./data within container
    const dockerRunCmd = [
      '--version',
      '--config', './data/config.json',
      '--loglevel', 'info',
      '--logdestination', './data/scrape.log',
      '--save',
      '--overwrite',
      '--scrape',
      '--export', './data/export.csv',
    ];

    const dockerRunStdout = await new Promise<string>(resolve => exec(
      // 'docker run --add-host host.docker.internal:host-gateway -v /home/andrei/github/scraper/test/tmp:/home/gsfuser/scraper/data getsetfetch:latest --version --config ./data/config.json --loglevel info --logdestination ./data/scrape.log --save --overwrite --scrape --export ./data/export.csv',
      `docker run --add-host host.docker.internal:host-gateway -v ${join(__dirname, '../../tmp')}:/home/gsfuser/scraper/data getsetfetch:latest ${dockerRunCmd.join(' ')}`,
      // `docker run -v /d/lab/wls/github/get-set-fetch/docker-test-tmp:/home/gsfuser/scraper/data getsetfetch:latest ${dockerRunCmd.join(' ')}`,
      { cwd: join(__dirname, '../../tmp') },
      (err, stdout) => resolve(stdout.trim()),
    ));
    console.log(dockerRunStdout);

    const dbFile = join(__dirname, '../../tmp/gsf.sqlite');
    if (!fs.existsSync(dbFile)) assert.fail(`${dbFile} not generated`);

    const logFile = join(__dirname, '../../tmp/scrape.log');
    if (!fs.existsSync(logFile)) assert.fail(`${logFile} not generated`);

    const logFileContent = fs.readFileSync(logFile).toString('utf-8');
    console.log(logFileContent);
    assert.isTrue(/scraping complete/.test(logFileContent), '"scraping complete" log entry not found');
    assert.isTrue(/exporting as csv/i.test(logFileContent), '"exporting as csv" log entry not found');

    const csvFile = join(__dirname, '../../tmp/export.csv');
    if (!fs.existsSync(csvFile)) assert.fail(`${csvFile} not generated`);

    const csvFileContent = fs.readFileSync(csvFile).toString('utf-8');
    assert.isTrue(/main header 1/i.test(csvFileContent), '"main header 1" csv entry not found');
  }).timeout(5 * 60 * 1000);
});
