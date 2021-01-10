# Storage

Each url (web page, image, API endpoint, ...) represents a [Resource](./base/Resource). Binary content is stored under `resource.data` while text based content is stored under `resource.content`. Resources sharing the same scraping definition and discovered from the same initial url are grouped in a [Project](./base/Project). 
Projects represent the starting point for any scraping operation.

You can add additional storage support by implementing the above two abstract classes and [Storage](./base/Storage).

The database credentials below match the ones from the corresponding docker files.

## SQLite
Default storage option if none provided consuming the least amount of resources. Requires knex and sqlite driver. 
```
$ npm install knex sqlite3 --save
``` 

```js
const { KnexStorage } = require('get-set-fetch-scraper');
const conn = {
  client: 'sqlite3',
  useNullAsDefault: true,
  connection: {
    filename: ':memory:'
  }
}
const storage = new KnexStorage(conn);
```

## MySQL
Requires knex and mysql driver.  
```
$ npm install knex mysql --save
``` 

```js
const { KnexStorage } = require('get-set-fetch-scraper');
const conn = {
  client: 'mysql',
  useNullAsDefault: true,
   connection: {
    host: 'localhost',
    port: '33060',
    user: 'gsf-user',
    password: 'gsf-pswd',
    database: 'gsf-db'
  }
}
const storage = new KnexStorage(conn);
```
Docker file: [mysql.yml](../../test/storage/mysql/mysql.yml)


## PostgreSQL
Requires knex and postgresql driver.  
```
$ npm install knex pg --save
``` 

```js
const { KnexStorage } = require('get-set-fetch-scraper');
const conn = {
  client: 'pg',
  useNullAsDefault: true,
   connection: {
    host: 'localhost',
    port: '54320',
    user: 'gsf-user',
    password: 'gsf-pswd',
    database: 'gsf-db'
  }
}
const storage = new KnexStorage(conn);
```
Docker file: [pg.yml](../../test/storage/pg/pg.yml)