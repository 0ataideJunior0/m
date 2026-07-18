import { MercadoPagoConfig } from 'mercadopago'

export const createMercadoPagoConfig = () => {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN || ''
  return new MercadoPagoConfig({ accessToken })
}
