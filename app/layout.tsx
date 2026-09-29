import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://petakakushi-app.r524.workers.dev'),
  title: 'ぺたかくし — クレヨンのスクショスタンプ',
  description:
    'スクショの隠したいところに、クレヨン風のスタンプをぺたり。画像を端末内だけで加工して保存できます。',
  openGraph: {
    title: 'ぺたかくし — クレヨンのスクショスタンプ',
    description:
      'スクショの隠したいところに、クレヨン風のスタンプをぺたり。画像を端末内だけで加工して保存できます。',
    url: 'https://petakakushi-app.r524.workers.dev/',
    siteName: 'ぺたかくし',
    locale: 'ja_JP',
    type: 'website',
    images: [
      {
        url: '/ogp.png',
        width: 1200,
        height: 630,
        alt: 'クレヨンのスタンプでスクショを隠す「ぺたかくし」',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ぺたかくし — クレヨンのスクショスタンプ',
    description:
      'スクショの隠したいところに、クレヨン風のスタンプをぺたり。画像を端末内だけで加工して保存できます。',
    images: ['/ogp.png'],
  },
  icons: {
    icon: '/favicon-r524.png',
    shortcut: '/favicon-r524.png',
    apple: '/favicon-r524.png',
  },
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
