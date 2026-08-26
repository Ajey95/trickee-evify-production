const fs = require('node:fs');
const path = require('node:path');

describe('VRTrickee Android release identity', () => {
  const appGradle = fs.readFileSync(
    path.resolve(__dirname, '../android/app/build.gradle'),
    'utf8',
  );
  const rootGradle = fs.readFileSync(
    path.resolve(__dirname, '../android/build.gradle'),
    'utf8',
  );
  const publicBuildScript = fs.readFileSync(
    path.resolve(__dirname, '../scripts/build-public-release.ps1'),
    'utf8',
  );
  const manifest = fs.readFileSync(
    path.resolve(__dirname, '../android/app/src/main/AndroidManifest.xml'),
    'utf8',
  );
  const authScreen = fs.readFileSync(
    path.resolve(__dirname, '../src/screens/AuthScreen.tsx'),
    'utf8',
  );

  test('keeps the managed app separate from the public app', () => {
    expect(appGradle).toContain(
      'def privateApplicationId = "com.trickeeandroid"',
    );
    expect(appGradle).toContain(
      'def publicApplicationId = "com.trickee.vrtrickee"',
    );
  });

  test('advances the crash-fixed public candidate for the API 36 submission', () => {
    expect(appGradle).toContain('versionCode 10');
    expect(appGradle).toContain('versionName "1.0.9"');
    expect(rootGradle).toContain('compileSdkVersion = 36');
    expect(rootGradle).toContain('targetSdkVersion = 36');
  });

  test('orders vector icon font copying before release lint model generation', () => {
    expect(appGradle).toContain(
      'tasks.matching { it.name.startsWith("generate") && it.name.endsWith("LintVitalReportModel") }.configureEach',
    );
    expect(appGradle).toContain(
      'dependsOn(tasks.named("copyReactNativeVectorIconFonts"))',
    );
  });

  test('fails the public build if the Android 14 screen-stack patch is missing', () => {
    expect(publicBuildScript).toContain('ScreenStack.kt');
    expect(publicBuildScript).toContain(
      'drawingOpPool.removeAt(drawingOpPool.size - 1)',
    );
    expect(publicBuildScript).toContain('npm run postinstall');
  });

  test('allows local HTTP only in debug builds', () => {
    expect(manifest).toContain(
      'android:usesCleartextTraffic="${usesCleartextTraffic}"',
    );
    expect(appGradle).toContain(
      'manifestPlaceholders = [usesCleartextTraffic: "true"]',
    );
    expect(appGradle).toContain(
      'manifestPlaceholders = [usesCleartextTraffic: "false"]',
    );
    expect(publicBuildScript).toContain(
      "throw 'Public VRTrickee releases must reject cleartext HTTP traffic.'",
    );
  });

  test('only asks access-request applicants for data sent to the backend', () => {
    const signUpView = authScreen.slice(
      authScreen.indexOf('// ============ SIGN UP VIEW ============'),
      authScreen.indexOf('const styles = StyleSheet.create'),
    );

    expect(signUpView).toContain('Request driver access');
    expect(signUpView).toContain('Send access request');
    expect(signUpView).not.toContain('Phone Number');
    expect(signUpView).not.toContain('title="Password"');
    expect(signUpView).not.toContain('Internal Driver ID');
    expect(signUpView).not.toContain('Driving Licence Number');
    expect(signUpView).not.toContain('Create driver account');
  });
});
