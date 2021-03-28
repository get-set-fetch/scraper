/* eslint-disable no-param-reassign */
/* eslint-disable import/no-extraneous-dependencies */
import { JSONSchema7 } from 'json-schema';

export type SchemaType<S> =
    S extends {type: 'object', properties} ?
      {
        -readonly [Key in keyof S['properties']]?:
        S['properties'][Key] extends {type: 'array'} ? SchemaType<S['properties'][Key]['items']>[]
          :SchemaType<S['properties'][Key]>
      }
      :S extends {type: 'boolean'} ? boolean
        :S extends {type: 'string'} ? string
          :S extends {type: 'number'|'integer'} ? number
            : unknown;

/** Json-schema handler. */
export default class SchemaHelper {
  /**
   * Based on input schema, augments data with missing default values.
   * @param schema - json-schema
   * @param data - input data
   * @param path - json path
   */
  static instantiate(schema:JSONSchema7, data = undefined, path: string[] = []) {
    // make a data copy, don't augment in place
    if (data && path.length === 0) {
      data = JSON.parse(JSON.stringify(data));
    }

    try {
      SchemaHelper.validate(schema, data);
    }
    catch (err) {
      throw new Error(`${err.message}, path: ${path.length > 0 ? path.join('/') : '/'}`);
    }

    let augmentedData;

    switch (schema.type) {
      case 'array':
        augmentedData = SchemaHelper.parseArray(schema, data || schema.default || [], path);
        break;
      case 'object':
        augmentedData = SchemaHelper.parseObject(schema, data || schema.default || {}, path);
        break;
      case 'string':
      case 'integer':
      case 'number':
      case 'boolean':
        augmentedData = data !== undefined ? data : schema.default;
        break;
      default:
    }

    return augmentedData;
  }

  static validate(schema:JSONSchema7, data) {
    // validate const
    if (schema.const) {
      const defaultFound = schema.default && !data;
      if (!defaultFound && schema.const !== data) {
        throw new Error(`invalid value ${data}`);
      }
    }

    // validate required
    if (schema.type === 'object' && schema.required) {
      Object.keys(schema.properties).forEach(propKey => {
        if (schema.required.includes(propKey) && !data[propKey]) {
          throw new Error(`${propKey} is required`);
        }
      });
    }
  }

  static parseArray(schema:JSONSchema7, data, path: string[]) {
    data.forEach((d, idx) => {
      data[idx] = SchemaHelper.instantiate(schema.items as JSONSchema7, d, path.concat([ idx.toString() ]));
    });

    return data;
  }

  static parseObject(schema:JSONSchema7, data, path: string[]) {
    if (schema.properties) {
      Object.keys(schema.properties).forEach(propKey => {
        data[propKey] = SchemaHelper.instantiate(schema.properties[propKey] as JSONSchema7, data[propKey], path.concat([ propKey ]));
      });
    }

    /*
    treating additionalProperties as a means to expand/override default obj value (if present)
    if incoming data is missing a key from default obj value, add the default key/value to it
    */
    if (schema.additionalProperties && schema.default) {
      Object.keys(schema.default).forEach(defaultKey => {
        if (!data[defaultKey]) {
          data[defaultKey] = schema.default[defaultKey];
        }
      });
    }

    return data;
  }
}
