const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, 'src', 'pages');
const componentsPath = path.join(__dirname, 'src', 'components');

const replacements = [
  // Backgrounds
  { to: /\bbg-white\b/g, from: /bg-slate-800\/60 backdrop-blur-xl/g },
  { to: 'bg-slate-50', from: /bg-slate-900\/40/g },
  { to: 'bg-slate-100', from: /bg-slate-800\/80/g },
  { to: 'bg-slate-200', from: /bg-slate-700\/80/g },
  
  // Borders
  { to: 'border-slate-200', from: /border-slate-700\/50/g },
  { to: 'border-slate-300', from: /border-slate-600\/50/g },

  // Text colors (Dark -> Light)
  { to: 'text-slate-900', from: /\btext-white\b/g },
  { to: 'text-slate-800', from: /\btext-slate-100\b/g },
  { to: 'text-slate-700', from: /\btext-slate-300\b/g },
  { to: 'text-slate-600', from: /\btext-slate-400\b/g },
  
  // Accents - Backgrounds
  { to: 'bg-blue-50', from: /bg-blue-900\/20/g },
  { to: 'bg-emerald-50', from: /bg-emerald-900\/20/g },
  { to: 'bg-red-50', from: /bg-red-900\/20/g },
  { to: 'bg-amber-50', from: /bg-amber-900\/20/g },
  { to: 'bg-purple-50', from: /bg-purple-900\/20/g },

  // Accents - Text (Darken -> Lighten)
  { to: 'text-blue-600', from: /\btext-blue-400\b/g },
  { to: 'text-blue-700', from: /\btext-blue-300\b/g },
  { to: 'text-emerald-600', from: /\btext-emerald-400\b/g },
  { to: 'text-emerald-700', from: /\btext-emerald-300\b/g },
  { to: 'text-red-600', from: /\btext-red-400\b/g },
  { to: 'text-red-700', from: /\btext-red-300\b/g },
  { to: 'text-amber-600', from: /\btext-amber-400\b/g },
  { to: 'text-amber-700', from: /\btext-amber-300\b/g },
  { to: 'text-purple-600', from: /\btext-purple-400\b/g },
  { to: 'text-purple-700', from: /\btext-purple-300\b/g },

  // Interactive states
  { to: 'hover:bg-slate-50', from: /hover:bg-slate-800\/80/g },
  { to: 'hover:bg-slate-100', from: /hover:bg-slate-700\/80/g },
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
      console.log(`Reverted ${file}`);
    }
  }
}

processDirectory(directoryPath);
processDirectory(componentsPath);

console.log('Theme reversion complete!');
