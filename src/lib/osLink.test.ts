import { describe, expect, it } from 'vitest'
import { osSagUrl } from './osLink'

describe('osSagUrl', () => {
  it('peger på sagen i SMU OS ud fra app-kataloget', () => {
    expect(osSagUrl('0b6c1f2e-1111-4222-8333-944455556666')).toBe('https://os.smu.signmeup.dk/sager/0b6c1f2e-1111-4222-8333-944455556666')
  })
  it('koder id’et, så en mærkelig værdi ikke kan ændre stien', () => {
    expect(osSagUrl('a/b?c')).toBe('https://os.smu.signmeup.dk/sager/a%2Fb%3Fc')
  })
})
