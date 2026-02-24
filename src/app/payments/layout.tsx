import PaymentsGate from './_components/PaymentsGate';

export default function PaymentsLayout({ children }: { children: React.ReactNode }) {
  return <PaymentsGate>{children}</PaymentsGate>;
}
