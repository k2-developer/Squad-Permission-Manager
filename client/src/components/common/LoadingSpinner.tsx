export default function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const px = size === 'sm' ? 'h-5 w-5' : size === 'lg' ? 'h-10 w-10' : 'h-7 w-7';
  return (
    <div className="flex items-center justify-center py-8">
      <div
        className={`${px} animate-spin rounded-full border-2 border-surface-600 border-t-accent-500`}
      />
    </div>
  );
}
