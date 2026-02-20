import { RepairOperation } from '../db/RepairRepository';

export interface RepairInput {
    jobId: string;
    sourceFilePath: string;
    outputFilePath: string;
    referenceFilePath?: string;
    autoEnhance?: boolean;
    onProgress?: (percent: number, stage: string) => void;
}

export interface RepairResult {
    success: boolean;
    repairedFilePath?: string;
    error?: string;
    warnings?: string[];
    metrics?: {
        patchCount?: number;
        bytesProcessed?: number;
    };
}

export interface IRepairStrategy {
    name: string;
    requiresReference: boolean;

    /**
     * Executes the repair strategy.
     * @param input Data required for the repair operation.
     */
    repair(input: RepairInput): Promise<RepairResult>;
}
