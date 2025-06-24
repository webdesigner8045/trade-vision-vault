
import React, { useState } from 'react';
import Header from '@/components/Header';
import Dashboard from '@/components/Dashboard';
import Timeline from '@/components/Timeline';
import TradeReplayForm from '@/components/TradeReplayForm';

const Index = () => {
  const [currentView, setCurrentView] = useState<'dashboard' | 'timeline' | 'form'>('dashboard');

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard />;
      case 'timeline':
        return <Timeline />;
      case 'form':
        return <TradeReplayForm />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <Header />
      
      {/* Navigation */}
      <div className="border-b border-gray-700 bg-gray-900/50">
        <div className="px-6 py-3">
          <nav className="flex space-x-6">
            <button
              onClick={() => setCurrentView('dashboard')}
              className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                currentView === 'dashboard'
                  ? 'bg-green-600 text-white'
                  : 'text-gray-300 hover:text-white hover:bg-gray-800'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setCurrentView('timeline')}
              className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                currentView === 'timeline'
                  ? 'bg-green-600 text-white'
                  : 'text-gray-300 hover:text-white hover:bg-gray-800'
              }`}
            >
              Timeline
            </button>
            <button
              onClick={() => setCurrentView('form')}
              className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                currentView === 'form'
                  ? 'bg-green-600 text-white'
                  : 'text-gray-300 hover:text-white hover:bg-gray-800'
              }`}
            >
              New Replay
            </button>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1">
        {renderContent()}
      </main>

      {/* Footer with Supabase Integration Notice */}
      <footer className="border-t border-gray-700 bg-gray-900/80 p-4">
        <div className="text-center text-sm text-gray-400">
          <p>Ready to add authentication and data persistence? 
            <span className="text-green-400 ml-1">Connect to Supabase using the button in the top right.</span>
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
