export default function Loading() {
  return (
    <div
      className="route-progress route-progress-fallback"
      role="progressbar"
      aria-label="Loading page"
      aria-valuemin={0}
      aria-valuemax={100}
    />
  );
}
