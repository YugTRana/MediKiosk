const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, 'src', 'pages');
const componentsPath = path.join(__dirname, 'src', 'components');

const replacements = [
  // Upgrade basic white backgrounds to premium glassmorphic cards
  // We first avoid double-replacing if the file was already upgraded
  { from: /\bbg-white(?!\/)\b/g, to: 'bg-white/80 backdrop-blur-xl border border-white shadow-xl shadow-slate-200/40 transition-all duration-300 hover:shadow-2xl hover:bg-white/90' },
  
  // Upgrade basic light slates
  { from: /\bbg-slate-50(?!\/)\b/g, to: 'bg-slate-50/50 backdrop-blur-lg border border-white/50' },
  
  // Soften standard borders
  { from: /\bborder-slate-200(?!\/)\b/g, to: 'border-slate-200/60' },
  { from: /\bborder-slate-100(?!\/)\b/g, to: 'border-slate-100/60' },

  // Upgrade basic shadows
  { from: /\bshadow-sm\b/g, to: 'shadow-md shadow-slate-200/30' },
  { from: /\bshadow-md\b/g, to: 'shadow-xl shadow-slate-200/50' },
  
  // Upgrade simple hovers to smooth translating interactions
  { from: /\bhover:bg-slate-50\b/g, to: 'hover:bg-white/90 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300' },
  { from: /\bhover:bg-slate-100\b/g, to: 'hover:bg-slate-50 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300' },

  // Make text punchier but soft
  { from: /\btext-slate-800\b/g, to: 'text-slate-700' }, // softer primary text
  { from: /\btext-slate-900\b/g, to: 'text-slate-800 font-medium' }
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
      
      // Safety check: if file already has "backdrop-blur-xl border border-white", skip to avoid compounding
      if (content.includes('backdrop-blur-xl border border-white')) {
         console.log(`Skipping ${file} (Already upgraded)`);
         continue;
      }

      for (const {from, to} of replacements) {
        content = content.replace(from, to);
      }

      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Upgraded ${file} to Premium Light`);
    }
  }
}

processDirectory(directoryPath);
processDirectory(componentsPath);

console.log('Premium Light Theme upgrade complete!');
