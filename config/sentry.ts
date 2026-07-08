import * as Sentry from '@sentry/react-native';
import type { ComponentType } from 'react';

// Crash reporting (N-2). Everything routes through this module so the enable
// guard and the PII scrubbing live in exactly one place.
//
// Sentry only runs in RELEASE builds that have a DSN (soak APK / TestFlight /
// production). Under Metro (`__DEV__`) it stays completely inert: no native
// call is ever made, so the dev clients don't depend on the RNSentry native
// module being present, and day-to-day dev errors never reach the project.
//
// Setup Alex still owns (only he can): create the Sentry project, then set
// EXPO_PUBLIC_SENTRY_DSN locally (.env) and on EAS
//   eas env:create --scope project --visibility plaintext \
//     --name EXPO_PUBLIC_SENTRY_DSN --value '<dsn>'
// Readable JS stack traces (source-map upload) are a later follow-up: it needs
// a SENTRY_AUTH_TOKEN plus the sentry gradle plugin / metro serializer.

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

export const sentryEnabled = !__DEV__ && !!DSN;

// The [photoService] logs print raw GPS as decimals; strip anything that looks
// like a coordinate out of console breadcrumbs. Sighting notes are never logged
// or attached to events, so coordinates are the only user data to guard here.
const COORD = /-?\d{1,3}\.\d{4,}/g;

export function initSentry() {
  if (!sentryEnabled) return;
  Sentry.init({
    dsn: DSN,
    sendDefaultPii: false,
    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.category === 'console' && typeof breadcrumb.message === 'string') {
        breadcrumb.message = breadcrumb.message.replace(COORD, '[coord]');
      }
      return breadcrumb;
    },
  });
}

// Attach the account for triage. The Firebase uid is a random id, not PII; we
// deliberately never send email or username.
export function setSentryUser(uid: string | null) {
  if (sentryEnabled) Sentry.setUser(uid ? { id: uid } : null);
}

export function captureError(error: unknown) {
  if (sentryEnabled) Sentry.captureException(error);
}

// Wraps the root component for native crash + performance instrumentation.
// A pass-through when Sentry is inert.
export function wrapWithSentry<P extends Record<string, unknown>>(
  component: ComponentType<P>,
): ComponentType<P> {
  return sentryEnabled ? Sentry.wrap(component) : component;
}
