// Where the site is hosted (docs/deployment.md): an S3 bucket behind a CloudFront distribution, with DNS
// in Route 53. Shared by buildspec.yml's documentation, the DNS check, and the docs. The AWS resources
// are owned and changed outside this repository; these are their names, not credentials.

export const SITE_DOMAIN = 'gabf.beer';
export const SITE_HOSTS = ['gabf.beer', 'www.gabf.beer'];
export const SITE_BUCKET = 'gabf-beer-site-768801480220';
export const SITE_REGION = 'us-east-2';
export const DISTRIBUTION_ID = 'E1T56UM0ZOIMXQ';
export const DISTRIBUTION_HOST = 'd18mow5csnyul.cloudfront.net';
export const HOSTED_ZONE_ID = 'Z08677032YJWSE1XU5DWE';
export const CODEBUILD_ROLE = 'gabf-site-deploy-codebuild';
