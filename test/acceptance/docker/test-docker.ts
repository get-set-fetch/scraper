/* eslint-disable func-names */
/* eslint-disable no-console */
import { assert } from 'chai';
import { join } from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import { GsfServer, ScrapingSuite } from '@get-set-fetch/test-utils';

/*
Each test builds then runs a gsf variant docker image.
The build process is straight-forward, just use a series of build time variables --build-arg to specify what gets downloaded / installed.
When running the image we need access to the host localhost where the web server serving the to-be-scraped resources is running.
This can be achieved by:
- specifing the proxy host from config/base-config.json as host.docker.internal, --add-host host.docker.internal:host-gateway
  (seems to not work with docker/setup-buildx-action@v1 nor Act)
- directly using the host network via --network=host

When running in systems with multiple loopback adapters, specify the host for nodejs http.createServer instance,
otherwise unspecified ip address 0.0.0.0 is being used causing complications. GsfServer is now listening on 127.0.0.1 by default.
*/

describe('Docker', () => {
  const DOCKER_IMG_NAME = 'getsetfetch';
  let srv: GsfServer;

  async function execCommand(cmd: string, cwd: string = join(__dirname, '../../tmp')):Promise<string> {
    console.log(`executing ${cmd}`);
    return new Promise<string>(
      resolve => exec(
        cmd,
        { cwd },
        (err, stdout, stderr) => {
          const output = err?.toString() || stderr?.toString() || stdout?.toString();
          console.log(output.trim());
          console.log(`executing ${cmd} DONE`);
          resolve(output.trim());
        },
      ),
    );
  }

  async function displayLastContainerLogs() {
    console.log('--- START DISPLAY LAST CONTAINER LOGS ---');
    // list last container
    const listInfo = await execCommand('docker ps -a -l');

    // retrieve container info
    const containerProps:string[] = listInfo.split('\n')[1].split(/\s{2,}/).map(prop => prop.trim());
    const containerInfo = {
      id: containerProps[0],
      image: containerProps[1],
    };
    console.log(`found container ${JSON.stringify(containerInfo)}`);
    console.log('--');

    // retrieve container logs
    await execCommand(`docker logs ${containerInfo.id}`);
    console.log('--- END DISPLAY LAST CONTAINER LOGS ---');
  }

  function generateDockerBuildOptions(client: string, storage: string, version: string):string[] {
    const opts = [
      '--progress=plain',
      '--output=type=docker',
      `--tag ${DOCKER_IMG_NAME}`,
      `--build-arg STORAGE=${storage}`,
      `--build-arg VERSION=${version}`,
      `--build-arg BRANCH=${process.env.BRANCH}`,

      /*
      parent container is a buildx_buildkit_builder docker container running as root, uid/gid = 0
      gsfscraper child container also starts as root, can't re-add uid/gid 0, see Dockerfile section where user is created
      '--build-arg USER_ID=$(id -u)',
      '--build-arg GROUP_ID=$(id -g)',

      use a predefined value for uid/gid of child container user
      */
      '--build-arg USER_ID=1000',
      '--build-arg GROUP_ID=1000',
    ];

    switch (client) {
      case 'cheerio':
        opts.push('--build-arg DOM_CLIENT=cheerio');
        break;
      case 'puppeteer':
        opts.push('--build-arg BROWSER_CLIENT=puppeteer');
        break;
      default:
    }

    return opts;
  }

  before(async () => {
    // init gsf web server
    const test = ScrapingSuite.getTests().find(test => test.title === 'Static - Single Page - Single Content Entry');
    srv = new GsfServer();
    srv.start();
    srv.update(test.vhosts);
  });

  beforeEach(async () => {
    // chown tmp dir back to current user, otherwise future actions against tmp like nodejs unlink will fail
    await execCommand(`sudo chown -R $(id -u):$(id -g) ${join(__dirname, '..', '..', 'tmp')}`);

    // do some file cleanup on tmp dir containing export, config, sqlite files
    fs.readdirSync(join(__dirname, '..', '..', 'tmp')).forEach(file => {
      if (file !== '.gitkeep') {
        fs.unlinkSync(join(__dirname, '..', '..', 'tmp', file));
      }
    });
  });

  afterEach(async function () {
    if (this.currentTest.state === 'failed') {
      console.log('test failed, display last container logs');
      await displayLastContainerLogs();
    }
  });

  after(async () => {
    srv.stop();
  });

  it('--build-arg DOM_CLIENT=cheerio --build-arg STORAGE=sqlite --build-arg VERSION=source', async () => {
    // build image
    const dockerBuildOptions = generateDockerBuildOptions('cheerio', 'sqlite', 'source');
    const dockerBuildStdout = await execCommand(
      `docker buildx build ${dockerBuildOptions.join(' ')} .`,
      join(__dirname, '../../../docker'),
    );

    // check image was succesfully built
    assert.isTrue(/importing to docker/.test(dockerBuildStdout), '"importing to docker" docker build entry not found');

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
      client: {
        name: 'cheerio',
      },
    });

    config.project.pipeline = 'dom-static-content';
    fs.writeFileSync(join(__dirname, '../../tmp/config.json'), JSON.stringify(config));

    // chown tmp dir (to be mapped inside container) to 1000:1000 (container user uid/gid)
    await execCommand(`sudo chown -R 1000:1000 ${join(__dirname, '..', '..', 'tmp')}`);

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

    // start container
    await execCommand(
      // map ./tmp/data as /home/gsfuser/scraper/data within container
      `docker run --network=host -v ${join(__dirname, '../../tmp')}:/home/gsfuser/scraper/data ${DOCKER_IMG_NAME}:latest ${dockerRunCmd.join(' ')}`,
      join(__dirname, '../../tmp'),
    );

    const dbFile = join(__dirname, '../../tmp/gsf.sqlite');
    if (!fs.existsSync(dbFile)) assert.fail(`${dbFile} not generated`);

    const logFile = join(__dirname, '../../tmp/scrape.log');
    if (!fs.existsSync(logFile)) assert.fail(`${logFile} not generated`);

    const logFileContent = fs.readFileSync(logFile).toString('utf-8');
    console.log('LOGS');
    console.log(logFileContent);
    assert.isTrue(/scraping complete/.test(logFileContent), '"scraping complete" log entry not found');
    assert.isTrue(/exporting under .+ done/i.test(logFileContent), '"exporting under ... done" log entry not found');

    const csvFile = join(__dirname, '../../tmp/export.csv');
    if (!fs.existsSync(csvFile)) assert.fail(`${csvFile} not generated`);

    const csvFileContent = fs.readFileSync(csvFile).toString('utf-8');
    assert.isTrue(/main header 1/i.test(csvFileContent), '"main header 1" csv entry not found');
  }).timeout(5 * 60 * 1000);

  it('--build-arg BROWSER_CLIENT=puppeteer --build-arg STORAGE=sqlite --build-arg VERSION=source', async () => {
    // build image
    const dockerBuildOptions = generateDockerBuildOptions('puppeteer', 'sqlite', 'source');
    const dockerBuildStdout = await execCommand(
      `docker buildx build ${dockerBuildOptions.join(' ')} .`,
      join(__dirname, '../../../docker'),
    );

    // check image was succesfully built
    assert.isTrue(/importing to docker/.test(dockerBuildStdout), '"importing to docker" docker build entry not found');

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
      client: {
        name: 'puppeteer',
        opts: {
          ignoreHTTPSErrors: true,
          args: [
            '--host-rules=MAP *:80 127.0.0.1:8080, MAP *:443 127.0.0.1:8443',
            '--ignore-certificate-errors',
            '--no-first-run',
            '--single-process',
          ],
        },
      },
    });

    config.project.pipeline = 'browser-static-content';
    fs.writeFileSync(join(__dirname, '../../tmp/config.json'), JSON.stringify(config));

    // chown tmp dir (to be mapped inside container) to 1000:1000 (container user uid/gid)
    await execCommand(`sudo chown -R 1000:1000 ${join(__dirname, '..', '..', 'tmp')}`);

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

    // start container
    await execCommand(
      /*
      map ./tmp/data as /home/gsfuser/scraper/data within container
      get access to host GsfServer
      allow system calls required by chromium
        --security-opt seccomp=/path/to/seccomp/profile.json
        --security-opt seccomp=unconfined
      */
      `docker run --security-opt seccomp=unconfined --network=host -v ${join(__dirname, '../../tmp')}:/home/gsfuser/scraper/data ${DOCKER_IMG_NAME}:latest ${dockerRunCmd.join(' ')}`,
      join(__dirname, '../../tmp'),
    );

    const dbFile = join(__dirname, '../../tmp/gsf.sqlite');
    if (!fs.existsSync(dbFile)) assert.fail(`${dbFile} not generated`);

    const logFile = join(__dirname, '../../tmp/scrape.log');
    if (!fs.existsSync(logFile)) assert.fail(`${logFile} not generated`);

    const logFileContent = fs.readFileSync(logFile).toString('utf-8');
    console.log('LOGS');
    console.log(logFileContent);
    assert.isTrue(/scraping complete/.test(logFileContent), '"scraping complete" log entry not found');
    assert.isTrue(/exporting under .+ done/i.test(logFileContent), '"exporting under ... done" log entry not found');

    const csvFile = join(__dirname, '../../tmp/export.csv');
    if (!fs.existsSync(csvFile)) assert.fail(`${csvFile} not generated`);

    const csvFileContent = fs.readFileSync(csvFile).toString('utf-8');
    assert.isTrue(/main header 1/i.test(csvFileContent), '"main header 1" csv entry not found');
  }).timeout(5 * 60 * 1000);
});
