import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ぺたかくし — クレヨンのスクショスタンプ',
  description:
    'スクショの隠したいところに、クレヨン風のスタンプをぺたり。画像を端末内だけで加工して保存できます。',
  icons: { icon: '/favicon.png', apple: '/favicon.png' },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
