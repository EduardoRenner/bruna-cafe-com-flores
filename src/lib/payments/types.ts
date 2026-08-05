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
  /**
   * Forma escolhida no checkout: 'pix' | 'cartao' | 'boleto'.
   *
   * O gateway abre só o meio correspondente. Sem isto o cliente escolhe
   * "Pix" no site e cai numa tela pedindo cartão — e desiste.
   */
  paymentMethod: string;
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
  /**
   * Procura o pagamento pela NOSSA referência (o `payments.id`).
   *
   * Existe porque o webhook não é confiável o bastante para ser o único
   * caminho: ele pode não chegar (URL errada, notificação perdida) ou chegar e
   * ser descartado (assinatura inválida). Sem isto, um pagamento aprovado de
   * verdade ficaria pendente para sempre, sem ninguém perceber.
   *
   * Devolve `null` quando o gateway não conhece nenhum pagamento para a
   * referência — o caso normal de quem abriu o checkout e não pagou.
   */
  findPaymentByReference(externalReference: string): Promise<GatewayPayment | null>;
  /** Confere a assinatura do webhook. Retorna false para qualquer dúvida. */
  verifyWebhookSignature(args: {
    signatureHeader: string | null;
    requestId: string | null;
    dataId: string | null;
    /**
     * Segundo candidato para o id do manifesto.
     *
     * O Mercado Pago manda `data.id` no corpo e na query, e nem sempre com o
     * mesmo valor (notificação de pagamento e de merchant_order chegam com
     * ids distintos). Como a documentação não diz qual deles entra no
     * manifesto assinado, tentamos os dois.
     *
     * Não afrouxa a segurança: quem não tem o segredo não produz HMAC válido
     * para id nenhum, e o pagamento é reconsultado na API do gateway depois.
     */
    dataIdAlternativo?: string | null;
  }): boolean;
}
