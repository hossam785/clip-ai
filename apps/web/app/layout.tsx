import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { I18nProvider } from "@/lib/i18n-context";

export const metadata = {
  title: "Clip AI - AI Video Clipping & Reframe SaaS",
  description: "Transform long YouTube videos and uploads into viral 9:16 TikToks, Reels, and Shorts using Gemini key rotation pools.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-background text-foreground antialiased">
        <I18nProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
