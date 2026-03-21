import TopNav, { BottomNav } from './Sidebar';

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <TopNav />
      <div className="flex-1 flex flex-col min-w-0 pb-20 md:pb-0">
        {children}
      </div>
      <BottomNav />
    </div>
  );
}
