import { releaseVersions } from './release-version';
import { environment } from '../../../environments/environment';
describe('Release version labels', () => {
  it('uses the current development release before candidate selection', () => {
    expect(releaseVersions().developmentBranch).toBe(
      environment.version.split('-')[0] + '-dev',
    );
  });
  it('derives examples from the selected release without changing the planned version', () => {
    expect(releaseVersions('3.9.2-rc.12')).toEqual({
      stable: '3.9.2',
      developmentBranch: '3.9.2-dev',
      nextExample: '3.10.0-dev',
    });
  });
});
