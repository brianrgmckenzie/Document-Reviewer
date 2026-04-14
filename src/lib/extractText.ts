import PDFParser from 'pdf2json'

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
          const text = (pdfParser as any).getRawTextContent()
          const cleaned = text
            .replace(/\r\n|\r/g, '\n')
            .replace(/\n{3,}/g, '\n\n')
            .trim()
          console.log(`PDF extracted ${cleaned.length} characters from ${fileName}`)
          resolve(cleaned || fileName)
        } catch {
          resolve(fileName)
        }
      })

      pdfParser.parseBuffer(buffer)
    })
  }

  // Plain text files
  try {
    return buffer.toString('utf-8')
  } catch {
    return fileName
  }
}
