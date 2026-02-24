import AppAuthGate from './_components/AppAuthGate';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppAuthGate>{children}</AppAuthGate>;
}
