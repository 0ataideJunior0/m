import { describe, it, expect } from 'vitest'
import config from '../../tailwind.config'

describe('Animations config', () => {
  it('includes required keyframes', () => {
    const kf = (config as any).theme.extend.keyframes
    expect(kf.fadeIn).toBeDefined()
    expect(kf.fadeOut).toBeDefined()
    expect(kf.slideUp).toBeDefined()
    expect(kf.slideDown).toBeDefined()
    expect(kf.pageIn).toBeDefined()
    expect(kf.pageOut).toBeDefined()
  })

  it('includes required animations', () => {
    const anim = (config as any).theme.extend.animation
    expect(anim['fade-in']).toBeDefined()
    expect(anim['fade-out']).toBeDefined()
    expect(anim['slide-up']).toBeDefined()
    expect(anim['slide-down']).toBeDefined()
    expect(anim['page-in']).toBeDefined()
    expect(anim['page-out']).toBeDefined()
  })
})

