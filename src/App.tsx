import { useState } from 'react';
import { RepairWizard } from './components/RepairWizard/RepairWizard';
import { ImportStep } from './components/RepairWizard/steps/ImportStep';
import { AnalysisStep } from './components/RepairWizard/steps/AnalysisStep';
import { StrategyStep } from './components/RepairWizard/steps/StrategyStep';
import { ExecutionStep } from './components/RepairWizard/steps/ExecutionStep';
import { ResultStep } from './components/RepairWizard/steps/ResultStep';
import { Sidebar } from './components/Sidebar';
import type { AppView } from './components/Sidebar';
import { History } from './components/History/History';
import { Settings } from './components/Settings/Settings';
import type { AnalysisResult } from '../electron/services/FileAnalyzer';

const STEPS = [
  { id: 'import', title: 'Import' },
  { id: 'analysis', title: 'Analysis' },
  { id: 'strategy', title: 'Strategy' },
  { id: 'execution', title: 'Repair' },
  { id: 'result', title: 'Result' }
];

function App() {
  const [currentView, setCurrentView] = useState<AppView>('repair');

  // Repair Wizard State
  const [currentStep, setCurrentStep] = useState(0);
  const [targetFile, setTargetFile] = useState<string>('');
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [strategyConfig, setStrategyConfig] = useState<any>(null);
  const [activeJobId, setActiveJobId] = useState<string>('');

  const handleFileSelect = (filepath: string) => {
    setTargetFile(filepath);
    setCurrentStep(1); // Move to analysis
  };

  const handleAnalysisComplete = (result: AnalysisResult) => {
    setAnalysisResult(result);
    setCurrentStep(2); // Move to strategy planning
  };

  const handleExecute = (config: any) => {
    setStrategyConfig({
      ...config,
      filePath: targetFile
    });
    setCurrentStep(3);
  };

  const handleRepairComplete = (jobId: string) => {
    setActiveJobId(jobId);
    setCurrentStep(4);
  };

  const handleRestart = () => {
    setTargetFile('');
    setAnalysisResult(null);
    setStrategyConfig(null);
    setActiveJobId('');
    setCurrentStep(0);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      <Sidebar currentView={currentView} onViewChange={setCurrentView} />

      <main className="flex-1 relative flex flex-col">
        {currentView === 'repair' && (
          <RepairWizard currentStep={currentStep} steps={STEPS}>
            <ImportStep onFileSelect={handleFileSelect} />
            <AnalysisStep filePath={targetFile} onAnalysisComplete={handleAnalysisComplete} />
            {analysisResult ? <StrategyStep analysis={analysisResult} onExecute={handleExecute} /> : <div />}
            {strategyConfig ? <ExecutionStep config={strategyConfig} onComplete={handleRepairComplete} /> : <div />}
            <ResultStep jobId={activeJobId} onRestart={handleRestart} />
          </RepairWizard>
        )}

        {currentView === 'history' && <History />}
        {currentView === 'settings' && <Settings />}
      </main>
    </div>
  );
}

export default App;
