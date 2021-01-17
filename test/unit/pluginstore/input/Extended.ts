import { BaseJsA } from './BaseJs';

class Extended extends BaseJsA {
  sum(a:number, b:number) {
    return a + b;
  }
}

module.exports = Extended;
