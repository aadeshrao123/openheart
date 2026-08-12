// Settles the one number the AWS documentation does not give.
//
// Pose.Yaw and Pose.Pitch are documented as -180 to 180 with no statement of
// which direction is positive. If YAW_IS_POSITIVE_TURNING_RIGHT in
// supabase/functions/_shared/verification.ts is wrong, "turn left" accepts a
// face turned right: the check still passes, still looks like it works, and
// stops being a liveness signal.
//
//   node scripts/calibrate-pose.mjs turned-left.jpg
//
// Take one selfie turning your head to your OWN left, pass it in, and read the
// answer it prints. Nothing is uploaded anywhere but AWS, and nothing is
// stored: DetectFaces is documented as stateless.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { argv, env, exit } from 'node:process';

const imagePath = argv[2];

if (!imagePath) {
  console.error('Usage: node scripts/calibrate-pose.mjs <selfie turning to your left>');
  exit(1);
}

// The same credentials the Edge Functions use, read from the file they live in
// rather than passed on a command line where they would reach the shell history.
function readFunctionEnv(name) {
  if (env[name]) {
    return env[name];
  }

  const file = readFileSync('supabase/functions/.env', 'utf8');
  const line = file.split('\n').find((entry) => entry.startsWith(`${name}=`));

  if (!line) {
    throw new Error(`${name} is not set, and not in supabase/functions/.env`);
  }

  return line.slice(name.length + 1).trim();
}

const region = readFunctionEnv('AWS_REGION');
const bytes = readFileSync(imagePath);

// Through the AWS CLI rather than a signing library, because this runs once and
// adding a dependency for it would outlive the two minutes it saves.
const response = execFileSync(
  'aws',
  [
    'rekognition',
    'detect-faces',
    '--region',
    region,
    '--attributes',
    'DEFAULT',
    '--image-bytes',
    bytes.toString('base64'),
    '--output',
    'json',
  ],
  { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
);

const faces = JSON.parse(response).FaceDetails ?? [];

if (faces.length !== 1) {
  console.error(`Found ${faces.length} faces. Use a photo with exactly one.`);
  exit(1);
}

const { Yaw, Pitch, Roll } = faces[0].Pose;

console.log('');
console.log(`Yaw   ${Yaw.toFixed(1)}`);
console.log(`Pitch ${Pitch.toFixed(1)}`);
console.log(`Roll  ${Roll.toFixed(1)}`);
console.log('');

if (Math.abs(Yaw) < 10) {
  console.log('That face is close to straight on. Turn further and try again.');
  exit(1);
}

// The photo was of a head turned to its own left, so negative yaw means
// positive yaw is a turn to the right.
const positiveIsRight = Yaw < 0;

console.log(`Set YAW_IS_POSITIVE_TURNING_RIGHT = ${positiveIsRight}`);
console.log('in supabase/functions/_shared/verification.ts');
console.log('');
console.log(`Pitch on this face is ${Pitch > 0 ? 'positive' : 'negative'}, so positive pitch`);
console.log(`is ${Pitch > 0 ? 'probably looking up' : 'probably looking down'}. Confirm that`);
console.log('separately with a photo looking up if you changed the yaw setting.');
