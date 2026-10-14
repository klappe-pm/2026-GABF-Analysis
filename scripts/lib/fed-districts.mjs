// Federal Reserve district definitions. Every list here is transcribed from a primary source
// named beside it (the Board of Governors or a Reserve Bank); nothing is drawn from memory.
// A split state divides between exactly two districts, so one complete named list plus the
// Census county list gives the other side as the complement, and the expected counts published
// by the Reserve Banks accept or reject the result.

export const DISTRICTS = [
  { number: 1, name: 'Boston' },
  { number: 2, name: 'New York' },
  { number: 3, name: 'Philadelphia' },
  { number: 4, name: 'Cleveland' },
  { number: 5, name: 'Richmond' },
  { number: 6, name: 'Atlanta' },
  { number: 7, name: 'Chicago' },
  { number: 8, name: 'St. Louis' },
  { number: 9, name: 'Minneapolis' },
  { number: 10, name: 'Kansas City' },
  { number: 11, name: 'Dallas' },
  { number: 12, name: 'San Francisco' },
];
export const DISTRICT_NAME = Object.fromEntries(DISTRICTS.map((d) => [d.number, d.name]));

export const SOURCES = {
  board: { label: 'Federal Reserve Board, Maps of the Federal Reserve System (Budget Review 2010)', url: 'https://www.federalreserve.gov/boarddocs/rptcongress/budgetrev10/maps/districts.htm' },
  richmond: { label: 'Federal Reserve Bank of Richmond, About Us (Fifth District: Washington D.C., Maryland, North Carolina, South Carolina, Virginia, most of West Virginia)', url: 'https://www.richmondfed.org/about_us' },
  stlouis: { label: 'Federal Reserve Bank of St. Louis, Eighth Federal Reserve District county map (8Dmap.pdf)', url: 'https://www.stlouisfed.org/~/media/Files/PDFs/About-Us/8Dmap.pdf' },
  stlouisCounts: { label: 'FRASER, Federal Reserve District 8th (county counts per state)', url: 'https://fraser.stlouisfed.org/subject/federal-reserve-district-8th' },
  minneapolis: { label: 'Federal Reserve Bank of Minneapolis, The Ninth District', url: 'https://www.minneapolisfed.org/about-us/the-ninth-district' },
  dallas: { label: 'Federal Reserve Bank of Dallas, Counties in the Eleventh District', url: 'https://www.dallasfed.org/fed/counties' },
  philadelphia: { label: 'Federal Reserve Bank of Philadelphia, Map of the Third Federal Reserve District (Cascade Focus, December 2012, via FRASER)', url: 'https://fraser.stlouisfed.org/title/cascade-focus-federal-reserve-bank-philadelphia-6890/affordability-availability-rental-housing-third-federal-reserve-district-628546/content/fulltext/frbphil_cascadeFocus_201212_map' },
  cleveland: { label: 'Federal Reserve Bank of Cleveland, Regional Analysis (56 counties in eastern Kentucky, 19 in western Pennsylvania, 6 in the northern panhandle of West Virginia)', url: 'https://www.clevelandfed.org/en/region/regional-analysis' },
};

// Whole states and territories by district, from the Board's district descriptions; DC from the
// Richmond Fed. Split states carry both districts; the first listed is the one holding most of
// the state's population (checked by the builder against Census 2020 county counts).
export const STATE_DISTRICTS = {
  ME: [1], NH: [1], VT: [1], MA: [1], RI: [1], CT: [1, 2],
  NY: [2], NJ: [2, 3], PR: [2], VI: [2],
  DE: [3], PA: [3, 4],
  OH: [4], KY: [4, 8], WV: [5, 4],
  MD: [5], VA: [5], NC: [5], SC: [5], DC: [5],
  AL: [6], FL: [6], GA: [6], LA: [6, 11], MS: [6, 8], TN: [6, 8],
  IA: [7], IL: [7, 8], IN: [7, 8], MI: [7, 9], WI: [7, 9],
  AR: [8], MO: [8, 10],
  MN: [9], MT: [9], ND: [9], SD: [9],
  CO: [10], KS: [10], NE: [10], OK: [10], WY: [10], NM: [11, 10],
  TX: [11],
  AK: [12], AZ: [12], CA: [12], HI: [12], ID: [12], NV: [12], OR: [12], UT: [12], WA: [12], AS: [12], GU: [12], MP: [12],
};

// One named list per split state. `district` is the district the named counties belong to,
// `other` the district that receives the complement; the counts are the ones the Reserve Banks
// publish, so a transcription slip fails the build instead of shipping.
export const SPLIT_LISTS = {
  CT: { district: 2, other: 1, source: 'board', countSource: 'board', expected: 1, complement: 7, counties: ['Fairfield'] },
  NJ: { district: 3, other: 2, source: 'philadelphia', countSource: 'board', expected: 9, complement: 12, counties: ['Atlantic', 'Burlington', 'Camden', 'Cape May', 'Cumberland', 'Gloucester', 'Mercer', 'Ocean', 'Salem'] },
  PA: { district: 3, other: 4, source: 'philadelphia', countSource: 'cleveland', expected: 48, complement: 19, counties: ['Adams', 'Bedford', 'Berks', 'Blair', 'Bradford', 'Bucks', 'Cambria', 'Cameron', 'Carbon', 'Centre', 'Chester', 'Clearfield', 'Clinton', 'Columbia', 'Cumberland', 'Dauphin', 'Delaware', 'Elk', 'Franklin', 'Fulton', 'Huntingdon', 'Juniata', 'Lackawanna', 'Lancaster', 'Lebanon', 'Lehigh', 'Luzerne', 'Lycoming', 'McKean', 'Mifflin', 'Monroe', 'Montgomery', 'Montour', 'Northampton', 'Northumberland', 'Perry', 'Philadelphia', 'Pike', 'Potter', 'Schuylkill', 'Snyder', 'Sullivan', 'Susquehanna', 'Tioga', 'Union', 'Wayne', 'Wyoming', 'York'] },
  KY: { district: 8, other: 4, source: 'stlouis', countSource: 'cleveland', expected: 64, complement: 56, counties: ['Adair', 'Allen', 'Anderson', 'Ballard', 'Barren', 'Boyle', 'Breckinridge', 'Bullitt', 'Butler', 'Caldwell', 'Calloway', 'Carlisle', 'Carroll', 'Casey', 'Christian', 'Clinton', 'Crittenden', 'Cumberland', 'Daviess', 'Edmonson', 'Franklin', 'Fulton', 'Gallatin', 'Graves', 'Grayson', 'Green', 'Hancock', 'Hardin', 'Hart', 'Henderson', 'Henry', 'Hickman', 'Hopkins', 'Jefferson', 'Larue', 'Livingston', 'Logan', 'Lyon', 'McCracken', 'McLean', 'Marion', 'Marshall', 'Meade', 'Mercer', 'Metcalfe', 'Monroe', 'Muhlenberg', 'Nelson', 'Ohio', 'Oldham', 'Owen', 'Russell', 'Shelby', 'Simpson', 'Spencer', 'Taylor', 'Todd', 'Trigg', 'Trimble', 'Union', 'Warren', 'Washington', 'Wayne', 'Webster'] },
  // The map prints the Illinois label "Wayne" out of reading order; its position (between Clay,
  // Richland, Edwards, Hamilton, and Jefferson) places it in Illinois, and the FRASER count of 44
  // holds only with it.
  IL: { district: 8, other: 7, source: 'stlouis', countSource: 'stlouisCounts', expected: 44, counties: ['Adams', 'Alexander', 'Bond', 'Brown', 'Calhoun', 'Clay', 'Clinton', 'Crawford', 'Edwards', 'Effingham', 'Fayette', 'Franklin', 'Gallatin', 'Greene', 'Hamilton', 'Hardin', 'Jackson', 'Jasper', 'Jefferson', 'Jersey', 'Johnson', 'Lawrence', 'Macoupin', 'Madison', 'Marion', 'Massac', 'Monroe', 'Montgomery', 'Morgan', 'Perry', 'Pike', 'Pope', 'Pulaski', 'Randolph', 'Richland', 'St. Clair', 'Saline', 'Scott', 'Union', 'Wabash', 'Washington', 'Wayne', 'White', 'Williamson'] },
  IN: { district: 8, other: 7, source: 'stlouis', countSource: 'stlouisCounts', expected: 24, counties: ['Clark', 'Crawford', 'Daviess', 'Dubois', 'Floyd', 'Gibson', 'Greene', 'Harrison', 'Jackson', 'Jefferson', 'Knox', 'Lawrence', 'Martin', 'Orange', 'Perry', 'Pike', 'Posey', 'Scott', 'Spencer', 'Sullivan', 'Switzerland', 'Vanderburgh', 'Warrick', 'Washington'] },
  MS: { district: 8, other: 6, source: 'stlouis', countSource: 'stlouisCounts', expected: 39, counties: ['Alcorn', 'Attala', 'Benton', 'Bolivar', 'Calhoun', 'Carroll', 'Chickasaw', 'Choctaw', 'Clay', 'Coahoma', 'De Soto', 'Grenada', 'Holmes', 'Humphreys', 'Itawamba', 'Lafayette', 'Lee', 'Leflore', 'Lowndes', 'Marshall', 'Monroe', 'Montgomery', 'Noxubee', 'Oktibbeha', 'Panola', 'Pontotoc', 'Prentiss', 'Quitman', 'Sunflower', 'Tallahatchie', 'Tate', 'Tippah', 'Tishomingo', 'Tunica', 'Union', 'Washington', 'Webster', 'Winston', 'Yalobusha'] },
  MO: { district: 8, other: 10, source: 'stlouis', countSource: 'stlouisCounts', expected: 72, counties: ['Adair', 'Audrain', 'Barry', 'Bollinger', 'Boone', 'Butler', 'Callaway', 'Camden', 'Cape Girardeau', 'Carter', 'Christian', 'Clark', 'Cole', 'Crawford', 'Dade', 'Dallas', 'Dent', 'Douglas', 'Dunklin', 'Franklin', 'Gasconade', 'Greene', 'Howell', 'Iron', 'Jefferson', 'Knox', 'Laclede', 'Lawrence', 'Lewis', 'Lincoln', 'Macon', 'Madison', 'Maries', 'Marion', 'Miller', 'Mississippi', 'Moniteau', 'Monroe', 'Montgomery', 'New Madrid', 'Oregon', 'Osage', 'Ozark', 'Pemiscot', 'Perry', 'Phelps', 'Pike', 'Polk', 'Pulaski', 'Ralls', 'Randolph', 'Reynolds', 'Ripley', 'St. Charles', 'Ste. Genevieve', 'St. Francois', 'St. Louis', 'St. Louis city', 'Schuyler', 'Scotland', 'Scott', 'Shannon', 'Shelby', 'Stoddard', 'Stone', 'Taney', 'Texas', 'Warren', 'Washington', 'Wayne', 'Webster', 'Wright'] },
  TN: { district: 8, other: 6, source: 'stlouis', countSource: 'stlouisCounts', expected: 21, counties: ['Benton', 'Carroll', 'Chester', 'Crockett', 'Decatur', 'Dyer', 'Fayette', 'Gibson', 'Hardeman', 'Hardin', 'Haywood', 'Henderson', 'Henry', 'Lake', 'Lauderdale', 'McNairy', 'Madison', 'Obion', 'Shelby', 'Tipton', 'Weakley'] },
  WI: { district: 9, other: 7, source: 'minneapolis', countSource: 'board', expected: 26, counties: ['Ashland', 'Barron', 'Bayfield', 'Buffalo', 'Burnett', 'Chippewa', 'Douglas', 'Dunn', 'Eau Claire', 'Florence', 'Forest', 'Iron', 'La Crosse', 'Lincoln', 'Oneida', 'Pepin', 'Pierce', 'Polk', 'Price', 'Rusk', 'Sawyer', 'St. Croix', 'Taylor', 'Trempealeau', 'Vilas', 'Washburn'] },
  MI: { district: 9, other: 7, source: 'minneapolis', countSource: 'minneapolis', expected: 15, counties: ['Alger', 'Baraga', 'Chippewa', 'Delta', 'Dickinson', 'Gogebic', 'Houghton', 'Iron', 'Keweenaw', 'Luce', 'Mackinac', 'Marquette', 'Menominee', 'Ontonagon', 'Schoolcraft'] },
  LA: { district: 11, other: 6, source: 'dallas', countSource: 'dallas', expected: 26, counties: ['Bienville', 'Bossier', 'Caddo', 'Caldwell', 'Catahoula', 'Claiborne', 'Concordia', 'De Soto', 'E. Carroll', 'Franklin', 'Grant', 'Jackson', 'La Salle', 'Lincoln', 'Madison', 'Morehouse', 'Natchitoches', 'Ouachita', 'Red River', 'Richland', 'Sabine', 'Tensas', 'Union', 'Webster', 'W. Carroll', 'Winn'] },
  NM: { district: 11, other: 10, source: 'dallas', countSource: 'dallas', expected: 18, counties: ['Catron', 'Chaves', 'Curry', 'De Baca', 'Dona Ana', 'Eddy', 'Grant', 'Guadalupe', 'Hidalgo', 'Lea', 'Lincoln', 'Luna', 'Otero', 'Quay', 'Roosevelt', 'Sierra', 'Socorro', 'Torrance'] },
};

// West Virginia: the Cleveland Fed publishes only the count (six northern panhandle counties),
// and no primary source found names them, so West Virginia is assigned whole to the district
// holding most of its population and labeled an approximation everywhere it shows.
export const APPROXIMATED_STATES = { WV: { district: 5, other: 4, reason: 'county list not published by a primary source found; the Cleveland Fed gives only a count of six northern panhandle counties' } };

// Fold a county name to a comparison key: drop the type word, diacritics, punctuation, spaces,
// and expand the Dallas Fed's E. and W. abbreviations.
export function countyKey(name) {
  return String(name)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/^E\.\s*/i, 'East ').replace(/^W\.\s*/i, 'West ')
    .replace(/\s+(County|Parish|Borough|Census Area|Municipality|city and borough)$/i, '')
    .replace(/\bcity$/i, ' city')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
}

// Assign every county of every split state to a district.
// censusCounties: [{ state, county_fips, county_name }] from the Census national county file.
// Returns { rows, errors } where rows are { state, county_fips, county_name, district_number, basis, source }.
export function assignSplitCounties(censusCounties) {
  const rows = [];
  const errors = [];
  for (const [state, spec] of Object.entries(SPLIT_LISTS)) {
    const pool = censusCounties.filter((c) => c.state === state);
    const byKey = new Map();
    for (const c of pool) {
      const k = countyKey(c.county_name);
      if (byKey.has(k)) errors.push(`${state}: two Census counties fold to "${k}"`);
      byKey.set(k, c);
    }
    const named = new Set();
    for (const name of spec.counties) {
      const hit = byKey.get(countyKey(name));
      if (!hit) { errors.push(`${state}: "${name}" matches no Census county`); continue; }
      if (named.has(hit.county_fips)) errors.push(`${state}: "${name}" listed twice`);
      named.add(hit.county_fips);
    }
    if (named.size !== spec.expected) errors.push(`${state}: ${named.size} named counties, source count is ${spec.expected}`);
    const complement = pool.filter((c) => !named.has(c.county_fips));
    if (spec.complement !== undefined && complement.length !== spec.complement) errors.push(`${state}: complement has ${complement.length} counties, source count is ${spec.complement}`);
    const src = SOURCES[spec.source];
    const cnt = SOURCES[spec.countSource];
    for (const c of pool) {
      const inList = named.has(c.county_fips);
      rows.push({
        state,
        county_fips: c.county_fips,
        county_name: c.county_name,
        district_number: inList ? spec.district : spec.other,
        basis: inList ? 'named' : 'complement',
        source: inList
          ? `${src.label} ${src.url}`
          : `Complement of the ${src.label} list within ${state} (Census 2020 county list); count checked against ${cnt.label} ${cnt.url}`,
      });
    }
  }
  rows.sort((a, b) => a.county_fips.localeCompare(b.county_fips));
  return { rows, errors };
}

// District for a state code alone (no county known). Split states fall back to the majority
// district and say so; unknown codes (World Beer Cup countries) get nothing.
export function stateDistrict(state) {
  const d = STATE_DISTRICTS[state];
  if (!d) return null;
  return { district: d[0], split: d.length > 1 };
}
