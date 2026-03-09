import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ProjectCar — DIY Car Maintenance Guides",
  description: "Step-by-step visual maintenance guides for your project car with torque specs, tool lists, and factory procedures.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
