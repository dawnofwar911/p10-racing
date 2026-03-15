import { 
  Trophy, 
  Home, 
  Users, 
  LayoutGrid, 
  BarChart3,
  History
} from 'lucide-react';

export const NAV_ITEMS = [
  { label: 'Home', href: '/', icon: Home },
  { label: 'Predict', href: '/predict', icon: LayoutGrid },
  { label: 'Leagues', href: '/leagues', icon: Users },
  { label: 'Leaderboard', href: '/leaderboard', icon: Trophy },
  { label: 'Standings', href: '/standings', icon: BarChart3 },
  { label: 'History', href: '/history', icon: History },
];
