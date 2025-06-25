
import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AuthPage from '@/components/AuthPage';
import Header from '@/components/Header';
import Dashboard from '@/components/Dashboard';
import Timeline from '@/components/Timeline';
import TradeReplayForm from '@/components/TradeReplayForm';

const Index = () => {
  const { user, loading } = useAuth();
  const [currentView, setCurrentView] = useState<'dashboard' | 'timeline' | 'form'>('dashboard');

  if (loading) {
    return (
      <div className="min-h-screen min-h-dvh bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center px-4">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard onNewReplay={() => setCurrentView('form')} />;
      case 'timeline':
        return <Timeline />;
      case 'form':
        return <TradeReplayForm onTradeCreated={() => setCurrentView('dashboard')} />;
      default:
        return <Dashboard onNewReplay={() => setCurrentView('form')} />;
    }
  };

  return (
    <div className="min-h-screen min-h-dvh bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 overflow-x-hidden">
      <Header onNewReplay={() => setCurrentView('form')} />
      
      {/* Navigation */}
      <div className="border-b border-gray-700 bg-gray-900/50 sticky top-16 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
          <nav className="flex space-x-1 sm:space-x-6 overflow-x-auto scrollbar-hide">
            <button
              onClick={() => setCurrentView('dashboard')}
              className={`px-3 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap touch-target ${
                currentView === 'dashboard'
                  ? 'bg-green-600 text-white'
                  : 'text-gray-300 hover:text-white hover:bg-gray-800'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setCurrentView('timeline')}
              className={`px-3 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap touch-target ${
                currentView === 'timeline'
                  ? 'bg-green-600 text-white'
                  : 'text-gray-300 hover:text-white hover:bg-gray-800'
              }`}
            >
              Timeline
            </button>
            <button
              onClick={() => setCurrentView('form')}
              className={`px-3 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap touch-target ${
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
      <main className="flex-1 min-h-0">
        {renderContent()}
      </main>
    </div>
  );
};

export default Index;
