import AppShell from '@/components/AppShell';

export default function MessagesPage() {
  return (
    <AppShell>
      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="bg-white border border-stone-200 rounded-2xl shadow-sm px-10 py-12 max-w-sm w-full text-center space-y-3">
          <p className="font-serif font-black text-xl text-neutral-900">Messages</p>
          <p className="text-sm text-stone-500 leading-relaxed">
            Direct messaging is coming in the next version.<br />
            For now, start a voice or video session with your partner.
          </p>
        </div>
      </main>
    </AppShell>
  );
}
