FROM alpine:3.14

# Installs Chromium (91.0.4472.164-r0) package, https://pkgs.alpinelinux.org/packages?name=chromium&branch=v3.14
RUN apk add --no-cache \
      chromium \
      nss \
      freetype \
      harfbuzz \
      ca-certificates \
      ttf-freefont \
      nodejs \
      npm \
      git

# Skip installing Chromium, Puppeteer will be using the installed package
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Add user so we don't need --no-sandbox, https://developers.google.com/web/tools/puppeteer/troubleshooting#running-on-alpine
RUN addgroup -S pptruser && adduser -S -g pptruser pptruser \
    && mkdir -p /home/pptruser/Downloads /app \
    && chown -R pptruser:pptruser /home/pptruser \
    && chown -R pptruser:pptruser /app

# Run everything after as non-privileged user.
USER pptruser

RUN git clone https://github.com/get-set-fetch/scraper.git /home/pptruser/scraper
WORKDIR /home/pptruser/scraper

# Puppeteer v9.1.1 works with Chromium 91, https://github.com/puppeteer/puppeteer/releases
RUN npm install puppeteer@9.1.1

# Install required peer dependencies
RUN npm install knex pg --unsafe-perm

# Build @get-set-fetch/scraper
RUN npm install \
    && npm run build
