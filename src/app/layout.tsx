import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "회의 코파일럿", description: "내 메모와 실시간 코칭" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body className="antialiased">{children}</body></html>;
}
