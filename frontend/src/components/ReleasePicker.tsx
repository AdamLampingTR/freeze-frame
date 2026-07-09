export function ReleasePicker({
  releases,
  value,
  onChange,
}: {
  releases: string[];
  value: string;
  onChange: (r: string) => void;
}) {
  return (
    <label className="release-picker">
      Target release{" "}
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {releases.length === 0 && <option value="">(none detected)</option>}
        {releases.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
    </label>
  );
}
