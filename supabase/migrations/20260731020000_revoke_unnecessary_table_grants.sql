-- =============================================================================
-- Endurecimento de precaução: remove privilégios de tabela que a chave pública
-- nunca deveria ter, mesmo que a RLS já bloqueie o uso real deles.
--
-- Achado em auditoria (2026-07-31): orders, products, settings e
-- delivery_zones concediam TRUNCATE, REFERENCES e TRIGGER para anon e
-- authenticated — resquício do GRANT amplo que o próprio Supabase aplica por
-- padrão em todo schema public (a peça de segurança real sempre foi a RLS,
-- não esses grants). Confirmado que isso NÃO é explorável pela API pública
-- hoje: PostgREST não expõe verbo HTTP para TRUNCATE, e exige DELETE/UPDATE
-- com WHERE (não dá para apagar/truncar tudo por essa via). TRUNCATE também
-- não é filtrado por RLS — é a única operação DML que escapa desse modelo —
-- então é só alcançável com uma conexão Postgres direta (senha do banco), que
-- a chave pública não fornece.
--
-- Removendo mesmo assim: princípio de menor privilégio. Reduz o estrago se um
-- dia existir um caminho hoje impensado (uma função futura rodando SQL
-- dinâmico, uma credencial de banco vazando parcialmente) que consiga usar
-- essas permissões. GRANT INSERT/UPDATE/DELETE permanece — são cobertos pela
-- RLS, que já é a barreira testada e funcionando.
-- =============================================================================
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.orders FROM anon, authenticated;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.products FROM anon, authenticated;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.settings FROM anon, authenticated;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.delivery_zones FROM anon, authenticated;
