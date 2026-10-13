// Parse the Brewers Association Beer Style Guidelines text into style records.
//
// Each style in the BA document carries a block like:
//   Italian-Style Pilsener
//   Color: Straw to pale ...
//   ...
//   Original Gravity (°Plato) 1.044-1.052 (11-12.9 °Plato)
//   Apparent Extract/Final Gravity (°Plato) 1.008-1.012 (2.1-3.1 °Plato)
//   Alcohol by Weight (Volume) 3.8%-4.6% (4.8%-5.8%)
//   Bitterness (IBU) 25-40
//   Color SRM (EBC) 2-5 (4-10 EBC)
// The parser anchors on the "Alcohol by Weight (Volume)" line and walks back to the
// nearest preceding style-name line (a short line that is not a labelled attribute).

import { collapseWhitespace, normalizePunctuation } from './text.mjs';

const ATTRIBUTE_LINE = /^(Color|Clarity|Perceived Malt Aroma|Perceived Hop Aroma|Perceived Bitterness|Fermentation Characteristics|Body|Additional notes|Original Gravity|Apparent Extract|Alcohol by Weight|Bitterness|Color SRM)/i;

function range(text) {
  const m = String(text).replace(/,/g, '').match(/(\d+(?:\.\d+)?)\s*%?\s*[-–—]\s*(\d+(?:\.\d+)?)/);
  return m ? { min: Number(m[1]), max: Number(m[2]) } : null;
}

export function parseStyleGuidelines(rawText) {
  const lines = normalizePunctuation(rawText).split(/\r?\n/).map((l) => collapseWhitespace(l));
  const styles = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!/^Alcohol by Weight\s*\(Volume\)/i.test(line)) continue;
    const abvMatch = line.match(/\(\s*(\d+(?:\.\d+)?)\s*%\s*[-–—]\s*(\d+(?:\.\d+)?)\s*%\s*\)/);
    const abv = abvMatch ? { min: Number(abvMatch[1]), max: Number(abvMatch[2]) } : null;
    // Find the style name: walk back to the last line that is not an attribute line
    // and not a sentence (ends without a period, under 80 characters).
    let name = '';
    let descriptionLines = [];
    for (let j = i - 1; j >= 0 && j >= i - 40; j -= 1) {
      const candidate = lines[j];
      if (!candidate) continue;
      if (ATTRIBUTE_LINE.test(candidate) || /^\d/.test(candidate)) {
        descriptionLines.unshift(candidate);
        continue;
      }
      if (candidate.length <= 80 && !/[.:]$/.test(candidate) && /^[A-Z]/.test(candidate)) {
        name = candidate;
        break;
      }
      descriptionLines.unshift(candidate);
    }
    if (!name) continue;
    const window = lines.slice(i, i + 4).join(' ');
    const ibu = range((window.match(/Bitterness\s*\(IBU\)\s*([\d.,\s–—-]+)/i) ?? [])[1] ?? '');
    const srm = range((window.match(/Color SRM\s*\(EBC\)\s*([\d.,\s–—-]+)/i) ?? [])[1] ?? '');
    const color = descriptionLines.find((l) => /^Color:/i.test(l))?.replace(/^Color:\s*/i, '') ?? '';
    styles.push({ category_name: name, abv_min: abv?.min ?? '', abv_max: abv?.max ?? '', ibu_min: ibu?.min ?? '', ibu_max: ibu?.max ?? '', srm_min: srm?.min ?? '', srm_max: srm?.max ?? '', description: color ? `Color: ${color}` : '' });
  }
  return styles;
}
