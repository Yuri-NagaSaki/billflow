import { NotificationHistory } from '@/components/notification/NotificationHistory';

export function NotificationHistoryPage() {
  // Single user system - no need for user ID parameter
  // The backend will handle the single user context
  return (
    <NotificationHistory />
  );
}

export default NotificationHistoryPage;
