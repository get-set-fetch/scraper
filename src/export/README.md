## Export

Scraped content is stored at database level in resource entries under a site. See [Storage](../storage/README.md) for more info.
Each exporter constructor takes 3 parameters:
- `site` - content from all resources under the given site will be exported
- `filepath` - location to store the content, relative to the current working directory
- `opts` - export options pertinent to the selected export type


You can export directly from each individual exporter.
```js
const { CsvExporter } = require('get-set-fetch-scraper');
exporter = new CsvExporter(site, 'file.csv', {fieldSeparator: ','});
await exporter.export();
```

Or via a scraper instance with the site parameter being ommited as it is already linked to the scraper. In this case you also need to specify the export type as either csv or zip.
```js
await scraper.export('file.csv', {type: 'csv', fieldSeparator: ','});
```


### CsvExporter
Exports scraped content as csv.
- `cols`
  - Resource properties to be exported. Suitable properties for export: url, actions, depth, scrapedAt, contentType, content, parent.
  - default: `[ 'url', 'content' ]`
- `pageLimit`
  - Number of resources to be retrieved when doing a bulk read.
  - default: `100`
- `fieldSeparator`
  - default: `','`
- `lineSeparator`
  - default: `'\n'`

### ZipExporter
Exports binary resources as a series of zip archives.
- `pageLimit`
  - Number of resources to be retrieved when doing a bulk read. Each bulk read generates a zip archive (store compression) containing a counter increment at the end of the filename.
  - default: `100`