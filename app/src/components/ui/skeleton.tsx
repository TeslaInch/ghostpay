export function Skeleton({
  className = "",
  width,
  height,
}: {
  className?: string;
  width?: string;
  height?: string;
}) {
  return (
    <div
      className={`gp-skeleton ${className}`}
      style={{ width, height: height ?? "1rem" }}
    />
  );
}
