import { verdictForClassification } from './moderation.ts';

function expect(actual: string, wanted: string, label: string): void {
  if (actual !== wanted) {
    throw new Error(`${label}: got ${actual}, wanted ${wanted}`);
  }
}

// The four values Arachnid Shield's own OpenAPI document declares for
// Classification, read off the live spec rather than from memory.
Deno.test('only a clean miss approves a photo', () => {
  expect(verdictForClassification('no-known-match'), 'approved', 'no-known-match');

  expect(verdictForClassification('csam'), 'rejected', 'csam');
  expect(
    verdictForClassification('harmful-abusive-material'),
    'rejected',
    'harmful-abusive-material',
  );
});

// Their test fixture returns this, so the wiring can be proved without anyone
// handling real material. It only proves anything if a match rejects.
Deno.test('the test classification rejects, so the fixture demonstrates something', () => {
  expect(verdictForClassification('test'), 'rejected', 'test');
});

// The half of this that matters. A value added to their enum after this ships
// reaches a deployed function, and the only safe reading of a word this code
// does not know is that it is not a clean miss.
Deno.test('an unrecognised classification rejects rather than passing', () => {
  expect(verdictForClassification('something-added-in-2027'), 'rejected', 'unknown value');
  expect(verdictForClassification(''), 'rejected', 'empty string');
  expect(verdictForClassification(undefined), 'rejected', 'undefined');
  expect(verdictForClassification(null), 'rejected', 'null');
  expect(verdictForClassification({ classification: 'no-known-match' }), 'rejected', 'object');

  // Not a string, and truthy. A looser check could read this as a pass.
  expect(verdictForClassification(true), 'rejected', 'true');
});
