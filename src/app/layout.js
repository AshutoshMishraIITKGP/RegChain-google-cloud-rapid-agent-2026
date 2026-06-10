import './globals.css';

export const metadata = {
  title: 'RegChain — AI-Assisted Compliance Knowledge Graph',
  description: 'An enterprise-grade compliance knowledge graph platform with AI-powered regulatory change management. Visualize, explore, and manage regulations, obligations, controls, and risks.',
  keywords: ['compliance', 'knowledge graph', 'regulatory', 'AI', 'regtech', 'risk management'],
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
