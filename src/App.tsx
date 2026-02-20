import { useState } from 'react';
import { RepairWizard } from './components/RepairWizard/RepairWizard';
import { ImportStep } from './components/RepairWizard/steps/ImportStep';
import { AnalysisStep } from './components/RepairWizard/steps/AnalysisStep';
import { StrategyStep } from './components/RepairWizard/steps/StrategyStep';
import { ExecutionStep } from './components/RepairWizard/steps/ExecutionStep';
import { ResultStep } from './components/RepairWizard/steps/ResultStep';
import type { AnalysisResult } from '../electron/services/FileAnalyzer';

const STEPS = [
  { id: 'import', title: 'Import' },
  { id: 'analysis', title: 'Analysis' },
  { id: 'strategy', title: 'Strategy' },
  { id: 'execution', title: 'Repair' },
  { id: 'result', title: 'Result' }
];

function App() {
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
    <RepairWizard currentStep={currentStep} steps={STEPS}>
      {/* 0. Import */}
      <ImportStep onFileSelect={handleFileSelect} />

      {/* 1. Analysis */}
      <AnalysisStep
        filePath={targetFile}
        onAnalysisComplete={handleAnalysisComplete} />

      {/* 2. Strategy Setup */}
      {analysisResult ? (
        <StrategyStep
          analysis={analysisResult}
          onExecute={handleExecute} />
      ) : <div />}

      {/* 3. Execution */}
      {strategyConfig ? (
        <ExecutionStep
          config={strategyConfig}
          onComplete={handleRepairComplete} />
      ) : <div />}

      {/* 4. Result */}
      <ResultStep jobId={activeJobId} onRestart={handleRestart} />

    </RepairWizard>
  );
}

export default App;
