[postgresql]
${postgresql_ip}

[scraper]
%{ for ip in scraper_ips ~}
${ip}
%{ endfor ~}