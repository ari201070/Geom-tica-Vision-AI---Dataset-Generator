const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const delayFuncStr = `const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));`;

if (!code.includes(delayFuncStr)) {
  code = code.replace(/import { motion, AnimatePresence } from 'motion\/react';/, `import { motion, AnimatePresence } from 'motion/react';\n${delayFuncStr}`);
}

const target1 = `        const newAnchors = await researchLocationAnchors(currentLoc, hasCustomKey);`;
const replace1 = `        await delay(2000); // 2 second pause to avoid rate limits
        const newAnchors = await researchLocationAnchors(currentLoc, hasCustomKey);`;

const target2 = `        // Geocode central coordinate first
        const centerCoord = await geocodeLocation(currentLoc);`;
const replace2 = `        // Geocode central coordinate first
        await delay(2000); // 2 second pause
        const centerCoord = await geocodeLocation(currentLoc);`;

const target3 = `            const batch = await generateDatasetBatch(currentBatchSize, locStartIdx + i + 1, currentLoc, centerCoord, hasCustomKey, 3, customCenters || undefined, newAnchors);`;
const replace3 = `            await delay(3000); // 3 second pause before generation
            const batch = await generateDatasetBatch(currentBatchSize, locStartIdx + i + 1, currentLoc, centerCoord, hasCustomKey, 3, customCenters || undefined, newAnchors);`;

code = code.replace(target1, replace1).replace(target2, replace2).replace(target3, replace3);

fs.writeFileSync('src/App.tsx', code);
console.log('Done');
