-- Bucket privado para os PDFs de pedido, mesmo padrão da Bem Me Quer
-- (floricultura-bem-me-quer, 20260802150000). O PDF carrega endereço e
-- telefone do cliente, então nunca fica público — só service role acessa,
-- e o cliente/entregador recebe uma signed URL de curta duração.
insert into storage.buckets (id, name, public)
values ('order-pdfs', 'order-pdfs', false)
on conflict (id) do nothing;

-- Nenhuma policy de leitura/escrita pública é criada de propósito.
