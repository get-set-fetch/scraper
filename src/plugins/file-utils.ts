import fs from 'fs';
import path from 'path';

/**
 * Get closest parent dir containing a package.json file
 */
// eslint-disable-next-line import/prefer-default-export
export function getPackageDir(startPath: string):string {
  const startDirPath = path.dirname(startPath);
  const parentPath: string[] = [];
  while (!fs.existsSync(path.join(startDirPath, ...parentPath, 'package.json')) || parentPath.length > 10) {
    parentPath.push('..');
  }

  return path.join(startDirPath, ...parentPath);
}

export function moduleExists(name) {
  try {
    return require.resolve(name);
  }
  catch (e) {
    return false;
  }
}
