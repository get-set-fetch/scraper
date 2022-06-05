import fs from 'fs';
import CategoryExtractor from './CategoryExtractor';
import ScriptParser from './ScriptParser';
import { getTotals } from '../../../utils/map';

(async () => {
  const dateSuffix = '2022-06-05';

  // get script data as Map<hostname, Map<pathname, count>>
  const scriptParser = new ScriptParser();
  const scripts = await scriptParser.parse(`../../exports/scraped-js-libs-${dateSuffix}.csv`);

  // extract pathname (script name) counts with a min count of 10
  const { pathnameTotal } = getTotals(scripts);
  fs.writeFileSync(
    `../js-libs-count-${dateSuffix}.csv`,
    pathnameTotal
      .filter(([ script, count ]) => count >= 10)
      .map(([ script, count ]) => `${script},${count}`).join('\n'),
  );

  const categoryExtractor = new CategoryExtractor();
  categoryExtractor.parse(`../js-libs-count-${dateSuffix}.csv`);
  fs.writeFileSync(`../most-used-js-libs-${dateSuffix}.csv`, categoryExtractor.toCsv());
})();
