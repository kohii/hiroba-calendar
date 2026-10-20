import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'さいたま市子育て支援センター イベントスケジュール',
  description: 'さいたま市の子育て支援センターのイベントスケジュールを一覧で確認できます',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ja">
      <body className="antialiased bg-gray-50">
        {children}
      </body>
    </html>
  )
}
