type Row = {
  label: string;
  value: string | number | JSX.Element;
};

type Props = {
  rows: Row[];
};

export default function InfoTable({ rows }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="table table-zebra text-sm">
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <td className="font-medium text-neutral">{row.label}</td>
              <td className="text-slate-600">{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
