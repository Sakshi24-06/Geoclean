import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, AlertTriangle, Trash2, X } from 'lucide-react';
import { useAuth } from '@/lib/auth';

interface DeleteAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function DeleteAccountModal({ isOpen, onClose, onSuccess }: DeleteAccountModalProps) {
  const { user, deleteAccount } = useAuth();
  const navigate = useNavigate();
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setConfirmText('');
      setDeleting(false);
      setError(null);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !deleting) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, deleting, onClose]);

  if (!isOpen) return null;

  const isConfirmed = confirmText.trim() === 'DELETE';

  const handleDelete = async () => {
    if (!isConfirmed || deleting) return;
    setDeleting(true);
    setError(null);

    const res = await deleteAccount();

    if (!res.ok) {
      setDeleting(false);
      setError(res.error || 'Failed to delete account. Please try again.');
      return;
    }

    if (onSuccess) {
      onSuccess();
    }
    onClose();
    // Redirect to home/login with success state
    navigate('/', { replace: true });
    alert('Your GeoClean account has been permanently deleted.');
  };

  const isNgo = user?.role === 'ngo';

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-dialog-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !deleting) {
          onClose();
        }
      }}
    >
      <div className="success-modal animate-fade-up max-w-md" style={{ maxWidth: 460 }}>
        {!deleting && (
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={20} />
          </button>
        )}

        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-red-100 text-red-600 shadow-sm">
          <Trash2 size={28} />
        </div>

        <h2 id="delete-dialog-title" className="mt-4 text-xl font-extrabold text-ink">
          Delete Account?
        </h2>

        <p className="mt-2 text-sm text-slate-600">
          Are you sure you want to permanently delete your GeoClean account? This action cannot be undone.
        </p>

        <div className="mt-4 rounded-xl border border-red-200 bg-red-50/70 p-3.5 text-left text-xs text-red-800">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="shrink-0 text-red-600 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold">Permanent Data Removal</p>
              <p className="text-red-700 leading-relaxed">
                {isNgo
                  ? 'Your organization profile will be removed from the NGO Directory, and all active cleanup assignments will be released.'
                  : 'Your citizen profile, reports, and notification history will be permanently deleted.'}
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-left text-xs font-semibold text-red-700">
            <AlertCircle size={15} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="mt-5 text-left">
          <label htmlFor="confirm-delete-input" className="block text-xs font-bold text-slate-700">
            To confirm, please type <span className="font-extrabold text-red-600">DELETE</span> below:
          </label>
          <input
            id="confirm-delete-input"
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            disabled={deleting}
            placeholder="Type DELETE"
            className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-bold tracking-wider text-ink outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-500/20 disabled:bg-slate-100"
            autoComplete="off"
            autoFocus
          />
        </div>

        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            type="button"
            className="button-secondary flex-1"
            onClick={onClose}
            disabled={deleting}
            id="cancel-delete-modal-btn"
          >
            Cancel
          </button>
          <button
            type="button"
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 py-3 px-4 text-sm font-bold text-white shadow-lg shadow-red-600/20 transition hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
            onClick={handleDelete}
            disabled={!isConfirmed || deleting}
            id="confirm-delete-account-btn"
          >
            {deleting ? (
              <>
                <span className="spinner !border-white !border-t-transparent" />
                <span>Deleting…</span>
              </>
            ) : (
              <>
                <Trash2 size={16} />
                <span>Delete Account</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
