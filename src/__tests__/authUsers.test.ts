import { describe, it, expect, vi } from 'vitest'
import { findAuthUserIdByEmail } from '../../api/_lib/authUsers'

const makeAdmin = (pages: Array<Array<{ id: string; email?: string }>>) => {
  const listUsers = vi.fn(async ({ page }: { page: number }) => ({
    data: { users: pages[page - 1] ?? [] },
    error: null,
  }))
  return { admin: { auth: { admin: { listUsers } } } as any, listUsers }
}

const fullPage = Array.from({ length: 1000 }, (_, i) => ({ id: `x${i}`, email: `x${i}@b.com` }))

describe('findAuthUserIdByEmail', () => {
  it('acha o usuário ignorando maiúsculas', async () => {
    const { admin } = makeAdmin([[{ id: 'u1', email: 'Ana@B.com' }]])
    expect(await findAuthUserIdByEmail(admin, ' ana@b.com ')).toBe('u1')
  })

  it('devolve null quando ninguém tem o e-mail', async () => {
    const { admin } = makeAdmin([[{ id: 'u1', email: 'ana@b.com' }]])
    expect(await findAuthUserIdByEmail(admin, 'outra@b.com')).toBeNull()
  })

  it('percorre as páginas seguintes quando a primeira está cheia', async () => {
    const { admin, listUsers } = makeAdmin([fullPage, [{ id: 'u2', email: 'ana@b.com' }]])
    expect(await findAuthUserIdByEmail(admin, 'ana@b.com')).toBe('u2')
    expect(listUsers).toHaveBeenCalledTimes(2)
  })

  it('propaga erro da API', async () => {
    const admin = { auth: { admin: { listUsers: async () => ({ data: null, error: new Error('x') }) } } } as any
    await expect(findAuthUserIdByEmail(admin, 'a@b.com')).rejects.toThrow('x')
  })
})
