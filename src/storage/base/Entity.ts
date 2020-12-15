export type CapabilitiesType = {
  jsonb?: boolean;
  json?: boolean;
}

export default abstract class Entity {
  abstract save():Promise<number>;
  abstract update():Promise<void>;
  abstract del():Promise<number>;

  abstract get dbCols(): string[];
  abstract get capabilities(): CapabilitiesType;

  constructor(kwArgs: Partial<Entity>) {
    Object.keys(kwArgs).forEach(kwArgKey => {
      this[kwArgKey] = kwArgs[kwArgKey];
    });
  }

  toJSON() {
    return this.dbCols.reduce(
      (obj, dbCol) => {
        const stringifyObj = this[dbCol] !== null
        && !this.capabilities.jsonb
        && typeof this[dbCol] === 'object'
        && !(this[dbCol] instanceof Date);

        const dbVal = stringifyObj ? JSON.stringify(this[dbCol]) : this[dbCol];
        return dbVal !== undefined ? Object.assign(obj, { [dbCol]: dbVal }) : obj;
      },
      {},
    );
  }
}

export interface IEntity {
  new(): Entity;

  init():Promise<void>;
  get(id: number):Promise<Entity>;
  delAll():Promise<void>;
}
