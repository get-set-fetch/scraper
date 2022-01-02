resource "digitalocean_droplet" "getsetfetch_scraper" {
  count       = 1
  image       = "ubuntu-20-04-x64"
  name        = "getsetfetch-scraper-${count.index}"
  region      = "fra1"
  size        = "s-1vcpu-1gb"
  monitoring  = true
  resize_disk = false
  vpc_uuid    = digitalocean_vpc.getsetfetch_vpc.id

  ssh_keys = [
    data.digitalocean_ssh_key.terraform.id
  ]

  user_data = file("resource-scraper.sh")

  provisioner "remote-exec" {
    inline = [
      "cloud-init status --wait",
      "echo 'Connected!'"
    ]

    connection {
      host        = self.ipv4_address
      type        = "ssh"
      user        = "root"
      private_key = file(var.pvt_key)
    }
  }

  provisioner "local-exec" {
    command = <<EOT
      ANSIBLE_HOST_KEY_CHECKING=False ansible-playbook -u root -i '${self.ipv4_address},' \
      --private-key ${var.pvt_key} \
      -e 'pub_key=${var.pub_key} db_host=${digitalocean_droplet.getsetfetch_pg.ipv4_address_private} scraper_idx=${count.index}' \
      ../ansible/scraper-setup.yml
EOT
  }
}
