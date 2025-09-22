import '@mantine/core/styles.css'
import { RouterProvider } from '@tanstack/react-router'
import { useAtomValue } from 'jotai'
import { StrictMode, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { ErrorBoundary } from './components/ErrorBoundary'
import './i18n'
import { getLogger } from './lib/utils'
import reportWebVitals from './reportWebVitals'
import { router } from './router'
import { initData } from './setup/init_data'
import './static/globals.css'
import './static/index.css'
import { initLogAtom, migrationProcessAtom } from './stores/atoms/utilAtoms'
import * as migration from './stores/migration'
import { CHATBOX_BUILD_PLATFORM, CHATBOX_BUILD_TARGET } from './variables'
import '@mantine/spotlight/styles.css'
import platform from './platform'
import { delay } from './utils'

const log = getLogger('index')

// 按需加载 polyfill
import './setup/load_polyfill'

// Sentry 初始化（已移除逻辑，但保留空模块以防引用）
import './setup/sentry_init'

// 全局错误处理
import './setup/global_error_handler'

// GA4 初始化
import './setup/ga_init'

// 引入保护代码
import './setup/protect'

// 开发环境下引入错误测试工具
// if (process.env.NODE_ENV === 'development') {
//   import('./utils/error-testing')
// }

// 引入移动端安全区域代码，主要为了解决异形屏幕的问题
if (CHATBOX_BUILD_TARGET === 'mobile_app' && CHATBOX_BUILD_PLATFORM === 'ios') {
  import('./setup/mobile_safe_area')
}

// ==========执行初始化==============
async function initializeApp() {
  log.info('initializeApp')

  try {
    // 数据迁移
    await migration.migrate()
    log.info('migrate done')
  } catch (e) {
    log.error('migrate error', e)
  }

  try {
    // migration 中没有写入 Demo session了，可以在 migration 之后初始化
    // 初始化数据
    await initData()
    log.info('init data done')
  } catch (e) {
    log.error('init data error', e)
  }

  // 最后执行 storage 清理，清理不 block 进入UI
  import('./setup/storage_clear')

  // 启动mcp服务器
  import('./setup/mcp_bootstrap')
}

// ==========渲染节点==============

function InitPage() {
  const log = useAtomValue(initLogAtom)
  const [showLoadingLog, setShowLoadingLog] = useState(false)
  const migrationProcess = useAtomValue(migrationProcessAtom)

  return (
    <div className="flex flex-col items-center absolute top-0 left-0 w-full h-full">
      <p className="font-roboto font-normal opacity-40 mt-4 mb-2">
        {migrationProcess ? `Migrating...(${migrationProcess})` : 'loading...'}
      </p>
      <div className="">
        <div
          role="button"
          tabIndex={0}
          className="px-4 py-0 rounded-md cursor-pointer select-none text-sm text-blue-600"
          onClick={() => setShowLoadingLog(!showLoadingLog)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              setShowLoadingLog(!showLoadingLog)
              e.preventDefault()
            }
          }}
        >
          {showLoadingLog ? 'Hide Loading Log' : 'Show Loading Log'}
        </div>
      </div>
      {/* 倒叙展示，能够看到最新的日志 */}
      {showLoadingLog && (
        <pre className="whitespace-pre-wrap flex-1 overflow-y-auto m-0 p-2">{[...log].reverse().join('\n')}</pre>
      )}
    </div>
  )
}

// initializeApp执行时间少于1s的话，将不会看到log
const tid = setTimeout(() => {
  ReactDOM.createRoot(document.getElementById('log-root') as HTMLElement).render(
    <StrictMode>
      <ErrorBoundary>
        <InitPage />
      </ErrorBoundary>
    </StrictMode>
  )
}, 1000)

// 等待初始化完成后再渲染
initializeApp()
  .catch((e) => {
    // 初始化中的各个步骤已经捕获了错误，这里防止未来添加未捕获的逻辑
    log.error('initializeApp error', e)
  })
  .finally(() => {
    clearTimeout(tid)

    // 等待settings初始化完成，尽量避免闪屏
    // TODO: 更好的做法是在必要的数据全部初始化完成后再hide splash screen
    delay(500).then(() => {
      const el = document.querySelector('.splash-screen')
      if (platform.type !== 'mobile') {
        // remove loading page with animation
        if (el) {
          el.addEventListener('animationend', () => {
            el.parentNode?.removeChild(el)
          })
          el.classList.add('splash-screen-fade-out')
        }
      } else {
        if (el) {
          el.parentNode?.removeChild(el)
        }
      }
    })

    // 初始化完成，可以开始渲染
    ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
      <StrictMode>
        <ErrorBoundary>
          <RouterProvider router={router} />
        </ErrorBoundary>
      </StrictMode>
    )
  })

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals()
