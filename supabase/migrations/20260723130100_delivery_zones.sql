-- =============================================================================
-- Frete por bairro — tabela de zonas de entrega gerida no admin.
-- Cada bairro ativo tem um valor de frete próprio. O checkout monta o
-- dropdown de bairros a partir das zonas ativas e usa o `fee` da zona escolhida.
-- =============================================================================
CREATE TABLE public.delivery_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bairro TEXT NOT NULL UNIQUE,
  fee NUMERIC(10,2) NOT NULL CHECK (fee >= 0),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.delivery_zones TO anon, authenticated;
GRANT ALL ON public.delivery_zones TO service_role;
ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;

-- Bairros ativos são públicos (o checkout precisa listá-los)
CREATE POLICY "Public can view active delivery zones"
  ON public.delivery_zones FOR SELECT USING (active = true);

CREATE TRIGGER trg_delivery_zones_updated
  BEFORE UPDATE ON public.delivery_zones
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed padrão: Maravilha e região a R$ 10,00 (valor atual da loja).
-- Adicione os demais bairros pelo admin → Configurações.
INSERT INTO public.delivery_zones (bairro, fee, active) VALUES
  ('Maravilha e região', 10.00, true)
ON CONFLICT (bairro) DO NOTHING;
