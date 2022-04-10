terraform {
  required_providers {
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = "~> 2.4"
    }
  }
}

provider "digitalocean" {
  token = var.api_token
}
