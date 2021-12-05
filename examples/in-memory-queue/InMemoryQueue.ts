/* for standalone projects replace '../../src/index' with '@get-set-fetch/scraper' */
import { IQueueStorage, QueueEntry, Connection, Storage } from '../../src/index';

export default class InMemoryQueue extends Storage implements IQueueStorage {
  conn: Connection;
  queue:Map<string, QueueEntry>;

  async drop() {
    delete this.queue;
  }

  async init() {
    this.queue = new Map();
  }

  async filterExistingEntries(urls: string[]) {
    return urls
      .filter(url => this.queue.has(url))
      .map(url => ({ url }));
  }

  add(entries: QueueEntry[]) {
    entries.forEach(entry => {
      if (!this.queue.has(entry.url)) {
        this.queue.set(entry.url, { ...entry, id: entry.url });
      }
    });

    return Promise.resolve();
  }

  count() {
    return Promise.resolve(this.queue.size);
  }

  async getResourcesToScrape(limit:number = 10) {
    const queueEntries:QueueEntry[] = [];

    const queueIt = this.queue.values();
    let result: IteratorResult<QueueEntry> = queueIt.next();

    while (queueEntries.length < limit && !result.done) {
      const queueEntry:QueueEntry = result.value;

      if (queueEntry.status === undefined) {
        queueEntry.status = 1;
        queueEntries.push(queueEntry);
      }

      result = queueIt.next();
    }

    return queueEntries;
  }

  async getAll() {
    return Array.from(this.queue.values());
  }

  async updateStatus(url: string, status: number) {
    const queueEntry = this.queue.get(url);
    if (queueEntry) {
      queueEntry.status = status;
    }
  }
}
