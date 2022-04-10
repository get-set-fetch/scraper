module "top_1000k_js_scripts" {
  source = "../../../cloud/terraform"

  region                 = "fra1"
  public_key_name        = "get-set-fetch"
  public_key_file        = var.public_key_file
  private_key_file       = var.private_key_file
  ansible_inventory_file = "../ansible/inventory/hosts.cfg"

  pg = {
    name                  = "pg"
    image                 = "ubuntu-20-04-x64"
    size                  = "s-4vcpu-8gb"
    ansible_playbook_file = "../ansible/pg-setup.yml"
  }

  scraper = {
    count                 = 1
    name                  = "scraper"
    image                 = "ubuntu-20-04-x64"
    size                  = "s-1vcpu-1gb"
    ansible_playbook_file = "../ansible/scraper-setup.yml"
  }
}



