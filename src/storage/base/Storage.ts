import Connection from './Connection';

/**
 * Each storage option (db, in-memory) extends this class.
 */
export default abstract class Storage {
  conn: Connection;

  constructor(conn:Connection) {
    this.conn = conn;
  }
}
