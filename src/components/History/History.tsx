import React, { useEffect, useState } from 'react';
import { RefreshCcw, CheckCircle2, XCircle, Clock } from 'lucide-react';

interface JobOutput {
    job_id: string;
    original_path: string;
    strategy: string;
    status: string;
    created_at: string;
}

export const History: React.FC = () => {
    const [jobs, setJobs] = useState<JobOutput[]>([]);
    const [loading, setLoading] = useState(true);

    const loadHistory = async () => {
        setLoading(true);
        try {
            // @ts-ignore
            const history = await window.electronAPI.getHistory();
            setJobs(history);
        } catch (e) {
            console.error("Failed to load history:", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadHistory();
    }, []);

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'done':
                return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-success/10 text-success border border-success/20"><CheckCircle2 className="w-3.5 h-3.5" /> Complete</span>;
            case 'failed':
                return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-danger/10 text-danger border border-danger/20"><XCircle className="w-3.5 h-3.5" /> Failed</span>;
            case 'queued':
            case 'analyzing':
            case 'repairing':
            case 'verifying':
            default:
                return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-warning/10 text-warning border border-warning/20"><Clock className="w-3.5 h-3.5" /> In Progress</span>;
        }
    };

    return (
        <div className="flex-1 p-8 text-text bg-background overflow-auto">
            <div className="flex justify-between items-center mb-8">
                <h2 className="text-3xl font-bold tracking-tight">Job History</h2>
                <button
                    onClick={loadHistory}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-surface hover:bg-surface-hover border border-surface-hover rounded-lg text-sm font-medium transition-all active:scale-95 text-text flex-shrink-0">
                    <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''} text-text-muted`} />
                    Refresh
                </button>
            </div>

            <div className="bg-surface border border-surface-hover rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-surface-hover/50 text-text-muted text-xs uppercase tracking-wider font-medium border-b border-surface-hover">
                            <tr>
                                <th className="px-6 py-4">Job ID</th>
                                <th className="px-6 py-4">Target File</th>
                                <th className="px-6 py-4">Strategy</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Date</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-hover">
                            {jobs.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-text-muted">
                                        No repair history found.
                                    </td>
                                </tr>
                            ) : (
                                jobs.map((job) => (
                                    <tr key={job.job_id} className="hover:bg-surface-hover/30 transition-colors">
                                        <td className="px-6 py-4 font-mono text-xs text-text-muted">{job.job_id.replace('job-', '')}</td>
                                        <td className="px-6 py-4 max-w-[200px] truncate" title={job.original_path}>
                                            {job.original_path.split('\\').pop()?.split('/').pop()}
                                        </td>
                                        <td className="px-6 py-4 font-mono text-xs text-text-muted/80">{job.strategy}</td>
                                        <td className="px-6 py-4">{getStatusBadge(job.status)}</td>
                                        <td className="px-6 py-4 text-text-muted text-xs">
                                            {new Date(job.created_at).toLocaleString()}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
