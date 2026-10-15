// Build time feature flags, readable from server and client modules alike.

// The investor filter is built but hidden until the owner sets NEXT_PUBLIC_FILTER_INVESTOR=on (decision on issue #89).
export const INVESTOR_ON = process.env.NEXT_PUBLIC_FILTER_INVESTOR === 'on';
