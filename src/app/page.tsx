import React from 'react';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-4 md:p-8 relative overflow-hidden">
      {/* Subtle Background Element - Example: Noise Texture (requires additional CSS/SVG) or Gradient */}
      {/* <div className="absolute inset-0 z-0 opacity-10 bg-[url('/noise.svg')]"></div> */}
      <div className="absolute inset-0 z-0 opacity-20 bg-gradient-to-br from-gray-900 via-black to-gray-800"></div>

      {/* Header Placeholder */}
      <header className="z-10 w-full max-w-5xl flex justify-start items-center font-mono text-sm opacity-0 animate-fade-in-slow">
        <p className="p-4 hover:text-gray-400 transition-colors duration-300 cursor-pointer">
          YOUR NAME / BRAND
        </p>
      </header>

      {/* Central Focus Element */}
      <div className="z-10 flex-grow flex items-center justify-center opacity-0 animate-fade-in-very-slow">
        {/* Example: Large Typography */}
        <h1 className="text-6xl md:text-8xl lg:text-9xl font-serif font-thin text-gray-200 tracking-wider select-none">
          JOIA
          {/* Or perhaps a single evocative letter or symbol? */}
          {/* J */}
        </h1>
         {/* Placeholder for future image/visual */}
         {/* <div className="w-64 h-96 border border-gray-700 flex items-center justify-center text-gray-600">Visual Here</div> */}
      </div>

      {/* Footer Placeholder */}
      <footer className="z-10 w-full max-w-5xl flex justify-center items-center text-xs text-gray-600 opacity-0 animate-fade-in-slow">
        <p className="p-4">
          © {new Date().getFullYear()} - Placeholder
        </p>
      </footer>

      {/* Basic CSS for animations (add to globals.css or keep here if preferred) */}
      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-slow {
          animation: fadeIn 1.5s ease-out 0.5s forwards;
        }
        .animate-fade-in-very-slow {
          animation: fadeIn 2s ease-out 1s forwards;
        }
      `}</style>
    </main>
  );
} 