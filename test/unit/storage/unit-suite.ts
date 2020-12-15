import Storage from '../../../src/storage/base/Storage';
import crudResource from './test-resource-crud';
import crudSite from './test-site-crud';

const suites = {
  crudResource,
  crudSite,
};

export default function unitSuite(storage: Storage) {
  Object.values(suites).forEach(suite => {
    suite(storage);
  });
}
