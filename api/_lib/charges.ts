/**
 * Criação das cobranças no Mercado Pago, compartilhada pelas rotas logadas
 * (create-pix-payment, create-card-payment) e pelo checkout aberto (checkout).
 * O valor e a referência chegam prontos: quem chama decide de quem é o
 * pagamento; aqui só se fala com o Mercado Pago.
 */
import { randomUUID } from 'node:crypto'
import { Payment, Preference } from 'mercadopago'
import { createMercadoPagoConfig } from './mercadopagoConfig.js'

/** Máximo de parcelas oferecido no cartão (juros padrão do MP, pagos por quem compra). */
export const MAX_CARD_INSTALLMENTS = 12

/** O Mercado Pago respondeu, mas sem o que precisamos para continuar a compra. */
export class ChargeResponseError extends Error {}

const accessLabel = (months: number) => `MusaFit - Acesso por ${months} ${months === 1 ? 'mês' : 'meses'}`

export interface PixChargeInput {
  amount: number
  months: number
  email: string
  externalReference: string
  notificationUrl: string
}

export interface PixCharge {
  payment_id: string
  qr_code: string
  qr_code_base64?: string
  ticket_url?: string
}

export async function createPixCharge(o: PixChargeInput): Promise<PixCharge> {
  const payment = new Payment(createMercadoPagoConfig())
  const result = await payment.create({
    body: {
      transaction_amount: o.amount,
      description: accessLabel(o.months),
      payment_method_id: 'pix',
      payer: { email: o.email },
      // O webhook lê daqui de quem é o pagamento e quantos meses creditar.
      // Vai pelo Mercado Pago em vez de por uma linha nossa para não haver
      // corrida: a notificação pode chegar antes de um INSERT nosso commitar.
      external_reference: o.externalReference,
      notification_url: o.notificationUrl,
    },
    requestOptions: { idempotencyKey: randomUUID() },
  })

  const tx = result.point_of_interaction?.transaction_data
  if (!tx?.qr_code) {
    console.error('createPixCharge: resposta sem QR Code', { paymentId: result.id, status: result.status })
    throw new ChargeResponseError('Resposta do Mercado Pago sem QR Code')
  }

  return {
    payment_id: String(result.id),
    qr_code: tx.qr_code,
    qr_code_base64: tx.qr_code_base64,
    ticket_url: tx.ticket_url,
  }
}

export interface CardCheckoutInput {
  amount: number
  months: number
  email: string
  externalReference: string
  notificationUrl: string
  backUrl: string
}

/** Pagamento único parcelado no cartão, pelo Checkout Pro (a aluna digita o cartão no Mercado Pago). */
export async function createCardCheckout(o: CardCheckoutInput): Promise<{ init_point: string }> {
  const preference = new Preference(createMercadoPagoConfig())
  const result = await preference.create({
    body: {
      items: [
        {
          id: `acesso-${o.months}m`,
          title: accessLabel(o.months),
          quantity: 1,
          unit_price: o.amount,
          currency_id: 'BRL',
        },
      ],
      payer: { email: o.email },
      payment_methods: {
        installments: MAX_CARD_INSTALLMENTS,
        excluded_payment_types: [{ id: 'ticket' }],
      },
      back_urls: { success: o.backUrl, pending: o.backUrl, failure: o.backUrl },
      auto_return: 'approved',
      external_reference: o.externalReference,
      notification_url: o.notificationUrl,
    },
  })

  if (!result.init_point) {
    console.error('createCardCheckout: resposta sem init_point', { preferenceId: result.id })
    throw new ChargeResponseError('Resposta do Mercado Pago sem init_point')
  }
  return { init_point: result.init_point }
}

/** Origem pública da requisição, igual às rotas existentes (http só em localhost). */
export function requestOrigin(headers: Record<string, string | string[] | undefined>): string {
  const host = (headers['x-forwarded-host'] as string) || (headers.host as string) || ''
  const protocol = host.includes('localhost') ? 'http' : 'https'
  return `${protocol}://${host}`
}
