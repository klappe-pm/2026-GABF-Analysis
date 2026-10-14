---
domain: beer
category: hops
sub-category: guide
topics:
  - "hop-varieties"
  - "hops"
types:
  - "guide"
date-created: 2026-10-14
date-revised: 2026-10-14
status: DONE
aliases: []
tags:
  - "hops"
farm-count: 113
variety-count: 82
---

# README.MD

The hop section links every hop named in a 2026 medal beer profile to a published variety record: who bred or owns it, when it was released, what it is crossed from, its alpha, beta, cohumulone and oil figures, how its breeder or supplier describes its aroma, and, for the US grown ones, how many acres and pounds the USDA counts by state. 82 records are held: 42 proprietary, 30 public and 10 whose status no source states.

## what-is-here

- [hop-varieties.csv](../../data/reference/hop-varieties.csv) holds one row per variety with every field, a source column per field group and a gap column per field group.
- [hop-acreage.csv](../../data/reference/hop-acreage.csv) holds NASS harvested acres, yield and production by variety, state and crop year.
- [hop-acreage-totals.csv](../../data/reference/hop-acreage-totals.csv) holds the NASS state totals and the experimental and other varieties lines, kept apart so the acreage file lists only varieties.
- [hop-aliases.csv](../../data/reference/hop-aliases.csv) maps every published name, brand name, experimental code and spelling to a canonical variety, and lists the product forms (Cryo, LupuLN2, LUPOMAX, Incognito, Lupocore, HyperBoost, DynaBoost, Spectrum, Hop Kief, T90) that brewers append to a name.
- [hop-unmapped.csv](../../data/reference/hop-unmapped.csv) lists the names that are deliberately not a single variety, each with its reason.
- One page per variety sits in [varieties](varieties).

## looking-up-a-name

`scripts/lib/hop-aliases.mjs` reads the alias and unmapped files. `resolveHop('Citra LupuLN2', loadHopLookup())` returns the canonical variety and the form separately. A name that is neither mapped nor listed as unmapped comes back as unknown, which the test in `tests/hop-varieties.test.mjs` treats as a failure, so a new profile name must be added to the catalogue or to the unmapped file.

## reading-the-data

- Ranges are stored as numeric minimum and maximum columns. A blank minimum with a maximum means the source printed "below" or "up to"; equal minimum and maximum means the source printed one value.
- Alpha, beta and cohumulone are percent (cohumulone as a share of alpha acids). Total oil is ml per 100 g. Myrcene, humulene, caryophyllene and farnesene are percent of total oil.
- Breeder and supplier figures are ranges for typical crops and differ between sources. Where two sources disagree the record keeps the primary source and the notes column names the other.
- Proprietary means the variety carries a trademark or patent or comes from a private company or farm breeding program. Public means a USDA or university release, a public research institute release (Hüll) or a landrace. Not published means no source read states which. Hüll varieties are classed public on the institute alone; their licensing is unverified.
- Alpha class is a bin of the published alpha range (low below 8 percent, medium 8 to 14 percent, high 14 percent and above), not a claim about how the hop is used. Published use is filled only where a breeder or supplier sheet states it.
- A gap is stated plainly with the pages that were checked; nothing is estimated. Values that a source printed implausibly (a shifted decimal) are left out and named in the gap.
- Acreage is the USDA NASS National Hop Report for the 2025 crop, released December 19, 2025, with the four earlier crop years from the 2024 and 2023 reports. A withheld value is blank with a code and the state totals are never summed across a withheld state.
- US acreage applies only to US grown varieties. NASS names a line for a variety only when it is large enough; a US grown variety without a line sits inside the other varieties line.

## rebuilding

```bash
cd /Users/kevinlappe/projects/active/gabf-analysis && node scripts/ingest-nass-hops.mjs --fetch && node scripts/build-hop-data.mjs
```

The catalogue in `scripts/lib/hop-catalogue.mjs` is the hand curated source: each figure there is copied from the page named beside it. `npm run hops:check` validates the files and the 2026 profiles.

## sources

- USDA NASS National Hop Report, [2025](https://esmis.nal.usda.gov/sites/default/release-files/795696/hopsan25.txt), [2024](https://usda.library.cornell.edu/sites/default/release-files/s7526c41m/cj82n3552/3r076q47v/hopsan24.txt), [2023](https://usda.library.cornell.edu/sites/default/release-files/s7526c41m/4b29ct10c/n5840f59r/hopsan23.txt), and the [NASS hops survey guide](https://www.nass.usda.gov/Surveys/Guide_to_NASS_Surveys/Hops/).
- John I. Haas variety sheets at johnihaas.com, Hopsteiner variety data sheets at hopsteiner.us, the Hop Breeding Company site, Hop Products Australia data sheets, Charles Faram hop oracle, and Yakima Valley Hops product pages, each cited on the variety pages that use them.

## varieties

| Variety | Origin | Status | Program |
|---|---|---|---|
| [Adeena](varieties/adeena.md) | United States | not published | not published |
| [Alchemy](varieties/alchemy.md) | United States | not published | not published |
| [Amarillo](varieties/amarillo.md) | United States | proprietary | Virgil Gamache Farms (Washington State) |
| [Anchovy](varieties/anchovy.md) | United States | proprietary | Segal Ranch (Yakima Valley, Washington) |
| [Apollo](varieties/apollo.md) | United States | proprietary | Hopsteiner breeding program |
| [Ariana](varieties/ariana.md) | Germany | not published | Hop Research Center Hüll |
| [Azacca](varieties/azacca.md) | United States | proprietary | Association for the Development of Hop Agronomy (ADHA), Yakima Valley |
| [Barbe Rouge](varieties/barbe-rouge.md) | France | proprietary | Comptoir Agricole breeding program (R&D Alsace) |
| [Bravo](varieties/bravo.md) | United States | proprietary | Hopsteiner breeding program |
| [BRU-1](varieties/bru-1.md) | United States | proprietary | Brulotte Farms (Toppenish, Washington) |
| [Callista](varieties/callista.md) | Germany | public | Hüll Hop Research Center (Germany) |
| [Cascade](varieties/cascade.md) | United States | public | USDA public breeding program at Oregon State University |
| [Cashmere](varieties/cashmere.md) | United States | public | Washington State University and USDA public breeding program |
| [Centennial](varieties/centennial.md) | United States | public | USDA public breeding program at Washington State University |
| [Chinook](varieties/chinook.md) | United States | public | USDA public breeding program in Washington State |
| [Citra](varieties/citra.md) | United States | proprietary | Hop Breeding Company (joint venture of John I. Haas and Yakima Chief Ranches) |
| [Cluster](varieties/cluster.md) | United States | public | Long established U.S. variety; rootstock origin uncertain |
| [Columbus](varieties/columbus.md) | United States | not published | Not stated on the John I. Haas sheet |
| [Columbus/Tomahawk/Zeus](varieties/columbus-tomahawk-zeus.md) | United States | proprietary | Not stated on the John I. Haas sheet |
| [Comet](varieties/comet.md) | United States | public | USDA public breeding program |
| [Crystal](varieties/crystal.md) | United States | public | USDA public breeding program |
| [Dolcita](varieties/dolcita.md) | United States | proprietary | Hop Breeding Company (joint venture of John I. Haas and Yakima Chief Ranches) |
| [East Kent Goldings](varieties/east-kent-goldings.md) | England | public | English landrace grown in East Kent since 1838 |
| [Eclipse](varieties/eclipse.md) | Australia | proprietary | Hop Products Australia (Tasmania and Victoria) |
| [Ekuanot](varieties/ekuanot.md) | United States | proprietary | Hop Breeding Company (joint venture of John I. Haas and Yakima Chief Ranches) |
| [El Dorado](varieties/el-dorado.md) | United States | proprietary | CLS Farms, LLC (Moxee, Washington) |
| [Elani](varieties/elani.md) | United States | proprietary | Yakima Quality Hops |
| [Enigma](varieties/enigma.md) | Australia | proprietary | Hop Products Australia (Tasmania) |
| [Eureka](varieties/eureka.md) | United States | proprietary | Hopsteiner breeding program |
| [Falconer's Flight](varieties/falconers-flight.md) | United States | not published | not published |
| [Fuggle](varieties/fuggle.md) | England | public | English seedling selection |
| [Galaxy](varieties/galaxy.md) | Australia | proprietary | Hop Products Australia (Tasmania and Victoria) |
| [Hallertau Blanc](varieties/hallertau-blanc.md) | Germany | public | Hüll Hop Research Center (Germany) |
| [Hallertauer Magnum](varieties/hallertauer-magnum.md) | Germany | public | Hüll Hop Research Center (Germany) |
| [Hallertauer Mittelfruh](varieties/hallertauer-mittelfruh.md) | Germany | public | German landrace |
| [Hallertauer Tradition](varieties/hallertauer-tradition.md) | Germany | public | Hüll Hop Research Center (Germany) |
| [Helios](varieties/helios.md) | United States | proprietary | Hopsteiner breeding program |
| [Hersbrucker](varieties/hersbrucker.md) | Germany | public | Traditional German variety from the Hersbrucker growing area |
| [Hüll Melon](varieties/hull-melon.md) | Germany | public | Hüll Hop Research Center (Germany) |
| [Idaho 7](varieties/idaho-7.md) | United States | proprietary | Jackson Hop Farm (Wilder, Idaho) |
| [Krush](varieties/krush.md) | United States | proprietary | Hop Breeding Company (joint venture of John I. Haas and Yakima Chief Ranches) |
| [Lemondrop](varieties/lemondrop.md) | United States | proprietary | Hopsteiner breeding program |
| [Liberty](varieties/liberty.md) | United States | public | USDA public breeding program at Oregon State University |
| [Loral](varieties/loral.md) | United States | proprietary | Hop Breeding Company (joint venture of John I. Haas and Yakima Chief Ranches) |
| [Lorien](varieties/lorien.md) | United States | proprietary | Indie Hops (Oregon) |
| [Mandarina Bavaria](varieties/mandarina-bavaria.md) | Germany | public | Hüll Hop Research Center (Germany) |
| [Millennium](varieties/millennium.md) | United States | proprietary | John I. Haas breeding program |
| [Mosaic](varieties/mosaic.md) | United States | proprietary | Hop Breeding Company (joint venture of John I. Haas and Yakima Chief Ranches) |
| [Motueka](varieties/motueka.md) | New Zealand | proprietary | HortResearch (now Plant & Food Research) hop breeding program |
| [Mt. Hood](varieties/mt-hood.md) | United States | public | USDA public breeding program in Oregon |
| [Mt. Rainier](varieties/mt-rainier.md) | United States | public | USDA Agricultural Research Service public breeding program (Corvallis, Oregon) |
| [Nectaron](varieties/nectaron.md) | New Zealand | proprietary | New Zealand Hops Ltd with Plant & Food Research |
| [Nelson Sauvin](varieties/nelson-sauvin.md) | New Zealand | proprietary | HortResearch (now Plant & Food Research) hop breeding program |
| [Northern Brewer](varieties/northern-brewer.md) | England | public | English breeding; grown in the U.S., U.K. and Germany |
| [Nugget](varieties/nugget.md) | United States | public | USDA public breeding program at Oregon State University |
| [Palisade](varieties/palisade.md) | United States | proprietary | Yakima Chief Ranches |
| [Peacharine](varieties/peacharine.md) | New Zealand | not published | not published |
| [Pekko](varieties/pekko.md) | United States | proprietary | Association for the Development of Hop Agronomy (ADHA), Yakima Valley |
| [Perle](varieties/perle.md) | Germany | not published | German breeding program (John I. Haas sheet does not name the institute) |
| [Rakau](varieties/rakau.md) | New Zealand | proprietary | HortResearch (now Plant & Food Research) |
| [Ramosa](varieties/ramosa.md) | United States | proprietary | Segal Ranch (Yakima Valley, Washington) |
| [Riwaka](varieties/riwaka.md) | New Zealand | proprietary | Plant & Food Research hop breeding program (New Zealand) |
| [Saaz](varieties/saaz.md) | Czechia | public | Czech landrace, cultivated into nine clones since 1952 (John I. Haas sheet) |
| [Sabro](varieties/sabro.md) | United States | proprietary | Hop Breeding Company (joint venture of John I. Haas and Yakima Chief Ranches) |
| [Saphir](varieties/saphir.md) | Germany | public | Hüll Hop Research Center (Germany) |
| [Simcoe](varieties/simcoe.md) | United States | proprietary | Yakima Chief Ranches |
| [Spalter Select](varieties/spalter-select.md) | Germany | public | Hüll Hop Research Center breeding stock (Germany) |
| [Sterling](varieties/sterling.md) | United States | not published | Not stated on the John I. Haas sheet |
| [Strata](varieties/strata.md) | United States | proprietary | Indie Hops (Oregon) |
| [Styrian Golding](varieties/styrian-golding.md) | Slovenia | not published | Slovenia (Hopsteiner sheet describes the Celeia line; the institute is not named on the sheet) |
| [Super Galena](varieties/super-galena.md) | United States | proprietary | Hopsteiner breeding program |
| [Superdelic](varieties/superdelic.md) | New Zealand | proprietary | New Zealand Hops Ltd with Plant & Food Research |
| [Tahoma](varieties/tahoma.md) | United States | public | Washington State University and USDA public breeding program |
| [Talus](varieties/talus.md) | United States | proprietary | Hop Breeding Company (joint venture of John I. Haas and Yakima Chief Ranches) |
| [TerraFlux](varieties/terraflux.md) | United States | proprietary | Hop Breeding Company (joint venture of John I. Haas and Yakima Chief Ranches) |
| [Tettnang](varieties/tettnang.md) | Germany | public | Traditional Lake Constance landrace of the Saaz group |
| [US Tettnang](varieties/us-tettnang.md) | Germany | public | Traditional German landrace grown in the U.S. (Yakima Valley Hops) |
| [Vanguard](varieties/vanguard.md) | United States | not published | Hopsteiner marketing; breeding program not stated |
| [Vista](varieties/vista.md) | United States | public | USDA Agricultural Research Service public breeding program (bred by Dr. John Henning) |
| [Waimea](varieties/waimea.md) | New Zealand | proprietary | Plant & Food Research hop breeding program (New Zealand) |
| [Warrior](varieties/warrior.md) | United States | proprietary | Yakima Chief Ranches |
| [Willamette](varieties/willamette.md) | United States | public | USDA public breeding program in Oregon |

## related

- [hop farms index](farms/README.md)
- [breweries index](../breweries/README.md)

### hop-farms

- [16 Quartz Hop Farm](farms/16-quartz-hop-farm.md)
- [3D Farm / BC Hop Farm](farms/3d-farm.md)
- [45th Parallel Hops](farms/45th-parallel-hops.md)
- [4B Farms](farms/4b-farms.md)
- [Alexander Farms](farms/alexander-farms.md)
- [Alway's Shady Lane Farm](farms/always-shady-lane-farm.md)
- [Arnold Hop Farm](farms/arnold-hop-farm.md)
- [B.T. Loftus Ranches](farms/bt-loftus-ranches.md)
- [B&D Farms](farms/bd-farms.md)
- [BC Hop Farms](farms/bc-hop-farms.md)
- [Beach Hill Hops](farms/beach-hill-hops.md)
- [Bell's Brewery Estate Hopyard](farms/bells-brewery-estate-hopyard.md)
- [Billy Goat Hop Farm](farms/billy-goat-hop-farm.md)
- [Black Canyon Hop Co.](farms/black-canyon-hop-co.md)
- [Black Star Ranches](farms/black-star-ranches.md)
- [Blue Lake Hops](farms/blue-lake-hops.md)
- [Brock & Phillip Obendorf Farms LLC](farms/brock-and-phillip-obendorf-farms.md)
- [Brulotte Farms Inc](farms/brulotte-farms.md)
- [C & C Hop Farms](farms/c-and-c-hop-farms.md)
- [Capitol Farms Inc](farms/capitol-farms.md)
- [Carpenter Ranches](farms/carpenter-ranches.md)
- [Cascade Hop Farm](farms/cascade-hop-farm.md)
- [Center Cup Hop Farm](farms/center-cup-hop-farm.md)
- [Central Cove Hop LLC](farms/central-cove-hop.md)
- [Civil Sass Hops](farms/civil-sass-hops.md)
- [CLS Farms](farms/cls-farms.md)
- [Coleman Agriculture](farms/coleman-agriculture.md)
- [Coleman Farms Inc](farms/coleman-farms.md)
- [Coleman Greenleaf](farms/coleman-greenleaf.md)
- [Coleman Ranches](farms/coleman-ranches.md)
- [Colorado Hop Company](farms/colorado-hop-company.md)
- [Come on get Hoppy](farms/come-on-get-hoppy.md)
- [Condzella Hops](farms/condzella-hops.md)
- [Cornerstone Ranches LLC](farms/cornerstone-ranches.md)
- [Crooked Creek Hops](farms/crooked-creek-hops.md)
- [Crosby Hop Farm (Crosby Hops)](farms/crosby-hops.md)
- [CSC Vineyard](farms/csc-vineyard.md)
- [DeRuyter Properties, LP](farms/deruyter-properties-lp.md)
- [Diane Gooding](farms/diane-gooding.md)
- [Dog Star Hops](farms/dog-star-hops.md)
- [Double 'R' Hop Ranches](farms/double-r-hop-ranches.md)
- [E&B Farms Inc](farms/e-and-b-farms-inc.md)
- [Elk Mountain Farms LLC](farms/elk-mountain-farms.md)
- [F & B Farms & Nursery LLC](farms/f-and-b-farms-and-nursery.md)
- [Farm to Pint](farms/farm-to-pint.md)
- [Five Daughter Farms](farms/five-daughter-farms.md)
- [Flatwater Farms](farms/flatwater-farms.md)
- [Fobert Farms](farms/fobert-farms.md)
- [Foothill Hops](farms/foothill-hops.md)
- [Gasseling Ranches](farms/gasseling-ranches.md)
- [Gold Coast](farms/gold-coast-hops.md)
- [Gooding Farms](farms/gooding-farms.md)
- [Goschie Farms](farms/goschie-farms.md)
- [Green Acre Farms](farms/green-acre-farms.md)
- [Grodski Hops](farms/grodski-hops.md)
- [HAAS Yakima Golding Farm](farms/haas-yakima-golding-farm.md)
- [Helderberg Hop Farm](farms/helderberg-hop-farm.md)
- [High Valley Hops](farms/high-valley-hops.md)
- [High Wire Hops](farms/high-wire-hops.md)
- [Hop Head Farms](farms/hop-head-farms.md)
- [HopLand LLC](farms/hopland-llc.md)
- [Hummingbird Hops](farms/hummingbird-hops.md)
- [Jackson Hop LLC](farms/jackson-hop.md)
- [L.I. Hops](farms/li-hops.md)
- [Lakeside Ranches](farms/lakeside-ranches.md)
- [Laurel Creek Nursery](farms/laurel-creek-nursery.md)
- [Lone Oak Hop Farm](farms/lone-oak-hop-farm.md)
- [Loza Farms Inc](farms/loza-farms.md)
- [McKay Agriculture](farms/mckay-agriculture.md)
- [Michigan Hop Alliance (Hop Alliance)](farms/michigan-hop-alliance.md)
- [Misty Mountain Hop Farm](farms/misty-mountain-hop-farm.md)
- [Morrier Ranch Inc](farms/morrier-ranch.md)
- [Mr. Wizard's Hop Farm](farms/mr-wizards-hop-farm.md)
- [Newhouse Farms Inc](farms/newhouse-farms.md)
- [North Fork Hops](farms/north-fork-hops.md)
- [Oasis Farms](farms/oasis-farms.md)
- [Obendorf Hop Inc](farms/obendorf-hop.md)
- [Oskar Blues hop farm](farms/oskar-blues-hop-farm.md)
- [Pearmine Farms Inc](farms/pearmine-farms.md)
- [Perrault Farms](farms/perrault-farms.md)
- [Pine Ridge](farms/pine-ridge-hops.md)
- [Prairie Hop Farms LLC](farms/prairie-hop-farms.md)
- [Prairie Ronde Hops](farms/prairie-ronde-hops.md)
- [Puterbaugh Farms](farms/puterbaugh-farms.md)
- [Roy Farms Inc](farms/roy-farms.md)
- [Sauve and Son Farms](farms/sauve-and-son-farms.md)
- [Scenic Valley Farms LLC](farms/scenic-valley-farms.md)
- [Schroeder Hop LLP](farms/schroeder-hop.md)
- [Segal Ranches](farms/segal-ranches.md)
- [Shinn & Son Inc](farms/shinn-and-son.md)
- [Sodbuster Farms](farms/sodbuster-farms.md)
- [Split Tree Farms](farms/split-tree-farms.md)
- [Strasburg Farms](farms/strasburg-farms.md)
- [Taylor Hops](farms/taylor-hops.md)
- [Top Hops Farm](farms/top-hops-farm.md)
- [Towns](farms/towns-hops.md)
- [Tributary Hop Farms LLC](farms/tributary-hop-farms.md)
- [Triple M Farms LLC](farms/triple-m-farms.md)
- [TV Hops LLC](farms/tv-hops.md)
- [Twisted Bines](farms/twisted-bines.md)
- [Twisted Hops](farms/twisted-hops.md)
- [Two Track Farms](farms/two-track-farms.md)
- [Ubilla Hops](farms/ubilla-hops.md)
- [Van Horn Farms](farms/van-horn-farms.md)
- [Virgil Gamache Farms](farms/virgil-gamache-farms.md)
- [Walla Walla Hops LLC](farms/walla-walla-hops-llc.md)
- [Warrior Ranches LLC](farms/warrior-ranches.md)
- [Weilmunster Farms](farms/weilmunster-farms.md)
- [Wesnofske Farms](farms/wesnofske-farms.md)
- [Westwood Farms](farms/westwood-farms.md)
- [Willamette Valley Hop Farms Inc](farms/willamette-valley-hop-farms-inc.md)
- [Willet Hop & Grain](farms/willet-hop-and-grain.md)
- [Wyckoff Farms Inc](farms/wyckoff-farms.md)
