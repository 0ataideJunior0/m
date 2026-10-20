import { fitWithin } from './recipeFormat'

/** Reduz a foto pra no máximo `maxWidth` de largura e converte pra WebP, antes de subir. */
export const resizeToWebp = async (file: File, maxWidth = 1200): Promise<Blob> => {
  if (!file.type.startsWith('image/')) throw new Error('Arquivo não é uma imagem')

  const bitmap = await createImageBitmap(file)
  const { width, height } = fitWithin(bitmap.width, bitmap.height, maxWidth)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Não foi possível converter a imagem'))), 'image/webp', 0.85)
  })
}
