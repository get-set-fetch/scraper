For both docker build and run commands make this repo directory the current working directory.

## Build
All scraper images are based on alpine:3.14 docker image.
You have to build the images locally; they're not published on Docker Hub.
A set of built-time variables allows you to customize the docker image.

 Built-time Variable | Values | Default |
| ------- | -------| --|
| BROWSER_CLIENT | puppeteer | -
| DOM_CLIENT | cheerio, jsdom | -
| STORAGE | sqlite, pg, mysql | -
| VERSION | source | -
| USER_ID |  | 1000
| GROUP_ID |  | 1000

`BROWSER_CLIENT` and `DOM_CLIENT` variables are mutually exclusive. You either scrape using a headless browser or a HTML/DOM parser library.

`USER_ID` and `GROUP_ID` are used to add the `gsfuser` user to the container. This non-root user runs the scraper, reads and writes data to the `/home/gsfuser/scraper/data` container path mounted from the host. Use `--build-arg USER_ID=$(id -u)`, `--build-arg GROUP_ID=$(id -g)` to provide the same uid/gid as the currently logged in user. If you're on Windows you can ignore these two variables.

Create an image using cheerio, sqlite and latest source code.
```bash
docker build \
--tag getsetfetch \
--build-arg DOM_CLIENT=cheerio \
--build-arg STORAGE=sqlite \
--build-arg VERSION=source \
--build-arg USER_ID=$(id -u) \
--build-arg GROUP_ID=$(id -g) .
```

Create an image using puppeteer, sqlite and latest source code.
```bash
docker build \
--tag getsetfetch \
--build-arg BROWSER_CLIENT=puppeteer \
--build-arg STORAGE=sqlite \
--build-arg VERSION=source \
--build-arg USER_ID=$(id -u) \
--build-arg GROUP_ID=$(id -g) .
```


## Run
All examples contain config, log, sqlite, csv files under `/home/gsfuser/scraper/data` container path mounted from the host for easy access to logs and exported scraped content. Remaining arguments represent [CLI arguments](/get-set-fetch/scraper#command-line-interface).


Log, scrape and export data using [config-sqlite-cheerio.json](data/config-sqlite-cheerio.json).
```bash
docker run \
-v <host_dir>/scraper/docker/data:/home/gsfuser/scraper/data getsetfetch:latest \
--version \
--config data/config-sqlite-cheerio.json \
--save \
--overwrite \
--scrape \
--loglevel info \
--logdestination data/scrape.log \
--export data/export.csv
```

Log, scrape and export data using [config-sqlite-puppeteer.json](data/config-sqlite-puppeteer.json). Use either `--security-opt seccomp=unconfined` or `--security-opt seccomp=data/chromium-security-profile.json` ([source blog](https://blog.jessfraz.com/post/how-to-use-new-docker-seccomp-profiles/)) to allow Chromium syscalls.
```bash
docker run \
--security-opt seccomp=unconfined
-v <host_dir>/scraper/docker/data:/home/gsfuser/scraper/data getsetfetch:latest \
--version \
--config data/config-sqlite-puppeteer.json \
--save \
--overwrite \
--scrape \
--loglevel info \
--logdestination data/scrape.log \
--export data/export.csv
```

You can also start the scraper as a [docker-compose service](pg-puppeteer/docker-compose.yml). This example scrapes using puppeteer and postgresql. Remember to build the corresponding image `--build-arg STORAGE=pg --build-arg BROWSER_CLIENT=puppeteer` first :)

```bash
cd ./pg-puppeteer

# start
docker-compose up -d

# stop
docker-compose down
```
