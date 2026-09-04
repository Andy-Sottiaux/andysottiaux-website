import createSocialImage from './opengraph-image'

export const alt = 'Andy Sottiaux, engineer and founder. I build across the boundaries.'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return createSocialImage()
}
