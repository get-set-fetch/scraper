import fs from 'fs';
import { rollup, Plugin as RollupPlugin } from 'rollup';
import typescript from '@rollup/plugin-typescript';
import commonjs from '@rollup/plugin-commonjs';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import json from '@rollup/plugin-json';
import { join } from 'path';
import Plugin, { IPlugin } from '../plugins/Plugin';
import { getLogger } from '../logger/Logger';

export type StoreEntry = {
  filepath: string;
  bundle: string,
  Cls: IPlugin;
}
/** Responsible for registering, retrieving plugins. Plugins to be run in DOM are bundled with their dependencies. */
export default class PluginStore {
  static logger = getLogger('PluginStore');
  static store:Map<string, StoreEntry> = new Map<string, StoreEntry>();

  /** Registers the default plugins. */
  static init():Promise<StoreEntry[]> {
    return PluginStore.addEntries(join(__dirname, '..', 'plugins', 'default'));
  }

  /**
   * Register one or multiple plugins.
   * @param fileOrDirPath - file or directory path
   */
  static add(fileOrDirPath: string):Promise<StoreEntry|StoreEntry[]> {
    if (fs.existsSync(fileOrDirPath)) {
      return fs.lstatSync(fileOrDirPath).isDirectory()
        ? PluginStore.addEntries(fileOrDirPath)
        : PluginStore.addEntry(fileOrDirPath);
    }

    const err = new Error(`Could not register plugin(s), path does not exist ${fileOrDirPath}`);
    PluginStore.logger.error(err);
    throw err;
  }

  /**
   * Register .js, .ts plugins found under the specified path.
   * @param dirPath - directory path
   */
  static async addEntries(dirPath: string):Promise<StoreEntry[]> {
    return Promise.all(
      fs.readdirSync(dirPath)
        .filter(filename => {
          // can't use path.extName as it returns '.ts' from 'a.d.ts', need to filter out '.d.ts' files
          const matchArr = filename.match(/[^.]+(.+)$/);
          if (matchArr && (matchArr[1] === '.js' || matchArr[1] === '.ts')) return true;
          return false;
        })
        .map(filename => PluginStore.addEntry(join(dirPath, filename))),
    );
  }

  /**
   * Register a plugin found under the specified path.
   * @param filepath - file path
   */
  static async addEntry(filepath: string):Promise<StoreEntry> {
    try {
      const pluginModule = await import(filepath);
      const Cls = pluginModule.default;
      const instance:Plugin = new Cls();

      // if instance.read/write DOM generate single file bundle to be loaded into the currently scraped browser page
      let bundle = null;
      if (instance.opts && (instance.opts.domRead || instance.opts.domWrite)) {
        PluginStore.logger.info('Bundling plugin %s', instance.constructor.name);
        bundle = await PluginStore.buildBundle(filepath);
      }

      const storeEntry = {
        filepath, bundle, Cls,
      };
      PluginStore.store.set(instance.constructor.name, storeEntry);

      return storeEntry;
    }
    catch (err) {
      PluginStore.logger.error(err, 'Could not rgister plugin %s', filepath);
      throw (err);
    }
  }

  /**
   * Retrieves a plugin.
   * @param name - constructor name
   */
  static get(name: string):StoreEntry {
    if (!PluginStore.store.has(name)) {
      PluginStore.logger.error('Plugin %s not registered', name);
    }
    return PluginStore.store.get(name);
  }

  /**
   * Bundles a plugin together with its dependencies.
   * @param filepath - input filepath
   */
  static async buildBundle(filepath: string):Promise<string> {
    const inputOpts = {
      input: filepath,
      treeshake: {
        moduleSideEffects: false,
      },
      onwarn: msg => {
        // to do: store and return warnings/errors ?
        // if not overwritten, warnings are written to console
      },
    };
    const outputOpts = {
      format: 'es',
      silent: true,
      sourceMap: false,
    };

    const exportToGlobalPlugin = ():RollupPlugin => ({
      name: 'dynamic-import-polyfill',
      renderChunk: (code, chunk) => {
        const codeWithoutExport = code.replace(/^export .+$/gm, '');
        return codeWithoutExport;
      },
    });

    const plugins = [
      nodeResolve(),
      json(),
      typescript({
        lib: [],
        target: 'esnext',
        module: 'es6',
        tsconfig: false,
        sourceMap: false,
      }),
      commonjs({
        extensions: [ '.js', '.ts' ],
        sourceMap: false,
      }),
      exportToGlobalPlugin(),
    ];

    const bundle = await rollup({ ...inputOpts, plugins });

    const { output } = await bundle.generate(<any>outputOpts);
    const { code } = output[0];

    return code;
  }
}
