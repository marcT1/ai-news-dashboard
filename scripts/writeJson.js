import fs from 'fs';

export function writeOutputJson(data) {
  return writeJson(data);
}

export function writeJson(data) {
  const dataPath = 'data/latest.json';
  const docsPath = 'docs/data.json';
  
  const json = JSON.stringify(data, null, 2);
  
  fs.writeFileSync(dataPath, json, 'utf8');
  console.log(`[writeJson] Wrote ${dataPath}`);
  
  fs.writeFileSync(docsPath, json, 'utf8');
  console.log(`[writeJson] Wrote ${docsPath}`);
  
  return data;
}
