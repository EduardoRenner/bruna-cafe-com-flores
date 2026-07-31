CREATE POLICY "Deny public select order_rate_limit" ON public.order_rate_limit FOR SELECT TO anon, authenticated USING (false);
CREATE POLICY "Deny public insert order_rate_limit" ON public.order_rate_limit FOR INSERT TO anon, authenticated WITH CHECK (false);
CREATE POLICY "Deny public update order_rate_limit" ON public.order_rate_limit FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "Deny public delete order_rate_limit" ON public.order_rate_limit FOR DELETE TO anon, authenticated USING (false);