import { describe, expect, it, vi } from 'vitest'

vi.stubEnv('VITE_SUPABASE_URL', 'https://proj.supabase.co')
const { photoUrl, isStoragePhoto } = await import('./photos')

describe('photoUrl', () => {
  it('resolves a bundled key to the local image', () => {
    expect(photoUrl('pasta')).toMatch(/images\/pasta\.jpg$/)
    expect(isStoragePhoto('pasta')).toBe(false)
  })

  it('resolves a Storage path to the public bucket URL', () => {
    expect(photoUrl('user-1/abc.jpg')).toBe('https://proj.supabase.co/storage/v1/object/public/recipe-photos/user-1/abc.jpg')
    expect(isStoragePhoto('user-1/abc.jpg')).toBe(true)
  })

  it('treats empty values as not stored', () => {
    expect(isStoragePhoto(null)).toBe(false)
  })
})
