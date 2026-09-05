import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { disabled, environment, packageManager } = require('./policy.cjs');
const {
  parseConfig,
  repositoryHint,
  discoverGit,
} = require('./git-context.cjs');

describe('install discovery policy', () => {
  it('keeps remote subsection case-sensitive and omits conflicting origin URLs', () => {
    expect(
      parseConfig(
        '[remote "origin"]\nurl=https://github.com/actual/repo.git\n[remote "Origin"]\nurl=https://github.com/unrelated/repo.git'
      ).remote
    ).toBe('https://github.com/actual/repo.git');
    expect(
      repositoryHint(
        parseConfig(
          '[remote "origin"]\nurl=https://github.com/actual/repo.git\nurl=https://github.com/mirror/repo.git'
        ).remote
      )
    ).toEqual({});
  });
  it.each([
    'DO_NOT_TRACK',
    'npm_config_do_not_track',
    'NPM_CONFIG_DO_NOT_TRACK',
    'TPLANE_TELEMETRY_DISABLED',
  ])('disables before collection through %s', (key) => {
    for (const value of ['1', 'true', 'TRUE', 'yes'])
      expect(disabled({ [key]: value })).toBe(true);
    expect(disabled({ [key]: '0' })).toBe(false);
  });
  it('records CI independently of opt-out and never infers a human from missing CI flags', () => {
    expect(disabled({ CI: 'true' })).toBe(false);
    expect(
      environment({ CI: 'true', GITHUB_ACTIONS: 'true' }, true, 'npm')
    ).toEqual({
      environment: 'ci',
      environmentEvidence: 'github_actions',
      ciProvider: 'github_actions',
    });
    expect(environment({ CI: '1' }, false, 'npm').ciProvider).toBe(
      'generic_ci'
    );
    expect(environment({}, false, 'npm').environment).toBe('unknown');
    expect(environment({}, true, 'unknown').environment).toBe('unknown');
    expect(environment({}, true, 'pnpm')).toEqual({
      environment: 'local',
      environmentEvidence: 'interactive_package_manager',
    });
  });
  it.each([
    ['GITLAB_CI', '1', 'gitlab_ci'],
    ['JENKINS_URL', 'https://private.invalid', 'jenkins'],
    ['TRAVIS', 'true', 'travis'],
    ['CIRCLECI', 'true', 'circleci'],
    ['BITBUCKET_BUILD_NUMBER', '42', 'bitbucket'],
    ['BUILDKITE', '1', 'buildkite'],
    ['VERCEL', '1', 'generic_ci'],
  ])(
    'recognizes %s without returning its raw value',
    (key, value, provider) => {
      expect(environment({ [key]: value }, false, 'npm').ciProvider).toBe(
        provider
      );
    }
  );
  it('bounds package-manager metadata', () => {
    expect(packageManager('pnpm/10.0.0 npm/? node/v22')).toEqual({
      packageManager: 'pnpm',
      packageManagerVersion: '10.0.0',
    });
    expect(packageManager('custom/private@example.invalid')).toEqual({
      packageManager: 'unknown',
    });
  });
  it('parses only selected Git fields without following includes or executing syntax', () => {
    expect(
      parseConfig(
        '[user]\n name = "A \\"Quoted\\" Person" # comment\n email = A@EXAMPLE.INVALID\n[include]\n path = /secret\n[remote "origin"]\n url = git@github.com:owner/repo.git\n[credential]\n helper = !steal'
      )
    ).toEqual({
      name: 'A "Quoted" Person',
      email: 'A@EXAMPLE.INVALID',
      remote: 'git@github.com:owner/repo.git',
    });
  });
  it.each([
    'git@github.com:owner/private.git',
    'ssh://git@github.com/owner/private.git',
    'https://token:secret@github.com/owner/private.git?secret=x#private',
  ])('reduces a recognized remote to only provider/owner: %s', (remote) => {
    expect(repositoryHint(remote)).toEqual({
      repositoryProvider: 'github',
      repositoryOwner: 'owner',
    });
  });
  it.each([
    'https://github.com.evil.invalid/org/repo',
    'https://gitlab.com/group/subgroup/repo',
    'file:///private/config',
    'https://github.com/owner%40email/repo',
    '!command',
    'https://github.com/org/repo/extra',
  ])('omits ambiguous or unsupported remote %s', (remote) =>
    expect(repositoryHint(remote)).toEqual({})
  );
});

describe('bounded consumer configuration', () => {
  let root, home, consumer, packageRoot;
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'install-discovery-'));
    home = join(root, 'home');
    consumer = join(root, 'app');
    packageRoot = join(consumer, 'node_modules/@threadplane/chat');
    await mkdir(home, { recursive: true });
    await mkdir(packageRoot, { recursive: true });
    await mkdir(join(consumer, '.git'));
    await writeFile(
      join(home, '.gitconfig'),
      '[user]\nname=Global Person\nemail=global@example.invalid'
    );
    await writeFile(
      join(consumer, '.git/config'),
      '[user]\nname=Local Person\nemail=local@example.invalid\n[remote "origin"]\nurl=https://secret@github.com/team/private.git'
    );
  });
  afterEach(async () => rm(root, { recursive: true, force: true }));
  const env = (consumer) => ({
    INIT_CWD: consumer,
    npm_config_user_agent: 'npm/11.0.0',
  });
  it('uses the consuming checkout with local precedence and no repository path leakage', async () => {
    const result = await discoverGit({ home, packageRoot, env: env(consumer) });
    expect(result).toEqual({
      consumerContext: 'checkout',
      identity: {
        gitDisplayName: 'Local Person',
        gitEmail: 'local@example.invalid',
        gitConfigOrigin: 'local',
        repositoryProvider: 'github',
        repositoryOwner: 'team',
      },
    });
    expect(JSON.stringify(result)).not.toMatch(/secret|private|node_modules/);
  });
  it('uses global hints with explicit missing context for dependency/global/invalid invocations', async () => {
    for (const context of [
      env(packageRoot),
      { ...env(consumer), npm_config_global: 'true' },
      { INIT_CWD: consumer },
      env('relative'),
    ]) {
      expect(await discoverGit({ home, packageRoot, env: context })).toEqual({
        consumerContext: 'unavailable',
        identity: {
          gitDisplayName: 'Global Person',
          gitEmail: 'global@example.invalid',
          gitConfigOrigin: 'global',
        },
      });
    }
  });
  it('does not mistake a publisher source checkout for the consumer', async () => {
    const source = join(consumer, 'libs/chat');
    await mkdir(source, { recursive: true });
    expect(
      (await discoverGit({ home, packageRoot: source, env: env(consumer) }))
        .consumerContext
    ).toBe('unavailable');
  });
  it('supports worktree common config and ignores worktree command overrides', async () => {
    await rm(join(consumer, '.git'), { recursive: true });
    const common = join(root, 'original/.git'),
      worktree = join(common, 'worktrees/app');
    await mkdir(worktree, { recursive: true });
    await writeFile(join(worktree, 'commondir'), '../..');
    await writeFile(
      join(common, 'config'),
      '[user]\nemail=worktree@example.invalid\nname=Worktree Person'
    );
    await writeFile(join(consumer, '.git'), `gitdir: ${worktree}\n`);
    expect(
      (await discoverGit({ home, packageRoot, env: env(consumer) })).identity
        .gitEmail
    ).toBe('worktree@example.invalid');
  });
  it('honors per-worktree identity only when Git enables worktreeConfig', async () => {
    await writeFile(
      join(consumer, '.git/config.worktree'),
      '[user]\nname=Worktree Person\nemail=worktree@example.invalid'
    );
    expect(
      (await discoverGit({ home, packageRoot, env: env(consumer) })).identity
        .gitEmail
    ).toBe('local@example.invalid');
    await writeFile(
      join(consumer, '.git/config'),
      '[extensions]\nworktreeConfig=true\n[user]\nemail=common@example.invalid'
    );
    expect(
      (await discoverGit({ home, packageRoot, env: env(consumer) })).identity
        .gitEmail
    ).toBe('worktree@example.invalid');
  });
  it('omits invalid local values instead of substituting another identity and bounds files', async () => {
    await writeFile(
      join(consumer, '.git/config'),
      '[user]\nemail=not-an-email\nname=Local'
    );
    const result = await discoverGit({ home, packageRoot, env: env(consumer) });
    expect(result.identity.gitEmail).toBeUndefined();
    await writeFile(join(home, '.gitconfig'), 'x'.repeat(65537));
    await rm(join(consumer, '.git'), { recursive: true });
    expect(
      (await discoverGit({ home, packageRoot, env: env(consumer) })).identity
    ).toEqual({});
  });
});
