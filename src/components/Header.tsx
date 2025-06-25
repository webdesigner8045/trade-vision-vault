import React, { useState, useEffect } from "react";
import { supabase } from "../supabase"; // adjust path based on your setup

const Header = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState(null);

  // Get logged-in user from Supabase
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    fetchUser();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.reload(); // refresh to redirect to login or reset state
  };

  return (
    <header className="bg-gray-900 text-white shadow-lg fixed w-full z-50">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-4 py-3">
        {/* Logo / App Name */}
        <div className="text-2xl font-bold tracking-wide">Replay Locker</div>

        {/* Navigation Links (desktop) */}
        <nav className="space-x-6 hidden md:flex">
          <a href="/" className="hover:text-gray-300">Home</a>
          <a href="/library" className="hover:text-gray-300">Library</a>
          <a href="/upload" className="hover:text-gray-300">Upload</a>
          <a href="/profile" className="hover:text-gray-300">Profile</a>
        </nav>

        {/* Burger Menu Icon (mobile) */}
        <div className="md:hidden">
          <button onClick={() => setIsOpen(!isOpen)} aria-label="Toggle Menu">
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              {isOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {isOpen && (
        <div className="md:hidden bg-gray-800 px-4 py-3 space-y-3">
          <a href="/" className="block hover:text-gray-300">Home</a>
          <a href="/library" className="block hover:text-gray-300">Library</a>
          <a href="/upload" className="block hover:text-gray-300">Upload</a>
          <a href="/profile" className="block hover:text-gray-300">Profile</a>
          <hr className="border-gray-700" />
          {user && (
            <div className="text-sm text-gray-400">
              <p className="mb-1">Logged in as:</p>
              <p className="font-medium text-white">{user.email}</p>
              <button
                onClick={handleSignOut}
                className="mt-2 bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded"
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
};
