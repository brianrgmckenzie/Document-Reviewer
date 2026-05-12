'use client'

import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import UnderlineExt from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import { TextStyle } from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import FontFamily from '@tiptap/extension-font-family'
import { Extension } from '@tiptap/core'
import { marked } from 'marked'
import { useEffect, useRef } from 'react'

// ── Custom FontSize extension ────────────────────────────────────────────────
const FontSize = Extension.create({
  name: 'fontSize',
  addOptions() { return { types: ['textStyle'] } },
  addGlobalAttributes() {
    return [{
      types: this.options.types,
      attributes: {
        fontSize: {
          default: null,
          parseHTML: (el: HTMLElement) => el.style.fontSize || null,
          renderHTML: (attrs: Record<string, string>) => attrs.fontSize ? { style: `font-size: ${attrs.fontSize}` } : {},
        },
      },
    }]
  },
  addCommands() {
    return {
      setFontSize: (fontSize: string) => ({ chain }: { chain: () => unknown }) => (chain() as any).setMark('textStyle', { fontSize }).run(),
      unsetFontSize: () => ({ chain }: { chain: () => unknown }) => (chain() as any).setMark('textStyle', { fontSize: null }).unsetMark('textStyle').run(),
    }
  },
})

// ── Helpers ──────────────────────────────────────────────────────────────────
function toHtml(content: string): string {
  if (!content) return ''
  const looksLikeMarkdown = /^#{1,6}\s|^\*\*|^>\s|^[-*+]\s/m.test(content) && !/<[a-z][\s\S]*>/i.test(content)
  if (looksLikeMarkdown) return marked.parse(content) as string
  return content
}

const FONTS = [
  { label: 'Inter',         value: 'Inter, sans-serif' },
  { label: 'Space Grotesk', value: '"Space Grotesk", sans-serif' },
  { label: 'Space Mono',    value: '"Space Mono", monospace' },
  { label: 'Georgia',       value: 'Georgia, serif' },
  { label: 'Arial',         value: 'Arial, sans-serif' },
]
const SIZES = ['11px','12px','13px','14px','15px','16px','18px','20px','24px','28px','32px']
const PRESET_COLORS = [
  { label: 'Default',  value: '' },
  { label: 'White',    value: '#ffffff' },
  { label: 'Muted',    value: '#7a8299' },
  { label: 'Blue',     value: '#4f7cff' },
  { label: 'Purple',   value: '#9b7dff' },
  { label: 'Red',      value: '#ff4d4d' },
  { label: 'Green',    value: '#2dd88a' },
  { label: 'Orange',   value: '#f5a623' },
]

// ── Toolbar atoms ─────────────────────────────────────────────────────────────
function Sep() {
  return <span style={{ width: 1, height: 20, background: 'rgba(180,190,220,0.15)', flexShrink: 0 }} />
}

function Btn({ active, onClick, title, children }: {
  active?: boolean; onClick: () => void; title?: string; children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onMouseDown={e => { e.preventDefault(); onClick() }}
      title={title}
      style={{
        padding: '3px 7px',
        borderRadius: 5,
        border: 'none',
        cursor: 'pointer',
        fontSize: 13,
        fontWeight: 600,
        lineHeight: 1,
        minWidth: 28,
        background: active ? 'rgba(79,124,255,0.18)' : 'transparent',
        color: active ? 'var(--accent)' : 'var(--text-muted)',
        transition: 'background 0.12s, color 0.12s',
      }}
    >
      {children}
    </button>
  )
}

function Toolbar({ editor }: { editor: Editor }) {
  const colorRef = useRef<HTMLInputElement>(null)

  const currentFont  = editor.getAttributes('textStyle').fontFamily ?? ''
  const currentSize  = editor.getAttributes('textStyle').fontSize   ?? ''
  const currentColor = editor.getAttributes('textStyle').color      ?? ''

  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2,
      padding: '6px 10px',
      borderBottom: '1px solid rgba(180,190,220,0.15)',
      background: 'rgba(15,20,35,0.6)',
      borderRadius: '12px 12px 0 0',
    }}>

      {/* Font family */}
      <select
        value={currentFont}
        onChange={e => {
          if (e.target.value) editor.chain().focus().setFontFamily(e.target.value).run()
          else editor.chain().focus().unsetFontFamily().run()
        }}
        style={{ ...selectStyle, width: 130 }}
      >
        <option value="">Font…</option>
        {FONTS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
      </select>

      {/* Font size */}
      <select
        value={currentSize}
        onChange={e => {
          const chain = editor.chain().focus() as any
          if (e.target.value) chain.setFontSize(e.target.value).run()
          else chain.unsetFontSize().run()
        }}
        style={{ ...selectStyle, width: 70 }}
      >
        <option value="">Size…</option>
        {SIZES.map(s => <option key={s} value={s}>{s.replace('px', '')}</option>)}
      </select>

      <Sep />

      {/* Headings */}
      {([1, 2, 3] as const).map(level => (
        <Btn key={level} active={editor.isActive('heading', { level })} title={`Heading ${level}`}
          onClick={() => editor.chain().focus().toggleHeading({ level }).run()}>
          H{level}
        </Btn>
      ))}
      <Btn active={editor.isActive('paragraph')} title="Paragraph"
        onClick={() => editor.chain().focus().setParagraph().run()}>
        ¶
      </Btn>

      <Sep />

      {/* Inline formatting */}
      <Btn active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold">
        <span style={{ fontWeight: 800 }}>B</span>
      </Btn>
      <Btn active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic">
        <span style={{ fontStyle: 'italic', fontFamily: 'Georgia, serif' }}>I</span>
      </Btn>
      <Btn active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline">
        <span style={{ textDecoration: 'underline' }}>U</span>
      </Btn>
      <Btn active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} title="Strikethrough">
        <span style={{ textDecoration: 'line-through' }}>S</span>
      </Btn>

      <Sep />

      {/* Text color */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 3 }}>
        <div style={{ display: 'flex', gap: 3 }}>
          {PRESET_COLORS.map(c => (
            <button
              key={c.value}
              type="button"
              onMouseDown={e => {
                e.preventDefault()
                if (c.value) editor.chain().focus().setColor(c.value).run()
                else editor.chain().focus().unsetColor().run()
              }}
              title={c.label}
              style={{
                width: 14, height: 14, borderRadius: 3, cursor: 'pointer', border: 'none',
                background: c.value || 'transparent',
                outline: currentColor === c.value ? '2px solid var(--accent)' : c.value ? 'none' : '1px solid rgba(180,190,220,0.3)',
              }}
            />
          ))}
        </div>
        {/* Custom color via native picker */}
        <button
          type="button"
          onMouseDown={e => { e.preventDefault(); colorRef.current?.click() }}
          title="Custom color"
          style={{ width: 14, height: 14, borderRadius: 3, cursor: 'pointer', border: '1px dashed rgba(180,190,220,0.4)', background: 'transparent', padding: 0 }}
        >
          <span style={{ fontSize: 9, color: 'var(--text-muted)', lineHeight: 1 }}>+</span>
        </button>
        <input ref={colorRef} type="color" style={{ width: 0, height: 0, opacity: 0, position: 'absolute' }}
          onChange={e => editor.chain().focus().setColor(e.target.value).run()} />
      </div>

      <Sep />

      {/* Alignment */}
      {(['left', 'center', 'right', 'justify'] as const).map(align => (
        <Btn key={align} active={editor.isActive({ textAlign: align })}
          onClick={() => editor.chain().focus().setTextAlign(align).run()} title={`Align ${align}`}>
          {ALIGN_ICONS[align]}
        </Btn>
      ))}

      <Sep />

      {/* Lists + rule */}
      <Btn active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bullet list">
        <BulletIcon />
      </Btn>
      <Btn active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Numbered list">
        <OrderedIcon />
      </Btn>
      <Btn active={false} onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal rule">
        —
      </Btn>
    </div>
  )
}

// ── SVG icon helpers ──────────────────────────────────────────────────────────
const ALIGN_ICONS: Record<string, React.ReactNode> = {
  left:    <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor"><rect x="0" y="1" width="13" height="1.5" rx=".75"/><rect x="0" y="5" width="9"  height="1.5" rx=".75"/><rect x="0" y="9" width="11" height="1.5" rx=".75"/></svg>,
  center:  <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor"><rect x="0" y="1" width="13" height="1.5" rx=".75"/><rect x="2" y="5" width="9"  height="1.5" rx=".75"/><rect x="1" y="9" width="11" height="1.5" rx=".75"/></svg>,
  right:   <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor"><rect x="0" y="1" width="13" height="1.5" rx=".75"/><rect x="4" y="5" width="9"  height="1.5" rx=".75"/><rect x="2" y="9" width="11" height="1.5" rx=".75"/></svg>,
  justify: <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor"><rect x="0" y="1" width="13" height="1.5" rx=".75"/><rect x="0" y="5" width="13" height="1.5" rx=".75"/><rect x="0" y="9" width="13" height="1.5" rx=".75"/></svg>,
}

function BulletIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor">
      <circle cx="1.5" cy="2.5" r="1.2"/>
      <rect x="4" y="1.8" width="9" height="1.4" rx=".7"/>
      <circle cx="1.5" cy="6.5" r="1.2"/>
      <rect x="4" y="5.8" width="9" height="1.4" rx=".7"/>
      <circle cx="1.5" cy="10.5" r="1.2"/>
      <rect x="4" y="9.8" width="9" height="1.4" rx=".7"/>
    </svg>
  )
}

function OrderedIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor">
      <text x="0" y="4"  fontSize="4.5" fontFamily="monospace">1.</text>
      <rect x="5" y="1.8" width="8" height="1.4" rx=".7"/>
      <text x="0" y="8"  fontSize="4.5" fontFamily="monospace">2.</text>
      <rect x="5" y="5.8" width="8" height="1.4" rx=".7"/>
      <text x="0" y="12" fontSize="4.5" fontFamily="monospace">3.</text>
      <rect x="5" y="9.8" width="8" height="1.4" rx=".7"/>
    </svg>
  )
}

const selectStyle: React.CSSProperties = {
  background: 'rgba(15,20,35,0.7)',
  color: 'var(--text-secondary)',
  border: '1px solid rgba(180,190,220,0.15)',
  borderRadius: 5,
  padding: '3px 6px',
  fontSize: 12,
  cursor: 'pointer',
  outline: 'none',
}

// ── Main export ───────────────────────────────────────────────────────────────
interface BriefingEditorProps {
  content: string
  onChange: (html: string) => void
  readOnly?: boolean
  minHeight?: number
}

export default function BriefingEditor({ content, onChange, readOnly = false, minHeight = 480 }: BriefingEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      UnderlineExt,
      TextStyle,
      Color,
      FontFamily,
      FontSize,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: toHtml(content),
    editable: !readOnly,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: 'briefing-tiptap',
        style: `min-height: ${minHeight}px; padding: 20px 24px; outline: none;`,
      },
    },
  })

  // Sync content from outside (e.g. after Retry AI refreshes the page)
  useEffect(() => {
    if (!editor || editor.isFocused) return
    const html = toHtml(content)
    if (editor.getHTML() !== html) {
      editor.commands.setContent(html)
    }
  }, [content]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!editor) return null

  if (readOnly) {
    return (
      <div className="briefing-tiptap" style={{ padding: '20px 24px' }}>
        <EditorContent editor={editor} />
      </div>
    )
  }

  return (
    <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(180,190,220,0.18)', background: 'rgba(100,120,180,0.04)' }}>
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  )
}
