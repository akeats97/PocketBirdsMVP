const fs = require('fs');
const path = require('path');

// Read the CSV file
const csvPath = path.join(__dirname, '../assets/Bird List - birdnames.csv');
const outputPath = path.join(__dirname, '../constants/birdNames.ts');

// Read the CSV file
const csvContent = fs.readFileSync(csvPath, 'utf8');

// Split into lines and remove the header
const lines = csvContent.split('\n').slice(1);

// Filter out empty lines and create the array
const birdNames = lines
  .map(line => line.trim())
  .filter(line => line.length > 0)
  .map(name => `  "${name}"`);

// Create the TypeScript file content
const tsContent = `export const birdNames = [\n${birdNames.join(',\n')}\n];\n`;

// Write the file
fs.writeFileSync(outputPath, tsContent);

console.log(`Processed ${birdNames.length} bird names`); 