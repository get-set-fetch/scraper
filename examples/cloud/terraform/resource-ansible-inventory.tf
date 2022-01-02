resource "local_file" "ansible_inventory" {
  content = templatefile("${path.root}/templates/hosts.tpl",
    {
      postgresql_ip = digitalocean_droplet.getsetfetch_pg.ipv4_address
      scraper_ips   = digitalocean_droplet.getsetfetch_scraper.*.ipv4_address
    }
  )
  filename = "${path.root}/../ansible/inventory/hosts.cfg"
}
