import crudResource from './test-resource-crud';
import crudProject from './test-project-crud';
import Connection from '../../../src/storage/base/Connection';

const suites = {
  crudResource,
  crudProject,
};

export default function unitSuite(conn: Connection) {
  Object.values(suites).forEach(suite => {
    suite(conn);
  });
}
