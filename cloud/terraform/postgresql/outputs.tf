output "public_ip" {
  value = digitalocean_droplet.getsetfetch_pg.ipv4_address
}

output "private_ip" {
  value = digitalocean_droplet.getsetfetch_pg.ipv4_address_private
}

output "vpc_id" {
  value = digitalocean_vpc.getsetfetch_vpc.id
}

output "public_key_id" {
  value = digitalocean_ssh_key.public_key.id
}

