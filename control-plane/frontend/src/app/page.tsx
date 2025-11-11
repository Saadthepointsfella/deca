export default function HomePage() {
  return (
    <div>
      <h2 className="text-2xl font-semibold mb-2">Kernel Dashboard</h2>
      <p className="text-sm text-slate-300">
        This is the control plane kernel UI. Use the sidebar to navigate:
      </p>
      <ul className="list-disc list-inside text-sm text-slate-400 mt-3 space-y-1">
        <li>
          <strong>Orgs</strong> – list organizations and assign plans.
        </li>
        <li>
          <strong>Usage</strong> – manually hit <code>/usage/check</code> and
          inspect decisions.
        </li>
        <li>
          <strong>Support</strong> – create tickets and pull the next one via
          policy.
        </li>
        <li>
          <strong>Settings</strong> – view plan config (later tweak knobs).
        </li>
      </ul>
      <p className="mt-4 text-xs text-slate-500">
        Backend expected at <code>http://localhost:4000/api</code>, configured
        via <code>NEXT_PUBLIC_API_BASE_URL</code>.
      </p>
    </div>
  );
}
