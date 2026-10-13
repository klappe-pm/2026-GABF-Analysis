import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseWinnersText, splitMedalLine } from '../scripts/lib/parse-winners-lib.mjs';

const fixture = readFileSync(new URL('./fixtures/winners-sample.txt', import.meta.url), 'utf8');

test('splitMedalLine handles plain, suffixed, and parenthetical brewery names', () => {
  assert.deepEqual(splitMedalLine('Wheat Thing, Example Brewing Co., Denver, CO'), {
    beer_name: 'Wheat Thing', brewery_printed: 'Example Brewing Co.', brewery_name: 'Example Brewing Co.', brewery_location: '', city: 'Denver', state: 'CO',
  });
  const suffixed = splitMedalLine("Josh's New Tiny Shoes, Green Cheek Beer Co. - Orange, Orange, CA");
  assert.equal(suffixed.brewery_name, 'Green Cheek Beer Co.');
  assert.equal(suffixed.brewery_location, 'Orange');
  const paren = splitMedalLine('DDH the Other Brian, Green Cheek Beer Co. (Costa Mesa), Costa Mesa, CA');
  assert.equal(paren.brewery_name, 'Green Cheek Beer Co.');
  assert.equal(paren.brewery_location, 'Costa Mesa');
  assert.equal(paren.city, 'Costa Mesa');
});

test('splitMedalLine keeps commas inside beer names and brewery names', () => {
  const beerComma = splitMedalLine('Peach, Please, Fruit Forward Brewing, Austin, TX');
  assert.equal(beerComma.beer_name, 'Peach, Please');
  assert.equal(beerComma.brewery_name, 'Fruit Forward Brewing');
  const breweryComma = splitMedalLine('Summer Berry Wheat, Berry Barley Brewery, Inc., Grand Rapids, MI');
  assert.equal(breweryComma.beer_name, 'Summer Berry Wheat');
  assert.equal(breweryComma.brewery_name, 'Berry Barley Brewery, Inc.');
});

test('splitMedalLine rejects lines without a US state', () => {
  assert.equal(splitMedalLine('Nothing useful here'), null);
  assert.equal(splitMedalLine('Beer, Brewery, City, Nowhere'), null);
});

test('parseWinnersText extracts categories, medals, sections, and awards from line-structured text', () => {
  const { rows, categories, awards, problems } = parseWinnersText(fixture, { year: 2025, source: 'fixture' });
  assert.equal(problems.length, 0, JSON.stringify(problems));
  assert.equal(categories.length, 4);
  assert.equal(rows.length, 10);
  const first = rows[0];
  assert.equal(first.category_number, '1');
  assert.equal(first.category_name, 'American Wheat Beer');
  assert.equal(first.entries, '50');
  assert.equal(first.medal, 'Gold');
  assert.equal(first.section, 'main');
  const proAm = rows.find((r) => r.brewery_location === 'Pro-Am');
  assert.equal(proAm.section, 'pro-am');
  assert.equal(awards.length, 2);
  assert.equal(awards[1].brewery_name, 'Westbound & Down Brewing Co.');
  assert.equal(awards[1].brewery_location, 'Westbound Mill');
  assert.equal(awards[1].bracket, '5,001 - 15,000 Barrels');
});

test('parseWinnersText survives the loss of line breaks that PDF extraction causes', () => {
  const flattened = fixture.replace(/\s*\n\s*/g, ' ');
  const { rows, problems } = parseWinnersText(flattened, { year: 2025 });
  assert.equal(problems.length, 0, JSON.stringify(problems));
  assert.equal(rows.length, 10);
  const greenCheek = rows.filter((r) => r.brewery_name === 'Green Cheek Beer Co.');
  assert.equal(greenCheek.length, 2);
});

test('parseWinnersText reads the 2026 layout: colon after Category, page footers, pipe awards', () => {
  const text = [
    'Category: 1: American Wheat Beer - 35 Entries Gold: Summer Ale, Wormtown Brewery, Worcester, MA',
    'Silver: Fuzztail, Sunriver Brewing Co., Sunriver, OR Bronze: Jack Whacker, Tommyknocker Brewery & Pub, Idaho Springs, CO 0 02\u0000TELL6NR\u0000IERS 2 GreatAmericanBeerFestival.com',
    'Category: 500: Pro-Am Comp - 30 Entries Gold: Burden, Wild Blue Yonder Brewing Co. / Geoff Humphrey, Castle Rock, CO 0-250 Barrels Brewery and Brewer of the Year Mieza Blendery | Alexandria, VA Alex Lynch',
    '>250–500 Barrels Brewery and Brewer of the Year UPP Liquids | Bend, OR Cidermaker of the Year Snow Capped Cider | Austin, CO Kari Williams',
  ].join(' ');
  const { rows, awards, problems } = parseWinnersText(text, { year: 2026 });
  assert.equal(problems.length, 0, JSON.stringify(problems));
  assert.equal(rows.length, 4);
  assert.equal(rows[2].brewery_name, 'Tommyknocker Brewery & Pub');
  assert.equal(rows[3].section, 'pro-am');
  assert.deepEqual(awards.map((a) => a.brewery_name), ['Mieza Blendery', 'UPP Liquids', 'Snow Capped Cider']);
  assert.equal(awards[0].bracket, '0-250');
});
