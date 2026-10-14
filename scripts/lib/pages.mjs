// GitHub Pages facts shared by the deploy assembly, the DNS check, and the custom domain switch.
// The GitHub Pages addresses come from GitHub's documentation, "Managing a custom domain for your
// GitHub Pages site" (apex A and AAAA records, and a www CNAME to the account's github.io host).

export const REPO = 'klappe-pm/GABF-Analysis';
export const PAGES_DOMAIN = 'gabf.beer';
export const PAGES_HOST = 'klappe-pm.github.io';
export const PAGES_A = ['185.199.108.153', '185.199.109.153', '185.199.110.153', '185.199.111.153'];
export const PAGES_AAAA = ['2606:50c0:8000::153', '2606:50c0:8001::153', '2606:50c0:8002::153', '2606:50c0:8003::153'];
