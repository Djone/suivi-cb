import { environment } from '../../../environments/environment';

export function releaseVersions(candidate?: string | null) {
  const stable = (candidate || environment.version).split('-')[0];
  const [major, minor] = stable.split('.').map(Number);
  return {
    stable,
    developmentBranch: stable + '-dev',
    nextExample: major + '.' + (minor + 1) + '.0-dev',
  };
}
