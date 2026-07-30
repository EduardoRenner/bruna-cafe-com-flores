// Tipos compartilhados da camada de pagamento.
//
// Este arquivo NÃO é `.server.ts` de propósito: só tem tipos e rótulos, nada de
// segredo, então pode ser importado pela interface sem risco.

/** Status interno. O adaptador de cada gateway traduz o vocabulário dele para cá. */
export type PaymentStatus =
  | "iniciado"
  | "pago"
  | "recusado"
  | "estornado"
  | "cancelado"
  | "expirado"
  /** Gateway confirmou valor diferente do pedido. Exige conferência humana. */
  | "divergente";

export const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  iniciado: "Aguardando pagamento",
  pago: "Pago",
  recusado: "Recusado",
  estornado: "Estornado",
  cancelado: "Cancelado",
  expirado: "Expirado",
  divergente: "Valor divergente — conferir",
};

/** O que o gateway devolve quando consultamos um pagamento. */
export type GatewayPayment = {
  providerPaymentId: string;
  status: PaymentStatus;
  /** Em centavos. Conferido contra o valor do pedido antes de dar por pago. */
  amountCents: number;
  /** Nosso `payments.id`, que mandamos ao gateway como referência externa. */
  externalReference: string | null;
  method: string | null;
  statusDetail: string | null;
};

/** Checkout criado no gateway, pronto para o cliente ser redirecionado. */
export type CheckoutSession = {
  providerPreferenceId: string;
  /** URL hospedada pelo gateway. O cartão é digitado lá, nunca aqui. */
  redirectUrl: string;
};

export type CreateCheckoutInput = {
  /** Nosso payments.id — vira a referência externa no gateway. */
  paymentId: string;
  orderNumber: string;
  amountCents: number;
  description: string;
  payer: { name: string; email: string | null };
  /** Para onde o gateway devolve o cliente depois de pagar. */
  returnUrl: string;
  /** Onde o gateway avisa o resultado, servidor a servidor. */
  notificationUrl: string;
};

/**
 * Contrato que qualquer gateway precisa cumprir.
 *
 * Existe para que trocar de gateway signifique escrever um arquivo novo, e não
 * mexer no fluxo de pedido — a regra de negócio (valor vem do banco, webhook é
 * conferido, confirmação é atômica) fica fora do adaptador.
 */
export interface PaymentProvider {
  readonly name: string;
  createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession>;
  /**
   * Consulta o pagamento direto na API do gateway.
   *
   * O corpo do webhook não é fonte de verdade: quem avisa pode ser qualquer um
   * que descubra a URL. Só o que a API confirma vale.
   */
  fetchPayment(providerPaymentId: string): Promise<GatewayPayment>;
  /** Confere a assinatura do webhook. Retorna false para qualquer dúvida. */
  verifyWebhookSignature(args: {
    signatureHeader: string | null;
    requestId: string | null;
    dataId: string | null;
  }): boolean;
}
