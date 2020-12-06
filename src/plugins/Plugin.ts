/* eslint-disable no-prototype-builtins */
/* eslint-disable no-param-reassign */
/* eslint-disable no-restricted-syntax */
import { JSONSchema7 } from 'json-schema';
import SchemaHelper from '../schema/SchemaHelper';
import Site from '../storage/base/Site';
import Resource from '../storage/base/Resource';
import BrowserClient from '../scraper/BrowserClient';

export interface IPluginOpts {
  name: string;
  domRead?: boolean;
  domWrite?: boolean;
  [key: string]: any;
}

export default abstract class Plugin {
  static get schema() {
    return {};
  }

  opts: Partial<IPluginOpts>;
  result: Partial<Resource>;

  constructor(opts = {}) {
    const { schema } = <typeof Plugin> this.constructor;
    this.opts = SchemaHelper.instantiate(schema, opts);
    this.result = {};
  }

  getValType(val): 'literal' | 'array' | 'object' {
    if (val === null || val === undefined) return undefined;

    if (val.constructor === String || val.constructor === Number || val.constructor === Boolean) return 'literal';

    if (Array.isArray(val)) return 'array';

    if (val.constructor === Object) return 'object';

    return undefined;
  }

  deepEqual(x, y) {
    const xValType = this.getValType(x);
    const yValType = this.getValType(y);

    // different types
    if (xValType !== yValType) return false;

    // different scalar values
    if (xValType === null || xValType === 'literal') return x === y;

    // different key length
    if (Object.keys(x).length !== Object.keys(y).length) return false;

    // different keys
    for (const prop in x) {
      if (y.hasOwnProperty(prop)) {
        if (!this.deepEqual(x[prop], y[prop])) return false;
      }
      else {
        return false;
      }
    }

    // all test passed
    return true;
  }

  diffAndMergeResult(newResult: Partial<Resource>, oldResult: Partial<Resource> = this.result) {
    Object.keys(newResult).forEach(key => {
      const childContentType = this.getValType(newResult[key]);
      switch (childContentType) {
        case 'literal':
          oldResult[key] = newResult[key];
          break;
        case 'array':
          if (!oldResult[key]) {
            oldResult[key] = newResult[key];
          }
          else {
            // remove from the new array, already existing elms
            newResult[key] = newResult[key].filter(newElm => oldResult[key].find(oldElm => this.deepEqual(newElm, oldElm)) === undefined);
            // add the new elms to the existing
            oldResult[key].push(...newResult[key]);
          }
          break;
        case 'object':
          if (key === 'content') {
            if (!oldResult[key]) {
              oldResult[key] = {};
            }
            newResult[key] = this.diffAndMergeContent(newResult[key], oldResult[key]);
          }
          else {
            this.diffAndMergeResult(newResult[key], oldResult[key]);
          }
          break;
        default:
      }
    });

    return newResult;
  }

  /*
  used for extracting just the newly added content on a dynamic (js based) page
  ex:
  step #1
    dom content: {h1: ['valA1'], h2: ['valB1'], h3: []}
    returns {h1: ['valA1'], h2: ['valB1'], h3: ['']}
  step #2
    dom content: {h1: ['valA1', 'valA1'], h2: ['valB1', 'valB2'], h3: ['valC2']}
    returns {h1: ['valA1'], h2: ['valB2'], h3: ['valC2]}

  step #2 egde (-)
    valA1 valB1 -
    -     -     valC2
    valA1 valB2

  edge represents the boundary between previous and incoming new elements
  from the new content, everyting till the edge (included) is removed
  */
  diffAndMergeContent(newContent: { [key: string]: string[] }, oldContent: { [key: string]: string[] }) {
    const selectorKeys = Object.keys(newContent);

    // get old content edge
    const edge = selectorKeys.map(selectorKey => {
      const edgeIdx = oldContent[selectorKey] && oldContent[selectorKey].length > 0 ? oldContent[selectorKey].length - 1 : null;
      return {
        edgeIdx,
        edgeVal: edgeIdx !== null ? oldContent[selectorKey][edgeIdx] : null,
      };
    });

    const minEdgeIdx = Math.min(...edge.filter(({ edgeIdx }) => edgeIdx !== null).map(({ edgeIdx }) => edgeIdx));

    // make the edge idx relative
    edge.forEach(edgeEntry => {
      if (edgeEntry.edgeIdx !== null) {
        edgeEntry.edgeIdx -= minEdgeIdx;
      }
    });

    // identify content edge in new content
    let maxArrLength = Math.max(...selectorKeys.map(selectorKey => newContent[selectorKey].length));

    let startRowIdx = null;

    for (let rowIdx = 0; rowIdx < maxArrLength; rowIdx += 1) {
      const edgeFound = selectorKeys.every((selectorKey, selectorIdx) => {
        const { edgeIdx, edgeVal } = edge[selectorIdx];

        // don't compare elements on an edge position with no value
        if (edgeVal === null) return true;

        return newContent[selectorKey][rowIdx + edgeIdx] === edgeVal;
      });

      // edge found
      if (edgeFound) {
        startRowIdx = rowIdx;
        break;
      }
    }

    selectorKeys.forEach(
      (selectorKey, selectorIdx) => {
        // content edge found in new content, "cut" in new content till the edge,
        if (startRowIdx !== null && edge[selectorIdx].edgeIdx !== null) {
          newContent[selectorKey] = newContent[selectorKey].slice(startRowIdx + edge[selectorIdx].edgeIdx + 1);
        }
        // add the new values to old content
        oldContent[selectorKey] = oldContent[selectorKey] || [];
        oldContent[selectorKey].push(...newContent[selectorKey]);
      },
    );

    // make all array entries of same length, fill missing elements with last arr value
    maxArrLength = Math.max(...selectorKeys.map(selectorKey => newContent[selectorKey].length));
    selectorKeys.forEach(selectorKey => {
      const selectorArrLen = newContent[selectorKey].length;

      const lenDiff = maxArrLength - selectorArrLen;
      if (lenDiff > 0) {
        newContent[selectorKey].push(...Array(lenDiff).fill(selectorArrLen > 0 ? newContent[selectorKey][selectorArrLen - 1] : ''));
      }
    });

    return newContent;
  }

  abstract test(site: Site, resource: Resource): Promise<boolean> | boolean;
  abstract apply(site: Site, resource: Resource, client: BrowserClient): Promise<void | Partial<Resource>> | void | Partial<Resource>;
}

export interface IPlugin {
  new(kwArgs: Partial<IPluginOpts>): Plugin;
  schema: JSONSchema7
}
