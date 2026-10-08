import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/Toast";
import { WelcomeModal } from "@/components/WelcomeModal";
import { GlobalInputGuard } from "@/components/GlobalInputGuard";
import { GlobalWhipListener } from "@/components/GlobalWhipListener";

export const metadata: Metadata = {
  title: "Elios Workspace",
  description: "Plateforme centralisée Elios Workspace - Reçus, CRM, Séances, Tâches et Trésorerie",
  icons: {
    icon: "/LogoCircle.png",
    apple: "/LogoCircle.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className="antialiased">
      <body className="flex flex-col min-h-[100dvh] relative bg-[var(--bg)] text-[var(--ink)]">
        <ToastProvider>
          <GlobalInputGuard />
          <WelcomeModal />
          <GlobalWhipListener />
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
