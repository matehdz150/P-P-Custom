import { Empty } from "../ui/empty";

export function MeasurementsTable({
  sizes,
}: {
  sizes?: {
    size: string;
    widthIn: number;
    lengthIn: number;
  }[];
}) {
  if (!sizes?.length) return <Empty />;

  return (
    <div className="overflow-hidden rounded-[0.2rem] bg-white border">
      <table className="w-full text-sm border">
        <thead className="bg-[#f5f5f1]">
          <tr>
            <th className="px-4 py-4 text-left font-semibold border border-t-0">
              Talla
            </th>
            <th className="px-4 py-4 text-left font-semibold border border-t-0">
              Ancho (cm)
            </th>
            <th className="px-4 py-4 text-left font-semibold border border-t-0">
              Largo (cm)
            </th>
          </tr>
        </thead>

        <tbody>
          {sizes.map((s, i) => (
            <tr
              key={s.size}
              className={i % 2 === 0 ? "bg-white" : "bg-[#f5f5f1]"}
            >
              <td className="px-4 py-4 font-bold border border-t-0">
                {s.size}
              </td>
              <td className="px-4 py-4 border border-t-0">
                {s.widthIn.toFixed(1)}
              </td>
              <td className="px-4 py-4 border border-t-0 border-r-0">
                {s.lengthIn.toFixed(1)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}