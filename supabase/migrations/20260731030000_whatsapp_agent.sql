-- =============================================================================
-- Agente de WhatsApp — memória de conversa.
--
-- Uma linha por telefone (não por mensagem): a conversa inteira mora num JSON
-- (histórico curto, só o necessário pro modelo manter contexto). Simples de
-- limpar/expirar, e evita centenas de linhas por cliente. Mesmo padrão de
-- isolamento das outras tabelas sensíveis: RLS fecha tudo pra anon/authenticated,
-- só o service_role (usado pelo webhook do WhatsApp) mexe aqui.
-- =============================================================================
CREATE TABLE public.whatsapp_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL UNIQUE,
  -- Histórico curto: array de {role, content, at}. Truncado no código para não
  -- crescer sem limite (ver MAX_HISTORICO em agent.server.ts).
  history JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Rascunho do pedido em andamento (itens escolhidos, endereço, etc.) — assim
  -- "quero flores" -> "até R$200" -> "adiciona um chocolate" vira um pedido só.
  draft_order JSONB,
  -- Enquanto true, o agente não responde: a Bruna assumiu a conversa manualmente
  -- (recurso simples de handoff, sem precisar de inbox dedicado agora).
  human_takeover BOOLEAN NOT NULL DEFAULT false,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_whatsapp_conversations_last_message ON public.whatsapp_conversations (last_message_at DESC);

CREATE TRIGGER trg_whatsapp_conversations_updated
  BEFORE UPDATE ON public.whatsapp_conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.whatsapp_conversations FROM anon, authenticated;
GRANT ALL ON public.whatsapp_conversations TO service_role;

CREATE POLICY "Deny public select whatsapp_conversations" ON public.whatsapp_conversations
  FOR SELECT TO anon, authenticated USING (false);
CREATE POLICY "Deny public insert whatsapp_conversations" ON public.whatsapp_conversations
  FOR INSERT TO anon, authenticated WITH CHECK (false);
CREATE POLICY "Deny public update whatsapp_conversations" ON public.whatsapp_conversations
  FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "Deny public delete whatsapp_conversations" ON public.whatsapp_conversations
  FOR DELETE TO anon, authenticated USING (false);

-- ----------------------------------------------------------------------------
-- Idempotência das mensagens recebidas — o WhatsApp reenvia webhook se não
-- receber 200 rápido o suficiente; sem isso o agente responderia duas vezes.
-- ----------------------------------------------------------------------------
CREATE TABLE public.whatsapp_message_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  message_id TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_whatsapp_message_events_received ON public.whatsapp_message_events (received_at DESC);

ALTER TABLE public.whatsapp_message_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.whatsapp_message_events FROM anon, authenticated;
GRANT ALL ON public.whatsapp_message_events TO service_role;

CREATE POLICY "Deny public select whatsapp_message_events" ON public.whatsapp_message_events
  FOR SELECT TO anon, authenticated USING (false);
CREATE POLICY "Deny public insert whatsapp_message_events" ON public.whatsapp_message_events
  FOR INSERT TO anon, authenticated WITH CHECK (false);
CREATE POLICY "Deny public update whatsapp_message_events" ON public.whatsapp_message_events
  FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "Deny public delete whatsapp_message_events" ON public.whatsapp_message_events
  FOR DELETE TO anon, authenticated USING (false);

-- ----------------------------------------------------------------------------
-- Rate limit por telefone — reaproveitando o mesmo padrão do checkout, mas
-- por número de telefone em vez de IP (o remetente aqui é sempre o servidor
-- da Meta; o telefone do cliente é o identificador real de abuso).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_whatsapp_rate_limit(_phone text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  window_start timestamptz := now() - interval '2 minutes';
  recent_count int;
  max_msgs int := 12;
BEGIN
  DELETE FROM public.whatsapp_message_events WHERE received_at < now() - interval '1 hour';

  SELECT count(*) INTO recent_count
    FROM public.whatsapp_message_events
    WHERE phone = _phone AND received_at >= window_start;

  RETURN recent_count < max_msgs;
END;
$$;

REVOKE ALL ON FUNCTION public.check_whatsapp_rate_limit(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_whatsapp_rate_limit(text) TO service_role;

-- Mesmo endurecimento de precaução aplicado às tabelas mais antigas
-- (20260731020000): remove privilégios que a chave pública nunca usa, mesmo
-- a RLS já bloqueando o uso real deles.
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.whatsapp_conversations FROM anon, authenticated;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.whatsapp_message_events FROM anon, authenticated;
