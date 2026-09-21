import { Button } from '@beauty/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const bookFormSchema = z.object({
  serviceId: z.string().min(1),
  masterId: z.string().min(1),
  startsAt: z.string().datetime(),
  note: z.string().max(500).optional(),
  clientName: z.string().min(2).max(80),
  phone: z.string().min(10).max(20),
});

type BookFormValues = z.infer<typeof bookFormSchema>;

type Props = {
  serviceId: string;
  masterId: string;
  serviceTitle: string;
  onClose: () => void;
  onBooked?: (data: BookFormValues) => void;
};

export function BookForm({ serviceId, masterId, serviceTitle, onClose, onBooked }: Props) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<BookFormValues>({
    resolver: zodResolver(bookFormSchema),
    defaultValues: {
      serviceId,
      masterId,
      startsAt: new Date(Date.now() + 86400_000).toISOString(),
      note: '',
      clientName: '',
      phone: '',
    },
  });

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/55 p-3 backdrop-blur-sm sm:place-items-center">
      <form
        onSubmit={handleSubmit((data) => {
          onBooked?.(data);
          onClose();
        })}
        className="w-full max-w-md space-y-3 rounded-[var(--bp-radius)] border border-[var(--bp-surface-2)] bg-[var(--bp-surface)] p-4"
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-display text-lg font-semibold">Запись</h3>
            <p className="text-sm text-[var(--bp-muted)]">{serviceTitle}</p>
          </div>
          <button type="button" onClick={onClose} className="text-[var(--bp-muted)]">
            ×
          </button>
        </div>

        <label className="block space-y-1 text-sm">
          <span>Имя</span>
          <input
            {...register('clientName')}
            className="w-full rounded-xl border border-[var(--bp-surface-2)] bg-[var(--bp-bg)] px-3 py-2 outline-none focus:ring-1 focus:ring-[var(--bp-accent)]"
          />
          {errors.clientName && (
            <span className="text-xs text-[var(--bp-danger)]">{errors.clientName.message}</span>
          )}
        </label>

        <label className="block space-y-1 text-sm">
          <span>Телефон</span>
          <input
            {...register('phone')}
            className="w-full rounded-xl border border-[var(--bp-surface-2)] bg-[var(--bp-bg)] px-3 py-2 outline-none focus:ring-1 focus:ring-[var(--bp-accent)]"
          />
          {errors.phone && (
            <span className="text-xs text-[var(--bp-danger)]">{errors.phone.message}</span>
          )}
        </label>

        <label className="block space-y-1 text-sm">
          <span>Комментарий</span>
          <textarea
            {...register('note')}
            rows={2}
            className="w-full rounded-xl border border-[var(--bp-surface-2)] bg-[var(--bp-bg)] px-3 py-2 outline-none focus:ring-1 focus:ring-[var(--bp-accent)]"
          />
        </label>

        <input type="hidden" {...register('serviceId')} />
        <input type="hidden" {...register('masterId')} />
        <input type="hidden" {...register('startsAt')} />

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          Подтвердить
        </Button>
      </form>
    </div>
  );
}
