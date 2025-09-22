import { SentryAdapter, SentryScope } from '../../shared/utils/sentry_adapter'

/**
 * 渲染进程的 Sentry 适配器实现
 */
class NoopScope implements SentryScope {
  setTag(_key: string, _value: string): void {}
  setExtra(_key: string, _value: any): void {}
}

export class RendererSentryAdapter implements SentryAdapter {
  captureException(_error: any): void {}
  withScope(callback: (scope: SentryScope) => void): void {
    callback(new NoopScope())
  }
}