ALTER TABLE public.products ADD COLUMN IF NOT EXISTS display_order integer NOT NULL DEFAULT 0;

WITH ordered AS (
  SELECT id, (row_number() OVER (ORDER BY created_at ASC))::int AS rn
  FROM public.products
)
UPDATE public.products p SET display_order = o.rn FROM ordered o WHERE p.id = o.id;

CREATE INDEX IF NOT EXISTS products_display_order_idx ON public.products (display_order);