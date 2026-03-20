import AppShell from '@/components/AppShell';

export default function MessagesPage() {
  return (
    <AppShell>
      <main className="flex-1 px-6 py-10 max-w-2xl mx-auto w-full">
        <h1 className="font-serif font-black text-2xl text-neutral-900 mb-6">Messages</h1>
        <p className="text-sm text-stone-500 leading-relaxed">
          Direct messaging is coming in the next version.<br />
          For now, start a voice or video session with your partner.
        </p>
      </main>
    </AppShell>
  );
}
