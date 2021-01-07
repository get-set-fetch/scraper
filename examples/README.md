## Examples

What follows are real world scraping examples. If in the meanwhile the pages have changed, the scraping definitions below may become obsolete and no longer produce the expected scraping results. Last check performed on 7th January 2021. 

[Acceptance test definitions](https://github.com/get-set-fetch/test-utils/tree/main/lib/scraping-suite) may also serve as inspiration.

- [Table Scraping](#table-scraping)
- [Product Details](#product-details)
- [PDF Extraction](#pdf-extraction)
- [Infinite Scrolling](#infinite-scrolling)

### Table Scraping
Top languages by population. Extract tabular data from a single static html page. [See full script.](table-scraping.ts)
```js
const scrapeDefinition = {
  url: 'https://en.wikipedia.org/wiki/List_of_languages_by_number_of_native_speakers',
  scenario: 'static-content',
  pluginOpts: [
    {
      name: 'ExtractUrlsPlugin',
      maxDepth: 0,
    },
    {
      name: 'ExtractHtmlContentPlugin',
      selectorPairs: [
        {
          contentSelector: 'table.metadata + p + table.wikitable td:nth-child(2) > a:first-child',
          label: 'language',
        },
        {
          contentSelector: 'table.metadata + p + table.wikitable td:nth-child(3)',
          label: 'speakers (milions)',
        },
      ],
    },
  ],
};
```

### Product Details
Book details with author, title, rating value, review count. Also scrapes the book covers. Only the first and second page of results are being scraped. [See full script.](product-details.ts)
```js
const scrapeDefinition = {
  url: 'https://openlibrary.org/authors/OL34221A/Isaac_Asimov?page=1',
  scenario: 'static-content',
  pluginOpts: [
    {
      name: 'SelectResourcePlugin',
      delay: 2000,
    },
    {
      name: 'ExtractUrlsPlugin',
      maxDepth: 3,
      selectorPairs: [
        {
          urlSelector: '#searchResults ~ .pagination > a.ChoosePage:nth-child(2)',
        },
        {
          urlSelector: 'h3.booktitle a.results',
        },
        {
          urlSelector: 'a.coverLook > img.cover',
        },
      ],
    },
    {
      name: 'ExtractHtmlContentPlugin',
      selectorPairs: [
        {
          contentSelector: 'h1.work-title',
          label: 'title',
        },
        {
          contentSelector: 'h2.edition-byline a',
          label: 'author',
        },
        {
          contentSelector: 'ul.readers-stats > li.avg-ratings > span[itemProp="ratingValue"]',
          label: 'rating value',
        },
        {
          contentSelector: 'ul.readers-stats > li > span[itemProp="reviewCount"]',
          label: 'review count',
        },
      ],
    },
  ],
};
```

### PDF Extraction
World Health Organization COVID-19 Updates during last month. Opens each report page and downloads the pdf. [See full script.](pdf-extraction.ts)
```js
const scrapeDefinition = {
  url: 'https://www.who.int/emergencies/diseases/novel-coronavirus-2019/situation-reports',
  scenario: 'static-content',
  pluginOpts: [
    {
      name: 'SelectResourcePlugin',
      delay: 1000,
    },
    {
      name: 'ExtractUrlsPlugin',
      maxDepth: 2,
      selectorPairs: [
        {
          urlSelector: '.sf-meeting-report-list:nth-child(5) > a.sf-meeting-report-list__item',
        },
        {
          urlSelector: '.button-blue-background > a',
          titleSelector: 'h1.dynamic-content__heading',
        },
      ],
    },
  ]
};
```

### Infinite Scrolling
UEFA Champions League top goalscorers. Keeps scrolling and loading new content until the final 100th position is reached. After each scroll action scraping is resumed only after the preloader is removed and the new content is available. [See full script.](infinite-scrolling.ts)
```js
const scrapeDefinition = {
  url: 'https://www.uefa.com/uefachampionsleague/history/rankings/players/goals_scored/',
  scenario: 'static-content',
  pluginOpts: [
    {
      name: 'ExtractUrlsPlugin',
      maxDepth: 0,
    },
    {
      name: 'ExtractHtmlContentPlugin',
      selectorPairs: [
        {
          contentSelector: 'div.statistics-item--name',
          label: 'player',
        },
        {
          contentSelector: 'div.history-numbers',
          label: 'goals',
        },
      ],
    },
    {
      name: 'ScrollPlugin',
      after: 'UpsertResourcePlugin',
      stabilityCheck: 1000,
    },
  ],
};
```