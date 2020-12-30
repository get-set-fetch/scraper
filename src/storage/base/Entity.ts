export default abstract class Entity {
  abstract save():Promise<number>;
  abstract update():Promise<void>;
  abstract del():Promise<number>;
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

  init():Promise<void>;
  get(id: number):Promise<Entity>;
  delAll():Promise<void>;
}
