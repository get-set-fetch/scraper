resource "digitalocean_droplet" "getsetfetch_pg" {
  image       = "ubuntu-20-04-x64"
  name        = "getsetfetch-pg"
  region      = "fra1"
  size        = "s-4vcpu-8gb"
  monitoring  = true
  resize_disk = false
  vpc_uuid    = digitalocean_vpc.getsetfetch_vpc.id


  ssh_keys = [
    data.digitalocean_ssh_key.terraform.id
  ]

  user_data = file("resource-pg.sh")

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
      -e 'pub_key=${var.pub_key} private_ip_address=${self.ipv4_address_private}' \
      ../ansible/pg-setup.yml
EOT
  }
}
