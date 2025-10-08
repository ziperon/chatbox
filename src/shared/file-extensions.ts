// Office document extensions
export const officeExts = [
  // Microsoft Office
  '.doc', '.docx', '.docm', '.dotx', '.dotm',  // Word
  '.xls', '.xlsx', '.xlsm', '.xlsb', '.xltx', '.xltm', '.xlam',  // Excel
  '.ppt', '.pptx', '.pptm', '.potx', '.potm', '.ppam',  // PowerPoint
  
  // OpenDocument Format
  '.odt', '.ott',  // Text
  '.ods', '.ots',  // Spreadsheet
  '.odp', '.otp',  // Presentation
  '.odg', '.otg',  // Graphics
  '.odf',  // Formula
  
  // Legacy and other office formats
  '.rtf',  // Rich Text Format
  '.pdf',  // PDF (handled by officeparser)
  '.txt',  // Plain text
  
  // Apple iWork
  '.pages', '.numbers', '.key',
  
  // Other
  '.wps',  // Kingsoft Office
  '.et', '.dps',  // WPS Office
  '.csv',  // Comma Separated Values
  '.tsv',  // Tab Separated Values
]

// Get file extension in lowercase with dot (e.g., '.docx')
function getFileExtension(filePath: string): string {
  const lastDot = filePath.lastIndexOf('.')
  return lastDot === -1 ? '' : filePath.slice(lastDot).toLowerCase()
}

export function isOfficeFilePath(filePath: string): boolean {
  if (!filePath) return false
  const ext = getFileExtension(filePath)
  return officeExts.includes(ext)
}

// More specific file type checkers
export function isWordFile(filePath: string): boolean {
  const ext = getFileExtension(filePath)
  return ['.doc', '.docx', '.docm', '.dotx', '.dotm', '.odt', '.ott', '.rtf', '.wps', '.pages'].includes(ext)
}

export function isExcelFile(filePath: string): boolean {
  const ext = getFileExtension(filePath)
  return ['.xls', '.xlsx', '.xlsm', '.xlsb', '.xltx', '.xltm', '.xlam', '.ods', '.ots', '.csv', '.tsv', '.et', '.numbers'].includes(ext)
}

export function isPowerPointFile(filePath: string): boolean {
  const ext = getFileExtension(filePath)
  return ['.ppt', '.pptx', '.pptm', '.potx', '.potm', '.ppam', '.odp', '.otp', '.dps', '.key'].includes(ext)
}

export const textExts = [
  '.txt', // 普通文本文件
  '.md', // Markdown 文件
  '.mdx', // Markdown 文件
  '.html', // HTML 文件
  '.htm', // HTML 文件的另一种扩展名
  '.xml', // XML 文件
  '.json', // JSON 文件
  '.yaml', // YAML 文件
  '.yml', // YAML 文件的另一种扩展名
  '.tsv', // 制表符分隔值文件
  '.ini', // 配置文件
  '.log', // 日志文件
  '.rtf', // 富文本格式文件
  '.tex', // LaTeX 文件
  '.srt', // 字幕文件
  '.xhtml', // XHTML 文件
  '.nfo', // 信息文件（主要用于场景发布）
  '.conf', // 配置文件
  '.config', // 配置文件
  '.env', // 环境变量文件
  '.rst', // reStructuredText 文件
  '.php', // PHP 脚本文件，包含嵌入的 HTML
  '.js', // JavaScript 文件（部分是文本，部分可能包含代码）
  '.ts', // TypeScript 文件
  '.jsp', // JavaServer Pages 文件
  '.aspx', // ASP.NET 文件
  '.bat', // Windows 批处理文件
  '.sh', // Unix/Linux Shell 脚本文件
  '.py', // Python 脚本文件
  '.rb', // Ruby 脚本文件
  '.pl', // Perl 脚本文件
  '.sql', // SQL 脚本文件
  '.css', // Cascading Style Sheets 文件
  '.less', // Less CSS 预处理器文件
  '.scss', // Sass CSS 预处理器文件
  '.sass', // Sass 文件
  '.styl', // Stylus CSS 预处理器文件
  '.coffee', // CoffeeScript 文件
  '.ino', // Arduino 代码文件
  '.asm', // Assembly 语言文件
  '.go', // Go 语言文件
  '.scala', // Scala 语言文件
  '.swift', // Swift 语言文件
  '.kt', // Kotlin 语言文件
  '.rs', // Rust 语言文件
  '.lua', // Lua 语言文件
  '.groovy', // Groovy 语言文件
  '.dart', // Dart 语言文件
  '.hs', // Haskell 语言文件
  '.clj', // Clojure 语言文件
  '.cljs', // ClojureScript 语言文件
  '.elm', // Elm 语言文件
  '.erl', // Erlang 语言文件
  '.ex', // Elixir 语言文件
  '.exs', // Elixir 脚本文件
  '.pug', // Pug (formerly Jade) 模板文件
  '.haml', // Haml 模板文件
  '.slim', // Slim 模板文件
  '.tpl', // 模板文件（通用）
  '.ejs', // Embedded JavaScript 模板文件
  '.hbs', // Handlebars 模板文件
  '.mustache', // Mustache 模板文件
  '.jade', // Jade 模板文件 (已重命名为 Pug)
  '.twig', // Twig 模板文件
  '.blade', // Blade 模板文件 (Laravel)
  '.vue', // Vue.js 单文件组件
  '.jsx', // React JSX 文件
  '.tsx', // React TSX 文件
  '.graphql', // GraphQL 查询语言文件
  '.gql', // GraphQL 查询语言文件
  '.proto', // Protocol Buffers 文件
  '.thrift', // Thrift 文件
  '.toml', // TOML 配置文件
  '.edn', // Clojure 数据表示文件
  '.cake', // CakePHP 配置文件
  '.ctp', // CakePHP 视图文件
  '.cfm', // ColdFusion 标记语言文件
  '.cfc', // ColdFusion 组件文件
  '.m', // Objective-C 源文件
  '.mm', // Objective-C++ 源文件
  '.gradle', // Gradle 构建文件
  '.groovy', // Gradle 构建文件
  '.kts', // Kotlin Script 文件
  '.java', // Java 代码文件
  '.cs', // C# 代码文件
]

export function isTextFilePath(filePath: string) {
  return textExts.some((ext) => filePath.toLowerCase().endsWith(ext))
}

export const epubExts = ['.epub']

export function isEpubFilePath(filePath: string) {
  return epubExts.some((ext) => filePath.toLowerCase().endsWith(ext))
}

export const csvExts = [
  '.csv', // 逗号分隔值文件
]
export function isCsvPath(filePath: string) {
  return csvExts.some((ext) => filePath.toLowerCase().endsWith(ext))
}