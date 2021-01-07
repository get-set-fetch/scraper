import Storage from '../../../src/storage/base/Storage';
import crudResource from './test-resource-crud';
import crudProject from './test-project-crud';

const suites = {
  crudResource,
  crudProject,
};

export default function unitSuite(storage: Storage) {
  Object.values(suites).forEach(suite => {
    suite(storage);
  });
}
