/**
 * The text-preview body: markdown and code through the host's own
 * `MarkdownRenderer` (App SDK), JSON pretty-printed, CSV/TSV as a table, and
 * every other text type as plain text.
 *
 * The built-in rendered through the dashboard's `ContentRenderer`, which also has
 * a JSON tree, a JSONL stream, a sandboxed HTML page and an Excalidraw scene; none
 * of those viewers is on the App SDK (PORTING.md, "File previews"). An HTML object
 * is shown as its source here, never rendered, so a bucket object cannot run.
 */
import { memo, type CSSProperties, type RefObject } from 'react'
import { MarkdownRenderer } from '@kirocrew/app-sdk/ui'

export const MD_EXTS = new Set(['.md', '.markdown', '.mdx', '.txt', ''])

export function extOf(fp: string): string {
  const i = fp.lastIndexOf('.')
  return i >= 0 ? fp.slice(i).toLowerCase() : ''
}

export function wrapCode(content: string, ext: string): string {
  const lang = ext.replace('.', '')
  return '~~~' + lang + '\n' + content + '\n~~~'
}

export function langFor(ext: string): string {
  const map: Record<string, string> = {
    '.ts': 'typescript', '.tsx': 'typescript', '.js': 'javascript', '.jsx': 'javascript',
    '.py': 'python', '.json': 'json', '.yaml': 'yaml', '.yml': 'yaml',
    '.sh': 'bash', '.css': 'css', '.html': 'html', '.md': 'markdown',
    '.rs': 'rust', '.go': 'go', '.java': 'java', '.kt': 'kotlin',
    '.rb': 'ruby', '.sql': 'sql', '.xml': 'xml', '.toml': 'ini', '.cfg': 'ini',
  }
  return map[ext] || 'plaintext'
}

function prettyJson(content: string): string {
  try {
    return JSON.stringify(JSON.parse(content), null, 2)
  } catch {
    return content
  }
}

function splitRow(line: string, delimiter: string): string[] {
  const cells: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cell += '"'
        i++
      } else if (ch === '"') {
        quoted = false
      } else {
        cell += ch
      }
    } else if (ch === '"') {
      quoted = true
    } else if (ch === delimiter) {
      cells.push(cell)
      cell = ''
    } else {
      cell += ch
    }
  }
  cells.push(cell)
  return cells
}

function CsvTable({ content, delimiter }: { content: string; delimiter: string }) {
  const rows = content.split(/\r?\n/).filter((line) => line.length > 0).map((line) => splitRow(line, delimiter))
  const [head, ...body] = rows
  return (
    <div className="overflow-auto">
      <table className="text-[12px] border-collapse">
        {head && (
          <thead>
            <tr>
              {head.map((cell, i) => (
                <th key={i} className="border border-border px-2 py-1 text-left font-semibold text-text">{cell}</th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {body.map((row, r) => (
            <tr key={r}>
              {row.map((cell, i) => (
                <td key={i} className="border border-border px-2 py-1 text-text">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export const ContentRenderer = memo(function ContentRenderer({
  fileType,
  filePath,
  content,
  previewRef,
  displayContent,
  isMarkdown,
  markdownClassName,
  previewStyle,
}: {
  isRichType: boolean
  fileType: string
  filePath?: string
  content: string
  editing: boolean
  lang: string
  lineNums: boolean
  wordWrap: boolean
  onChange: (v: string) => void
  previewRef?: RefObject<HTMLDivElement>
  displayContent?: string
  isMarkdown?: boolean
  markdownClassName?: string
  previewStyle?: CSSProperties
}) {
  if (isMarkdown || fileType === 'code' || fileType === 'markdown') {
    return (
      <div ref={previewRef} className={markdownClassName} style={previewStyle}>
        <MarkdownRenderer content={displayContent ?? content} />
      </div>
    )
  }
  if (fileType === 'csv') {
    return <CsvTable content={content} delimiter={filePath && extOf(filePath) === '.tsv' ? '\t' : ','} />
  }
  return (
    <pre className="h-full overflow-auto whitespace-pre-wrap break-words text-[12px] leading-relaxed text-text">
      {fileType === 'json' ? prettyJson(content) : content}
    </pre>
  )
})
