resource "digitalocean_vpc" "gsf" {
  name   = "getsetfetch-vpc"
  region = var.region
}

resource "digitalocean_ssh_key" "gsf" {
  name       = var.public_key_name
  public_key = file(var.public_key_file)
}

resource "digitalocean_droplet" "gsf_pg" {
  image       = var.pg.image
  name        = var.pg.name
  region      = var.region
  size        = var.pg.size
  monitoring  = true
  resize_disk = false
  vpc_uuid    = digitalocean_vpc.gsf.id

  ssh_keys = [
    digitalocean_ssh_key.gsf.id
  ]

  user_data = file("${path.module}/user_data_pg.yml")

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
        -e 'private_ip_address=${self.ipv4_address_private}' \
        ${var.pg.ansible_playbook_file}
  EOT
  }
}

resource "digitalocean_droplet" "gsf_scraper" {
  count       = var.scraper.count
  image       = var.scraper.image
  name        = "${var.scraper.name}-${count.index}"
  region      = var.region
  size        = var.scraper.size
  monitoring  = true
  resize_disk = false
  vpc_uuid    = digitalocean_vpc.gsf.id

  ssh_keys = [
    digitalocean_ssh_key.gsf.id
  ]

  user_data = file("${path.module}/user_data_scraper.yml")

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
        -e 'db_host=${digitalocean_droplet.gsf_pg.ipv4_address_private} scraper_idx=${count.index}' \
        ${var.scraper.ansible_playbook_file}
  EOT
  }
}

resource "local_file" "ansible_inventory" {
  content = templatefile("${path.module}/templates/hosts.tpl",
    {
      postgresql_ip = digitalocean_droplet.gsf_pg.ipv4_address
      scraper_ips   = digitalocean_droplet.gsf_scraper.*.ipv4_address
    }
  )
  filename = var.ansible_inventory_file
}
