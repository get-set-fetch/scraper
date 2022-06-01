import fs from 'fs';
import CategoryExtractor from './CategoryExtractor';
import ScriptParser from './ScriptParser';
import { getTotals } from '../../../utils/map';

(async () => {
  // get script data as Map<hostname, Map<pathname, count>>
  const scriptParser = new ScriptParser();
  const scripts = await scriptParser.parse('../../exports/scraped-content.csv');

  // extract pathname (script name) counts with a min count of 10
  const { pathnameTotal } = getTotals(scripts);
  fs.writeFileSync(
    '../script-count.csv',
    pathnameTotal
      .filter(([ script, count ]) => count >= 10)
      .map(([ script, count ]) => `${script},${count}`).join('\n'),
  );

  const categoryExtractor = new CategoryExtractor();
  categoryExtractor.parse('../script-count.csv');
  fs.writeFileSync('../top-scripts-per-category.csv', categoryExtractor.toCsv());
})();
