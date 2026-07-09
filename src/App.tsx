import { useState, useEffect, useCallback } from 'react';
import { GameProvider } from './context/GameContext';
import { TipProvider, useTips } from './context/TipContext';
import TipOverlay from './components/TipOverlay';
import { VisualEventProvider } from './components/game/VisualEventLayer';
import BootScreen from './screens/BootScreen';
import LandingScreen from './screens/LandingScreen';
import ArenaMapScreen from './screens/ArenaMapScreen';
import ArenaBriefingScreen from './screens/ArenaBriefingScreen';
import MachineCardScreen from './screens/MachineCardScreen';
import CoreLoopScreen from './screens/CoreLoopScreen';
import MachineRevealScreen from './screens/MachineRevealScreen';
import CheckpointScoreScreen from './screens/CheckpointScoreScreen';
import AutopsyScreen from './screens/AutopsyScreen';
import AlphaProfileScreen from './screens/AlphaProfileScreen';
import BasketWriterScreen from './screens/BasketWriterScreen';
import TacoUnlockScreen from './screens/TacoUnlockScreen';
import TacoBossScreen from './screens/TacoBossScreen';
import DailyTapeScreen from './screens/DailyTapeScreen';
import MachineLadderScreen from './screens/MachineLadderScreen';
import MachineBuilderScreen from './screens/MachineBuilderScreen';
import ProgressionHubScreen from './screens/ProgressionHubScreen';
import TutorialScreen from './screens/TutorialScreen';
import HelpScreen from './screens/HelpScreen';

type Screen =
  | 'boot'
  | 'landing'
  | 'tutorial'
  | 'arena-map'
  | 'arena-briefing'
  | 'machine-card'
  | 'core-loop'
  | 'machine-reveal'
  | 'checkpoint-score'
  | 'autopsy'
  | 'alpha-profile'
  | 'basket-writer'
  | 'taco-unlock'
  | 'taco-boss'
  | 'daily-tape'
  | 'machine-ladder'
  | 'machine-builder'
  | 'progression-hub';

const NAV_LABELS: Partial<Record<Screen, string>> = {
  landing: 'LANDING',
  tutorial: 'TUTORIAL',
  'arena-map': 'ARENA MAP',
  'arena-briefing': 'BRIEFING',
  'machine-card': 'MACHINE CARD',
  'core-loop': 'CORE LOOP',
  'machine-reveal': 'REVEAL',
  'checkpoint-score': 'SCORE',
  autopsy: 'AUTOPSY',
  'alpha-profile': 'PROFILE',
  'basket-writer': 'BASKET',
  'taco-unlock': 'TACO UNLOCK',
  'taco-boss': 'FINAL BOSS',
  'daily-tape': 'DAILY TAPE',
  'machine-ladder': 'LADDER',
  'machine-builder': 'BUILDER',
  'progression-hub': 'HUB',
};

const DEMO_FLOW: Screen[] = [
  'landing',
  'tutorial',
  'progression-hub',
  'arena-map',
  'arena-briefing',
  'machine-card',
  'core-loop',
  'machine-reveal',
  'checkpoint-score',
  'autopsy',
  'alpha-profile',
  'basket-writer',
  'taco-unlock',
  'taco-boss',
  'daily-tape',
  'machine-ladder',
  'machine-builder',
];

// Screens that take the full viewport with no nav overlay
const FULLSCREEN_SCREENS: Screen[] = ['core-loop', 'taco-boss', 'tutorial'];

function AppInner() {
  const [screen, setScreen] = useState<Screen>('boot');
  const [bootDone, setBootDone] = useState(false);
  const [tutorialComplete, setTutorialComplete] = useState(() => {
    return localStorage.getItem('refi_tutorial_complete') === '1';
  });
  const [showHelp, setShowHelp] = useState(false);
  const { triggerEvent } = useTips();

  const go = useCallback((s: Screen) => setScreen(s), []);

  const toggleHelp = useCallback(() => setShowHelp(h => !h), []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Help toggle: ? or F10
      if (e.key === '?' || e.key === 'F10') {
        e.preventDefault();
        toggleHelp();
        return;
      }
      // ESC closes help or navigates back
      if (e.key === 'Escape') {
        if (showHelp) {
          setShowHelp(false);
          return;
        }
        const backMap: Partial<Record<Screen, Screen>> = {
          tutorial: 'landing',
          'machine-card': 'arena-briefing',
          'arena-briefing': 'arena-map',
          'arena-map': 'landing',
          'machine-reveal': 'core-loop',
          autopsy: 'checkpoint-score',
          'alpha-profile': 'autopsy',
          'basket-writer': 'alpha-profile',
          'taco-boss': 'taco-unlock',
          'daily-tape': 'progression-hub',
          'machine-ladder': 'progression-hub',
          'machine-builder': 'progression-hub',
          'progression-hub': 'landing',
        };
        const back = backMap[screen];
        if (back) go(back);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [screen, go, showHelp, toggleHelp]);

  const handleTutorialComplete = () => {
    setTutorialComplete(true);
    localStorage.setItem('refi_tutorial_complete', '1');
    go('arena-map');
  };

  if (!bootDone) {
    return <BootScreen onComplete={() => {
      setBootDone(true);
      // Trigger first-entry tip after boot — only fires if tip hasn't been seen
      triggerEvent('game.first_entry');
    }} />;
  }

  const isFullscreen = FULLSCREEN_SCREENS.includes(screen);

  return (
    <div className="min-h-screen bg-terminal-black">
      {/* Tip overlay — rendered above everything except help */}
      {!showHelp && <TipOverlay />}

      {/* Help overlay */}
      {showHelp && <HelpScreen onClose={() => setShowHelp(false)} />}

      {/* Dev nav bar */}
      {!isFullscreen && (
        <div className="fixed top-0 left-0 right-0 z-50 border-b border-phosphor/15 bg-terminal-black/95">
          <div className="flex items-center h-8 px-4 gap-0 overflow-x-auto scrollbar-hide">
            <span className="font-mono text-xs text-phosphor-dim flex-shrink-0 mr-3 tracking-widest border-r border-phosphor/20 pr-3">
              DEMO
            </span>
            {DEMO_FLOW.map((s, i) => (
              <button
                key={s}
                onClick={() => go(s)}
                className={`font-mono text-xs px-2.5 h-full border-r border-phosphor/10 flex-shrink-0 transition-colors whitespace-nowrap ${
                  screen === s
                    ? 'text-phosphor bg-phosphor/10'
                    : 'text-phosphor-dim hover:text-phosphor-mid hover:bg-phosphor/5'
                }`}
              >
                {String(i + 1).padStart(2, '0')} {NAV_LABELS[s]}
              </button>
            ))}
            <button
              onClick={toggleHelp}
              className="font-mono text-xs px-2.5 h-full text-phosphor-dim hover:text-phosphor-mid transition-colors whitespace-nowrap ml-auto"
            >
              ? HELP
            </button>
          </div>
        </div>
      )}

      <div className={!isFullscreen ? 'pt-8' : ''}>
        {screen === 'landing' && (
          <LandingScreen
            onEnter={() => {
              if (!tutorialComplete) {
                go('tutorial');
              } else {
                go('arena-map');
              }
            }}
          />
        )}
        {screen === 'tutorial' && (
          <TutorialScreen onComplete={handleTutorialComplete} />
        )}
        {screen === 'progression-hub' && (
          <ProgressionHubScreen
            onStartRun={() => {
              if (!tutorialComplete) {
                go('tutorial');
              } else {
                go('arena-map');
              }
            }}
            onDailyTape={() => go('daily-tape')}
            onMachineLadder={() => go('machine-ladder')}
            onBack={() => go('landing')}
          />
        )}
        {screen === 'arena-map' && (
          <ArenaMapScreen
            onSelectArena={() => go('arena-briefing')}
            onBack={() => go('progression-hub')}
          />
        )}
        {screen === 'arena-briefing' && (
          <ArenaBriefingScreen
            onStart={() => go('core-loop')}
            onViewMachineCard={() => go('machine-card')}
            onBack={() => go('arena-map')}
          />
        )}
        {screen === 'machine-card' && (
          <MachineCardScreen onReturn={() => go('arena-briefing')} />
        )}
        {screen === 'core-loop' && (
          <CoreLoopScreen
            onComplete={() => go('autopsy')}
            onBack={() => go('arena-briefing')}
            onHelp={toggleHelp}
          />
        )}
        {screen === 'machine-reveal' && (
          <MachineRevealScreen onContinue={() => go('checkpoint-score')} />
        )}
        {screen === 'checkpoint-score' && (
          <CheckpointScoreScreen
            result="active"
            onContinue={() => go('arena-map')}
            onViewAutopsy={() => go('autopsy')}
          />
        )}
        {screen === 'autopsy' && (
          <AutopsyScreen onContinue={() => go('alpha-profile')} />
        )}
        {screen === 'alpha-profile' && (
          <AlphaProfileScreen
            onBasketWriter={() => go('basket-writer')}
            onBack={() => go('autopsy')}
          />
        )}
        {screen === 'basket-writer' && (
          <BasketWriterScreen
            onBack={() => go('alpha-profile')}
            onComplete={() => go('taco-unlock')}
          />
        )}
        {screen === 'taco-unlock' && (
          <TacoUnlockScreen onEnter={() => go('taco-boss')} />
        )}
        {screen === 'taco-boss' && (
          <TacoBossScreen
            onComplete={() => go('alpha-profile')}
            onBack={() => go('taco-unlock')}
          />
        )}
        {screen === 'daily-tape' && (
          <DailyTapeScreen onBack={() => go('progression-hub')} />
        )}
        {screen === 'machine-ladder' && (
          <MachineLadderScreen
            onChallenge={() => go('arena-briefing')}
            onBack={() => go('progression-hub')}
          />
        )}
        {screen === 'machine-builder' && (
          <MachineBuilderScreen
            onBack={() => go('progression-hub')}
            onCompiled={() => go('arena-map')}
          />
        )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <GameProvider>
      <TipProvider>
        <VisualEventProvider>
          <AppInner />
        </VisualEventProvider>
      </TipProvider>
    </GameProvider>
  );
}
