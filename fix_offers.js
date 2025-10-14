// Fix the offers in storage.ts to match the database schema
const fs = require('fs');

// Read the current storage.ts file
let content = fs.readFileSync('server/storage.ts', 'utf8');

// Fix the offer structure by removing unwanted fields and ensuring proper structure
content = content.replace(
  /price: "([^"]+)"/g, 
  'pricePerUnit: "$1"'
);

content = content.replace(
  /description: "[^"]+",\s*/g, 
  ''
);

content = content.replace(
  /contractType: "[^"]+",\s*/g, 
  ''
);

content = content.replace(
  /validUntil: new Date\([^)]+\)\.toISOString\(\)/g, 
  'validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)'
);

content = content.replace(
  /commodity: \{[^}]+\},\s*/g, 
  ''
);

content = content.replace(
  /user: \{[^}]+\}\s*/g, 
  ''
);

// Write the fixed content
fs.writeFileSync('server/storage.ts', content);
console.log('Fixed storage.ts');