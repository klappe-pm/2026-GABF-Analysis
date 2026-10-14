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
---

# README.MD

The hop section links every hop named in a 2026 medal beer profile to a published variety record: who bred or owns it, when it was released, what it is crossed from, its alpha, beta, cohumulone and oil figures, how its breeder or supplier describes its aroma, and, for the US grown ones, how many acres and pounds the USDA counts by state. 81 records are held: 42 proprietary, 30 public and 9 whose status no source states.

## what-is-here

- [hop-varieties.csv](../../data/reference/hop-varieties.csv) holds one row per variety with every field, a source column per field group and a gap column per field group.
- [hop-acreage.csv](../../data/reference/hop-acreage.csv) holds NASS harvested acres, yield and production by variety, state and crop year.
- [hop-aliases.csv](../../data/reference/hop-aliases.csv) maps every published name, brand name, experimental code and spelling to a canonical variety, and lists the product forms (Cryo, LupuLN2, LUPOMAX, Incognito, HyperBoost, DynaBoost, Spectrum, T90) that brewers append to a name.
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
