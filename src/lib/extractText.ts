import PDFParser from 'pdf2json'
import mammoth from 'mammoth'

export async function extractTextFromBuffer(buffer: Buffer, fileName: string): Promise<string> {
  const ext = fileName.split('.').pop()?.toLowerCase()

  if (ext === 'pdf') {
    return new Promise((resolve) => {
      const pdfParser = new (PDFParser as any)(null, 1)

      pdfParser.on('pdfParser_dataError', () => {
        resolve(fileName)
      })

      pdfParser.on('pdfParser_dataReady', () => {
        try {
          const text = (pdfParser as { getRawTextContent: () => string }).getRawTextContent()
          const cleaned = text
            .replace(/\r\n|\r/g, '\n')
            .replace(/\n{3,}/g, '\n\n')
            .trim()
          resolve(cleaned || fileName)
        } catch {
          resolve(fileName)
        }
      })

      pdfParser.parseBuffer(buffer)
    })
  }

  if (ext === 'docx' || ext === 'doc') {
    try {
      const result = await mammoth.extractRawText({ buffer })
      const cleaned = result.value.replace(/\r\n|\r/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
      return cleaned || fileName
    } catch {
      return fileName
    }
  }

  // Plain text / CSV / other
  try {
    return buffer.toString('utf-8')
  } catch {
    return fileName
  }
}
