-- Cancelar não deve cortar o acesso na hora se o período já pago ainda não
-- acabou. O Mercado Pago não zera next_payment_date quando a assinatura
-- é cancelada -- só para de cobrar depois dessa data -- então dá pra usar
-- o próprio campo como fim do período de graça.
CREATE OR REPLACE FUNCTION public.has_active_subscription()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = auth.uid()
      AND (
        (status = 'authorized' AND (next_payment_date IS NULL OR next_payment_date > NOW() - INTERVAL '3 days'))
        OR (status = 'cancelled' AND next_payment_date IS NOT NULL AND next_payment_date > NOW())
      )
  );
$$;
