import fs from 'fs';
import { rollup, Plugin as RollupPlugin, OutputOptions, InputOptions } from 'rollup';
import typescript from 'rollup-plugin-typescript2';
import commonjs from '@rollup/plugin-commonjs';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import json from '@rollup/plugin-json';
import { extname, join, isAbsolute } from 'path';
import Plugin, { IPlugin } from '../plugins/Plugin';
import { getLogger } from '../logger/Logger';
import { getPackageDir } from '../plugins/file-utils';

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
   * @param filepath - absolute or relative to process.cwd filepath
   */
  static async addEntry(filepath: string):Promise<StoreEntry> {
    const fullFilepath = isAbsolute(filepath) ? filepath : join(process.cwd(), filepath);

    try {
      PluginStore.logger.debug('Importing plugin from %s', fullFilepath);
      const pluginModule = await import(fullFilepath);
      const Cls = pluginModule.default;
      const instance:Plugin = new Cls();

      // if instance.read/write DOM generate single file bundle to be loaded into the currently scraped browser page
      let bundle = null;
      if (instance.opts && (instance.opts.domRead || instance.opts.domWrite)) {
        PluginStore.logger.info('Bundling plugin %s', instance.constructor.name);
        bundle = await PluginStore.buildBundle(fullFilepath);
      }

      const storeEntry = {
        filepath: fullFilepath, bundle, Cls,
      };
      PluginStore.store.set(instance.constructor.name, storeEntry);
      PluginStore.logger.info('Registered plugin %s', instance.constructor.name);

      return storeEntry;
    }
    catch (err) {
      PluginStore.logger.error(err, 'Could not register plugin %s', fullFilepath);
      throw (err);
    }
  }

  /**
   * Retrieves a plugin.
   * @param name - constructor name
   */
  static get(name: string):StoreEntry {
    return PluginStore.store.get(name);
  }

  /**
   * Bundles a plugin together with its dependencies.
   * @param filepath - input filepath
   */
  static async buildBundle(filepath: string):Promise<string> {
    const inputOpts:InputOptions = {
      input: filepath,
      treeshake: {
        moduleSideEffects: false,
      },
      onwarn: msg => {
        // try not to pollute the log with all kindof 3rd party warnings...
        PluginStore.logger.trace(msg);
      },
    };
    const outputOpts:OutputOptions = {
      format: 'es',
      sourcemap: false,
    };

    const exportToGlobalPlugin = ():RollupPlugin => ({
      name: 'dynamic-import-polyfill',
      renderChunk: code => {
        const codeWithoutExport = code.replace(/^export .+$/gm, '');
        return codeWithoutExport;
      },
    });

    // different bundling settings for ts and js source files
    const plugins = extname(filepath) === '.ts'
      ? [
        nodeResolve(),
        json(),
        typescript({
          tsconfigOverride: {
            include: [ '**/*.ts' ],
            compilerOptions: {
              rootDir: getPackageDir(filepath),

              esModuleInterop: true,
              resolveJsonModule: true,
              target: 'es2020',
              strict: false,
              moduleResolution: 'node',
              module: 'esnext',
              allowJs: true,
              declaration: true,
              preserveConstEnums: true,
              useDefineForClassFields: false,
            },
          },
        }),
        commonjs({
          extensions: [ '.js', '.ts' ],
          sourceMap: false,
        }),
        exportToGlobalPlugin(),
      ]
      : [
        nodeResolve(),
        json(),
        commonjs({
          extensions: [ '.js', '.ts' ],
          sourceMap: false,
        }),
        exportToGlobalPlugin(),
      ];

    const bundle = await rollup({ ...inputOpts, plugins });
    const { output } = await bundle.generate(outputOpts);
    const { code } = output[0];

    return code;
  }
}
