interface LoadErrorProps {
  /** The server's own message where we have one — it says more than "failed". */
  message: string;
  onRetry: () => void;
}

/**
 * Shown when a list fails to load, in place of the list.
 *
 * Pairs with the try/catch/finally in each page's fetch: `loading` always
 * clears, so a failure lands here instead of leaving a skeleton up forever.
 */
export default function LoadError({ message, onRetry }: LoadErrorProps) {
  return (
    <div className="card p-6 text-center">
      <p className="text-sm text-red-700 mb-3">{message}</p>
      <button className="btn-primary" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}
