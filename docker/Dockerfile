FROM alpine:3.14

ARG STORAGE
ARG BROWSER_CLIENT
ARG DOM_CLIENT
ARG VERSION

# core apk packages
RUN apk add --no-cache nodejs npm git

# puppeteer apk packages
# install chromium (91.0.4472.164-r0) package, https://pkgs.alpinelinux.org/packages?name=chromium&branch=v3.14
# puppeteer v9.1.1 works with this chromium version, https://github.com/puppeteer/puppeteer/releases
RUN if [ "$BROWSER_CLIENT" = "puppeteer" ] ; then apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont; fi

# puppeteer env variables
# skip installing chromium, puppeteer will be using the installed package
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# add user so we don't need --no-sandbox, https://developers.google.com/web/tools/puppeteer/troubleshooting#running-on-alpine
RUN addgroup -S gsfuser && adduser -S -g gsfuser gsfuser \
    && mkdir -p /home/gsfuser/Downloads /home/gsfuser/scraper /app \
    && chown -R gsfuser:gsfuser /home/gsfuser \
    && chown -R gsfuser:gsfuser /app

# run everything after as non-privileged user
USER gsfuser

# install and build get-set-fetch/scraper from github sources
RUN if [ "$VERSION" = "source" ] ; then \
    git clone https://github.com/get-set-fetch/scraper.git /home/gsfuser/scraper \
    && cd /home/gsfuser/scraper \
    && npm install \
    && npm run build; fi

WORKDIR /home/gsfuser/scraper

# associative arrays not available in sh or ash
# use some nested case statements for linking storage, browser and dom client npm packages to gsf versions
RUN case "$VERSION" in \
    'source') \
        case "$STORAGE" in \
            'sqlite') npm install knex@0.95.9 sqlite3@5.0.2 ;; \
            'pg') npm install knex@0.95.9 pg@8.7.1 ;; \
            'mysql') npm install knex@0.95.9 mysql@2.18.1 ;; \
        esac; \
        case "$BROWSER_CLIENT" in \
            'puppeteer') npm install puppeteer@9.1.1 ;; \
            'playwright') echo playwright;; \
        esac; \
        case "$DOM_CLIENT" in \
            'cheerio') npm install cheerio@1.0.0-rc.10 ;; \
            'jsdom') npm install jsdom@16.7.0 ;; \
        esac \
    ;; \
    esac

# invoke entrypoint as exec form, gsfscrape will receive signals such as SIGTERM
ENTRYPOINT ["/home/gsfuser/scraper/bin/gsfscrape"]

# default arguments
CMD [ "--version" ]