const fs = require('fs');
let code = fs.readFileSync('frontend/src/App.tsx', 'utf-8');

// 1. Add handleNavClick
if (!code.includes('handleNavClick')) {
  code = code.replace(/const \[activeScreen, setActiveScreen\] = useState<[^>]+>\('POS'\);/, match => match + '\n\n  const handleNavClick = (screen: any) => {\n    if ((document as any).startViewTransition) {\n      (document as any).startViewTransition(() => setActiveScreen(screen));\n    } else {\n      setActiveScreen(screen);\n    }\n  };');
}

// 2. Replace onClick
code = code.replace(/onClick=\{\(\) => setActiveScreen\('([^']+)'\)\}/g, "onClick={() => handleNavClick('$1')}");

const buttonRegex = /<button[\s\S]*?onClick=\{\(\) => handleNavClick\('([^']+)'\)[\s\S]*?<\/button>/g;

code = code.replace(buttonRegex, (match, screenName) => {
  if (!match.includes('bg-gradient')) return match;
  
  const activeClassMatch = match.match(/activeScreen === '[^']+'\s*\?\s*'([^']+)'/);
  if (!activeClassMatch) return match;
  let activeClasses = activeClassMatch[1];
  activeClasses = activeClasses.replace(' text-white', '');

  const classRegex = /className=\{\`flex items-center gap-3\.5 rounded-xl text-\[15px\] font-bold transition-all cursor-pointer overflow-hidden \$\{isSidebarOpen \? 'px-3 py-2\.5 md:px-3 md:py-2\.5 w-full justify-start' : 'w-12 h-12 md:w-12 md:h-12 justify-center shrink-0 p-0'\} \$\{[^\}]+\}\`\}/;
  
  let newMatch = match.replace(classRegex, `className={\`relative group flex items-center gap-3.5 rounded-xl text-[15px] font-bold transition-all cursor-pointer overflow-hidden \${isSidebarOpen ? 'px-3 py-2.5 md:px-3 md:py-2.5 w-full justify-start' : 'w-12 h-12 md:w-12 md:h-12 justify-center shrink-0 p-0'} \${activeScreen === '${screenName}' ? 'text-white' : 'text-slate-400 hover:text-white'}\`}`);

  const pillHTML = `
                {/* Active Background Pill */}
                {activeScreen === '${screenName}' && (
                  <div 
                    className="absolute inset-0 z-0 rounded-xl ${activeClasses}"
                    style={{ viewTransitionName: 'sidebar-active-pill' }}
                  />
                )}
                {/* Hover Background (Inactive) */}
                {activeScreen !== '${screenName}' && (
                  <div className="absolute inset-0 z-0 rounded-xl bg-transparent group-hover:bg-[#151e32] border border-transparent group-hover:border-white/10 transition-colors duration-300" />
                )}`;
  
  newMatch = newMatch.replace(/(<[A-Z][a-zA-Z]+\s+className="h-6 w-6)/, pillHTML + '\n                $1');
  
  newMatch = newMatch.replace(/className="h-6 w-6 shrink-0"/, 'className="h-6 w-6 shrink-0 relative z-10"');
  newMatch = newMatch.replace(/className=\{\`whitespace-nowrap/, 'className={`whitespace-nowrap relative z-10');
  
  newMatch = newMatch.replace(/className=\{\`w-5 h-5 rounded-full/, 'className={`w-5 h-5 rounded-full relative z-10');
  newMatch = newMatch.replace(/className=\{\`text-\[10px\] px-1\.5/, 'className={`text-[10px] px-1.5 relative z-10');

  return newMatch;
});

fs.writeFileSync('frontend/src/App.tsx', code);
console.log("Refactored App.tsx");
