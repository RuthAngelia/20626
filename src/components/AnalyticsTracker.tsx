import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { trackPageView } from '@/lib/analytics';

// Sends a GA4 page_view on every route change. Rendered inside <BrowserRouter>.
export default function AnalyticsTracker() {
  const location = useLocation();
  const {} = useTranslation();

  useEffect(() => {
    trackPageView(location.pathname + location.search);
  }, [location.pathname, location.search]);

  return null;
}
