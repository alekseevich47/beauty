import { zodResolver } from '@hookform/resolvers/zod';
import { staffLoginSchema } from '@beauty/contracts';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useNavigate } from 'react-router-dom';
import type { z } from 'zod';

import { useAuth } from '@/auth/AuthProvider';
import { Button, FieldError, Input, Label } from '@/components/ui';
import { isDemoMode } from '@/lib/demo';

const formSchema = staffLoginSchema;
type FormValues = z.infer<typeof formSchema>;

export function LoginPage() {
  const { isAuthenticated, isLoading, login } = useAuth();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: isDemoMode() ? 'admin@beauty.local' : '',
      password: isDemoMode() ? 'password123' : '',
    },
  });

  if (!isLoading && isAuthenticated) {
    return <Navigate to="/chat" replace />;
  }

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const challenge = await login(values.email, values.password);
      navigate('/totp', { state: { challengeId: challenge.challengeId } });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Ошибка входа');
    }
  });

  return (
    <div className="flex min-h-full items-center justify-center bg-[radial-gradient(ellipse_at_top,_#152033_0%,_#0b0f14_55%)] p-6">
      <div className="w-full max-w-sm rounded border border-console-border bg-console-surface p-6 shadow-2xl">
        <div className="mb-6">
          <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-console-muted">
            Beauty+
          </div>
          <h1 className="mt-1 text-xl font-semibold text-console-text">Staff sign-in</h1>
          <p className="mt-1 text-sm text-console-muted">
            Email и пароль, затем обязательный TOTP. Telegram / MAX не используются.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="username" {...register('email')} />
            <FieldError message={errors.email?.message} />
          </div>
          <div>
            <Label htmlFor="password">Пароль</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              {...register('password')}
            />
            <FieldError message={errors.password?.message} />
          </div>

          {formError ? <p className="text-sm text-console-danger">{formError}</p> : null}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Проверка…' : 'Продолжить'}
          </Button>
        </form>
      </div>
    </div>
  );
}
