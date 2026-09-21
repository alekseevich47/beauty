import { zodResolver } from '@hookform/resolvers/zod';
import { staffTotpSchema } from '@beauty/contracts';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import type { z } from 'zod';

import { useAuth } from '@/auth/AuthProvider';
import { Button, FieldError, Input, Label } from '@/components/ui';

const formSchema = staffTotpSchema.pick({ code: true });
type FormValues = z.infer<typeof formSchema>;

export function TotpPage() {
  const { isAuthenticated, verifyTotp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const challengeId = (location.state as { challengeId?: string } | null)?.challengeId;
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { code: '' },
  });

  if (isAuthenticated) return <Navigate to="/chat" replace />;
  if (!challengeId) return <Navigate to="/login" replace />;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await verifyTotp(challengeId, values.code);
      navigate('/chat', { replace: true });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Неверный код');
    }
  });

  return (
    <div className="flex min-h-full items-center justify-center bg-[radial-gradient(ellipse_at_top,_#152033_0%,_#0b0f14_55%)] p-6">
      <div className="w-full max-w-sm rounded border border-console-border bg-console-surface p-6 shadow-2xl">
        <div className="mb-6">
          <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-console-muted">
            2FA
          </div>
          <h1 className="mt-1 text-xl font-semibold text-console-text">Код TOTP</h1>
          <p className="mt-1 text-sm text-console-muted">
            Введите 6-значный код из приложения-аутентификатора.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div>
            <Label htmlFor="code">Код</Label>
            <Input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              className="font-mono tracking-[0.3em]"
              {...register('code')}
            />
            <FieldError message={errors.code?.message} />
          </div>

          {formError ? <p className="text-sm text-console-danger">{formError}</p> : null}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Проверка…' : 'Войти'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => navigate('/login')}
          >
            Назад
          </Button>
        </form>
      </div>
    </div>
  );
}
