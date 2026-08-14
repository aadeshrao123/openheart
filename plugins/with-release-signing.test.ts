import { describe, expect, it } from 'vitest';
import { addReleaseSigning } from './with-release-signing';

// The exact shape prebuild produced, trimmed to the two blocks the plugin
// rewrites. Copied from a generated android/app/build.gradle rather than typed
// from memory, because a near-miss here would pass while the real file failed.
// Split only so the source line stays inside the column limit. The string it
// builds is still byte for byte what prebuild generates, which is the point of
// the fixture.
const SHRINK_LINE =
  "            def enableShrinkResources = findProperty(" +
  "'android.enableShrinkResourcesInReleaseBuilds') ?: 'false'";

const TEMPLATE = `android {
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            // Caution! In production, you need to generate your own keystore file.
            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig signingConfigs.debug
${SHRINK_LINE}
        }
    }
}`;

describe('addReleaseSigning', () => {
  it('adds a release signing config that reads Gradle properties', () => {
    const result = addReleaseSigning(TEMPLATE);

    expect(result).toContain('storeFile file(OPENHEART_UPLOAD_STORE_FILE)');
    expect(result).toContain('signingConfigs.release');
  });

  it('leaves the debug config alone', () => {
    const result = addReleaseSigning(TEMPLATE);

    expect(result).toContain("storeFile file('debug.keystore')");
    expect(result).toMatch(/debug \{\n\s+signingConfig signingConfigs\.debug/);
  });

  // The whole point of the plugin. A release build with no keystore configured
  // must still work for local testing, so it falls back rather than failing.
  it('falls back to the debug key only when no keystore property is set', () => {
    const result = addReleaseSigning(TEMPLATE);

    expect(result).toContain("project.hasProperty('OPENHEART_UPLOAD_STORE_FILE')");
  });

  // If Expo changes the template the replacement would silently do nothing and
  // the app would ship signed with a debug key, which is the failure this
  // plugin exists to prevent. It has to be loud.
  it('throws rather than silently skipping when the template changes', () => {
    expect(() => addReleaseSigning('android {\n  buildTypes {\n  }\n}')).toThrow(
      /template has\s+changed/,
    );
  });
});
