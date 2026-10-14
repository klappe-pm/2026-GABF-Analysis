import type { IconName } from '@/components/Icon';

export type Destination = { id: string; copy: string; icon: IconName; path: string; match: string[] };

type Paths = {
  home: string;
  overview: string;
  dashboards: string;
  categories: string;
  breweries: string;
  winners: (year: number | string) => string;
  hops: string;
  hopFarms: string;
  analysis: string;
  saved: string;
};

export function primaryDestinations(paths: Paths, winnerYear: number | string): Destination[];
export function moreDestinations(paths: Paths): Destination[];
export function activeItem(items: { id: string; match: string[] }[], pathname: string): string | undefined;
