import { useState, useEffect, useCallback } from 'react';
import { GameProvider } from './context/GameContext';
import { TipProvider } from './context/TipContext';
import TipOverlay from './components/TipOverlay';
import { VisualEventProvider } from './components/game/VisualEventLayer';
import BootScreen from './screens/BootScreen';
import TitleScreen from './screens/TitleScreen';
import { OnboardingBridge } from './components/onboarding/OnboardingBridge';
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
      // Boot only flips the gate; advance the screen state machine to the
      // landing screen too, otherwise `screen` stays 'boot' — which has no
      // render case, leaving the content area blank below the nav bar.
      go('landing');
      // The TitleScreen now serves as the welcome/orientation surface, so we
      // no longer fire the FIRST_RUN_01_OBJECTIVE tip here — it duplicated the
      // title card as a blocking modal on top of it.
    }} />;
  }

  const isFullscreen = FULLSCREEN_SCREENS.includes(screen);
  const bridgeVisible = !isFullscreen && screen !== 'landing' && !showHelp;

  // What the fixed chrome occupies, declared once. The screens inside shrink by
  // exactly this, so a screen's own footer CTA can never land under the nav bar
  // or the onboarding bridge. NAV_BAR_H matches the nav's h-8; BRIDGE_H clears
  // the bridge's collapsed row plus its bottom-4 offset.
  const NAV_BAR_H = '2rem';
  const BRIDGE_H = '3.5rem';
  const chromeStyle = {
    '--chrome-top': isFullscreen ? '0px' : NAV_BAR_H,
    '--chrome-bottom': bridgeVisible ? BRIDGE_H : '0px',
  } as React.CSSProperties;

  return (
    <div className="min-h-screen bg-terminal-black">
      {/* Tip overlay — rendered above everything except help */}
      {!showHelp && <TipOverlay />}

      {/* Help overlay */}
      {showHelp && <HelpScreen onClose={() => setShowHelp(false)} />}

      {/* Never-trap onboarding bridge (§4.1): save-progress + optional exits
          into formal ReFi onboarding. Hidden on the attract screen and during
          fullscreen decision views. */}
      {bridgeVisible && <OnboardingBridge />}

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

      <div className="app-chrome" style={chromeStyle}>
        {screen === 'landing' && (
          <TitleScreen
            onEnter={() => {
              // Straight into the arena. The tutorial used to gate this, which
              // put nine screens of reading and one explicitly unscored
              // practice commit between a visitor and their first real
              // decision: five to eight minutes to reach the thing the game is
              // actually about. CP1 is already a guided checkpoint with its own
              // coach, so it teaches by being played. The tutorial survives in
              // full as a HELP reference for anyone who wants it.
              go(tutorialComplete ? 'arena-map' : 'core-loop');
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
