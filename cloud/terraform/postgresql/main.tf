resource "digitalocean_droplet" "getsetfetch_pg" {
  image       = "ubuntu-20-04-x64"
  name        = "getsetfetch-pg"
  region      = var.region
  size        = var.size
  monitoring  = true
  resize_disk = false
  vpc_uuid    = digitalocean_vpc.getsetfetch_vpc.id

  ssh_keys = [
    digitalocean_ssh_key.public_key.id
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
      -e 'private_ip_address=${self.ipv4_address_private}' \
      ${var.ansible_playbook}
EOT
  }
}

resource "digitalocean_vpc" "getsetfetch_vpc" {
  name   = "getsetfetch-vpc"
  region = var.region
}

resource "digitalocean_ssh_key" "public_key" {
  name       = var.public_key_name
  public_key = file(var.public_key_file)
}
