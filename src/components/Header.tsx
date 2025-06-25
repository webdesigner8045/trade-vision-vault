import React from "react";

const Header = () => {
  return (
    <header className="bg-gray-900 text-white shadow-lg">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-4 py-3">
        {/* Logo / App Name */}
        <div className="text-2xl font-bold tracking-wide">
          Replay Locker
        </div>

        {/* Navigation Links */}
        <nav className="space-x-6 hidden md:flex">
          <a href="#" className="hover:text-gray-300">Home</a>
          <a href="#" className="hover:text-gray-300">Library</a>
          <a href="#" className="hover:text-gray-300">Upload</a>
          <a href="#" className="hover:text-gray-300">Profile</a>
        </nav>

        {/* Mobile Menu Icon */}
        <div className="md:hidden">
          <button>
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
