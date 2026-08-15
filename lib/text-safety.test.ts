import { describe, expect, it } from 'vitest';
import { checkMessage, checkText, normalise } from './text-safety';

describe('normalise', () => {
  it('folds lookalike characters', () => {
    expect(normalise('f4k3').squashed).toBe('fake');
    expect(normalise('@$$').squashed).toBe('as');
  });

  it('collapses repeated characters', () => {
    expect(normalise('heyyyyy').squashed).toBe('hey');
  });

  it('keeps separators in the loose form and drops them in the squashed one', () => {
    const { loose, squashed } = normalise('h.e.l.l.o there');

    expect(loose).toBe('h.e.l.l.o there');
    expect(squashed).toBe('helothere');
  });
});

describe('checkText', () => {
  it('passes ordinary writing', () => {
    expect(checkText('Climber, terrible cook, looking for someone kind.')).toBeNull();
    expect(checkText('')).toBeNull();
  });

  // The whole reason the spaced form exists. Blocking these would be a worse
  // failure than missing a slur, because it hits people who did nothing.
  it('does not fire on innocent words that contain a term', () => {
    for (const phrase of [
      'I grew up in Scunthorpe',
      'Analyst by trade',
      'Class of 2018',
      'I love Dickens',
      'Essex born',
      'Cocktail enthusiast',
      'heyyyyy',
      'Shit at tennis, good at everything else',
      'I am bisexual',
      'Open issue on my repo',
      'I love Dickens',
      'Third rock from Uranus',
      'Sussex born and raised',
    ]) {
      expect(checkText(phrase), phrase).toBeNull();
    }
  });

  it('catches an email address', () => {
    expect(checkText('reach me at someone@example.com')?.category).toBe('contact');
  });

  it('catches a phone number however it is spaced', () => {
    expect(checkText('call 07700 900123')?.category).toBe('contact');
    expect(checkText('+44 7700 900123')?.category).toBe('contact');
  });

  it('catches a move to another app', () => {
    expect(checkText('add me on telegram')?.category).toBe('contact');
    expect(checkText('snap: coolperson99')?.category).toBe('contact');
    expect(checkText('insta @realperson')?.category).toBe('contact');
  });

  it('catches paid solicitation', () => {
    expect(checkText('my rates are on onlyfans')?.category).toBe('solicitation');
    expect(checkText('cashapp me')?.category).toBe('solicitation');
  });

  it('catches explicit words but not mild swearing', () => {
    expect(checkText('send nudes')?.category).toBe('sexual');
    expect(checkText('looking for sex')?.category).toBe('sexual');
    expect(checkText('d.i.c.k')?.category).toBe('sexual');
    expect(checkText('this weather is shit')).toBeNull();
    expect(checkText('damn good coffee')).toBeNull();
  });

  it('catches a slur written plainly', () => {
    expect(checkText('you are a retard')?.category).toBe('slur');
  });

  it('catches a slur padded, spaced or spelled with symbols', () => {
    for (const phrase of ['r e t a r d', 'r.e.t.a.r.d', 'reeetard', 'r3t4rd', 'r.e.t.a.a.r.d']) {
      expect(checkText(phrase)?.category, phrase).toBe('slur');
    }
  });
});

describe('checkMessage', () => {
  // Two people who matched swapping numbers is ordinary. The profile rules are
  // about what is published; these are about what one person sends another.
  it('does not police contact details or selling', () => {
    for (const phrase of [
      'my number is 07700 900123',
      'add me on telegram',
      'reach me at someone@example.com',
      'cashapp me for the tickets',
    ]) {
      expect(checkMessage(phrase, false), phrase).toBeNull();
      expect(checkMessage(phrase, true), phrase).toBeNull();
    }
  });

  it('refuses explicit language until both have agreed', () => {
    expect(checkMessage('send nudes', false)?.category).toBe('sexual');
    expect(checkMessage('d.i.c.k', false)?.category).toBe('sexual');
    expect(checkMessage('send nudes', true)).toBeNull();
    expect(checkMessage('d.i.c.k', true)).toBeNull();
  });

  // The line the agreement does not move. Nobody consented to being abused, and
  // an agreement about explicit language is not one about slurs.
  it('refuses slurs with or without an agreement', () => {
    for (const allowed of [false, true]) {
      expect(checkMessage('you are a retard', allowed)?.category, String(allowed)).toBe('slur');
      expect(checkMessage('r3t4rd', allowed)?.category, String(allowed)).toBe('slur');
    }
  });

  it('leaves ordinary messages and mild swearing alone either way', () => {
    for (const allowed of [false, true]) {
      expect(checkMessage('heyyyyy', allowed)).toBeNull();
      expect(checkMessage('this weather is shit', allowed)).toBeNull();
      expect(checkMessage('I am bisexual', allowed)).toBeNull();
      expect(checkMessage('', allowed)).toBeNull();
    }
  });
});
