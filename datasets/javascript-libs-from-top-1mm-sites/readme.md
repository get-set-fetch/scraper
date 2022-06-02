### Javascript Libraries From Top 1 Million Sites

CSV Files:
- [scraped-content.csv.gz](exports/scraped-content.csv.gz) (139 MB)
    - Each row contains a page URL followed by script source URLs (absolute or relative) encountered in that page. Inline scripts have an \"\<inline>" value. \
    ex: https:// sitemaps.org/,"\<inline>","/lang.js"

- [script-count.csv](charts/script-count.csv) (600 KB) 
    - Each row contains a partial script pathname followed by a frequency count. 
    The pathname is split in fragments based on "/" and expanded from right to left until the first non-generic fragment is found. If the full pathname contains only generic keywords (index, main, dist, etc...) the script hostname is added as well. Common suffixes like .min, .min.js are removed. \
    ex: jquery/ui/core,62554


#### Get Input Data
The project scrapes URLs from Majestic 1 Million (05-29-2022). \
Download the csv from the [official site](https://majestic.com/reports/majestic-million). \
Keep 3rd column with the domain name. Manually remove 1st row containing labels.
```bash
cd ansible/files
cut -d, -f 3 downloaded-majestic-million.csv > majestic-million-compact.csv
sed -i '' 1d majestic-million-compact.csv
```

majestic-million-compact.csv is referenced by ansible playbook [scraper-setup.yml](ansible/scraper-setup.yml). It will be used to add the URLs to the initial scraping queue.

#### Scrape in Cloud
See [getsetfetch.org/blog/cloud-scraping-running-existing-projects.html](https://getsetfetch.org/blog/cloud-scraping-running-existing-projects.html) on detailed instructions on how to setup Terraform and Ansible, start scraping, monitor progress and export scraped content.

The defined terraform module [main.tf](terraform/main.tf) provisions one central PostgreSQL instance and 20 scraper instances deployed on DigitalOcean Frankfurt FRA1 datacenter.

#### Summarize Scraped Data
```bash
cd charts/extract
npx ts-node javascript-libs.ts
```
