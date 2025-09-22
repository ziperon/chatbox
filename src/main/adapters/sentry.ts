import type { SentryAdapter, SentryScope } from '../../shared/utils/sentry_adapter'

// No-op Sentry adapter for main process
class NoopScope implements SentryScope {
  setTag(_key: string, _value: string): void {}
  setExtra(_key: string, _value: any): void {}
}

export class MainSentryAdapter implements SentryAdapter {
  captureException(_error: any): void {}
  withScope(callback: (scope: SentryScope) => void): void {
    callback(new NoopScope())
  }
}

export const sentry = new MainSentryAdapter()
