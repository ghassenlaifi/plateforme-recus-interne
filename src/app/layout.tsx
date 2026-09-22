import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/Toast";
import { WelcomeModal } from "@/components/WelcomeModal";

export const metadata: Metadata = {
  title: "RECEIPT Management",
  description: "Plateforme de gestion des reçus",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="antialiased font-sans overflow-y-scroll">
      <body className="flex flex-col min-h-[100dvh]">
        <ToastProvider>
          <WelcomeModal />
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
