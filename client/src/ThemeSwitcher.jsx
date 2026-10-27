import { useEffect, useState } from "react";

export const THEMES = [
  ["aurora", "Aurora"],
  ["ocean", "Ocean"],
  ["sunset", "Sunset"],
  ["mint", "Mint"],
  ["candy", "Candy"],
];

// remembers the chosen theme in the browser
export function useTheme() {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("theme") || "aurora";
    } catch {
      return "aurora";
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("theme", theme);
    } catch {
      /* ignore */
    }
  }, [theme]);
  return [theme, setTheme];
}

export default function ThemeSwitcher({ theme, setTheme }) {
  return (
    <div className="tray" role="group" aria-label="Colour theme">
      <span className="muted" style={{ fontSize: 12, fontWeight: 800, marginRight: 6 }}>
        Theme
      </span>
      {THEMES.map(([id, label]) => (
        <button
          key={id}
          type="button"
          className={`sw sw-${id} ${theme === id ? "on" : ""}`}
          aria-label={`${label} theme`}
          aria-pressed={theme === id}
          onClick={() => setTheme(id)}
        />
      ))}
    </div>
  );
}