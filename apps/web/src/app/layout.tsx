import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "UWT — хронология войны в Украине",
  description:
    "Интерактивная карта и таймлайн войны в Украине с 24.02.2022: линия фронта, события, потери и статистика по дням с указанием источников.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

/** Ставит класс темы до гидратации — без вспышки неправильной темы. */
const themeScript = `
try {
  var s = localStorage.getItem('uwt-settings-v1');
  var t = s ? (JSON.parse(s).theme || 'dark') : (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  if (t === 'dark') document.documentElement.classList.add('dark');
} catch (e) { document.documentElement.classList.add('dark'); }
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
