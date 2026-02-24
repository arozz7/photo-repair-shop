import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SettingsService } from './SettingsService.js';
import fs from 'fs';
import os from 'os';
import path from 'path';

describe('SettingsService', () => {
    let testDirPath: string;
    let service: SettingsService;

    beforeEach(() => {
        testDirPath = fs.mkdtempSync(path.join(os.tmpdir(), 'prs-settings-test-'));
        service = new SettingsService(testDirPath);
    });

    afterEach(() => {
        fs.rmSync(testDirPath, { recursive: true, force: true });
    });

    it('creates default settings on initialization', () => {
        const settingsPath = path.join(testDirPath, 'settings.json');
        expect(fs.existsSync(settingsPath)).toBe(true);

        const settings = service.getSettings();
        expect(settings.autoEnhanceOutput).toBe(false);
        expect(settings.defaultOutputStrategy).toBe('prompt');
        expect(settings.customOutputDirectory).toBeNull();
        expect(settings.concurrentJobsLimit).toBe(2);
    });

    it('can update partial settings', () => {
        service.updateSettings({ autoEnhanceOutput: true });

        const settings = service.getSettings();
        expect(settings.autoEnhanceOutput).toBe(true);
        expect(settings.concurrentJobsLimit).toBe(2); // Retains others

        // Verify file was written
        const fileData = JSON.parse(fs.readFileSync(path.join(testDirPath, 'settings.json'), 'utf8'));
        expect(fileData.autoEnhanceOutput).toBe(true);
    });

    it('can update multiple settings', () => {
        service.updateSettings({
            concurrentJobsLimit: 5,
            defaultOutputStrategy: 'custom-folder',
            customOutputDirectory: '/some/path'
        });

        const settings = service.getSettings();
        expect(settings.concurrentJobsLimit).toBe(5);
        expect(settings.defaultOutputStrategy).toBe('custom-folder');
        expect(settings.customOutputDirectory).toBe('/some/path');
        expect(settings.autoEnhanceOutput).toBe(false); // Retains others
    });
});
