/**
 * `detectFileType`: the viewer a drive object's name asks for, with the same
 * extension tables as the dashboard's `components/FileRenderers.tsx`.
 */
const IMG_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.avif', '.svg', '.ico'])
const CSV_EXTS = new Set(['.csv', '.tsv'])
const JSON_EXTS = new Set(['.json'])
const JSONL_EXTS = new Set(['.jsonl'])
const HTML_EXTS = new Set(['.html', '.htm'])
const PDF_EXTS = new Set(['.pdf'])
const EXCALIDRAW_EXTS = new Set(['.excalidraw'])
const VIDEO_EXTS = new Set(['.mp4', '.m4v', '.webm', '.mov', '.mkv', '.ogv'])
const AUDIO_EXTS = new Set(['.mp3', '.wav', '.m4a', '.flac', '.ogg', '.oga', '.opus'])
const SHEET_EXTS = new Set(['.xlsx', '.xlsm'])
const OFFICE_EXTS = new Set(['.docx', '.doc', '.xls', '.pptx', '.ppt', '.odt', '.ods', '.odp'])

export type FileType =
  | 'image'
  | 'svg'
  | 'csv'
  | 'json'
  | 'jsonl'
  | 'html'
  | 'pdf'
  | 'excalidraw'
  | 'video'
  | 'audio'
  | 'sheet'
  | 'office'
  | 'code'
  | 'markdown'

function extOf(fp: string): string {
  const i = fp.lastIndexOf('.')
  return i >= 0 ? fp.slice(i).toLowerCase() : ''
}

export function detectFileType(filePath: string): FileType {
  const ext = extOf(filePath)
  if (IMG_EXTS.has(ext)) return 'image'
  if (CSV_EXTS.has(ext)) return 'csv'
  if (JSON_EXTS.has(ext)) return 'json'
  if (JSONL_EXTS.has(ext)) return 'jsonl'
  if (HTML_EXTS.has(ext)) return 'html'
  if (PDF_EXTS.has(ext)) return 'pdf'
  if (EXCALIDRAW_EXTS.has(ext)) return 'excalidraw'
  if (VIDEO_EXTS.has(ext)) return 'video'
  if (AUDIO_EXTS.has(ext)) return 'audio'
  if (SHEET_EXTS.has(ext)) return 'sheet'
  if (OFFICE_EXTS.has(ext)) return 'office'
  if (['.md', '.markdown', '.mdx', '.txt', ''].includes(ext)) return 'markdown'
  return 'code'
}
