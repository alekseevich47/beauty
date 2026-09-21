import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { useAuth } from '@/auth/AuthProvider';
import { Badge, Button, EmptyState, Input, PageHeader, Panel, Spinner, cx } from '@/components/ui';
import { api } from '@/lib/api';

export function ChatPage() {
  const { user, can } = useAuth();
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const threadsQuery = useQuery({
    queryKey: ['chat-threads'],
    queryFn: () => api.threads(),
    enabled: can('chat.read'),
  });

  const activeThread = useMemo(
    () => threadsQuery.data?.find((t) => t.id === activeId) ?? threadsQuery.data?.[0] ?? null,
    [threadsQuery.data, activeId],
  );

  const messagesQuery = useQuery({
    queryKey: ['chat-messages', activeThread?.id],
    queryFn: () => api.messages(activeThread!.id),
    enabled: Boolean(activeThread?.id) && can('chat.read'),
  });

  const sendMutation = useMutation({
    mutationFn: (body: string) =>
      api.sendMessage(activeThread!.id, body, user?.displayName ?? 'Staff'),
    onSuccess: (msg) => {
      qc.setQueryData(['chat-messages', activeThread?.id], (prev: unknown) => {
        const list = Array.isArray(prev) ? prev : [];
        return [...list, msg];
      });
      setDraft('');
    },
  });

  if (!can('chat.read')) {
    return <EmptyState title="Нет доступа к чату" hint="Требуется permission chat.read" />;
  }

  return (
    <div className="flex h-[calc(100%-0.5rem)] min-h-[420px] flex-col">
      <PageHeader
        title="Чат поддержки"
        description="Диалоги с мастерами (Centrifugo в production)."
      />

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
        <Panel className="min-h-0 overflow-hidden" title="Диалоги" flush>
          <div className="max-h-[60vh] overflow-y-auto lg:max-h-none">
            {threadsQuery.isLoading ? (
              <div className="p-4">
                <Spinner />
              </div>
            ) : (
              (threadsQuery.data ?? []).map((t) => {
                const selected = t.id === activeThread?.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveId(t.id)}
                    className={cx(
                      'flex w-full flex-col gap-1 border-b border-console-border px-4 py-3 text-left transition-colors',
                      selected ? 'bg-console-raised' : 'hover:bg-console-raised/50',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-console-text">
                        {t.masterName}
                      </span>
                      {t.unread > 0 ? <Badge tone="info">{t.unread}</Badge> : null}
                    </div>
                    <span className="truncate text-xs text-console-muted">{t.lastMessage}</span>
                  </button>
                );
              })
            )}
          </div>
        </Panel>

        <Panel
          className="flex min-h-0 flex-col"
          title={activeThread?.masterName ?? 'Выберите диалог'}
        >
          {!activeThread ? (
            <EmptyState title="Нет активного диалога" />
          ) : (
            <>
              <div className="-mx-4 -mt-4 mb-4 max-h-[48vh] flex-1 space-y-3 overflow-y-auto border-b border-console-border px-4 py-4">
                {messagesQuery.isLoading ? (
                  <Spinner />
                ) : (
                  (messagesQuery.data ?? []).map((m) => (
                    <div
                      key={m.id}
                      className={cx(
                        'max-w-[85%] rounded px-3 py-2 text-sm',
                        m.author === 'staff'
                          ? 'ml-auto bg-console-accent/20 text-console-text'
                          : 'bg-console-raised text-console-text',
                      )}
                    >
                      <div className="mb-1 text-[11px] text-console-muted">
                        {m.authorName} · {new Date(m.createdAt).toLocaleString('ru-RU')}
                      </div>
                      {m.body}
                    </div>
                  ))
                )}
              </div>
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const body = draft.trim();
                  if (!body || !can('chat.write')) return;
                  sendMutation.mutate(body);
                }}
              >
                <Input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={can('chat.write') ? 'Ответ мастеру…' : 'Нет права на запись'}
                  disabled={!can('chat.write') || sendMutation.isPending}
                />
                <Button
                  type="submit"
                  disabled={!can('chat.write') || sendMutation.isPending || !draft.trim()}
                >
                  Отправить
                </Button>
              </form>
            </>
          )}
        </Panel>
      </div>
    </div>
  );
}
