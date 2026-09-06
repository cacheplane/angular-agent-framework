import {
  companyDomainFromEmail,
  isPersonalEmailDomain,
} from './company-domain.ts';

describe('candidate company domains', () => {
  it('normalizes only a public-looking domain without asserting employment', () => {
    expect(companyDomainFromEmail('Developer+Test@Example.COM')).toBe(
      'example.com'
    );
    expect(companyDomainFromEmail('Developer@sub.example.co.uk')).toBe(
      'sub.example.co.uk'
    );
  });
  it.each([
    'a@gmail.com',
    'a@PROTON.ME',
    'a@127.0.0.1',
    'a@[::1]',
    'a@localhost',
    'a@-bad.com',
    'a@bad_.com',
    'a@bad..com',
    'a@x.123',
    '@example.com',
    'a@@example.com',
    'a@example.com/path',
    'a@example.com ',
  ])('rejects %s', (email) => {
    expect(companyDomainFromEmail(email)).toBeNull();
  });
  it('recognizes the existing personal provider set case-insensitively', () => {
    for (const domain of [
      'aol.com',
      'gmail.com',
      'googlemail.com',
      'hotmail.com',
      'icloud.com',
      'live.com',
      'me.com',
      'msn.com',
      'outlook.com',
      'proton.me',
      'protonmail.com',
      'yahoo.com',
      'ymail.com',
    ]) {
      expect(isPersonalEmailDomain(domain.toUpperCase())).toBe(true);
    }
    expect(isPersonalEmailDomain('example.com')).toBe(false);
  });
});
