import fs from 'fs';
import { rollup, Plugin as RollupPlugin } from 'rollup';
import typescript from '@rollup/plugin-typescript';
import commonjs from '@rollup/plugin-commonjs';
import { extname, join } from 'path';
import Plugin, { IPlugin } from '../plugins/Plugin';
import { getLogger } from '../logger/Logger';

export interface IStoreEntry {
  filepath: string;
  bundle: string,
  Cls: IPlugin;
}
export default class PluginStore {
  static logger = getLogger('PluginStore');
  static store:Map<string, IStoreEntry> = new Map<string, IStoreEntry>();

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

  static async addEntry(filepath: string) {
    try {
      const pluginModule = await import(filepath);
      const Cls = pluginModule.default;
      const instance:Plugin = new Cls();

      // if instance.read/write DOM generate single file bundle to be loaded into the currently scraped browser page
      PluginStore.logger.info('Bundling plugin %s', instance.constructor.name);
      let bundle = null;
      if (instance.opts && (instance.opts.domRead || instance.opts.domWrite)) {
        bundle = await PluginStore.buildBundle(filepath);
      }

      PluginStore.store.set(instance.constructor.name, {
        filepath, bundle, Cls,
      });
    }
    catch (err) {
      PluginStore.logger.error(err, 'Could not add filepath %s', filepath);
    }
  }

  static get(name: string) {
    if (!PluginStore.store.has(name)) {
      PluginStore.logger.error('Plugin %s not registered', name);
    }
    return PluginStore.store.get(name);
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

    // different bundling settings for ts and js source files
    const plugins = extname(filepath) === '.ts'
      ? [
        typescript({
          lib: [],
          target: 'esnext',
          module: 'es6',
          tsconfig: false,
        }),

        exportToGlobalPlugin(),
      ]
      : [
        commonjs({ extensions: [ '.js', '.ts' ] }),
        exportToGlobalPlugin(),
      ];

    const bundle = await rollup({ ...inputOpts, plugins });

    const { output } = await bundle.generate(<any>outputOpts);
    const { code } = output[0];

    return code;
  }
}
