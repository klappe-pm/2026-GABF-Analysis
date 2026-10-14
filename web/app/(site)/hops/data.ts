// The hops lane's loaders for its pages, over web/lib/models/hops.mjs (read through laneModel, as
// lib/site-data.ts describes). The hop, hop farm, and beer pages all read from here.
import { laneModel } from '@/lib/site-data';

type Model = typeof import('@/lib/models/hops.mjs');
const model = () => laneModel<Model>('hops');

export type { BeerHopProfile, BeerRef, Cell, FarmLink, Hop, HopCard, HopFarm, HopFarmsIndex, HopsIndex, HopWinnerRow, Source, Table } from '@/lib/models/hops.mjs';

export const hopsIndex = async () => (await model()).hopsIndex();
export const hop = async (slug: string) => (await model()).hop(slug);
export const hopFarmsIndex = async () => (await model()).hopFarmsIndex();
export const hopFarm = async (slug: string) => (await model()).hopFarm(slug);
export const beerHopProfile = async (stem: string) => (await model()).beerHopProfile(stem);
export const winnerRows = async (year?: number) => (await model()).winnerRows(year);
