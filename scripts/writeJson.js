import fs from 'fs';
import path from 'path';

export function writeJson(data) {
  // Write to both locations
  const dataPath = 'data/latest.json';
  const docsPath = 'docs/data.json';
  
  const json = JSON.stringify(data, null, 2);
  
  fs.writeFileSync(dataPath, json, 'utf8');
  console.log(`[writeJson] Wrote ${dataPath}`);
  
  fs.writeFileSync(docsPath, json, 'utf8');
  console.log(`[writeJson] Wrote ${docsPath}`);
}
