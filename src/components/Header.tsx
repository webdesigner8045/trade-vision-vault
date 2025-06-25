import React, { useState } from 'react';

export default function Header() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className="w-full max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 bg-white shadow-md fixed top-0 left-0 right-0 z-50">
      <div className="flex items-center justify-between h-16">
        {/* Logo or brand */}
        <div className="flex-shrink-0">
          <a href="/" className="text-xl font-bold text-gray-800">Trade Vision Vault</a>
        </div>

        {/* Desktop nav */}
        <nav className="hidden md:flex space-x-6">
          <a href="/" className="text-gray-700 hover:text-gray-900">Home</a>
          <a href="/upload" className="text-gray-700 hover:text-gray-900">Upload</a>
          <a href="/replay" className="text-gray-700 hover:text-gray-900">Replay</a>
          <a href="/dashboard" className="text-gray-700 hover:text-gray-900">Dashboard</a>
        </nav>

        {/* Mobile hamburger menu button */}
        <div className="md:hidden">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="text-gray-700 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
            aria-label="Toggle menu"
          >
            {isOpen ? (
              <svg
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {isOpen && (
        <nav className="md:hidden px-4 pb-4 space-y-2 bg-white shadow-lg">
          <a href="/" className="block text-gray-700 hover:text-gray-900">Home</a>
          <a href="/upload" className="block text-gray-700 hover:text-gray-900">Upload</a>
          <a href="/replay" className="block text-gray-700 hover:text-gray-900">Replay</a>
          <a href="/dashboard" className="block text-gray-700 hover:text-gray-900">Dashboard</a>
        </nav>
      )}
    </header>
  );
}
