import { assert } from 'chai';
import { JSONSchema7 } from 'json-schema';
import SchemaHelper from '../../../src/schema/SchemaHelper';

describe('SchemaHelper', () => {
  it('instantiate string', async () => {
    const schemaWithDefault:JSONSchema7 = {
      type: 'string',
      default: 'valA',
    };

    let inst = SchemaHelper.instantiate(schemaWithDefault);
    assert.strictEqual(inst, 'valA');

    inst = SchemaHelper.instantiate(schemaWithDefault, 'valB');
    assert.strictEqual(inst, 'valB');
  });

  it('validate string', async () => {
    const schemaWithConst:JSONSchema7 = {
      type: 'string',
      const: 'valA',
    };

    let err;

    try {
      SchemaHelper.instantiate(schemaWithConst);
    }
    catch (e) {
      err = e;
    }
    assert.strictEqual(err.message, 'invalid value undefined, path: /');

    try {
      SchemaHelper.instantiate(schemaWithConst, 'valB');
    }
    catch (e) {
      err = e;
    }
    assert.strictEqual(err.message, 'invalid value valB, path: /');
  });

  it('instantiate integer', async () => {
    const schemaWithDefault:JSONSchema7 = {
      type: 'integer',
      default: 2,
    };

    let inst = SchemaHelper.instantiate(schemaWithDefault);
    assert.strictEqual(inst, 2);

    inst = SchemaHelper.instantiate(schemaWithDefault, 5);
    assert.strictEqual(inst, 5);

    inst = SchemaHelper.instantiate(schemaWithDefault, 0);
    assert.strictEqual(inst, 0);
  });

  it('validate integer', async () => {
    const schemaWithConst:JSONSchema7 = {
      type: 'integer',
      const: 2,
    };

    let err;

    try {
      SchemaHelper.instantiate(schemaWithConst, 3);
    }
    catch (e) {
      err = e;
    }
    assert.strictEqual(err.message, 'invalid value 3, path: /');
  });

  it('instantiate number', async () => {
    const schemaWithDefault:JSONSchema7 = {
      type: 'number',
      default: 2.01,
    };

    let inst = SchemaHelper.instantiate(schemaWithDefault);
    assert.strictEqual(inst, 2.01);

    inst = SchemaHelper.instantiate(schemaWithDefault, 5.01);
    assert.strictEqual(inst, 5.01);
  });

  it('validate number', async () => {
    const schemaWithConst:JSONSchema7 = {
      type: 'number',
      const: 2.01,
    };

    let err;

    try {
      SchemaHelper.instantiate(schemaWithConst, 3.1);
    }
    catch (e) {
      err = e;
    }
    assert.strictEqual(err.message, 'invalid value 3.1, path: /');
  });

  it('instantiate boolean', async () => {
    const schemaWithDefault:JSONSchema7 = {
      type: 'boolean',
      default: false,
    };

    let inst = SchemaHelper.instantiate(schemaWithDefault);
    assert.strictEqual(inst, false);

    inst = SchemaHelper.instantiate(schemaWithDefault, true);
    assert.strictEqual(inst, true);
  });

  it('validate boolean', async () => {
    const schemaWithConst:JSONSchema7 = {
      type: 'boolean',
      const: true,
    };

    let err;

    try {
      SchemaHelper.instantiate(schemaWithConst, 3);
    }
    catch (e) {
      err = e;
    }
    assert.strictEqual(err.message, 'invalid value 3, path: /');
  });

  it('instantiate object with default prop values', async () => {
    const schemaWithDefault:JSONSchema7 = {
      type: 'object',
      properties: {
        propA: {
          type: 'string',
          default: 'valA',
        },
        propB: {
          type: 'integer',
          default: 3,
        },
        propC: {
          type: 'boolean',
          default: true,
        },
        propD: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              d1: {
                type: 'string',
              },
              d2: {
                type: 'number',
              },
            },
          },
        },
        propE: {
          type: 'object',
          properties: {
            propE1: {
              type: 'string',
              default: 'e1',
            },
            propE2: {
              type: 'integer',
              default: 10,
            },
          },
        },
      },
    };

    let inst = SchemaHelper.instantiate(schemaWithDefault);
    assert.deepEqual(inst, {
      propA: 'valA',
      propB: 3,
      propC: true,
      propD: [],
      propE: {
        propE1: 'e1',
        propE2: 10,
      },
    });

    const partialObj = {
      propA: 'valA1',
      propB: 4,
      propD: [ { d2: 3 } ],
      propE: {
        propE1: 'e2',
      },
    };
    inst = SchemaHelper.instantiate(schemaWithDefault, partialObj);
    assert.deepEqual(inst, {
      propA: 'valA1',
      propB: 4,
      propC: true,
      propD: [ { d1: undefined, d2: 3 } ],
      propE: {
        propE1: 'e2',
        propE2: 10,
      },
    });

    const fullObj = {
      propA: 'valA1',
      propB: 4,
      propC: false,
      propD: [ { d1: 'a', d2: 3 } ],
      propE: {
        propE1: 'e2',
        propE2: 20,
      },
    };
    inst = SchemaHelper.instantiate(schemaWithDefault, fullObj);
    assert.deepEqual(inst, fullObj);
  });

  it('instantiate object with default obj value', async () => {
    const schemaWithDefault:JSONSchema7 = {
      type: 'object',
      properties: {
        map: {
          type: 'object',
          additionalProperties: {
            type: 'string',
          },
          default: {
            a: 1,
            b: 2,
          },
        },
      },
    };

    let inst = SchemaHelper.instantiate(schemaWithDefault);
    assert.deepEqual(inst, {
      map: {
        a: 1,
        b: 2,
      },
    });

    inst = SchemaHelper.instantiate(schemaWithDefault, { map: { a: 10 } });
    assert.deepEqual(inst, {
      map: {
        a: 10,
        b: 2,
      },
    });
  });
});
