distributed scraping using multiple get-set-fetch scraper instances and a central postgresql instance.

terraform creates the instances while ansible configures them.

scrape status - systemd status and logs for scraper instances, sql queries for postgresql - is monitored via ansible playbooks.

the scrape configuration referring ExtractScriptsPlugin is responsible for extracting js script urls from top 1 million sites as reported by majestic.