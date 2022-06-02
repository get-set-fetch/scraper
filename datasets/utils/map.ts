/* eslint-disable import/prefer-default-export */

export function getTotals(map: Map<string, Map<string, number>>)
  : {hostnameTotal:[string, number][], pathnameTotal: [string, number][]} {
  const hostnameTotalMap:Map<string, number> = new Map();
  const pathnameTotalMap:Map<string, number> = new Map();

  let totalScriptCount = 0;
  map.forEach((pathnames, hostname) => {
    let hostnameCount = 0;

    // sum pathnames (script names) across all hostnames
    pathnames.forEach((count, pathname) => {
      addToMap(pathnameTotalMap, pathname, count);
      hostnameCount += count;
    });

    // record each hostname total scripts
    hostnameTotalMap.set(hostname, hostnameCount);
    totalScriptCount += hostnameCount;
  });

  const avgScriptCount = totalScriptCount / pathnameTotalMap.size;

  // order descending
  const hostnameTotal = Array.from(hostnameTotalMap.entries()).sort((a: [string, number], b: [string, number]) => b[1] - a[1]);
  const pathnameTotal = Array.from(pathnameTotalMap.entries()).sort((a: [string, number], b: [string, number]) => b[1] - a[1]);

  return { hostnameTotal, pathnameTotal };
}

export function getTopEntries(map: Map<string, Map<string, number>>, topHostnames:number = 20, topPathnames:number = 20)
  : {hostnames: string[], pathnames: string[]} {
  const { hostnameTotal, pathnameTotal } = getTotals(map);

  const hostnames:string[] = hostnameTotal.slice(0, topHostnames).map(([ key ]) => key);
  const pathnames:string[] = pathnameTotal.slice(0, topPathnames).map(([ key ]) => key);

  return { hostnames, pathnames };
}

export function addToMap(map: Map<string, number>, key: string, val: number = 1) {
  const count = map.get(key);
  if (!count) {
    map.set(key, val);
  }
  else {
    map.set(key, count + val);
  }
}

export function addToNestedMap(map: Map<string, Map<string, number>>, mainKey: string, subKey: string, val: number = 1) {
  const subMap = map.get(mainKey);
  if (!subMap) {
    map.set(mainKey, new Map([ [ subKey, 1 ] ]));
  }
  else {
    addToMap(subMap, subKey, val);
  }
}
