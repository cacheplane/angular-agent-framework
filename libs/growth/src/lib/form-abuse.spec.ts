import { describe, expect, it } from 'vitest';
import { assessFormAbuse } from './form-abuse.ts';

describe('form abuse assessment', () => {
  it('blocks combined random name and message signals', () => {
    expect(
      assessFormAbuse({
        email: 'person@gmail.com',
        displayName: 'aBcDeFgHiJkLmNoP',
        message: 'qRsTuVwXyZaBcDeF',
        companyName: 'Zqxwy LLC',
      })
    ).toMatchObject({
      score: 100,
      decision: 'blocked',
      category: 'automated_form_spam',
      reasons: ['gibberish_name', 'gibberish_message', 'generated_company'],
    });
  });
  it.each([
    {
      displayName: 'Christopher',
      message: 'Can you help us integrate Angular agents?',
      companyName: 'Acme LLC',
    },
    { displayName: '李明', message: '想了解你们的产品', companyName: '示例' },
    { displayName: 'McDonald', message: 'Hello', companyName: 'NASA' },
    {
      displayName: 'Jean-Baptiste Martin',
      message: 'Please send more information.',
      companyName: 'Test LLC',
    },
    {
      displayName: 'JOHNATHANSMITH',
      message: 'HelloWorldExample',
      companyName: 'ACME LLC',
    },
  ])(
    'allows legitimate short and international fields: $displayName',
    (fields) => {
      expect(
        assessFormAbuse({ email: 'hello+demo@gmail.com', ...fields })
      ).toMatchObject({ score: 0, decision: 'allow', category: 'normal' });
    }
  );
  it('keeps a single gibberish signal plus LLC below threshold', () => {
    expect(
      assessFormAbuse({
        email: 'person@gmail.com',
        displayName: 'aBcDeFgHiJkLmNoP',
        companyName: 'Zqxwy LLC',
      })
    ).toMatchObject({ score: 60, decision: 'allow', category: 'suspicious' });
  });
  it('blocks placeholder identities only with corroborating evidence', () => {
    expect(assessFormAbuse({ email: 'test@example.com' })).toMatchObject({
      score: 60,
      decision: 'allow',
    });
    expect(
      assessFormAbuse({ email: 'test@example.com', rapidIdentityChange: true })
    ).toMatchObject({
      score: 80,
      decision: 'blocked',
      category: 'placeholder_email',
    });
    expect(assessFormAbuse({ email: 'test@realbusiness.com' })).toMatchObject({
      score: 0,
      decision: 'allow',
    });
  });
  it('blocks the honeypot alone and accepts older forms without it', () => {
    expect(
      assessFormAbuse({
        email: 'person@gmail.com',
        honeypot: 'https://bot.invalid',
      })
    ).toMatchObject({ score: 100, decision: 'blocked', category: 'honeypot' });
    expect(
      assessFormAbuse({ email: 'person@gmail.com', honeypot: '  ' }).decision
    ).toBe('allow');
  });
});
