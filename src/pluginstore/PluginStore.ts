import fs from 'fs';
import { rollup, Plugin as RollupPlugin } from 'rollup';
import typescript from '@rollup/plugin-typescript';
import { join } from 'path';
import Plugin, { IPlugin } from '../plugins/Plugin';
import { getLogger } from '../logger/Logger';

export interface IStoreEntry {
  filepath: string;
  bundle: string,
  Cls: IPlugin;
}
export default class PluginStore {
  static logger = getLogger('PluginStore');
  static store: {[key: string]: IStoreEntry} = {};

  static init():Promise<void> {
    return PluginStore.add(join(__dirname, '..', 'plugins', 'default'));
  }

  static add(fileOrDirPath: string):Promise<void> {
    if (fs.existsSync(fileOrDirPath)) {
      return fs.lstatSync(fileOrDirPath).isDirectory()
        ? PluginStore.addEntries(fileOrDirPath)
        : PluginStore.addEntry(fileOrDirPath);
    }

    return null;
  }

  static async addEntries(dirPath: string):Promise<void> {
    await Promise.all(
      fs.readdirSync(dirPath).map(filename => PluginStore.addEntry(join(dirPath, filename))),
    );
  }

  static async addEntry(filepath: string) {
    try {
      const pluginModule = await import(filepath);
      const Cls = pluginModule.default;
      const instance:Plugin = new Cls();

      // if instance.read/write DOM generate single file bundle to be loaded into the currently scraped browser page
      let bundle = null;
      if (instance.opts && (instance.opts.domRead || instance.opts.domWrite)) {
        bundle = await PluginStore.buildBundle(filepath);
      }

      PluginStore.store[instance.constructor.name] = {
        filepath, bundle, Cls,
      };
    }
    catch (err) {
      PluginStore.logger.error(err, 'Could not add filepath %s', filepath);
    }
  }

  static get(name: string) {
    return PluginStore.store[name];
  }

  static async buildBundle(filepath: string) {
    const inputOpts = {
      input: filepath,
      onwarn: msg => {
        // to do: store and return warnings/errors ?
        // if not overwritten, warnings are written to console
      },
    };
    const outputOpts = {
      format: 'es',
      silent: true,
    };

    const exportToGlobalPlugin = ():RollupPlugin => ({
      name: 'dynamic-import-polyfill',
      renderChunk: (code, chunk) => {
        const codeWithoutExport = code.replace(/^export .+$/gm, '');
        return codeWithoutExport;
      },
    });

    const plugins = [
      typescript({
        lib: [],
        target: 'esnext',
        module: 'es6',
        tsconfig: false,
      }),
      exportToGlobalPlugin(),
    ];

    const bundle = await rollup({ ...inputOpts, plugins });
    const { output } = await bundle.generate(<any>outputOpts);
    const { code } = output[0];

    return code;
  }
}
