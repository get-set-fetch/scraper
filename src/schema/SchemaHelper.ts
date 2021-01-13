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

export default class SchemaHelper {
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
    Object.keys(schema.properties).forEach(propKey => {
      data[propKey] = SchemaHelper.instantiate(schema.properties[propKey] as JSONSchema7, data[propKey], path.concat([ propKey ]));
    });

    return data;
  }
}
