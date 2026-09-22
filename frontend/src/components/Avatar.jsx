export default function Avatar({ displayName, color, size = 40 }) {
  const initial = (displayName || '?').trim().charAt(0).toUpperCase();
  return (
    <div
      className="avatar"
      style={{ backgroundColor: color || '#1d9bf0', width: size, height: size, fontSize: size * 0.45 }}
    >
      {initial}
    </div>
  );
}
