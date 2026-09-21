import { AnimatePresence, motion } from 'framer-motion';
import { motionPresets } from '@beauty/ui';
import type { ReactNode } from 'react';
import { BottomNav } from './BottomNav';
import { Header } from './Header';
import { useAppStore } from '../../store/useAppStore';
import { AiLongPressBar } from '../AiLongPress';

type Props = {
  children: ReactNode;
  showClientAvatar?: boolean;
};

export function AppShell({ children, showClientAvatar = true }: Props) {
  const role = useAppStore((s) => s.role);
  const tab = useAppStore((s) => s.tab);
  const setTab = useAppStore((s) => s.setTab);
  const aiOpen = useAppStore((s) => s.aiOpen);

  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-col">
      <Header
        showAvatar={role === 'client' && showClientAvatar}
        onAvatarClick={() => setTab('profile')}
      />
      <main className="safe-pb flex-1 overflow-x-hidden px-4">
        <AnimatePresence mode="wait">
          <motion.div key={`${role}-${tab}`} {...motionPresets.tabSwap}>
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
      <AnimatePresence>{aiOpen && role === 'master' ? <AiLongPressBar /> : null}</AnimatePresence>
      <BottomNav />
    </div>
  );
}
