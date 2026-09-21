import { usePlatform } from './platform/PlatformProvider';
import { AppShell } from './components/layout/AppShell';
import { useAppStore } from './store/useAppStore';
import { AppointmentsScreen } from './screens/AppointmentsScreen';
import { FavoritesScreen } from './screens/FavoritesScreen';
import { FeedScreen } from './screens/FeedScreen';
import { MasterHomeScreen } from './screens/MasterHomeScreen';
import { MoreScreen } from './screens/MoreScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { ScheduleScreen } from './screens/ScheduleScreen';

export default function App() {
  const { ready } = usePlatform();
  const role = useAppStore((s) => s.role);
  const tab = useAppStore((s) => s.tab);

  if (!ready) {
    return (
      <div className="grid min-h-full place-items-center text-sm text-[var(--bp-muted)]">
        Beauty+
      </div>
    );
  }

  let screen = null;
  if (role === 'client') {
    switch (tab) {
      case 'appointments':
        screen = <AppointmentsScreen />;
        break;
      case 'favorites':
        screen = <FavoritesScreen />;
        break;
      case 'profile':
        screen = <ProfileScreen />;
        break;
      case 'bplus':
      default:
        screen = <FeedScreen />;
        break;
    }
  } else {
    switch (tab) {
      case 'feed':
        screen = <FeedScreen />;
        break;
      case 'schedule':
        screen = <ScheduleScreen />;
        break;
      case 'profile':
        screen = <ProfileScreen />;
        break;
      case 'more':
        screen = <MoreScreen />;
        break;
      case 'bplus':
      default:
        screen = <MasterHomeScreen />;
        break;
    }
  }

  return <AppShell showClientAvatar={role === 'client'}>{screen}</AppShell>;
}
