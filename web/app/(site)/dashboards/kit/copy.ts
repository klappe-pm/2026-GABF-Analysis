// The copy a dashboard draws, as a plain tree the server hands to the client view. Every visible word is
// in the copy documents; this only walks the tree and fills {{tokens}}.
export type CopyNode = string | string[] | { [key: string]: CopyNode };
export type CopyTree = { page: CopyNode; charts: CopyNode; states: CopyNode; labels: CopyNode; tables: CopyNode };

export type Copy = {
  /** The text at a path such as "page.panels.map.title", with {{tokens}} filled. A missing key throws. */
  t: (path: string, values?: Record<string, string | number>) => string;
  /** True when a path holds text. */
  has: (path: string) => boolean;
  /** The labels of a group, such as "labels.ownership_type", by raw value. */
  group: (path: string) => Record<string, string>;
};

const fillText = (text: string, values: Record<string, string | number>) =>
  text.replace(/\{\{(\w+)\}\}/g, (m, name) => {
    if (!Object.hasOwn(values, name)) throw new Error(`no value for {{${name}}} in "${text}"`);
    return String(values[name]);
  });

export function makeCopy(tree: CopyTree): Copy {
  const walk = (path: string): CopyNode | undefined => {
    let node: CopyNode | undefined = tree as unknown as CopyNode;
    for (const part of path.split('.')) {
      if (!node || typeof node !== 'object' || Array.isArray(node)) return undefined;
      node = node[part];
    }
    return node;
  };
  return {
    t: (path, values = {}) => {
      const v = walk(path);
      if (typeof v !== 'string') throw new Error(`dashboard copy ${path} is missing`);
      return fillText(v, values);
    },
    has: (path) => typeof walk(path) === 'string',
    group: (path) => {
      const v = walk(path);
      if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error(`dashboard copy group ${path} is missing`);
      return Object.fromEntries(Object.entries(v).filter(([, x]) => typeof x === 'string')) as Record<string, string>;
    },
  };
}
