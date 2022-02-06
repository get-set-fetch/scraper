variable "public_key_name" {
  type = string
}
variable "public_key_file" {
  type = string
}
variable "private_key_file" {
  type = string
}
variable "ansible_inventory_file" {
  type = string
}

variable "region" {
  type = string
}


variable "pg" {
  type = object({
    name                  = string
    image                 = string
    size                  = string
    ansible_playbook_file = string
  })
}

variable "scraper" {
  type = object({
    count                 = number
    name                  = string
    image                 = string
    size                  = string
    ansible_playbook_file = string
  })
}

