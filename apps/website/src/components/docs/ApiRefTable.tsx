export interface ApiEntry {
  name: string;
  type: string;
  description: string;
  params?: { name: string; type: string; desc: string }[];
}

export function ApiRefTable({ entries }: { entries: ApiEntry[] }) {
  return (
    <div className="flex flex-col gap-8">
      {entries.map((entry) => (
        <div
          key={entry.name}
          className="p-6 rounded-lg api-ref-card">
          <div className="flex items-baseline gap-3 mb-2">
            <code
              className="font-mono font-bold text-base api-ref-name">
              {entry.name}
            </code>
            <code
              className="font-mono text-xs api-ref-type">
              {entry.type}
            </code>
          </div>
          <p className="text-sm mb-4 api-ref-description">{entry.description}</p>
          {entry.params && entry.params.length > 0 && (
            <table className="w-full text-xs api-ref-table">
              <thead>
                <tr>
                  {['Parameter', 'Type', 'Description'].map((h) => (
                    <th
                      key={h}
                      className="text-left py-2 font-mono uppercase api-ref-table-head">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entry.params.map((p) => (
                  <tr key={p.name}>
                    <td className="py-2 font-mono api-ref-param-name">{p.name}</td>
                    <td className="py-2 font-mono api-ref-param-type">{p.type}</td>
                    <td className="py-2 api-ref-param-desc">{p.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}
    </div>
  );
}
