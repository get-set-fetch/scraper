resource "digitalocean_droplet" "getsetfetch_scraper" {
  count       = var.scraper_no
  image       = "ubuntu-20-04-x64"
  name        = "getsetfetch-scraper-${count.index}"
  region      = var.region
  size        = var.size
  monitoring  = true
  resize_disk = false
  vpc_uuid    = var.vpc_id

  ssh_keys = [
    var.public_key_id
  ]

  user_data = file("${path.module}/user_data.yml")

  provisioner "remote-exec" {
    inline = [
      "cloud-init status --wait"
    ]

    connection {
      host        = self.ipv4_address
      type        = "ssh"
      user        = "root"
      private_key = file(var.private_key_file)
    }
  }

  provisioner "local-exec" {
    command = <<EOT
      ansible-playbook -u root -i '${self.ipv4_address},' \
      --private-key ${var.private_key_file} \
      -e 'db_host=${var.db_private_ip} scraper_idx=${count.index}' \
      ${var.ansible_playbook}
EOT
  }
}

resource "local_file" "ansible_inventory" {
  content = templatefile("${path.module}/templates/hosts.tpl",
    {
      postgresql_ip = var.db_public_ip
      scraper_ips   = digitalocean_droplet.getsetfetch_scraper.*.ipv4_address
    }
  )
  filename = "${var.ansible_inventory_dir}/hosts.cfg"
}


