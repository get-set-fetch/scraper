/** Base class for all entities. */
export default abstract class Entity {
  id: string | number;

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
