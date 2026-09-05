const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, 'src', 'pages');
const componentsPath = path.join(__dirname, 'src', 'components');

const replacements = [
  // Backgrounds
  { from: /\bbg-white\b/g, to: 'bg-slate-800/60 backdrop-blur-xl' },
  { from: /\bbg-slate-50\b/g, to: 'bg-slate-900/40' },
  { from: /\bbg-slate-100\b/g, to: 'bg-slate-800/80' },
  { from: /\bbg-slate-200\b/g, to: 'bg-slate-700/80' },
  
  // Borders
  { from: /\bborder-slate-100\b/g, to: 'border-slate-700/50' },
  { from: /\bborder-slate-200\b/g, to: 'border-slate-700/50' },
  { from: /\bborder-slate-300\b/g, to: 'border-slate-600/50' },

  // Text colors (Dark -> Light)
  { from: /\btext-slate-900\b/g, to: 'text-white' },
  { from: /\btext-slate-800\b/g, to: 'text-slate-100' },
  { from: /\btext-slate-700\b/g, to: 'text-slate-300' },
  { from: /\btext-slate-600\b/g, to: 'text-slate-400' },
  
  // Accents - Backgrounds
  { from: /\bbg-blue-50\b/g, to: 'bg-blue-900/20' },
  { from: /\bbg-emerald-50\b/g, to: 'bg-emerald-900/20' },
  { from: /\bbg-red-50\b/g, to: 'bg-red-900/20' },
  { from: /\bbg-amber-50\b/g, to: 'bg-amber-900/20' },
  { from: /\bbg-purple-50\b/g, to: 'bg-purple-900/20' },

  // Accents - Text (Darken -> Lighten)
  { from: /\btext-blue-600\b/g, to: 'text-blue-400' },
  { from: /\btext-blue-700\b/g, to: 'text-blue-300' },
  { from: /\btext-emerald-600\b/g, to: 'text-emerald-400' },
  { from: /\btext-emerald-700\b/g, to: 'text-emerald-300' },
  { from: /\btext-red-600\b/g, to: 'text-red-400' },
  { from: /\btext-red-700\b/g, to: 'text-red-300' },
  { from: /\btext-amber-600\b/g, to: 'text-amber-400' },
  { from: /\btext-amber-700\b/g, to: 'text-amber-300' },
  { from: /\btext-purple-600\b/g, to: 'text-purple-400' },
  { from: /\btext-purple-700\b/g, to: 'text-purple-300' },

  // Interactive states
  { from: /\bhover:bg-slate-50\b/g, to: 'hover:bg-slate-800/80' },
  { from: /\bhover:bg-slate-100\b/g, to: 'hover:bg-slate-700/80' },
];

function processDirectory(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      processDirectory(filePath);
    } else if (filePath.endsWith('.jsx')) {
      let content = fs.readFileSync(filePath, 'utf8');
      
      for (const {from, to} of replacements) {
        content = content.replace(from, to);
      }

      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Processed ${file}`);
    }
  }
}

processDirectory(directoryPath);
processDirectory(componentsPath);

console.log('Theme conversion complete!');
