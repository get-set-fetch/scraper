import fs from 'fs';
import Resource from '../storage/base/Resource';
import Exporter from './Exporter';

export default class CsvExporter extends Exporter {
  expandedCols: string[];

  async export() {
    const { lineSeparator, fieldSeparator, pageLimit } = this.opts;
    let pageOffset = 0;

    let data = await this.site.getPagedContent(pageOffset, pageLimit);
    this.calibrate(data);

    const wstream = fs.createWriteStream(this.filepath);

    // write csv header
    wstream.write(this.expandedCols.join(fieldSeparator));

    // write csv body
    while (data && data.length > 0) {
      data.forEach(dataRow => {
        wstream.write(lineSeparator);
        const csvRows = this.expandDataRowIntoCsvRows(dataRow, this.expandedCols);
        wstream.write(csvRows.join(lineSeparator));
      });

      pageOffset += pageLimit;
      // eslint-disable-next-line no-await-in-loop
      data = await this.site.getPagedContent(pageOffset, pageLimit);
    }

    wstream.close();
  }

  calibrate(data: Partial<Resource>[]) {
    /*
    get expanded cols
    if col points to a literal, expandedCols will resolve to col
    if col points to an array, expandedCols will resolve to col
    if col points to an object, expandedCols will resolve to col.propA, col.propB, ...

    assumptations:
      - array elements can only be literals
      - obj properties can be literals, array, sub.objects
    */
    const expandedColSet = new Set<string>();
    data.forEach(row => {
      const detailCols = this.getRowDetailCols(row, this.opts.cols);
      const diffCols = detailCols.filter(col => !expandedColSet.has(col));
      if (diffCols.length > 0) {
        diffCols.forEach(diffCol => expandedColSet.add(diffCol));
      }
    });

    const expandedCols = Array.from(expandedColSet).sort((colA, colB) => {
      const colAIdx = this.opts.cols.findIndex(col => colA.indexOf(col) === 0);
      const colBIdx = this.opts.cols.findIndex(col => colB.indexOf(col) === 0);

      return (colAIdx === colBIdx) ? colA.localeCompare(colB) : colAIdx - colBIdx;
    });

    this.expandedCols = expandedCols;
  }

  getRowDetailCols(row: object, props: string[]): string[] {
    return props.reduce(
      (detailCols, rootKey) => {
        const val = this.nestedGetIn(row, rootKey);

        // val is either null or literal
        if (val === null || val.constructor === String || val.constructor === Number || val.constructor === Boolean) {
          detailCols.push(rootKey);
          return detailCols;
        }

        // val is array, assume each arr element is literal, doesn't contain objects
        if (Array.isArray(val)) {
          detailCols.push(rootKey);
          return detailCols;
        }

        // val is object, each property may contain sub.objects
        if (val.constructor === Object) {
          const objProps = Object.keys(val).map(key => `${rootKey}.${key}`);
          const objCols = this.getRowDetailCols(row, objProps);
          return detailCols.concat(objCols);
        }

        return detailCols;
      },
      [],
    );
  }

  /*
  generally subobjects are detected by spliting the path against '.'
  but this is not always the case
  resource example:
  info: {
    content: {
      h1: '...'
      i.classA: [ ...]
    }
  }

  info.content.h1 exists
  info.content.i doesn't exists
  info.content.i.classA exists
  info.content.i.classA.0 exists
  */
  nestedGetIn(nestedObj, path: string) {
    const pathSegments = path.split('.');

    let accPath: string[] = [];
    let accProp: string;

    const val = pathSegments.reduce(
      (obj, key) => {
        accPath.push(key);
        accProp = accPath.join('.');
        if (obj && Object.keys(obj).includes(accProp)) {
          accPath = [];
          return obj[accProp];
        }
        return obj;
      },
      nestedObj,
    );

    // if the accumulated path is not resolved till the end, the path is non-existent
    return accPath.length > 0 ? undefined : val;
  }

  /*
  dataRow: {a: ['a1', 'a2'], b: ['b1', 'b2], c: 'c1}
  into csvRows:
  [
    ['a1', 'b1', c1],
    ['a2', 'b2', c1]
  ]
  */
  expandDataRowIntoCsvRows(dataRow: object, cols: string[]) {
    let idxIncremented;
    let arrIdx = -1;
    const csvRows = [];

    do {
      idxIncremented = false;
      // eslint-disable-next-line no-loop-func
      const csvRow = cols.map(expandedCol => {
        let val = this.nestedGetIn(dataRow, expandedCol);

        // arr handling
        if (Array.isArray(val)) {
          if (!idxIncremented && arrIdx < val.length - 1) {
            arrIdx += 1;
            idxIncremented = true;
          }

          val = val.length > arrIdx ? val[arrIdx] : val[val.length - 1];
        }

        /*
        quotes handling
        RFC-4180 "If double-quotes are used to enclose fields,
        then a double-quote appearing inside a field must be escaped by preceding it with another double quote."
        */
        if (val === undefined) {
          return '""';
        }
        const quotedVal = val && val.constructor === String ? val.replace(/"/g, '""') : val;
        return `"${quotedVal}"`;
      });

      // only add to csv rows if it's the 1st pass or there have been new arr elements added
      if (arrIdx === -1 || idxIncremented) {
        csvRows.push(csvRow);
      }
    }
    while (idxIncremented);

    return csvRows;
  }
}
