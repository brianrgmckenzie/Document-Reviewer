import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  convertInchesToTwip,
} from 'docx'

function parseMarkdownToDocx(markdown: string): Paragraph[] {
  const lines = markdown.split('\n')
  const paragraphs: Paragraph[] = []

  for (const line of lines) {
    if (line.startsWith('# ')) {
      paragraphs.push(new Paragraph({
        text: line.slice(2),
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
      }))
    } else if (line.startsWith('## ')) {
      paragraphs.push(new Paragraph({
        text: line.slice(3),
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 360, after: 120 },
      }))
    } else if (line.startsWith('### ')) {
      paragraphs.push(new Paragraph({
        text: line.slice(4),
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 240, after: 80 },
      }))
    } else if (line.match(/^\d+\.\s/)) {
      paragraphs.push(new Paragraph({
        children: [new TextRun({ text: line, size: 24 })],
        indent: { left: convertInchesToTwip(0.3) },
        spacing: { before: 60, after: 60 },
      }))
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      paragraphs.push(new Paragraph({
        children: [new TextRun({ text: line.slice(2), size: 24 })],
        bullet: { level: 0 },
        spacing: { before: 40, after: 40 },
      }))
    } else if (line.startsWith('---')) {
      paragraphs.push(new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' } },
        spacing: { before: 200, after: 200 },
        children: [],
      }))
    } else if (line.startsWith('*') && line.endsWith('*') && line.length > 2) {
      paragraphs.push(new Paragraph({
        children: [new TextRun({ text: line.replace(/^\*|\*$/g, ''), italics: true, size: 18, color: '888888' })],
        spacing: { before: 80, after: 80 },
      }))
    } else if (line.trim() === '') {
      paragraphs.push(new Paragraph({ children: [], spacing: { before: 80 } }))
    } else {
      paragraphs.push(new Paragraph({
        children: [new TextRun({ text: line, size: 24 })],
        spacing: { before: 40, after: 40 },
        alignment: AlignmentType.JUSTIFIED,
      }))
    }
  }

  return paragraphs
}

export async function exportManuscriptToDocx(manuscript: string): Promise<Blob> {
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Calibri', size: 24 },
        },
      },
    },
    sections: [{
      properties: {
        page: {
          margin: {
            top: convertInchesToTwip(1),
            bottom: convertInchesToTwip(1),
            left: convertInchesToTwip(1.25),
            right: convertInchesToTwip(1.25),
          },
        },
      },
      children: parseMarkdownToDocx(manuscript),
    }],
  })

  return await Packer.toBlob(doc)
}
