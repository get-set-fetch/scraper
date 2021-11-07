/** Base class for all entities. */
export default abstract class Entity {
  abstract save():Promise<number>;
  abstract del():Promise<void>;
  abstract toJSON();

  abstract get dbCols(): string[];

  constructor(kwArgs: Partial<Entity>) {
    Object.keys(kwArgs).forEach(kwArgKey => {
      this[kwArgKey] = kwArgs[kwArgKey];
    });
  }
}

export interface IStaticEntity {
  new(): Entity;
  get(id: number):Promise<Entity>;
  delAll():Promise<void>;
}
