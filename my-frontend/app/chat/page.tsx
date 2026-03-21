'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChatContainer } from '@/components/chat/ChatContainer';

export default function ChatPage() {
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem("access_token") : null;
    if (!token) {
      router.push("/login");
    } else {
      setLoading(false);
    }
  }, [router]);

  if (loading) return <div className="flex h-screen items-center justify-center text-gray-500">Loading chat...</div>;

  return (
    <main className="min-h-screen bg-gray-50">
      <ChatContainer />
    </main>
  );
}
