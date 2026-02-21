import fs from 'fs';
import path from 'path';

export interface AppSettings {
    autoEnhanceOutput: boolean;
    defaultOutputStrategy: 'prompt' | 'original-folder' | 'custom-folder';
    customOutputDirectory: string | null;
    concurrentJobsLimit: number;
}

const DEFAULT_SETTINGS: AppSettings = {
    autoEnhanceOutput: false,
    defaultOutputStrategy: 'prompt',
    customOutputDirectory: null,
    concurrentJobsLimit: 2
};

export class SettingsService {
    private settingsPath: string;

    constructor(userDataPath: string) {
        this.settingsPath = path.join(userDataPath, 'settings.json');
        this.ensureSettings();
    }

    private ensureSettings(): void {
        if (!fs.existsSync(this.settingsPath)) {
            const dir = path.dirname(this.settingsPath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(this.settingsPath, JSON.stringify(DEFAULT_SETTINGS, null, 2), 'utf8');
        }
    }

    public getSettings(): AppSettings {
        try {
            const data = fs.readFileSync(this.settingsPath, 'utf8');
            return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
        } catch (e) {
            console.error('[SettingsService] Failed to read settings, returning default:', e);
            return DEFAULT_SETTINGS;
        }
    }

    public updateSettings(partial: Partial<AppSettings>): AppSettings {
        const current = this.getSettings();
        const updated = { ...current, ...partial };
        fs.writeFileSync(this.settingsPath, JSON.stringify(updated, null, 2), 'utf8');
        return updated;
    }
}
