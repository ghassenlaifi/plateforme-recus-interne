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
      <body className="flex flex-col min-h-[100dvh] bg-slate-50 relative">
                        <ToastProvider>
          {/* Ambient Background Glows */}
          <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
            {/* Top-Left Very Light Gray Glow */}
            <div className="absolute -top-[5%] -left-[5%] w-[35vw] h-[35vw] max-w-[400px] max-h-[400px] rounded-full bg-gray-200/60 blur-[100px] mix-blend-multiply opacity-50" />
            {/* Bottom-Right Very Light Gray Glow */}
            <div className="absolute -bottom-[5%] -right-[5%] w-[35vw] h-[35vw] max-w-[400px] max-h-[400px] rounded-full bg-slate-200/60 blur-[100px] mix-blend-multiply opacity-50" />
          </div>

          <WelcomeModal />
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
