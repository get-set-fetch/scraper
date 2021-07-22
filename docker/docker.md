All scraper images are based on alpine:3.14 docker image. 
You have to build the images locally, they're not published on Docker Hub.

### GetSetFetch@source + Puppeteer
Chromium and Puppeteer versions are 91.0.4472.164-r0 and 9.1.1 respectively. A non-privileged user is created, avoiding launching the browser with the `--no-sandbox` flag. The github repo is used to pull the latest @get-set-fetch/scraper files.

```bash
# build the image
docker build -t getsetfetch .
```

### Docker Compose Examples
[Scraping using Postgresql and Puppeteer](./pg-puppeteer)
```bash
cd ./pg-puppeteer

# start
docker-compose up -d

# stop
docker-compose down
```





