// The design settings as they stand when the site is built: the baked fallback every page starts from.
import { COMPONENTS } from '@/design/schema';
import { type DesignState, readState } from '@/design/state';
import { existsInRepo, readRepo } from './repo';

const DS = '.design/design-system';
const read = (path: string) => (existsInRepo(path) ? readRepo(path) : null);

let state: DesignState | null = null;
export function bakedState(): DesignState {
  state ??= readState({
    settings: read(`${DS}/settings.md`),
    layout: read(`${DS}/layout.md`),
    specs: Object.fromEntries(Object.keys(COMPONENTS).map((name) => [name, read(`${DS}/components/${name}/spec.md`)])),
  });
  return state;
}

export const specRepoPath = (name: string) => `${DS}/components/${name}/spec.md`;
